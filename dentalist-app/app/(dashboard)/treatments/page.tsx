'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Treatment, Patient } from '@/types';

interface TreatmentWithPatient extends Treatment {
  patient?: Patient;
}

export default function TreatmentsPage() {
  const [treatments, setTreatments] = useState<TreatmentWithPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const fetchTreatments = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/treatments');
        const data = await response.json();
        setTreatments(data);
      } finally {
        setLoading(false);
      }
    };
    fetchTreatments();
  }, []);

  const filteredTreatments = useMemo(() => {
    const search = filter.trim().toLowerCase();
    if (!search) return treatments;
    return treatments.filter((treatment) =>
      `${treatment.type} ${treatment.description}`.toLowerCase().includes(search),
    );
  }, [filter, treatments]);

  const totalRevenue = filteredTreatments.reduce((acc, treatment) => acc + treatment.cost, 0);

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Tratamientos</h1>
          <p className="text-sm text-slate-300">
            Monitor de procedimientos y costos por paciente.
          </p>
        </div>
        <Link
          href="/patients"
          className="rounded-full border border-white/10 px-5 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-300 hover:text-cyan-200"
        >
          Ver pacientes
        </Link>
      </div>

      <div className="grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-cyan-500/10">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <input
            type="search"
            placeholder="Buscar tratamiento o descripción"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="w-full rounded-full border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/40 md:w-96"
          />
          <div className="rounded-full border border-white/10 bg-slate-900/60 px-5 py-2 text-xs text-slate-200">
            Facturación estimada: {totalRevenue.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
          </div>
        </div>

        {loading && <p className="text-sm text-slate-300">Cargando tratamientos...</p>}

        <div className="overflow-hidden rounded-2xl border border-white/10">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm text-slate-200">
            <thead className="bg-slate-900/70 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-3">Fecha</th>
                <th className="px-6 py-3">Paciente</th>
                <th className="px-6 py-3">Tratamiento</th>
                <th className="px-6 py-3">Descripción</th>
                <th className="px-6 py-3 text-right">Costo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredTreatments.map((treatment) => (
                <tr key={treatment.id} className="bg-slate-900/50">
                  <td className="px-6 py-4 text-slate-300">{treatment.date}</td>
                  <td className="px-6 py-4 text-slate-200">
                    {treatment.patient?.name} {treatment.patient?.lastName}
                  </td>
                  <td className="px-6 py-4 text-white">{treatment.type}</td>
                  <td className="px-6 py-4 text-slate-300">{treatment.description}</td>
                  <td className="px-6 py-4 text-right text-emerald-300">
                    {treatment.cost.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                  </td>
                </tr>
              ))}
              {!loading && filteredTreatments.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-slate-300">
                    No encontramos tratamientos con los criterios seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}