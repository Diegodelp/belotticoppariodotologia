import { SubscriptionPlan, SubscriptionStatus, User } from '@/types';

export const TRIAL_DURATION_DAYS = 30;

export type PlanCapabilityKey =
  | 'aiInsights'
  | 'marketingAutomation'
  | 'whatsappInbox'
  | 'storage'
  | 'patientLimit'
  | 'staffSeats';

export interface PlanCapabilities {
  patientLimit: number | null;
  staffSeats: number | null;
  storageGb: number;
  aiInsights: boolean;
  marketingAutomation: boolean;
  whatsappInbox: boolean;
}

export interface PlanDefinition {
  id: SubscriptionPlan;
  name: string;
  headline: string;
  priceLabel: string;
  priceValue: number;
  description: string;
  highlight: string;
  features: string[];
  capabilities: PlanCapabilities;
}

export const PLAN_DEFINITIONS: Record<SubscriptionPlan, PlanDefinition> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    headline: 'Digitalizá tu consultorio',
    priceLabel: '$24.900 ARS / mes',
    priceValue: 24900,
    description:
      'Ideal para profesionales independientes o consultorios que están dando sus primeros pasos en la transformación digital.',
    highlight: 'Incluye 30 días de prueba sin costo y sin pedir tarjeta.',
    features: [
      'Hasta 200 pacientes activos gestionados a la vez',
      '1 profesional + 2 asistentes con acceso compartido',
      'Agenda inteligente con recordatorios por WhatsApp y email',
      'Presupuestos y recetas con firma digital ilimitadas',
      'Reportes financieros esenciales y tablero de cobranzas',
    ],
    capabilities: {
      patientLimit: 200,
      staffSeats: 3,
      storageGb: 25,
      aiInsights: false,
      marketingAutomation: false,
      whatsappInbox: false,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    headline: 'Escalá tu clínica',
    priceLabel: '$44.900 ARS / mes',
    priceValue: 44900,
    description:
      'Diseñado para clínicas con múltiples sillones que necesitan automatizar campañas, obtener insights por IA y trabajar en equipo sin límites.',
    highlight: 'Automatizaciones en Instagram y WhatsApp + insights por IA incluidos.',
    features: [
      'Pacientes, usuarios y almacenamiento ilimitados',
      'Integraciones de marketing en Instagram y WhatsApp Business',
      'Insights por IA sobre cobranzas y rendimiento del equipo',
      'Workflows automáticos para seguimiento de ausentes y leads',
      'Onboarding personalizado y soporte prioritario 24/7',
    ],
    capabilities: {
      patientLimit: null,
      staffSeats: null,
      storageGb: 200,
      aiInsights: true,
      marketingAutomation: true,
      whatsappInbox: true,
    },
  },
};

export const PLAN_ORDER: SubscriptionPlan[] = ['starter', 'pro'];

export function getPlanDefinition(plan: SubscriptionPlan | null | undefined): PlanDefinition {
  const fallback: SubscriptionPlan = plan && PLAN_DEFINITIONS[plan] ? plan : 'starter';
  return PLAN_DEFINITIONS[fallback];
}

export function getPatientLimit(plan: SubscriptionPlan | null | undefined): number | null {
  return getPlanDefinition(plan).capabilities.patientLimit;
}

export function getStaffSeatLimit(plan: SubscriptionPlan | null | undefined): number | null {
  return getPlanDefinition(plan).capabilities.staffSeats;
}

export function getPlanName(plan: SubscriptionPlan | null | undefined): string {
  return getPlanDefinition(plan).name;
}

export function getPlanHeadline(plan: SubscriptionPlan | null | undefined): string {
  return getPlanDefinition(plan).headline;
}

export function getPlanPriceLabel(plan: SubscriptionPlan | null | undefined): string {
  return getPlanDefinition(plan).priceLabel;
}

export function planSupportsCapability(
  plan: SubscriptionPlan | null | undefined,
  capability: PlanCapabilityKey,
): boolean {
  const definition = getPlanDefinition(plan);
  switch (capability) {
    case 'patientLimit':
      return Boolean(definition.capabilities.patientLimit === null);
    case 'staffSeats': {
      const starterStaffSeats = PLAN_DEFINITIONS.starter.capabilities.staffSeats;
      if (starterStaffSeats === null) {
        return true;
      }
      const planStaffSeats = definition.capabilities.staffSeats;
      return planStaffSeats === null || planStaffSeats > starterStaffSeats;
    }
    case 'storage':
      return definition.capabilities.storageGb > PLAN_DEFINITIONS.starter.capabilities.storageGb;
    case 'aiInsights':
      return definition.capabilities.aiInsights;
    case 'marketingAutomation':
      return definition.capabilities.marketingAutomation;
    case 'whatsappInbox':
      return definition.capabilities.whatsappInbox;
    default:
      return false;
  }
}

export function isTrialExpired(trialEndsAt: string | null | undefined): boolean {
  if (!trialEndsAt) {
    return false;
  }
  const expires = new Date(trialEndsAt).getTime();
  if (Number.isNaN(expires)) {
    return false;
  }
  return Date.now() > expires;
}

export function ensureSubscriptionStatus(
  status: SubscriptionStatus | null | undefined,
  trialEndsAt: string | null | undefined,
): SubscriptionStatus {
  if (!status) {
    return isTrialExpired(trialEndsAt) ? 'trial_expired' : 'trialing';
  }
  if (status === 'trialing' && isTrialExpired(trialEndsAt)) {
    return 'trial_expired';
  }
  return status;
}

export function getTrialCountdown(
  trialEndsAt: string | null | undefined,
): { daysLeft: number | null; expired: boolean } {
  if (!trialEndsAt) {
    return { daysLeft: null, expired: false };
  }
  const expires = new Date(trialEndsAt).getTime();
  if (Number.isNaN(expires)) {
    return { daysLeft: null, expired: false };
  }
  const diffMs = expires - Date.now();
  if (diffMs <= 0) {
    return { daysLeft: 0, expired: true };
  }
  return { daysLeft: Math.ceil(diffMs / (1000 * 60 * 60 * 24)), expired: false };
}

const LOCKED_STATUSES: SubscriptionStatus[] = ['trial_expired', 'past_due', 'cancelled'];

export function isSubscriptionLocked(
  status: SubscriptionStatus | null | undefined,
  trialEndsAt: string | null | undefined,
): boolean {
  const resolved = ensureSubscriptionStatus(status, trialEndsAt);
  return LOCKED_STATUSES.includes(resolved);
}

export function userHasLockedSubscription(user: Pick<User, 'subscriptionStatus' | 'trialEndsAt' | 'type'> | null): boolean {
  if (!user || user.type !== 'profesional') {
    return false;
  }
  return isSubscriptionLocked(user.subscriptionStatus ?? null, user.trialEndsAt ?? null);
}

export function describeTrialStatus(
  trialEndsAt: string | null | undefined,
  status: SubscriptionStatus | null | undefined,
): string {
  const resolvedStatus = ensureSubscriptionStatus(status, trialEndsAt);
  const { daysLeft, expired } = getTrialCountdown(trialEndsAt);

  if (resolvedStatus === 'active') {
    return 'Suscripción activa';
  }

  if (resolvedStatus === 'trial_expired' || expired) {
    return 'La prueba gratuita finalizó. Activá tu plan para seguir usando Dentalist.';
  }

  if (daysLeft === null) {
    return 'Estás disfrutando la prueba gratuita de Dentalist.';
  }

  if (daysLeft === 0) {
    return 'La prueba vence hoy. Actualizá tu plan para evitar interrupciones.';
  }

  if (daysLeft === 1) {
    return 'Queda 1 día de prueba. Elegí un plan para continuar sin límites.';
  }

  return `Quedan ${daysLeft} días de prueba gratuita.`;
}

export function formatPlanFeatureList(features: string[]): Array<{ id: string; label: string }> {
  return features.map((feature) => ({ id: feature.toLowerCase().replace(/[^a-z0-9]+/g, '-'), label: feature }));
}

export function estimateTrialEnd(startIso: string | null | undefined): string | null {
  if (!startIso) {
    return null;
  }
  const start = new Date(startIso).getTime();
  if (Number.isNaN(start)) {
    return null;
  }
  const end = new Date(start + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);
  return end.toISOString();
}
