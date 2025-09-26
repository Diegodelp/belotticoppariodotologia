'use client';

import { ChangeEvent, useMemo, useState } from 'react';

import { PatientService } from '@/services/patient.service';
import { ClinicalMedia, ClinicalMediaLabel } from '@/types';

interface PatientMediaManagerProps {
  patientId: string;
  media: ClinicalMedia[];
  onMediaUpdated: (media: ClinicalMedia) => void;
  onMediaRefreshed?: (media: ClinicalMedia[]) => void;
}

type MediaSlot = {
  category: 'photo' | 'radiograph';
  label: ClinicalMediaLabel;
  title: string;
  description: string;
  accept: string;
};

const PHOTO_SLOTS: MediaSlot[] = [
  {
    category: 'photo',
    label: 'frente',
    title: 'Frente',
    description: 'Fotografía frontal extraoral.',
    accept: 'image/*',
  },
  {
    category: 'photo',
    label: 'perfil',
    title: 'Perfil',
    description: 'Perfil del paciente.',
    accept: 'image/*',
  },
  {
    category: 'photo',
    label: 'derecho',
    title: 'Lateral derecha',
    description: 'Vista lateral derecha extraoral.',
    accept: 'image/*',
  },
  {
    category: 'photo',
    label: 'izquierdo',
    title: 'Lateral izquierda',
    description: 'Vista lateral izquierda extraoral.',
    accept: 'image/*',
  },
  {
    category: 'photo',
    label: 'intraoral_superior',
    title: 'Intraoral superior',
    description: 'Fotografía intraoral del sector superior.',
    accept: 'image/*',
  },
  {
    category: 'photo',
    label: 'intraoral_inferior',
    title: 'Intraoral inferior',
    description: 'Fotografía intraoral del sector inferior.',
    accept: 'image/*',
  },
];

const RADIOGRAPH_SLOTS: MediaSlot[] = [
  {
    category: 'radiograph',
    label: 'panoramica',
    title: 'Radiografía panorámica',
    description: 'Panorámica dental actual del paciente.',
    accept: 'image/*,application/pdf',
  },
  {
    category: 'radiograph',
    label: 'teleradiografia',
    title: 'Telerradiografía',
    description: 'Telerradiografía lateral.',
    accept: 'image/*,application/pdf',
  },
];

const slotKey = (slot: MediaSlot) => `${slot.category}-${slot.label}`;

function isImage(mimeType: string | null | undefined) {
  return Boolean(mimeType && mimeType.toLowerCase().startsWith('image/'));
}

export function PatientMediaManager({
  patientId,
  media,
  onMediaUpdated,
  onMediaRefreshed,
}: PatientMediaManagerProps) {
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaBySlot = useMemo(() => {
    const map = new Map<string, ClinicalMedia>();

    for (const asset of media ?? []) {
      const key = `${asset.category}-${asset.label}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, asset);
        continue;
      }

      const existingTime = Date.parse(existing.uploadedAt);
      const assetTime = Date.parse(asset.uploadedAt);
      if (!Number.isNaN(assetTime) && assetTime >= existingTime) {
        map.set(key, asset);
      }
    }

    return map;
  }, [media]);

  const handleFileChange = async (slot: MediaSlot, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setError(null);
    setUploadingSlot(slotKey(slot));

    try {
      const formData = new FormData();
      formData.append('category', slot.category);
      formData.append('label', slot.label);
      formData.append('file', file);

      const response = await PatientService.uploadMedia(patientId, formData);
      if (!response?.success || !response.media) {
        throw new Error(response?.error ?? 'No pudimos subir el archivo.');
      }

      onMediaUpdated(response.media);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : 'Ocurrió un error al subir el archivo. Intentá nuevamente.',
      );
    } finally {
      setUploadingSlot(null);
      event.target.value = '';
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);

    try {
      const response = await PatientService.listMedia(patientId);
      if (!response || !Array.isArray(response.media)) {
        throw new Error('No pudimos actualizar los enlaces de descarga.');
      }

      onMediaRefreshed?.(response.media);
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : 'Ocurrió un error al actualizar los enlaces. Intentá nuevamente.',
      );
    } finally {
      setRefreshing(false);
    }
  };

  const renderSlot = (slot: MediaSlot) => {
    const key = slotKey(slot);
    const asset = mediaBySlot.get(key);
    const isUploading = uploadingSlot === key;
    const previewIsImage = asset ? isImage(asset.mimeType) : false;

    return (
      <div
        key={key}
        className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 shadow-inner shadow-cyan-500/5"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">{slot.title}</p>
            <p className="text-xs text-slate-400">{slot.description}</p>
            {asset && (
              <p className="mt-2 text-xs text-slate-400">
                Actualizado el {new Date(asset.uploadedAt).toLocaleString('es-AR')}
              </p>
            )}
          </div>
          {asset?.url && (
            <a
              href={asset.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-cyan-400/60 px-3 py-1 text-xs font-semibold text-cyan-200 transition hover:border-cyan-300 hover:bg-cyan-500/10"
            >
              Ver archivo
            </a>
          )}
        </div>

        <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-slate-950/60 p-3 text-center">
          {asset ? (
            previewIsImage ? (
              // El contenido proviene de URLs firmadas y cambiantes, por lo que Next/Image
              // no es práctico aquí. Desactivamos la regla para esta vista previa controlada.
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={asset.url}
                alt={`${slot.title} del paciente`}
                className="mx-auto h-40 w-auto rounded-xl object-cover"
              />
            ) : (
              <p className="text-xs text-slate-300">
                Archivo disponible ({asset.mimeType ?? 'formato desconocido'}). Usá “Ver archivo” para abrirlo.
              </p>
            )
          ) : (
            <p className="text-xs text-slate-400">Aún no subiste esta imagen.</p>
          )}
        </div>

        <label className="mt-4 inline-flex items-center justify-center rounded-full border border-cyan-400/60 px-4 py-2 text-xs font-semibold text-cyan-200 transition hover:border-cyan-300 hover:bg-cyan-500/10 cursor-pointer">
          {isUploading ? 'Subiendo…' : 'Subir archivo'}
          <input
            type="file"
            accept={slot.accept}
            className="sr-only"
            onChange={(event) => handleFileChange(slot, event)}
            disabled={isUploading}
          />
        </label>
      </div>
    );
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-cyan-500/10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Registros fotográficos y radiografías</h2>
          <p className="text-xs text-slate-300">
            Los enlaces generados caducan a los 15 minutos para mantener la privacidad de tus pacientes.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-slate-100 transition hover:border-cyan-300 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {refreshing ? 'Actualizando…' : 'Actualizar enlaces'}
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-2 text-xs text-rose-100">
          {error}
        </p>
      )}

      <div className="mt-6 space-y-6">
        <section>
          <h3 className="text-sm font-semibold text-white">Fotografías clínicas</h3>
          <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{PHOTO_SLOTS.map(renderSlot)}</div>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-white">Radiografías</h3>
          <div className="mt-3 grid gap-4 md:grid-cols-2">{RADIOGRAPH_SLOTS.map(renderSlot)}</div>
        </section>
      </div>
    </div>
  );
}
