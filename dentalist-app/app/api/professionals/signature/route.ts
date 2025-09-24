import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { getProfessionalSignature, saveProfessionalSignature } from '@/lib/db/supabase-repository';
import { parseSignatureDataUrl } from '@/lib/utils/signature';

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const signature = await getProfessionalSignature(user.id, { signedUrlExpiresIn: 3600 });
    return NextResponse.json({
      hasSignature: Boolean(signature),
      signatureUrl: signature?.signedUrl ?? null,
      updatedAt: signature?.updated_at ?? null,
    });
  } catch (error) {
    console.error('Error al obtener la firma del profesional', error);
    return NextResponse.json(
      { error: 'No pudimos obtener la firma digital' },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { signatureDataUrl?: string };

    if (!body?.signatureDataUrl) {
      return NextResponse.json({ error: 'Falta la firma a guardar' }, { status: 400 });
    }

    const parsed = parseSignatureDataUrl(body.signatureDataUrl);
    await saveProfessionalSignature(user.id, { buffer: parsed.buffer, mimeType: parsed.mimeType });

    const signature = await getProfessionalSignature(user.id, { signedUrlExpiresIn: 3600 });

    return NextResponse.json({
      success: true,
      hasSignature: Boolean(signature),
      signatureUrl: signature?.signedUrl ?? null,
      updatedAt: signature?.updated_at ?? null,
    });
  } catch (error) {
    console.error('Error al guardar la firma del profesional', error);
    return NextResponse.json(
      { error: 'No pudimos actualizar la firma digital' },
      { status: 500 },
    );
  }
}
