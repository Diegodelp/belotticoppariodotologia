import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import {
  deleteProfessionalLogo,
  getProfessionalLogo,
  saveProfessionalLogo,
} from '@/lib/db/supabase-repository';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  if (user.type !== 'profesional') {
    return NextResponse.json({ error: 'Solo disponible para profesionales' }, { status: 403 });
  }

  try {
    const logo = await getProfessionalLogo(user.id, { signedUrlExpiresIn: 3600 });
    return NextResponse.json({
      hasLogo: Boolean(logo?.storagePath),
      logoUrl: logo?.signedUrl ?? null,
      updatedAt: logo?.updatedAt ?? null,
    });
  } catch (error) {
    console.error('Error al obtener el logo del profesional', error);
    return NextResponse.json({ error: 'No pudimos obtener el logo.' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  if (user.type !== 'profesional') {
    return NextResponse.json({ error: 'Solo disponible para profesionales' }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Falta el archivo del logo' }, { status: 400 });
    }

    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'El logo no puede superar los 2MB.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const saved = await saveProfessionalLogo(user.id, { buffer, mimeType: file.type });

    return NextResponse.json({ success: true, logoUrl: saved.signedUrl });
  } catch (error) {
    console.error('Error al guardar el logo del profesional', error);
    return NextResponse.json({ error: 'No pudimos actualizar el logo.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  if (user.type !== 'profesional') {
    return NextResponse.json({ error: 'Solo disponible para profesionales' }, { status: 403 });
  }

  try {
    await deleteProfessionalLogo(user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar el logo del profesional', error);
    return NextResponse.json({ error: 'No pudimos eliminar el logo.' }, { status: 500 });
  }
}
