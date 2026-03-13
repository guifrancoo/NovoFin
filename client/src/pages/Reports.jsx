import React, { useEffect, useState } from 'react';
import {
  getReportByCategory, getReportByMonth, getReportByPaymentMethod,
  fmtCurrency,
} from '../api';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts';

const COLORS = [
  '#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6',
  '#ec4899','#14b8a6','#f97316','#6366f1','#84cc16','#06b6d4','#a855f7',
];

const MIN_MONTH = '2016-01';

function currentYM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function Reports() {
  const [start, setStart] = useState(MIN_MONTH);
  const [end,   setEnd]   = useState(currentYM);
  const [byCategory, setByCategory] = useState([]);
  const [byMonth,    setByMonth]    = useState([]);
  const [byMethod,   setByMethod]   = useState([]);
  const [loading, setLoading]       = useState(false);
  const [expanded, setExpanded]     = useState({});

  useEffect(() => {
    if (start > end) return;
    setLoading(true);
    Promise.all([
      getReportByCategory({ start, end }),
      getReportByMonth({ start, end }),
      getReportByPaymentMethod({ start, end }),
    ]).then(([cat, mon, met]) => {
      setByCategory(cat.data);
      setByMonth(mon.data);
      setByMethod(met.data);
      setExpanded({});
    }).finally(() => setLoading(false));
  }, [start, end]);

  const grandTotal = byCategory.reduce((s, r) => s + r.total, 0);

  const toggleCat = (cat) => setExpanded((p) => ({ ...p, [cat]: !p[cat] }));

  // Dynamic chart height: at least 200px, 32px per category row
  const barChartHeight = Math.max(200, byCategory.length * 32);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <div className="flex items-center gap-2 ml-auto">
          <label className="text-sm text-gray-600">De</label>
          <input
            type="month" value={start} min={MIN_MONTH}
            onChange={(e) => setStart(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          />
          <label className="text-sm text-gray-600">até</label>
          <input
            type="month" value={end} min={MIN_MONTH}
            onChange={(e) => setEnd(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          />
        </div>
      </div>

      {loading && <div className="text-center py-10 text-gray-400">Carregando...</div>}

      {!loading && (
        <>
          {/* By category — horizontal bar chart + table side by side */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Horizontal bar chart */}
            <div className="bg-white rounded-xl shadow p-5">
              <h2 className="font-semibold mb-4">Distribuição por Categoria</h2>
              {byCategory.length === 0 ? (
                <p className="text-sm text-gray-400">Sem dados</p>
              ) : (
                <ResponsiveContainer width="100%" height={barChartHeight}>
                  <BarChart
                    layout="vertical"
                    data={byCategory}
                    margin={{ top: 0, right: 80, left: 0, bottom: 0 }}
                  >
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                    />
                    <YAxis
                      type="category"
                      dataKey="category"
                      tick={{ fontSize: 11 }}
                      width={130}
                    />
                    <Tooltip
                      formatter={(v, _name, props) => {
                        const pct = grandTotal > 0 ? ((v / grandTotal) * 100).toFixed(1) : '0.0';
                        return [`${fmtCurrency(v)} (${pct}%)`, 'Total'];
                      }}
                    />
                    <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                      {byCategory.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                      <LabelList
                        dataKey="total"
                        position="right"
                        formatter={(v) => {
                          const pct = grandTotal > 0 ? ((v / grandTotal) * 100).toFixed(0) : '0';
                          return `${pct}%`;
                        }}
                        style={{ fontSize: 10, fill: '#6b7280' }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Category table with % and expandable subcategories */}
            <div className="bg-white rounded-xl shadow p-5">
              <h2 className="font-semibold mb-4">Por Categoria</h2>
              {byCategory.length === 0 ? (
                <p className="text-sm text-gray-400">Sem dados</p>
              ) : (
                <div className="overflow-y-auto max-h-[520px]">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 bg-white">
                      <tr className="text-left text-gray-500 border-b">
                        <th className="pb-2 pr-2">Categoria</th>
                        <th className="pb-2 pr-2 text-right">Total</th>
                        <th className="pb-2 text-right">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byCategory.map((r, i) => {
                        const pct = grandTotal > 0 ? ((r.total / grandTotal) * 100).toFixed(1) : '0.0';
                        const hasSubcats = r.subcategories?.length > 0;
                        return (
                          <React.Fragment key={r.category}>
                            <tr
                              className={`border-b hover:bg-gray-50 ${hasSubcats ? 'cursor-pointer' : ''}`}
                              onClick={() => hasSubcats && toggleCat(r.category)}
                            >
                              <td className="py-2 pr-2">
                                <div className="flex items-center gap-2">
                                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                    style={{ background: COLORS[i % COLORS.length] }} />
                                  <span>{r.category}</span>
                                  {hasSubcats && (
                                    <span className="text-gray-400 text-xs ml-auto">
                                      {expanded[r.category] ? '▲' : '▼'}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2 pr-2 text-right font-medium">{fmtCurrency(r.total)}</td>
                              <td className="py-2 text-right text-gray-500">{pct}%</td>
                            </tr>
                            {expanded[r.category] && r.subcategories.map((s) => {
                              const sPct = r.total > 0 ? ((s.total / r.total) * 100).toFixed(1) : '0.0';
                              return (
                                <tr key={s.subcategory} className="border-b bg-gray-50">
                                  <td className="py-1.5 pr-2 pl-7 text-gray-500 text-xs">
                                    › {s.subcategory}
                                  </td>
                                  <td className="py-1.5 pr-2 text-right text-xs">{fmtCurrency(s.total)}</td>
                                  <td className="py-1.5 text-right text-gray-400 text-xs">{sPct}%</td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t font-semibold bg-gray-50">
                        <td className="pt-2 pr-2">Total</td>
                        <td className="pt-2 pr-2 text-right">{fmtCurrency(grandTotal)}</td>
                        <td className="pt-2 text-right">100%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* By month */}
          <div className="bg-white rounded-xl shadow p-5">
            <h2 className="font-semibold mb-4">Gastos por Mês</h2>
            {byMonth.length === 0 ? (
              <p className="text-sm text-gray-400">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={byMonth} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v/1000).toFixed(1)}k`} />
                  <Tooltip formatter={(v) => fmtCurrency(v)} />
                  <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* By payment method */}
          <div className="bg-white rounded-xl shadow p-5">
            <h2 className="font-semibold mb-4">Por Método de Pagamento</h2>
            <div className="flex flex-wrap gap-6">
              {byMethod.map((r, i) => (
                <div key={r.payment_method} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <div>
                    <p className="text-sm font-medium">{r.payment_method}</p>
                    <p className="text-lg font-bold">{fmtCurrency(r.total)}</p>
                    <p className="text-xs text-gray-400">{r.count} lançamento(s)</p>
                  </div>
                </div>
              ))}
              {byMethod.length === 0 && <p className="text-sm text-gray-400">Sem dados</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
