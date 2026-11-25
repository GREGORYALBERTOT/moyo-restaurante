export type Role = 'admin' | 'mesero' | 'cocina' | 'caja';
export type Status = 'pending' | 'preparing' | 'ready' | 'delivered' | 'paid' | 'rejected';
export type PaymentMethod = 'cash' | 'card' | 'yape';
export interface Product { id: string; name: string; category: string; price: number; description: string; available: boolean }
export interface Table { id: string; number: number; seats: number; zone: string }
export interface OrderItem { productId: string; name: string; price: number; quantity: number; note: string }
export interface Payment { method: PaymentMethod; received: number; change: number; paidAt: string; reference?: string }
export interface Order { id: string; number: number; tableId: string; tableNumber: number; waiter: string; guests: number; status: Status; items: OrderItem[]; note: string; createdAt: string; updatedAt: string; rejectionReason?: string; payment?: Payment }
export interface Activity { id: string; title: string; description: string; time: string; type: string }
export interface State { version: 1; restaurant: { name: string; subtitle: string }; tables: Table[]; products: Product[]; orders: Order[]; activities: Activity[]; nextOrderNumber: number }

const id = () => globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const now = () => new Date().toISOString();
const clone = (state: State): State => JSON.parse(JSON.stringify(state));
function text(value: string, label: string, max = 100): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} es obligatorio.`);
  if (value.trim().length > max) throw new Error(`${label} admite hasta ${max} caracteres.`);
  return value.trim();
}
function note(value: string | undefined): string {
  if (value === undefined) return '';
  if (typeof value !== 'string' || value.length > 500) throw new Error('Las indicaciones admiten hasta 500 caracteres.');
  return value.trim();
}
function integer(value: number, min: number, max: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${label} debe ser un entero entre ${min} y ${max}.`);
  return value;
}
function addActivity(state: State, title: string, description: string, type: string) {
  state.activities.unshift({ id: id(), title, description, type, time: now() });
  state.activities = state.activities.slice(0, 100);
}
export function money(cents: number): string {
  return `S/ ${new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100)}`;
}
export function parseMoney(value: string): number {
  const normalized = String(value).trim();
  if (!/^\d{1,7}([.,]\d{1,2})?$/.test(normalized)) throw new Error('Ingresa un importe válido con hasta dos decimales.');
  const [whole, decimals = ''] = normalized.replace(',', '.').split('.');
  const cents = Number(whole) * 100 + Number(decimals.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents)) throw new Error('El importe es demasiado grande.');
  return cents;
}
export function orderTotal(order: Pick<Order, 'items'>): number {
  return order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}
export function activeOrderForTable(state: State, tableId: string): Order | undefined {
  return state.orders.find(order => order.tableId === tableId && !['paid', 'rejected'].includes(order.status));
}
export function createOrder(state: State, input: { tableId: string; waiter: string; guests: number; items: Array<{ productId: string; quantity: number; note?: string }>; note?: string }): State {
  const table = state.tables.find(item => item.id === input.tableId);
  if (!table) throw new Error('La mesa ya no está disponible.');
  if (activeOrderForTable(state, table.id)) throw new Error('Esta mesa ya tiene un pedido activo.');
  integer(input.guests, 1, table.seats, 'La cantidad de comensales');
  if (!Array.isArray(input.items) || !input.items.length) throw new Error('Añade al menos un producto al pedido.');
  if (input.items.length > 100) throw new Error('El pedido admite hasta 100 productos.');
  const waiter = text(input.waiter, 'El nombre del mesero');
  const items = input.items.map(item => {
    const product = state.products.find(p => p.id === item.productId);
    if (!product || !product.available) throw new Error('Uno de los productos ya no está disponible. Revisa el pedido.');
    integer(item.quantity, 1, 99, 'La cantidad de productos');
    return { productId: product.id, name: product.name, price: product.price, quantity: item.quantity, note: note(item.note) };
  });
  const next = clone(state);
  const timestamp = now();
  next.orders.unshift({ id: id(), number: next.nextOrderNumber++, tableId: table.id, tableNumber: table.number, waiter, guests: input.guests, status: 'pending', items, note: note(input.note), createdAt: timestamp, updatedAt: timestamp });
  addActivity(next, `Nuevo pedido · Mesa ${String(table.number).padStart(2, '0')}`, `${waiter} envió el pedido #${next.nextOrderNumber - 1} a cocina.`, 'order');
  return next;
}
export function advanceOrder(state: State, orderId: string, nextStatus: Status, reason?: string): State {
  const current = state.orders.find(item => item.id === orderId);
  if (!current) throw new Error('No se encontró el pedido.');
  const validNext: Partial<Record<Status, Status>> = { pending: 'preparing', preparing: 'ready', ready: 'delivered' };
  const rejecting = nextStatus === 'rejected' && ['pending', 'preparing'].includes(current.status);
  if (!rejecting && (!validNext[current.status] || validNext[current.status] !== nextStatus)) throw new Error('El pedido cambió de estado. Revisa su estado actual.');
  const rejectionReason = rejecting ? text(reason || '', 'El motivo de rechazo', 500) : undefined;
  const next = clone(state);
  const order = next.orders.find(item => item.id === orderId)!;
  order.status = nextStatus;
  order.updatedAt = now();
  if (rejectionReason) order.rejectionReason = rejectionReason;
  const label = { preparing: 'Pedido en preparación', ready: 'Pedido listo para entregar', delivered: 'Entrega confirmada', rejected: 'Pedido observado' }[nextStatus as 'preparing' | 'ready' | 'delivered' | 'rejected'];
  addActivity(next, `${label} · Mesa ${String(order.tableNumber).padStart(2, '0')}`, rejectionReason || `Pedido #${order.number}`, nextStatus === 'delivered' ? 'delivery' : 'kitchen');
  return next;
}
export function payOrder(state: State, orderId: string, input: { method: PaymentMethod; received: number; verified?: boolean; reference?: string }): State {
  const current = state.orders.find(item => item.id === orderId);
  if (!current || current.status !== 'delivered') throw new Error('Solo puedes cobrar pedidos con la entrega confirmada.');
  if (!['cash', 'card', 'yape'].includes(input.method)) throw new Error('Selecciona un medio de pago válido.');
  const total = orderTotal(current);
  integer(input.received, 0, 1000000000, 'El monto recibido en céntimos');
  if (input.method === 'cash' && input.received < total) throw new Error('El monto recibido no cubre el total de la cuenta.');
  if (input.method !== 'cash' && !input.verified) throw new Error('Confirma que verificaste el pago en el POS o billetera digital.');
  if (input.method !== 'cash' && input.received !== total) throw new Error('El pago digital debe coincidir con el total de la cuenta.');
  const next = clone(state);
  const order = next.orders.find(item => item.id === orderId)!;
  const timestamp = now();
  order.status = 'paid';
  order.updatedAt = timestamp;
  order.payment = { method: input.method, received: input.received, change: input.method === 'cash' ? input.received - total : 0, paidAt: timestamp, reference: note(input.reference) };
  addActivity(next, `Pago registrado · Mesa ${String(order.tableNumber).padStart(2, '0')}`, `${money(total)} · ${input.method === 'cash' ? 'Efectivo' : input.method === 'card' ? 'Tarjeta' : 'Yape / Plin'}`, 'payment');
  return next;
}
export function upsertProduct(state: State, input: { id?: string; name: string; category: string; price: number; description?: string; available: boolean }): State {
  const name = text(input.name, 'El nombre del producto');
  const category = text(input.category, 'La categoría', 60);
  integer(input.price, 1, 10000000, 'El precio en céntimos');
  if (typeof input.available !== 'boolean') throw new Error('Indica la disponibilidad del producto.');
  if (input.id && !state.products.some(product => product.id === input.id)) throw new Error('El producto ya no existe.');
  if (state.products.some(product => product.id !== input.id && product.name.toLocaleLowerCase('es') === name.toLocaleLowerCase('es'))) throw new Error('Ya existe un producto con ese nombre.');
  const next = clone(state);
  const product: Product = { id: input.id || id(), name, category, price: input.price, description: note(input.description), available: input.available };
  const index = next.products.findIndex(item => item.id === product.id);
  if (index >= 0) next.products[index] = product; else next.products.push(product);
  addActivity(next, input.id ? 'Producto actualizado' : 'Producto añadido', name, 'settings');
  return next;
}
export function removeProduct(state: State, productId: string): State {
  const product = state.products.find(item => item.id === productId);
  if (!product) throw new Error('No se encontró el producto.');
  const next = clone(state);
  next.products = next.products.filter(item => item.id !== productId);
  addActivity(next, 'Producto eliminado de la carta', product.name, 'settings');
  return next;
}
export function upsertTable(state: State, input: { id?: string; number: number; seats: number; zone: string }): State {
  integer(input.number, 1, 999, 'El número de mesa');
  integer(input.seats, 1, 20, 'La capacidad de la mesa');
  const zone = text(input.zone, 'La zona', 60);
  if (input.id && !state.tables.some(table => table.id === input.id)) throw new Error('La mesa ya no existe.');
  if (state.tables.some(table => table.id !== input.id && table.number === input.number)) throw new Error('Ya existe una mesa con ese número.');
  if (input.id && activeOrderForTable(state, input.id)) throw new Error('Solo puedes editar mesas libres.');
  const next = clone(state);
  const table = { id: input.id || id(), number: input.number, seats: input.seats, zone };
  const index = next.tables.findIndex(item => item.id === table.id);
  if (index >= 0) next.tables[index] = table; else next.tables.push(table);
  next.tables.sort((a, b) => a.number - b.number);
  addActivity(next, input.id ? 'Mesa actualizada' : 'Mesa añadida', `Mesa ${input.number} · ${zone}`, 'settings');
  return next;
}
export function removeTable(state: State, tableId: string): State {
  const table = state.tables.find(item => item.id === tableId);
  if (!table) throw new Error('No se encontró la mesa.');
  if (activeOrderForTable(state, tableId)) throw new Error('No puedes eliminar una mesa con un pedido activo.');
  const next = clone(state);
  next.tables = next.tables.filter(item => item.id !== tableId);
  addActivity(next, 'Mesa eliminada', `Mesa ${table.number}`, 'settings');
  return next;
}
export function updateRestaurant(state: State, input: { name: string; subtitle: string }): State {
  const next = clone(state);
  next.restaurant = { name: text(input.name, 'El nombre del restaurante'), subtitle: note(input.subtitle) };
  addActivity(next, 'Datos del restaurante actualizados', next.restaurant.name, 'settings');
  return next;
}
export function emptyState(): State {
  return { version: 1, restaurant: { name: 'Mi restaurante', subtitle: '' }, tables: [], products: [], orders: [], activities: [], nextOrderNumber: 1 };
}
export const loadState = emptyState;
