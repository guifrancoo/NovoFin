import React, { useEffect, useState } from 'react';
import {
  getReportByCategory, getReportByMonth, getReportByPaymentMethod,
  fmtCurrency,
} from '../api';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const COLORS = [
  '#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6',
  '#ec4899','#14b8a6','#f97316','#6366f1','#84cc16','#06b6d4','#a855f7',
];

function ymMinus(months) {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function currentYM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function Reports() {
  const [start, setStart] = useState(ymMinus(5));
  const [end,   setEnd]   = useState(currentYM);
  const [byCategory, setByCategory] = useState([]);
  const [byMonth,    setByMonth]    = useState([]);
  const [byMethod,   setByMethod]   = useState([]);
  const [loading, setLoading]       = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getReportByCategory({ start, end }),
      getReportByMonth({ start, end }),
      getReportByPaymentMethod({ start, end }),
    ]).then(([cat, mon, met]) => {
      setByCategory(cat.data);
      setByMonth(mon.data);
      setByMethod(met.data);
    }).finally(() => setLoading(false));
  }, [start, end]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <div className="flex items-center gap-2 ml-auto">
          <label className="text-sm text-gray-600">De</label>
          <input type="month" value={start} onChange={(e) => setStart(e.target.value)}
            className="border rounded px-2 py-1 text-sm" />
          <label className="text-sm text-gray-600">até</label>
          <input type="month" value={end} onChange={(e) => setEnd(e.target.value)}
            className="border rounded px-2 py-1 text-sm" />
        </div>
      </div>

      {loading && <div className="text-center py-10 text-gray-400">Carregando...</div>}

      {!loading && (
        <>
          {/* By category table + pie */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow p-5">
              <h2 className="font-semibold mb-4">Por Categoria</h2>
              <div className="space-y-2">
                {byCategory.map((r, i) => {
                  const total = byCategory.reduce((s, x) => s + x.total, 0);
                  const pct   = total > 0 ? (r.total / total) * 100 : 0;
                  return (
                    <div key={r.category}>
                      <div className="flex justify-between text-sm mb-0.5">
                        <span>{r.category}</span>
                        <span className="font-medium">{fmtCurrency(r.total)}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }}
                        />
                      </div>
                    </div>
                  );
                })}
                {byCategory.length === 0 && <p className="text-sm text-gray-400">Sem dados</p>}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow p-5">
              <h2 className="font-semibold mb-4">Distribuicao por Categoria</h2>
              {byCategory.length === 0 ? (
                <p className="text-sm text-gray-400">Sem dados</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={byCategory} dataKey="total" nameKey="category"
                      cx="50%" cy="50%" outerRadius={90} label={false}>
                      {byCategory.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend formatter={(v) => <span className="text-xs">{v}</span>} />
                    <Tooltip formatter={(v) => fmtCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* By month bar */}
          <div className="bg-white rounded-xl shadow p-5">
            <h2 className="font-semibold mb-4">Gastos por Mes</h2>
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
            <h2 className="font-semibold mb-4">Por Metodo de Pagamento</h2>
            <div className="flex flex-wrap gap-6">
              {byMethod.map((r, i) => (
                <div key={r.payment_method} className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ background: COLORS[i % COLORS.length] }}
                  />
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
