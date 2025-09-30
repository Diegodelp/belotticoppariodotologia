import { Suspense } from 'react';

import RegisterClient from './RegisterClient';

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" aria-busy="true" /> }>
      <RegisterClient />
    </Suspense>
  );
}
