import { Metadata } from 'next';

import { MarketingClient } from './MarketingClient';

export const metadata: Metadata = {
  title: 'Marketing | Dentalist',
  description: 'Panel de marketing con Gemini y métricas reales del consultorio.',
};

export default function MarketingPage() {
  return <MarketingClient />;
}
