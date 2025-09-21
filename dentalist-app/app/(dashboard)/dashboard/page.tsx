'use client';
import { useEffect, useState } from 'react';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    patients: 0,
    appointments: 0,
    revenue: 0,
    treatments: 0
  });

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-gray-500 text-sm">Pacientes Activos</h3>
          <p className="text-2xl font-bold">{stats.patients}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-gray-500 text-sm">Turnos Hoy</h3>
          <p className="text-2xl font-bold">{stats.appointments}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-gray-500 text-sm">Ingresos del Mes</h3>
          <p className="text-2xl font-bold">${stats.revenue}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-gray-500 text-sm">Tratamientos</h3>
          <p className="text-2xl font-bold">{stats.treatments}</p>
        </div>
      </div>
    </div>
  );
}