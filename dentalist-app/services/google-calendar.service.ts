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

export interface GoogleCalendarStatus {
  configured: boolean;
  connected: boolean;
  email: string | null;
  calendarId: string | null;
  expiresAt: string | null;
}

export class GoogleCalendarService {
  static async getStatus(): Promise<GoogleCalendarStatus> {
    const response = await fetch('/api/google/calendar/status', {
      headers: {
        ...authHeaders(),
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('No pudimos obtener el estado de Google Calendar');
    }

    return response.json();
  }

  static async getAuthorizationUrl(redirect: string) {
    const response = await fetch(`/api/google/oauth/url?redirect=${encodeURIComponent(redirect)}`, {
      headers: {
        ...authHeaders(),
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('No pudimos generar el enlace de autorización con Google');
    }

    return response.json();
  }

  static async disconnect() {
    const response = await fetch('/api/google/calendar/disconnect', {
      method: 'DELETE',
      headers: {
        ...authHeaders(),
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('No pudimos desconectar Google Calendar');
    }

    return response.json();
  }
}
