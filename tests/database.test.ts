import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Only against an explicit disposable/development branch; fixtures roll back.
neonConfig.webSocketConstructor=ws;
const connection=process.env.TEST_DATABASE_URL;
test('Postgres blocks competing transactions and duplicate active orders',{skip:!connection},async()=>{
  const pool=new Pool({connectionString:connection,max:2});
  const first=await pool.connect(),second=await pool.connect();
  try {
    await first.query('BEGIN');
    await first.query('SELECT id FROM restaurant WHERE id=1 FOR UPDATE');
    await second.query('BEGIN');
    await second.query("SET LOCAL lock_timeout='500ms'");
    await assert.rejects(second.query('SELECT id FROM restaurant WHERE id=1 FOR UPDATE'),(error:any)=>error.code==='55P03');
    await second.query('ROLLBACK');
    const table=randomUUID(),order=randomUUID();
    await first.query('INSERT INTO restaurant_tables(id,number,seats,zone) VALUES($1,999,2,$2)',[table,'Integration fixture']);
    const next=Number((await first.query('SELECT COALESCE(max(number),0)+1 AS number FROM orders')).rows[0].number);
    await first.query("INSERT INTO orders(id,number,table_id,table_number,waiter,guests,status) VALUES($1,$2,$3,999,'Integration fixture',1,'pending')",[order,next,table]);
    await assert.rejects(first.query("INSERT INTO orders(id,number,table_id,table_number,waiter,guests,status) VALUES($1,$2,$3,999,'Integration fixture',1,'pending')",[randomUUID(),next+1,table]),(error:any)=>error.code==='23505');
  } finally {
    await first.query('ROLLBACK').catch(()=>undefined);await second.query('ROLLBACK').catch(()=>undefined);first.release();second.release();await pool.end();
  }
});
