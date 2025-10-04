import { Appointment } from '@/types';

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

export class AppointmentService {
  static async list(query?: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value) {
          params.set(key, value);
        }
      });
    }
    const response = await fetch(`/api/appointments${params.toString() ? `?${params.toString()}` : ''}`, {
      headers: {
        ...authHeaders(),
      },
      credentials: 'include',
    });
    return response.json();
  }

  static async create(data: {
    patientId: string;
    date: string;
    time: string;
    type: string;
    status: Appointment['status'];
    clinicId?: string | null;
  }) {
    const response = await fetch('/api/appointments', {
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

  static async update(
    id: string,
    data: Partial<Appointment> & { date?: string; time?: string; type?: string; clinicId?: string | null },
  ) {
    const response = await fetch(`/api/appointments/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    return response.json();
  }

  static async remove(id: string) {
    const response = await fetch(`/api/appointments/${id}`, {
      method: 'DELETE',
      headers: {
        ...authHeaders(),
      },
      credentials: 'include',
    });
    return response.json();
  }

  static async checkIn(id: string) {
    const response = await fetch(`/api/appointments/${id}/check-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      credentials: 'include',
      body: JSON.stringify({}),
    });
    return response.json();
  }

  static async callPatient(id: string, data: { box: string }) {
    const response = await fetch(`/api/appointments/${id}/call`, {
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

  static async latestCall(query?: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value) {
          params.set(key, value);
        }
      });
    }
    const response = await fetch(`/api/appointments/call-display${params.toString() ? `?${params.toString()}` : ''}`, {
      headers: {
        ...authHeaders(),
      },
      credentials: 'include',
    });
    return response.json();
  }
}
