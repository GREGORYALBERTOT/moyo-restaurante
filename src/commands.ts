import type { State, Status, Product, Table } from "./store";
import type { Command } from "./api";

// Commands describe intent. Validation, roles, prices and database writes run on the server.
export const createOrder = (_state: State, payload: unknown): Command => ({
  type: "createOrder",
  payload,
});
export const advanceOrder = (
  _state: State,
  id: string,
  status: Status,
  reason?: string,
): Command => ({ type: "advanceOrder", payload: { id, status, reason } });
export const payOrder = (
  _state: State,
  id: string,
  payload: unknown,
): Command => ({ type: "payOrder", payload: { ...(payload as object), id } });
export const upsertProduct = (
  _state: State,
  payload: Omit<Product, "id"> & { id?: string },
): Command => ({ type: "upsertProduct", payload });
export const removeProduct = (_state: State, id: string): Command => ({
  type: "removeProduct",
  payload: { id },
});
export const upsertTable = (
  _state: State,
  payload: Omit<Table, "id"> & { id?: string },
): Command => ({ type: "upsertTable", payload });
export const removeTable = (_state: State, id: string): Command => ({
  type: "removeTable",
  payload: { id },
});
export const updateRestaurant = (
  _state: State,
  payload: State["restaurant"],
): Command => ({ type: "updateRestaurant", payload });
