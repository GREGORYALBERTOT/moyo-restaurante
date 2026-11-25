import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { authenticate, memberFor, type Identity } from '../../server/auth';
import { applyCommand, projectState, type Command, type Member } from '../../server/commands';
import { database, transaction } from '../../server/db';
import { configured, env } from '../../server/env';
import { ApiError } from '../../server/errors';
import { persistState, readState, snapshot } from '../../server/repository';

export const config = { path: '/api/*' };
const json = (data: unknown, status = 200) => Response.json(data, { status });
async function body(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new ApiError(415, 'Envía la información como JSON.');
  if (Number(request.headers.get('content-length') || 0) > 100000) throw new ApiError(413, 'La solicitud es demasiado grande.');
  const raw = await request.text();
  if (Buffer.byteLength(raw) > 100000) throw new ApiError(413, 'La solicitud es demasiado grande.');
  try { const parsed: unknown = JSON.parse(raw); if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(); return parsed as Record<string, unknown>; }
  catch { throw new ApiError(400, 'La información enviada no es válida.'); }
}
function admin(member: Member) { if (member.role !== 'admin') throw new ApiError(403, 'Esta operación requiere permisos de administrador.'); }
async function initialized(): Promise<boolean> { return (await database().query("SELECT EXISTS(SELECT 1 FROM restaurant_members WHERE role='admin') AS initialized")).rows[0].initialized; }
const safeTokenEqual = (actual: string, expected: string) => timingSafeEqual(createHash('sha256').update(actual).digest(),createHash('sha256').update(expected).digest());
export async function bootstrap(identity: Identity, data: Record<string,unknown>): Promise<Member> {
  const expected = env('OWNER_SETUP_TOKEN');
  const provided = typeof data.setupToken === 'string' ? data.setupToken : '';
  if (expected.length < 32 || !safeTokenEqual(provided, expected)) throw new ApiError(403, 'La clave de configuración inicial no es válida.');
  return transaction(async client => {
    const existing = (await client.query("SELECT id FROM restaurant_members WHERE role='admin' LIMIT 1")).rows[0];
    if (existing) throw new ApiError(409, 'El restaurante ya tiene un administrador.');
    const id = randomUUID();
    await client.query("INSERT INTO restaurant_members(id,email,auth_user_id,name,role) VALUES($1,$2,$3,$4,'admin')", [id,identity.email,identity.id,identity.name]);
    await client.query("INSERT INTO activity(id,title,description,type) VALUES($1,$2,$3,'team')", [randomUUID(),'Restaurante activado',`${identity.name} configuró el acceso de administración.`]);
    return { id,name:identity.name,username:identity.email,role:'admin' };
  });
}
async function team(identity: Identity, data: Record<string, unknown>) {
  return transaction(async client => {
    const actor = await memberFor(identity,client); admin(actor);
    const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
    const name = typeof data.name === 'string' ? data.name.trim() : '';
    const role = data.role;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new ApiError(400, 'Ingresa un correo válido.');
    if (!name || name.length > 100) throw new ApiError(400, 'Ingresa un nombre de hasta 100 caracteres.');
    if (typeof role !== 'string' || !['admin','mesero','cocina','caja'].includes(role)) throw new ApiError(400, 'Selecciona un rol válido.');
    if (data.active !== undefined && typeof data.active !== 'boolean') throw new ApiError(400, 'El estado de la cuenta no es válido.');
    const active = data.active !== false;
    if (data.id !== undefined && (typeof data.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.id))) throw new ApiError(400, 'La cuenta seleccionada no es válida.');
    const existing = data.id ? (await client.query('SELECT id,email,role,active FROM restaurant_members WHERE id=$1', [data.id])).rows[0] : undefined;
    if (data.id && !existing) throw new ApiError(404, 'No se encontró al integrante del equipo.');
    if (existing?.role === 'admin' && existing.active && (role !== 'admin' || !active || email !== existing.email)) {
      const count = Number((await client.query("SELECT count(*) AS total FROM restaurant_members WHERE role='admin' AND active=true")).rows[0].total);
      if (count <= 1) throw new ApiError(409, 'Habilita otro administrador antes de cambiar el acceso del último administrador activo.');
    }
    const id = existing?.id || randomUUID();
    if (existing) await client.query('UPDATE restaurant_members SET email=$2,name=$3,role=$4,active=$5,auth_user_id=CASE WHEN email=$2 THEN auth_user_id ELSE NULL END WHERE id=$1',[id,email,name,role,active]);
    else await client.query('INSERT INTO restaurant_members(id,email,name,role,active) VALUES($1,$2,$3,$4,$5)',[id,email,name,role,active]);
    await client.query("INSERT INTO activity(id,title,description,type) VALUES($1,$2,$3,'team')",[randomUUID(),existing?'Acceso del equipo actualizado':'Integrante añadido al equipo',`${name} · ${role} · ${active?'Activo':'Inactivo'}`]);
    return (await client.query('SELECT id,email,name,role,active FROM restaurant_members ORDER BY created_at')).rows;
  });
}

async function route(request: Request): Promise<Response> {
  const path = new URL(request.url).pathname.replace(/^\/\.netlify\/functions\/api/, '/api').replace(/\/$/,'');
  if (!configured()) return json({ configured:false, initialized:false, error:'Configura la conexión con Neon y el servicio de acceso.' },503);
  if (request.method === 'GET' && path === '/api/status') return json({ configured:true, initialized:await initialized() });
  const identity = await authenticate(request);
  if (request.method === 'POST' && path === '/api/bootstrap') return json({user:await bootstrap(identity,await body(request))},201);
  const member = await memberFor(identity);
  if (request.method === 'GET' && path === '/api/session') return json({user:member});
  if (request.method === 'GET' && path === '/api/state') return json({state:projectState(await snapshot(),member.role)});
  if (request.method === 'GET' && path === '/api/team') { admin(member); return json({members:(await database().query('SELECT id,email,name,role,active FROM restaurant_members ORDER BY created_at')).rows}); }
  if (request.method === 'POST' && path === '/api/team') return json({members:await team(identity,await body(request))});
  if (request.method === 'POST' && path === '/api/command') {
    const data = await body(request);
    if (typeof data.type !== 'string' || !data.payload || typeof data.payload !== 'object' || Array.isArray(data.payload)) throw new ApiError(400, 'La operación enviada no es válida.');
    const command: Command = { type:data.type,payload:data.payload as Record<string,unknown> };
    const result = await transaction(async client => {
      const currentMember = await memberFor(identity,client);
      const before = await readState(client);
      const after = applyCommand(before,currentMember,command);
      await persistState(client,before,after);
      return projectState(after,currentMember.role);
    });
    return json({state:result});
  }
  throw new ApiError(404, 'No se encontró esta operación.');
}
export default async function handler(request: Request): Promise<Response> {
  const origin = request.headers.get('origin');
  const allowed = new Set([new URL(request.url).origin,...env('ALLOWED_ORIGINS').split(','),env('URL'),env('DEPLOY_PRIME_URL')].map(s=>s.trim()).filter(Boolean));
  let response: Response;
  try {
    if (origin && !allowed.has(origin)) throw new ApiError(403, 'El origen de la solicitud no está autorizado.');
    if (request.method === 'OPTIONS') response = new Response(null,{status:204});
    else response = await route(request);
  } catch (error) {
    if (error instanceof ApiError) response = json({ error:error.message },error.status);
    else {
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
      response = code === '23505' ? json({error:'Otro usuario ya registró este dato. Actualiza la vista y vuelve a intentarlo.'},409) : code === '55P03' ? json({error:'El servicio está ocupado. Vuelve a intentarlo en unos segundos.'},409) : json({error:'No se pudo conectar con el servicio. Inténtalo nuevamente.'},503);
    }
  }
  response.headers.set('cache-control','no-store');
  response.headers.set('x-content-type-options','nosniff');
  response.headers.set('vary','Origin');
  if (origin && allowed.has(origin)) {
    response.headers.set('access-control-allow-origin',origin);
    response.headers.set('access-control-allow-methods','GET, POST, OPTIONS');
    response.headers.set('access-control-allow-headers','Authorization, Content-Type');
    response.headers.set('access-control-max-age','600');
  }
  return response;
}
