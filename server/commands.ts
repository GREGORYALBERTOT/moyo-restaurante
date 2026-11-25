import { createOrder, advanceOrder, payOrder, upsertProduct, removeProduct, upsertTable, removeTable, updateRestaurant, type State, type Role, type Status } from '../src/store';
import { ApiError } from './errors';

export interface Member { id: string; name: string; username: string; role: Role }
export interface Command { type: string; payload: Record<string, unknown> }
const allRoles: Role[] = ['admin','mesero','cocina','caja'];
export function authorizeCommand(role: Role, command: Command): void {
  if (!allRoles.includes(role)) throw new ApiError(403, 'No tienes permisos para esta operación.');
  const allowed: Record<string, Role[]> = { createOrder:['admin','mesero'],advanceOrder:['admin','mesero','cocina'],payOrder:['admin','caja'],upsertProduct:['admin'],removeProduct:['admin'],upsertTable:['admin'],removeTable:['admin'],updateRestaurant:['admin'] };
  const permissions=Object.prototype.hasOwnProperty.call(allowed,command.type)?allowed[command.type]:undefined;
  if (!permissions) throw new ApiError(400, 'La operación no es válida.');
  if (!permissions.includes(role)) throw new ApiError(403, 'No tienes permisos para esta operación.');
  if (command.type === 'advanceOrder') {
    const status = command.payload.status;
    if (typeof status !== 'string' || !['preparing','ready','delivered','rejected'].includes(status)) throw new ApiError(400, 'Selecciona un estado de pedido válido.');
    if (role === 'mesero' && status !== 'delivered') throw new ApiError(403, 'El mesero solo puede confirmar la entrega.');
    if (role === 'cocina' && !['preparing','ready','rejected'].includes(status)) throw new ApiError(403, 'Cocina solo puede actualizar la preparación.');
  }
}
export function applyCommand(state: State, member: Member, command: Command): State {
  authorizeCommand(member.role, command);
  const p = command.payload;
  try {
    switch (command.type) {
      case 'createOrder': return createOrder(state, { tableId: p.tableId as string, waiter: member.name, guests: p.guests as number, items: p.items as Parameters<typeof createOrder>[1]['items'], note: p.note as string | undefined });
      case 'advanceOrder': return advanceOrder(state, p.id as string, p.status as Status, p.reason as string | undefined);
      case 'payOrder': return payOrder(state, p.id as string, { method: p.method as Parameters<typeof payOrder>[2]['method'], received: p.received as number, verified: p.verified === true, reference: p.reference as string | undefined });
      case 'upsertProduct': return upsertProduct(state, { id: p.id as string | undefined, name:p.name as string,category:p.category as string,price:p.price as number,description:p.description as string | undefined,available:p.available as boolean });
      case 'removeProduct': return removeProduct(state, p.id as string);
      case 'upsertTable': return upsertTable(state, { id:p.id as string | undefined,number:p.number as number,seats:p.seats as number,zone:p.zone as string });
      case 'removeTable': return removeTable(state, p.id as string);
      case 'updateRestaurant': return updateRestaurant(state, { name:p.name as string,subtitle:p.subtitle as string });
      default: throw new ApiError(400, 'La operación no es válida.');
    }
  } catch (error) { if (error instanceof ApiError) throw error; if (error instanceof TypeError) throw new ApiError(400, 'Revisa los datos enviados.'); throw new ApiError(409, error instanceof Error ? error.message : 'No se pudo completar la operación.'); }
}
export function projectState(state: State, role: Role): State {
  if (role === 'admin' || role === 'caja') return state;
  // Service roles can see live orders and rejections, but no closed payments,
  // revenue history, financial activity, or administrator activity.
  return { ...state, orders: state.orders.filter(o => o.status !== 'paid').map(o => ({ ...o, payment: undefined })), activities: state.activities.filter(a => !['payment','settings','team'].includes(a.type)) };
}
