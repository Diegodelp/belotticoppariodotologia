import { NextRequest, NextResponse } from 'next/server';

import { getUserFromRequest } from '@/lib/auth/get-user';
import {
  createClinic,
  getClinicCountForProfessional,
  getProfessionalGoogleCredentials,
  getProfessionalProfile,
  getProfessionalSubscriptionSummary,
  upsertProfessionalGoogleCredentials,
} from '@/lib/db/supabase-repository';
import { createCalendar, isCalendarReady, OAuthTokenSet } from '@/lib/google/calendar';
import { getClinicLimit, isProPlan } from '@/lib/utils/subscription';
import { DEFAULT_TIME_ZONE, normalizeTimeZone } from '@/lib/utils/timezone';

export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request);

  if (!user || user.type !== 'profesional') {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  if (user.ownerProfessionalId) {
    return NextResponse.json(
      { error: 'Solo el administrador de la cuenta puede crear consultorios.' },
      { status: 403 },
    );
  }

  const ownerProfessionalId = user.id;

  const [subscription, existingCount] = await Promise.all([
    getProfessionalSubscriptionSummary(ownerProfessionalId),
    getClinicCountForProfessional(ownerProfessionalId),
  ]);

  if (!isProPlan(subscription.plan)) {
    return NextResponse.json(
      {
        error:
          'La gestión de consultorios múltiples está disponible en los planes Pro y Enterprise. Actualizá tu suscripción para habilitarla.',
      },
      { status: 403 },
    );
  }

  const clinicLimit = getClinicLimit(subscription.plan);
  if (clinicLimit !== null && existingCount >= clinicLimit) {
    return NextResponse.json(
      {
        error: `Alcanzaste el máximo de ${clinicLimit} consultorios disponibles en tu plan Pro. Eliminá uno existente para crear un nuevo consultorio.`,
      },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const name = (body?.name as string | undefined)?.trim();
    const address = (body?.address as string | undefined)?.trim();

    if (!name) {
      return NextResponse.json(
        { error: 'Ingresá un nombre para el consultorio o clínica.' },
        { status: 400 },
      );
    }

    if (!isCalendarReady()) {
      return NextResponse.json(
        {
          error:
            'Conectá Google Calendar desde Configuración para crear consultorios sincronizados automáticamente.',
        },
        { status: 400 },
      );
    }

    const [profile, credentials] = await Promise.all([
      getProfessionalProfile(ownerProfessionalId),
      getProfessionalGoogleCredentials(ownerProfessionalId),
    ]);

    if (!credentials) {
      return NextResponse.json(
        {
          error:
            'Necesitás vincular tu cuenta de Google Calendar antes de crear consultorios. Hacelo desde Configuración.',
        },
        { status: 400 },
      );
    }

    const timeZone = normalizeTimeZone(profile?.timeZone ?? user.timeZone ?? DEFAULT_TIME_ZONE);
    const tokenSet: OAuthTokenSet = {
      accessToken: credentials.accessToken,
      refreshToken: credentials.refreshToken,
      scope: credentials.scope,
      tokenType: credentials.tokenType,
      expiryDate: credentials.expiryDate,
    };

    const calendarResponse = await createCalendar(tokenSet, {
      summary: name,
      description: `Agenda creada automáticamente para el consultorio ${name}`,
      timeZone,
    });

    const calendarId = calendarResponse.calendar.id;

    if (!calendarId) {
      throw new Error('Google Calendar no devolvió un identificador para el nuevo calendario.');
    }

    const credentialsChanged =
      calendarResponse.latestCredentials.accessToken !== credentials.accessToken ||
      calendarResponse.latestCredentials.refreshToken !== credentials.refreshToken ||
      calendarResponse.latestCredentials.scope !== credentials.scope ||
      calendarResponse.latestCredentials.tokenType !== credentials.tokenType ||
      calendarResponse.latestCredentials.expiryDate !== credentials.expiryDate;

    if (credentialsChanged) {
      await upsertProfessionalGoogleCredentials(ownerProfessionalId, {
        googleUserId: credentials.googleUserId,
        email: credentials.email,
        calendarId: credentials.calendarId ?? 'primary',
        accessToken: calendarResponse.latestCredentials.accessToken,
        refreshToken: calendarResponse.latestCredentials.refreshToken,
        scope: calendarResponse.latestCredentials.scope,
        tokenType: calendarResponse.latestCredentials.tokenType,
        expiryDate: calendarResponse.latestCredentials.expiryDate,
      });
    }

    const clinic = await createClinic(ownerProfessionalId, {
      name,
      address: address ?? null,
      calendarId,
    });

    return NextResponse.json({ clinic, success: true });
  } catch (error) {
    console.error('Error al crear consultorio', error);
    return NextResponse.json(
      { error: 'No pudimos crear el consultorio. Verificá la conexión con Google e intentá nuevamente.' },
      { status: 500 },
    );
  }
}
