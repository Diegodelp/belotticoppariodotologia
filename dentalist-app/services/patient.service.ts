import {
  ClinicalHistory,
  ClinicalHistoryInput,
  CreatePrescriptionInput,
  Patient,
  Prescription,
} from '@/types';

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

  static async getClinicalHistory(id: string): Promise<{ clinicalHistory: ClinicalHistory | null }> {
    const response = await fetch(`/api/patients/${id}/clinical-history`, {
      headers: {
        ...authHeaders(),
      },
      credentials: 'include',
    });
    return response.json();
  }

  static async saveClinicalHistory(id: string, data: ClinicalHistoryInput) {
    const response = await fetch(`/api/patients/${id}/clinical-history`, {
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

  static async getPrescriptions(id: string): Promise<{ prescriptions: Prescription[] }> {
    const response = await fetch(`/api/patients/${id}/prescriptions`, {
      headers: {
        ...authHeaders(),
      },
      credentials: 'include',
    });
    return response.json();
  }

  static async createPrescription(id: string, data: CreatePrescriptionInput) {
    const response = await fetch(`/api/patients/${id}/prescriptions`, {
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

  static async deletePrescription(patientId: string, prescriptionId: string) {
    const response = await fetch(
      `/api/patients/${patientId}/prescriptions?prescriptionId=${encodeURIComponent(prescriptionId)}`,
      {
        method: 'DELETE',
        headers: {
          ...authHeaders(),
        },
        credentials: 'include',
      },
    );
    return response.json();
  }

  static async getProfessionalSignature(): Promise<{
    hasSignature: boolean;
    signatureUrl: string | null;
    updatedAt: string | null;
  }> {
    const response = await fetch('/api/professionals/signature', {
      headers: {
        ...authHeaders(),
      },
      credentials: 'include',
    });
    return response.json();
  }

  static async updateProfessionalSignature(signatureDataUrl: string) {
    const response = await fetch('/api/professionals/signature', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      credentials: 'include',
      body: JSON.stringify({ signatureDataUrl }),
    });

    return response.json();
  }
}
