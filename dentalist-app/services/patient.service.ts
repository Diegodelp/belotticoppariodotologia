import {
  Budget,
  ClinicalHistory,
  ClinicalHistoryInput,
  ClinicalMedia,
  CreateBudgetInput,
  CreatePrescriptionInput,
  Patient,
  PatientOrthodonticPlan,
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

  static async assignOrthodonticPlan(
    patientId: string,
    planId: string,
  ): Promise<{ success: boolean; plan: PatientOrthodonticPlan }> {
    const response = await fetch(`/api/patients/${patientId}/orthodontic-plan`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      credentials: 'include',
      body: JSON.stringify({ planId }),
    });
    return response.json();
  }

  static async removeOrthodonticPlan(patientId: string): Promise<{ success: boolean }> {
    const response = await fetch(`/api/patients/${patientId}/orthodontic-plan`, {
      method: 'DELETE',
      headers: {
        ...authHeaders(),
      },
      credentials: 'include',
    });
    return response.json();
  }

  static async listMedia(patientId: string): Promise<{ media: ClinicalMedia[] }> {
    const response = await fetch(`/api/patients/${patientId}/media`, {
      headers: {
        ...authHeaders(),
      },
      credentials: 'include',
    });

    return response.json();
  }

  static async uploadMedia(
    patientId: string,
    formData: FormData,
  ): Promise<{ success: boolean; media?: ClinicalMedia; error?: string }> {
    const response = await fetch(`/api/patients/${patientId}/media`, {
      method: 'POST',
      headers: {
        ...authHeaders(),
      },
      credentials: 'include',
      body: formData,
    });

    return response.json();
  }

  static async createBudget(
    patientId: string,
    data: CreateBudgetInput,
  ): Promise<{ success: boolean; budget: Budget }> {
    const response = await fetch(`/api/patients/${patientId}/budgets`, {
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

  static async updateBudget(
    patientId: string,
    budgetId: string,
    data: CreateBudgetInput,
  ): Promise<{ success: boolean; budget: Budget; error?: string }> {
    const response = await fetch(
      `/api/patients/${patientId}/budgets?budgetId=${encodeURIComponent(budgetId)}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        credentials: 'include',
        body: JSON.stringify(data),
      },
    );
    return response.json();
  }

  static async deleteBudget(
    patientId: string,
    budgetId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const response = await fetch(
      `/api/patients/${patientId}/budgets?budgetId=${encodeURIComponent(budgetId)}`,
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

  static async deleteMedia(
    patientId: string,
    mediaId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const response = await fetch(
      `/api/patients/${patientId}/media?mediaId=${encodeURIComponent(mediaId)}`,
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

  static async createInvite() {
    const response = await fetch('/api/patients/invite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      credentials: 'include',
    });

    return response.json();
  }
}
