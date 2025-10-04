import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { rotateProfessionalKey, requireServiceAuth, UnauthorizedError } from '../_shared/encryption.ts';

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

    const metadata = await rotateProfessionalKey(professionalId);
    return new Response(JSON.stringify({ status: metadata }), { status: 200, headers: JSON_HEADERS });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return new Response(JSON.stringify({ error: error.message }), { status: 401, headers: JSON_HEADERS });
    }

    console.error('Error al rotar la clave del profesional', error);
    return new Response(JSON.stringify({ error: 'No pudimos rotar la clave maestra.' }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
});
