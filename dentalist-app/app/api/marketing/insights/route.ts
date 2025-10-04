import { NextRequest, NextResponse } from 'next/server';

import { getUserFromRequest } from '@/lib/auth/get-user';
import {
  getProfessionalGeminiCredentials,
  listAppointments,
  listPatients,
  listPayments,
  listTreatments,
  upsertProfessionalGeminiCredentials,
} from '@/lib/db/supabase-repository';
import { generateGeminiContent } from '@/lib/google/gemini';
import type { OAuthTokenSet } from '@/lib/google/calendar';
import { planSupportsCapability } from '@/lib/utils/subscription';
import type { MarketingInsightsResponse } from '@/types';

interface AggregatedDataset {
  metrics: MarketingInsightsResponse['metrics'];
  charts: MarketingInsightsResponse['charts'];
  context: {
    topTreatments: Array<{ type: string; count: number; revenue: number }>;
    totalTreatments: number;
    totalPatients: number;
    totalPayments: number;
    outstandingBalance: number;
  };
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(date: Date) {
  const copy = startOfDay(date);
  copy.setDate(copy.getDate() + 1);
  return copy;
}

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildMonthBuckets(reference: Date, count: number) {
  const buckets: Array<{ start: Date; end: Date; label: string }> = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const start = new Date(reference.getFullYear(), reference.getMonth() - offset, 1);
    const end = new Date(reference.getFullYear(), reference.getMonth() - offset + 1, 1);
    const label = start.toLocaleDateString('es-AR', { month: 'short' });
    buckets.push({ start, end, label });
  }
  return buckets;
}

function aggregateDataset(
  payments: Awaited<ReturnType<typeof listPayments>>,
  appointments: Awaited<ReturnType<typeof listAppointments>>,
  patients: Awaited<ReturnType<typeof listPatients>>,
  treatments: Awaited<ReturnType<typeof listTreatments>>,
): AggregatedDataset {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const paymentsCompleted = payments.filter((payment) => payment.status === 'completed');
  const revenueLast30Days = paymentsCompleted
    .filter((payment) => {
      const date = parseDate(payment.date);
      return date && date >= thirtyDaysAgo;
    })
    .reduce((total, payment) => total + payment.amount, 0);

  const outstandingBalance = payments
    .filter((payment) => payment.status === 'pending')
    .reduce((total, payment) => total + payment.amount, 0);

  const monthBuckets = buildMonthBuckets(now, 6);

  const revenueTrend = monthBuckets.map(({ start, end, label }) => {
    const total = paymentsCompleted
      .filter((payment) => {
        const date = parseDate(payment.date);
        return date && date >= start && date < end;
      })
      .reduce((acc, payment) => acc + payment.amount, 0);
    return { label, revenue: Math.round(total) };
  });

  const appointmentDates = appointments.map((appointment) => ({
    booked: parseDate(appointment.startAt ?? `${appointment.date}T${appointment.time}`),
    status: appointment.status,
    checkedInAt: parseDate(appointment.checkedInAt ?? null),
    patientId: appointment.patientId,
  }));

  const firstAppointmentByPatient = new Map<string, Date>();
  appointmentDates.forEach((entry) => {
    if (!entry.patientId || !entry.booked) {
      return;
    }
    const current = firstAppointmentByPatient.get(entry.patientId);
    if (!current || entry.booked < current) {
      firstAppointmentByPatient.set(entry.patientId, entry.booked);
    }
  });

  const patientTrend = monthBuckets.map(({ start, end, label }) => {
    let count = 0;
    firstAppointmentByPatient.forEach((firstVisit) => {
      if (firstVisit >= start && firstVisit < end) {
        count += 1;
      }
    });
    return { label, patients: count };
  });

  const newPatientsLast30Days = Array.from(firstAppointmentByPatient.values()).filter(
    (date) => date >= thirtyDaysAgo,
  ).length;

  const dayBuckets: Array<{ start: Date; end: Date; label: string }> = [];
  for (let offset = 13; offset >= 0; offset -= 1) {
    const day = startOfDay(new Date(now));
    day.setDate(day.getDate() - offset);
    const next = endOfDay(day);
    const label = day.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
    dayBuckets.push({ start: day, end: next, label });
  }

  const appointmentTrend = dayBuckets.map(({ start, end, label }) => {
    const sameDay = appointmentDates.filter((entry) => entry.booked && entry.booked >= start && entry.booked < end);
    const booked = sameDay.filter((entry) => entry.status !== 'cancelled').length;
    const attended = sameDay.filter((entry) => Boolean(entry.checkedInAt)).length;
    return { label, booked, attended };
  });

  const last30Appointments = appointmentDates.filter(
    (entry) => entry.booked && entry.booked >= thirtyDaysAgo && entry.booked <= now,
  );
  const bookedLast30 = last30Appointments.filter((entry) => entry.status !== 'cancelled').length;
  const attendedLast30 = last30Appointments.filter((entry) => Boolean(entry.checkedInAt)).length;
  const attendanceRate = bookedLast30 > 0 ? (attendedLast30 / bookedLast30) * 100 : 0;

  const treatmentSummary = new Map<string, { count: number; revenue: number }>();
  treatments.forEach((treatment) => {
    const current = treatmentSummary.get(treatment.type) ?? { count: 0, revenue: 0 };
    current.count += 1;
    current.revenue += treatment.cost ?? 0;
    treatmentSummary.set(treatment.type, current);
  });

  const topTreatments = Array.from(treatmentSummary.entries())
    .map(([type, stats]) => ({ type, count: stats.count, revenue: Math.round(stats.revenue) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    metrics: {
      revenueLast30Days,
      newPatientsLast30Days,
      attendanceRate,
      outstandingBalance,
    },
    charts: {
      revenueTrend,
      appointmentTrend,
      patientTrend,
    },
    context: {
      topTreatments,
      totalTreatments: treatments.length,
      totalPatients: patients.length,
      totalPayments: payments.length,
      outstandingBalance,
    },
  };
}

function sanitizeArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0);
}

function parseCampaigns(
  value: unknown,
): Array<{ title: string; script: string; callToAction: string }> {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => {
      if (typeof entry !== 'object' || !entry) {
        return null;
      }
      const record = entry as Record<string, unknown>;
      const title = typeof record.title === 'string' ? record.title.trim() : '';
      const script = typeof record.script === 'string' ? record.script.trim() : '';
      const callToAction = typeof record.callToAction === 'string' ? record.callToAction.trim() : '';
      if (!title || !script) {
        return null;
      }
      return {
        title,
        script,
        callToAction: callToAction || 'Solicitá tu turno',
      };
    })
    .filter((item): item is { title: string; script: string; callToAction: string } => Boolean(item));
}

function parseInstagramIdeas(
  value: unknown,
): Array<{ title: string; concept: string; caption: string; callToAction: string }> {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => {
      if (typeof entry !== 'object' || !entry) {
        return null;
      }
      const record = entry as Record<string, unknown>;
      const title = typeof record.title === 'string' ? record.title.trim() : '';
      const concept = typeof record.concept === 'string' ? record.concept.trim() : '';
      const caption = typeof record.caption === 'string' ? record.caption.trim() : '';
      const callToAction = typeof record.callToAction === 'string' ? record.callToAction.trim() : '';
      if (!title || !concept) {
        return null;
      }
      return {
        title,
        concept,
        caption: caption || concept,
        callToAction: callToAction || 'Reservar consulta',
      };
    })
    .filter(
      (item): item is { title: string; concept: string; caption: string; callToAction: string } => Boolean(item),
    );
}

function parseAiInsights(text: string, dataset: AggregatedDataset): MarketingInsightsResponse['ai'] {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    const parsed = JSON.parse(cleaned) as Partial<MarketingInsightsResponse['ai']>;
    return {
      summary:
        typeof parsed.summary === 'string' && parsed.summary.trim().length > 0
          ? parsed.summary.trim()
          : `Ingresos de los últimos 30 días: $${dataset.metrics.revenueLast30Days.toLocaleString('es-AR')}.
Pacientes nuevos: ${dataset.metrics.newPatientsLast30Days}.`,
      opportunities: sanitizeArray(parsed.opportunities),
      risks: sanitizeArray(parsed.risks),
      whatsappCampaigns: parseCampaigns(parsed.whatsappCampaigns),
      instagramCampaigns: parseInstagramIdeas(parsed.instagramCampaigns),
    };
  } catch (error) {
    console.warn('No se pudo parsear la respuesta de Gemini', error, text);
    return {
      summary:
        `Ingresos de los últimos 30 días: $${dataset.metrics.revenueLast30Days.toLocaleString('es-AR')} con ` +
        `${dataset.metrics.newPatientsLast30Days} pacientes nuevos registrados.`,
      opportunities: [
        'Segmentá campañas para reactivar pacientes con más de 90 días sin visitas.',
        'Promové los tratamientos más solicitados con testimonios y antes/después.',
      ],
      risks: ['Revisá la tasa de asistencia para evitar huecos en agenda y pérdida de ingresos.'],
      whatsappCampaigns: [],
      instagramCampaigns: [],
    };
  }
}

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  if (user.type !== 'profesional' || user.ownerProfessionalId) {
    return NextResponse.json({ error: 'Solo el titular de la cuenta puede acceder a Marketing IA.' }, { status: 403 });
  }

  if (!planSupportsCapability(user.subscriptionPlan ?? null, 'aiInsights')) {
    return NextResponse.json(
      {
        error:
          'Necesitás el plan Pro para activar los insights con IA y automatizaciones de marketing.',
      },
      { status: 403 },
    );
  }

  const credentials = await getProfessionalGeminiCredentials(user.id);
  if (!credentials) {
    return NextResponse.json(
      {
        error:
          'Conectá tu cuenta de Google Gemini desde Configuración > Google & IA para generar insights con tus datos reales.',
      },
      { status: 412 },
    );
  }

  try {
    const [payments, appointments, patients, treatments] = await Promise.all([
      listPayments(user.id),
      listAppointments(user.id),
      listPatients(user.id),
      listTreatments(user.id),
    ]);

    const dataset = aggregateDataset(payments, appointments, patients, treatments);

    const payload = {
      generatedAt: new Date().toISOString(),
      metrics: dataset.metrics,
      charts: dataset.charts,
      context: dataset.context,
    };

    const prompt = `Actuá como estratega de marketing para una clínica odontológica. Recibirás un JSON con métricas reales del negocio.
Devolveme exclusivamente un JSON con la estructura:
{
  "summary": string,
  "opportunities": string[],
  "risks": string[],
  "whatsappCampaigns": [
    { "title": string, "script": string, "callToAction": string }
  ],
  "instagramCampaigns": [
    { "title": string, "concept": string, "caption": string, "callToAction": string }
  ]
}
Redactá en español rioplatense, sé concreto y basate solo en los datos recibidos. JSON de entrada:\n${JSON.stringify(
      payload,
    )}`;

    const tokenSet: OAuthTokenSet = {
      accessToken: credentials.accessToken,
      refreshToken: credentials.refreshToken,
      scope: credentials.scope ?? null,
      tokenType: credentials.tokenType ?? null,
      expiryDate: credentials.expiryDate ?? null,
    };

    const { text, latestCredentials, model } = await generateGeminiContent(tokenSet, prompt, {
      temperature: 0.35,
    });

    if (
      latestCredentials.accessToken !== credentials.accessToken ||
      latestCredentials.refreshToken !== credentials.refreshToken ||
      latestCredentials.expiryDate !== credentials.expiryDate ||
      latestCredentials.scope !== credentials.scope ||
      latestCredentials.tokenType !== credentials.tokenType
    ) {
      await upsertProfessionalGeminiCredentials(user.id, {
        googleUserId: credentials.googleUserId,
        email: credentials.email,
        accessToken: latestCredentials.accessToken,
        refreshToken: latestCredentials.refreshToken,
        scope: latestCredentials.scope,
        tokenType: latestCredentials.tokenType,
        expiryDate: latestCredentials.expiryDate,
      });
    }

    const ai = parseAiInsights(text, dataset);

    const response: MarketingInsightsResponse = {
      metrics: dataset.metrics,
      charts: dataset.charts,
      ai,
      generatedAt: new Date().toISOString(),
      model,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error al generar insights de marketing', error);
    return NextResponse.json(
      { error: 'No pudimos generar insights en este momento. Intentalo nuevamente en unos minutos.' },
      { status: 500 },
    );
  }
}
