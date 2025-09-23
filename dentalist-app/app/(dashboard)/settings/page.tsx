import { Suspense } from 'react';

import { SettingsClient } from './SettingsClient';

export default function SettingsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-300">Cargando configuración...</p>}>
      <SettingsClient />
    </Suspense>
  );
}
