import { Clinic, StaffInvitation, StaffMember, StaffRole, SubscriptionPlan } from '@/types';

function authHeaders(): HeadersInit | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  const token = localStorage.getItem('token');
  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : undefined;
}

async function parseJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export interface TeamOverview {
  clinics: Clinic[];
  staff: StaffMember[];
  invitations: StaffInvitation[];
  stats: {
    plan: SubscriptionPlan;
    clinicsEnabled: boolean;
    clinicLimit: number | null;
    clinicsActive: number;
    clinicsRemaining: number | null;
    assistantLimit: number | null;
    assistantsActive: number;
    assistantsPending: number;
  };
}

export class TeamService {
  static async getOverview(): Promise<TeamOverview> {
    const response = await fetch('/api/team', {
      headers: {
        ...authHeaders(),
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const data = await parseJson(response);
      throw new Error((data as { error?: string } | null)?.error ?? 'No pudimos cargar el equipo.');
    }

    return (await response.json()) as TeamOverview;
  }

  static async createClinic(payload: { name: string; address?: string | null }): Promise<Clinic> {
    const response = await fetch('/api/team/clinics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await parseJson(response);
      throw new Error((data as { error?: string } | null)?.error ?? 'No pudimos crear el consultorio.');
    }

    const data = (await response.json()) as { clinic: Clinic };
    return data.clinic;
  }

  static async deleteClinic(clinicId: string): Promise<void> {
    const response = await fetch(`/api/team/clinics/${clinicId}`, {
      method: 'DELETE',
      headers: {
        ...authHeaders(),
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const data = await parseJson(response);
      throw new Error((data as { error?: string } | null)?.error ?? 'No pudimos eliminar el consultorio.');
    }
  }

  static async inviteMember(payload: {
    email: string;
    role: StaffRole;
    clinicId?: string | null;
  }): Promise<{ invitation: StaffInvitation; inviteUrl: string; emailSent: boolean; emailError: string | null }> {
    const response = await fetch('/api/team/invitations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await parseJson(response);
      throw new Error((data as { error?: string } | null)?.error ?? 'No pudimos enviar la invitación.');
    }

    return (await response.json()) as {
      invitation: StaffInvitation;
      inviteUrl: string;
      emailSent: boolean;
      emailError: string | null;
    };
  }

  static async revokeInvitation(invitationId: string): Promise<void> {
    const response = await fetch(`/api/team/invitations/${invitationId}`, {
      method: 'DELETE',
      headers: {
        ...authHeaders(),
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const data = await parseJson(response);
      throw new Error((data as { error?: string } | null)?.error ?? 'No pudimos cancelar la invitación.');
    }
  }

  static async removeMember(staffId: string): Promise<void> {
    const response = await fetch(`/api/team/staff/${staffId}`, {
      method: 'DELETE',
      headers: {
        ...authHeaders(),
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const data = await parseJson(response);
      throw new Error((data as { error?: string } | null)?.error ?? 'No pudimos quitar al integrante.');
    }
  }
}
