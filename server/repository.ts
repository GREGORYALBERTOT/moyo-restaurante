import type { PoolClient } from '@neondatabase/serverless';
import type { State, Order, Product, Table, Activity } from '../src/store';
import { database } from './db';

const iso = (value: Date | string) => new Date(value).toISOString();
export async function readState(client: PoolClient): Promise<State> {
  const restaurant = (await client.query('SELECT name, subtitle, next_order_number FROM restaurant WHERE id = 1')).rows[0];
  if (!restaurant) throw new Error('Falta inicializar el esquema del restaurante.');
  const products: Product[] = (await client.query('SELECT id, name, category, price, description, available FROM products WHERE deleted_at IS NULL ORDER BY category, name')).rows.map(row => ({ id: row.id, name: row.name, category: row.category, price: row.price, description: row.description, available: row.available }));
  const tables: Table[] = (await client.query('SELECT id, number, seats, zone FROM restaurant_tables WHERE deleted_at IS NULL ORDER BY number')).rows;
  const orderRows = (await client.query('SELECT id, number, table_id, table_number, waiter, guests, status, note, rejection_reason, created_at, updated_at FROM orders ORDER BY created_at DESC')).rows;
  const itemRows = (await client.query('SELECT order_id, product_id, name, price, quantity, note FROM order_items ORDER BY order_id, item_index')).rows;
  const paymentRows = (await client.query('SELECT order_id, method, received, change, paid_at, reference FROM payments')).rows;
  const items = new Map<string, Order['items']>();
  for (const row of itemRows) {
    const group = items.get(row.order_id) || [];
    group.push({ productId: row.product_id, name: row.name, price: row.price, quantity: row.quantity, note: row.note });
    items.set(row.order_id, group);
  }
  const payments = new Map(paymentRows.map(row => [row.order_id, { method: row.method, received: Number(row.received), change: Number(row.change), paidAt: iso(row.paid_at), reference: row.reference }]));
  const orders: Order[] = orderRows.map(row => ({ id: row.id, number: row.number, tableId: row.table_id, tableNumber: row.table_number, waiter: row.waiter, guests: row.guests, status: row.status, items: items.get(row.id) || [], note: row.note, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at), rejectionReason: row.rejection_reason || undefined, payment: payments.get(row.id) }));
  const activities: Activity[] = (await client.query('SELECT id, title, description, type, time FROM activity ORDER BY time DESC LIMIT 100')).rows.map(row => ({ ...row, time: iso(row.time) }));
  return { version: 1, restaurant: { name: restaurant.name, subtitle: restaurant.subtitle }, tables, products, orders, activities, nextOrderNumber: restaurant.next_order_number };
}
export async function snapshot(): Promise<State> {
  const client = await database().connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const state = await readState(client);
    await client.query('COMMIT');
    return state;
  } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error; }
  finally { client.release(); }
}
const changed = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b);
export async function persistState(client: PoolClient, before: State, after: State): Promise<void> {
  await client.query('UPDATE restaurant SET name=$1, subtitle=$2, next_order_number=$3 WHERE id=1', [after.restaurant.name, after.restaurant.subtitle, after.nextOrderNumber]);
  const oldProducts = new Map(before.products.map(p => [p.id, p]));
  for (const p of after.products) if (changed(oldProducts.get(p.id), p)) await client.query('INSERT INTO products(id,name,category,price,description,available) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,category=EXCLUDED.category,price=EXCLUDED.price,description=EXCLUDED.description,available=EXCLUDED.available', [p.id,p.name,p.category,p.price,p.description,p.available]);
  const newProductIds = new Set(after.products.map(p => p.id));
  for (const p of before.products) if (!newProductIds.has(p.id)) await client.query('UPDATE products SET deleted_at=now(),available=false WHERE id=$1', [p.id]);
  const oldTables = new Map(before.tables.map(t => [t.id, t]));
  for (const t of after.tables) if (changed(oldTables.get(t.id), t)) await client.query('INSERT INTO restaurant_tables(id,number,seats,zone) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET number=EXCLUDED.number,seats=EXCLUDED.seats,zone=EXCLUDED.zone', [t.id,t.number,t.seats,t.zone]);
  const newTableIds = new Set(after.tables.map(t => t.id));
  for (const t of before.tables) if (!newTableIds.has(t.id)) await client.query('UPDATE restaurant_tables SET deleted_at=now() WHERE id=$1', [t.id]);
  const oldOrders = new Map(before.orders.map(o => [o.id, o]));
  for (const o of after.orders) {
    const previous = oldOrders.get(o.id);
    if (!previous) {
      await client.query('INSERT INTO orders(id,number,table_id,table_number,waiter,guests,status,note,rejection_reason,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [o.id,o.number,o.tableId,o.tableNumber,o.waiter,o.guests,o.status,o.note,o.rejectionReason ?? null,o.createdAt,o.updatedAt]);
      for (let i=0; i<o.items.length; i++) { const item=o.items[i]; await client.query('INSERT INTO order_items(order_id,item_index,product_id,name,price,quantity,note) VALUES($1,$2,$3,$4,$5,$6,$7)', [o.id,i,item.productId,item.name,item.price,item.quantity,item.note]); }
    } else if (changed(previous, o)) await client.query('UPDATE orders SET status=$2,updated_at=$3,rejection_reason=$4 WHERE id=$1', [o.id,o.status,o.updatedAt,o.rejectionReason ?? null]);
    if (o.payment && !previous?.payment) await client.query('INSERT INTO payments(order_id,method,received,change,paid_at,reference) VALUES($1,$2,$3,$4,$5,$6)', [o.id,o.payment.method,o.payment.received,o.payment.change,o.payment.paidAt,o.payment.reference || '']);
  }
  const oldActivities = new Set(before.activities.map(a => a.id));
  for (const a of after.activities) if (!oldActivities.has(a.id)) await client.query('INSERT INTO activity(id,title,description,type,time) VALUES($1,$2,$3,$4,$5)', [a.id,a.title,a.description,a.type,a.time]);
}
