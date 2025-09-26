'use client';

import Image from 'next/image';
import { Trash2 } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { CreatePrescriptionInput, Prescription } from '@/types';
import { SignaturePad } from '@/components/patients/SignaturePad';

interface PrescriptionManagerProps {
  prescriptions: Prescription[];
  onCreate: (data: CreatePrescriptionInput) => Promise<{
    success: boolean;
    prescription?: Prescription;
    error?: string;
  }>;
  hasSavedSignature?: boolean;
  savedSignatureUrl?: string | null;
  onDelete: (prescriptionId: string) => Promise<{
    success: boolean;
    error?: string;
  }>;
  onUpdateSignature: (signatureDataUrl: string) => Promise<{
    success: boolean;
    signatureUrl?: string | null;
    error?: string;
  }>;
  showHistory?: boolean;
}

export function PrescriptionManager({
  prescriptions,
  onCreate,
  hasSavedSignature = false,
  savedSignatureUrl = null,
  onDelete,
  onUpdateSignature,
  showHistory = true,
}: PrescriptionManagerProps) {
  const [title, setTitle] = useState('Receta digital');
  const [diagnosis, setDiagnosis] = useState('');
  const [medication, setMedication] = useState('');
  const [instructions, setInstructions] = useState('');
  const [notes, setNotes] = useState('');
  const [useStoredSignature, setUseStoredSignature] = useState(hasSavedSignature);
  const [saveSignature, setSaveSignature] = useState(!hasSavedSignature);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEditingStoredSignature, setIsEditingStoredSignature] = useState(false);
  const [updatingSignature, setUpdatingSignature] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const hasAutoSelectedSignature = useRef(false);

  useEffect(() => {
    if (isEditingStoredSignature) {
      return;
    }

    if (hasSavedSignature && !hasAutoSelectedSignature.current) {
      setUseStoredSignature(true);
      setSaveSignature(false);
      hasAutoSelectedSignature.current = true;
    }

    if (!hasSavedSignature) {
      hasAutoSelectedSignature.current = false;
      setUseStoredSignature(false);
      setSaveSignature(true);
      setIsEditingStoredSignature(false);
    }
  }, [hasSavedSignature, isEditingStoredSignature]);

  const sortedPrescriptions = useMemo(
    () => [...prescriptions].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [prescriptions],
  );

  const resetForm = () => {
    setTitle('Receta digital');
    setDiagnosis('');
    setMedication('');
    setInstructions('');
    setNotes('');
    setSignatureDataUrl(null);
    setFeedback(null);
    setError(null);
    setIsEditingStoredSignature(false);
    if (hasSavedSignature) {
      setUseStoredSignature(true);
      setSaveSignature(false);
    } else {
      setUseStoredSignature(false);
      setSaveSignature(true);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);
    setError(null);

    if (!useStoredSignature && !signatureDataUrl) {
      setError('Necesitás dibujar la firma digital para emitir la receta.');
      return;
    }

    if (!title.trim() || !medication.trim() || !instructions.trim()) {
      setError('Completá título, medicación e indicaciones antes de guardar.');
      return;
    }

    const payload: CreatePrescriptionInput = {
      title: title.trim(),
      diagnosis: diagnosis.trim() || undefined,
      medication: medication.trim(),
      instructions: instructions.trim(),
      notes: notes.trim() || undefined,
      useStoredSignature,
      saveSignature: !useStoredSignature && saveSignature,
      signatureDataUrl: useStoredSignature ? undefined : signatureDataUrl,
    };

    setSubmitting(true);

    try {
      const result = await onCreate(payload);
      if (!result.success) {
        throw new Error(result.error ?? 'No pudimos emitir la receta.');
      }
      resetForm();
      setFeedback('Receta generada y guardada correctamente.');
      if (!useStoredSignature) {
        setSaveSignature(true);
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Ocurrió un error inesperado al emitir la receta.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartSignatureUpdate = () => {
    setFeedback(null);
    setError(null);
    setIsEditingStoredSignature(true);
    setUseStoredSignature(false);
    setSaveSignature(true);
    setSignatureDataUrl(null);
  };

  const handleCancelSignatureUpdate = () => {
    setIsEditingStoredSignature(false);
    setSignatureDataUrl(null);
    setFeedback(null);
    setError(null);
    if (hasSavedSignature) {
      setUseStoredSignature(true);
      setSaveSignature(false);
    } else {
      setUseStoredSignature(false);
      setSaveSignature(true);
    }
  };

  const handleSignatureUpdate = async () => {
    if (!signatureDataUrl) {
      setError('Dibujá la nueva firma antes de guardarla.');
      return;
    }

    setError(null);
    setFeedback(null);
    setUpdatingSignature(true);

    try {
      const result = await onUpdateSignature(signatureDataUrl);
      if (!result.success) {
        throw new Error(result.error ?? 'No pudimos actualizar la firma digital.');
      }

      hasAutoSelectedSignature.current = false;
      setFeedback('Firma digital actualizada correctamente.');
      setIsEditingStoredSignature(false);
      setSignatureDataUrl(null);
      setUseStoredSignature(true);
      setSaveSignature(false);
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : 'Ocurrió un error inesperado al actualizar la firma.',
      );
    } finally {
      setUpdatingSignature(false);
    }
  };

  const handleDeletePrescription = async (prescriptionId: string) => {
    const confirmation = window.confirm('¿Seguro que querés eliminar esta receta?');
    if (!confirmation) {
      return;
    }

    setFeedback(null);
    setError(null);
    setDeletingId(prescriptionId);

    try {
      const result = await onDelete(prescriptionId);
      if (!result.success) {
        throw new Error(result.error ?? 'No pudimos eliminar la receta.');
      }
      setFeedback('Receta eliminada correctamente.');
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Ocurrió un error inesperado al eliminar la receta.',
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-3xl border border-white/10 bg-slate-900/40 p-6 shadow-inner shadow-cyan-500/10"
      >
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Recetas digitales</h2>
            <p className="text-sm text-slate-300">
              Generá recetas con firma digital y guardalas automáticamente en la historia del paciente.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm text-slate-300" htmlFor="prescription-title">
              Título del documento
            </label>
            <input
              id="prescription-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-300" htmlFor="prescription-diagnosis">
              Diagnóstico
            </label>
            <input
              id="prescription-diagnosis"
              value={diagnosis}
              onChange={(event) => setDiagnosis(event.target.value)}
              placeholder="Opcional"
              className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-slate-300" htmlFor="prescription-medication">
            Medicación / tratamiento indicado
          </label>
          <textarea
            id="prescription-medication"
            value={medication}
            onChange={(event) => setMedication(event.target.value)}
            rows={4}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-slate-300" htmlFor="prescription-instructions">
            Indicaciones al paciente
          </label>
          <textarea
            id="prescription-instructions"
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            rows={4}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-slate-300" htmlFor="prescription-notes">
            Notas adicionales
          </label>
          <textarea
            id="prescription-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            placeholder="Observaciones internas o consideraciones especiales"
            className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
          />
        </div>

        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-white/15 bg-white/5 p-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-white">Firma digital</p>
              <p className="text-xs text-slate-300">
                Dibujá la firma o seleccioná la guardada para insertarla automáticamente en la receta.
              </p>
            </div>
            {hasSavedSignature && savedSignatureUrl && (
              <div className="flex flex-col items-start gap-2 md:items-end">
                <span className="block h-12 w-28 overflow-hidden rounded-xl border border-white/10 bg-white/80">
                  <Image
                    src={savedSignatureUrl}
                    alt="Firma guardada"
                    width={112}
                    height={48}
                    className="h-full w-full object-contain"
                    unoptimized
                  />
                </span>
                <div className="flex flex-wrap gap-2 text-xs text-slate-200">
                  <span className="rounded-full bg-slate-950/60 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-slate-200/80">
                    Firma guardada disponible
                  </span>
                  {!isEditingStoredSignature && (
                    <button
                      type="button"
                      onClick={handleStartSignatureUpdate}
                      className="rounded-full border border-white/15 px-3 py-1 text-[11px] font-semibold text-slate-100 transition hover:border-cyan-200/60 hover:text-cyan-100"
                    >
                      Actualizar firma
                    </button>
                  )}
                  {isEditingStoredSignature && (
                    <button
                      type="button"
                      onClick={handleCancelSignatureUpdate}
                      className="rounded-full border border-white/15 px-3 py-1 text-[11px] font-semibold text-slate-100 transition hover:border-rose-300/60 hover:text-rose-100"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          {hasSavedSignature && !isEditingStoredSignature && (
            <label className="flex items-center gap-2 text-xs text-slate-200">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-white/20 bg-slate-950/40"
                checked={useStoredSignature}
                onChange={(event) => {
                  setUseStoredSignature(event.target.checked);
                  if (event.target.checked) {
                    setSignatureDataUrl(null);
                  }
                }}
              />
              Usar la firma guardada para esta receta
            </label>
          )}
          <SignaturePad
            value={useStoredSignature ? savedSignatureUrl ?? null : signatureDataUrl}
            disabled={useStoredSignature && !isEditingStoredSignature}
            onChange={setSignatureDataUrl}
          />
          {isEditingStoredSignature && (
            <div className="flex flex-col gap-3 rounded-2xl border border-amber-300/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-100 md:flex-row md:items-center md:justify-between">
              <p>La nueva firma reemplazará a la guardada para futuras recetas.</p>
              <button
                type="button"
                onClick={handleSignatureUpdate}
                disabled={updatingSignature || !signatureDataUrl}
                className="inline-flex items-center justify-center rounded-full bg-amber-400 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {updatingSignature ? 'Guardando...' : 'Guardar nueva firma'}
              </button>
            </div>
          )}
          {!useStoredSignature && !isEditingStoredSignature && (
            <label className="flex items-center gap-2 text-xs text-slate-200">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-white/20 bg-slate-950/40"
                checked={saveSignature}
                onChange={(event) => setSaveSignature(event.target.checked)}
              />
              Guardar esta firma para reutilizarla en próximas recetas
            </label>
          )}
        </div>

        {feedback && (
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {feedback}
          </div>
        )}
        {error && (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={resetForm}
            className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-white/40"
          >
            Limpiar formulario
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-cyan-500 px-6 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Generando...' : 'Emitir receta'}
          </button>
        </div>
      </form>

      {showHistory && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Recetas emitidas</h3>
            <span className="text-xs text-slate-400">{sortedPrescriptions.length} documento(s)</span>
          </div>
          {sortedPrescriptions.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-sm text-slate-300">
              Todavía no emitiste recetas para este paciente.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {sortedPrescriptions.map((prescription) => {
                const issued = new Date(prescription.createdAt).toLocaleString('es-AR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });
                return (
                  <article
                    key={prescription.id}
                    className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm shadow-cyan-500/5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-semibold text-white">{prescription.title}</h4>
                        <p className="text-xs text-slate-400">Emitida el {issued}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeletePrescription(prescription.id)}
                        disabled={deletingId === prescription.id}
                        title="Eliminar receta"
                        aria-label="Eliminar receta"
                        className="rounded-full border border-white/10 p-1.5 text-slate-200 transition hover:border-rose-300/60 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="text-xs text-slate-200 line-clamp-2">
                      {prescription.instructions || 'Sin indicaciones registradas'}
                    </p>
                    <a
                      href={prescription.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-cyan-200 transition hover:border-cyan-200/60 hover:text-cyan-100"
                    >
                      Descargar PDF
                    </a>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
