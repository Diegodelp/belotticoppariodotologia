import { Treatment } from '@/types';

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

export class TreatmentService {
  static async create(data: {
    patientId: string;
    type: string;
    description: string;
    cost: number;
    date: string;
  }): Promise<{ success?: boolean; treatment?: Treatment; error?: string }> {
    const response = await fetch('/api/treatments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    return response.json();
  }
}
