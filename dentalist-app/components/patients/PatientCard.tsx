interface PatientCardProps {
  patient: {
    id: string;
    name: string;
    dni: string;
    email: string;
  };
}

export default function PatientCard({ patient }: PatientCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="font-bold text-lg">{patient.name}</h3>
      <p className="text-gray-600">DNI: {patient.dni}</p>
      <p className="text-gray-600">Email: {patient.email}</p>
    </div>
  );
}