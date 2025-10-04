import { GeminiConnectionStatus } from '@/types';

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

export class GeminiService {
  static async getStatus(): Promise<GeminiConnectionStatus | null> {
    const response = await fetch('/api/google/gemini/status', {
      headers: {
        ...authHeaders(),
      },
      credentials: 'include',
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      const data = await parseJson(response);
      throw new Error((data as { error?: string } | null)?.error ?? 'No pudimos verificar Gemini.');
    }

    return (await response.json()) as GeminiConnectionStatus;
  }

  static async saveApiKey(payload: { apiKey: string; label?: string | null }): Promise<{ success: boolean }> {
    const response = await fetch('/api/google/gemini/key', {
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
      throw new Error((data as { error?: string } | null)?.error ?? 'No pudimos guardar la API key de Gemini.');
    }

    return (await response.json()) as { success: boolean };
  }

  static async disconnect(): Promise<{ success: boolean }> {
    const response = await fetch('/api/google/gemini/disconnect', {
      method: 'POST',
      headers: {
        ...authHeaders(),
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const data = await parseJson(response);
      throw new Error((data as { error?: string } | null)?.error ?? 'No pudimos desconectar Gemini.');
    }

    return (await response.json()) as { success: boolean };
  }
}
