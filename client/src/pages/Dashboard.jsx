import React, { useEffect, useState } from 'react';
import { getDashboard, fmtCurrency, fmtDate } from '../api';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const COLORS = [
  '#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6',
  '#ec4899','#14b8a6','#f97316','#6366f1','#84cc16','#06b6d4','#a855f7',
];

function currentYM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function MonthPicker({ value, onChange }) {
  return (
    <input
      type="month"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="border rounded px-2 py-1 text-sm"
    />
  );
}

export default function Dashboard() {
  const [month, setMonth] = useState(currentYM);
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getDashboard(month)
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  }, [month]);

  if (loading || !data) {
    return <div className="text-center py-20 text-gray-400">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <MonthPicker value={month} onChange={setMonth} />
      </div>

      {/* KPI card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow p-5 col-span-1 sm:col-span-1">
          <p className="text-sm text-gray-500">Total do mês</p>
          <p className="text-3xl font-bold text-brand-700 mt-1">{fmtCurrency(data.total)}</p>
        </div>
        {data.by_payment_method.map((r) => (
          <div key={r.payment_method} className="bg-white rounded-xl shadow p-5">
            <p className="text-sm text-gray-500">{r.payment_method}</p>
            <p className="text-2xl font-semibold mt-1">{fmtCurrency(r.total)}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bar: monthly evolution */}
        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="font-semibold mb-4">Evolução mensal</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.monthly_evolution} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v/1000).toFixed(1)}k`} />
              <Tooltip formatter={(v) => fmtCurrency(v)} />
              <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie: by category */}
        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="font-semibold mb-4">Por categoria</h2>
          {data.by_category.length === 0 ? (
            <p className="text-sm text-gray-400">Sem dados</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={data.by_category}
                  dataKey="total"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={false}
                >
                  {data.by_category.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Legend
                  formatter={(v) => <span className="text-xs">{v}</span>}
                />
                <Tooltip formatter={(v) => fmtCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent expenses */}
      <div className="bg-white rounded-xl shadow p-5">
        <h2 className="font-semibold mb-4">Lançamentos recentes</h2>
        {data.recent_expenses.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhum lançamento neste mês.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2 pr-4">Vencimento</th>
                  <th className="pb-2 pr-4">Categoria</th>
                  <th className="pb-2 pr-4">Local</th>
                  <th className="pb-2 pr-4">Pagamento</th>
                  <th className="pb-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_expenses.map((e) => (
                  <tr key={e.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2 pr-4">{fmtDate(e.due_date)}</td>
                    <td className="py-2 pr-4">{e.category}</td>
                    <td className="py-2 pr-4 text-gray-500">{e.location || '—'}</td>
                    <td className="py-2 pr-4">
                      <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">
                        {e.payment_method}
                      </span>
                    </td>
                    <td className="py-2 text-right font-medium">{fmtCurrency(e.installment_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
