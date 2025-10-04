'use client';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthService } from '@/services/auth.service';
import { TRIAL_DURATION_DAYS } from '@/lib/utils/subscription';

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = useMemo(() => searchParams.get('invite'), [searchParams]);
  const [form, setForm] = useState({
    dni: '',
    name: '',
    email: '',
    password: '',
    type: 'profesional',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [inviteInfo, setInviteInfo] = useState<{
    token: string;
    ownerName: string | null;
    ownerClinic: string | null;
    role: string;
    email: string;
  } | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);

  useEffect(() => {
    let active = true;

    if (!inviteToken) {
      setInviteInfo(null);
      setInviteError(null);
      return () => {
        active = false;
      };
    }

    setInviteLoading(true);
    setInviteError(null);
    setInviteInfo(null);

    AuthService.getStaffInvitation(inviteToken)
      .then((response) => {
        if (!active) return;
        if (response?.error) {
          setInviteError(response.error);
          return;
        }
        setInviteInfo({
          token: inviteToken,
          ownerName: response.owner?.name ?? null,
          ownerClinic: response.owner?.clinicName ?? null,
          role: response.invitation?.role ?? 'assistant',
          email: response.invitation?.email ?? '',
        });
        setForm((prev) => ({
          ...prev,
          email: response.invitation?.email ?? '',
        }));
      })
      .catch((error) => {
        console.error('Error al cargar invitación de staff', error);
        if (!active) return;
        setInviteError('No pudimos validar el enlace de invitación.');
      })
      .finally(() => {
        if (active) {
          setInviteLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [inviteToken]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      if (inviteInfo) {
        const response = await AuthService.acceptStaffInvitation({
          token: inviteInfo.token,
          dni: form.dni,
          name: form.name,
          password: form.password,
        });
        if (response?.success) {
          setMessage('¡Listo! Activamos tu acceso al equipo. Ahora podés iniciar sesión.');
          setTimeout(() => router.push('/login'), 1800);
        } else if (response?.error) {
          setMessage(response.error);
        } else {
          setMessage('No pudimos completar la invitación. Intentá nuevamente.');
        }
      } else {
        const response = await AuthService.register(form);
        if (response?.success) {
          setMessage('Cuenta creada con éxito. Ingresá con tus credenciales.');
          setTimeout(() => router.push('/login'), 1500);
        } else if (response?.error) {
          setMessage(response.error);
        }
      }
    } catch {
      setMessage('No pudimos registrar tu cuenta. Intentá nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const description = inviteInfo
    ? 'Completá tus datos para sumarte al equipo que te invitó.'
    : `Configurá tu usuario profesional y accedé a ${TRIAL_DURATION_DAYS} días de prueba gratuita con todas las funciones.`;

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_10%_20%,rgba(56,189,248,0.25),transparent_55%),radial-gradient(circle_at_80%_0%,rgba(236,72,153,0.2),transparent_45%)]" />
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/5 p-10 shadow-2xl shadow-cyan-500/10 backdrop-blur">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-semibold text-white">Crear cuenta en APP - Dentalist</h1>
            <p className="mt-2 text-sm text-slate-300">{description}</p>
            {inviteInfo && (
              <p className="mt-2 text-xs text-cyan-200">
                Invitado por {inviteInfo.ownerName ?? 'un profesional'}{' '}
                {inviteInfo.ownerClinic ? `(${inviteInfo.ownerClinic})` : ''} como{' '}
                {inviteInfo.role === 'professional' ? 'profesional' : 'asistente'}.
              </p>
            )}
          </div>

          {message && (
            <p className="mb-6 rounded-2xl border border-cyan-400/40 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
              {message}
            </p>
          )}

          {inviteError && (
            <p className="mb-6 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {inviteError}
            </p>
          )}

          <form onSubmit={handleSubmit} className="grid gap-5">
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
              <label className="text-sm text-slate-300" htmlFor="name">
                Nombre completo
              </label>
              <input
                id="name"
                required
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-300" htmlFor="email">
                Email laboral
              </label>
              <input
                id="email"
                type="email"
                required={!inviteInfo}
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
                readOnly={!!inviteInfo}
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
            {!inviteInfo && (
              <div className="space-y-2">
                <label className="text-sm text-slate-300" htmlFor="type">
                  Rol de acceso
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
            )}
            <button
              type="submit"
              disabled={
                loading || inviteLoading || (!!inviteToken && !inviteInfo && !inviteError) || !!inviteError
              }
              className="rounded-full bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Procesando...' : inviteInfo ? 'Unirme al equipo' : 'Crear cuenta'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-400">
            ¿Ya tenés usuario?{' '}
            <Link href="/login" className="text-cyan-200 hover:underline">
              Iniciar sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
