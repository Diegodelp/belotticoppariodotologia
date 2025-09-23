'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Payment, Patient } from '@/types';

interface PaymentWithPatient extends Payment {
  patient?: Patient;
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentWithPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'all' | 'completed' | 'pending'>('all');

  useEffect(() => {
    const fetchPayments = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/payments');
        const data = await response.json();
        setPayments(data);
      } finally {
        setLoading(false);
      }
    };
    fetchPayments();
  }, []);

  const filteredPayments = useMemo(() => {
    return status === 'all'
      ? payments
      : payments.filter((payment) => payment.status === status);
  }, [payments, status]);

  const totals = useMemo(() => {
    return filteredPayments.reduce(
      (acc, payment) => {
        if (payment.status === 'completed') acc.collected += payment.amount;
        if (payment.status === 'pending') acc.pending += payment.amount;
        return acc;
      },
      { collected: 0, pending: 0 },
    );
  }, [filteredPayments]);

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Pagos y cobranzas</h1>
          <p className="text-sm text-slate-300">
            Control de ingresos confirmados y saldos pendientes.
          </p>
        </div>
        <Link
          href="/treatments"
          className="rounded-full border border-white/10 px-5 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-300 hover:text-cyan-200"
        >
          Ver tratamientos
        </Link>
      </div>

      <div className="grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-cyan-500/10">
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-200">
          {(['all', 'completed', 'pending'] as const).map((value) => (
            <button
              key={value}
              onClick={() => setStatus(value)}
              className={`rounded-full border px-4 py-2 capitalize transition ${
                status === value
                  ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100'
                  : 'border-white/10 bg-slate-900/60 text-slate-300 hover:border-emerald-300/60 hover:text-emerald-200'
              }`}
            >
              {value === 'all' ? 'Todos' : value === 'completed' ? 'Cobrados' : 'Pendientes'}
            </button>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-emerald-400/30 bg-emerald-500/10 p-5 text-sm text-emerald-50">
            <p>Cobrado</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-100">
              {totals.collected.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
            </p>
          </div>
          <div className="rounded-3xl border border-amber-400/30 bg-amber-500/10 p-5 text-sm text-amber-50">
            <p>Pendiente</p>
            <p className="mt-2 text-2xl font-semibold text-amber-100">
              {totals.pending.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
            </p>
          </div>
        </div>

        {loading && <p className="text-sm text-slate-300">Cargando pagos...</p>}

        <div className="overflow-hidden rounded-2xl border border-white/10">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm text-slate-200">
            <thead className="bg-slate-900/70 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-3">Fecha</th>
                <th className="px-6 py-3">Paciente</th>
                <th className="px-6 py-3">Medio</th>
                <th className="px-6 py-3">Notas</th>
                <th className="px-6 py-3 text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredPayments.map((payment) => (
                <tr key={payment.id} className="bg-slate-900/50">
                  <td className="px-6 py-4 text-slate-300">
                    {new Date(payment.date).toLocaleDateString('es-AR')}
                  </td>
                  <td className="px-6 py-4 text-slate-200">
                    {payment.patient?.name} {payment.patient?.lastName}
                  </td>
                  <td className="px-6 py-4 capitalize text-slate-300">{payment.method}</td>
                  <td className="px-6 py-4 text-slate-400">{payment.notes ?? '—'}</td>
                  <td className="px-6 py-4 text-right text-emerald-300">
                    {payment.amount.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                  </td>
                </tr>
              ))}
              {!loading && filteredPayments.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-slate-300">
                    No encontramos pagos con los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}