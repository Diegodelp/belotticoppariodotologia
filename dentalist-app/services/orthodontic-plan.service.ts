import { OrthodonticPlan } from '@/types';

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

export class OrthodonticPlanService {
  static async list(): Promise<{ plans: OrthodonticPlan[] }> {
    const response = await fetch('/api/orthodontic-plans', {
      headers: {
        ...authHeaders(),
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const data = await parseJson(response);
      throw new Error(
        (data as { error?: string } | null)?.error ?? 'No pudimos cargar los planes de ortodoncia.',
      );
    }

    return response.json();
  }

  static async create(payload: {
    name: string;
    monthlyFee: number;
    hasInitialFee: boolean;
    initialFee?: number | null;
  }): Promise<{ success: boolean; plan: OrthodonticPlan }> {
    const response = await fetch('/api/orthodontic-plans', {
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
      throw new Error(
        (data as { error?: string } | null)?.error ?? 'No pudimos crear el plan de ortodoncia.',
      );
    }

    return response.json();
  }

  static async update(
    id: string,
    payload: Partial<{
      name: string;
      monthlyFee: number;
      hasInitialFee: boolean;
      initialFee: number | null;
    }>,
  ): Promise<{ success: boolean; plan: OrthodonticPlan }> {
    const response = await fetch(`/api/orthodontic-plans/${id}`, {
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
      throw new Error(
        (data as { error?: string } | null)?.error ?? 'No pudimos actualizar el plan de ortodoncia.',
      );
    }

    return response.json();
  }

  static async remove(id: string): Promise<{ success: boolean; plans: OrthodonticPlan[] }> {
    const response = await fetch(`/api/orthodontic-plans/${id}`, {
      method: 'DELETE',
      headers: {
        ...authHeaders(),
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const data = await parseJson(response);
      throw new Error(
        (data as { error?: string } | null)?.error ?? 'No pudimos eliminar el plan de ortodoncia.',
      );
    }

    return response.json();
  }
}
