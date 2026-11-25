import process from 'node:process';

export function env(name: string): string {
  const runtime = globalThis as typeof globalThis & { Netlify?: { env: { get: (key: string) => string | undefined } } };
  return runtime.Netlify?.env.get(name) ?? process.env[name] ?? '';
}
export function configured(): boolean {
  return !!(env('DATABASE_URL') && env('NEON_AUTH_BASE_URL') && env('NEON_AUTH_JWKS_URL'));
}
