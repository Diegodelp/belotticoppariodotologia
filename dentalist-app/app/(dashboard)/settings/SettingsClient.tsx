'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { GoogleCalendarService, GoogleCalendarStatus } from '@/services/google-calendar.service';
import { ProfessionalService } from '@/services/professional.service';
import { useAuth } from '@/hooks/useAuth';
import { ProfessionalProfile } from '@/types';

export function SettingsClient() {
  const { user, refresh: refreshUser } = useAuth();
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    clinicName: '',
    licenseNumber: '',
    phone: '',
    address: '',
  });
  const [notifications, setNotifications] = useState({
    whatsapp: true,
    email: true,
    dailySummary: true,
    autoBilling: false,
  });
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [calendarStatus, setCalendarStatus] = useState<GoogleCalendarStatus | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [calendarAlert, setCalendarAlert] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [calendarActionLoading, setCalendarActionLoading] = useState(false);

  const searchParams = useSearchParams();

  useEffect(() => {
    let active = true;

    const loadStatus = async () => {
      try {
        const status = await GoogleCalendarService.getStatus();
        if (active) {
          setCalendarStatus(status);
          setCalendarError(null);
        }
      } catch (error) {
        console.error('Error al obtener el estado de Google Calendar', error);
        if (active) {
          setCalendarError('No pudimos conectarnos con Google Calendar. Verificá tu sesión e intenta nuevamente.');
        }
      } finally {
        if (active) {
          setCalendarLoading(false);
        }
      }
    };

    loadStatus();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      setProfileLoading(true);
      if (active) {
        setProfileError(null);
      }
      try {
        const response = await ProfessionalService.getProfile();
        if (!active) {
          return;
        }
        setProfile(response.profile);
        setForm({
          fullName: response.profile.fullName ?? '',
          clinicName: response.profile.clinicName ?? '',
          licenseNumber: response.profile.licenseNumber ?? '',
          phone: response.profile.phone ?? '',
          address: response.profile.address ?? '',
        });
        setProfileError(null);
      } catch (error) {
        console.error('Error al cargar el perfil profesional', error);
        if (active) {
          setProfileError('No pudimos cargar los datos del profesional.');
        }
      } finally {
        if (active) {
          setProfileLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const status = searchParams.get('calendar');
    const messageParam = searchParams.get('message');

    if (status === 'connected') {
      setCalendarAlert({ type: 'success', text: 'Google Calendar se vinculó correctamente.' });
    } else if (status === 'error') {
      setCalendarAlert({
        type: 'error',
        text: messageParam ?? 'Ocurrió un error al vincular Google Calendar. Intentá nuevamente.',
      });
    }
  }, [searchParams]);

  const isCalendarConfigured = calendarStatus?.configured ?? false;

  const handleConnectCalendar = async () => {
    try {
      setCalendarActionLoading(true);
      const { url } = await GoogleCalendarService.getAuthorizationUrl('/settings');
      window.location.href = url;
    } catch (error) {
      console.error('Error al iniciar la conexión con Google Calendar', error);
      setCalendarAlert({
        type: 'error',
        text: error instanceof Error ? error.message : 'No pudimos abrir la autorización de Google Calendar.',
      });
    } finally {
      setCalendarActionLoading(false);
    }
  };

  const handleDisconnectCalendar = async () => {
    try {
      setCalendarActionLoading(true);
      await GoogleCalendarService.disconnect();
      setCalendarStatus((prev) =>
        prev
          ? {
              ...prev,
              connected: false,
              email: null,
              calendarId: 'primary',
              expiresAt: null,
            }
          : prev,
      );
      setCalendarAlert({ type: 'success', text: 'Se desconectó Google Calendar correctamente.' });
    } catch (error) {
      console.error('Error al desconectar Google Calendar', error);
      setCalendarAlert({
        type: 'error',
        text: 'No pudimos desconectar Google Calendar. Intentá más tarde.',
      });
    } finally {
      setCalendarActionLoading(false);
    }
  };

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBanner(null);
    try {
      setSavingProfile(true);
      const response = await ProfessionalService.updateProfile({
        fullName: form.fullName,
        clinicName: form.clinicName,
        licenseNumber: form.licenseNumber,
        phone: form.phone,
        address: form.address,
      });
      setProfile(response.profile);
      setForm({
        fullName: response.profile.fullName ?? '',
        clinicName: response.profile.clinicName ?? '',
        licenseNumber: response.profile.licenseNumber ?? '',
        phone: response.profile.phone ?? '',
        address: response.profile.address ?? '',
      });
      setProfileError(null);
      setBanner({ type: 'success', text: 'Datos del profesional actualizados.' });
      await refreshUser();
    } catch (error) {
      console.error('Error al actualizar datos del profesional', error);
      const text =
        error instanceof Error && error.message
          ? error.message
          : 'No pudimos guardar los cambios.';
      setBanner({ type: 'error', text });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleNotificationsSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBanner({ type: 'success', text: 'Preferencias de comunicación guardadas.' });
  };

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-white">Configuración del sistema</h1>
        <p className="text-sm text-slate-300">
          Personalizá la experiencia de Dentalist para tu equipo y pacientes.
        </p>
      </div>

      {banner && (
        <p
          className={`rounded-2xl border px-4 py-3 text-sm ${
            banner.type === 'success'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
              : 'border-rose-500/40 bg-rose-500/10 text-rose-100'
          }`}
        >
          {banner.text}
        </p>
      )}

      <div className="grid gap-6 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-lg shadow-cyan-500/10">
        <div>
          <h2 className="text-lg font-semibold text-white">Google Calendar</h2>
          <p className="text-xs text-slate-400">
            Vinculá tu calendario personal para crear, editar y cancelar turnos directamente desde Dentalist.
          </p>
        </div>

        {calendarAlert && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              calendarAlert.type === 'success'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
                : 'border-rose-500/40 bg-rose-500/10 text-rose-100'
            }`}
          >
            {calendarAlert.text}
          </div>
        )}

        {calendarError && (
          <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {calendarError}
          </div>
        )}

        {calendarLoading ? (
          <p className="text-sm text-slate-300">Consultando el estado de Google Calendar...</p>
        ) : !isCalendarConfigured ? (
          <p className="text-sm text-amber-200">
            Necesitás configurar las credenciales de Google (CLIENT_ID, CLIENT_SECRET y redirect URI) antes de vincular un
            calendario.
          </p>
        ) : calendarStatus?.connected ? (
          <div className="flex flex-col gap-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/5 p-4 text-sm text-emerald-50">
            <div>
              <p className="font-semibold">Calendario conectado</p>
              <p className="text-emerald-100/80">
                Usaremos la agenda de <span className="font-medium">{calendarStatus.email}</span> ({calendarStatus.calendarId})
                para sincronizar tus turnos.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={calendarActionLoading}
                onClick={handleDisconnectCalendar}
                className="rounded-full border border-emerald-400/40 px-6 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {calendarActionLoading ? 'Desconectando...' : 'Desconectar Google Calendar'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 rounded-2xl border border-white/15 bg-slate-900/60 p-4 text-sm text-slate-200">
            <p>
              Aún no vinculaste tu calendario. Conectalo para que cada turno creado desde Dentalist aparezca automáticamente en
              tu Google Calendar personal.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={calendarActionLoading}
                onClick={handleConnectCalendar}
                className="rounded-full bg-cyan-500 px-6 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {calendarActionLoading ? 'Abriendo Google...' : 'Conectar con Google Calendar'}
              </button>
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={handleProfileSubmit}
        className="grid gap-6 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-lg shadow-cyan-500/10"
      >
        <div>
          <h2 className="text-lg font-semibold text-white">Perfil del profesional</h2>
          <p className="text-xs text-slate-400">
            Actualizá la información que aparecerá en recetas, presupuestos y comunicaciones.
          </p>
        </div>

        {profileLoading && (
          <p className="text-sm text-slate-300">Cargando datos del profesional...</p>
        )}

        {profileError && !profileLoading && (
          <p className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {profileError}
          </p>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm text-slate-300" htmlFor="profile-full-name">
              Nombre completo
            </label>
            <input
              id="profile-full-name"
              value={form.fullName}
              onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
              autoComplete="name"
              disabled={profileLoading || savingProfile}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-300" htmlFor="profile-license">
              Matrícula profesional
            </label>
            <input
              id="profile-license"
              value={form.licenseNumber}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, licenseNumber: event.target.value }))
              }
              className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
              autoComplete="off"
              disabled={profileLoading || savingProfile}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-300" htmlFor="profile-clinic-name">
              Nombre de la clínica
            </label>
            <input
              id="profile-clinic-name"
              value={form.clinicName}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, clinicName: event.target.value }))
              }
              className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
              autoComplete="organization"
              disabled={profileLoading || savingProfile}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-300" htmlFor="profile-phone">
              Teléfono de contacto
            </label>
            <input
              id="profile-phone"
              value={form.phone}
              onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
              autoComplete="tel"
              disabled={profileLoading || savingProfile}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm text-slate-300" htmlFor="profile-address">
              Dirección
            </label>
            <input
              id="profile-address"
              value={form.address}
              onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
              autoComplete="street-address"
              disabled={profileLoading || savingProfile}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-200">
            <p className="text-xs uppercase tracking-wide text-slate-400">Documento</p>
            <p className="text-base font-semibold text-white">
              {profile?.dni ?? user?.dni ?? 'No informado'}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-200">
            <p className="text-xs uppercase tracking-wide text-slate-400">Correo electrónico</p>
            <p className="text-base font-semibold text-white">
              {profile?.email ?? user?.email ?? 'No informado'}
            </p>
          </div>
        </div>

        {profile?.updatedAt && (
          <p className="text-xs text-slate-400">
            Última actualización:{' '}
            {new Intl.DateTimeFormat('es-AR', {
              dateStyle: 'short',
              timeStyle: 'short',
            }).format(new Date(profile.updatedAt))}
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={savingProfile || profileLoading}
            className="rounded-full bg-cyan-500 px-6 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {savingProfile ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>

      <form
        onSubmit={handleNotificationsSubmit}
        className="grid gap-6 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-lg shadow-cyan-500/10"
      >
        <div>
          <h2 className="text-lg font-semibold text-white">Automatizaciones y avisos</h2>
          <p className="text-xs text-slate-400">
            Activá los canales que usás para recordar turnos, pagos y enviar resúmenes.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { key: 'whatsapp', label: 'Recordatorios por WhatsApp' },
            { key: 'email', label: 'Emails automáticos a pacientes' },
            { key: 'dailySummary', label: 'Resumen diario al equipo' },
            { key: 'autoBilling', label: 'Envío automático de enlaces de pago' },
          ].map((option) => (
            <label
              key={option.key}
              className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-slate-200"
            >
              <span>{option.label}</span>
              <input
                type="checkbox"
                checked={notifications[option.key as keyof typeof notifications]}
                onChange={(event) =>
                  setNotifications((prev) => ({
                    ...prev,
                    [option.key]: event.target.checked,
                  }))
                }
                className="h-5 w-5 rounded border border-white/20 bg-slate-950"
              />
            </label>
          ))}
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-full bg-cyan-500 px-6 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400"
          >
            Guardar preferencias
          </button>
        </div>
      </form>
    </section>
  );
}
