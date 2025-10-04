'use client';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PatientService } from '@/services/patient.service';
import { TeamService } from '@/services/team.service';
import { useAuth } from '@/hooks/useAuth';
import { Clinic, Patient } from '@/types';

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
  const { user } = useAuth();
  const [formData, setFormData] = useState(initialState);
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [clinicsLoading, setClinicsLoading] = useState(false);
  const [clinicId, setClinicId] = useState('');

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const isProfessional = user?.type === 'profesional';
  const isTeamMember = Boolean(user?.ownerProfessionalId);
  const isTeamAdmin = isTeamMember && user?.teamRole === 'admin';
  const canChooseClinic = isProfessional && (!isTeamMember || isTeamAdmin);

  useEffect(() => {
    let active = true;

    if (!isProfessional) {
      setClinics([]);
      setClinicId('');
      return () => {
        active = false;
      };
    }

    if (!canChooseClinic) {
      setClinics([]);
      setClinicId(user?.teamClinicId ?? '');
      return () => {
        active = false;
      };
    }

    const fetchClinics = async () => {
      try {
        setClinicsLoading(true);
        const overview = await TeamService.getOverview();
        if (!active) return;
        setClinics(overview.clinics);
        setClinicId((prev) => {
          if (prev) return prev;
          return overview.clinics.length === 1 ? overview.clinics[0].id : '';
        });
      } catch (fetchError) {
        console.error('Error al cargar consultorios', fetchError);
        if (active) {
          setClinics([]);
        }
      } finally {
        if (active) {
          setClinicsLoading(false);
        }
      }
    };

    fetchClinics();

    return () => {
      active = false;
    };
  }, [isProfessional, canChooseClinic, user?.teamClinicId]);

  const missingClinicAssignment =
    isProfessional && isTeamMember && !isTeamAdmin && !user?.teamClinicId;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const payload: Partial<Patient> = { ...formData, status };

      if (isProfessional) {
        if (isTeamMember && !isTeamAdmin) {
          if (!user?.teamClinicId) {
            setError('No tenés un consultorio asignado. Pedile al administrador que te vincule a uno.');
            setLoading(false);
            return;
          }
          payload.clinicId = user.teamClinicId;
        } else if (clinicId) {
          payload.clinicId = clinicId;
        }
      }

      const response = await PatientService.create(payload);
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
          {isProfessional && (
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm text-slate-300" htmlFor="clinic">
                Consultorio asignado
              </label>
              {canChooseClinic ? (
                <select
                  id="clinic"
                  value={clinicId}
                  onChange={(event) => setClinicId(event.target.value)}
                  disabled={clinicsLoading}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
                >
                  <option value="">Sin consultorio</option>
                  {clinics.map((clinic) => (
                    <option key={clinic.id} value={clinic.id}>
                      {clinic.name}
                    </option>
                  ))}
                </select>
              ) : missingClinicAssignment ? (
                <p className="rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                  No tenés un consultorio asignado. Pedile al administrador que te vincule antes de cargar pacientes.
                </p>
              ) : (
                <p className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-slate-200">
                  El paciente se asignará automáticamente al consultorio que tenés asignado en el equipo.
                </p>
              )}
            </div>
          )}
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