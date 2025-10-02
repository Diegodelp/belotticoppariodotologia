import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import {
  ensureProfessionalKey,
  decryptPayloadWithProfessionalKey,
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
    const ciphertext = typeof body.ciphertext === 'string' ? body.ciphertext : null;
    const iv = typeof body.iv === 'string' ? body.iv : null;
    const version = typeof body.version === 'number' ? body.version : null;

    if (!professionalId || !ciphertext || !iv || version === null) {
      return new Response(
        JSON.stringify({ error: 'Debés enviar professionalId, ciphertext, iv y version para descifrar.' }),
        { status: 400, headers: JSON_HEADERS },
      );
    }

    const { key, metadata } = await ensureProfessionalKey(professionalId);
    if (version !== metadata.version) {
      return new Response(
        JSON.stringify({
          error: `La versión ${version} no coincide con la clave activa (${metadata.version}). Recifrá el dato antes de leerlo.`,
        }),
        { status: 409, headers: JSON_HEADERS },
      );
    }

    const payload = await decryptPayloadWithProfessionalKey(key, ciphertext, iv);
    return new Response(JSON.stringify({ payload, version: metadata.version }), {
      status: 200,
      headers: JSON_HEADERS,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return new Response(JSON.stringify({ error: error.message }), { status: 401, headers: JSON_HEADERS });
    }

    console.error('Error al descifrar datos clínicos', error);
    return new Response(JSON.stringify({ error: 'No pudimos descifrar los datos solicitados.' }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
});
