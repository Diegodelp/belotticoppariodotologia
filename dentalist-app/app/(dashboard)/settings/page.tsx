'use client';
import { FormEvent, useState } from 'react';

export default function SettingsPage() {
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