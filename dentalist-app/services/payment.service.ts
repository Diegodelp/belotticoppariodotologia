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

  static async update({
    id,
    amount,
    method,
    status = 'completed',
    date,
    notes,
  }: {
    id: string;
    amount: number;
    method: Payment['method'];
    status?: Payment['status'];
    date?: string;
    notes?: string;
  }): Promise<{ success?: boolean; payment?: Payment; error?: string }> {
    const response = await fetch('/api/payments', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      credentials: 'include',
      body: JSON.stringify({ id, amount, method, status, date, notes }),
    });

    return response.json();
  }

  static async remove(id: string): Promise<{ success?: boolean; error?: string }> {
    const response = await fetch(`/api/payments?paymentId=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        ...authHeaders(),
      },
      credentials: 'include',
    });

    return response.json();
  }
}
