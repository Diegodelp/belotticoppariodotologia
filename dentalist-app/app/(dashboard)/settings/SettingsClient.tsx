'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { GoogleCalendarService, GoogleCalendarStatus } from '@/services/google-calendar.service';
import { EncryptionService } from '@/services/encryption.service';
import { ProfessionalService } from '@/services/professional.service';
import { OrthodonticPlanService } from '@/services/orthodontic-plan.service';
import { useAuth } from '@/hooks/useAuth';
import { OrthodonticPlan, ProfessionalKeyStatus, ProfessionalProfile } from '@/types';
import { DEFAULT_TIME_ZONE, getSupportedTimeZones, normalizeTimeZone } from '@/lib/utils/timezone';

export function SettingsClient() {
  const { user, refresh: refreshUser } = useAuth();
  const detectedTimeZone = useMemo(() => {
    try {
      const resolved = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : null;
      return normalizeTimeZone(resolved);
    } catch {
      return DEFAULT_TIME_ZONE;
    }
  }, []);
  const timeZones = useMemo(() => {
    const values = getSupportedTimeZones();
    const enriched = values.includes(detectedTimeZone) ? values : [detectedTimeZone, ...values];
    return Array.from(new Set(enriched)).sort((a, b) => a.localeCompare(b));
  }, [detectedTimeZone]);
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
    timeZone: detectedTimeZone,
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
  const [encryptionStatus, setEncryptionStatus] = useState<ProfessionalKeyStatus | null>(null);
  const [encryptionLoading, setEncryptionLoading] = useState(true);
  const [encryptionAlert, setEncryptionAlert] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [encryptionActionLoading, setEncryptionActionLoading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoDeleting, setLogoDeleting] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const currencyFormatter = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  });
  const formatDateTime = (value: string) => {
    try {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return 'Sin registro';
      }
      return date.toLocaleString('es-AR', {
        dateStyle: 'long',
        timeStyle: 'short',
      });
    } catch {
      return 'Sin registro';
    }
  };

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
          timeZone: normalizeTimeZone(response.profile.timeZone ?? detectedTimeZone),
        });
        setLogoUrl(response.profile.logoUrl ?? null);
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
  }, [detectedTimeZone]);

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
    let active = true;

    const loadEncryption = async () => {
      setEncryptionLoading(true);
      try {
        const status = await EncryptionService.getStatus();
        if (!active) {
          return;
        }
        setEncryptionStatus(status);
        setEncryptionAlert(null);
      } catch (error) {
        console.error('Error al obtener el estado de cifrado', error);
        if (active) {
          const text =
            error instanceof Error && error.message
              ? error.message
              : 'No pudimos consultar la clave maestra. Verificá la configuración.';
          setEncryptionAlert({ type: 'error', text });
          setEncryptionStatus(null);
        }
      } finally {
        if (active) {
          setEncryptionLoading(false);
        }
      }
    };

    loadEncryption();

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

  const resetLogoInput = () => {
    if (logoInputRef.current) {
      logoInputRef.current.value = '';
    }
  };

  const normalizeLogoFile = async (file: File): Promise<File> => {
    if (file.type === 'image/png') {
      return file;
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('No pudimos leer el archivo del logo.'));
      reader.readAsDataURL(file);
    });

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('No pudimos procesar la imagen seleccionada.'));
      img.src = dataUrl;
    });

    const maxDimension = 600;
    let { width, height } = image;
    const largest = Math.max(width, height);
    if (largest > maxDimension) {
      const scale = maxDimension / largest;
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('No pudimos preparar el lienzo para el logo.');
    }
    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) {
      throw new Error('No pudimos convertir el logo a PNG.');
    }

    return new File([blob], 'logo.png', { type: 'image/png' });
  };

  const handleLogoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setLogoUploading(true);
    setLogoError(null);
    setBanner(null);

    try {
      const normalized = await normalizeLogoFile(file);
      const response = await ProfessionalService.uploadLogo(normalized);

      if (!response?.success) {
        throw new Error(response?.error ?? 'No pudimos actualizar el logo.');
      }

      const url = response.logoUrl ?? null;
      setLogoUrl(url);
      setProfile((previous) => (previous ? { ...previous, logoUrl: url } : previous));
      setBanner({ type: 'success', text: 'Logo actualizado correctamente.' });
      await refreshUser();
    } catch (error) {
      console.error('Error al subir logo', error);
      setLogoError(
        error instanceof Error ? error.message : 'No pudimos actualizar el logo. Intentá nuevamente.',
      );
    } finally {
      setLogoUploading(false);
      resetLogoInput();
    }
  };

  const handleLogoDelete = async () => {
    if (!window.confirm('¿Seguro que querés eliminar el logo de la clínica?')) {
      return;
    }

    setLogoDeleting(true);
    setLogoError(null);
    setBanner(null);

    try {
      const response = await ProfessionalService.deleteLogo();
      if (!response?.success) {
        throw new Error(response?.error ?? 'No pudimos eliminar el logo.');
      }
      setLogoUrl(null);
      setProfile((previous) => (previous ? { ...previous, logoUrl: null, logoPath: null } : previous));
      setBanner({ type: 'success', text: 'Logo eliminado correctamente.' });
      await refreshUser();
    } catch (error) {
      console.error('Error al eliminar logo', error);
      setLogoError(error instanceof Error ? error.message : 'No pudimos eliminar el logo.');
    } finally {
      setLogoDeleting(false);
      resetLogoInput();
    }
  };

  const handleRotateEncryptionKey = async () => {
    if (encryptionActionLoading) {
      return;
    }

    const promptMessage = encryptionStatus
      ? '¿Querés rotar la clave maestra? Necesitás recifrar los datos existentes con la nueva versión.'
      : 'Vamos a generar tu primera clave maestra para cifrar los datos sensibles. ¿Deseás continuar?';

    if (!window.confirm(promptMessage)) {
      return;
    }

    setEncryptionActionLoading(true);
    setEncryptionAlert(null);

    try {
      const status = await EncryptionService.rotate();
      setEncryptionStatus(status);
      setEncryptionAlert({
        type: 'success',
        text:
          status.version > 1
            ? 'Clave maestra rotada correctamente. Recordá recifrar los datos sensibles pendientes.'
            : 'Clave maestra generada correctamente. Los nuevos datos sensibles se cifrarán con esta versión.',
      });
    } catch (error) {
      console.error('Error al rotar la clave maestra', error);
      const text =
        error instanceof Error && error.message
          ? error.message
          : 'No pudimos rotar la clave maestra. Intentá nuevamente.';
      setEncryptionAlert({ type: 'error', text });
    } finally {
      setEncryptionActionLoading(false);
    }
  };

  const openLogoPicker = () => {
    setLogoError(null);
    logoInputRef.current?.click();
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
        timeZone: form.timeZone,
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
        timeZone: normalizeTimeZone(response.profile.timeZone ?? detectedTimeZone),
      });
      setLogoUrl(response.profile.logoUrl ?? null);
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

      <div className="grid gap-6 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-lg shadow-cyan-500/10">
        <div>
          <h2 className="text-lg font-semibold text-white">Seguridad y cifrado</h2>
          <p className="text-xs text-slate-400">
            Protegé los datos sensibles de tus pacientes con una clave maestra exclusiva de tu cuenta.
          </p>
        </div>

        {encryptionAlert && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              encryptionAlert.type === 'success'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
                : 'border-rose-500/40 bg-rose-500/10 text-rose-100'
            }`}
          >
            {encryptionAlert.text}
          </div>
        )}

        {encryptionLoading ? (
          <p className="text-sm text-slate-300">Validando tu clave maestra...</p>
        ) : encryptionStatus ? (
          <div className="grid gap-2 rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-200">
            <p>
              <span className="font-semibold text-white">Versión actual:</span> {encryptionStatus.version}
            </p>
            <p>
              <span className="font-semibold text-white">Última rotación:</span> {formatDateTime(encryptionStatus.rotatedAt)}
            </p>
            <p className="text-xs text-slate-400">
              Después de rotar la clave necesitás recifrar historias clínicas, presupuestos y tokens almacenados con la nueva
              versión.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4 text-sm text-amber-100">
            Todavía no generaste una clave de cifrado. La crearemos automáticamente al iniciar el proceso.
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleRotateEncryptionKey}
            disabled={encryptionActionLoading}
            className="rounded-full bg-cyan-500 px-6 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {encryptionActionLoading
              ? 'Actualizando clave...'
              : encryptionStatus
              ? 'Rotar clave maestra'
              : 'Generar clave maestra'}
          </button>
          {encryptionStatus && (
            <span className="text-xs text-slate-400">
              Última actualización: {formatDateTime(encryptionStatus.updatedAt)}
            </span>
          )}
        </div>
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

        <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-900/50 p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="Logo del consultorio" className="h-full w-full object-contain" />
              ) : (
                <span className="px-3 text-center text-[11px] uppercase tracking-wide text-slate-500">Sin logo</span>
              )}
            </div>
            <div className="text-xs text-slate-300">
              <p className="font-semibold text-slate-100">Logo del consultorio</p>
              <p className="text-slate-400">
                Mostramos este logo en tus presupuestos y recetas digitales junto al nombre de tu clínica.
              </p>
              {logoError && (
                <p className="mt-2 rounded-xl bg-rose-500/10 px-3 py-2 text-rose-200">{logoError}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={openLogoPicker}
              disabled={logoUploading || profileLoading}
              className="rounded-full bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {logoUploading ? 'Subiendo logo…' : logoUrl ? 'Actualizar logo' : 'Subir logo'}
            </button>
            {logoUrl && (
              <button
                type="button"
                onClick={handleLogoDelete}
                disabled={logoDeleting}
                className="rounded-full border border-rose-500/40 px-4 py-2 text-xs font-semibold text-rose-200 transition hover:border-rose-400 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {logoDeleting ? 'Eliminando…' : 'Eliminar logo'}
              </button>
            )}
          </div>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleLogoChange}
          />
        </div>

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
          <div className="space-y-2 md:col-span-3">
            <label className="text-sm text-slate-300" htmlFor="profile-timezone">
              Zona horaria
            </label>
            <select
              id="profile-timezone"
              value={form.timeZone}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, timeZone: normalizeTimeZone(event.target.value) }))
              }
              className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
              disabled={profileLoading || savingProfile}
            >
              {timeZones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-400">
              Dentalist usa esta zona horaria para agendar turnos y sincronizarlos con Google Calendar.
            </p>
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
