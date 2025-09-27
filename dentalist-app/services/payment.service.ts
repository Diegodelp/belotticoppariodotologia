import { Payment } from '@/types';

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

interface CreatePaymentInput {
  patientId: string;
  amount: number;
  method: Payment['method'];
  status?: Payment['status'];
  date?: string;
  notes?: string;
}

export class PaymentService {
  static async create({
    patientId,
    amount,
    method,
    status = 'completed',
    date,
    notes,
  }: CreatePaymentInput): Promise<{
    success?: boolean;
    payment?: Payment;
    error?: string;
  }> {
    const response = await fetch('/api/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      credentials: 'include',
      body: JSON.stringify({
        patientId,
        amount,
        method,
        status,
        date,
        notes,
      }),
    });

    return response.json();
  }
}
