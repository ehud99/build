import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, KeyRound } from 'lucide-react';

import { LoginBot } from '@/components/bot/LoginBot.jsx';
import { AccessCodeInput } from '@/components/identity/AccessCodeInput.jsx';
import { CapsuleButton } from '@/components/identity/CapsuleButton.jsx';
import { AuthHeader } from '@/components/layout/AuthHeader.jsx';
import { LoadingScreen } from '@/components/ui/LoadingScreen.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { isValidAccessCode } from '@/lib/accessCode.js';
import { apiError } from '@/lib/api.js';
import { FILL_MS, eraseMs } from '@/lib/capsule.js';
import { holdCapsule } from '@/lib/capsuleReveal.js';
import { caretPoint } from '@/lib/caretPoint.js';
import { normalizeUsername } from '@/lib/username.js';
import { HOME_PATH } from '@/modules/registry.js';

/**
 * Inicio de sesión en dos pantallas.
 *
 * 1. El usuario. No pregunta nada al servidor: cualquier usuario pasa a la pantalla 2, así no se
 *    sabe desde aquí cuáles existen. Debajo, «Crear cuenta».
 * 2. El código de acceso de 6 casillas. «Verificar código» se vuelve una barra que se llena; si
 *    entra, el texto se borra letra a letra y el panel crece desde el botón
 *    (`lib/capsuleReveal.js`). Si no, el bot cambia de cara y dice el aviso: 401 con los intentos
 *    que quedan, 429 `LOGIN_WAIT` con la cuenta atrás, 403 `LOGIN_BLOCKED`.
 *
 * Con sesión no se pide entrar: va a `state.from` o a `HOME_PATH`.
 */

const MIN_LOADING_MS = 900;
const NEXT_LABEL = 'Iniciar sesión';
const VERIFY_LABEL = 'Verificar código';

const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

function attemptsText(left) {
  if (left == null) return '';
  return left === 1 ? ' Te queda 1 intento.' : ` Te quedan ${left} intentos.`;
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, loading: sessionLoading } = useAuth();

  const [step, setStep] = useState('user');
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [phase, setPhase] = useState('idle');
  const [problem, setProblem] = useState(null); // {kind: 'invalid'|'wait'|'blocked'|'network'|'empty'|'ready', message}
  const [waitUntil, setWaitUntil] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [shake, setShake] = useState(0);
  const [target, setTarget] = useState('pointer');
  const [leaving, setLeaving] = useState(false);
  const userInput = useRef(null);
  const codeInput = useRef(null);
  const verifyButton = useRef(null);

  const fromLocation = location.state?.from;
  const from = fromLocation?.pathname;
  const back = from && from !== '/login' ? `${from}${fromLocation.search ?? ''}${fromLocation.hash ?? ''}` : null;

  // La cuenta atrás de la espera.
  const waiting = waitUntil != null && waitUntil > now;
  const waitSeconds = waiting ? Math.ceil((waitUntil - now) / 1000) : 0;
  useEffect(() => {
    if (waitUntil == null) return undefined;
    const timer = window.setInterval(() => {
      const at = Date.now();
      setNow(at);
      if (at >= waitUntil) {
        window.clearInterval(timer);
        setWaitUntil(null);
        setProblem({ kind: 'ready', message: 'Ya puedes volver a intentarlo.' });
        codeInput.current?.clear();
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [waitUntil]);

  const typedName = normalizeUsername(username);
  // El saludo sigue a lo que se escribe, con una pausa (no letra a letra).
  const [greetName, setGreetName] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(() => setGreetName(typedName), 450);
    return () => window.clearTimeout(timer);
  }, [typedName]);

  const bot = useMemo(() => {
    if (phase === 'filled' || phase === 'erased') return { mood: 'happy', message: `¡Bienvenido, ${typedName}!` };
    if (phase === 'loading') return { mood: 'thinking', message: 'Verificando…' };
    // Con un aviso, el bot reacciona en corto: el aviso completo (y la cuenta atrás) va debajo.
    if (problem?.kind === 'wait') return { mood: 'sleepy', message: 'Tomemos un respiro.' };
    if (problem?.kind === 'ready') return { mood: 'idle', message: problem.message };
    if (problem?.kind === 'blocked') return { mood: 'sad', message: 'Lo siento, así no puedo dejarte pasar.' };
    if (problem?.kind === 'network') return { mood: 'unsure', message: 'No logro conectarme.' };
    if (problem?.kind === 'invalid') return { mood: 'unsure', message: 'Mmm… eso no coincide.' };
    if (problem) return { mood: 'unsure', message: problem.message };
    if (step === 'code') return { mood: 'idle', message: 'Para continuar, ingresa tu código de acceso.' };
    if (greetName) return { mood: 'happy', message: `¡Hola, ${greetName}!` };
    return { mood: 'idle', message: '¡Hola! Bienvenido a Real. ¿Cuál es tu usuario?' };
  }, [phase, problem, step, greetName, typedName]);

  if (sessionLoading) return <LoadingScreen />;
  if (isAuthenticated && !leaving) return <Navigate to={back ?? HOME_PATH} replace />;

  const goToCode = (e) => {
    e.preventDefault();
    if (!typedName) {
      setProblem({ kind: 'empty', message: 'Escribe tu usuario para continuar.' });
      setShake((n) => n + 1);
      userInput.current?.focus();
      return;
    }
    setProblem(null);
    setCode('');
    setStep('code');
  };

  const changeUser = () => {
    if (phase !== 'idle') return;
    setStep('user');
    setCode('');
    if (!waiting) setProblem(null);
    window.requestAnimationFrame(() => userInput.current?.focus());
  };

  const verify = async (e) => {
    e?.preventDefault();
    if (phase !== 'idle' || waiting || problem?.kind === 'blocked') return;
    if (!isValidAccessCode(code)) {
      setProblem({ kind: 'empty', message: 'El código tiene 6 caracteres.' });
      setShake((n) => n + 1);
      codeInput.current?.focus();
      return;
    }
    setProblem(null);
    setPhase('loading');
    setLeaving(true);
    const [outcome] = await Promise.all([
      login(typedName, code).then(
        () => ({ ok: true }),
        (error) => ({ ok: false, error }),
      ),
      sleep(MIN_LOADING_MS),
    ]);

    if (outcome.ok) {
      setPhase('filled');
      await sleep(FILL_MS + 60);
      setPhase('erased');
      await sleep(eraseMs(VERIFY_LABEL));
      holdCapsule(verifyButton.current);
      navigate(back ?? HOME_PATH, { replace: true });
      return;
    }

    setLeaving(false);
    const { status, code: errorCode, message, detail } = apiError(outcome.error);
    if (errorCode === 'LOGIN_WAIT') {
      setWaitUntil(Date.now() + (detail?.retry_after ?? 60) * 1000);
      setNow(Date.now());
      setProblem({ kind: 'wait', message: message || 'Espera 1 minuto antes de volver a intentarlo.' });
    } else if (errorCode === 'LOGIN_BLOCKED') {
      setProblem({ kind: 'blocked', message });
    } else if (status === 401) {
      setProblem({
        kind: 'invalid',
        message: `${message || 'Verifica que tu usuario y tu código sean correctos.'}${attemptsText(detail?.attempts_left)}`,
      });
    } else if (status === 429) {
      setProblem({ kind: 'invalid', message: message || 'Demasiados intentos. Espera unos minutos.' });
    } else if (status === 0) {
      setProblem({ kind: 'network', message: 'No hay conexión con el servidor.' });
    } else {
      setProblem({ kind: 'invalid', message: message || 'No se pudo iniciar sesión.' });
    }
    setPhase('idle');
    setShake((n) => n + 1);
    if (errorCode !== 'LOGIN_WAIT' && errorCode !== 'LOGIN_BLOCKED') codeInput.current?.clear();
  };

  const locked = waiting || problem?.kind === 'blocked';

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-text" data-testid="login">
      <AuthHeader to="/" label="Ir al inicio" testId="login-header-home" />

      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm">
          {step === 'user' ? (
            <form key="user" onSubmit={goToCode} className="login-step-in space-y-6" noValidate>
              <LoginBot message={bot.message} mood={bot.mood} target={target} />
              <div key={shake} className={problem && shake ? 'animate-code-shake' : ''}>
                <label htmlFor="login-username" className="sr-only">
                  Usuario
                </label>
                <input
                  id="login-username"
                  ref={userInput}
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (problem?.kind === 'empty') setProblem(null);
                    setTarget(caretPoint(e.target));
                  }}
                  onFocus={(e) => setTarget(caretPoint(e.target))}
                  onBlur={() => setTarget('pointer')}
                  placeholder="Usuario"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  autoFocus
                  data-testid="login-username"
                  className="h-14 w-full rounded-2xl border border-border bg-surface px-5 text-center text-lg font-semibold tracking-wide text-text outline-none transition-[border-color,box-shadow] placeholder:font-semibold placeholder:uppercase placeholder:tracking-[0.2em] placeholder:text-text-faint focus:border-accent focus:ring-4 focus:ring-accent/22"
                />
              </div>
              {problem?.kind === 'empty' && (
                <p role="alert" data-testid="login-error" className="text-center text-sm text-danger">
                  {problem.message}
                </p>
              )}
              <div className="space-y-3 pt-4">
                <CapsuleButton label={NEXT_LABEL} data-testid="login-next" />
                <Link
                  to="/registro"
                  className="block text-center text-sm font-medium text-accent underline underline-offset-4 hover:opacity-80"
                  data-testid="login-register"
                >
                  Crear cuenta
                </Link>
              </div>
            </form>
          ) : (
            <form key="code" onSubmit={verify} className="login-step-in space-y-6" noValidate>
              <div className="flex flex-col items-center gap-2 text-center">
                <p className="max-w-full break-all text-xl font-bold uppercase tracking-[0.15em]" data-testid="login-who">
                  {typedName}
                </p>
                <KeyRound className="h-6 w-6 text-text-muted" aria-hidden="true" />
              </div>
              <LoginBot message={bot.message} mood={bot.mood} target={target} />
              <div onFocusCapture={(e) => setTarget(e.target)} onBlurCapture={() => setTarget('pointer')}>
                <AccessCodeInput
                  ref={codeInput}
                  name="login-code"
                  size="lg"
                  value={code}
                  onChange={(next) => {
                    setCode(next);
                    if (problem && problem.kind !== 'wait' && problem.kind !== 'blocked') setProblem(null);
                  }}
                  disabled={phase !== 'idle' || locked}
                  autoFocus
                  shake={shake}
                />
              </div>
              {problem && (
                <p
                  role="alert"
                  data-testid="login-error"
                  className={`text-center text-sm ${problem.kind === 'ready' ? 'text-text-muted' : 'text-danger'}`}
                >
                  {problem.kind === 'wait' && waiting ? `${problem.message} (${waitSeconds} s)` : problem.message}
                </p>
              )}
              <div className="space-y-3 pt-4">
                <CapsuleButton
                  ref={verifyButton}
                  label={VERIFY_LABEL}
                  phase={phase}
                  disabled={locked}
                  data-testid="login-submit"
                />
                <div className="flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={changeUser}
                    disabled={phase !== 'idle'}
                    className="inline-flex items-center gap-1 text-text-muted underline-offset-4 hover:text-text hover:underline"
                    data-testid="login-change-user"
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    Cambiar usuario
                  </button>
                  <Link
                    to="/"
                    className="text-sm font-medium text-accent underline underline-offset-4 hover:opacity-80"
                    data-testid="login-home"
                  >
                    Ir al inicio
                  </Link>
                </div>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}

export default LoginPage;
