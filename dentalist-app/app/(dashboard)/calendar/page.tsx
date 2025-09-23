import { Suspense } from 'react';

import { CalendarClient } from './CalendarClient';

export default function CalendarPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-300">Cargando calendario...</p>}>
      <CalendarClient />
    </Suspense>
  );
}

