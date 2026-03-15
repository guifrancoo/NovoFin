import React, { useEffect, useState, useCallback } from 'react';
import {
  getDashboard, getPaymentMethods, getCategories,
  updateExpense, updateGroup, deleteGroup,
  getDateRange, fmtCurrency, fmtDate,
} from '../api';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts';

const COLORS = [
  '#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6',
  '#ec4899','#14b8a6','#f97316','#6366f1','#84cc16','#06b6d4','#a855f7',
];

const MONTH_LABELS = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

function currentYM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ─── Month navigation ──────────────────────────────────────────────────────────
function MonthNav({ value, onChange, minMonth, maxMonth }) {
  const [year, month] = value.split('-').map(Number);
  const minY = minMonth ? Number(minMonth.split('-')[0]) : 2016;
  const maxY = maxMonth ? Number(maxMonth.split('-')[0]) : new Date().getFullYear();
  const years = [];
  for (let y = minY; y <= maxY; y++) years.push(y);

  const handleMonth = (e) => {
    onChange(`${year}-${String(e.target.value).padStart(2, '0')}`);
  };
  const handleYear = (e) => {
    onChange(`${e.target.value}-${String(month).padStart(2, '0')}`);
  };

  const atMin = minMonth ? value <= minMonth : false;
  const atMax = value >= (maxMonth || currentYM());

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChange(shiftMonth(value, -1))}
        disabled={atMin}
        className="px-2 py-1 rounded border text-sm hover:bg-gray-100 disabled:opacity-30"
      >←</button>
      <select
        value={month}
        onChange={handleMonth}
        className="border rounded px-2 py-1 text-sm"
      >
        {MONTH_LABELS.map((label, i) => (
          <option key={i + 1} value={i + 1}>{label}</option>
        ))}
      </select>
      <select
        value={year}
        onChange={handleYear}
        className="border rounded px-2 py-1 text-sm"
      >
        {years.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
      <button
        onClick={() => onChange(shiftMonth(value, 1))}
        disabled={atMax}
        className="px-2 py-1 rounded border text-sm hover:bg-gray-100 disabled:opacity-30"
      >→</button>
    </div>
  );
}

// ─── Edit Modal ────────────────────────────────────────────────────────────────
function EditModal({ expense, methods, categories, onSave, onClose }) {
  const isGroup = expense.installments > 1;

  const [form, setForm] = useState({
    purchase_date:      expense.purchase_date,
    category:           expense.category,
    subcategory:        expense.subcategory || '',
    location:           expense.location || '',
    payment_method:     expense.payment_method,
    description:        expense.description || '',
    // Always show absolute value — sign is handled on submit
    total_amount:       String(Math.abs(expense.total_amount)),
    installment_amount: String(Math.abs(expense.installment_amount)),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      if (isGroup) {
        await updateGroup(expense.group_id, {
          purchase_date:  form.purchase_date,
          category:       form.category,
          subcategory:    form.subcategory || null,
          location:       form.location || null,
          payment_method: form.payment_method,
          description:    form.description || null,
          // Store as negative (expense convention)
          total_amount:   -Math.abs(parseFloat(form.total_amount)),
        });
      } else {
        await updateExpense(expense.id, {
          purchase_date:      form.purchase_date,
          category:           form.category,
          subcategory:        form.subcategory || null,
          location:           form.location || null,
          payment_method:     form.payment_method,
          description:        form.description || null,
          installment_amount: -Math.abs(parseFloat(form.installment_amount)),
        });
      }
      onSave();
    } catch (e) {
      setError(e.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">Editar lançamento</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}

          {isGroup && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded px-3 py-2">
              Compra parcelada em <strong>{expense.installments}x</strong> — todas as parcelas serão atualizadas.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Data da compra</label>
              <input type="date" value={form.purchase_date} onChange={set('purchase_date')}
                className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
            </div>
            <div>
              {isGroup ? (
                <>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Total (R$)</label>
                  <input type="number" step="0.01" min="0.01" value={form.total_amount} onChange={set('total_amount')}
                    className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                </>
              ) : (
                <>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Valor (R$)</label>
                  <input type="number" step="0.01" min="0.01" value={form.installment_amount} onChange={set('installment_amount')}
                    className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                </>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Categoria</label>
            <select value={form.category} onChange={set('category')}
              className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400">
              {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Subcategoria (opcional)</label>
            <input type="text" value={form.subcategory} onChange={set('subcategory')} placeholder="Subcategoria..."
              className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Local</label>
            <input type="text" value={form.location} onChange={set('location')} placeholder="Estabelecimento..."
              className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Método de pagamento</label>
            <select value={form.payment_method} onChange={set('payment_method')}
              className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400">
              {methods.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Descrição</label>
            <input type="text" value={form.description} onChange={set('description')} placeholder="Observações..."
              className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
          </div>
        </div>

        <div className="px-5 py-4 border-t flex justify-end gap-2">
          <button onClick={onClose}
            className="px-4 py-2 rounded border text-sm hover:bg-gray-50">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Dialog ─────────────────────────────────────────────────────────────
function DeleteDialog({ expense, onConfirm, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5 space-y-4">
        <h2 className="font-semibold text-gray-800">Confirmar exclusão</h2>
        <p className="text-sm text-gray-600">
          {expense.installments > 1
            ? <>Este lançamento faz parte de uma compra parcelada em <strong>{expense.installments}x</strong>. Todas as parcelas serão excluídas.</>
            : <>Tem certeza que deseja excluir <strong>{expense.location || expense.category}</strong> de <strong>{fmtCurrency(Math.abs(expense.installment_amount))}</strong>?</>
          }
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose}
            className="px-4 py-2 rounded border text-sm hover:bg-gray-50">Cancelar</button>
          <button onClick={onConfirm}
            className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white text-sm">
            Excluir{expense.installments > 1 ? ` todas (${expense.installments}x)` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard page ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [month, setMonth]   = useState(currentYM);
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [methods, setMethods] = useState([]);
  const [categories, setCats] = useState([]);
  const [editingExpense, setEditingExpense] = useState(null);
  const [deleteTarget,   setDeleteTarget]   = useState(null);
  const [minMonth, setMinMonth] = useState('');
  const maxMonth = currentYM();

  const loadDashboard = useCallback(() => {
    setLoading(true);
    getDashboard(month).then((r) => setData(r.data)).finally(() => setLoading(false));
  }, [month]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  useEffect(() => {
    getPaymentMethods().then((r) => setMethods(r.data));
    getCategories().then((r) => setCats(r.data));
    getDateRange().then((r) => {
      if (r.data.min_month) setMinMonth(r.data.min_month);
    });
  }, []);

  const handleSaved = () => { setEditingExpense(null); loadDashboard(); };

  const handleDeleteConfirm = async () => {
    await deleteGroup(deleteTarget.group_id);
    setDeleteTarget(null);
    loadDashboard();
  };

  if (loading || !data) {
    return <div className="text-center py-20 text-gray-400">Carregando...</div>;
  }

  const net = data.income - data.expense;

  return (
    <div className="space-y-6">
      {/* Modals */}
      {editingExpense && (
        <EditModal
          expense={editingExpense}
          methods={methods}
          categories={categories}
          onSave={handleSaved}
          onClose={() => setEditingExpense(null)}
        />
      )}
      {deleteTarget && (
        <DeleteDialog
          expense={deleteTarget}
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <MonthNav value={month} onChange={setMonth} minMonth={minMonth} maxMonth={maxMonth} />
      </div>

      {/* KPI cards — 4 cards: Receita, Despesa, Saldo mês, Saldo acumulado */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-sm text-gray-500">Receita</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{fmtCurrency(data.income)}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-sm text-gray-500">Despesa</p>
          <p className="text-2xl font-bold text-red-500 mt-1">{fmtCurrency(data.expense)}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-sm text-gray-500">Saldo do mês</p>
          <p className={`text-2xl font-bold mt-1 ${net >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {fmtCurrency(net)}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-sm text-gray-500">Saldo de caixa</p>
          <p className={`text-2xl font-bold mt-1 ${data.net_accumulated >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {fmtCurrency(data.net_accumulated)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Dinheiro acumulado até {month.split('-').reverse().join('/')}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bar: monthly evolution — two bars */}
        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="font-semibold mb-4">Evolução mensal</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.monthly_evolution} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v/1000).toFixed(1)}k`} />
              <Tooltip formatter={(v, name) => [fmtCurrency(v), name === 'expense' ? 'Despesa' : 'Receita']} />
              <Legend formatter={(name) => name === 'expense' ? 'Despesa' : 'Receita'} />
              <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="income"  fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie: expenses by category */}
        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="font-semibold mb-2">Por categoria (despesas)</h2>
          {data.by_category.length === 0 ? (
            <p className="text-sm text-gray-400">Sem dados</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={data.by_category}
                    dataKey="total"
                    nameKey="category"
                    cx="50%" cy="50%"
                    outerRadius={80}
                    label={false}
                  >
                    {data.by_category.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => fmtCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2">
                {data.by_category.map((r, i) => (
                  <div key={r.category} className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-xs text-gray-600 truncate" title={r.category}>
                      {r.category}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Expenses list — installment_number = 1 only */}
      <div className="bg-white rounded-xl shadow p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Lançamentos do mês</h2>
          <span className="text-sm text-gray-400">{data.recent_expenses.length} compras</span>
        </div>
        {data.recent_expenses.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhum lançamento neste mês.</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="max-h-[480px] overflow-y-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-2 pr-4">Data</th>
                    <th className="pb-2 pr-4">Categoria</th>
                    <th className="pb-2 pr-4">Local</th>
                    <th className="pb-2 pr-4">Pagamento</th>
                    <th className="pb-2 pr-4">Parcelas</th>
                    <th className="pb-2 text-right pr-4">Total</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_expenses.map((e) => (
                    <tr key={e.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-1.5 pr-4 whitespace-nowrap">{fmtDate(e.purchase_date)}</td>
                      <td className="py-1.5 pr-4">
                        {e.category}
                        {e.subcategory && (
                          <span className="text-gray-400 text-xs"> › {e.subcategory}</span>
                        )}
                      </td>
                      <td className="py-1.5 pr-4 text-gray-500">{e.location || '—'}</td>
                      <td className="py-1.5 pr-4">
                        <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">
                          {e.payment_method}
                        </span>
                      </td>
                      <td className="py-1.5 pr-4 text-gray-400 text-xs">
                        {e.installments > 1 ? `${e.installments}x` : '—'}
                      </td>
                      <td className={`py-1.5 pr-4 text-right font-medium whitespace-nowrap ${e.total_amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {fmtCurrency(Math.abs(e.total_amount))}
                      </td>
                      <td className="py-1.5 whitespace-nowrap">
                        <button
                          onClick={() => setEditingExpense(e)}
                          className="text-gray-400 hover:text-blue-600 px-1 transition-colors"
                          title="Editar"
                        >✏️</button>
                        <button
                          onClick={() => setDeleteTarget(e)}
                          className="text-gray-400 hover:text-red-500 px-1 transition-colors"
                          title="Excluir"
                        >🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
