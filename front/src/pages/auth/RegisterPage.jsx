import { useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { LoginBot } from '@/components/bot/LoginBot.jsx';
import { AccessCodeInput } from '@/components/identity/AccessCodeInput.jsx';
import { CapsuleButton } from '@/components/identity/CapsuleButton.jsx';
import { AuthHeader } from '@/components/layout/AuthHeader.jsx';
import { LoadingScreen } from '@/components/ui/LoadingScreen.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { isValidAccessCode } from '@/lib/accessCode.js';
import { api, apiError } from '@/lib/api.js';
import { FILL_MS, eraseMs } from '@/lib/capsule.js';
import { holdCapsule } from '@/lib/capsuleReveal.js';
import { caretPoint } from '@/lib/caretPoint.js';
import { normalizeUsername, usernameProblem } from '@/lib/username.js';
import { HOME_PATH } from '@/modules/registry.js';

/**
 * Registro guiado por el bot del login, una pantalla por paso:
 * 0 clave de invitación (no se valida aquí; se envía al final), 1 nombre, 2 usuario (se consulta
 * `GET /api/auth/username-available`), 3 código de acceso y 4 repetirlo. Al final, «Crear cuenta»
 * (cápsula con fases) llama `register`. 403 `INVALID_INVITE` vuelve al paso 0, 409 `USERNAME_TAKEN`
 * al paso 2 y 403 `REGISTRATION_CLOSED` avisa que el registro está cerrado.
 */

const MIN_LOADING_MS = 900;
const CREATE_LABEL = 'Crear cuenta';
const NEXT_LABEL = 'Continuar';
const LAST_STEP = 4;
const NAME_MAX = 60;

const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

const FIELD_CLASS =
  'h-14 w-full rounded-2xl border border-border bg-surface px-5 text-center text-lg font-semibold tracking-wide text-text outline-none transition-[border-color,box-shadow] placeholder:font-semibold placeholder:uppercase placeholder:tracking-[0.2em] placeholder:text-text-faint focus:border-accent focus:ring-4 focus:ring-accent/22';

/** Lo que dice el bot en cada paso, sin avisos. */
function stepMessage(step, name) {
  const first = name.trim().split(/\s+/)[0];
  switch (step) {
    case 0:
      return 'Para crear tu cuenta necesitas una clave de invitación.';
    case 1:
      return '¡Perfecto! ¿Cómo te llamas?';
    case 2:
      return first ? `Mucho gusto, ${first}. Elige tu usuario.` : 'Elige tu usuario.';
    case 3:
      return 'Ahora crea tu código de acceso: 6 caracteres.';
    default:
      return 'Repite tu código para confirmarlo.';
  }
}

export function RegisterPage() {
  const navigate = useNavigate();
  const { register, isAuthenticated, loading: sessionLoading } = useAuth();

  const [step, setStep] = useState(0);
  const [invite, setInvite] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [confirm, setConfirm] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | loading | filled | erased
  const [checking, setChecking] = useState(false);
  const [problem, setProblem] = useState(null); // {kind: 'empty'|'invalid'|'taken'|'closed'|'network', message}
  const [shake, setShake] = useState(0);
  const [target, setTarget] = useState('pointer');
  const [leaving, setLeaving] = useState(false);
  const fieldRef = useRef(null);
  const codeInput = useRef(null);
  const confirmInput = useRef(null);
  const createButton = useRef(null);

  const typedUser = normalizeUsername(username);
  const busy = phase !== 'idle' || checking;

  const bot = useMemo(() => {
    if (phase === 'filled' || phase === 'erased') return { mood: 'happy', message: `¡Bienvenido, ${name.trim().split(/\s+/)[0]}!` };
    if (phase === 'loading') return { mood: 'thinking', message: 'Creando tu cuenta…' };
    if (checking) return { mood: 'thinking', message: 'Revisando si está libre…' };
    if (problem?.kind === 'closed') return { mood: 'sad', message: 'El registro está cerrado.' };
    if (problem?.kind === 'network') return { mood: 'unsure', message: 'No logro conectarme.' };
    if (problem?.kind === 'taken') return { mood: 'unsure', message: 'Ese usuario ya está en uso. Prueba con otro.' };
    if (problem?.kind === 'invite') return { mood: 'unsure', message: 'Esa clave de invitación no es válida.' };
    if (problem) return { mood: 'unsure', message: problem.message };
    return { mood: step === 2 && typedUser ? 'happy' : 'idle', message: stepMessage(step, name) };
  }, [phase, checking, problem, step, name, typedUser]);

  if (sessionLoading) return <LoadingScreen />;
  if (isAuthenticated && !leaving) return <Navigate to={HOME_PATH} replace />;

  const fail = (kind, message) => {
    setProblem({ kind, message });
    setShake((n) => n + 1);
    window.requestAnimationFrame(() => fieldRef.current?.focus());
  };

  const goBack = () => {
    if (busy || step === 0) return;
    setProblem(null);
    if (step === 3) setCode('');
    if (step === 4) setConfirm('');
    setStep(step - 1);
  };

  const submitAccount = async () => {
    setProblem(null);
    setPhase('loading');
    setLeaving(true);
    const [outcome] = await Promise.all([
      register({ invite_code: invite.trim(), name: name.trim(), username: typedUser, access_code: code }).then(
        () => ({ ok: true }),
        (error) => ({ ok: false, error }),
      ),
      sleep(MIN_LOADING_MS),
    ]);

    if (outcome.ok) {
      setPhase('filled');
      await sleep(FILL_MS + 60);
      setPhase('erased');
      await sleep(eraseMs(CREATE_LABEL));
      holdCapsule(createButton.current);
      navigate(HOME_PATH, { replace: true });
      return;
    }

    setLeaving(false);
    setPhase('idle');
    const { status, code: errorCode, message } = apiError(outcome.error);
    setShake((n) => n + 1);
    if (errorCode === 'INVALID_INVITE') {
      setStep(0);
      setProblem({ kind: 'invite', message: message || 'Esa clave de invitación no es válida.' });
    } else if (errorCode === 'REGISTRATION_CLOSED') {
      setStep(0);
      setProblem({ kind: 'closed', message: 'El registro está cerrado.' });
    } else if (errorCode === 'USERNAME_TAKEN') {
      setStep(2);
      setProblem({ kind: 'taken', message: 'Ese usuario ya está en uso. Prueba con otro.' });
    } else if (status === 0) {
      setProblem({ kind: 'network', message: 'No hay conexión con el servidor.' });
    } else {
      setProblem({ kind: 'invalid', message: message || 'No se pudo crear la cuenta.' });
    }
  };

  const next = async (e) => {
    e?.preventDefault();
    if (busy || problem?.kind === 'closed') return;

    if (step === 0) {
      if (!invite.trim()) return fail('empty', 'Escribe tu clave de invitación para continuar.');
    } else if (step === 1) {
      if (!name.trim()) return fail('empty', 'Escribe tu nombre para continuar.');
      if (name.trim().length > NAME_MAX) return fail('empty', `Usa como máximo ${NAME_MAX} caracteres.`);
    } else if (step === 2) {
      const bad = usernameProblem(username);
      if (bad) return fail('empty', bad);
      setProblem(null);
      setChecking(true);
      try {
        const { data } = await api.get('/auth/username-available', { params: { username: typedUser } });
        if (!data.available) {
          setChecking(false);
          return fail('taken', 'Ese usuario ya está en uso. Prueba con otro.');
        }
      } catch (error) {
        setChecking(false);
        const { status, message } = apiError(error);
        return fail(status === 0 ? 'network' : 'invalid', status === 0 ? 'No hay conexión con el servidor.' : message);
      }
      setChecking(false);
    } else if (step === 3) {
      if (!isValidAccessCode(code)) {
        setProblem({ kind: 'empty', message: 'El código tiene 6 caracteres.' });
        setShake((n) => n + 1);
        codeInput.current?.focus();
        return;
      }
    } else {
      if (!isValidAccessCode(confirm)) {
        setProblem({ kind: 'empty', message: 'Repite los 6 caracteres del código.' });
        setShake((n) => n + 1);
        confirmInput.current?.focus();
        return;
      }
      if (confirm !== code) {
        setProblem({ kind: 'invalid', message: 'Los códigos no coinciden.' });
        setShake((n) => n + 1);
        confirmInput.current?.clear();
        return;
      }
      await submitAccount();
      return;
    }

    setProblem(null);
    setStep(step + 1);
  };

  /** Campo de texto de los pasos 0 a 2. */
  const textField = (id, value, setValue, placeholder, extra = {}) => (
    <div key={shake} className={problem && shake ? 'animate-code-shake' : ''}>
      <label htmlFor={id} className="sr-only">
        {placeholder}
      </label>
      <input
        id={id}
        ref={fieldRef}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (problem && problem.kind !== 'closed') setProblem(null);
          setTarget(caretPoint(e.target));
        }}
        onFocus={(e) => setTarget(caretPoint(e.target))}
        onBlur={() => setTarget('pointer')}
        placeholder={placeholder}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        autoFocus
        disabled={busy}
        data-testid={id}
        className={FIELD_CLASS}
        {...extra}
      />
    </div>
  );

  const nextLabel = step === LAST_STEP ? CREATE_LABEL : NEXT_LABEL;

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-text" data-testid="register">
      <AuthHeader to="/" label="Ir al inicio" testId="register-home" />

      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm">
          <form key={step} onSubmit={next} className="login-step-in space-y-6" noValidate>
            <LoginBot message={bot.message} mood={bot.mood} target={target} />

            {step === 0 && textField('register-invite', invite, setInvite, 'Clave de invitación', { autoComplete: 'off' })}
            {step === 1 &&
              textField('register-name', name, setName, 'Tu nombre', { autoComplete: 'name', maxLength: NAME_MAX, autoCapitalize: 'words' })}
            {step === 2 && textField('register-username', username, setUsername, 'Usuario', { autoComplete: 'username' })}
            {step === 3 && (
              <div onFocusCapture={(e) => setTarget(e.target)} onBlurCapture={() => setTarget('pointer')}>
                <AccessCodeInput
                  ref={codeInput}
                  name="register-code"
                  size="lg"
                  value={code}
                  onChange={(v) => {
                    setCode(v);
                    if (problem) setProblem(null);
                  }}
                  disabled={busy}
                  autoFocus
                  shake={shake}
                />
              </div>
            )}
            {step === 4 && (
              <div onFocusCapture={(e) => setTarget(e.target)} onBlurCapture={() => setTarget('pointer')}>
                <AccessCodeInput
                  ref={confirmInput}
                  name="register-confirm"
                  size="lg"
                  value={confirm}
                  onChange={(v) => {
                    setConfirm(v);
                    if (problem) setProblem(null);
                  }}
                  disabled={busy}
                  autoFocus
                  shake={shake}
                />
              </div>
            )}

            {problem && (
              <p role="alert" data-testid="register-error" className="text-center text-sm text-danger">
                {problem.message}
              </p>
            )}

            <div className="space-y-3 pt-4">
              <CapsuleButton
                ref={createButton}
                label={nextLabel}
                phase={step === LAST_STEP ? phase : 'idle'}
                disabled={checking || problem?.kind === 'closed'}
                data-testid="register-next"
              />
              <div className="flex items-center justify-between gap-3 text-sm">
                {step > 0 ? (
                  <button
                    type="button"
                    onClick={goBack}
                    disabled={busy}
                    className="inline-flex items-center gap-1 text-text-muted underline-offset-4 hover:text-text hover:underline"
                    data-testid="register-back"
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    Atrás
                  </button>
                ) : (
                  <span />
                )}
                <Link
                  to="/login"
                  className="text-right font-medium text-accent underline underline-offset-4 hover:opacity-80"
                  data-testid="register-login"
                >
                  ¿Ya tienes cuenta? Inicia sesión
                </Link>
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

export default RegisterPage;
