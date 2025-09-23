import { Appointment } from '@/types';

function authHeaders() {
  if (typeof window === 'undefined') {
    return {};
  }
  const token = localStorage.getItem('token');
  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};
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

  static async update(id: string, data: Partial<Appointment> & { date?: string; time?: string; type?: string }) {
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
}
