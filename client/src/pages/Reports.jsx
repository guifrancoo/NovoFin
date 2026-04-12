import React, { useEffect, useState } from 'react';
import {
  getReportByCategory, getReportByMonth, getReportByPaymentMethod,
  getDateRange, fmtCurrency,
} from '../api';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts';

const CAT_COLORS = [
  '#3498db','#e67e22','#9b59b6','#1abc9c','#e74c3c',
  '#f39c12','#27ae60','#e84393','#2980b9','#7f8c8d','#16a085','#95a5a6',
];

const MONTH_LABELS = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

function currentYM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const inputCls = 'border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 transition-colors';

function MonthYearPicker({ value, onChange, minMonth, maxMonth }) {
  const [year, month] = value.split('-').map(Number);
  const minY = minMonth ? Number(minMonth.split('-')[0]) : 2016;
  const maxY = maxMonth ? Number(maxMonth.split('-')[0]) : new Date().getFullYear();
  const years = [];
  for (let y = minY; y <= maxY; y++) years.push(y);
  return (
    <div className="flex items-center gap-1">
      <select value={month}
        onChange={(e) => onChange(`${year}-${String(e.target.value).padStart(2, '0')}`)}
        className={inputCls}>
        {MONTH_LABELS.map((l, i) => <option key={i + 1} value={i + 1}>{l}</option>)}
      </select>
      <select value={year}
        onChange={(e) => onChange(`${e.target.value}-${String(month).padStart(2, '0')}`)}
        className={inputCls}>
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  );
}

// ─── Tooltip customizado ───────────────────────────────────────────────────────
function CustomTooltip({ active, payload, grandTotal }) {
  if (!active || !payload?.length) return null;
  const { category, total } = payload[0].payload;
  const pct = grandTotal > 0 ? ((total / grandTotal) * 100).toFixed(1) : '0.0';
  return (
    <div className="bg-white border border-gray-100 rounded-xl px-3 py-2.5 shadow-sm text-xs">
      <div className="font-medium text-navy mb-1">{category}</div>
      <div className={total < 0 ? 'text-danger' : 'text-success'}>
        {total < 0 ? '- ' : '+ '}{fmtCurrency(Math.abs(total))} <span className="text-gray-400">({pct}%)</span>
      </div>
    </div>
  );
}

function MonthTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl px-3 py-2.5 shadow-sm text-xs">
      <div className="font-medium text-navy mb-1">{label}</div>
      <div className="text-gray-600">{fmtCurrency(payload[0].value)}</div>
    </div>
  );
}

export default function Reports() {
  const [minMonth, setMinMonth] = useState('2016-01');
  const maxMonth = currentYM();
  const [start, setStart] = useState(() => `${new Date().getFullYear()}-01`);
  const [end, setEnd]     = useState(currentYM);
  const [byCategory, setByCategory] = useState([]);
  const [byMonth, setByMonth]       = useState([]);
  const [byMethod, setByMethod]     = useState([]);
  const [loading, setLoading]       = useState(false);
  const [expanded, setExpanded]     = useState({});
  const [viewMode, setViewMode]     = useState('despesas');

  useEffect(() => {
    getDateRange().then((r) => { if (r.data.min_month) setMinMonth(r.data.min_month); });
  }, []);

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

  const displayData   = React.useMemo(() => {
    const data = viewMode === 'despesas' ? byCategory.filter((r) => !r.is_income) : byCategory;
    return [...data].sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
  }, [byCategory, viewMode]);

  const grandAbsTotal = displayData.reduce((s, r) => s + Math.abs(r.total), 0);
  const grandNetTotal = displayData.reduce((s, r) => s + r.total, 0);
  const grandTotal    = grandAbsTotal;
  const chartData     = displayData.map((r) => ({ ...r, totalAbs: Math.abs(r.total) }));
  const toggleCat    = (cat) => setExpanded((p) => ({ ...p, [cat]: !p[cat] }));
  const barChartH    = Math.max(220, displayData.length * 34);
  const methodTotal  = byMethod.reduce((s, r) => s + r.total, 0);

  return (
    <div className="p-4 md:px-5 md:py-4 space-y-4">

      {/* Filtro de período */}
      <div className="bg-white rounded-xl border border-gray-100 px-5 py-3.5 flex items-center gap-3 flex-wrap">
        <span className="text-xs font-medium text-gray-500">Período</span>
        <span className="text-xs text-gray-400">De</span>
        <MonthYearPicker value={start} onChange={setStart} minMonth={minMonth} maxMonth={maxMonth} />
        <span className="text-xs text-gray-400">até</span>
        <MonthYearPicker value={end} onChange={setEnd} minMonth={minMonth} maxMonth={maxMonth} />
        {loading && <span className="text-xs text-gray-400 animate-pulse ml-2">Carregando...</span>}
        <div className="ml-auto flex items-center bg-gray-100 rounded-lg p-0.5 text-xs">
          <button
            onClick={() => { setViewMode('despesas'); setExpanded({}); }}
            className={`px-3 py-1.5 rounded-md transition-all font-medium ${viewMode === 'despesas' ? 'bg-white shadow-sm text-navy' : 'text-gray-500 hover:text-gray-700'}`}>
            Despesas
          </button>
          <button
            onClick={() => { setViewMode('completo'); setExpanded({}); }}
            className={`px-3 py-1.5 rounded-md transition-all font-medium ${viewMode === 'completo' ? 'bg-white shadow-sm text-navy' : 'text-gray-500 hover:text-gray-700'}`}>
            Completo
          </button>
        </div>
      </div>

      {!loading && (
        <>
          {/* Gráfico horizontal + tabela por categoria */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

            {/* Gráfico de barras horizontal */}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100">
                <span className="text-sm font-semibold text-navy">Distribuição por categoria</span>
              </div>
              <div className="px-4 py-4">
                {byCategory.length === 0 ? (
                  <div className="h-40 flex items-center justify-center text-sm text-gray-400">Sem dados</div>
                ) : (
                  <ResponsiveContainer width="100%" height={barChartH}>
                    <BarChart layout="vertical" data={chartData}
                      margin={{ top: 0, right: 60, left: 0, bottom: 0 }}>
                      <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                        tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="category" tick={{ fontSize: 11, fill: '#374151' }}
                        width={140} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip grandTotal={grandAbsTotal} />} />
                      <Bar dataKey="totalAbs" radius={[0, 4, 4, 0]} maxBarSize={20}>
                        {chartData.map((entry, i) => (
                          <Cell key={i} fill={
                            viewMode === 'completo'
                              ? (entry.is_income ? '#27ae60' : '#e74c3c')
                              : CAT_COLORS[i % CAT_COLORS.length]
                          } />
                        ))}
                        <LabelList dataKey="totalAbs" position="right"
                          formatter={(v) => {
                            const pct = grandAbsTotal > 0 ? ((v / grandAbsTotal) * 100).toFixed(0) : '0';
                            return `${pct}%`;
                          }}
                          style={{ fontSize: 10, fill: '#9ca3af' }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Tabela por categoria */}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden flex flex-col">
              <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                <span className="text-sm font-semibold text-navy">Por categoria</span>
                <span className="text-xs text-gray-400">{displayData.length} categorias</span>
              </div>
              <div className="overflow-y-auto flex-1" style={{ maxHeight: barChartH + 32 }}>
                {displayData.length === 0 ? (
                  <div className="p-8 text-center text-sm text-gray-400">Sem dados</div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="sticky top-0 bg-white border-b border-gray-100">
                        <th className="text-left text-xs font-medium text-gray-400 px-5 py-2.5 uppercase tracking-wide">Categoria</th>
                        <th className="text-right text-xs font-medium text-gray-400 px-3 py-2.5 uppercase tracking-wide">Total</th>
                        <th className="text-right text-xs font-medium text-gray-400 px-5 py-2.5 uppercase tracking-wide">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayData.map((r, i) => {
                        const pct = grandAbsTotal > 0 ? ((Math.abs(r.total) / grandAbsTotal) * 100).toFixed(1) : '0.0';
                        const hasSubcats = r.subcategories?.length > 0;
                        const isOpen = expanded[r.category];
                        const color = viewMode === 'completo'
                          ? (r.is_income ? '#27ae60' : '#e74c3c')
                          : CAT_COLORS[i % CAT_COLORS.length];
                        return (
                          <React.Fragment key={r.category}>
                            <tr
                              className={`border-b border-gray-50 transition-colors ${hasSubcats ? 'cursor-pointer hover:bg-gray-50/60' : 'hover:bg-gray-50/40'}`}
                              onClick={() => hasSubcats && toggleCat(r.category)}>
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-2.5">
                                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                                  <span className="text-sm text-gray-700">{r.category}</span>
                                  {hasSubcats && (
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                                      stroke="#9ca3af" strokeWidth="2"
                                      className={`ml-auto transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                                      <polyline points="6 9 12 15 18 9"/>
                                    </svg>
                                  )}
                                </div>
                              </td>
                              <td className={`px-3 py-3 text-right text-sm font-medium whitespace-nowrap ${r.total < 0 ? 'text-danger' : 'text-success'}`}>
                                {r.total < 0 ? '- ' : '+ '}{fmtCurrency(Math.abs(r.total))}
                              </td>
                              <td className="px-5 py-3 text-right text-xs text-gray-500">{pct}%</td>
                            </tr>
                            {isOpen && r.subcategories.map((s) => {
                              const sPct = r.total !== 0 ? ((Math.abs(s.total) / Math.abs(r.total)) * 100).toFixed(1) : '0.0';
                              return (
                                <tr key={s.subcategory} className="border-b border-gray-50 bg-gray-50/40">
                                  <td className="px-5 py-2 pl-12">
                                    <div className="flex items-center gap-2">
                                      <span className="w-1 h-1 rounded-full bg-gray-300" />
                                      <span className="text-xs text-gray-500">{s.subcategory}</span>
                                    </div>
                                  </td>
                                  <td className={`px-3 py-2 text-right text-xs ${s.total < 0 ? 'text-danger' : 'text-success'}`}>
                                    {s.total < 0 ? '- ' : '+ '}{fmtCurrency(Math.abs(s.total))}
                                  </td>
                                  <td className="px-5 py-2 text-right text-xs text-gray-400">{sPct}%</td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-gray-200 bg-gray-50/50">
                        <td className="px-5 py-3 text-sm font-semibold text-navy">Total</td>
                        <td className={`px-3 py-3 text-right text-sm font-semibold ${grandNetTotal < 0 ? 'text-danger' : 'text-success'}`}>
                          {grandNetTotal < 0 ? '- ' : '+ '}{fmtCurrency(Math.abs(grandNetTotal))}
                        </td>
                        <td className="px-5 py-3 text-right text-xs text-gray-500">100%</td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </div>
          </div>

          {/* Gastos por mês */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100">
              <span className="text-sm font-semibold text-navy">Gastos por mês</span>
            </div>
            <div className="px-4 py-4">
              {byMonth.length === 0 ? (
                <div className="h-36 flex items-center justify-center text-sm text-gray-400">Sem dados</div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={byMonth} margin={{ top: 0, right: 8, left: -10, bottom: 0 }} barCategoryGap="30%">
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                      tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<MonthTooltip />} />
                    <Bar dataKey="total" fill="#185FA5" radius={[3, 3, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Por método de pagamento */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100">
              <span className="text-sm font-semibold text-navy">Por método de pagamento</span>
            </div>
            <div className="p-5">
              {byMethod.length === 0 ? (
                <div className="text-sm text-gray-400">Sem dados</div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {byMethod.map((r, i) => {
                    const color = CAT_COLORS[i % CAT_COLORS.length];
                    const pct = methodTotal > 0 ? ((r.total / methodTotal) * 100).toFixed(1) : '0.0';
                    return (
                      <div key={r.payment_method} className="bg-gray-50/60 rounded-xl p-4 border border-gray-100">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                          <span className="text-xs font-medium text-gray-600 truncate">{r.payment_method}</span>
                        </div>
                        <div className="text-lg font-semibold text-navy mb-1">{fmtCurrency(r.total)}</div>
                        <div className="text-xs text-gray-400">{r.count} lançamento{r.count !== 1 ? 's' : ''} · {pct}%</div>
                        <div className="mt-3 h-1 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
