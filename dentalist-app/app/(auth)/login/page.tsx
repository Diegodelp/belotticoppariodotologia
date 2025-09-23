'use client';
import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthService } from '@/services/auth.service';

type Step = 'credentials' | 'two-factor';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('credentials');
  const [form, setForm] = useState({ dni: '', password: '', type: 'profesional' });
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCredentials = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const response = await AuthService.login(form.dni, form.password, form.type);
      if (response?.requiresTwoFactor) {
        const codeHint = response.code ? ` Código temporal: ${response.code}.` : '';
        setMessage(
          `${response.message ?? 'Ingresá el código de verificación.'}${codeHint}`,
        );
        setStep('two-factor');
      } else if (response?.token) {
        AuthService.storeSession(response.token);
        router.push('/dashboard');
      } else if (response?.error) {
        setMessage(response.error);
      }
    } catch {
      setMessage('No pudimos iniciar sesión. Verificá tus datos.');
    } finally {
      setLoading(false);
    }
  };

  const handleTwoFactor = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const response = await AuthService.verifyTwoFactor(form.dni, code, form.type);
      if (response?.token) {
        AuthService.storeSession(response.token);
        router.push('/dashboard');
      } else if (response?.error) {
        setMessage(response.error);
      }
    } catch {
      setMessage('El código ingresado no es válido.');
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    setMessage(null);
    const response = await AuthService.resendTwoFactor(form.dni, form.type);
    if (response?.message) {
      const codeHint = response.code ? ` Código temporal: ${response.code}.` : '';
      setMessage(`${response.message}${codeHint}`);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_20%,rgba(56,189,248,0.3),transparent_55%),radial-gradient(circle_at_85%_10%,rgba(236,72,153,0.2),transparent_45%)]" />
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center gap-8 px-6 py-16">
        <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-10 shadow-2xl shadow-cyan-500/10 backdrop-blur">
          <div className="mb-8 text-center">
            <span className="rounded-full border border-cyan-400/40 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">
              Dentalist
            </span>
            <h1 className="mt-4 text-3xl font-semibold text-white">Bienvenido a APP - Dentalist</h1>
            <p className="mt-2 text-sm text-slate-300">
              Ingresá tus credenciales y confirmá con el código de verificación.
            </p>
          </div>

          {message && (
            <p className="mb-6 rounded-2xl border border-cyan-400/40 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
              {message}
            </p>
          )}

          {step === 'credentials' ? (
            <form onSubmit={handleCredentials} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm text-slate-300" htmlFor="dni">
                  DNI
                </label>
                <input
                  id="dni"
                  required
                  value={form.dni}
                  onChange={(event) => setForm((prev) => ({ ...prev, dni: event.target.value }))}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-slate-300" htmlFor="password">
                  Contraseña
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={form.password}
                  onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-slate-300" htmlFor="type">
                  Tipo de cuenta
                </label>
                <select
                  id="type"
                  value={form.type}
                  onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
                >
                  <option value="profesional">Profesional</option>
                  <option value="paciente">Paciente</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Validando...' : 'Continuar'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleTwoFactor} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm text-slate-300" htmlFor="code">
                  Código de verificación
                </label>
                <input
                  id="code"
                  inputMode="numeric"
                  required
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white tracking-[0.4em] focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
                />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-300">
                <button type="button" onClick={resendCode} className="text-cyan-200 hover:underline">
                  Reenviar código
                </button>
                <button type="button" onClick={() => setStep('credentials')} className="text-slate-400 hover:underline">
                  Corregir datos
                </button>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Verificando...' : 'Ingresar al panel'}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-xs text-slate-400">
            ¿Aún no tenés cuenta?{' '}
            <Link href="/register" className="text-cyan-200 hover:underline">
              Crear cuenta profesional
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}