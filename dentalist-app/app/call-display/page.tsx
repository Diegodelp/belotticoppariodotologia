import { Suspense } from 'react';

import { CallDisplayClient } from './CallDisplayClient';

export default function CallDisplayPage() {
  return (
    <Suspense fallback={null}>
      <CallDisplayClient />
    </Suspense>
  );
}
