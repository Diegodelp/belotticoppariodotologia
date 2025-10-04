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

  static async startOAuth(): Promise<{ url: string }> {
    const response = await fetch('/api/google/gemini/url', {
      headers: {
        ...authHeaders(),
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const data = await parseJson(response);
      throw new Error((data as { error?: string } | null)?.error ?? 'No pudimos iniciar la conexión con Gemini.');
    }

    return (await response.json()) as { url: string };
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
