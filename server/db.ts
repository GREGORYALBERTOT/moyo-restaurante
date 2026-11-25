import { Pool, neonConfig, type PoolClient } from '@neondatabase/serverless';
import ws from 'ws';
import { env } from './env';

neonConfig.webSocketConstructor = ws;
neonConfig.useSecureWebSocket = true;
let pool: Pool | undefined;
export function database(): Pool {
  if (!pool) {
    const connection = env('DATABASE_URL');
    if (!connection) throw new Error('DATABASE_URL no está configurada.');
    pool = new Pool({ connectionString: connection, max: 3, idleTimeoutMillis: 10000, connectionTimeoutMillis: 10000, statement_timeout: 15000, query_timeout: 20000 });
    pool.on('error', () => { /* The active request reports a generic database failure. */ });
  }
  return pool;
}
export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await database().connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL lock_timeout = \'10s\'');
    // All write paths lock this row before reading state: concurrent commands
    // cannot reserve the same table, reuse an order number, or charge twice.
    await client.query('SELECT id FROM restaurant WHERE id = 1 FOR UPDATE');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally { client.release(); }
}
