'use client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PatientService } from '@/services/patient.service';

const initialState = {
  name: '',
  lastName: '',
  dni: '',
  email: '',
  phone: '',
  address: '',
  healthInsurance: 'Particular',
  affiliateNumber: '',
};

export default function NewPatientPage() {
  const router = useRouter();
  const [formData, setFormData] = useState(initialState);
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await PatientService.create({ ...formData, status });
      if (response?.patient?.id) {
        router.push(`/patients/${response.patient.id}`);
      } else {
        throw new Error(response?.error ?? 'No pudimos crear el paciente');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Nuevo paciente</h1>
          <p className="text-sm text-slate-300">Completá la información para iniciar el seguimiento clínico.</p>
        </div>
        <Link href="/patients" className="text-sm text-cyan-200 hover:underline">
          ← Volver a pacientes
        </Link>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid gap-6 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-lg shadow-cyan-500/10"
      >
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm text-slate-300" htmlFor="name">
              Nombre
            </label>
            <input
              id="name"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-300" htmlFor="lastName">
              Apellido
            </label>
            <input
              id="lastName"
              name="lastName"
              required
              value={formData.lastName}
              onChange={handleChange}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-300" htmlFor="dni">
              DNI
            </label>
            <input
              id="dni"
              name="dni"
              required
              value={formData.dni}
              onChange={handleChange}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-300" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={formData.email}
              onChange={handleChange}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-300" htmlFor="phone">
              Teléfono
            </label>
            <input
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-300" htmlFor="address">
              Dirección
            </label>
            <input
              id="address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-300" htmlFor="healthInsurance">
              Cobertura médica
            </label>
            <input
              id="healthInsurance"
              name="healthInsurance"
              value={formData.healthInsurance}
              onChange={handleChange}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-300" htmlFor="affiliateNumber">
              Número de afiliado
            </label>
            <input
              id="affiliateNumber"
              name="affiliateNumber"
              value={formData.affiliateNumber}
              onChange={handleChange}
              placeholder="Ej: 12345678/90"
              className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-300" htmlFor="status">
              Estado del paciente
            </label>
            <select
              id="status"
              value={status}
              onChange={(event) => setStatus(event.target.value as 'active' | 'inactive')}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
            >
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </select>
          </div>
        </div>

        {error && (
          <p className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-full border border-white/10 px-6 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-100/60"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-cyan-500 px-6 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Guardando...' : 'Guardar paciente'}
          </button>
        </div>
      </form>
    </section>
  );
}