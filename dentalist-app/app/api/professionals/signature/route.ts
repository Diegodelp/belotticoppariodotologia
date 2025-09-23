import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { getProfessionalSignature } from '@/lib/db/supabase-repository';

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
