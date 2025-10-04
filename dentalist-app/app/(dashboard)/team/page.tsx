import { Suspense } from 'react';

import { TeamClient } from './TeamClient';

export default function TeamPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-300">Cargando equipo...</p>}>
      <TeamClient />
    </Suspense>
  );
}
