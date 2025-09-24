'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { GoogleCalendarService, GoogleCalendarStatus } from '@/services/google-calendar.service';

export function SettingsClient() {
  const [clinic, setClinic] = useState({
    name: 'Dentalist - Belotti & Coppario',
    phone: '+54 9 11 5555-8899',
    address: 'Av. Santa Fe 1234, CABA',
    timezone: 'America/Argentina/Buenos_Aires',
  });
  const [notifications, setNotifications] = useState({
    whatsapp: true,
    email: true,
    dailySummary: true,
    autoBilling: false,
  });
  const [message, setMessage] = useState<string | null>(null);
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

  const handleClinicSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('Datos de la clínica actualizados.');
  };

  const handleNotificationsSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('Preferencias de comunicación guardadas.');
  };

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-white">Configuración del sistema</h1>
        <p className="text-sm text-slate-300">
          Personalizá la experiencia de Dentalist para tu equipo y pacientes.
        </p>
      </div>

      {message && (
        <p className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {message}
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
        onSubmit={handleClinicSubmit}
        className="grid gap-6 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-lg shadow-cyan-500/10"
      >
        <div>
          <h2 className="text-lg font-semibold text-white">Datos de la clínica</h2>
          <p className="text-xs text-slate-400">
            Esta información se utilizará en recordatorios y comunicaciones.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm text-slate-300" htmlFor="clinic-name">
              Nombre comercial
            </label>
            <input
              id="clinic-name"
              value={clinic.name}
              onChange={(event) => setClinic((prev) => ({ ...prev, name: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-300" htmlFor="clinic-phone">
              Teléfono de contacto
            </label>
            <input
              id="clinic-phone"
              value={clinic.phone}
              onChange={(event) => setClinic((prev) => ({ ...prev, phone: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-300" htmlFor="clinic-address">
              Dirección
            </label>
            <input
              id="clinic-address"
              value={clinic.address}
              onChange={(event) => setClinic((prev) => ({ ...prev, address: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-300" htmlFor="clinic-timezone">
              Zona horaria
            </label>
            <select
              id="clinic-timezone"
              value={clinic.timezone}
              onChange={(event) => setClinic((prev) => ({ ...prev, timezone: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
            >
              <option value="America/Argentina/Buenos_Aires">Buenos Aires (GMT-3)</option>
              <option value="America/Montevideo">Montevideo (GMT-3)</option>
              <option value="America/Sao_Paulo">São Paulo (GMT-3)</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-full bg-cyan-500 px-6 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400"
          >
            Guardar cambios
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
