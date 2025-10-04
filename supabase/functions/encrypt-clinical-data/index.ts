import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import {
  ensureProfessionalKey,
  encryptPayloadWithProfessionalKey,
  requireServiceAuth,
  UnauthorizedError,
} from '../_shared/encryption.ts';

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

serve(async (request) => {
  try {
    requireServiceAuth(request);
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return new Response(JSON.stringify({ error: 'El cuerpo de la solicitud es inválido.' }), {
        status: 400,
        headers: JSON_HEADERS,
      });
    }

    const professionalId = typeof body.professionalId === 'string' ? body.professionalId : null;
    if (!professionalId) {
      return new Response(JSON.stringify({ error: 'Debés indicar professionalId.' }), {
        status: 400,
        headers: JSON_HEADERS,
      });
    }

    const payload = 'payload' in body ? body.payload : null;
    const { key, metadata } = await ensureProfessionalKey(professionalId);
    const encrypted = await encryptPayloadWithProfessionalKey(key, payload);

    return new Response(JSON.stringify({ ...encrypted, version: metadata.version }), {
      status: 200,
      headers: JSON_HEADERS,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return new Response(JSON.stringify({ error: error.message }), { status: 401, headers: JSON_HEADERS });
    }

    console.error('Error al cifrar datos clínicos', error);
    return new Response(JSON.stringify({ error: 'No pudimos cifrar los datos solicitados.' }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
});
