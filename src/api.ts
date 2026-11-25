import { createAuthClient, type VanillaBetterAuthClient } from '@neon/auth';
import { BetterAuthVanillaAdapter } from '@neon/auth/vanilla/adapters';
import type { Role, State } from './store';

export interface PublicConfig {
  authUrl: string;
  apiUrl?: string;
}

declare global {
  interface Window {
    MOYO_CONFIG?: PublicConfig;
  }
}

export interface User {
  id: string;
  name: string;
  username: string;
  role: Role;
}

export interface TeamMember {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
}

export type MemberInput = Omit<TeamMember, 'id' | 'active'> & {
  id?: string;
  active?: boolean;
};

export interface Command {
  type: string;
  payload?: unknown;
}

export interface ServiceStatus {
  configured: boolean;
  initialized: boolean;
}

export class ApiError extends Error {
  constructor(message: string, public status = 0, public code = '') {
    super(message);
    this.name = 'ApiError';
  }
}

const config = window.MOYO_CONFIG;
const authUrl = config?.authUrl?.trim();
const apiUrl = (config?.apiUrl || '').replace(/\/+$/, '');

type AuthResult<T> = {
  data: T | null;
  error: { code?: string; message?: string; status?: number; statusText?: string } | null;
};

// @neon/auth 0.8.2 exposes these managed plugins at runtime, but its generated
// VanillaBetterAuthClient type loses plugin inference with Better Auth 1.7.27.
// Keep the documented methods typed here without changing the managed client
// or registering bare Better Auth plugins.
type ManagedAuthClient = VanillaBetterAuthClient & {
  emailOtp: {
    verifyEmail(input: { email: string; otp: string }): Promise<AuthResult<unknown>>;
    sendVerificationOtp(input: { email: string; type: 'email-verification' }): Promise<AuthResult<unknown>>;
  };
};

// Auth URL is public. Passwords, session tokens and database credentials are
// never persisted by this application or included in public configuration.
export const authClient = authUrl ? createAuthClient(authUrl, { adapter: BetterAuthVanillaAdapter({ fetchOptions: { credentials: 'include' } }) }) as ManagedAuthClient : null;

export function getAuthClient() {
  if (!authClient) {
    throw new ApiError('El acceso al sistema todavía no está configurado. Contacta al administrador.', 503, 'AUTH_NOT_CONFIGURED');
  }
  return authClient;
}

export function authErrorMessage(error: unknown): string {
  const value = error as { code?: string; message?: string; status?: number } | null;
  const code = value?.code?.toUpperCase() || '';
  const message = value?.message || '';
  if (/INVALID_EMAIL_OR_PASSWORD|INVALID_PASSWORD|INVALID_CREDENTIALS/.test(code)) return 'El correo o la contraseña son incorrectos.';
  if (/EMAIL_NOT_VERIFIED/.test(code)) return 'Verifica tu correo antes de ingresar.';
  if (/USER_ALREADY_EXISTS|USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL/.test(code)) return 'Ya existe una cuenta con este correo. Ingresa con tu contraseña.';
  if (/INVALID_OTP|OTP_EXPIRED|INVALID_VERIFICATION_CODE|VERIFICATION_TOKEN_EXPIRED/.test(code)) return 'El código es incorrecto o venció. Solicita uno nuevo e inténtalo otra vez.';
  if (/TOO_MANY_REQUESTS|RATE_LIMIT/.test(code) || value?.status === 429) return 'Se realizaron demasiados intentos. Espera un momento antes de volver a intentar.';
  if (/PASSWORD_TOO_SHORT/.test(code)) return 'La contraseña debe tener al menos 12 caracteres.';
  if (/PASSWORD_TOO_LONG/.test(code)) return 'La contraseña es demasiado larga. Usa hasta 128 caracteres.';
  if (/INVALID_EMAIL/.test(code)) return 'Ingresa un correo electrónico válido.';
  if (/invalid.*(?:email|password)|(?:email|password).*incorrect/i.test(message)) return 'El correo o la contraseña son incorrectos.';
  if (/failed to fetch|network|load failed/i.test(message)) return 'No se pudo conectar con el servicio. Revisa tu conexión y vuelve a intentar.';
  return message || 'No se pudo completar la operación. Vuelve a intentarlo.';
}

async function getAccessToken(): Promise<string> {
  const client = getAuthClient();
  const session = await client.getSession();
  if (session.error) throw new ApiError(authErrorMessage(session.error), session.error.status || 401, session.error.code || 'SESSION_ERROR');
  if (!session.data?.session || !session.data?.user) throw new ApiError('Tu sesión terminó. Ingresa nuevamente.', 401, 'UNAUTHORIZED');
  if (!session.data.user.emailVerified) throw new ApiError('Verifica tu correo antes de ingresar.', 403, 'EMAIL_NOT_VERIFIED');
  // Managed Neon Auth injects the signed JWT from set-auth-jwt into this field.
  // This SDK may return the cached session shape for token(), rather than {token}.
  const token = session.data.session.token;
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) {
    throw new ApiError('No se pudo recuperar tu sesión. Cierra sesión e ingresa nuevamente.', 401, 'UNAUTHORIZED');
  }
  return token;
}

async function request<T>(path: string, options: { method?: string; body?: unknown; public?: boolean } = {}): Promise<T> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (!options.public) headers.Authorization = `Bearer ${await getAccessToken()}`;
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    timeout = setTimeout(() => controller.abort(), 20000);
    const response = await fetch(`${apiUrl}/api${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: 'no-store',
      signal: controller.signal,
    });
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new ApiError('El servidor de Moyo no está disponible. Revisa la configuración del servicio y vuelve a intentar.', response.status || 503, 'API_UNAVAILABLE');
    }
    const result = await response.json();
    if (!response.ok) {
      const message = typeof result.error === 'string' ? result.error : result.error?.message;
      throw new ApiError(message || result.message || 'No se pudo completar la operación.', response.status, result.code || result.error?.code || '');
    }
    return result as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') throw new ApiError('El servicio tardó demasiado en responder. Vuelve a intentar.', 504, 'TIMEOUT');
    throw new ApiError(authErrorMessage(error), 0, 'NETWORK_ERROR');
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export function getStatus(): Promise<ServiceStatus> {
  return request<ServiceStatus>('/status', { public: true });
}

export async function getUser(): Promise<User> {
  return (await request<{ user: User }>('/session')).user;
}

export async function bootstrap(setupToken: string): Promise<User> {
  const result = await request<{ user?: User }>('/bootstrap', { method: 'POST', body: { setupToken } });
  return result.user || getUser();
}

export async function getState(): Promise<State> {
  return (await request<{ state: State }>('/state')).state;
}

export async function sendCommand(command: Command | string, payload?: unknown): Promise<State> {
  const body = typeof command === 'string' ? { type: command, payload } : command;
  return (await request<{ state: State }>('/command', { method: 'POST', body })).state;
}

export async function getTeam(): Promise<TeamMember[]> {
  return (await request<{ members: TeamMember[] }>('/team')).members;
}

export async function saveMember(member: MemberInput): Promise<TeamMember[]> {
  const result = await request<{ members?: TeamMember[] }>('/team', { method: 'POST', body: member });
  return result.members || getTeam();
}

export async function logout(): Promise<void> {
  const result = await getAuthClient().signOut();
  if (result.error) throw new ApiError(authErrorMessage(result.error), result.error.status || 0, result.error.code || 'SIGNOUT_ERROR');
}
