import { Clinic } from '@/types';

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

export class ClinicService {
  static async list(): Promise<Clinic[]> {
    const response = await fetch('/api/clinics', {
      headers: {
        ...authHeaders(),
      },
      credentials: 'include',
    });

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as Clinic[] | { clinics?: Clinic[] };
    if (Array.isArray(data)) {
      return data;
    }
    return Array.isArray(data.clinics) ? data.clinics : [];
  }
}
