import { Patient } from '@/types';

export class PatientService {
  static async getAll() {
    const response = await fetch('/api/patients', {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      credentials: 'include',
    });
    return response.json();
  }

  static async getById(id: string) {
    const response = await fetch(`/api/patients/${id}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
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
        Authorization: `Bearer ${localStorage.getItem('token')}`,
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
        Authorization: `Bearer ${localStorage.getItem('token')}`,
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
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      credentials: 'include',
    });
    return response.json();
  }
}
