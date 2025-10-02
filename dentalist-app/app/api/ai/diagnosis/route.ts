import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { clinicalHistory } = await request.json();
  const patientName = clinicalHistory?.patientName ?? 'el paciente';
  const reportedSymptoms = Array.isArray(clinicalHistory?.symptoms)
    ? clinicalHistory.symptoms.join(', ')
    : clinicalHistory?.symptoms;

  return NextResponse.json({
    diagnosis: {
      summary:
        reportedSymptoms
          ? `Se detectaron signos compatibles con ${reportedSymptoms}. Se recomienda evaluar a ${patientName} con estudios complementarios.`
          : `No se recibieron síntomas detallados. Se sugiere realizar anamnesis ampliada para ${patientName}.`,
      recommendations: [
        'Confirmar con examen clínico intraoral',
        'Solicitar radiografía panorámica si corresponde',
        'Registrar evolución en la ficha clínica de Dentalist',
      ],
    },
  });
}