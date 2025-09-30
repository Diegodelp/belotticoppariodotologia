import { ProfessionalProfile } from '@/types';

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

type ProfessionalProfileResponse = {
  profile: ProfessionalProfile;
  ownerProfile?: ProfessionalProfile | null;
};

export class ProfessionalService {
  static async getProfile(): Promise<{ profile: ProfessionalProfile; ownerProfile: ProfessionalProfile | null }> {
    const response = await fetch('/api/professionals/me', {
      headers: {
        ...authHeaders(),
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const data = await parseJson(response);
      throw new Error((data as { error?: string } | null)?.error ?? 'No pudimos cargar los datos del profesional.');
    }

    const data = (await response.json()) as ProfessionalProfileResponse;
    return { profile: data.profile, ownerProfile: data.ownerProfile ?? null };
  }

  static async updateProfile(
    payload: Partial<
      Pick<
        ProfessionalProfile,
        'fullName' | 'clinicName' | 'licenseNumber' | 'phone' | 'address' | 'country' | 'province' | 'locality' | 'timeZone'
      >
    >,
  ): Promise<{ profile: ProfessionalProfile; ownerProfile: ProfessionalProfile | null }> {
    const response = await fetch('/api/professionals/me', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await parseJson(response);
      throw new Error((data as { error?: string } | null)?.error ?? 'No pudimos actualizar los datos.');
    }

    const data = (await response.json()) as ProfessionalProfileResponse & { success?: boolean };
    return { profile: data.profile, ownerProfile: data.ownerProfile ?? null };
  }

  static async getLogo(): Promise<{ hasLogo: boolean; logoUrl: string | null }> {
    const response = await fetch('/api/professionals/logo', {
      headers: {
        ...authHeaders(),
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const data = await parseJson(response);
      throw new Error((data as { error?: string } | null)?.error ?? 'No pudimos obtener el logo.');
    }

    return (await response.json()) as { hasLogo: boolean; logoUrl: string | null };
  }

  static async uploadLogo(file: File): Promise<{ success?: boolean; logoUrl?: string; error?: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/professionals/logo', {
      method: 'PUT',
      headers: {
        ...authHeaders(),
      },
      body: formData,
      credentials: 'include',
    });

    return response.json();
  }

  static async deleteLogo(): Promise<{ success?: boolean; error?: string }> {
    const response = await fetch('/api/professionals/logo', {
      method: 'DELETE',
      headers: {
        ...authHeaders(),
      },
      credentials: 'include',
    });

    return response.json();
  }
}
