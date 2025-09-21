'use client';
export default function PatientDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Detalle del Paciente</h1>
      <p>ID: {params.id}</p>
    </div>
  );
}