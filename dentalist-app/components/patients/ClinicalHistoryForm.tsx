'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import {
  CephalometricField,
  ClinicalHistory,
  ClinicalHistoryInput,
  ClinicalStage,
  OdontogramCondition,
  OdontogramMarkStatus,
  OdontogramSurface,
  OdontogramSurfaceMark,
} from '@/types';
import { SignaturePad } from '@/components/patients/SignaturePad';

const STAGES: Array<{ key: ClinicalStage; label: string; description: string }> = [
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

const ODONTOGRAM_CONDITION_LABELS: Record<OdontogramCondition, string> = {
  caries: 'Caries',
  extraction: 'Exodoncia',
  sealant: 'Sellador',
  crown: 'Corona',
  endodontic: 'Endodoncia',
};

type OdontogramProcedure = Exclude<OdontogramCondition, 'crown'>;

const ODONTOGRAM_PROCEDURES: Array<{ key: OdontogramProcedure; label: string }> = [
  { key: 'caries', label: ODONTOGRAM_CONDITION_LABELS.caries },
  { key: 'extraction', label: ODONTOGRAM_CONDITION_LABELS.extraction },
  { key: 'sealant', label: ODONTOGRAM_CONDITION_LABELS.sealant },
  { key: 'endodontic', label: ODONTOGRAM_CONDITION_LABELS.endodontic },
];

const ODONTOGRAM_STATUS_OPTIONS: Array<{
  key: OdontogramMarkStatus;
  label: string;
  description: string;
}> = [
  {
    key: 'planned',
    label: 'A realizar',
    description: 'Marca procedimientos planificados en azul.',
  },
  {
    key: 'completed',
    label: 'Realizada',
    description: 'Marca procedimientos completados en rojo.',
  },
];

const ODONTOGRAM_STATUS_BADGES: Record<OdontogramMarkStatus, string> = {
  planned: 'border-sky-400/70 bg-sky-500/20 text-sky-100',
  completed: 'border-rose-400/70 bg-rose-500/20 text-rose-100',
};

const ODONTOGRAM_STATUS_SURFACE_CLASSES: Record<OdontogramMarkStatus, string> = {
  planned: 'border-sky-400/80 bg-sky-500/40 text-sky-100',
  completed: 'border-rose-400/80 bg-rose-500/40 text-rose-100',
};

const ODONTOGRAM_STATUS_RING_CLASSES: Record<OdontogramMarkStatus, string> = {
  planned: 'border-sky-400/70 shadow-[0_0_0_1px_rgba(56,189,248,0.35)]',
  completed: 'border-rose-400/70 shadow-[0_0_0_1px_rgba(244,63,94,0.35)]',
};

const ODONTOGRAM_STATUS_LABELS: Record<OdontogramMarkStatus, string> = {
  planned: 'A realizar',
  completed: 'Realizada',
};

const ODONTOGRAM_SURFACE_KEYS: OdontogramSurface[] = [
  'mesial',
  'distal',
  'occlusal',
  'vestibular',
  'lingual',
  'whole',
  'crown',
];

const ODONTOGRAM_SURFACE_SEQUENCE: OdontogramSurface[] = [
  'whole',
  'crown',
  'mesial',
  'occlusal',
  'distal',
  'vestibular',
  'lingual',
];

const ODONTOGRAM_UPPER_SURFACE_LAYOUT: Array<{
  key: Exclude<OdontogramSurface, 'whole' | 'crown'>;
  row: number;
  col: number;
}> = [
  { key: 'vestibular', row: 1, col: 2 },
  { key: 'mesial', row: 2, col: 1 },
  { key: 'occlusal', row: 2, col: 2 },
  { key: 'distal', row: 2, col: 3 },
  { key: 'lingual', row: 3, col: 2 },
];

const ODONTOGRAM_LOWER_SURFACE_LAYOUT: Array<{
  key: Exclude<OdontogramSurface, 'whole' | 'crown'>;
  row: number;
  col: number;
}> = [
  { key: 'lingual', row: 1, col: 2 },
  { key: 'mesial', row: 2, col: 1 },
  { key: 'occlusal', row: 2, col: 2 },
  { key: 'distal', row: 2, col: 3 },
  { key: 'vestibular', row: 3, col: 2 },
];

function shouldFlipMesialDistal(tooth: string): boolean {
  const quadrant = getQuadrant(tooth);
  if (!quadrant) {
    return false;
  }

  return quadrant === 1 || quadrant === 3 || quadrant === 5 || quadrant === 7;
}

function getToothSurfaceLayout(tooth: string, flipOverride?: boolean) {
  const quadrant = getQuadrant(tooth);
  const baseLayout = isUpperQuadrant(quadrant)
    ? ODONTOGRAM_UPPER_SURFACE_LAYOUT
    : ODONTOGRAM_LOWER_SURFACE_LAYOUT;
  const flip = typeof flipOverride === 'boolean' ? flipOverride : shouldFlipMesialDistal(tooth);

  if (!flip) {
    return baseLayout;
  }

  return baseLayout.map((surface) => {
    if (surface.key === 'mesial') {
      return { ...surface, col: 3 };
    }

    if (surface.key === 'distal') {
      return { ...surface, col: 1 };
    }

    return surface;
  });
}

function getQuadrant(tooth: string): number | null {
  const quadrant = Number.parseInt(tooth.charAt(0), 10);
  return Number.isFinite(quadrant) ? quadrant : null;
}

function isUpperQuadrant(quadrant: number | null) {
  return quadrant === 1 || quadrant === 2 || quadrant === 5 || quadrant === 6;
}

function isAnteriorTooth(tooth: string): boolean {
  if (tooth.length < 2) {
    return false;
  }

  const position = Number.parseInt(tooth.charAt(1), 10);
  return Number.isFinite(position) ? position >= 1 && position <= 3 : false;
}

function getLingualLabel(tooth: string) {
  return isUpperQuadrant(getQuadrant(tooth)) ? 'Palatino' : 'Lingual';
}

function getLingualAbbreviation(tooth: string) {
  return isUpperQuadrant(getQuadrant(tooth)) ? 'P' : 'L';
}

function getOcclusalLabel(tooth: string) {
  return isAnteriorTooth(tooth) ? 'Incisal' : 'Oclusal';
}

function getOcclusalAbbreviation(tooth: string) {
  return isAnteriorTooth(tooth) ? 'I' : 'O';
}

function getSurfaceLabel(tooth: string, surface: OdontogramSurface): string {
  switch (surface) {
    case 'mesial':
      return 'Mesial';
    case 'distal':
      return 'Distal';
    case 'occlusal':
      return getOcclusalLabel(tooth);
    case 'vestibular':
      return 'Vestibular';
    case 'lingual':
      return getLingualLabel(tooth);
    case 'whole':
      return 'Pieza completa';
    case 'crown':
      return 'Corona';
    default:
      return surface;
  }
}

function getSurfaceAbbreviation(tooth: string, surface: OdontogramSurface): string {
  switch (surface) {
    case 'mesial':
      return 'M';
    case 'distal':
      return 'D';
    case 'occlusal':
      return getOcclusalAbbreviation(tooth);
    case 'vestibular':
      return 'V';
    case 'lingual':
      return getLingualAbbreviation(tooth);
    case 'whole':
      return 'Pza';
    case 'crown':
      return 'Cr';
    default:
      return surface;
  }
}

type ToothQuadrantConfig = {
  id: string;
  label: string;
  teeth: string[];
  labelPosition: 'top' | 'bottom';
  flipMesial: boolean;
};

const PERMANENT_TOOTH_QUADRANTS: Record<'q1' | 'q2' | 'q3' | 'q4', ToothQuadrantConfig> = {
  q1: {
    id: 'permanent-q1',
    label: '18 – 11',
    teeth: ['18', '17', '16', '15', '14', '13', '12', '11'],
    labelPosition: 'top',
    flipMesial: true,
  },
  q2: {
    id: 'permanent-q2',
    label: '21 – 28',
    teeth: ['21', '22', '23', '24', '25', '26', '27', '28'],
    labelPosition: 'top',
    flipMesial: false,
  },
  q3: {
    id: 'permanent-q3',
    label: '31 – 38',
    teeth: ['31', '32', '33', '34', '35', '36', '37', '38'],
    labelPosition: 'bottom',
    flipMesial: false,
  },
  q4: {
    id: 'permanent-q4',
    label: '48 – 41',
    teeth: ['48', '47', '46', '45', '44', '43', '42', '41'],
    labelPosition: 'bottom',
    flipMesial: true,
  },
};

const PERMANENT_TOOTH_ORDER: ToothQuadrantConfig[] = [
  PERMANENT_TOOTH_QUADRANTS.q1,
  PERMANENT_TOOTH_QUADRANTS.q2,
  PERMANENT_TOOTH_QUADRANTS.q4,
  PERMANENT_TOOTH_QUADRANTS.q3,
];

const PRIMARY_TOOTH_QUADRANTS: Record<'q5' | 'q6' | 'q7' | 'q8', ToothQuadrantConfig> = {
  q5: {
    id: 'primary-q5',
    label: '55 – 51',
    teeth: ['55', '54', '53', '52', '51'],
    labelPosition: 'top',
    flipMesial: true,
  },
  q6: {
    id: 'primary-q6',
    label: '61 – 65',
    teeth: ['61', '62', '63', '64', '65'],
    labelPosition: 'top',
    flipMesial: false,
  },
  q7: {
    id: 'primary-q7',
    label: '71 – 75',
    teeth: ['71', '72', '73', '74', '75'],
    labelPosition: 'bottom',
    flipMesial: false,
  },
  q8: {
    id: 'primary-q8',
    label: '85 – 81',
    teeth: ['85', '84', '83', '82', '81'],
    labelPosition: 'bottom',
    flipMesial: true,
  },
};

const PRIMARY_TOOTH_ORDER: ToothQuadrantConfig[] = [
  PRIMARY_TOOTH_QUADRANTS.q5,
  PRIMARY_TOOTH_QUADRANTS.q6,
  PRIMARY_TOOTH_QUADRANTS.q8,
  PRIMARY_TOOTH_QUADRANTS.q7,
];

function cloneOdontogram(
  source?: ClinicalHistory['odontogram'] | ClinicalHistoryInput['odontogram'] | null,
): OdontogramState {
  if (!source) {
    return {};
  }

  const clone: OdontogramState = {};

  for (const [tooth, state] of Object.entries(source)) {
    if (!state) {
      continue;
    }

    const toothState: Partial<Record<OdontogramSurface, OdontogramSurfaceMark>> = {};

    for (const surface of ODONTOGRAM_SURFACE_KEYS) {
      const mark = state[surface];
      if (mark) {
        toothState[surface] = { ...mark };
      }
    }

    if (Object.keys(toothState).length > 0) {
      clone[tooth] = toothState as OdontogramState[string];
    }
  }

  return clone;
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

type ClinicalHistoryFormMode = 'full' | 'stages-only' | 'without-stages';

interface ClinicalHistoryFormProps {
  history: ClinicalHistory | null;
  onSubmit: (data: ClinicalHistoryInput) => Promise<void>;
  loading?: boolean;
  mode?: ClinicalHistoryFormMode;
  title?: string;
  description?: string;
  submitLabel?: string;
  resetLabel?: string;
}

export function ClinicalHistoryForm({
  history,
  onSubmit,
  loading = false,
  mode = 'full',
  title,
  description,
  submitLabel,
  resetLabel,
}: ClinicalHistoryFormProps) {
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
  const [signatureClarification, setSignatureClarification] = useState(
    history?.signatureClarification ?? '',
  );
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [removeSignature, setRemoveSignature] = useState(false);
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
  const [stageOpenState, setStageOpenState] = useState<Partial<Record<ClinicalStage, boolean>>>(
    () => {
      const initialState: Partial<Record<ClinicalStage, boolean>> = {};
      STAGES.forEach((stage, index) => {
        initialState[stage.key] = index === 0 || stageHasValuesInHistory(stage.key, history);
      });
      return initialState;
    },
  );
  const showNonStageSections = mode !== 'stages-only';
  const showStages = mode !== 'without-stages';
  const showOdontogram = mode !== 'stages-only';
  const showSignature = mode !== 'stages-only';
  const heading = title ?? (mode === 'stages-only' ? 'Evolución ortodóncica' : 'Historia clínica');
  const subheading =
    description ??
    (mode === 'stages-only'
      ? 'Actualizá las mediciones cefalométricas y los hitos del tratamiento ortodóncico asignado.'
      : 'Registrá la evolución cefalométrica y observaciones relevantes de este paciente.');
  const submitButtonLabel =
    submitLabel ?? (mode === 'stages-only' ? 'Guardar evolución ortodóncica' : 'Guardar historia clínica');
  const resetButtonLabel = resetLabel ?? 'Restablecer valores';
  const [odontogram, setOdontogram] = useState<OdontogramState>(() =>
    cloneOdontogram(history?.odontogram ?? null),
  );
  const [selectedProcedure, setSelectedProcedure] = useState<OdontogramProcedure>('caries');
  const [selectedStatus, setSelectedStatus] = useState<OdontogramMarkStatus>('planned');
  const [odontogramTool, setOdontogramTool] = useState<'apply' | 'erase'>('apply');
  const [activeTooth, setActiveTooth] = useState<string | null>(() => {
    const firstTooth = history?.odontogram ? Object.keys(history.odontogram)[0] : undefined;
    return firstTooth ?? null;
  });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSummary(history?.summary ?? '');
    setReasonForConsultation(history?.reasonForConsultation ?? '');
    setMedicalBackground(buildMedicalBackgroundState(history?.medicalBackground));
    setFamilyHistory(buildFamilyHistoryState(history?.familyHistory));
    setAllergies(history?.allergies ?? '');
    setSignatureClarification(history?.signatureClarification ?? '');
    setSignatureDataUrl(null);
    setRemoveSignature(false);
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
    const firstTooth = history?.odontogram ? Object.keys(history.odontogram)[0] : null;
    setActiveTooth(firstTooth ?? null);
    setSelectedProcedure('caries');
    setSelectedStatus('planned');
    setOdontogramTool('apply');
    const nextOpenState: Partial<Record<ClinicalStage, boolean>> = {};
    STAGES.forEach((stage, index) => {
      nextOpenState[stage.key] = index === 0 || stageHasValuesInHistory(stage.key, history ?? null);
    });
    setStageOpenState(nextOpenState);
  }, [history]);

  useEffect(() => {
    if (activeTooth) {
      return;
    }

    const firstTooth = Object.keys(odontogram)[0];
    if (firstTooth) {
      setActiveTooth(firstTooth);
    }
  }, [activeTooth, odontogram]);

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

  const activeToothMarks = useMemo(() => {
    if (!activeTooth) {
      return [] as Array<{ surface: OdontogramSurface; mark: OdontogramSurfaceMark }>;
    }

    const toothState = odontogram[activeTooth];
    if (!toothState) {
      return [] as Array<{ surface: OdontogramSurface; mark: OdontogramSurfaceMark }>;
    }

    const entries: Array<{ surface: OdontogramSurface; mark: OdontogramSurfaceMark }> = [];
    for (const surface of ODONTOGRAM_SURFACE_SEQUENCE) {
      const mark = toothState[surface];
      if (mark) {
        entries.push({ surface, mark });
      }
    }
    return entries;
  }, [activeTooth, odontogram]);

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

  const updateToothState = (
    tooth: string,
    reducer: (
      current: OdontogramState[string] | undefined,
    ) => OdontogramState[string] | undefined,
  ) => {
    setOdontogram((previous) => {
      const nextState = reducer(previous[tooth]);

      if (!nextState || Object.keys(nextState).length === 0) {
        if (!previous[tooth]) {
          return previous;
        }

        const rest = { ...previous };
        delete rest[tooth];
        return rest;
      }

      return {
        ...previous,
        [tooth]: nextState,
      };
    });
  };

  const handleSurfaceMark = (
    tooth: string,
    surface: Exclude<OdontogramSurface, 'whole' | 'crown'>,
  ) => {
    setActiveTooth(tooth);
    updateToothState(tooth, (current) => {
      const next = current ? { ...current } : {};

      if (odontogramTool === 'erase') {
        delete next[surface];
        return next;
      }

      const nextMark: OdontogramSurfaceMark = {
        condition: selectedProcedure,
        status: selectedStatus,
      };

      const existing = current?.[surface];
      if (existing && existing.condition === nextMark.condition && existing.status === nextMark.status) {
        delete next[surface];
      } else {
        next[surface] = nextMark;
      }

      return next;
    });
  };

  const handleWholeToggle = (tooth: string) => {
    setActiveTooth(tooth);
    updateToothState(tooth, (current) => {
      const next = current ? { ...current } : {};

      if (odontogramTool === 'erase') {
        delete next.whole;
        return next;
      }

      const nextMark: OdontogramSurfaceMark = {
        condition: selectedProcedure,
        status: selectedStatus,
      };

      const existing = current?.whole;
      if (existing && existing.condition === nextMark.condition && existing.status === nextMark.status) {
        delete next.whole;
      } else {
        next.whole = nextMark;
      }

      return next;
    });
  };

  const handleCrownToggle = (tooth: string) => {
    setActiveTooth(tooth);
    updateToothState(tooth, (current) => {
      const next = current ? { ...current } : {};

      if (odontogramTool === 'erase') {
        delete next.crown;
        return next;
      }

      const nextMark: OdontogramSurfaceMark = {
        condition: 'crown',
        status: selectedStatus,
      };

      const existing = current?.crown;
      if (existing && existing.status === nextMark.status) {
        delete next.crown;
      } else {
        next.crown = nextMark;
      }

      return next;
    });
  };

  const clearTooth = (tooth: string) => {
    setOdontogram((previous) => {
      if (!previous[tooth]) {
        return previous;
      }

      const rest = { ...previous };
      delete rest[tooth];
      return rest;
    });
  };

  const clearOdontogram = () => {
    setOdontogram({});
    setActiveTooth(null);
  };

  const renderTooth = (tooth: string, labelPosition: 'top' | 'bottom', flipMesial: boolean) => {
    const toothState = odontogram[tooth];
    const wholeMark = toothState?.whole;
    const crownMark = toothState?.crown;
    const isActive = activeTooth === tooth;
    const outlineClass = wholeMark
      ? ODONTOGRAM_STATUS_RING_CLASSES[wholeMark.status]
      : 'border-white/10';
    const layout = getToothSurfaceLayout(tooth, flipMesial);

    const renderNumberButton = () => (
      <button
        type="button"
        onClick={() => setActiveTooth(tooth)}
        className={`text-[11px] font-semibold transition ${
          isActive ? 'text-cyan-300' : 'text-slate-300 hover:text-cyan-100'
        }`}
      >
        {tooth}
      </button>
    );

    return (
      <div key={tooth} className="flex flex-col items-center gap-1">
        {labelPosition === 'top' && renderNumberButton()}
        <div
          className={`relative rounded-xl ${
            isActive ? 'ring-2 ring-cyan-400/60 ring-offset-2 ring-offset-slate-950' : ''
          }`}
        >
          <div
            className={`relative grid h-14 w-14 grid-cols-3 grid-rows-3 gap-[2px] rounded-lg border bg-slate-900/60 ${outlineClass}`}
          >
            {crownMark && (
              <div
                className={`pointer-events-none absolute inset-2 rounded-full border-2 ${
                  ODONTOGRAM_STATUS_RING_CLASSES[crownMark.status]
                }`}
              />
            )}
            {layout.map((surface) => {
              const mark = toothState?.[surface.key];
              const buttonClasses = mark
                ? ODONTOGRAM_STATUS_SURFACE_CLASSES[mark.status]
                : 'border-white/10 bg-slate-900/60 text-slate-300 hover:border-cyan-300/60 hover:text-cyan-100';

              return (
                <button
                  key={`${tooth}-${surface.key}`}
                  type="button"
                  style={{ gridRowStart: surface.row, gridColumnStart: surface.col }}
                  onClick={() => {
                    setActiveTooth(tooth);
                    handleSurfaceMark(tooth, surface.key);
                  }}
                  className={`relative flex items-center justify-center rounded-sm border text-[10px] font-semibold uppercase tracking-wide transition focus:outline-none focus:ring-2 focus:ring-cyan-300/40 focus:ring-offset-1 focus:ring-offset-slate-950 ${buttonClasses}`}
                >
                  <span>{getSurfaceAbbreviation(tooth, surface.key)}</span>
                  <span className="sr-only">
                    {`${getSurfaceLabel(tooth, surface.key)} · ${
                      mark
                        ? `${ODONTOGRAM_CONDITION_LABELS[mark.condition]} (${ODONTOGRAM_STATUS_LABELS[mark.status]})`
                        : 'Sin registro'
                    }`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        {labelPosition === 'bottom' && renderNumberButton()}
      </div>
    );
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
        signatureClarification,
        signatureDataUrl: signatureDataUrl ?? undefined,
        removeSignature,
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
    setSignatureClarification(history?.signatureClarification ?? '');
    setSignatureDataUrl(null);
    setRemoveSignature(false);
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
    setSelectedProcedure('caries');
    setSelectedStatus('planned');
    setOdontogramTool('apply');
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
          <h2 className="text-xl font-semibold text-white">{heading}</h2>
          <p className="text-sm text-slate-300">{subheading}</p>
        </div>
        {lastUpdated && <span className="text-xs text-slate-400">Actualizada: {lastUpdated}</span>}
      </div>

      {showNonStageSections && (
        <>
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
        </>
      )}

      {showNonStageSections && (
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
      )}

      {showNonStageSections && (
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
      )}

      {showNonStageSections && (
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
      )}

      {showSignature && (
        <section className="space-y-4 rounded-2xl border border-white/5 bg-white/5 p-4 shadow-sm shadow-cyan-500/5">
        <div>
          <h3 className="text-lg font-semibold text-white">Firma y aclaración</h3>
          <p className="text-xs text-slate-300">
            Registrá la firma del paciente o responsable para respaldar la historia clínica y añadí una aclaración
            contextual.
      </p>
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <label
          className="text-xs font-semibold uppercase tracking-wide text-slate-400"
          htmlFor="clinical-signature-clarification"
        >
          Aclaración de la firma
        </label>
        <textarea
          id="clinical-signature-clarification"
          value={signatureClarification}
          onChange={(event) => setSignatureClarification(event.target.value)}
          rows={3}
          placeholder="Nombre y apellido de quien firma, relación con el paciente u observaciones adicionales."
          className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
        />
      </div>
      <div className="space-y-3">
        {history?.signatureUrl && !removeSignature && !signatureDataUrl ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Firma guardada</p>
              <button
                type="button"
                onClick={() => {
                  setRemoveSignature(true);
                  setSignatureDataUrl(null);
                }}
                className="text-xs font-semibold text-rose-200 transition hover:text-rose-100"
              >
                Eliminar
              </button>
            </div>
            <div className="flex items-center justify-center rounded-xl border border-white/10 bg-slate-950/60 p-3">
              <Image
                src={history.signatureUrl}
                alt="Firma registrada"
                width={320}
                height={128}
                className="max-h-32 w-full object-contain"
                unoptimized
              />
            </div>
          </div>
        ) : null}
        {removeSignature ? (
          <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            La firma actual se eliminará cuando guardes la historia clínica.
            <button
              type="button"
              onClick={() => setRemoveSignature(false)}
              className="ml-2 text-amber-200 underline decoration-dotted underline-offset-4 hover:text-amber-100"
            >
              Deshacer
            </button>
          </p>
        ) : null}
        <div className="space-y-2">
          <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
            <SignaturePad
              value={signatureDataUrl}
              onChange={(dataUrl) => {
                setSignatureDataUrl(dataUrl);
                if (dataUrl) {
                  setRemoveSignature(false);
                }
              }}
              disabled={saving}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Dibujá la firma con el puntero o el dedo.</span>
            <button
              type="button"
              onClick={() => setSignatureDataUrl(null)}
              className="text-xs font-semibold text-cyan-200 transition hover:text-cyan-100"
            >
              Limpiar
            </button>
          </div>
        </div>
          </div>
        </div>
      </section>
      )}

      {showStages && (
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
      )}

      {showOdontogram && (
        <section className="space-y-4 rounded-2xl border border-white/5 bg-white/5 p-4 shadow-sm shadow-cyan-500/5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Odontograma</h3>
            <p className="text-xs text-slate-300">
              Seleccioná el procedimiento, el estado y la cara a registrar para cada pieza dentaria.
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
        <div className="grid gap-4 lg:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Procedimiento</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {ODONTOGRAM_PROCEDURES.map((procedure) => {
                const isActive = selectedProcedure === procedure.key;
                const baseClasses = 'rounded-full border px-3 py-1 text-xs font-semibold transition';
                const stateClasses = isActive
                  ? 'border-cyan-400 bg-cyan-500/20 text-cyan-100 shadow-inner shadow-cyan-500/30'
                  : 'border-white/10 text-slate-300 hover:border-cyan-300/60 hover:text-cyan-100';
                return (
                  <button
                    key={procedure.key}
                    type="button"
                    onClick={() => setSelectedProcedure(procedure.key)}
                    className={`${baseClasses} ${stateClasses}`}
                  >
                    {procedure.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Estado</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {ODONTOGRAM_STATUS_OPTIONS.map((status) => {
                const isActive = selectedStatus === status.key;
                const baseClasses = 'rounded-full border px-3 py-1 text-xs font-semibold transition';
                const stateClasses = isActive
                  ? ODONTOGRAM_STATUS_BADGES[status.key]
                  : 'border-white/10 text-slate-300 hover:border-cyan-300/60 hover:text-cyan-100';
                return (
                  <button
                    key={status.key}
                    type="button"
                    onClick={() => setSelectedStatus(status.key)}
                    className={`${baseClasses} ${stateClasses}`}
                  >
                    {status.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-slate-400">
              {ODONTOGRAM_STATUS_OPTIONS.find((option) => option.key === selectedStatus)?.description}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Herramientas</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setOdontogramTool('apply')}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  odontogramTool === 'apply'
                    ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100'
                    : 'border-white/10 text-slate-300 hover:border-emerald-400/60 hover:text-emerald-100'
                }`}
              >
                Aplicar
              </button>
              <button
                type="button"
                onClick={() => setOdontogramTool('erase')}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  odontogramTool === 'erase'
                    ? 'border-rose-400 bg-rose-500/20 text-rose-100'
                    : 'border-white/10 text-slate-300 hover:border-rose-400/60 hover:text-rose-200'
                }`}
              >
                Borrar
              </button>
            </div>
            <div className="mt-3 space-y-1 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-3 w-3 rounded-full bg-sky-400/80 shadow-[0_0_0_2px_rgba(56,189,248,0.35)]" />
                <span>Procedimiento a realizar</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-3 w-3 rounded-full bg-rose-400/80 shadow-[0_0_0_2px_rgba(244,63,94,0.35)]" />
                <span>Procedimiento realizado</span>
              </div>
              <p className="pt-1 text-[11px] italic text-slate-500">
                Usá “Pieza completa” o “Corona” para aplicar el estado seleccionado sobre toda la superficie.
              </p>
            </div>
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="space-y-6">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Dentición permanente</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {PERMANENT_TOOTH_ORDER.map((quadrant) => (
                  <div key={quadrant.id} className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{quadrant.label}</p>
                    <div className="flex flex-wrap items-start justify-center gap-3">
                      {quadrant.teeth.map((tooth) =>
                        renderTooth(tooth, quadrant.labelPosition, quadrant.flipMesial),
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Dentición temporal</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {PRIMARY_TOOTH_ORDER.map((quadrant) => (
                  <div key={quadrant.id} className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{quadrant.label}</p>
                    <div className="flex flex-wrap items-start justify-center gap-3">
                      {quadrant.teeth.map((tooth) =>
                        renderTooth(tooth, quadrant.labelPosition, quadrant.flipMesial),
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <aside className="flex h-full flex-col justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
            <div className="space-y-3">
              {activeTooth ? (
                <>
                  <div className="flex items-center justify-between">
                    <h4 className="text-base font-semibold text-white">Pieza {activeTooth}</h4>
                    <button
                      type="button"
                      onClick={() => clearTooth(activeTooth)}
                      className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-semibold text-slate-300 transition hover:border-rose-400/60 hover:text-rose-200"
                    >
                      Limpiar
                    </button>
                  </div>
                  <p className="text-xs text-slate-300">
                    Seleccioná una cara para aplicar el procedimiento y estado definidos. Usá las acciones inferiores para marcar la
                    pieza completa o la corona.
                  </p>
                  {activeToothMarks.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {activeToothMarks.map(({ surface, mark }) => (
                        <span
                          key={`${activeTooth}-${surface}`}
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium ${ODONTOGRAM_STATUS_BADGES[mark.status]}`}
                        >
                          <span className="font-semibold uppercase">{getSurfaceAbbreviation(activeTooth, surface)}</span>
                          <span>{ODONTOGRAM_CONDITION_LABELS[mark.condition]}</span>
                          <span className="text-[10px]">{ODONTOGRAM_STATUS_LABELS[mark.status]}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">Aún no registraste caras para esta pieza.</p>
                  )}
                </>
              ) : (
                <div className="space-y-2 text-sm text-slate-300">
                  <p className="font-semibold text-white">Seleccioná una pieza</p>
                  <p>
                    Elegí una pieza del odontograma para ver sus registros y marcar procedimientos. Podés alternar entre realizar o
                    borrar utilizando las herramientas de la izquierda.
                  </p>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <button
                type="button"
                disabled={!activeTooth}
                onClick={() => activeTooth && handleWholeToggle(activeTooth)}
                className="w-full rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 transition enabled:hover:border-cyan-300/60 enabled:hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {selectedStatus === 'planned' ? 'Marcar pieza completa (a realizar)' : 'Marcar pieza completa (realizada)'}
              </button>
              <button
                type="button"
                disabled={!activeTooth}
                onClick={() => activeTooth && handleCrownToggle(activeTooth)}
                className="w-full rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 transition enabled:hover:border-cyan-300/60 enabled:hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {selectedStatus === 'planned' ? 'Marcar corona (a realizar)' : 'Marcar corona (realizada)'}
              </button>
            </div>
          </aside>
        </div>
      </section>
      )}

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
          {resetButtonLabel}
        </button>
        <button
          type="submit"
          disabled={saving || loading}
          className="rounded-full bg-cyan-500 px-5 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'Guardando...' : submitButtonLabel}
        </button>
      </div>
    </form>
  );
}
