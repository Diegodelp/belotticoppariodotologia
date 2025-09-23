import Link from 'next/link';
import { Patient } from '@/types';

interface PatientCardProps {
  patient: Patient;
  onDelete?: (patient: Patient) => void;
  deleting?: boolean;
}

export default function PatientCard({ patient, onDelete, deleting }: PatientCardProps) {
}
export default function PatientCard({ patient, onDelete, deleting }: PatientCardProps) {
}
export default function PatientCard({ patient, onDelete, deleting }: PatientCardProps) {
}
export default function PatientCard({ patient, onDelete, deleting }: PatientCardProps) {
}
export default function PatientCard({ patient }: PatientCardProps) {
  const statusStyle =
    patient.status === 'active'
      ? 'bg-emerald-500/10 text-emerald-200 border-emerald-500/40'
      : 'bg-amber-500/10 text-amber-200 border-amber-400/40';

  return (
    <Link
      href={`/patients/${patient.id}`}
      className="group flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-900/60 p-5 text-slate-100 shadow-md shadow-slate-900/40 transition hover:border-cyan-300/70 hover:bg-slate-900/80"
    >
      <div className="flex items-start justify-between gap-3">
      <div className="flex items-start justify-between gap-3">
      <div className="flex items-start justify-between gap-3">
      <div className="flex items-start justify-between gap-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white group-hover:text-cyan-200">
            {patient.name} {patient.lastName}
          </h3>
          <p className="text-xs uppercase tracking-widest text-slate-400">
            DNI {patient.dni}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
          <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusStyle}`}>
            {patient.status === 'active' ? 'Activo' : 'Inactivo'}
          </span>
          {onDelete && (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onDelete(patient);
              }}
              disabled={deleting}
              className="rounded-full border border-rose-500/40 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-200 transition hover:border-rose-400 hover:bg-rose-500/20 hover:text-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deleting ? 'Eliminando…' : 'Eliminar'}
            </button>
          )}
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusStyle}`}>
          {patient.status === 'active' ? 'Activo' : 'Inactivo'}
        </span>
      </div>

      <div className="space-y-2 text-sm">
        <p className="text-slate-300">
          <span className="text-slate-400">Email:</span> {patient.email || 'Sin correo registrado'}
        </p>
        <p className="text-slate-300">
          <span className="text-slate-400">Teléfono:</span> {patient.phone || 'Sin teléfono'}
        </p>
        <p className="text-slate-300">
          <span className="text-slate-400">Cobertura:</span> {patient.healthInsurance || 'Particular'}
        </p>
      </div>

      <div className="flex items-center justify-between text-xs text-cyan-200">
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-cyan-300" />
          Ver ficha completa
        </span>
        <span className="opacity-0 transition group-hover:opacity-100">→</span>
      </div>
    </Link>
  );
}