import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, createOrder, advanceOrder, payOrder, orderTotal, upsertProduct, removeTable, upsertTable, parseMoney, activeOrderForTable } from '../src/store';
import { applyCommand, authorizeCommand, projectState, type Member } from '../server/commands';
import { ApiError } from '../server/errors';

// All fixtures stay in tests; production has no generated restaurant records.
function fixture() {
  let state = emptyState();
  state = upsertTable(state, { number: 1, seats: 4, zone: 'Zona de prueba' });
  state = upsertTable(state, { number: 2, seats: 2, zone: 'Zona de prueba' });
  state = upsertProduct(state, { name:'Producto de prueba',category:'Pruebas',price:2800,description:'Solo fixture',available:true });
  state = upsertProduct(state, { name:'Bebida de prueba',category:'Pruebas',price:600,available:true });
  state = upsertProduct(state, { name:'Agotado',category:'Pruebas',price:200,available:false });
  return state;
}
const admin: Member = { id:'member-1',name:'Persona autenticada',username:'test@example.invalid',role:'admin' };
const newOrder = () => {
  const original = fixture();
  const state = createOrder(original, { tableId:original.tables[0].id,waiter:'Mesero de prueba',guests:2,items:[{productId:original.products[0].id,quantity:3,note:'Sin ají'},{productId:original.products[1].id,quantity:1}] });
  return { original,state,order:state.orders[0] };
};
test('production initial state contains no example data', () => {
  const state=emptyState();
  assert.equal(state.tables.length,0);assert.equal(state.products.length,0);assert.equal(state.orders.length,0);assert.equal(state.activities.length,0);assert.equal(state.nextOrderNumber,1);
});
test('money parsing uses exact integer cents and rejects invalid input', () => {
  assert.equal(parseMoney('0.10')+parseMoney('0,20'),30);
  assert.equal(parseMoney('18.9'),1890);
  for (const invalid of ['', '-1', '1.001', '1e3', 'NaN', '1,200.00']) assert.throws(()=>parseMoney(invalid));
});
test('orders snapshot prices and preserve the previous state', () => {
  const {original,state,order}=newOrder();
  assert.equal(original.orders.length,0);assert.equal(orderTotal(order),9000);assert.equal(order.items[0].note,'Sin ají');
  const edited=upsertProduct(state,{...state.products[0],price:5000});
  assert.equal(orderTotal(edited.orders[0]),9000);assert.equal(original.products[0].price,2800);
});
test('invalid quantities and occupied tables cannot create orders', () => {
  const {state,order}=newOrder();
  const input={tableId:state.tables[1].id,waiter:'Ana',guests:1,items:[{productId:state.products[0].id,quantity:1}]};
  assert.throws(()=>createOrder(state,{...input,tableId:order.tableId}),/activo/);
  assert.throws(()=>createOrder(state,{...input,items:[{productId:state.products[2].id,quantity:1}]}),/disponible/);
  assert.throws(()=>createOrder(state,{...input,guests:3}),/comensales/);
  assert.throws(()=>createOrder(state,{...input,items:[{productId:state.products[0].id,quantity:0}]}));
  assert.throws(()=>createOrder(state,{...input,items:[]}));
});
test('only delivered orders can be paid, once, in full', () => {
  let {state,order}=newOrder();
  assert.throws(()=>advanceOrder(state,order.id,'ready'));
  assert.throws(()=>payOrder(state,order.id,{method:'cash',received:10000}));
  for (const step of ['preparing','ready','delivered'] as const) state=advanceOrder(state,order.id,step);
  assert.throws(()=>payOrder(state,order.id,{method:'cash',received:8999}),/no cubre/);
  const paid=payOrder(state,order.id,{method:'cash',received:10000});
  assert.equal(paid.orders[0].payment?.change,1000);assert.equal(activeOrderForTable(paid,order.tableId),undefined);
  assert.throws(()=>payOrder(paid,order.id,{method:'cash',received:10000}));
  assert.throws(()=>advanceOrder(paid,order.id,undefined as any));
});
test('digital payments require external verification and exact total', () => {
  let {state,order}=newOrder();
  for (const step of ['preparing','ready','delivered'] as const) state=advanceOrder(state,order.id,step);
  const total=orderTotal(order);
  assert.throws(()=>payOrder(state,order.id,{method:'yape',received:total}),/verificaste/);
  assert.throws(()=>payOrder(state,order.id,{method:'card',received:total+1,verified:true}),/coincidir/);
  const paid=payOrder(state,order.id,{method:'yape',received:total,verified:true});
  assert.equal(paid.orders[0].payment?.change,0);
});
test('rejection releases the table and retains the reason', () => {
  const {state,order}=newOrder();
  assert.throws(()=>advanceOrder(state,order.id,'rejected',' '),/obligatorio/);
  const rejected=advanceOrder(state,order.id,'rejected','Sin insumos');
  assert.equal(activeOrderForTable(rejected,order.tableId),undefined);assert.equal(rejected.orders[0].rejectionReason,'Sin insumos');assert.equal(rejected.orders[0].payment,undefined);
});
test('table configuration preserves active service and prevents duplicates', () => {
  const {state,order}=newOrder();
  assert.throws(()=>removeTable(state,order.tableId),/activo/);
  assert.throws(()=>upsertTable(state,{number:1,seats:4,zone:'Prueba'}),/existe/);
  assert.throws(()=>upsertTable(state,{...state.tables[0],number:20}),/libres/);
  assert.equal(removeTable(state,state.tables[1].id).tables.length,1);assert.equal(state.tables.length,2);
});
test('server permissions reject role escalation and arbitrary operations', () => {
  const cases: Array<[any,string,Record<string,unknown>]>=[['mesero','payOrder',{}],['cocina','createOrder',{}],['caja','upsertProduct',{}],['mesero','advanceOrder',{status:'preparing'}],['cocina','advanceOrder',{status:'delivered'}],['admin','unknown',{}],['admin','__proto__',{}],['admin','advanceOrder',{status:{toString:null}}],['owner','createOrder',{}]];
  for (const [role,type,payload] of cases) assert.throws(()=>authorizeCommand(role,{type,payload}),ApiError);
  assert.doesNotThrow(()=>authorizeCommand('cocina',{type:'advanceOrder',payload:{status:'ready'}}));
  assert.doesNotThrow(()=>authorizeCommand('mesero',{type:'advanceOrder',payload:{status:'delivered'}}));
});
test('server uses authenticated staff identity and canonical product prices', () => {
  const state=fixture();
  const result=applyCommand(state,{...admin,role:'mesero'},{type:'createOrder',payload:{tableId:state.tables[0].id,waiter:'Spoofed administrator',guests:1,items:[{productId:state.products[0].id,quantity:1,price:1,name:'Forged'}]}});
  assert.equal(result.orders[0].waiter,admin.name);assert.equal(result.orders[0].items[0].price,2800);assert.equal(result.orders[0].items[0].name,'Producto de prueba');
  assert.throws(()=>applyCommand(state,admin,{type:'createOrder',payload:{tableId:state.tables[0].id,guests:1,items:[null]}}),/datos enviados/);
});
test('service roles receive no paid transactions or financial activity', () => {
  let {state,order}=newOrder();
  for (const step of ['preparing','ready','delivered'] as const) state=advanceOrder(state,order.id,step);
  state=payOrder(state,order.id,{method:'cash',received:10000});
  const projected=projectState(state,'mesero');
  assert.equal(projected.orders.length,0);assert.equal(projected.activities.some(a=>['payment','settings','team'].includes(a.type)),false);
  assert.equal(projectState(state,'caja').orders[0].payment?.received,10000);
});
