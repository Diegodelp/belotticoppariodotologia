import { ProfessionalKeyStatus } from '@/types';

async function parseResponse(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data?.error === 'string' ? data.error : 'No pudimos procesar la solicitud de cifrado.';
    throw new Error(message);
  }
  if (!data || typeof data !== 'object' || !('status' in data)) {
    throw new Error('Respuesta inesperada del servidor de cifrado.');
  }

  return data.status as ProfessionalKeyStatus;
}

export class EncryptionService {
  static async getStatus(): Promise<ProfessionalKeyStatus> {
    const response = await fetch('/api/professionals/encryption/key', {
      method: 'GET',
      credentials: 'include',
    });

    return parseResponse(response);
  }

  static async rotate(): Promise<ProfessionalKeyStatus> {
    const response = await fetch('/api/professionals/encryption/key', {
      method: 'POST',
      credentials: 'include',
    });

    return parseResponse(response);
  }
}
