'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { TeamOverview, TeamService } from '@/services/team.service';
import { Clinic, StaffInvitation, StaffMember, StaffRole, StaffStatus, SubscriptionPlan, User } from '@/types';

interface TeamManagementProps {
  plan: SubscriptionPlan | null | undefined;
  currentUser?: User | null;
}

const STARTER_ROLE: StaffRole = 'assistant';
const UNASSIGNED_CLINIC_ID = '__unassigned__';

type ClinicCard = {
  id: string;
  clinic: Clinic | null;
  members: StaffMember[];
  invitations: StaffInvitation[];
};

const STATUS_LABELS: Record<StaffStatus, string> = {
  active: 'Activo',
  inactive: 'Inactivo',
  removed: 'Removido',
  invited: 'Invitado',
};

const STATUS_STYLES: Record<StaffStatus, string> = {
  active: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  inactive: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  removed: 'border-red-500/30 bg-red-500/10 text-red-200',
  invited: 'border-slate-500/30 bg-slate-500/10 text-slate-200',
};

function getDefaultRole(plan: SubscriptionPlan | null | undefined): StaffRole {
  if (plan === 'pro') {
    return 'professional';
  }
  return STARTER_ROLE;
}

export function TeamManagement({ plan, currentUser }: TeamManagementProps) {
  const [overview, setOverview] = useState<TeamOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingClinic, setCreatingClinic] = useState(false);
  const [clinicForm, setClinicForm] = useState({ name: '', address: '' });
  const [createClinicModalOpen, setCreateClinicModalOpen] = useState(false);
  const [clinicModalOpen, setClinicModalOpen] = useState(false);
  const [activeClinicId, setActiveClinicId] = useState<string | null>(null);
  const [clinicModalInvite, setClinicModalInvite] = useState<{
    email: string;
    role: StaffRole;
    submitting: boolean;
    message: { type: 'success' | 'error' | 'warning'; text: string; inviteUrl?: string } | null;
  }>({
    email: '',
    role: STARTER_ROLE,
    submitting: false,
    message: null,
  });
  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: getDefaultRole(plan),
    clinicId: '',
  });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<
    { type: 'success' | 'error' | 'warning'; text: string; inviteUrl?: string }
  | null>(null);
  const [manageModal, setManageModal] = useState<{
    member: StaffMember;
    status: StaffStatus;
    clinicId: string;
    reason: string;
    submitting: boolean;
    error: string | null;
  } | null>(null);

  const resolvedPlan: SubscriptionPlan | null | undefined =
    (overview?.stats.plan as SubscriptionPlan | null | undefined) ?? plan ?? null;
  const isPro = resolvedPlan === 'pro';
  const isOwner = !currentUser?.ownerProfessionalId;
  const actingRole = currentUser?.teamRole ?? (isOwner ? 'admin' : null);
  const actingClinicId = currentUser?.teamClinicId ?? null;
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
    setInviteForm((prev) => ({
      ...prev,
      role: isOwner ? getDefaultRole(resolvedPlan) : 'assistant',
      clinicId: !isOwner && actingClinicId ? actingClinicId : prev.clinicId,
    }));
  }, [resolvedPlan, isOwner, actingClinicId]);

  useEffect(() => {
    if (!clinicModalOpen) {
      return;
    }
    setClinicModalInvite({
      email: '',
      role: isOwner ? getDefaultRole(resolvedPlan) : 'assistant',
      submitting: false,
      message: null,
    });
  }, [clinicModalOpen, isOwner, resolvedPlan]);

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

  const assignedClinic = useMemo(() => {
    if (!overview || !actingClinicId) {
      return null;
    }
    return overview.clinics.find((clinic) => clinic.id === actingClinicId) ?? null;
  }, [overview, actingClinicId]);

  const clinicsForSelect = useMemo<Clinic[]>(() => {
    if (!overview) {
      return [];
    }
    if (isOwner) {
      return overview.clinics;
    }
    if (actingRole === 'professional' && actingClinicId) {
      return overview.clinics.filter((clinic) => clinic.id === actingClinicId);
    }
    return [];
  }, [overview, isOwner, actingRole, actingClinicId]);

  const visibleClinics = clinicsForSelect;

  const clinicMembersMap = useMemo(() => {
    const map = new Map<string, StaffMember[]>();
    if (!overview) {
      return map;
    }
    overview.staff.forEach((member) => {
      const key = member.clinicId ?? UNASSIGNED_CLINIC_ID;
      const list = map.get(key);
      if (list) {
        list.push(member);
      } else {
        map.set(key, [member]);
      }
    });
    return map;
  }, [overview]);

  const clinicInvitationsMap = useMemo(() => {
    const map = new Map<string, StaffInvitation[]>();
    if (!overview) {
      return map;
    }
    overview.invitations
      .filter((invitation) => invitation.status === 'pending')
      .forEach((invitation) => {
        const key = invitation.clinicId ?? UNASSIGNED_CLINIC_ID;
        const list = map.get(key);
        if (list) {
          list.push(invitation);
        } else {
          map.set(key, [invitation]);
        }
      });
    return map;
  }, [overview]);

  const clinicCards = useMemo<ClinicCard[]>(() => {
    if (!overview) {
      return [];
    }
    const cards: ClinicCard[] = visibleClinics.map((clinic) => ({
      id: clinic.id,
      clinic,
      members: [...(clinicMembersMap.get(clinic.id) ?? [])],
      invitations: [...(clinicInvitationsMap.get(clinic.id) ?? [])],
    }));

    if (isOwner) {
      const unassignedMembers = clinicMembersMap.get(UNASSIGNED_CLINIC_ID) ?? [];
      const unassignedInvites = clinicInvitationsMap.get(UNASSIGNED_CLINIC_ID) ?? [];
      if (unassignedMembers.length > 0 || unassignedInvites.length > 0) {
        cards.push({
          id: UNASSIGNED_CLINIC_ID,
          clinic: null,
          members: [...unassignedMembers],
          invitations: [...unassignedInvites],
        });
      }
    }

    return cards;
  }, [clinicMembersMap, clinicInvitationsMap, visibleClinics, isOwner, overview]);

  const selectedClinicCard = useMemo(() => {
    if (!clinicModalOpen || !activeClinicId) {
      return null;
    }
    return clinicCards.find((card) => card.id === activeClinicId) ?? null;
  }, [clinicCards, clinicModalOpen, activeClinicId]);

  const selectedClinicMembers = useMemo(
    () => selectedClinicCard?.members ?? [],
    [selectedClinicCard],
  );
  const selectedClinicInvitations = useMemo(
    () => selectedClinicCard?.invitations ?? [],
    [selectedClinicCard],
  );
  const selectedClinic = selectedClinicCard?.clinic ?? null;
  const selectedClinicProfessionals = useMemo(
    () =>
      selectedClinicMembers.filter(
        (member) => member.role === 'professional' || member.role === 'admin',
      ),
    [selectedClinicMembers],
  );
  const selectedClinicAssistants = useMemo(
    () => selectedClinicMembers.filter((member) => member.role === 'assistant'),
    [selectedClinicMembers],
  );
  const { assistantsByProfessionalMap, unassignedAssistants } = useMemo(() => {
    const map = new Map<string, StaffMember[]>();
    const unassigned: StaffMember[] = [];
    selectedClinicAssistants.forEach((assistant) => {
      const key = assistant.memberProfessionalId ?? '';
      if (key) {
        const list = map.get(key) ?? [];
        list.push(assistant);
        map.set(key, list);
      } else {
        unassigned.push(assistant);
      }
    });
    return { assistantsByProfessionalMap: map, unassignedAssistants: unassigned };
  }, [selectedClinicAssistants]);

  const openClinicDetails = (clinicId: string) => {
    setActiveClinicId(clinicId);
    setClinicModalOpen(true);
  };

  const closeClinicModal = useCallback(() => {
    setClinicModalOpen(false);
    setActiveClinicId(null);
  }, []);

  useEffect(() => {
    if (clinicModalOpen && activeClinicId && !selectedClinicCard) {
      closeClinicModal();
    }
  }, [clinicModalOpen, activeClinicId, selectedClinicCard, closeClinicModal]);

  const canSendInvites = isOwner || actingRole === 'professional';
  const targetRoleForInvite = isOwner ? inviteForm.role : 'assistant';
  const noAssistantSlots = assistantsRemaining !== null && assistantsRemaining <= 0;

  const canManageMember = (member: StaffMember): boolean => {
    if (isOwner) return true;
    if (actingRole !== 'professional') return false;
    if (member.role !== 'assistant') return false;
    if (actingClinicId && member.clinicId && member.clinicId !== actingClinicId) return false;
    return true;
  };

  const canManageInvitation = (invitation: StaffInvitation): boolean => {
    if (isOwner) return true;
    if (actingRole !== 'professional') return false;
    if (invitation.role !== 'assistant') return false;
    if (actingClinicId && invitation.clinicId && invitation.clinicId !== actingClinicId) return false;
    return true;
  };

  const visibleStaff = useMemo(() => {
    if (!overview) return [] as StaffMember[];
    if (isOwner) return overview.staff;
    if (actingRole !== 'professional') return [] as StaffMember[];

    return overview.staff.filter((member) => {
      if (member.role !== 'assistant') return false;
      if (actingClinicId && member.clinicId && member.clinicId !== actingClinicId) return false;
      return true;
    });
  }, [overview, isOwner, actingRole, actingClinicId]);

  const visibleInvitations = useMemo(() => {
    if (!overview) return [] as StaffInvitation[];

    const pendingInvites = overview.invitations.filter((invitation) => invitation.status === 'pending');
    if (isOwner) return pendingInvites;
    if (actingRole !== 'professional') return [] as StaffInvitation[];

    return pendingInvites.filter((invitation) => {
      if (invitation.role !== 'assistant') return false;
      if (actingClinicId && invitation.clinicId && invitation.clinicId !== actingClinicId) return false;
      return true;
    });
  }, [overview, isOwner, actingRole, actingClinicId]);

  const handleCreateClinic = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isOwner) {
      setInviteMessage({ type: 'error', text: 'Solo el administrador puede crear consultorios.' });
      return;
    }
    if (!clinicForm.name.trim()) {
      setInviteMessage({ type: 'error', text: 'Ingresá un nombre para el consultorio.' });
      return;
    }
    if (!clinicsEnabled || clinicLimitReached) {
      setInviteMessage({
        type: 'error',
        text: 'No podés crear más consultorios con tu plan actual.',
      });
      return;
    }
    try {
      setCreatingClinic(true);
      await TeamService.createClinic({
        name: clinicForm.name.trim(),
        address: clinicForm.address.trim() ? clinicForm.address.trim() : null,
      });
      setClinicForm({ name: '', address: '' });
      setCreateClinicModalOpen(false);
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
    if (!isOwner) {
      setInviteMessage({ type: 'error', text: 'Solo el administrador puede eliminar consultorios.' });
      return;
    }
    try {
      await TeamService.deleteClinic(clinicId);
      await refresh();
      if (activeClinicId === clinicId) {
        closeClinicModal();
      }
      setInviteMessage({ type: 'success', text: 'Consultorio eliminado.' });
    } catch (err) {
      setInviteMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'No pudimos eliminar el consultorio.',
      });
    }
  };

  const handleClinicInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!clinicModalOpen || !activeClinicId) {
      return;
    }

    if (!canSendInvites) {
      setClinicModalInvite((prev) => ({
        ...prev,
        message: { type: 'error', text: 'No tenés permisos para invitar integrantes.' },
      }));
      return;
    }

    const email = clinicModalInvite.email.trim();
    if (!email) {
      setClinicModalInvite((prev) => ({
        ...prev,
        message: { type: 'error', text: 'Ingresá el email de la persona a invitar.' },
      }));
      return;
    }

    const targetRole = isOwner ? clinicModalInvite.role : 'assistant';

    if (targetRole === 'assistant' && noAssistantSlots) {
      setClinicModalInvite((prev) => ({
        ...prev,
        message: {
          type: 'error',
          text: 'Alcanzaste el cupo de asistentes incluido en tu plan. Eliminá uno existente o actualizá a Dentalist Pro.',
        },
      }));
      return;
    }

    const targetClinicId = activeClinicId === UNASSIGNED_CLINIC_ID ? undefined : activeClinicId;

    try {
      setClinicModalInvite((prev) => ({ ...prev, submitting: true, message: null }));
      const { inviteUrl, emailSent, emailError } = await TeamService.inviteMember({
        email,
        role: targetRole,
        clinicId: targetClinicId,
      });
      await refresh();
      setClinicModalInvite((prev) => ({
        email: '',
        role: prev.role,
        submitting: false,
        message: emailSent
          ? {
              type: 'success',
              text: 'Enviamos la invitación por correo. También podés compartir este enlace directamente.',
              inviteUrl,
            }
          : {
              type: 'warning',
              text:
                emailError ??
                'No pudimos enviar el correo automáticamente. Compartí el enlace manualmente o revisá tu configuración SMTP.',
              inviteUrl,
            },
      }));
    } catch (err) {
      setClinicModalInvite((prev) => ({
        ...prev,
        submitting: false,
        message: {
          type: 'error',
          text: err instanceof Error ? err.message : 'No pudimos enviar la invitación.',
        },
      }));
    }
  };

  const handleInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isOwner && actingRole !== 'professional') {
      setInviteMessage({ type: 'error', text: 'No tenés permisos para invitar integrantes.' });
      return;
    }
    if (!inviteForm.email.trim()) {
      setInviteMessage({ type: 'error', text: 'Ingresá el email de la persona a invitar.' });
      return;
    }

    try {
      setInviteLoading(true);
      const targetRole = isOwner ? inviteForm.role : 'assistant';
      const targetClinicId = isOwner ? inviteForm.clinicId : actingClinicId ?? '';
      const { inviteUrl, emailSent, emailError } = await TeamService.inviteMember({
        email: inviteForm.email.trim(),
        role: targetRole as StaffRole,
        clinicId: targetClinicId || undefined,
      });
      await refresh();
      setInviteForm({
        email: '',
        role: isOwner ? getDefaultRole(plan) : 'assistant',
        clinicId: isOwner ? '' : actingClinicId ?? '',
      });
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

  const openManageModal = (member: StaffMember) => {
    const initialStatus: StaffStatus = member.status === 'invited' ? 'active' : member.status;
    setManageModal({
      member,
      status: initialStatus,
      clinicId: member.clinicId ?? '',
      reason: member.statusReason ?? '',
      submitting: false,
      error: null,
    });
  };

  const closeManageModal = () => {
    setManageModal(null);
  };

  const handleManageSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!manageModal) return;

    const { member } = manageModal;
    const normalizedOriginalStatus: StaffStatus =
      member.status === 'invited' ? 'active' : member.status;
    const selectedStatus = manageModal.status;
    const requiresReason = selectedStatus === 'inactive' || selectedStatus === 'removed';
    const trimmedReason = manageModal.reason.trim();
    const originalReason = (member.statusReason ?? '').trim();
    const clinicOriginal = member.clinicId ?? '';
    const clinicChanged = manageModal.clinicId !== clinicOriginal;
    const statusChanged = selectedStatus !== normalizedOriginalStatus;
    const reasonChanged = requiresReason && trimmedReason !== originalReason;
    const clearingReason =
      selectedStatus === 'active' && (member.statusReason ?? null) !== null;

    if (requiresReason && !trimmedReason) {
      setManageModal((prev) =>
        prev
          ? {
              ...prev,
              error: 'Ingresá el motivo de la inactivación o remoción.',
            }
          : prev,
      );
      return;
    }

    const payload: { status?: StaffStatus; reason?: string | null; clinicId?: string | null } = {};

    if (statusChanged) {
      payload.status = selectedStatus;
      payload.reason = selectedStatus === 'active' ? null : trimmedReason;
    } else if (requiresReason && reasonChanged) {
      payload.reason = trimmedReason;
    } else if (clearingReason) {
      payload.reason = null;
    }

    if (clinicChanged) {
      payload.clinicId = manageModal.clinicId ? manageModal.clinicId : null;
    }

    if (
      typeof payload.status === 'undefined' &&
      typeof payload.reason === 'undefined' &&
      typeof payload.clinicId === 'undefined'
    ) {
      setManageModal((prev) =>
        prev ? { ...prev, error: 'No hay cambios para guardar.' } : prev,
      );
      return;
    }

    const confirmActions: string[] = [];
    if (statusChanged) {
      confirmActions.push(
        selectedStatus === 'active'
          ? 'reactivar a la persona seleccionada'
          : selectedStatus === 'inactive'
            ? 'inactivar a la persona seleccionada'
            : 'remover a la persona seleccionada',
      );
    } else if (requiresReason && reasonChanged) {
      confirmActions.push('actualizar el motivo registrado');
    } else if (clearingReason && typeof payload.reason !== 'undefined') {
      confirmActions.push('limpiar el motivo registrado');
    }
    if (clinicChanged) {
      confirmActions.push('modificar el consultorio asignado');
    }
    if (confirmActions.length === 0) {
      confirmActions.push('guardar los cambios');
    }

    const confirmMessage = `¿Confirmás ${confirmActions.join(' y ')} de ${
      member.fullName
    }?\nEsta acción será visible para la persona afectada.`;

    if (typeof window !== 'undefined' && !window.confirm(confirmMessage)) {
      return;
    }

    setManageModal((prev) =>
      prev
        ? {
            ...prev,
            submitting: true,
            error: null,
          }
        : prev,
    );

    try {
      await TeamService.updateMember(member.id, payload);
      await refresh();

      let successText = 'Cambios guardados correctamente.';
      if (statusChanged) {
        successText =
          selectedStatus === 'active'
            ? 'Integrante reactivado correctamente.'
            : selectedStatus === 'inactive'
              ? 'Integrante inactivado. El motivo quedará registrado.'
              : 'Integrante removido del consultorio. El motivo quedará registrado.';
      } else if (clinicChanged) {
        successText = 'Consultorio actualizado para la persona seleccionada.';
      } else if (requiresReason && (reasonChanged || clearingReason)) {
        successText = 'Motivo actualizado correctamente.';
      }

      setInviteMessage({ type: 'success', text: successText });
      setManageModal(null);
    } catch (err) {
      setManageModal((prev) =>
        prev
          ? {
              ...prev,
              submitting: false,
              error:
                err instanceof Error
                  ? err.message
                  : 'No pudimos actualizar al integrante.',
            }
          : prev,
      );
    }
  };

  return (
    <>
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
            <div className="space-y-4 rounded-2xl border border-white/5 bg-white/5 p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-white">Consultorios</h3>
                  {isOwner ? (
                    clinicLimit !== null ? (
                      <p className="text-xs text-slate-400">
                        {clinicLimitReached
                          ? 'Alcanzaste el máximo de consultorios disponibles. Eliminá uno existente para habilitar un nuevo consultorio.'
                          : `Podés crear ${clinicsRemaining ?? 0} de ${clinicLimit} consultorios incluidos en tu plan Pro.`}
                      </p>
                    ) : null
                  ) : (
                    <p className="text-xs text-slate-400">
                      Gestioná los integrantes asignados a tu consultorio.
                    </p>
                  )}
                </div>
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => setCreateClinicModalOpen(true)}
                    className="self-start rounded-xl border border-cyan-400/40 bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!clinicsEnabled || clinicLimitReached}
                  >
                    Añadir consultorio
                  </button>
                )}
              </div>
              {clinicCards.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-slate-300">
                  {isOwner
                    ? 'Todavía no creaste consultorios. Usá “Añadir consultorio” para comenzar.'
                    : 'Todavía no tenés consultorios asignados.'}
                </p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {clinicCards.map((card) => {
                    const professionals = card.members.filter(
                      (member) => member.role === 'professional' || member.role === 'admin',
                    );
                    const assistants = card.members.filter((member) => member.role === 'assistant');
                    const pendingInvites = card.invitations.length;
                    const cardTitle = card.clinic ? card.clinic.name : 'Sin consultorio asignado';
                    const cardSubtitle = card.clinic?.address
                      ? card.clinic.address
                      : card.clinic
                        ? null
                        : 'Pacientes e integrantes sin un consultorio asignado.';

                    return (
                      <button
                        type="button"
                        key={card.id}
                        onClick={() => openClinicDetails(card.id)}
                        className="group flex w-full flex-col gap-4 rounded-2xl border border-white/5 bg-slate-900/60 p-5 text-left transition hover:border-cyan-400 hover:shadow-lg hover:shadow-cyan-500/10"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-base font-semibold text-white">{cardTitle}</p>
                            {cardSubtitle ? (
                              <p className="text-xs text-slate-300">{cardSubtitle}</p>
                            ) : null}
                          </div>
                          {isOwner && card.clinic ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleDeleteClinic(card.clinic!.id);
                              }}
                              className="rounded-lg border border-white/10 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-red-400 hover:text-red-300"
                            >
                              Eliminar
                            </button>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-slate-300">
                          <span>Profesionales: {professionals.length}</span>
                          <span>Asistentes: {assistants.length}</span>
                          {pendingInvites > 0 ? <span>Invitaciones: {pendingInvites}</span> : null}
                        </div>
                        <div className="space-y-2">
                          {professionals.length > 0 ? (
                            <div>
                              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                                Profesionales
                              </p>
                              <ul className="mt-1 space-y-1">
                                {professionals.slice(0, 3).map((member) => (
                                  <li key={member.id} className="text-sm text-white">
                                    {member.fullName}
                                  </li>
                                ))}
                                {professionals.length > 3 ? (
                                  <li className="text-xs text-slate-400">
                                    + {professionals.length - 3} más
                                  </li>
                                ) : null}
                              </ul>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400">Sin profesionales asignados.</p>
                          )}
                          {assistants.length > 0 ? (
                            <div>
                              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                                Asistentes
                              </p>
                              <ul className="mt-1 space-y-1">
                                {assistants.slice(0, 4).map((member) => (
                                  <li key={member.id} className="text-xs text-slate-300">
                                    {member.fullName}
                                  </li>
                                ))}
                                {assistants.length > 4 ? (
                                  <li className="text-xs text-slate-500">
                                    + {assistants.length - 4} más
                                  </li>
                                ) : null}
                              </ul>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400">Sin asistentes asignados.</p>
                          )}
                        </div>
                        <p className="text-xs font-medium text-cyan-300 opacity-0 transition group-hover:opacity-100">
                          Ver y gestionar integrantes
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <form
            onSubmit={handleInvite}
            className="space-y-4 rounded-2xl border border-white/5 bg-white/5 p-6"
          >
            {!canSendInvites && (
              <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-100">
                Solo el administrador o los profesionales asignados pueden invitar asistentes.
              </p>
            )}
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
                  disabled={!canSendInvites}
                />
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">
                  Rol
                </label>
                <select
                  value={targetRoleForInvite}
                  onChange={(event) =>
                    setInviteForm((prev) => ({ ...prev, role: event.target.value as StaffRole }))
                  }
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                  disabled={!isOwner}
                >
                  <option value="assistant">Asistente</option>
                  {isOwner && isPro && (
                    <>
                      <option value="professional">Profesional</option>
                      <option value="admin">Administrador</option>
                    </>
                  )}
                </select>
              </div>
              {isOwner && isPro && overview.clinics.length > 0 ? (
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
              ) : !isOwner && assignedClinic ? (
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">
                    Consultorio asignado
                  </label>
                  <p className="mt-1 rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2 text-sm text-slate-200">
                    {assignedClinic.name}
                  </p>
                </div>
              ) : null}
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={
                  inviteLoading ||
                  !canSendInvites ||
                  (targetRoleForInvite === 'assistant' && noAssistantSlots)
                }
              >
                {inviteLoading ? 'Enviando…' : 'Enviar invitación'}
              </button>
            </div>
          </form>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-white">Integrantes activos</h3>
              {visibleStaff.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-slate-300">
                  {isOwner ? 'Aún no agregaste integrantes.' : 'Aún no invitaste asistentes.'}
                </p>
              ) : (
                <ul className="space-y-3">
                  {visibleStaff.map((member) => (
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
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-medium ${STATUS_STYLES[member.status]}`}
                          >
                            {STATUS_LABELS[member.status]}
                          </span>
                          {member.status === 'inactive' || member.status === 'removed' ? (
                            <span className="text-[11px] text-amber-200">
                              Motivo: {member.statusReason ? member.statusReason : 'Sin motivo registrado.'}
                            </span>
                          ) : null}
                        </div>
                        {member.status !== 'active' && member.statusChangedAt ? (
                          <p className="mt-1 text-[11px] text-slate-500">
                            Actualizado el {new Date(member.statusChangedAt).toLocaleString('es-AR')}
                          </p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => openManageModal(member)}
                        className="rounded-lg border border-white/10 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-cyan-400 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!canManageMember(member) || member.status === 'invited'}
                      >
                        Gestionar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-white">Invitaciones pendientes</h3>
              {visibleInvitations.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-slate-300">
                  {isOwner
                    ? 'No tenés invitaciones enviadas recientemente.'
                    : 'No tenés invitaciones pendientes para tus asistentes.'}
                </p>
              ) : (
                <ul className="space-y-3">
                  {visibleInvitations.map((invitation) => (
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
                        className="rounded-lg border border-white/10 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-red-400 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!canManageInvitation(invitation)}
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
      {createClinicModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-8">
          <form
            onSubmit={handleCreateClinic}
            className="w-full max-w-lg space-y-4 rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl shadow-cyan-500/10"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Crear consultorio</h3>
                <p className="text-sm text-slate-300">
                  Definí el nombre y la dirección de referencia del nuevo consultorio.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateClinicModalOpen(false)}
                className="rounded-lg border border-white/10 px-3 py-1 text-xs font-medium text-slate-300 transition hover:border-slate-300 hover:text-white disabled:cursor-not-allowed"
                disabled={creatingClinic}
              >
                Cerrar
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">
                  Nombre del consultorio
                </label>
                <input
                  type="text"
                  value={clinicForm.name}
                  onChange={(event) => setClinicForm((prev) => ({ ...prev, name: event.target.value }))}
                  required
                  disabled={creatingClinic}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                  placeholder="Consultorio Central"
                />
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">
                  Dirección (opcional)
                </label>
                <input
                  type="text"
                  value={clinicForm.address}
                  onChange={(event) => setClinicForm((prev) => ({ ...prev, address: event.target.value }))}
                  disabled={creatingClinic}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                  placeholder="Av. Siempre Viva 742"
                />
              </div>
              {clinicLimit !== null ? (
                <p className="text-xs text-slate-400">
                  {clinicLimitReached
                    ? 'Alcanzaste el máximo de consultorios disponibles. Eliminá uno existente para habilitar un nuevo consultorio.'
                    : `Podés crear ${clinicsRemaining ?? 0} de ${clinicLimit} consultorios incluidos en tu plan Pro.`}
                </p>
              ) : null}
              {!clinicsEnabled && (
                <p className="text-xs text-amber-300">
                  Actualizá tu plan para habilitar más consultorios.
                </p>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCreateClinicModalOpen(false)}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                disabled={creatingClinic}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={creatingClinic || !clinicsEnabled || clinicLimitReached}
              >
                {creatingClinic ? 'Guardando…' : 'Crear consultorio'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
      {clinicModalOpen && selectedClinicCard ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-8">
          <div className="w-full max-w-4xl space-y-6 rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl shadow-cyan-500/10">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {selectedClinic ? selectedClinic.name : 'Sin consultorio asignado'}
                </h3>
                <p className="text-sm text-slate-300">
                  {selectedClinic
                    ? selectedClinic.address
                      ? selectedClinic.address
                      : 'Gestioná el equipo que trabaja en este consultorio.'
                    : 'Gestioná a quienes todavía no tienen consultorio asignado.'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeClinicModal}
                className="rounded-lg border border-white/10 px-3 py-1 text-xs font-medium text-slate-300 transition hover:border-slate-300 hover:text-white"
              >
                Cerrar
              </button>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-white">Profesionales</h4>
                {selectedClinicProfessionals.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-slate-300">
                    {isOwner
                      ? 'Aún no asignaste profesionales a este consultorio.'
                      : 'No hay profesionales asignados a tu consultorio.'}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {selectedClinicProfessionals.map((professional) => {
                      const assistantKey = professional.memberProfessionalId ?? professional.id;
                      const assistantsForProfessional = assistantsByProfessionalMap.get(assistantKey) ?? [];
                      return (
                        <div
                          key={professional.id}
                          className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/60 p-4"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-sm font-semibold text-white">{professional.fullName}</p>
                              <p className="text-xs text-slate-300">{professional.email}</p>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span
                                  className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-medium ${STATUS_STYLES[professional.status]}`}
                                >
                                  {STATUS_LABELS[professional.status]}
                                </span>
                                {professional.statusReason && professional.status !== 'active' ? (
                                  <span className="text-[11px] text-amber-200">
                                    Motivo: {professional.statusReason}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => openManageModal(professional)}
                              className="self-start rounded-lg border border-white/10 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-cyan-400 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={!canManageMember(professional) || professional.status === 'invited'}
                            >
                              Gestionar
                            </button>
                          </div>
                          <div className="space-y-2 rounded-xl border border-white/5 bg-white/5 p-3">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                              Asistentes
                            </p>
                            {assistantsForProfessional.length === 0 ? (
                              <p className="text-xs text-slate-400">Sin asistentes asignados.</p>
                            ) : (
                              <ul className="space-y-2">
                                {assistantsForProfessional.map((assistant) => (
                                  <li
                                    key={assistant.id}
                                    className="flex flex-col gap-2 rounded-lg border border-white/10 bg-slate-900/60 p-3 sm:flex-row sm:items-center sm:justify-between"
                                  >
                                    <div>
                                      <p className="text-sm font-medium text-white">{assistant.fullName}</p>
                                      <p className="text-xs text-slate-300">{assistant.email}</p>
                                      <div className="mt-1 flex flex-wrap items-center gap-2">
                                        <span
                                          className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-medium ${STATUS_STYLES[assistant.status]}`}
                                        >
                                          {STATUS_LABELS[assistant.status]}
                                        </span>
                                        {assistant.statusReason && assistant.status !== 'active' ? (
                                          <span className="text-[11px] text-amber-200">
                                            Motivo: {assistant.statusReason}
                                          </span>
                                        ) : null}
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => openManageModal(assistant)}
                                      className="self-start rounded-lg border border-white/10 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-cyan-400 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                                      disabled={!canManageMember(assistant) || assistant.status === 'invited'}
                                    >
                                      Gestionar
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {unassignedAssistants.length > 0 ? (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-white">Asistentes sin profesional asignado</h4>
                  <ul className="space-y-2">
                    {unassignedAssistants.map((assistant) => (
                      <li
                        key={assistant.id}
                        className="flex flex-col gap-2 rounded-xl border border-white/10 bg-slate-900/60 p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="text-sm font-medium text-white">{assistant.fullName}</p>
                          <p className="text-xs text-slate-300">{assistant.email}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-medium ${STATUS_STYLES[assistant.status]}`}
                            >
                              {STATUS_LABELS[assistant.status]}
                            </span>
                            {assistant.statusReason && assistant.status !== 'active' ? (
                              <span className="text-[11px] text-amber-200">
                                Motivo: {assistant.statusReason}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => openManageModal(assistant)}
                          className="self-start rounded-lg border border-white/10 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-cyan-400 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={!canManageMember(assistant) || assistant.status === 'invited'}
                        >
                          Gestionar
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-white">Invitaciones pendientes</h4>
                {selectedClinicInvitations.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-slate-300">
                    No hay invitaciones pendientes para este consultorio.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {selectedClinicInvitations.map((invitation) => (
                      <li
                        key={invitation.id}
                        className="flex flex-col gap-2 rounded-xl border border-white/10 bg-slate-900/60 p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="text-sm font-semibold text-white">{invitation.email}</p>
                          <p className="text-xs text-slate-400">
                            Rol:{' '}
                            {invitation.role === 'assistant'
                              ? 'Asistente'
                              : invitation.role === 'professional'
                                ? 'Profesional'
                                : 'Administrador'}
                          </p>
                          <p className="text-xs text-slate-500">
                            Invitada el {new Date(invitation.invitedAt).toLocaleString('es-AR')}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRevokeInvitation(invitation.id)}
                          className="self-start rounded-lg border border-white/10 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-red-400 hover:text-red-300"
                          disabled={!canManageInvitation(invitation)}
                        >
                          Cancelar
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {canSendInvites ? (
                <form
                  onSubmit={handleClinicInvite}
                  className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <h4 className="text-sm font-semibold text-white">
                    Invitar integrante {selectedClinic ? `a ${selectedClinic.name}` : ''}
                  </h4>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">
                        Email
                      </label>
                      <input
                        type="email"
                        required
                        value={clinicModalInvite.email}
                        onChange={(event) =>
                          setClinicModalInvite((prev) => ({ ...prev, email: event.target.value }))
                        }
                        disabled={clinicModalInvite.submitting}
                        className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                        placeholder="persona@dentalist.com"
                      />
                    </div>
                    {isOwner ? (
                      <div>
                        <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">
                          Rol
                        </label>
                        <select
                          value={clinicModalInvite.role}
                          onChange={(event) =>
                            setClinicModalInvite((prev) => ({
                              ...prev,
                              role: event.target.value as StaffRole,
                            }))
                          }
                          disabled={clinicModalInvite.submitting}
                          className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                        >
                          <option value="assistant">Asistente</option>
                          {isPro && (
                            <>
                              <option value="professional">Profesional</option>
                              <option value="admin">Administrador</option>
                            </>
                          )}
                        </select>
                      </div>
                    ) : (
                      <div className="sm:col-span-2">
                        <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
                          Solo podés invitar asistentes a tu consultorio asignado.
                        </p>
                      </div>
                    )}
                  </div>
                  {clinicModalInvite.message ? (
                    <div
                      className={`rounded-xl border p-3 text-xs ${
                        clinicModalInvite.message.type === 'success'
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
                          : clinicModalInvite.message.type === 'warning'
                            ? 'border-amber-400/40 bg-amber-400/10 text-amber-100'
                            : 'border-red-500/40 bg-red-500/10 text-red-100'
                      }`}
                    >
                      <p>{clinicModalInvite.message.text}</p>
                      {clinicModalInvite.message.inviteUrl ? (
                        <p className="mt-1 break-all text-[11px]">
                          {clinicModalInvite.message.inviteUrl}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={
                        clinicModalInvite.submitting ||
                        (clinicModalInvite.role === 'assistant' && noAssistantSlots)
                      }
                    >
                      {clinicModalInvite.submitting ? 'Enviando…' : 'Enviar invitación'}
                    </button>
                  </div>
                </form>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      {manageModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-8">
          <form
            onSubmit={handleManageSubmit}
            className="w-full max-w-lg space-y-4 rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl shadow-cyan-500/10"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Gestionar integrante</h3>
                <p className="text-sm text-slate-300">
                  {manageModal.member.fullName} ·{' '}
                  {manageModal.member.role === 'assistant'
                    ? 'Asistente'
                    : manageModal.member.role === 'professional'
                      ? 'Profesional'
                      : 'Administrador'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeManageModal}
                className="rounded-lg border border-white/10 px-3 py-1 text-xs font-medium text-slate-300 transition hover:border-slate-300 hover:text-white disabled:cursor-not-allowed"
                disabled={manageModal.submitting}
              >
                Cerrar
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">
                  Estado
                </label>
                <select
                  value={manageModal.status}
                  onChange={(event) => {
                    const nextStatus = event.target.value as StaffStatus;
                    setManageModal((prev) =>
                      prev
                        ? {
                            ...prev,
                            status: nextStatus,
                            error: null,
                            reason:
                              nextStatus === 'active'
                                ? ''
                                : prev.reason || prev.member.statusReason || '',
                          }
                        : prev,
                    );
                  }}
                  disabled={manageModal.submitting}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                >
                  <option value="active">Activo</option>
                  <option value="inactive">Inactivo</option>
                  <option value="removed">Removido</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">
                  Consultorio asignado
                </label>
                <select
                  value={manageModal.clinicId}
                  onChange={(event) =>
                    setManageModal((prev) =>
                      prev
                        ? {
                            ...prev,
                            clinicId: event.target.value,
                            error: null,
                          }
                        : prev,
                    )
                  }
                  disabled={manageModal.submitting || (!isOwner && actingRole !== 'professional')}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                >
                  {isOwner && <option value="">Sin asignar</option>}
                  {clinicsForSelect.map((clinic) => (
                    <option key={clinic.id} value={clinic.id}>
                      {clinic.name}
                    </option>
                  ))}
                </select>
                {!isOwner && actingRole === 'professional' ? (
                  <p className="mt-1 text-xs text-slate-400">
                    Solo podés asignar integrantes a tu consultorio.
                  </p>
                ) : null}
              </div>
              {manageModal.status === 'inactive' || manageModal.status === 'removed' ? (
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">
                    Motivo (obligatorio)
                  </label>
                  <textarea
                    value={manageModal.reason}
                    onChange={(event) =>
                      setManageModal((prev) =>
                        prev
                          ? {
                              ...prev,
                              reason: event.target.value,
                              error: null,
                            }
                          : prev,
                      )
                    }
                    rows={3}
                    maxLength={500}
                    required
                    disabled={manageModal.submitting}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                    placeholder="Detalle por qué inactivás o removés a la persona."
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    Este mensaje se mostrará al integrante cuando intente acceder.
                  </p>
                </div>
              ) : manageModal.member.statusReason ? (
                <div className="sm:col-span-2">
                  <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
                    Motivo registrado actualmente: “{manageModal.member.statusReason}”.
                  </p>
                </div>
              ) : null}
            </div>
            {manageModal.error ? (
              <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                {manageModal.error}
              </p>
            ) : null}
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeManageModal}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                disabled={manageModal.submitting}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={manageModal.submitting}
              >
                {manageModal.submitting ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
