import React, { useEffect, useState } from 'react';
import { getInvoices, fmtCurrency, fmtDate } from '../api';

const CARD_LABELS = { TAM: 'Cartão TAM', 'Outro Cartão': 'Outro Cartão' };
const CARD_COLORS = { TAM: 'bg-blue-600', 'Outro Cartão': 'bg-purple-600' };

export default function Invoices() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [months, setMonths]   = useState(6);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    setLoading(true);
    getInvoices(months)
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  }, [months]);

  const toggle = (key) => setExpanded((p) => ({ ...p, [key]: !p[key] }));

  if (loading || !data) {
    return <div className="text-center py-20 text-gray-400">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Faturas Futuras</h1>
        <select
          value={months}
          onChange={(e) => setMonths(Number(e.target.value))}
          className="border rounded px-2 py-1 text-sm"
        >
          {[3, 6, 9, 12].map((n) => (
            <option key={n} value={n}>{n} meses</option>
          ))}
        </select>
      </div>

      {Object.entries(data).map(([method, monthMap]) => (
        <div key={method} className="bg-white rounded-xl shadow overflow-hidden">
          {/* Card header */}
          <div className={`${CARD_COLORS[method] || 'bg-gray-700'} text-white px-5 py-3 flex items-center justify-between`}>
            <span className="font-semibold">{CARD_LABELS[method] || method}</span>
            <span className="text-sm opacity-80">
              Total projetado:{' '}
              <strong>
                {fmtCurrency(
                  Object.values(monthMap).reduce((s, m) => s + m.total, 0)
                )}
              </strong>
            </span>
          </div>

          {/* Month rows */}
          <div className="divide-y">
            {Object.entries(monthMap).map(([month, info]) => {
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
                      {info.expenses.length === 0 ? (
                        <p className="text-sm text-gray-400">Sem lançamentos</p>
                      ) : (
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
                                  {e.installments > 1
                                    ? `${e.installment_number}/${e.installments}`
                                    : '—'}
                                </td>
                                <td className="py-1.5 text-right font-medium">
                                  {fmtCurrency(e.installment_amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
