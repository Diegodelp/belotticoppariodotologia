import { NextRequest, NextResponse } from 'next/server';

import { getUserFromRequest } from '@/lib/auth/get-user';
import {
  getClinicByIdForOwner,
  getStaffMemberById,
  updateStaffMember,
} from '@/lib/db/supabase-repository';
import { StaffStatus } from '@/types';

const MUTABLE_STATUSES: StaffStatus[] = ['active', 'inactive', 'removed'];

export async function DELETE() {
  return NextResponse.json(
    {
      error:
        'La eliminación directa no está disponible. Utilizá la opción de actualizar estado para registrar un motivo.',
    },
    { status: 405 },
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = getUserFromRequest(request);

  if (!user || user.type !== 'profesional') {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { id } = await params;

  let payload: {
    status?: StaffStatus;
    reason?: unknown;
    clinicId?: unknown;
  };

  try {
    payload = (await request.json()) ?? {};
  } catch {
    payload = {};
  }

  if (
    typeof payload.status === 'undefined' &&
    typeof payload.reason === 'undefined' &&
    typeof payload.clinicId === 'undefined'
  ) {
    return NextResponse.json({ error: 'No se recibieron cambios para aplicar.' }, { status: 400 });
  }

  try {
    const ownerProfessionalId = user.ownerProfessionalId ?? user.id;
    const isOwner = !user.ownerProfessionalId;
    const actingRole = user.teamRole ?? (isOwner ? 'admin' : null);
    const actingClinicId = user.teamClinicId ?? null;

    const staffMember = await getStaffMemberById(ownerProfessionalId, id);
    if (!staffMember) {
      return NextResponse.json({ error: 'Integrante no encontrado' }, { status: 404 });
    }

    if (!isOwner) {
      if (actingRole !== 'professional') {
        return NextResponse.json(
          { error: 'No tenés permisos para modificar el equipo.' },
          { status: 403 },
        );
      }

      if (staffMember.role !== 'assistant') {
        return NextResponse.json(
          { error: 'Solo podés gestionar asistentes.' },
          { status: 403 },
        );
      }

      if (actingClinicId && staffMember.clinicId && staffMember.clinicId !== actingClinicId) {
        return NextResponse.json(
          { error: 'No podés gestionar integrantes de otros consultorios.' },
          { status: 403 },
        );
      }
    }

    const updates: {
      status?: StaffStatus;
      statusReason?: string | null;
      clinicId?: string | null;
    } = {};

    if (typeof payload.status !== 'undefined') {
      if (typeof payload.status !== 'string' || !MUTABLE_STATUSES.includes(payload.status)) {
        return NextResponse.json(
          { error: 'Estado no válido. Solo se admite activo, inactivo o removido.' },
          { status: 400 },
        );
      }

      const trimmedReason = typeof payload.reason === 'string' ? payload.reason.trim() : '';
      if (payload.status === 'inactive' || payload.status === 'removed') {
        if (!trimmedReason) {
          return NextResponse.json(
            { error: 'Indicá el motivo de la inactivación o remoción.' },
            { status: 422 },
          );
        }
        updates.statusReason = trimmedReason;
      } else {
        updates.statusReason = null;
      }

      updates.status = payload.status;
    } else if (typeof payload.reason !== 'undefined') {
      if (staffMember.status !== 'inactive' && staffMember.status !== 'removed') {
        return NextResponse.json(
          { error: 'Solo podés actualizar el motivo cuando la cuenta está inactiva o removida.' },
          { status: 400 },
        );
      }

      if (typeof payload.reason !== 'string' || !payload.reason.trim()) {
        return NextResponse.json(
          { error: 'Indicá el motivo de la inactivación o remoción.' },
          { status: 422 },
        );
      }

      updates.statusReason = payload.reason.trim();
    }

    if (typeof payload.clinicId !== 'undefined') {
      const rawClinicId = payload.clinicId;
      let normalizedClinicId: string | null;

      if (rawClinicId === null || rawClinicId === '') {
        normalizedClinicId = null;
      } else if (typeof rawClinicId === 'string') {
        normalizedClinicId = rawClinicId;
      } else {
        return NextResponse.json({ error: 'Consultorio inválido.' }, { status: 400 });
      }

      if (!isOwner) {
        if (!actingClinicId) {
          return NextResponse.json(
            { error: 'No tenés permisos para reasignar consultorios.' },
            { status: 403 },
          );
        }
        if (normalizedClinicId === null || normalizedClinicId !== actingClinicId) {
          return NextResponse.json(
            { error: 'Solo podés asignar integrantes a tu propio consultorio.' },
            { status: 403 },
          );
        }
      } else if (normalizedClinicId) {
        const clinic = await getClinicByIdForOwner(ownerProfessionalId, normalizedClinicId);
        if (!clinic) {
          return NextResponse.json(
            { error: 'El consultorio seleccionado no existe.' },
            { status: 404 },
          );
        }
      }

      updates.clinicId = normalizedClinicId;
    }

    const currentStatus = staffMember.status;
    const currentReason = staffMember.statusReason ?? null;
    const currentClinic = staffMember.clinicId ?? null;

    const hasStatusChange =
      typeof updates.status !== 'undefined' && updates.status !== currentStatus;
    const hasReasonChange =
      typeof updates.statusReason !== 'undefined' && updates.statusReason !== currentReason;
    const hasClinicChange =
      typeof updates.clinicId !== 'undefined' && updates.clinicId !== currentClinic;

    if (!hasStatusChange && !hasReasonChange && !hasClinicChange) {
      return NextResponse.json({ error: 'No se detectaron cambios para guardar.' }, { status: 400 });
    }

    const member = await updateStaffMember(ownerProfessionalId, id, updates);
    return NextResponse.json({ member });
  } catch (error) {
    console.error('Error al actualizar integrante del equipo', error);
    return NextResponse.json(
      { error: 'No pudimos actualizar al integrante. Intentá nuevamente.' },
      { status: 500 },
    );
  }
}
