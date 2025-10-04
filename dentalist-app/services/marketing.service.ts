import { MarketingInsightsResponse } from '@/types';

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

async function parseJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export class MarketingService {
  static async getInsights(): Promise<MarketingInsightsResponse> {
    const response = await fetch('/api/marketing/insights', {
      headers: {
        ...authHeaders(),
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const data = await parseJson(response);
      const message = (data as { error?: string } | null)?.error ?? 'No pudimos generar los insights.';
      const error = new Error(message);
      (error as Error & { status?: number }).status = response.status;
      throw error;
    }

    return (await response.json()) as MarketingInsightsResponse;
  }
}
