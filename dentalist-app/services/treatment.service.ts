import { Treatment } from '@/types';

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

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  if (!response.ok) {
    throw new Error('No pudimos procesar la firma digital del consentimiento informado.');
  }
  return response.blob();
}

export class TreatmentService {
  static async create(data: {
    patientId: string;
    type: string;
    description: string;
    cost: number;
    date: string;
    consent: {
      patientName: string;
      file: File;
      signatureDataUrl: string;
    };
  }): Promise<{ success?: boolean; treatment?: Treatment; error?: string }> {
    const formData = new FormData();
    formData.append('patientId', data.patientId);
    formData.append('type', data.type);
    formData.append('description', data.description);
    formData.append('cost', data.cost.toString());
    formData.append('date', data.date);
    formData.append('consentPatientName', data.consent.patientName);
    formData.append('consentFile', data.consent.file);
    const signatureBlob = await dataUrlToBlob(data.consent.signatureDataUrl);
    formData.append('consentSignature', signatureBlob, 'firma.png');

    const response = await fetch('/api/treatments', {
      method: 'POST',
      headers: authHeaders(),
      credentials: 'include',
      body: formData,
    });
    return response.json();
  }

  static async update(data: {
    id: string;
    type: string;
    description: string;
    cost: number;
    date: string;
    consent?: {
      patientName?: string;
      file?: File | null;
      signatureDataUrl?: string | null;
      replace?: boolean;
    };
  }): Promise<{ success?: boolean; treatment?: Treatment; error?: string }> {
    const formData = new FormData();
    formData.append('id', data.id);
    formData.append('type', data.type);
    formData.append('description', data.description);
    formData.append('cost', data.cost.toString());
    formData.append('date', data.date);

    if (data.consent) {
      if (typeof data.consent.replace === 'boolean') {
        formData.append('consentReplace', data.consent.replace ? 'true' : 'false');
      }

      if (typeof data.consent.patientName === 'string') {
        formData.append('consentPatientName', data.consent.patientName);
      }

      if (data.consent.file) {
        formData.append('consentFile', data.consent.file);
        if (!data.consent.replace) {
          formData.set('consentReplace', 'true');
        }
      }

      if (data.consent.signatureDataUrl) {
        const signatureBlob = await dataUrlToBlob(data.consent.signatureDataUrl);
        formData.append('consentSignature', signatureBlob, 'firma.png');
        if (!data.consent.replace) {
          formData.set('consentReplace', 'true');
        }
      }
    }

    const response = await fetch('/api/treatments', {
      method: 'PUT',
      headers: authHeaders(),
      credentials: 'include',
      body: formData,
    });
    return response.json();
  }

  static async remove(id: string): Promise<{ success?: boolean; error?: string }> {
    const response = await fetch(`/api/treatments?treatmentId=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        ...authHeaders(),
      },
      credentials: 'include',
    });
    return response.json();
  }
}
