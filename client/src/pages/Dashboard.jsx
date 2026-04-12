import React, { useEffect, useState, useCallback } from 'react';
import {
  getDashboard, getPaymentMethods, getCategories,
  createExpense, updateExpense, updateGroup, deleteGroup,
  getDateRange, fmtCurrency, fmtDate, setRecorrente,
} from '../api';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
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

function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTH_LABELS[m - 1]} ${y}`;
}

// ─── Input / Select styles ─────────────────────────────────────────────────────
const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy/40 transition-colors';
const labelCls = 'block text-xs font-medium text-gray-500 mb-1';

// ─── MonthNav ──────────────────────────────────────────────────────────────────
function MonthNav({ value, onChange, minMonth, maxMonth }) {
  const [year, month] = value.split('-').map(Number);
  const minY = minMonth ? Number(minMonth.split('-')[0]) : 2016;
  const maxY = maxMonth ? Number(maxMonth.split('-')[0]) : new Date().getFullYear();
  const years = [];
  for (let y = minY; y <= maxY; y++) years.push(y);
  const atMin = false;
  const atMax = false;

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => onChange(shiftMonth(value, -1))}
        disabled={atMin}
        className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-30 text-gray-600 text-sm transition-colors"
      >‹</button>
      <select value={month}
        onChange={(e) => onChange(`${year}-${String(e.target.value).padStart(2, '0')}`)}
        className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-navy/20">
        {MONTH_LABELS.map((l, i) => <option key={i + 1} value={i + 1}>{l}</option>)}
      </select>
      <select value={year}
        onChange={(e) => onChange(`${e.target.value}-${String(month).padStart(2, '0')}`)}
        className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-navy/20">
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
      <button
        onClick={() => onChange(shiftMonth(value, 1))}
        disabled={atMax}
        className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-30 text-gray-600 text-sm transition-colors"
      >›</button>
    </div>
  );
}

function MonthYearPicker({ value, onChange, minMonth, maxMonth }) {
  const [year, month] = value.split('-').map(Number);
  const minY = minMonth ? Number(minMonth.split('-')[0]) : 2000;
  const maxY = maxMonth ? Number(maxMonth.split('-')[0]) : new Date().getFullYear();
  const years = [];
  for (let y = minY; y <= maxY; y++) years.push(y);
  return (
    <div className="flex gap-1">
      <select value={month}
        onChange={(e) => onChange(`${year}-${String(e.target.value).padStart(2, '0')}`)}
        className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none">
        {MONTH_LABELS.map((l, i) => <option key={i + 1} value={i + 1}>{l}</option>)}
      </select>
      <select value={year}
        onChange={(e) => onChange(`${e.target.value}-${String(month).padStart(2, '0')}`)}
        className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none">
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  );
}

// ─── Recorrente Badge ──────────────────────────────────────────────────────────
function RecorrenteBadge({ expense, onUpdated }) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading]       = useState(false);

  async function handleConfirm(e) {
    e.stopPropagation();
    setLoading(true);
    try {
      await setRecorrente(expense.id, 0);
      onUpdated(expense.id, 0);
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <span className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
        <span className="text-[10px] text-gray-500 whitespace-nowrap">Remover recorrência?</span>
        <button onClick={handleConfirm} disabled={loading}
          className="text-[10px] bg-red-100 text-red-600 hover:bg-red-200 px-1.5 py-0.5 rounded transition-colors disabled:opacity-50">
          {loading ? '…' : 'Sim'}
        </button>
        <button onClick={e => { e.stopPropagation(); setConfirming(false); }}
          className="text-[10px] bg-gray-100 text-gray-500 hover:bg-gray-200 px-1.5 py-0.5 rounded transition-colors">
          Não
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={e => { e.stopPropagation(); setConfirming(true); }}
      className="text-[10px] bg-blue-50 text-blue-500 hover:bg-blue-100 px-2 py-0.5 rounded-full transition-colors"
      title="Clique para remover recorrência deste lançamento"
    >
      🔁 recorrente
    </button>
  );
}

// ─── Edit Modal ────────────────────────────────────────────────────────────────
function EditModal({ expense, methods, categories, onSave, onClose, onDelete }) {
  const isGroup  = expense.installments > 1;
  const isIncome = expense.total_amount > 0;

  const [form, setForm] = useState({
    purchase_date:      expense.purchase_date,
    category:           expense.category,
    subcategory:        expense.subcategory || '',
    location:           expense.location || '',
    payment_method:     expense.payment_method,
    description:        expense.description || '',
    total_amount:       String(Math.abs(expense.total_amount)),
    installment_amount: String(Math.abs(expense.installment_amount)),
    installments:       String(expense.installments || 1),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const newInstallments     = Math.max(1, parseInt(form.installments, 10) || 1);
  const installmentsChanged = newInstallments !== (expense.installments || 1);
  const showTotal           = isGroup || newInstallments > 1;

  const handleSave = async () => {
    setError(''); setSaving(true);
    try {
      if (installmentsChanged) {
        await deleteGroup(expense.group_id);
        await createExpense({
          purchase_date:    form.purchase_date,
          category:         form.category,
          subcategory:      form.subcategory || null,
          location:         form.location || null,
          payment_method:   form.payment_method,
          description:      form.description || null,
          total_amount:     Math.abs(parseFloat(form.total_amount)),
          installments:     newInstallments,
          type:             isIncome ? 'receita' : 'despesa',
          is_international: expense.is_international || 0,
        });
      } else if (isGroup) {
        await updateGroup(expense.group_id, {
          purchase_date:  form.purchase_date,
          category:       form.category,
          subcategory:    form.subcategory || null,
          location:       form.location || null,
          payment_method: form.payment_method,
          description:    form.description || null,
          total_amount:   isIncome ? Math.abs(parseFloat(form.total_amount)) : -Math.abs(parseFloat(form.total_amount)),
        });
      } else {
        await updateExpense(expense.id, {
          purchase_date:      form.purchase_date,
          category:           form.category,
          subcategory:        form.subcategory || null,
          location:           form.location || null,
          payment_method:     form.payment_method,
          description:        form.description || null,
          installment_amount: isIncome ? Math.abs(parseFloat(form.installment_amount)) : -Math.abs(parseFloat(form.installment_amount)),
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-navy text-sm">Editar lançamento</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors text-lg leading-none">✕</button>
        </div>
        <div className="px-5 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
          {error && <p className="text-xs text-danger bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          {installmentsChanged ? (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              Alterar parcelas irá recriar todos os vencimentos deste grupo.
            </p>
          ) : isGroup ? (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              Compra parcelada em <strong>{expense.installments}x</strong> — todas as parcelas serão atualizadas.
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Data da compra</label>
              <input type="date" value={form.purchase_date} onChange={set('purchase_date')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{showTotal ? 'Total (R$)' : 'Valor (R$)'}</label>
              {showTotal
                ? <input type="number" step="0.01" min="0.01" value={form.total_amount} onChange={set('total_amount')} className={inputCls} />
                : <input type="number" step="0.01" min="0.01" value={form.installment_amount} onChange={set('installment_amount')} className={inputCls} />}
            </div>
          </div>
          {!isIncome && (
            <div>
              <label className={labelCls}>Parcelas</label>
              <input type="number" min="1" max="48" value={form.installments} onChange={set('installments')} className={inputCls} />
              {newInstallments > 1 && (
                <p className="text-xs text-gray-400 mt-1">Cada parcela: {fmtCurrency(Math.abs(parseFloat(form.total_amount) / newInstallments))}</p>
              )}
            </div>
          )}
          <div>
            <label className={labelCls}>Categoria</label>
            <select value={form.category} onChange={set('category')} className={inputCls}>
              {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Subcategoria (opcional)</label>
            <input type="text" value={form.subcategory} onChange={set('subcategory')} placeholder="Subcategoria..." className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Local</label>
            <input type="text" value={form.location} onChange={set('location')} placeholder="Estabelecimento..." className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Método de pagamento</label>
            <select value={form.payment_method} onChange={set('payment_method')} className={inputCls}>
              {methods.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Descrição</label>
            <input type="text" value={form.description} onChange={set('description')} placeholder="Observações..." className={inputCls} />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2 shrink-0">
          <button onClick={onDelete} className="mr-auto px-4 py-2 rounded-lg border border-red-200 text-sm text-danger hover:bg-red-50 transition-colors">Excluir</button>
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 rounded-lg bg-navy text-white text-sm hover:bg-navy-light disabled:opacity-50 transition-colors">
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <h2 className="font-semibold text-navy text-sm">Confirmar exclusão</h2>
        <p className="text-sm text-gray-600">
          {expense.installments > 1
            ? <>Este lançamento faz parte de uma compra parcelada em <strong>{expense.installments}x</strong>. Todas as parcelas serão excluídas.</>
            : <>Tem certeza que deseja excluir <strong>{expense.location || expense.category}</strong> de <strong>{fmtCurrency(Math.abs(expense.installment_amount))}</strong>?</>}
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">Cancelar</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-lg bg-danger text-white text-sm hover:opacity-90 transition-opacity">
            Excluir{expense.installments > 1 ? ` todas (${expense.installments}x)` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Metric Card ───────────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, color, barPct }) {
  const colorMap = {
    green: { val: 'text-success', bar: 'bg-success' },
    red:   { val: 'text-danger',  bar: 'bg-danger'  },
    blue:  { val: 'text-brand-600', bar: 'bg-brand-500' },
    gray:  { val: 'text-navy',    bar: 'bg-navy'    },
  };
  const c = colorMap[color] || colorMap.gray;
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">{label}</div>
      <div className={`text-xl font-semibold ${c.val} whitespace-nowrap`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1.5">{sub}</div>}
      <div className="h-[3px] bg-gray-100 rounded-full mt-4 overflow-hidden">
        <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${Math.min(100, barPct ?? 0)}%` }} />
      </div>
    </div>
  );
}

// ─── Mobile Header Card ────────────────────────────────────────────────────────
function MobileHeader({ data, month, mode, onPrev, onNext, atMin, atMax, periodLabel }) {
  const net = data.income - data.expense;
  return (
    <div className="md:hidden bg-navy px-4 pt-4 pb-6">
      <div className="text-white/50 text-xs mb-0.5">{mode === 'month' ? monthLabel(month) : periodLabel}</div>
      <div className="text-white font-semibold text-base mb-3">Olá, {localStorage.getItem('username') || 'Admin'}</div>
      <div className="bg-white/10 rounded-xl p-3 mb-4">
        <div className="text-white/50 text-[10px] uppercase tracking-wider mb-1">Saldo de caixa</div>
        <div className="text-white text-2xl font-semibold">{fmtCurrency(data.net_accumulated)}</div>
      </div>
      <div className="flex items-center justify-between">
        <button onClick={onPrev} disabled={atMin}
          className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 disabled:opacity-30 text-sm">‹</button>
        <div className="text-white/70 text-xs font-medium">{mode === 'month' ? monthLabel(month) : periodLabel}</div>
        <button onClick={onNext} disabled={atMax}
          className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 disabled:opacity-30 text-sm">›</button>
      </div>
    </div>
  );
}

// ─── Ícones por categoria ──────────────────────────────────────────────────────
const CAT_ICONS = {
  'Alimentação':          { icon: '🛒', bg: '#fef3cd' },
  'Bares e Restaurantes': { icon: '🍔', bg: '#fff0e6' },
  'Moradia':              { icon: '🏠', bg: '#fde8e8' },
  'Transporte':           { icon: '🚗', bg: '#e8f4fd' },
  'Saúde':                { icon: '💊', bg: '#fde8e8' },
  'Educação':             { icon: '📚', bg: '#e8f4fd' },
  'Lazer':                { icon: '🎬', bg: '#f3e8fd' },
  'Viagem':               { icon: '✈️', bg: '#e8f4fd' },
  'Compras':              { icon: '🛍️', bg: '#fef3cd' },
  'Investimento':         { icon: '📈', bg: '#d5f5e3' },
  'Família':              { icon: '👨‍👩‍👧', bg: '#fde8e8' },
  'Telefone':             { icon: '📱', bg: '#eafaf1' },
  'Salário':              { icon: '💰', bg: '#d5f5e3' },
  'Receita':              { icon: '💰', bg: '#d5f5e3' },
  'Outras Rendas':        { icon: '💵', bg: '#d5f5e3' },
  'Contas':               { icon: '⚡', bg: '#e8f4fd' },
  'Presentes':            { icon: '🎁', bg: '#fde8e8' },
  'Trabalho':             { icon: '💼', bg: '#f0f0f0' },
  'Despesas do Trabalho': { icon: '💼', bg: '#f0f0f0' },
  'Outros':               { icon: '📦', bg: '#f0f0f0' },
  'Saques':               { icon: '💸', bg: '#fef3cd' },
  'Pagamentos Cartões':   { icon: '💳', bg: '#e8f4fd' },
};

function CatIcon({ category, isIncome }) {
  const cat = CAT_ICONS[category];
  if (isIncome && !cat) return (
    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0" style={{ background: '#d5f5e3' }}>💰</div>
  );
  if (cat) return (
    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0" style={{ background: cat.bg }}>{cat.icon}</div>
  );
  return (
    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-gray-100">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="3"/>
      </svg>
    </div>
  );
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [mode, setMode]           = useState('month');
  const [month, setMonth]         = useState(currentYM);
  const [rangeStart, setRangeStart] = useState(() => `${new Date().getFullYear()}-01`);
  const [rangeEnd, setRangeEnd]   = useState(currentYM);
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(false);
  const [methods, setMethods]     = useState([]);
  const [categories, setCats]     = useState([]);
  const [catFilter, setCatFilter] = useState('');
  const [editingExpense, setEditingExpense] = useState(null);
  const [deleteTarget, setDeleteTarget]     = useState(null);
  const [minMonth, setMinMonth]   = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const maxMonth = currentYM();

  const apiParams = mode === 'month' ? { month } : { start: rangeStart, end: rangeEnd };

  const loadDashboard = useCallback(() => {
    setLoading(true);
    getDashboard(apiParams).then((r) => setData(r.data)).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, month, rangeStart, rangeEnd, refreshKey]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);
  useEffect(() => {
    getPaymentMethods().then((r) => setMethods(r.data));
    getCategories().then((r) => setCats(r.data));
    getDateRange().then((r) => { if (r.data.min_month) setMinMonth(r.data.min_month); });
  }, []);

  const applyPreset = (label) => {
    const now = currentYM();
    if (label === '3m') { setRangeStart(shiftMonth(now, -2)); setRangeEnd(now); }
    if (label === '6m') { setRangeStart(shiftMonth(now, -5)); setRangeEnd(now); }
    if (label === 'ano') { setRangeStart(`${new Date().getFullYear()}-01`); setRangeEnd(now); }
    setMode('range');
  };

  const handleSaved = () => { setEditingExpense(null); setRefreshKey(k => k + 1); };
  const handleRecorrenteUpdated = (id, value) => {
    setData(d => ({
      ...d,
      recent_expenses: (d?.recent_expenses ?? []).map(e =>
        e.id === id ? { ...e, recorrente: value } : e
      ),
    }));
  };
  const handleDeleteConfirm = async () => {
    await deleteGroup(deleteTarget.group_id);
    setDeleteTarget(null);
    loadDashboard();
  };

  const allExpenses = data?.recent_expenses ?? [];
  const filteredExpenses = catFilter ? allExpenses.filter((e) => e.category === catFilter) : allExpenses;

  const atMin = false;
  const atMax = false;

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-gray-400 animate-pulse">Carregando...</div>
      </div>
    );
  }

  const net = data.income - data.expense;
  const isRange = mode === 'range';
  const periodLabel = isRange
    ? `${rangeStart.split('-').reverse().join('/')} – ${rangeEnd.split('-').reverse().join('/')}`
    : month.split('-').reverse().join('/');

  const maxExpense = Math.max(data.income, data.expense, 1);
  const maxCatTotal = data.by_category?.length > 0
    ? Math.max(...data.by_category.map((r) => Math.abs(r.total)), 1)
    : 1;

  return (
    <>
      {editingExpense && (
        <EditModal expense={editingExpense} methods={methods} categories={categories}
          onSave={handleSaved} onClose={() => setEditingExpense(null)}
          onDelete={() => { setDeleteTarget(editingExpense); setEditingExpense(null); }} />
      )}
      {deleteTarget && (
        <DeleteDialog expense={deleteTarget} onConfirm={handleDeleteConfirm}
          onClose={() => setDeleteTarget(null)} />
      )}

      {/* Mobile header */}
      <MobileHeader
        data={data} month={month} mode={mode} periodLabel={periodLabel}
        onPrev={() => setMonth(shiftMonth(month, -1))}
        onNext={() => setMonth(shiftMonth(month, 1))}
        atMin={atMin} atMax={atMax}
      />

      {/* Desktop topbar controls — injected via padding area */}
      <div className="hidden md:flex items-center gap-3 px-5 pt-4 pb-0 flex-wrap">
        {/* Mode toggle */}
        <div className="flex bg-gray-100 rounded-lg p-0.5 text-xs">
          <button onClick={() => setMode('month')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${mode === 'month' ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            Mês
          </button>
          <button onClick={() => setMode('range')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${mode === 'range' ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            Período
          </button>
        </div>

        {mode === 'month' ? (
          <MonthNav value={month} onChange={setMonth} minMonth={minMonth} maxMonth={maxMonth} />
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            {['3m','6m','ano'].map((p) => (
              <button key={p} onClick={() => applyPreset(p)}
                className="px-2.5 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors">
                {p === '3m' ? 'Últimos 3 meses' : p === '6m' ? 'Últimos 6 meses' : 'Este ano'}
              </button>
            ))}
            <span className="text-gray-300">|</span>
            <span className="text-xs text-gray-500">De</span>
            <MonthYearPicker value={rangeStart} onChange={setRangeStart} minMonth={minMonth} maxMonth={rangeEnd} />
            <span className="text-xs text-gray-500">até</span>
            <MonthYearPicker value={rangeEnd} onChange={setRangeEnd} minMonth={rangeStart} maxMonth={maxMonth} />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 md:px-5 md:py-4 space-y-4">

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard label="Receita" value={fmtCurrency(data.income)}
            color="green" barPct={(data.income / maxExpense) * 100} />
          <MetricCard label="Despesa" value={fmtCurrency(data.expense)}
            color="red" barPct={(data.expense / maxExpense) * 100} />
          <MetricCard label={isRange ? 'Saldo do período' : 'Saldo do mês'}
            value={fmtCurrency(net)} color={net >= 0 ? 'green' : 'red'}
            barPct={100} />
          <MetricCard label="Saldo de caixa" value={fmtCurrency(data.net_accumulated)}
            sub={`Acumulado até ${periodLabel}`}
            color={data.net_accumulated >= 0 ? 'blue' : 'red'}
            barPct={Math.min(100, Math.abs(data.net_accumulated) / Math.max(Math.abs(data.expense), 1) * 30)} />
        </div>

        {/* Middle: transactions + categories */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Transactions */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden flex flex-col">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-navy">
                {isRange ? 'Lançamentos do período' : 'Lançamentos do mês'}
              </span>
              <div className="flex items-center gap-2">
                <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600 focus:outline-none">
                  <option value="">Todas as categorias</option>
                  {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
                <span className="text-xs text-gray-400">{filteredExpenses.length} itens</span>
              </div>
            </div>
            <div className="overflow-y-auto max-h-[520px] md:max-h-[460px]">
              {filteredExpenses.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-400">
                  {catFilter ? `Nenhum lançamento em "${catFilter}".` : 'Nenhum lançamento neste período.'}
                </div>
              ) : (
                <>
                  {/* Desktop table header */}
                  <div className="hidden md:flex items-center gap-2 px-3 py-2 border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
                    <div className="w-7 shrink-0" />
                    <div className="w-[100px] shrink-0 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Data</div>
                    <div className="flex-1 min-w-0 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Descrição</div>
                    <div className="w-[140px] shrink-0 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Categoria</div>
                    <div className="w-[100px] shrink-0 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Método</div>
                    <div className="w-[80px] shrink-0 text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-center">Parcelas</div>
                    <div className="w-[110px] shrink-0 text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-right">Valor</div>
                    <div className="w-[62px] shrink-0" />
                  </div>

                  {filteredExpenses.map((e) => (
                    <div key={e.id}
                      onClick={() => setEditingExpense(e)}
                      className={`flex items-center gap-2 px-3 py-2 border-b border-gray-50 last:border-0 group cursor-pointer ${e.is_international ? 'bg-amber-50/50' : 'hover:bg-gray-50/60'} transition-colors`}>

                      {/* Icon — always visible */}
                      <CatIcon category={e.category} isIncome={e.total_amount > 0} />

                      {/* ── Mobile layout (stacked) ── */}
                      <div className="flex-1 min-w-0 md:hidden">
                        <div className="text-[10px] text-gray-400">{fmtDate(e.purchase_date)}</div>
                        <div className="flex items-center gap-1.5">
                          {!!e.is_international && <span className="text-xs">🌍</span>}
                          <span className="text-xs font-medium text-navy leading-tight">{e.location || e.category}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-gray-400">{e.category}{e.subcategory ? ` › ${e.subcategory}` : ''}</span>
                          <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{e.payment_method}</span>
                          {e.installments > 1 && (
                            <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{e.installments}x</span>
                          )}
                          {!!e.recorrente && (
                            <RecorrenteBadge expense={e} onUpdated={handleRecorrenteUpdated} />
                          )}
                        </div>
                      </div>
                      <div className={`md:hidden ml-auto pl-2 shrink-0 text-right text-xs font-semibold whitespace-nowrap ${e.total_amount < 0 ? 'text-danger' : 'text-success'}`}>
                        {e.total_amount < 0 ? '- ' : '+ '}{fmtCurrency(Math.abs(e.total_amount))}
                      </div>

                      {/* ── Desktop layout (table columns) ── */}
                      {/* DATA */}
                      <div className="hidden md:block w-[100px] shrink-0 text-xs text-gray-400 tabular-nums">
                        {fmtDate(e.purchase_date)}
                      </div>
                      {/* DESCRIÇÃO */}
                      <div className="hidden md:flex flex-1 min-w-0 items-center gap-1.5">
                        {!!e.is_international && <span className="text-xs shrink-0">🌍</span>}
                        <span className="text-xs font-medium text-navy truncate">{e.location || e.category}</span>
                        {!!e.recorrente && (
                          <span className="shrink-0"><RecorrenteBadge expense={e} onUpdated={handleRecorrenteUpdated} /></span>
                        )}
                      </div>
                      {/* CATEGORIA */}
                      <div className="hidden md:block w-[140px] shrink-0 text-xs text-gray-500 truncate" title={e.category}>
                        {e.category}{e.subcategory ? ` › ${e.subcategory}` : ''}
                      </div>
                      {/* MÉTODO */}
                      <div className="hidden md:block w-[100px] shrink-0 text-xs text-gray-500 truncate">
                        {e.payment_method}
                      </div>
                      {/* PARCELAS */}
                      <div className="hidden md:flex w-[80px] shrink-0 justify-center">
                        {e.installments > 1 && (
                          <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{e.installments}x</span>
                        )}
                      </div>
                      {/* VALOR */}
                      <div className={`hidden md:block w-[110px] shrink-0 text-right text-xs font-semibold whitespace-nowrap ${e.total_amount < 0 ? 'text-danger' : 'text-success'}`}>
                        {e.total_amount < 0 ? '- ' : '+ '}{fmtCurrency(Math.abs(e.total_amount))}
                      </div>

                      {/* Actions */}
                      <div className="hidden md:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button onClick={(ev) => { ev.stopPropagation(); setEditingExpense(e); }}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button onClick={(ev) => { ev.stopPropagation(); setDeleteTarget(e); }}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                            <path d="M10 11v6"/><path d="M14 11v6"/>
                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Categories */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden flex flex-col">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-navy">Por categoria</span>
              <span className="text-xs text-gray-400">{data.by_category?.length ?? 0} categorias</span>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 460 }}>
              {(!data.by_category || data.by_category.length === 0) ? (
                <div className="p-8 text-center text-sm text-gray-400">Sem dados</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="sticky top-0 bg-white border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-gray-400 px-5 py-3 uppercase tracking-wide">Categoria</th>
                      <th className="text-left text-xs font-medium text-gray-400 px-3 py-3 w-28 uppercase tracking-wide">Dist.</th>
                      <th className="text-right text-xs font-medium text-gray-400 px-3 py-3 uppercase tracking-wide">%</th>
                      <th className="text-right text-xs font-medium text-gray-400 px-5 py-3 uppercase tracking-wide">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_category.map((row, i) => {
                      const pct = data.expense > 0 ? Math.abs(row.total) / data.expense * 100 : 0;
                      const barW = maxCatTotal > 0 ? Math.abs(row.total) / maxCatTotal * 100 : 0;
                      const color = CAT_COLORS[i % CAT_COLORS.length];
                      return (
                        <tr key={row.category} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2.5">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                              <span className="text-sm text-gray-700 truncate" title={row.category}>{row.category}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="w-20 h-[4px] bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${barW}%`, background: color }} />
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right text-xs text-gray-500">{pct.toFixed(1)}%</td>
                          <td className={`px-5 py-3 text-right text-sm font-medium whitespace-nowrap ${row.total < 0 ? 'text-danger' : 'text-success'}`}>
                            {row.total < 0 ? '- ' : '+ '}{fmtCurrency(Math.abs(row.total))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Evolução mensal */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-navy">Evolução mensal</span>
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-success" />
                <span className="text-xs text-gray-400">Receita</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-danger" />
                <span className="text-xs text-gray-400">Despesa</span>
              </div>
            </div>
          </div>
          <div className="px-4 py-4">
            {(!data.monthly_evolution || data.monthly_evolution.length === 0) ? (
              <div className="h-36 flex items-center justify-center text-sm text-gray-400">Sem dados</div>
            ) : (
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={data.monthly_evolution} margin={{ top: 0, right: 8, left: -10, bottom: 0 }} barCategoryGap="30%">
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '0.5px solid #e5e7eb', boxShadow: 'none' }}
                    formatter={(v, name) => [fmtCurrency(v), name === 'expense' ? 'Despesa' : 'Receita']} />
                  <Bar dataKey="expense" fill="#c0392b" radius={[3, 3, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="income"  fill="#27ae60" radius={[3, 3, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>
    </>
  );
}
