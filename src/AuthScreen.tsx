import React, { useEffect, useState } from 'react';
import { ApiError, authErrorMessage, bootstrap, getAuthClient, getStatus, getUser, logout, type ServiceStatus, type User } from './api';

type Stage = 'signin' | 'signup' | 'verify' | 'waiting';

function Symbol({ kind = 'leaf' }: { kind?: 'leaf' | 'salon' | 'kitchen' | 'cash' }) {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind === 'leaf' ? <><path d="M20 3C9 2 3 7 4 14c1 6 9 8 13 2 2-3 3-7 3-13Z"/><path d="M4 21 16 8"/></> : kind === 'salon' ? <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></> : kind === 'kitchen' ? <><path d="M7 14a5 5 0 0 1-1-9 6 6 0 0 1 12 0 5 5 0 0 1-1 9v6H7zM7 17h10"/></> : <><rect x="3" y="5" width="18" height="15" rx="3"/><path d="M3 8V5a2 2 0 0 1 2-2h12M16 11h5v5h-5a2.5 2.5 0 0 1 0-5z"/></>}</svg>;
}

export function AuthScreen({ onLogin }: { onLogin: (user: User) => void }) {
  const [stage, setStage] = useState<Stage>('signin');
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [setupToken, setSetupToken] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [resendAt, setResendAt] = useState(0);

  async function checkService() {
    setChecking(true);
    setError('');
    try {
      const value = await getStatus();
      setStatus(value);
      if (!value.configured) setError('El sistema todavía no está configurado. Contacta al administrador para habilitar el servicio.');
      getAuthClient();
    } catch (caught) {
      setStatus(null);
      setError(authErrorMessage(caught));
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => { void checkService(); }, []);
  useEffect(() => {
    if (!resendAt) return;
    const timer = setTimeout(() => setResendAt(0), Math.max(0, resendAt - Date.now()));
    return () => clearTimeout(timer);
  }, [resendAt]);

  async function finishLogin() {
    const client = getAuthClient();
    const session = await client.getSession();
    if (session.error) throw session.error;
    if (!session.data?.user || !session.data.session) throw new ApiError('Ingresa nuevamente con tu correo y contraseña.', 401, 'UNAUTHORIZED');
    if (!session.data.user.emailVerified) {
      setStage('verify');
      setMessage('Verifica tu correo para continuar. Ingresa el código recibido o solicita uno nuevo.');
      return;
    }
    const currentStatus = await getStatus();
    setStatus(currentStatus);
    if (!currentStatus.initialized) {
      if (!setupToken.trim()) throw new ApiError('Ingresa la clave de configuración del propietario para activar la primera cuenta administradora.', 403, 'SETUP_REQUIRED');
      const user = await bootstrap(setupToken.trim());
      setSetupToken('');
      setPassword('');
      onLogin(user);
      return;
    }
    try {
      const user = await getUser();
      setPassword('');
      setSetupToken('');
      onLogin(user);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 403 && caught.code !== 'EMAIL_NOT_VERIFIED' && caught.code !== 'SETUP_REQUIRED') {
        setPassword('');
        setStage('waiting');
        setMessage('Tu correo está verificado. Un administrador debe habilitar tu acceso y asignarte un rol en el equipo del restaurante.');
        setError('');
        return;
      }
      throw caught;
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const client = getAuthClient();
      const normalizedEmail = email.trim().toLowerCase();
      setEmail(normalizedEmail);
      if (stage === 'verify') {
        const result = await client.emailOtp.verifyEmail({ email: normalizedEmail, otp: code.trim() });
        if (result.error) throw result.error;
        const session = await client.getSession();
        if (session.error) throw session.error;
        if (!session.data?.session) {
          if (!password) {
            setStage('signin');
            setCode('');
            setMessage('Correo verificado. Ahora ingresa con tu contraseña.');
            return;
          }
          const signedIn = await client.signIn.email({ email: normalizedEmail, password });
          if (signedIn.error) throw signedIn.error;
        }
        setCode('');
        setStage('signin');
        await finishLogin();
      } else if (stage === 'signup') {
        if (password.length < 12) throw new Error('La contraseña debe tener al menos 12 caracteres.');
        const result = await client.signUp.email({ name: name.trim(), email: normalizedEmail, password });
        if (result.error) throw result.error;
        if (!result.data?.user?.emailVerified) {
          setStage('verify');
          setCode('');
          setMessage('Enviamos un código a tu correo. Revísalo e ingrésalo aquí para verificar tu cuenta.');
        } else {
          const session = await client.getSession();
          if (session.error) throw session.error;
          if (!session.data?.session) {
            const signedIn = await client.signIn.email({ email: normalizedEmail, password });
            if (signedIn.error) throw signedIn.error;
          }
          setStage('signin');
          await finishLogin();
        }
      } else {
        const result = await client.signIn.email({ email: normalizedEmail, password });
        if (result.error) {
          if (result.error.code === 'EMAIL_NOT_VERIFIED') {
            setStage('verify');
            setMessage('Tu correo todavía no está verificado. Ingresa el código recibido o solicita uno nuevo.');
            return;
          }
          throw result.error;
        }
        await finishLogin();
      }
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (busy || Date.now() < resendAt) return;
    setBusy(true);
    setError('');
    try {
      const result = await getAuthClient().emailOtp.sendVerificationOtp({ email: email.trim().toLowerCase(), type: 'email-verification' });
      if (result.error) throw result.error;
      setResendAt(Date.now() + 30000);
      setMessage('Enviamos un nuevo código a tu correo. Si no lo encuentras, revisa la carpeta de spam.');
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function recheckAccess() {
    setBusy(true);
    setError('');
    try { await finishLogin(); } catch (caught) { setError(authErrorMessage(caught)); } finally { setBusy(false); }
  }

  async function backToSignIn() {
    setBusy(true);
    try {
      await logout();
      setStage('signin');
      setPassword('');
      setSetupToken('');
      setError('');
      setMessage('');
    } catch (caught) { setError(authErrorMessage(caught)); } finally { setBusy(false); }
  }

  const disabled = checking || busy || !status?.configured;
  const isSignup = stage === 'signup';
  const needsSetup = status?.initialized === false;

  return <div className="login-layout">
    <section className="login-story">
      <div className="brand"><span className="brand-symbol"><Symbol/></span><div><span className="brand-name">moyo</span><span className="brand-caption">GESTIÓN DE RESTAURANTE</span></div></div>
      <div>
        <div className="login-eyebrow">HECHO PARA EL RITMO DE TU RESTAURANTE</div>
        <h1 className="login-title">Todo conectado.<br/>Cada mesa<br/><em>bien atendida.</em></h1>
        <p className="login-description">Del primer pedido al último cobro. Un solo lugar para coordinar tu salón, cocina y caja.</p>
        <div className="login-visual"><div className="login-flow"><span><Symbol kind="salon"/>Salón</span><i/><span><Symbol kind="kitchen"/>Cocina</span><i/><span><Symbol kind="cash"/>Caja</span></div><div className="login-order-preview"><strong>Tu equipo, en sintonía.</strong><span>Cada pedido llega a quien lo necesita.</span></div></div>
      </div>
      <div className="login-story-footer"><span>Moyobamba, San Martín · Perú</span><span>Hecho para atender mejor.</span></div>
    </section>
    <main className="login-panel">
      <form className="login-form" onSubmit={submit} aria-busy={busy || checking}>
        <span className="eyebrow">{stage === 'verify' ? 'VERIFICA TU CUENTA' : stage === 'waiting' ? 'ACCESO DEL EQUIPO' : isSignup ? 'TU CUENTA EN MOYO' : 'BIENVENIDO A MOYO'}</span>
        <h2>{stage === 'verify' ? 'Revisa tu correo.' : stage === 'waiting' ? 'Tu cuenta está lista.' : isSignup ? 'Todo empieza con tu cuenta.' : <>Un buen servicio<br/>empieza aquí.</>}</h2>
        <p className="page-subtitle">{stage === 'verify' ? <>Ingresa el código enviado a <strong>{email}</strong>.</> : stage === 'waiting' ? <>Solicita acceso al administrador del restaurante para <strong>{email}</strong>.</> : isSignup ? 'Crea tu cuenta y verifica tu correo para acceder al restaurante.' : 'Ingresa con tu cuenta para comenzar el turno.'}</p>

        {checking && <p className="notice" role="status">Conectando con el servicio…</p>}
        {message && <p className="notice" role="status">{message}</p>}
        {error && <p className="form-error" role="alert">{error}</p>}

        {stage === 'signin' || stage === 'signup' ? <>
          {isSignup && <div className="field"><label htmlFor="auth-name">Nombre completo</label><input id="auth-name" name="name" autoComplete="name" required minLength={2} maxLength={100} value={name} onChange={event => setName(event.target.value)} disabled={disabled} placeholder="Tu nombre y apellidos"/></div>}
          <div className="field"><label htmlFor="auth-email">Correo electrónico</label><input id="auth-email" name="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} disabled={disabled} placeholder="tu@correo.com"/></div>
          <div className="field"><label htmlFor="auth-password">Contraseña</label><input id="auth-password" name="password" type="password" autoComplete={isSignup ? 'new-password' : 'current-password'} required minLength={isSignup ? 12 : undefined} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} disabled={disabled} placeholder={isSignup ? 'Al menos 12 caracteres' : 'Ingresa tu contraseña'}/>{isSignup && <span className="field-hint">Usa al menos 12 caracteres y una contraseña que no uses en otro servicio.</span>}</div>
          {needsSetup && <div className="field"><label htmlFor="auth-setup-token">Clave de configuración del propietario</label><input id="auth-setup-token" name="setupToken" type="password" autoComplete="off" required value={setupToken} onChange={event => setSetupToken(event.target.value)} disabled={disabled} placeholder="Clave para activar el restaurante"/><span className="field-hint">Necesaria una sola vez para habilitar la primera cuenta administradora.</span></div>}
          <button className="button primary" type="submit" disabled={disabled}>{busy ? (isSignup ? 'Creando tu cuenta…' : 'Ingresando…') : isSignup ? 'Crear cuenta' : 'Ingresar al sistema'}</button>
          <button className="button ghost" type="button" disabled={disabled} onClick={() => { setStage(isSignup ? 'signin' : 'signup'); setError(''); setMessage(''); setPassword(''); }}>{isSignup ? 'Ya tengo una cuenta' : 'Crear una cuenta'}</button>
          <p className="login-caption">{needsSetup ? 'La primera cuenta debe ser activada por el propietario del restaurante.' : 'El administrador asigna los permisos de salón, cocina y caja a cada integrante del equipo.'}</p>
        </> : stage === 'verify' ? <>
          <div className="field"><label htmlFor="auth-code">Código de verificación</label><input id="auth-code" name="otp" type="text" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} disabled={busy} placeholder="000000" autoFocus/></div>
          {needsSetup && <div className="field"><label htmlFor="auth-verify-setup-token">Clave de configuración del propietario</label><input id="auth-verify-setup-token" type="password" autoComplete="off" required value={setupToken} onChange={event => setSetupToken(event.target.value)} disabled={busy}/></div>}
          <button className="button primary" type="submit" disabled={busy}>{busy ? 'Verificando…' : 'Verificar correo y continuar'}</button>
          <button className="button secondary" type="button" disabled={busy || Boolean(resendAt)} onClick={() => { void resend(); }}>{resendAt ? 'Código enviado · Espera 30 segundos' : 'Reenviar código'}</button>
          <button className="button ghost" type="button" disabled={busy} onClick={() => { setStage('signin'); setCode(''); setError(''); setMessage(''); }}>Volver al inicio de sesión</button>
          <p className="login-caption">Revisa también la carpeta de spam. Por seguridad, espera 30 segundos entre solicitudes de código.</p>
        </> : <>
          <button className="button primary" type="button" disabled={busy} onClick={() => { void recheckAccess(); }}>{busy ? 'Consultando acceso…' : 'Comprobar mi acceso'}</button>
          <button className="button secondary" type="button" disabled={busy} onClick={() => { void backToSignIn(); }}>Usar otra cuenta</button>
        </>}
        {!checking && (!status || !status.configured) && <button className="button secondary" type="button" disabled={busy} onClick={() => { void checkService(); }}>Volver a conectar</button>}
      </form>
    </main>
  </div>;
}

export default AuthScreen;
