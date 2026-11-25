import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../netlify/functions/api';

test('API rejects untrusted origins before authentication or database access',async()=>{
  const response=await handler(new Request('https://moyo.example/api/state',{headers:{Origin:'https://untrusted.example'}}));
  assert.equal(response.status,403);assert.equal(response.headers.get('access-control-allow-origin'),null);assert.equal(response.headers.get('cache-control'),'no-store');
});
test('Live Server preflight permits only its configured origin and bearer headers',async()=>{
  const previous=process.env.ALLOWED_ORIGINS;
  process.env.ALLOWED_ORIGINS='http://localhost:5500,http://127.0.0.1:5500';
  try {
    const response=await handler(new Request('https://moyo.example/api/command',{method:'OPTIONS',headers:{Origin:'http://localhost:5500','Access-Control-Request-Headers':'Authorization, Content-Type'}}));
    assert.equal(response.status,204);assert.equal(response.headers.get('access-control-allow-origin'),'http://localhost:5500');assert.equal(response.headers.get('access-control-allow-credentials'),null);assert.match(response.headers.get('access-control-allow-headers')||'',/Authorization/);
  } finally { if(previous===undefined)delete process.env.ALLOWED_ORIGINS;else process.env.ALLOWED_ORIGINS=previous; }
});
test('private API routes require bearer identity and disclose no service secrets',async()=>{
  const keys=['DATABASE_URL','NEON_AUTH_BASE_URL','NEON_AUTH_JWKS_URL'] as const;
  const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  process.env.DATABASE_URL='postgresql://test:secret@database.example/test';
  process.env.NEON_AUTH_BASE_URL='https://auth.example/test/auth';process.env.NEON_AUTH_JWKS_URL='https://auth.example/test/auth/.well-known/jwks.json';
  try {
    const response=await handler(new Request('https://moyo.example/api/state'));
    assert.equal(response.status,401);const data=await response.text();assert.doesNotMatch(data,/postgresql|secret|DATABASE_URL/);
  } finally { for(const key of keys){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];} }
});
