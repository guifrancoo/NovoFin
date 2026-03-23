import React, { useState, useEffect } from 'react';
import {
  createExpense, getPaymentMethods, getCategories, getSubcategories, fmtCurrency,
} from '../api';

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy/40 transition-colors';
const labelCls = 'block text-xs font-medium text-gray-500 mb-1.5';

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const INITIAL = {
  purchase_date:    localToday(),
  category:         '',
  subcategory:      '',
  location:         '',
  payment_method:   '',
  description:      '',
  total_amount:     '',
  installments:     '1',
  is_international: false,
};

export default function NewExpense() {
  const [type, setType]             = useState('despesa');
  const [form, setForm]             = useState(INITIAL);
  const [methods, setMethods]       = useState([]);
  const [categories, setCats]       = useState([]);
  const [subcategories, setSubcats] = useState([]);
  const [success, setSuccess]       = useState(null);
  const [error, setError]           = useState(null);
  const [loading, setLoading]       = useState(false);

  useEffect(() => {
    getPaymentMethods().then((r) => setMethods(r.data));
    getCategories().then((r) => setCats(r.data));
  }, []);

  const handleTypeChange = (newType) => {
    setType(newType);
    setForm((f) => ({ ...f, category: '', subcategory: '', payment_method: '', installments: '1' }));
    setSubcats([]);
  };

  useEffect(() => {
    if (!form.category) { setSubcats([]); return; }
    const cat = categories.find((c) => c.name === form.category);
    if (!cat) { setSubcats([]); return; }
    getSubcategories(cat.id).then((r) => setSubcats(r.data));
    setForm((f) => ({ ...f, subcategory: '' }));
  }, [form.category, categories]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const isReceita = type === 'receita';
  const filteredCategories = categories.filter((c) =>
    isReceita ? c.is_income === 1 : c.is_income !== 1
  );

  const selectedMethod = methods.find((m) => m.name === form.payment_method);
  const isCard = selectedMethod?.is_card === 1;

  const preview = () => {
    const amt  = parseFloat(form.total_amount);
    const inst = Math.max(1, parseInt(form.installments, 10) || 1);
    if (!amt || amt <= 0) return null;
    return { amt, inst, per: amt / inst };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null); setSuccess(null); setLoading(true);
    try {
      const res = await createExpense({
        ...form,
        type,
        subcategory:      form.subcategory || null,
        total_amount:     parseFloat(form.total_amount),
        installments:     isReceita ? 1 : (parseInt(form.installments, 10) || 1),
        is_international: !isReceita && form.is_international ? 1 : 0,
      });
      setSuccess(res.data);
      setForm(INITIAL);
      setSubcats([]);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar');
    } finally {
      setLoading(false);
    }
  };

  const p = preview();

  return (
    <div className="p-4 md:px-5 md:py-4">
      <div className="max-w-lg mx-auto space-y-4">

        {/* Feedback */}
        {error && (
          <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl px-4 py-3 text-sm flex items-start gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
            </svg>
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-100 text-green-700 rounded-xl px-4 py-3 text-sm flex items-start gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            {isReceita
              ? `Receita de ${fmtCurrency(Math.abs(success[0].installment_amount))} registrada!`
              : `${success.length} parcela${success.length !== 1 ? 's' : ''} criada${success.length !== 1 ? 's' : ''}!${
                  success.length > 1 ? ` (${fmtCurrency(Math.abs(success[0].installment_amount))} / parcela)` : ''
                } — 1ª parcela: ${success[0]?.due_date?.slice(0, 7).split('-').reverse().join('/')}`
            }
          </div>
        )}

        {/* Formulário */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="text-sm font-semibold text-navy">
              {isReceita ? 'Nova receita' : 'Novo lançamento'}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">

            {/* Toggle tipo */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-xl">
              <button type="button" onClick={() => handleTypeChange('despesa')}
                className={`py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  !isReceita
                    ? 'bg-danger text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}>
                Despesa
              </button>
              <button type="button" onClick={() => handleTypeChange('receita')}
                className={`py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isReceita
                    ? 'bg-success text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}>
                Receita
              </button>
            </div>

            {/* Valor — destaque */}
            <div>
              <label className={labelCls}>{isReceita ? 'Valor recebido (R$)' : 'Valor total (R$)'}</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-400">R$</span>
                <input type="number" step="0.01" min="0.01"
                  value={form.total_amount} onChange={set('total_amount')} required
                  placeholder="0,00"
                  className={`${inputCls} pl-10 text-lg font-semibold ${isReceita ? 'text-success' : 'text-danger'}`} />
              </div>
              {!isReceita && p && p.inst > 1 && (
                <p className="text-xs text-gray-400 mt-1.5 bg-gray-50 rounded-lg px-3 py-1.5">
                  {p.inst}x de {fmtCurrency(p.per)} — total {fmtCurrency(p.amt)}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Data */}
              <div>
                <label className={labelCls}>{isReceita ? 'Data do recebimento' : 'Data da compra'}</label>
                <input type="date" value={form.purchase_date} onChange={set('purchase_date')}
                  required className={inputCls} />
              </div>
              {/* Parcelas */}
              {!isReceita && (
                <div>
                  <label className={labelCls}>Parcelas</label>
                  <input type="number" min="1" max="60"
                    value={form.installments} onChange={set('installments')}
                    className={inputCls} />
                </div>
              )}
            </div>

            {/* Categoria */}
            <div>
              <label className={labelCls}>Categoria</label>
              <select value={form.category} onChange={set('category')} required className={inputCls}>
                <option value="">Selecione...</option>
                {filteredCategories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>

            {/* Subcategoria */}
            {subcategories.length > 0 && (
              <div>
                <label className={labelCls}>Subcategoria <span className="text-gray-400 font-normal">(opcional)</span></label>
                <select value={form.subcategory} onChange={set('subcategory')} className={inputCls}>
                  <option value="">— nenhuma —</option>
                  {subcategories.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>
            )}

            {/* Local */}
            <div>
              <label className={labelCls}>{isReceita ? 'Origem / Fonte' : 'Local / Estabelecimento'}</label>
              <input type="text" value={form.location} onChange={set('location')}
                placeholder={isReceita ? 'Ex: Empresa XYZ' : 'Ex: Supermercado Extra'}
                className={inputCls} />
            </div>

            {/* Método de pagamento */}
            <div>
              <label className={labelCls}>{isReceita ? 'Conta de destino' : 'Método de pagamento'}</label>
              <select value={form.payment_method} onChange={set('payment_method')} required className={inputCls}>
                <option value="">Selecione...</option>
                {methods.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
              </select>
              {isCard && (
                <p className="text-xs text-blue-600 mt-1.5 flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
                  </svg>
                  Cartão de crédito — vencimento calculado pela data de corte
                </p>
              )}
            </div>

            {/* Compra internacional */}
            {!isReceita && (
              <div className="flex items-center gap-3 py-1">
                <button type="button"
                  onClick={() => setForm((f) => ({ ...f, is_international: !f.is_international }))}
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                    form.is_international ? 'bg-amber-400' : 'bg-gray-200'
                  }`}>
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                    form.is_international ? 'translate-x-4.5' : 'translate-x-0.5'
                  }`} style={{ transform: form.is_international ? 'translateX(18px)' : 'translateX(2px)' }} />
                </button>
                <span className="text-sm text-gray-600">🌍 Compra internacional</span>
              </div>
            )}

            {/* Descrição */}
            <div>
              <label className={labelCls}>Descrição <span className="text-gray-400 font-normal">(opcional)</span></label>
              <input type="text" value={form.description} onChange={set('description')}
                placeholder="Observações..." className={inputCls} />
            </div>

            {/* Botão */}
            <button type="submit" disabled={loading}
              className={`w-full py-3 rounded-xl text-white text-sm font-semibold transition-colors disabled:opacity-50 ${
                isReceita ? 'bg-success hover:opacity-90' : 'bg-navy hover:bg-navy-light'
              }`}>
              {loading
                ? 'Salvando...'
                : isReceita ? 'Salvar receita' : 'Salvar lançamento'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
