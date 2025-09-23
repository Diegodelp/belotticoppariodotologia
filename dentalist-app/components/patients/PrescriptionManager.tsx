'use client';

import Image from 'next/image';
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
}

export function PrescriptionManager({
  prescriptions,
  onCreate,
  hasSavedSignature = false,
  savedSignatureUrl = null,
}: PrescriptionManagerProps) {
  const [title, setTitle] = useState('Receta odontológica');
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
  const hasAutoSelectedSignature = useRef(false);

  useEffect(() => {
    if (hasSavedSignature && !hasAutoSelectedSignature.current) {
      setUseStoredSignature(true);
      setSaveSignature(false);
      hasAutoSelectedSignature.current = true;
    }

    if (!hasSavedSignature) {
      hasAutoSelectedSignature.current = false;
      setUseStoredSignature(false);
      setSaveSignature(true);
    }
  }, [hasSavedSignature]);

  const sortedPrescriptions = useMemo(
    () => [...prescriptions].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [prescriptions],
  );

  const resetForm = () => {
    setTitle('Receta odontológica');
    setDiagnosis('');
    setMedication('');
    setInstructions('');
    setNotes('');
    setSignatureDataUrl(null);
    setFeedback(null);
    setError(null);
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
              <div className="flex items-center gap-2 rounded-xl bg-slate-950/50 px-3 py-2 text-xs text-slate-200">
                <span className="block h-10 w-24 overflow-hidden rounded bg-white/80">
                  <Image
                    src={savedSignatureUrl}
                    alt="Firma guardada"
                    width={96}
                    height={40}
                    className="h-full w-full object-contain"
                  />
                </span>
                <span>Firma guardada disponible</span>
              </div>
            )}
          </div>
          {hasSavedSignature && (
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
            disabled={useStoredSignature}
            onChange={setSignatureDataUrl}
          />
          {!useStoredSignature && (
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
                  <div>
                    <h4 className="text-sm font-semibold text-white">{prescription.title}</h4>
                    <p className="text-xs text-slate-400">Emitida el {issued}</p>
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
    </div>
  );
}
