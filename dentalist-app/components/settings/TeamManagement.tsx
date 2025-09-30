'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { TeamOverview, TeamService } from '@/services/team.service';
import { StaffRole, SubscriptionPlan } from '@/types';

interface TeamManagementProps {
  plan: SubscriptionPlan | null | undefined;
}

const STARTER_ROLE: StaffRole = 'assistant';

function getDefaultRole(plan: SubscriptionPlan | null | undefined): StaffRole {
  if (plan === 'pro') {
    return 'professional';
  }
  return STARTER_ROLE;
}

export function TeamManagement({ plan }: TeamManagementProps) {
  const [overview, setOverview] = useState<TeamOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingClinic, setCreatingClinic] = useState(false);
  const [clinicForm, setClinicForm] = useState({ name: '', address: '' });
  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: getDefaultRole(plan),
    clinicId: '',
  });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<
    { type: 'success' | 'error' | 'warning'; text: string; inviteUrl?: string }
  | null>(null);

  const resolvedPlan: SubscriptionPlan | null | undefined =
    (overview?.stats.plan as SubscriptionPlan | null | undefined) ?? plan ?? null;
  const isPro = resolvedPlan === 'pro';
  const clinicsEnabled = overview?.stats.clinicsEnabled ?? false;
  const clinicLimit = overview?.stats.clinicLimit ?? null;
  const clinicsActive = overview?.stats.clinicsActive ?? 0;
  const clinicsRemaining =
    clinicLimit === null
      ? null
      : Math.max(
          overview?.stats.clinicsRemaining ?? clinicLimit - clinicsActive,
          0,
        );
  const clinicLimitReached = clinicLimit !== null && clinicsRemaining !== null && clinicsRemaining <= 0;

  useEffect(() => {
    setInviteForm((prev) => ({ ...prev, role: getDefaultRole(resolvedPlan) }));
  }, [resolvedPlan]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await TeamService.getOverview();
      setOverview(data);
      setError(null);
    } catch (err) {
      console.error('No pudimos cargar el equipo', err);
      setError(err instanceof Error ? err.message : 'No pudimos cargar el equipo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const assistantsRemaining = useMemo(() => {
    if (!overview) return null;
    if (overview.stats.assistantLimit === null) {
      return null;
    }
    const used = overview.stats.assistantsActive + overview.stats.assistantsPending;
    return Math.max(overview.stats.assistantLimit - used, 0);
  }, [overview]);

  const handleCreateClinic = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!clinicForm.name.trim()) {
      setInviteMessage({ type: 'error', text: 'Ingresá un nombre para el consultorio.' });
      return;
    }
    try {
      setCreatingClinic(true);
      await TeamService.createClinic({
        name: clinicForm.name.trim(),
        address: clinicForm.address.trim() ? clinicForm.address.trim() : null,
      });
      setClinicForm({ name: '', address: '' });
      await refresh();
      setInviteMessage({ type: 'success', text: 'Consultorio creado correctamente.' });
    } catch (err) {
      setInviteMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'No pudimos crear el consultorio.',
      });
    } finally {
      setCreatingClinic(false);
    }
  };

  const handleDeleteClinic = async (clinicId: string) => {
    try {
      await TeamService.deleteClinic(clinicId);
      await refresh();
      setInviteMessage({ type: 'success', text: 'Consultorio eliminado.' });
    } catch (err) {
      setInviteMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'No pudimos eliminar el consultorio.',
      });
    }
  };

  const handleInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!inviteForm.email.trim()) {
      setInviteMessage({ type: 'error', text: 'Ingresá el email de la persona a invitar.' });
      return;
    }

    try {
      setInviteLoading(true);
      const { inviteUrl, emailSent, emailError } = await TeamService.inviteMember({
        email: inviteForm.email.trim(),
        role: inviteForm.role,
        clinicId: inviteForm.clinicId || undefined,
      });
      await refresh();
      setInviteForm({ email: '', role: getDefaultRole(plan), clinicId: '' });
      if (emailSent) {
        setInviteMessage({
          type: 'success',
          text: 'Enviamos la invitación por correo. También podés compartir este enlace directamente.',
          inviteUrl,
        });
      } else {
        setInviteMessage({
          type: 'warning',
          text:
            emailError ??
            'No pudimos enviar el correo automáticamente. Compartí el enlace manualmente o revisá tu configuración SMTP.',
          inviteUrl,
        });
      }
    } catch (err) {
      setInviteMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'No pudimos enviar la invitación.',
      });
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    try {
      await TeamService.revokeInvitation(invitationId);
      await refresh();
      setInviteMessage({ type: 'success', text: 'Invitación cancelada.' });
    } catch (err) {
      setInviteMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'No pudimos cancelar la invitación.',
      });
    }
  };

  const handleRemoveMember = async (staffId: string) => {
    try {
      await TeamService.removeMember(staffId);
      await refresh();
      setInviteMessage({ type: 'success', text: 'Integrante eliminado del equipo.' });
    } catch (err) {
      setInviteMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'No pudimos quitar al integrante.',
      });
    }
  };

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold text-white">Equipo y consultorios</h2>
        <p className="text-sm text-slate-300">
          Administrá quién puede trabajar con vos en Dentalist. Invitá asistentes o profesionales y,
          si tenés el plan Pro, organizalos por consultorios.
        </p>
      </header>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
          {error}
        </div>
      )}

      {inviteMessage && (
        <div
          className={`rounded-xl border p-4 text-sm ${
            inviteMessage.type === 'success'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
              : inviteMessage.type === 'warning'
                ? 'border-amber-400/40 bg-amber-400/10 text-amber-100'
                : 'border-red-500/40 bg-red-500/10 text-red-100'
          }`}
        >
          <p>{inviteMessage.text}</p>
          {inviteMessage.inviteUrl && (
            <p className="mt-2 break-all text-xs text-inherit">
              {inviteMessage.inviteUrl}
            </p>
          )}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-white/5 bg-white/5 p-6 text-sm text-slate-300">
          Cargando información del equipo…
        </div>
      ) : overview ? (
        <div className="space-y-6">
          <div className="flex flex-col gap-4 rounded-2xl border border-white/5 bg-white/5 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-slate-300">
                Asistentes activos: {overview.stats.assistantsActive} · Pendientes: {overview.stats.assistantsPending}
              </p>
              <p className="text-xs text-slate-400">
                {overview.stats.assistantLimit === null
                  ? 'Tu plan no tiene tope de asistentes.'
                  : `Disponibles: ${assistantsRemaining ?? 0} de ${overview.stats.assistantLimit}`}
              </p>
              {isPro ? (
                <p className="text-xs text-slate-400">
                  Consultorios activos: {clinicsActive}
                  {clinicLimit === null ? '' : ` de ${clinicLimit}`}
                  {clinicLimit !== null && clinicsRemaining !== null
                    ? ` · Disponibles: ${clinicsRemaining}`
                    : ''}
                </p>
              ) : null}
            </div>
            {!isPro && overview.stats.assistantLimit !== null && assistantsRemaining === 0 ? (
              <span className="text-xs font-medium text-amber-300">
                Alcanzaste el máximo de asistentes incluidos en tu plan.
              </span>
            ) : !clinicsEnabled && isPro ? (
              <span className="text-xs font-medium text-amber-300">
                Alcanzaste el máximo de consultorios incluidos en tu plan Pro.
              </span>
            ) : null}
          </div>

          {isPro && (
            <form
              onSubmit={handleCreateClinic}
              className="space-y-4 rounded-2xl border border-white/5 bg-white/5 p-6"
            >
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  placeholder="Nombre del consultorio"
                  value={clinicForm.name}
                  onChange={(event) => setClinicForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="flex-1 rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                  required
                />
                <input
                  type="text"
                  placeholder="Dirección (opcional)"
                  value={clinicForm.address}
                  onChange={(event) =>
                    setClinicForm((prev) => ({ ...prev, address: event.target.value }))
                  }
                  className="flex-1 rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={creatingClinic || !clinicsEnabled || clinicLimitReached}
                >
                  {creatingClinic ? 'Guardando…' : 'Añadir consultorio'}
                </button>
              </div>
              {clinicLimit !== null && (
                <p className="text-xs text-slate-400">
                  {clinicLimitReached
                    ? 'Alcanzaste el máximo de consultorios disponibles. Eliminá uno existente para habilitar un nuevo consultorio.'
                    : `Podés crear ${clinicsRemaining ?? 0} de ${clinicLimit} consultorios incluidos en tu plan Pro.`}
                </p>
              )}
            </form>
          )}

          {overview.clinics.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-white">Consultorios</h3>
              <ul className="grid gap-4 sm:grid-cols-2">
                {overview.clinics.map((clinic) => (
                  <li
                    key={clinic.id}
                    className="space-y-2 rounded-2xl border border-white/5 bg-slate-900/60 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-white">{clinic.name}</p>
                        {clinic.address ? (
                          <p className="text-xs text-slate-300">{clinic.address}</p>
                        ) : null}
                        <p className="mt-2 text-xs text-slate-400">
                          {overview.staff.filter((member) => member.clinicId === clinic.id).length} integrantes asignados
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteClinic(clinic.id)}
                        className="rounded-lg border border-white/10 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-red-400 hover:text-red-300"
                      >
                        Eliminar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <form
            onSubmit={handleInvite}
            className="space-y-4 rounded-2xl border border-white/5 bg-white/5 p-6"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">
                  Email de la persona a invitar
                </label>
                <input
                  type="email"
                  required
                  value={inviteForm.email}
                  onChange={(event) => setInviteForm((prev) => ({ ...prev, email: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                  placeholder="ejemplo@dentalist.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">
                  Rol
                </label>
                <select
                  value={inviteForm.role}
                  onChange={(event) =>
                    setInviteForm((prev) => ({ ...prev, role: event.target.value as StaffRole }))
                  }
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                  disabled={!isPro}
                >
                  <option value="assistant">Asistente</option>
                  <option value="professional" disabled={!isPro}>
                    Profesional
                  </option>
                  <option value="admin" disabled={!isPro}>
                    Administrador
                  </option>
                </select>
              </div>
              {isPro && overview.clinics.length > 0 ? (
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">
                    Consultorio (opcional)
                  </label>
                  <select
                    value={inviteForm.clinicId}
                    onChange={(event) =>
                      setInviteForm((prev) => ({ ...prev, clinicId: event.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                  >
                    <option value="">Sin asignar</option>
                    {overview.clinics.map((clinic) => (
                      <option key={clinic.id} value={clinic.id}>
                        {clinic.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={inviteLoading || (!isPro && assistantsRemaining === 0)}
              >
                {inviteLoading ? 'Enviando…' : 'Enviar invitación'}
              </button>
            </div>
          </form>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-white">Integrantes activos</h3>
              {overview.staff.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-slate-300">
                  Aún no agregaste integrantes.
                </p>
              ) : (
                <ul className="space-y-3">
                  {overview.staff.map((member) => (
                    <li
                      key={member.id}
                      className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-slate-900/60 p-4"
                    >
                      <div>
                        <p className="text-sm font-semibold text-white">{member.fullName}</p>
                        <p className="text-xs text-slate-300">{member.email}</p>
                        <p className="text-xs text-slate-400">
                          Rol: {member.role === 'assistant' ? 'Asistente' : member.role === 'professional' ? 'Profesional' : 'Administrador'}
                          {member.clinicName ? ` · ${member.clinicName}` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member.id)}
                        className="rounded-lg border border-white/10 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-red-400 hover:text-red-300"
                      >
                        Quitar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-white">Invitaciones pendientes</h3>
              {overview.invitations.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-slate-300">
                  No tenés invitaciones enviadas recientemente.
                </p>
              ) : (
                <ul className="space-y-3">
                  {overview.invitations.map((invitation) => (
                    <li
                      key={invitation.id}
                      className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-slate-900/60 p-4"
                    >
                      <div>
                        <p className="text-sm font-semibold text-white">{invitation.email}</p>
                        <p className="text-xs text-slate-400">
                          Rol: {invitation.role === 'assistant' ? 'Asistente' : invitation.role === 'professional' ? 'Profesional' : 'Administrador'}
                          {invitation.clinicName ? ` · ${invitation.clinicName}` : ''}
                        </p>
                        <p className="text-xs text-slate-500">
                          Invitada el {new Date(invitation.invitedAt).toLocaleString('es-AR')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRevokeInvitation(invitation.id)}
                        className="rounded-lg border border-white/10 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-red-400 hover:text-red-300"
                      >
                        Cancelar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
