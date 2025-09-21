'use client';
export default function NewPatientPage() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Nuevo Paciente</h1>
      <form className="bg-white shadow rounded-lg p-6">
        <div className="grid grid-cols-2 gap-6">
          <input type="text" placeholder="Nombre" className="border rounded px-3 py-2" />
          <input type="text" placeholder="Apellido" className="border rounded px-3 py-2" />
          <input type="text" placeholder="DNI" className="border rounded px-3 py-2" />
          <input type="email" placeholder="Email" className="border rounded px-3 py-2" />
        </div>
        <button type="submit" className="mt-6 bg-blue-600 text-white px-4 py-2 rounded">
          Guardar
        </button>
      </form>
    </div>
  );
}