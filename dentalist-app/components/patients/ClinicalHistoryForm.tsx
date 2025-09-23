'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  CephalometricValues,
  ClinicalHistory,
  ClinicalHistoryInput,
  ClinicalStage,
} from '@/types';
import { ClinicalHistory, ClinicalHistoryInput, ClinicalStage } from '@/types';
const STAGES: Array<{ key: ClinicalStage; label: string; description: string }> = [
  {
    key: 'baseline',
    label: 'Parámetros diagnósticos',
    description: 'Valores iniciales obtenidos antes de comenzar el plan clínico.',
  },
  {
    key: 'initial',
    label: 'Inicio del tratamiento',
    description: 'Registro al momento de colocar aparatología o iniciar terapéutica.',
  },
  {
    key: 'intermediate',
    label: 'Controles intermedios',
    description: 'Valores medidos durante los controles de progreso.',
  },
  {
    key: 'final',
    label: 'Resultados finales',
    description: 'Datos posteriores al alta o finalización del tratamiento.',
  },
];

type CephalometricField = keyof CephalometricValues;

const FIELDS: Array<{ key: CephalometricField; label: string }> = [
type CephalometricField = keyof CephalometricValues;
const FIELDS: Array<{ key: CephalometricField; label: string }> = [
type CephalometricField = keyof CephalometricValues;
const FIELDS: Array<{ key: CephalometricField; label: string }> = [
const FIELDS: Array<{ key: keyof ClinicalHistoryInput['stages'][ClinicalStage]; label: string } & {
  key: 'biotipo' | 'patronEsqueletal' | 'sna' | 'snb' | 'anb' | 'naMm' | 'naAngle' | 'nbMm' | 'nbAngle' | 'planoMandibular';
}> = [

  { key: 'biotipo', label: 'Biotipo' },
  { key: 'patronEsqueletal', label: 'Patrón esqueletal' },
  { key: 'sna', label: 'SNA' },
  { key: 'snb', label: 'SNB' },
  { key: 'anb', label: 'ANB' },
  { key: 'naMm', label: 'NA (mm)' },
  { key: 'naAngle', label: 'NA (°)' },
  { key: 'nbMm', label: 'NB (mm)' },
  { key: 'nbAngle', label: 'NB (°)' },
  { key: 'planoMandibular', label: 'Plano mandibular' },
];

function buildEmptyStages(): ClinicalHistoryInput['stages'] {
  return STAGES.reduce<ClinicalHistoryInput['stages']>((acc, { key }) => {
    acc[key] = {};
    return acc;
  }, {} as ClinicalHistoryInput['stages']);
}

interface ClinicalHistoryFormProps {
  history: ClinicalHistory | null;
  onSubmit: (data: ClinicalHistoryInput) => Promise<void>;
  loading?: boolean;
}

export function ClinicalHistoryForm({ history, onSubmit, loading = false }: ClinicalHistoryFormProps) {
  const [summary, setSummary] = useState(history?.summary ?? '');
  const [stages, setStages] = useState<ClinicalHistoryInput['stages']>(() => {
    const initial = buildEmptyStages();
    if (!history) {
      return initial;
    }
    for (const stage of STAGES) {
      const values = history.stages?.[stage.key];
      if (values) {
        initial[stage.key] = {
          biotipo: values.biotipo ?? '',
          patronEsqueletal: values.patronEsqueletal ?? '',
          sna: values.sna ?? '',
          snb: values.snb ?? '',
          anb: values.anb ?? '',
          naMm: values.naMm ?? '',
          naAngle: values.naAngle ?? '',
          nbMm: values.nbMm ?? '',
          nbAngle: values.nbAngle ?? '',
          planoMandibular: values.planoMandibular ?? '',
        };
      }
    }
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSummary(history?.summary ?? '');
    const nextStages = buildEmptyStages();
    if (history?.stages) {
      for (const stage of STAGES) {
        const values = history.stages[stage.key];
        if (values) {
          nextStages[stage.key] = {
            biotipo: values.biotipo ?? '',
            patronEsqueletal: values.patronEsqueletal ?? '',
            sna: values.sna ?? '',
            snb: values.snb ?? '',
            anb: values.anb ?? '',
            naMm: values.naMm ?? '',
            naAngle: values.naAngle ?? '',
            nbMm: values.nbMm ?? '',
            nbAngle: values.nbAngle ?? '',
            planoMandibular: values.planoMandibular ?? '',
          };
        }
      }
    }
    setStages(nextStages);
  }, [history]);

  const lastUpdated = useMemo(() => {
    if (!history?.updatedAt) {
      return null;
    }
    const date = new Date(history.updatedAt);
    return date.toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [history?.updatedAt]);

  const handleStageChange = (
    stage: ClinicalStage,
    field: CephalometricField,
    field: CephalometricField,
    field: CephalometricField,
    field: keyof ClinicalHistoryInput['stages'][ClinicalStage],
    value: string,
  ) => {
    setStages((prev) => ({
      ...prev,
      [stage]: {
        ...(prev[stage] ?? {}),
        [field]: value,
      },
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);
    setError(null);
    try {
      await onSubmit({
        summary,
        stages,
      });
      setFeedback('Historia clínica actualizada correctamente.');
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'No pudimos guardar la historia clínica.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSummary(history?.summary ?? '');
    const nextStages = buildEmptyStages();
    if (history?.stages) {
      for (const stage of STAGES) {
        const values = history.stages[stage.key];
        if (values) {
          nextStages[stage.key] = {
            biotipo: values.biotipo ?? '',
            patronEsqueletal: values.patronEsqueletal ?? '',
            sna: values.sna ?? '',
            snb: values.snb ?? '',
            anb: values.anb ?? '',
            naMm: values.naMm ?? '',
            naAngle: values.naAngle ?? '',
            nbMm: values.nbMm ?? '',
            nbAngle: values.nbAngle ?? '',
            planoMandibular: values.planoMandibular ?? '',
          };
        }
      }
    }
    setStages(nextStages);
    setFeedback(null);
    setError(null);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-3xl border border-white/10 bg-slate-900/40 p-6 shadow-inner shadow-cyan-500/10"
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Historia clínica</h2>
          <p className="text-sm text-slate-300">
            Registrá la evolución cefalométrica y observaciones relevantes de este paciente.
          </p>
        </div>
        {lastUpdated && <span className="text-xs text-slate-400">Actualizada: {lastUpdated}</span>}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-200" htmlFor="history-summary">
          Resumen clínico
        </label>
        <textarea
          id="history-summary"
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          rows={4}
          placeholder="Observaciones generales, diagnósticos diferenciales, antecedentes, etc."
          className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
        />
      </div>

      <div className="grid gap-6">
        {STAGES.map((stage) => (
          <section
            key={stage.key}
            className="space-y-4 rounded-2xl border border-white/5 bg-white/5 p-4 shadow-sm shadow-cyan-500/5"
          >
            <div>
              <h3 className="text-lg font-semibold text-white">{stage.label}</h3>
              <p className="text-xs text-slate-300">{stage.description}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {FIELDS.map((field) => (
                <div key={`${stage.key}-${field.key}`} className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {field.label}
                  </label>
                  <input
                    value={(stages[stage.key]?.[field.key] as string) ?? ''}
                    onChange={(event) => handleStageChange(stage.key, field.key, event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                    placeholder="-"
                  />
                </div>
              ))}
            </div>
          </section>
        ))}
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
          onClick={handleReset}
          className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-white/40"
        >
          Restablecer valores
        </button>
        <button
          type="submit"
          disabled={saving || loading}
          className="rounded-full bg-cyan-500 px-5 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'Guardando...' : 'Guardar historia clínica'}
        </button>
      </div>
    </form>
  );
}
