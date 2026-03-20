import React, { useEffect, useState } from 'react';
import {
  getInvoices, getPaymentMethods, getCategories,
  createExpense, updateExpense, updateGroup, deleteGroup, fmtCurrency, fmtDate,
} from '../api';

const CARD_COLORS = { TAM: 'bg-blue-600', 'Outro Cartão': 'bg-purple-600' };

// ─── Edit Modal ────────────────────────────────────────────────────────────────
function EditModal({ expense, methods, categories, onSave, onClose }) {
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
    setError('');
    setSaving(true);
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
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">Editar lançamento</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}

          {installmentsChanged ? (
            <p className="text-xs text-amber-700 bg-amber-50 rounded px-3 py-2">
              Alterar parcelas irá recriar todos os vencimentos deste grupo.
            </p>
          ) : isGroup ? (
            <p className="text-xs text-amber-700 bg-amber-50 rounded px-3 py-2">
              Compra parcelada em <strong>{expense.installments}x</strong> — todas as parcelas serão atualizadas.
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Data da compra</label>
              <input type="date" value={form.purchase_date} onChange={set('purchase_date')}
                className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {showTotal ? 'Total (R$)' : 'Valor (R$)'}
              </label>
              {showTotal ? (
                <input type="number" step="0.01" min="0.01" value={form.total_amount} onChange={set('total_amount')}
                  className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
              ) : (
                <input type="number" step="0.01" min="0.01" value={form.installment_amount} onChange={set('installment_amount')}
                  className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
              )}
            </div>
          </div>

          {!isIncome && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Parcelas</label>
              <input type="number" min="1" max="48" value={form.installments} onChange={set('installments')}
                className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
              {newInstallments > 1 && (
                <p className="text-xs text-gray-400 mt-0.5">
                  Cada parcela: {fmtCurrency(Math.abs(parseFloat(form.total_amount) / newInstallments))}
                </p>
              )}
            </div>
          )}

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

// ─── Invoices page ─────────────────────────────────────────────────────────────
export default function Invoices() {
  const [data, setData]                 = useState(null);
  const [loading, setLoading]           = useState(false);
  const [expanded, setExpanded]         = useState({});
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [editingExpense, setEditingExpense] = useState(null);
  const [methods, setMethods]           = useState([]);
  const [categories, setCats]           = useState([]);

  const loadInvoices = () => {
    setLoading(true);
    getInvoices()
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadInvoices();
    getPaymentMethods().then((r) => setMethods(r.data));
    getCategories().then((r) => setCats(r.data));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (key) => setExpanded((p) => ({ ...p, [key]: !p[key] }));
  const handleSaved = () => { setEditingExpense(null); loadInvoices(); };

  if (loading || !data) {
    return <div className="text-center py-20 text-gray-400">Carregando...</div>;
  }

  // Collect all years from all cards
  const allYears = [...new Set(
    Object.values(data).flatMap((mm) => Object.keys(mm).map((m) => m.split('-')[0]))
  )].sort((a, b) => b - a); // most recent first

  // Default para o ano atual; cai para o mais recente com dados se o atual não existir
  const activeYear = (selectedYear && allYears.includes(selectedYear)) ? selectedYear : (allYears[0] || '');

  const hasAny = Object.values(data).some((mm) => Object.keys(mm).length > 0);

  return (
    <div className="space-y-6">
      {editingExpense && (
        <EditModal
          expense={editingExpense}
          methods={methods}
          categories={categories}
          onSave={handleSaved}
          onClose={() => setEditingExpense(null)}
        />
      )}

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
                              <th className="pb-1 text-right pr-4">Valor</th>
                              <th className="pb-1"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {info.expenses.map((e) => (
                              <tr key={e.id} className={`border-b last:border-0 ${e.is_international ? 'bg-yellow-50 hover:bg-yellow-100' : 'hover:bg-gray-50'}`}>
                                <td className="py-1.5 pr-4">{fmtDate(e.due_date)}</td>
                                <td className="py-1.5 pr-4">{e.category}</td>
                                <td className="py-1.5 pr-4 text-gray-500">
                                  {e.is_international ? <span className="mr-1">🌍</span> : null}
                                  {e.location || '—'}
                                </td>
                                <td className="py-1.5 pr-4 text-gray-500">
                                  {e.installments > 1 ? `${e.installment_number}/${e.installments}` : '—'}
                                </td>
                                <td className="py-1.5 pr-4 text-right font-medium">
                                  {fmtCurrency(Math.abs(e.installment_amount))}
                                </td>
                                <td className="py-1.5 whitespace-nowrap">
                                  <button
                                    onClick={() => setEditingExpense(e)}
                                    className="text-gray-400 hover:text-blue-600 px-1 transition-colors"
                                    title="Editar"
                                  >✏️</button>
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
