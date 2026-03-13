import React, { useEffect, useState } from 'react';
import { getInvoices, fmtCurrency, fmtDate } from '../api';

const CARD_COLORS = { TAM: 'bg-blue-600', 'Outro Cartão': 'bg-purple-600' };

export default function Invoices() {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(false);
  const [expanded, setExpanded] = useState({});
  const [selectedYear, setSelectedYear] = useState('');

  useEffect(() => {
    setLoading(true);
    getInvoices()
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (key) => setExpanded((p) => ({ ...p, [key]: !p[key] }));

  if (loading || !data) {
    return <div className="text-center py-20 text-gray-400">Carregando...</div>;
  }

  // Collect all years from all cards
  const allYears = [...new Set(
    Object.values(data).flatMap((mm) => Object.keys(mm).map((m) => m.split('-')[0]))
  )].sort((a, b) => b - a); // most recent first

  // Default to most recent year with data
  const activeYear = selectedYear || allYears[0] || '';

  const hasAny = Object.values(data).some((mm) => Object.keys(mm).length > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Faturas</h1>

        {allYears.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {allYears.map((yr) => (
              <button
                key={yr}
                onClick={() => setSelectedYear(yr === activeYear ? '' : yr)}
                className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                  yr === activeYear
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-brand-500 hover:text-brand-600'
                }`}
              >
                {yr}
              </button>
            ))}
          </div>
        )}
      </div>

      {!hasAny && (
        <div className="bg-white rounded-xl shadow p-10 text-center text-gray-400">
          Nenhum lançamento em cartão encontrado.
        </div>
      )}

      {Object.entries(data).map(([method, monthMap]) => {
        // Filter months by selected year
        const filteredMonths = Object.entries(monthMap).filter(([month]) =>
          !activeYear || month.startsWith(activeYear)
        );
        if (filteredMonths.length === 0) return null;

        const yearTotal = filteredMonths.reduce((s, [, info]) => s + info.total, 0);

        return (
          <div key={method} className="bg-white rounded-xl shadow overflow-hidden">
            {/* Card header */}
            <div className={`${CARD_COLORS[method] || 'bg-gray-700'} text-white px-5 py-3 flex items-center justify-between`}>
              <span className="font-semibold">{method}</span>
              <span className="text-sm opacity-90">
                {activeYear ? `Total ${activeYear}: ` : 'Total geral: '}
                <strong>{fmtCurrency(yearTotal)}</strong>
              </span>
            </div>

            {/* Month rows */}
            <div className="divide-y">
              {filteredMonths.map(([month, info]) => {
                const key = `${method}-${month}`;
                const [yr, mo] = month.split('-');
                const label = new Date(Number(yr), Number(mo) - 1, 1)
                  .toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

                return (
                  <div key={month}>
                    <button
                      onClick={() => toggle(key)}
                      className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <span className="font-medium capitalize">{label}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500">{info.expenses.length} lançamento(s)</span>
                        <span className="font-semibold">{fmtCurrency(info.total)}</span>
                        <span className="text-gray-400">{expanded[key] ? '▲' : '▼'}</span>
                      </div>
                    </button>

                    {expanded[key] && (
                      <div className="px-5 pb-4">
                        <table className="min-w-full text-sm mt-1">
                          <thead>
                            <tr className="text-left text-gray-500 border-b">
                              <th className="pb-1 pr-4">Vencimento</th>
                              <th className="pb-1 pr-4">Categoria</th>
                              <th className="pb-1 pr-4">Local</th>
                              <th className="pb-1 pr-4">Parcela</th>
                              <th className="pb-1 text-right">Valor</th>
                            </tr>
                          </thead>
                          <tbody>
                            {info.expenses.map((e) => (
                              <tr key={e.id} className="border-b last:border-0 hover:bg-gray-50">
                                <td className="py-1.5 pr-4">{fmtDate(e.due_date)}</td>
                                <td className="py-1.5 pr-4">{e.category}</td>
                                <td className="py-1.5 pr-4 text-gray-500">{e.location || '—'}</td>
                                <td className="py-1.5 pr-4 text-gray-500">
                                  {e.installments > 1 ? `${e.installment_number}/${e.installments}` : '—'}
                                </td>
                                <td className="py-1.5 text-right font-medium">
                                  {fmtCurrency(Math.abs(e.installment_amount))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
