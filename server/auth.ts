import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { PoolClient } from '@neondatabase/serverless';
import { database } from './db';
import { env } from './env';
import { ApiError } from './errors';
import type { Member } from './commands';

export interface Identity { id: string; email: string; name: string }
let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;
export async function authenticate(request: Request): Promise<Identity> {
  const authorization = request.headers.get('authorization') || '';
  if (!/^Bearer \S+$/i.test(authorization)) throw new ApiError(401, 'Inicia sesión para continuar.');
  const base = env('NEON_AUTH_BASE_URL');
  const endpoint = env('NEON_AUTH_JWKS_URL');
  if (!base || !endpoint) throw new ApiError(503, 'El servicio de acceso no está configurado.');
  jwks ||= createRemoteJWKSet(new URL(endpoint), { timeoutDuration: 10000, cooldownDuration: 30000, cacheMaxAge: 600000 });
  let subject: string;
  try {
    const origin = new URL(base).origin;
    const { payload } = await jwtVerify(authorization.slice(7), jwks, { algorithms: ['EdDSA'], issuer: origin, audience: origin, requiredClaims: ['sub','exp','iat'] });
    if (typeof payload.sub !== 'string' || !payload.sub) throw new Error('Missing subject');
    subject = payload.sub;
  } catch { throw new ApiError(401, 'Tu sesión venció o no es válida. Vuelve a ingresar.'); }
  // The current verified identity comes from Managed Better Auth, never from
  // client-supplied email, role, name or stale claims in the access token.
  const result = await database().query('SELECT id::text AS id,email,name,"emailVerified" AS email_verified,banned,"banExpires" AS ban_expires FROM neon_auth."user" WHERE id::text=$1', [subject]);
  const user = result.rows[0];
  if (!user) throw new ApiError(401, 'La cuenta ya no está disponible.');
  if (user.banned && (!user.ban_expires || new Date(user.ban_expires).getTime() > Date.now())) throw new ApiError(403, 'Esta cuenta está suspendida.');
  if (user.email_verified !== true) throw new ApiError(403, 'Verifica tu correo antes de ingresar al restaurante.');
  if (typeof user.email !== 'string' || !user.email.trim()) throw new ApiError(403, 'La cuenta necesita un correo verificado.');
  return { id: user.id, email: user.email.trim().toLowerCase(), name: typeof user.name === 'string' && user.name.trim() ? user.name.trim().slice(0,100) : user.email.split('@')[0] };
}
export async function memberFor(identity: Identity, client?: PoolClient): Promise<Member> {
  const db = client || database();
  const result = await db.query('UPDATE restaurant_members SET auth_user_id=$1 WHERE email=$2 AND active=true AND (auth_user_id IS NULL OR auth_user_id=$1) RETURNING id,name,email,role', [identity.id,identity.email]);
  const row = result.rows[0];
  if (!row) throw new ApiError(403, 'Tu cuenta no tiene acceso al restaurante. Solicita al administrador que asigne tu correo al equipo.');
  return { id: row.id, name: row.name, username: row.email, role: row.role };
}
