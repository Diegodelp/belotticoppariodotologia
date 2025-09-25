'use client';

import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { GoogleCalendarService, GoogleCalendarStatus } from '@/services/google-calendar.service';
import { ProfessionalService } from '@/services/professional.service';
import { OrthodonticPlanService } from '@/services/orthodontic-plan.service';
import { useAuth } from '@/hooks/useAuth';
import { OrthodonticPlan, ProfessionalProfile } from '@/types';

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
    country: '',
    province: '',
    locality: '',
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
  const [plans, setPlans] = useState<OrthodonticPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [planAlert, setPlanAlert] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [planForm, setPlanForm] = useState({
    name: '',
    monthlyFee: '',
    hasInitialFee: false,
    initialFee: '',
  });
  const [planEditingId, setPlanEditingId] = useState<string | null>(null);
  const [planSaving, setPlanSaving] = useState(false);
  const currencyFormatter = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  });

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
          country: response.profile.country ?? '',
          province: response.profile.province ?? '',
          locality: response.profile.locality ?? '',
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
    let active = true;

    const loadPlans = async () => {
      try {
        setPlansLoading(true);
        const response = await OrthodonticPlanService.list();
        if (!active) {
          return;
        }
        setPlans(response.plans ?? []);
        setPlanAlert(null);
      } catch (error) {
        console.error('Error al cargar los planes de ortodoncia', error);
        if (active) {
          setPlanAlert({
            type: 'error',
            text:
              error instanceof Error
                ? error.message
                : 'No pudimos cargar los planes de ortodoncia.',
          });
        }
      } finally {
        if (active) {
          setPlansLoading(false);
        }
      }
    };

    loadPlans();

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

  const resetPlanForm = () => {
    setPlanForm({
      name: '',
      monthlyFee: '',
      hasInitialFee: false,
      initialFee: '',
    });
    setPlanEditingId(null);
  };

  const handlePlanFieldChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = event.target;
    setPlanForm((previous) => ({
      ...previous,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handlePlanEdit = (plan: OrthodonticPlan) => {
    setPlanEditingId(plan.id);
    setPlanForm({
      name: plan.name,
      monthlyFee: plan.monthlyFee.toString(),
      hasInitialFee: plan.hasInitialFee,
      initialFee: plan.initialFee != null ? plan.initialFee.toString() : '',
    });
    setPlanAlert(null);
  };

  const handlePlanSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPlanAlert(null);

    const trimmedName = planForm.name.trim();
    const monthlyFeeValue = Number(planForm.monthlyFee);
    const initialFeeValue = planForm.hasInitialFee ? Number(planForm.initialFee || 0) : null;

    if (!trimmedName) {
      setPlanAlert({ type: 'error', text: 'Ingresá un nombre para el plan de ortodoncia.' });
      return;
    }

    if (Number.isNaN(monthlyFeeValue) || monthlyFeeValue < 0) {
      setPlanAlert({ type: 'error', text: 'La cuota mensual debe ser un número válido.' });
      return;
    }

    if (planForm.hasInitialFee && (initialFeeValue === null || Number.isNaN(initialFeeValue) || initialFeeValue < 0)) {
      setPlanAlert({ type: 'error', text: 'Indicá un valor válido para la entrega inicial.' });
      return;
    }

    try {
      setPlanSaving(true);
      if (planEditingId) {
        const response = await OrthodonticPlanService.update(planEditingId, {
          name: trimmedName,
          monthlyFee: monthlyFeeValue,
          hasInitialFee: planForm.hasInitialFee,
          initialFee: planForm.hasInitialFee ? initialFeeValue ?? 0 : null,
        });
        setPlans((prev) => prev.map((plan) => (plan.id === response.plan.id ? response.plan : plan)));
        setPlanAlert({ type: 'success', text: 'Plan actualizado correctamente.' });
      } else {
        const response = await OrthodonticPlanService.create({
          name: trimmedName,
          monthlyFee: monthlyFeeValue,
          hasInitialFee: planForm.hasInitialFee,
          initialFee: planForm.hasInitialFee ? initialFeeValue ?? 0 : null,
        });
        setPlans((prev) => [...prev, response.plan]);
        setPlanAlert({ type: 'success', text: 'Plan creado correctamente.' });
      }
      resetPlanForm();
    } catch (error) {
      console.error('Error al guardar plan de ortodoncia', error);
      setPlanAlert({
        type: 'error',
        text:
          error instanceof Error ? error.message : 'No pudimos guardar el plan de ortodoncia. Intentá nuevamente.',
      });
    } finally {
      setPlanSaving(false);
    }
  };

  const handlePlanDelete = async (planId: string) => {
    if (!window.confirm('¿Seguro que deseas eliminar este plan de ortodoncia?')) {
      return;
    }

    try {
      setPlanSaving(true);
      const response = await OrthodonticPlanService.remove(planId);
      setPlans(response.plans ?? []);
      setPlanAlert({ type: 'success', text: 'Plan eliminado correctamente.' });
      resetPlanForm();
    } catch (error) {
      console.error('Error al eliminar plan de ortodoncia', error);
      setPlanAlert({
        type: 'error',
        text:
          error instanceof Error ? error.message : 'No pudimos eliminar el plan de ortodoncia. Intentá nuevamente.',
      });
    } finally {
      setPlanSaving(false);
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
        country: form.country,
        province: form.province,
        locality: form.locality,
      });
      setProfile(response.profile);
      setForm({
        fullName: response.profile.fullName ?? '',
        clinicName: response.profile.clinicName ?? '',
        licenseNumber: response.profile.licenseNumber ?? '',
        phone: response.profile.phone ?? '',
        address: response.profile.address ?? '',
        country: response.profile.country ?? '',
        province: response.profile.province ?? '',
        locality: response.profile.locality ?? '',
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

        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm text-slate-300" htmlFor="profile-country">
              País
            </label>
            <input
              id="profile-country"
              value={form.country}
              onChange={(event) => setForm((prev) => ({ ...prev, country: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
              autoComplete="country-name"
              disabled={profileLoading || savingProfile}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-300" htmlFor="profile-province">
              Provincia / Estado
            </label>
            <input
              id="profile-province"
              value={form.province}
              onChange={(event) => setForm((prev) => ({ ...prev, province: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
              autoComplete="address-level1"
              disabled={profileLoading || savingProfile}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-300" htmlFor="profile-locality">
              Localidad
            </label>
            <input
              id="profile-locality"
              value={form.locality}
              onChange={(event) => setForm((prev) => ({ ...prev, locality: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
              autoComplete="address-level2"
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

      <section className="grid gap-6 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-lg shadow-cyan-500/10">
        <div>
          <h2 className="text-lg font-semibold text-white">Planes de ortodoncia</h2>
          <p className="text-xs text-slate-400">
            Crea planes reutilizables para asignarlos a tus pacientes y agilizar la generación de presupuestos.
          </p>
        </div>

        {planAlert && (
          <p
            className={`rounded-2xl border px-4 py-3 text-sm ${
              planAlert.type === 'success'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
                : 'border-rose-500/40 bg-rose-500/10 text-rose-100'
            }`}
          >
            {planAlert.text}
          </p>
        )}

        <form onSubmit={handlePlanSubmit} className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm text-slate-300" htmlFor="plan-name">
              Nombre del plan
            </label>
            <input
              id="plan-name"
              name="name"
              value={planForm.name}
              onChange={handlePlanFieldChange}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
              placeholder="Ej. Plan de ortodoncia mensual"
              disabled={planSaving}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-300" htmlFor="plan-monthly-fee">
              Cuota mensual
            </label>
            <input
              id="plan-monthly-fee"
              name="monthlyFee"
              type="number"
              min="0"
              step="0.01"
              value={planForm.monthlyFee}
              onChange={handlePlanFieldChange}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
              placeholder="0.00"
              disabled={planSaving}
            />
          </div>
          <div className="space-y-2">
            <span className="text-sm text-slate-300">Entrega inicial</span>
            <label className="flex items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                name="hasInitialFee"
                checked={planForm.hasInitialFee}
                onChange={handlePlanFieldChange}
                className="h-5 w-5 rounded border border-white/20 bg-slate-950"
                disabled={planSaving}
              />
              Tiene entrega inicial
            </label>
            <input
              name="initialFee"
              type="number"
              min="0"
              step="0.01"
              value={planForm.initialFee}
              onChange={handlePlanFieldChange}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/40 disabled:opacity-60"
              placeholder="0.00"
              disabled={planSaving || !planForm.hasInitialFee}
            />
          </div>
          <div className="flex items-end justify-end md:col-span-4">
            <div className="flex gap-3">
              {planEditingId && (
                <button
                  type="button"
                  onClick={resetPlanForm}
                  className="rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-slate-200 hover:border-cyan-300/60 hover:text-white"
                  disabled={planSaving}
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                disabled={planSaving}
                className="rounded-full bg-cyan-500 px-5 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {planSaving ? 'Guardando...' : planEditingId ? 'Actualizar plan' : 'Crear plan'}
              </button>
            </div>
          </div>
        </form>

        <div className="space-y-3">
          {plansLoading ? (
            <p className="text-sm text-slate-300">Cargando planes registrados...</p>
          ) : plans.length === 0 ? (
            <p className="text-sm text-slate-400">
              Todavía no cargaste planes de ortodoncia. Creá uno para asignarlo a tus pacientes.
            </p>
          ) : (
            <ul className="space-y-3">
              {plans.map((plan) => (
                <li
                  key={plan.id}
                  className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-200 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="text-base font-semibold text-white">{plan.name}</p>
                    <p className="text-xs text-slate-400">
                      Cuota: {currencyFormatter.format(plan.monthlyFee)} ·{' '}
                      {plan.hasInitialFee
                        ? `Entrega: ${currencyFormatter.format(plan.initialFee ?? 0)}`
                        : 'Sin entrega inicial'}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => handlePlanEdit(plan)}
                      className="rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-cyan-300/60 hover:text-white"
                      disabled={planSaving}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePlanDelete(plan.id)}
                      className="rounded-full border border-rose-500/60 px-4 py-2 text-sm font-medium text-rose-200 transition hover:bg-rose-500/20"
                      disabled={planSaving}
                    >
                      Eliminar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

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
