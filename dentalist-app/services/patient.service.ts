import { Patient } from '@/types';

function authHeaders(): Record<string, string> {
  if (typeof window === 'undefined') {
    return {};
  }

  const token = localStorage.getItem('token');

  if (!token) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}

export class PatientService {
  static async getAll() {
    const response = await fetch('/api/patients', {
      headers: {
        ...authHeaders(),
      },
      credentials: 'include',
    });
    return response.json();
  }

  static async getById(id: string) {
    const response = await fetch(`/api/patients/${id}`, {
      headers: {
        ...authHeaders(),
      },
      credentials: 'include',
    });
    return response.json();
  }

  static async create(data: Partial<Patient>) {
    const response = await fetch('/api/patients', {
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

  static async update(id: string, data: Partial<Patient>) {
    const response = await fetch(`/api/patients/${id}`, {
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
    const response = await fetch(`/api/patients/${id}`, {
      method: 'DELETE',
      headers: {
        ...authHeaders(),
      },
      credentials: 'include',
    });
    return response.json();
  }
}
