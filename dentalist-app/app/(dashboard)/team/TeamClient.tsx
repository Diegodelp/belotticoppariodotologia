'use client';

import { TeamManagement } from '@/components/settings/TeamManagement';
import { useAuth } from '@/hooks/useAuth';

export function TeamClient() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-sm text-slate-300">
        Cargando equipo...
      </div>
    );
  }

  if (!user || user.type !== 'profesional') {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-white">Equipo</h1>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-sm text-slate-300">
          Esta sección está disponible únicamente para cuentas profesionales.
        </div>
      </div>
    );
  }

  const isOwner = !user.ownerProfessionalId;
  const isInvitedProfessional = !!user.ownerProfessionalId && user.teamRole === 'professional';

  if (!isOwner && !isInvitedProfessional) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-white">Equipo</h1>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-sm text-slate-300">
          Tu rol actual no permite gestionar el equipo. Contactá al administrador del consultorio para solicitar
          permisos.
        </div>
      </div>
    );
  }

  const description = isOwner
    ? 'Administrá consultorios, profesionales y asistentes desde un solo lugar.'
    : 'Revisá tus asistentes asignados y enviá nuevas invitaciones cuando lo necesites.';

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-white">Equipo</h1>
        <p className="text-sm text-slate-300">{description}</p>
      </div>
      <TeamManagement plan={user.subscriptionPlan ?? null} currentUser={user} />
    </div>
  );
}
