import React, { useEffect, useState } from 'react';
import {
  getInvoices, getPaymentMethods, getCategories,
  createExpense, updateExpense, updateGroup, deleteGroup,
  checkExpense, fmtCurrency, fmtDate,
} from '../api';

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy/40 transition-colors';
const labelCls = 'block text-xs font-medium text-gray-500 mb-1';

// ─── Cores por cartão ──────────────────────────────────────────────────────────
const CARD_COLORS = {
  'TAM':          { bg: '#185FA5', light: '#1e72c2' },
  'Outro Cartão': { bg: '#534AB7', light: '#6259c4' },
};
function cardColor(method) {
  return CARD_COLORS[method] || { bg: '#374151', light: '#4b5563' };
}

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
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition-colors">✕</button>
        </div>
        <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
          {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          {installmentsChanged ? (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">Alterar parcelas irá recriar todos os vencimentos deste grupo.</p>
          ) : isGroup ? (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">Compra parcelada em <strong>{expense.installments}x</strong> — todas as parcelas serão atualizadas.</p>
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
        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
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

// ─── Invoices page ─────────────────────────────────────────────────────────────
export default function Invoices() {
  const [data, setData]                     = useState(null);
  const [loading, setLoading]               = useState(false);
  const [expanded, setExpanded]             = useState({});
  const [selectedYear, setSelectedYear]     = useState(String(new Date().getFullYear()));
  const [editingExpense, setEditingExpense] = useState(null);
  const [methods, setMethods]               = useState([]);
  const [categories, setCats]               = useState([]);
  const [checkedMap, setCheckedMap]         = useState({});

  const loadInvoices = () => {
    setLoading(true);
    getInvoices().then((r) => {
      setData(r.data);
      // Inicializar mapa de conferência a partir do banco
      const map = {};
      Object.values(r.data).forEach((monthMap) => {
        Object.values(monthMap).forEach((info) => {
          info.expenses.forEach((e) => { map[e.id] = !!e.is_checked; });
        });
      });
      setCheckedMap(map);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadInvoices();
    getPaymentMethods().then((r) => setMethods(r.data));
    getCategories().then((r) => setCats(r.data));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (key) => setExpanded((p) => ({ ...p, [key]: !p[key] }));
  const handleSaved = () => { setEditingExpense(null); loadInvoices(); };

  const handleCheck = async (expenseId, current) => {
    const next = !current;
    setCheckedMap((prev) => ({ ...prev, [expenseId]: next }));
    try {
      await checkExpense(expenseId, next);
    } catch (_) {
      setCheckedMap((prev) => ({ ...prev, [expenseId]: current }));
    }
  };

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-gray-400 animate-pulse">Carregando...</div>
      </div>
    );
  }

  const allYears = [...new Set(
    Object.values(data).flatMap((mm) => Object.keys(mm).map((m) => m.split('-')[0]))
  )].sort((a, b) => b - a);

  const activeYear = (selectedYear && allYears.includes(selectedYear))
    ? selectedYear : (allYears[0] || '');

  const hasAny = Object.values(data).some((mm) => Object.keys(mm).length > 0);

  return (
    <div className="p-4 md:px-5 md:py-4 space-y-4">
      {editingExpense && (
        <EditModal expense={editingExpense} methods={methods} categories={categories}
          onSave={handleSaved} onClose={() => setEditingExpense(null)} />
      )}

      {/* Seletor de ano */}
      {allYears.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {allYears.map((yr) => (
            <button key={yr}
              onClick={() => setSelectedYear(yr === activeYear ? '' : yr)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                yr === activeYear
                  ? 'bg-navy text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-navy/40 hover:text-navy'
              }`}>
              {yr}
            </button>
          ))}
        </div>
      )}

      {!hasAny && (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400 text-sm">
          Nenhum lançamento em cartão encontrado.
        </div>
      )}

      {/* Um painel por cartão */}
      {Object.entries(data).map(([method, monthMap]) => {
        const filteredMonths = Object.entries(monthMap)
          .filter(([m]) => !activeYear || m.startsWith(activeYear))
          .sort(([a], [b]) => a.localeCompare(b));

        if (filteredMonths.length === 0) return null;

        const yearTotal = filteredMonths.reduce((s, [, info]) => s + info.total, 0);
        const colors = cardColor(method);

        return (
          <div key={method} className="bg-white rounded-xl border border-gray-100 overflow-hidden">

            {/* Header do cartão */}
            <div className="flex items-center justify-between px-5 py-4"
              style={{ background: colors.bg }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2">
                    <rect x="2" y="5" width="20" height="14" rx="2"/>
                    <path d="M2 10h20"/>
                  </svg>
                </div>
                <div>
                  <div className="text-white font-semibold text-sm">{method}</div>
                  <div className="text-white/50 text-xs">{filteredMonths.length} faturas em {activeYear || 'todos os anos'}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-white/60 text-xs mb-0.5">{activeYear ? `Total ${activeYear}` : 'Total geral'}</div>
                <div className="text-white font-semibold text-base">{fmtCurrency(yearTotal)}</div>
              </div>
            </div>

            {/* Linhas de mês */}
            <div className="divide-y divide-gray-50">
              {filteredMonths.map(([month, info]) => {
                const key = `${method}-${month}`;
                const [yr, mo] = month.split('-');
                const label = new Date(Number(yr), Number(mo) - 1, 1)
                  .toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
                const isOpen = expanded[key];

                const checkedCount = info.expenses.filter((e) => checkedMap[e.id] ?? !!e.is_checked).length;
                const totalCount   = info.expenses.length;

                return (
                  <div key={month}>
                    {/* Linha do mês */}
                    <button onClick={() => toggle(key)}
                      className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/80 transition-colors group">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold"
                          style={{ background: colors.bg + '18', color: colors.bg }}>
                          {String(mo)}
                        </div>
                        <div className="text-left">
                          <div className="text-sm font-medium text-navy capitalize">{label}</div>
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <span>{totalCount} lançamento{totalCount !== 1 ? 's' : ''}</span>
                            {checkedCount > 0 && (
                              <span className="text-green-600 font-medium">
                                {checkedCount}/{totalCount} conferido{checkedCount !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-semibold text-navy">{fmtCurrency(info.total)}</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                          stroke="#9ca3af" strokeWidth="2"
                          className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </div>
                    </button>

                    {/* Detalhes expandidos */}
                    {isOpen && (
                      <div className="border-t border-gray-50 overflow-x-auto">
                        <table className="w-full table-fixed">
                          <colgroup>
                            <col style={{ width: '8%' }} />
                            <col style={{ width: '24%' }} />
                            <col style={{ width: '30%' }} />
                            <col className="hidden md:table-column" style={{ width: '0%' }} />
                            <col style={{ width: '12%' }} />
                            <col style={{ width: '18%' }} />
                            <col className="hidden md:table-column" style={{ width: '0%' }} />
                          </colgroup>
                          <thead>
                            <tr className="bg-gray-50/80">
                              <th className="px-3 py-2.5 w-8"></th>
                              <th className="text-left text-xs font-medium text-gray-400 px-3 py-2.5 uppercase tracking-wide whitespace-nowrap">Vencimento</th>
                              <th className="text-left text-xs font-medium text-gray-400 px-3 py-2.5 uppercase tracking-wide">Local</th>
                              <th className="hidden md:table-cell text-left text-xs font-medium text-gray-400 px-3 py-2.5 uppercase tracking-wide">Categoria</th>
                              <th className="text-center text-xs font-medium text-gray-400 px-3 py-2.5 uppercase tracking-wide whitespace-nowrap">Parcela</th>
                              <th className="text-right text-xs font-medium text-gray-400 px-3 py-2.5 uppercase tracking-wide">Valor</th>
                              <th className="hidden md:table-cell px-3 py-2.5 w-10"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {info.expenses.map((e) => {
                              const isChecked = checkedMap[e.id] ?? !!e.is_checked;
                              return (
                                <tr key={e.id}
                                  className={`border-t border-gray-50 group transition-colors ${
                                    isChecked
                                      ? 'bg-green-50/70 hover:bg-green-50'
                                      : e.is_international
                                        ? 'bg-amber-50/40 hover:bg-amber-50'
                                        : 'hover:bg-gray-50/60'
                                  }`}>
                                  {/* Checkbox de conferência */}
                                  <td className="px-2 py-3 text-center">
                                    <button
                                      onClick={() => handleCheck(e.id, isChecked)}
                                      title={isChecked ? 'Desmarcar' : 'Marcar como conferido'}
                                      className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                                        isChecked
                                          ? 'bg-green-500 border-green-500 text-white'
                                          : 'border-gray-300 text-transparent hover:border-green-400 hover:text-green-300'
                                      }`}>
                                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                        <polyline points="20 6 9 17 4 12"/>
                                      </svg>
                                    </button>
                                  </td>
                                  <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">{fmtDate(e.due_date)}</td>
                                  <td className="px-3 py-3">
                                    <div className="flex items-center gap-1.5">
                                      {!!e.is_international && <span className="text-xs">🌍</span>}
                                      <span className="text-xs text-navy font-medium truncate">{e.location || '—'}</span>
                                    </div>
                                  </td>
                                  <td className="hidden md:table-cell px-3 py-3">
                                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                                      {e.category}{e.subcategory ? ` › ${e.subcategory}` : ''}
                                    </span>
                                  </td>
                                  <td className="px-3 py-3 text-center">
                                    {e.installments > 1 ? (
                                      <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full font-medium">
                                        {e.installment_number}/{e.installments}
                                      </span>
                                    ) : (
                                      <span className="text-xs text-gray-300">—</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-3 text-right text-xs font-semibold text-navy whitespace-nowrap">
                                    {fmtCurrency(Math.abs(e.installment_amount))}
                                  </td>
                                  <td className="hidden md:table-cell px-3 py-3">
                                    <button onClick={() => setEditingExpense(e)}
                                      className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-blue-600 hover:bg-blue-50 opacity-0 group-hover:opacity-100 transition-all">
                                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                      </svg>
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          {/* Subtotal do mês */}
                          <tfoot>
                            <tr className="border-t border-gray-100 bg-gray-50/50">
                              <td className="px-3 py-2.5" />
                              <td colSpan={2} className="px-3 py-2.5 text-xs text-gray-400">
                                {totalCount} lançamento{totalCount !== 1 ? 's' : ''}
                                {checkedCount > 0 && (
                                  <span className="ml-2 text-green-600">• {checkedCount}/{totalCount} conferido{checkedCount !== 1 ? 's' : ''}</span>
                                )}
                              </td>
                              <td className="hidden md:table-cell" />
                              <td className="hidden md:table-cell" />
                              <td className="px-3 py-2.5 text-right text-xs font-semibold text-navy">{fmtCurrency(info.total)}</td>
                              <td className="hidden md:table-cell" />
                            </tr>
                          </tfoot>
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
