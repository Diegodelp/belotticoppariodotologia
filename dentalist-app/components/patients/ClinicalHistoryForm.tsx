'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  CephalometricField,
  ClinicalHistory,
  ClinicalHistoryInput,
  ClinicalStage,
  OdontogramCondition,
} from '@/types';

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

const FIELDS: Array<{ key: CephalometricField; label: string }> = [
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

type MedicalBackgroundState = {
  personalHistory: string;
  systemicConditions: string;
  medications: string;
  surgicalHistory: string;
  notes: string;
};

const MEDICAL_FIELDS: Array<{
  key: keyof MedicalBackgroundState;
  label: string;
  placeholder: string;
}> = [
  {
    key: 'personalHistory',
    label: 'Antecedentes personales',
    placeholder: 'Enfermedades previas, antecedentes odontológicos, hábitos, etc.',
  },
  {
    key: 'systemicConditions',
    label: 'Enfermedades sistémicas',
    placeholder: 'Diabetes, cardiopatías, hipertensión, trastornos de coagulación, etc.',
  },
  {
    key: 'medications',
    label: 'Medicación actual',
    placeholder: 'Detalle medicamentos, dosis y frecuencia.',
  },
  {
    key: 'surgicalHistory',
    label: 'Antecedentes quirúrgicos',
    placeholder: 'Cirugías previas, complicaciones anestésicas, internaciones, etc.',
  },
  {
    key: 'notes',
    label: 'Notas médicas adicionales',
    placeholder: 'Observaciones relevantes para la planificación y seguimiento clínico.',
  },
];

type FamilyHistoryState = {
  father: string;
  mother: string;
  siblings: string;
  others: string;
};

const FAMILY_FIELDS: Array<{ key: keyof FamilyHistoryState; label: string; placeholder: string }> = [
  {
    key: 'father',
    label: 'Padre',
    placeholder: 'Patologías o antecedentes relevantes del padre.',
  },
  {
    key: 'mother',
    label: 'Madre',
    placeholder: 'Patologías o antecedentes relevantes de la madre.',
  },
  {
    key: 'siblings',
    label: 'Hermanos',
    placeholder: 'Patologías compartidas o antecedentes entre hermanos.',
  },
  {
    key: 'others',
    label: 'Otros antecedentes familiares',
    placeholder: 'Abuelos, tíos u otros antecedentes hereditarios relevantes.',
  },
];

type OdontogramState = NonNullable<ClinicalHistoryInput['odontogram']>;

const ODONTOGRAM_STATUS: Array<{ key: OdontogramCondition; label: string }> = [
  { key: 'caries', label: 'Caries' },
  { key: 'extraction', label: 'Exodoncia' },
  { key: 'sealant', label: 'Sellador' },
  { key: 'crown', label: 'Corona' },
  { key: 'endodontic', label: 'Endodoncia' },
];

const ODONTOGRAM_QUADRANTS: Array<{ label: string; teeth: string[] }> = [
  {
    label: 'Cuadrante superior derecho',
    teeth: ['18', '17', '16', '15', '14', '13', '12', '11'],
  },
  {
    label: 'Cuadrante superior izquierdo',
    teeth: ['21', '22', '23', '24', '25', '26', '27', '28'],
  },
  {
    label: 'Cuadrante inferior derecho',
    teeth: ['48', '47', '46', '45', '44', '43', '42', '41'],
  },
  {
    label: 'Cuadrante inferior izquierdo',
    teeth: ['31', '32', '33', '34', '35', '36', '37', '38'],
  },
];

function cloneOdontogram(
  source?: ClinicalHistory['odontogram'] | ClinicalHistoryInput['odontogram'] | null,
): OdontogramState {
  if (!source) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(source).map(([tooth, state]) => [tooth, { ...(state ?? {}) }]),
  ) as OdontogramState;
}

function stageHasValues(stage: ClinicalStage, values: ClinicalHistoryInput['stages']): boolean {
  const stageValues = values[stage];
  if (!stageValues) {
    return false;
  }

  return Object.values(stageValues).some((value) => typeof value === 'string' && value.trim().length > 0);
}

function stageHasValuesInHistory(stage: ClinicalStage, history: ClinicalHistory | null): boolean {
  const stageValues = history?.stages?.[stage];
  if (!stageValues) {
    return false;
  }

  return Object.values(stageValues).some((value) => typeof value === 'string' && value.trim().length > 0);
}

function buildMedicalBackgroundState(
  source?: ClinicalHistory['medicalBackground'] | ClinicalHistoryInput['medicalBackground'],
): MedicalBackgroundState {
  return {
    personalHistory: source?.personalHistory ?? '',
    systemicConditions: source?.systemicConditions ?? '',
    medications: source?.medications ?? '',
    surgicalHistory: source?.surgicalHistory ?? '',
    notes: source?.notes ?? '',
  };
}

function buildFamilyHistoryState(
  source?: ClinicalHistory['familyHistory'] | ClinicalHistoryInput['familyHistory'],
): FamilyHistoryState {
  return {
    father: source?.father ?? '',
    mother: source?.mother ?? '',
    siblings: source?.siblings ?? '',
    others: source?.others ?? '',
  };
}

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
  const [reasonForConsultation, setReasonForConsultation] = useState(
    history?.reasonForConsultation ?? '',
  );
  const [medicalBackground, setMedicalBackground] = useState<MedicalBackgroundState>(() =>
    buildMedicalBackgroundState(history?.medicalBackground),
  );
  const [familyHistory, setFamilyHistory] = useState<FamilyHistoryState>(() =>
    buildFamilyHistoryState(history?.familyHistory),
  );
  const [allergies, setAllergies] = useState(history?.allergies ?? '');
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
  const [stageOpenState, setStageOpenState] = useState<Record<ClinicalStage, boolean>>(() =>
    STAGES.reduce<Record<ClinicalStage, boolean>>((accumulator, { key }) => {
      accumulator[key] = key === 'baseline' || stageHasValuesInHistory(key, history);
      return accumulator;
    }, {} as Record<ClinicalStage, boolean>),
  );
  const [odontogram, setOdontogram] = useState<OdontogramState>(() =>
    cloneOdontogram(history?.odontogram ?? null),
  );
  const [odontogramSectionsOpen, setOdontogramSectionsOpen] = useState<Record<string, boolean>>(() =>
    ODONTOGRAM_QUADRANTS.reduce<Record<string, boolean>>((accumulator, quadrant) => {
      accumulator[quadrant.label] = true;
      return accumulator;
    }, {} as Record<string, boolean>),
  );
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSummary(history?.summary ?? '');
    setReasonForConsultation(history?.reasonForConsultation ?? '');
    setMedicalBackground(buildMedicalBackgroundState(history?.medicalBackground));
    setFamilyHistory(buildFamilyHistoryState(history?.familyHistory));
    setAllergies(history?.allergies ?? '');
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
    setOdontogram(cloneOdontogram(history?.odontogram ?? null));
    setStageOpenState(
      STAGES.reduce<Record<ClinicalStage, boolean>>((accumulator, { key }) => {
        accumulator[key] = key === 'baseline' || stageHasValuesInHistory(key, history ?? null);
        return accumulator;
      }, {} as Record<ClinicalStage, boolean>),
    );
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

  const handleMedicalBackgroundChange = (
    field: keyof MedicalBackgroundState,
    value: string,
  ) => {
    setMedicalBackground((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleFamilyHistoryChange = (field: keyof FamilyHistoryState, value: string) => {
    setFamilyHistory((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const toggleOdontogramCondition = (tooth: string, condition: OdontogramCondition) => {
    setOdontogram((previous) => {
      const currentState = previous[tooth] ?? {};
      const isActive = Boolean(currentState[condition]);
      const nextToothState: Partial<Record<OdontogramCondition, boolean>> = { ...currentState };

      if (isActive) {
        delete nextToothState[condition];
      } else {
        nextToothState[condition] = true;
      }

      if (Object.keys(nextToothState).length === 0) {
        const rest = { ...previous } as OdontogramState;
        delete rest[tooth];
        return rest;
      }

      return {
        ...previous,
        [tooth]: nextToothState,
      };
    });
  };

  const clearOdontogram = () => {
    setOdontogram({});
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);
    setError(null);
    try {
      const hasMedicalBackground = Object.values(medicalBackground).some(
        (value) => value.trim().length > 0,
      );
      const hasFamilyHistory = Object.values(familyHistory).some(
        (value) => value.trim().length > 0,
      );
      const odontogramPayload = Object.keys(odontogram).length > 0 ? cloneOdontogram(odontogram) : undefined;
      await onSubmit({
        summary,
        reasonForConsultation,
        medicalBackground: hasMedicalBackground ? { ...medicalBackground } : undefined,
        familyHistory: hasFamilyHistory ? { ...familyHistory } : undefined,
        allergies,
        stages,
        odontogram: odontogramPayload,
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
    setReasonForConsultation(history?.reasonForConsultation ?? '');
    setMedicalBackground(buildMedicalBackgroundState(history?.medicalBackground));
    setFamilyHistory(buildFamilyHistoryState(history?.familyHistory));
    setAllergies(history?.allergies ?? '');
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
    setOdontogram(cloneOdontogram(history?.odontogram ?? null));
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

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-200" htmlFor="reason-for-consultation">
          Motivo de consulta
        </label>
        <textarea
          id="reason-for-consultation"
          value={reasonForConsultation}
          onChange={(event) => setReasonForConsultation(event.target.value)}
          rows={3}
          placeholder="Dolor, control, ortodoncia, estética, urgencias u otros motivos principales."
          className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
        />
      </div>

      <section className="space-y-4 rounded-2xl border border-white/5 bg-white/5 p-4 shadow-sm shadow-cyan-500/5">
        <div>
          <h3 className="text-lg font-semibold text-white">Datos médicos</h3>
          <p className="text-xs text-slate-300">
            Registrá antecedentes personales, enfermedades sistémicas y medicación actual relevantes para la atención odontológica.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {MEDICAL_FIELDS.map((field) => (
            <div key={field.key} className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor={`medical-${field.key}`}>
                {field.label}
              </label>
              <textarea
                id={`medical-${field.key}`}
                value={medicalBackground[field.key]}
                onChange={(event) => handleMedicalBackgroundChange(field.key, event.target.value)}
                rows={field.key === 'notes' ? 4 : 3}
                placeholder={field.placeholder}
                className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
              />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-white/5 bg-white/5 p-4 shadow-sm shadow-cyan-500/5">
        <div>
          <h3 className="text-lg font-semibold text-white">Antecedentes familiares</h3>
          <p className="text-xs text-slate-300">
            Identificá enfermedades hereditarias o condiciones compartidas que puedan impactar en el plan de tratamiento.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {FAMILY_FIELDS.map((field) => (
            <div key={field.key} className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor={`family-${field.key}`}>
                {field.label}
              </label>
              {field.key === 'others' ? (
                <textarea
                  id={`family-${field.key}`}
                  value={familyHistory[field.key]}
                  onChange={(event) => handleFamilyHistoryChange(field.key, event.target.value)}
                  rows={3}
                  placeholder={field.placeholder}
                  className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                />
              ) : (
                <input
                  id={`family-${field.key}`}
                  value={familyHistory[field.key]}
                  onChange={(event) => handleFamilyHistoryChange(field.key, event.target.value)}
                  placeholder={field.placeholder}
                  className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                />
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-200" htmlFor="clinical-allergies">
          Alergias y alertas medicamentosas
        </label>
        <textarea
          id="clinical-allergies"
          value={allergies}
          onChange={(event) => setAllergies(event.target.value)}
          rows={3}
          placeholder="Anestésicos, antibióticos, analgésicos u otros fármacos contraindicados."
          className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
        />
      </div>

      <div className="space-y-4">
        {STAGES.map((stage) => (
          <details
            key={stage.key}
            className="rounded-2xl border border-white/5 bg-white/5 p-4 shadow-sm shadow-cyan-500/5"
            open={stageOpenState[stage.key] ?? false}
            onToggle={(event) => {
              const isOpen = event.currentTarget.open;
              setStageOpenState((previous) => ({
                ...previous,
                [stage.key]: isOpen,
              }));
            }}
          >
            <summary className="flex cursor-pointer items-center justify-between gap-3 text-white">
              <span className="text-lg font-semibold">{stage.label}</span>
              <span className="text-xs font-semibold uppercase tracking-wide text-cyan-200">
                {stageHasValues(stage.key, stages) ? 'Editar' : 'Completar'}
              </span>
            </summary>
            <p className="mt-2 text-xs text-slate-300">{stage.description}</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
          </details>
        ))}
      </div>

      <section className="space-y-4 rounded-2xl border border-white/5 bg-white/5 p-4 shadow-sm shadow-cyan-500/5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Odontograma</h3>
            <p className="text-xs text-slate-300">
              Seleccioná el estado de cada pieza dentaria para registrar caries, exodoncias, selladores, coronas o tratamientos endodónticos.
            </p>
          </div>
          <button
            type="button"
            onClick={clearOdontogram}
            className="self-start rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:border-cyan-400/60 hover:text-cyan-100"
          >
            Limpiar odontograma
          </button>
        </div>
        <div className="space-y-5">
          {ODONTOGRAM_QUADRANTS.map((quadrant) => (
            <details
              key={quadrant.label}
              className="rounded-xl border border-white/5 bg-slate-950/40 p-4"
              open={odontogramSectionsOpen[quadrant.label] ?? true}
              onToggle={(event) => {
                const isOpen = event.currentTarget.open;
                setOdontogramSectionsOpen((previous) => ({
                  ...previous,
                  [quadrant.label]: isOpen,
                }));
              }}
            >
              <summary className="cursor-pointer text-sm font-semibold text-white">
                {quadrant.label}
              </summary>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {quadrant.teeth.map((tooth) => (
                  <div
                    key={tooth}
                    className="space-y-3 rounded-xl border border-white/10 bg-slate-950/70 p-3 shadow-inner shadow-cyan-500/10"
                  >
                    <p className="text-sm font-semibold text-white">Pieza {tooth}</p>
                    <div className="flex flex-wrap gap-2">
                      {ODONTOGRAM_STATUS.map((status) => {
                        const isActive = Boolean(odontogram[tooth]?.[status.key]);
                        const baseClasses = 'border rounded-full px-3 py-1 text-xs font-semibold transition';
                        const stateClasses = isActive
                          ? 'border-cyan-400 bg-cyan-500/20 text-cyan-100 shadow-inner shadow-cyan-500/30'
                          : 'border-white/10 text-slate-300 hover:border-cyan-300/60 hover:text-cyan-100';
                        return (
                          <button
                            key={`${tooth}-${status.key}`}
                            type="button"
                            onClick={() => toggleOdontogramCondition(tooth, status.key)}
                            className={`${baseClasses} ${stateClasses}`}
                          >
                            {status.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      </section>

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
