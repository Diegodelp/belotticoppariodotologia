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

export class ProfessionalService {
  static async getProfile(): Promise<{ profile: ProfessionalProfile }> {
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

    const data = (await response.json()) as { profile: ProfessionalProfile };
    return data;
  }

  static async updateProfile(
    payload: Partial<Pick<ProfessionalProfile, 'fullName' | 'clinicName' | 'licenseNumber' | 'phone' | 'address'>>,
  ): Promise<{ profile: ProfessionalProfile }> {
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

    const data = (await response.json()) as { profile: ProfessionalProfile };
    return data;
  }
}
