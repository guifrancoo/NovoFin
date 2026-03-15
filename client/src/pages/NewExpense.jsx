import React, { useState, useEffect } from 'react';
import {
  createExpense, getPaymentMethods, getCategories, getSubcategories, fmtCurrency,
} from '../api';

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const INITIAL = {
  purchase_date:  localToday(),
  category:       '',
  subcategory:    '',
  location:       '',
  payment_method: '',
  description:    '',
  total_amount:   '',
  installments:   '1',
};

export default function NewExpense() {
  const [type, setType]             = useState('despesa'); // 'despesa' | 'receita'
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

  // Resetar categoria e método ao trocar tipo
  const handleTypeChange = (newType) => {
    setType(newType);
    setForm((f) => ({ ...f, category: '', subcategory: '', payment_method: '', installments: '1' }));
    setSubcats([]);
  };

  // Load subcategories whenever category changes
  useEffect(() => {
    if (!form.category) { setSubcats([]); return; }
    const cat = categories.find((c) => c.name === form.category);
    if (!cat) { setSubcats([]); return; }
    getSubcategories(cat.id).then((r) => setSubcats(r.data));
    setForm((f) => ({ ...f, subcategory: '' }));
  }, [form.category, categories]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Filtra categorias por tipo
  const isReceita = type === 'receita';
  const filteredCategories = categories.filter((c) =>
    isReceita ? c.is_income === 1 : c.is_income !== 1
  );

  // Para receitas, ocultar métodos de cartão
  const filteredMethods = isReceita
    ? methods.filter((m) => !m.is_card)
    : methods;

  const selectedMethod = methods.find((m) => m.name === form.payment_method);
  const isCard = selectedMethod?.is_card;

  const preview = () => {
    const amt  = parseFloat(form.total_amount);
    const inst = Math.max(1, parseInt(form.installments, 10) || 1);
    if (!amt || amt <= 0) return null;
    return { amt, inst, per: amt / inst };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const res = await createExpense({
        ...form,
        type,
        subcategory:  form.subcategory || null,
        total_amount: parseFloat(form.total_amount),
        installments: isReceita ? 1 : (parseInt(form.installments, 10) || 1),
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
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">
        {isReceita ? 'Nova Receita' : 'Novo Gasto'}
      </h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">
          {isReceita
            ? `Receita de ${fmtCurrency(Math.abs(success[0].installment_amount))} registrada com sucesso!`
            : (
              <>
                {success.length} parcela(s) criada(s) com sucesso!
                {success.length > 1 && (
                  <span className="ml-1">
                    ({fmtCurrency(Math.abs(success[0].installment_amount))} / parcela)
                  </span>
                )}
                {success[0] && (
                  <span className="ml-1">
                    — 1ª parcela: {success[0].due_date.slice(0, 7).split('-').reverse().join('/')}
                  </span>
                )}
              </>
            )
          }
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 space-y-4">

        {/* Tipo de lançamento */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleTypeChange('despesa')}
            className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-colors border ${
              !isReceita
                ? 'bg-red-500 border-red-500 text-white'
                : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400'
            }`}
          >
            💸 Despesa
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange('receita')}
            className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-colors border ${
              isReceita
                ? 'bg-green-500 border-green-500 text-white'
                : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400'
            }`}
          >
            💰 Receita
          </button>
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {isReceita ? 'Data do recebimento' : 'Data da compra'}
          </label>
          <input
            type="date" value={form.purchase_date} onChange={set('purchase_date')} required
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
          <select
            value={form.category} onChange={set('category')} required
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Selecione...</option>
            {filteredCategories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>

        {/* Subcategory — only shown if category has subcategories */}
        {subcategories.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subcategoria <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <select
              value={form.subcategory} onChange={set('subcategory')}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">— nenhuma —</option>
              {subcategories.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </div>
        )}

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {isReceita ? 'Origem / Fonte' : 'Local / Estabelecimento'}
          </label>
          <input
            type="text" value={form.location} onChange={set('location')}
            placeholder={isReceita ? 'Ex: Empresa XYZ' : 'Ex: Supermercado Extra'}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {/* Payment method / Conta de destino */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {isReceita ? 'Conta de destino' : 'Método de Pagamento'}
          </label>
          <select
            value={form.payment_method} onChange={set('payment_method')} required
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Selecione...</option>
            {filteredMethods.map((m) => (
              <option key={m.id} value={m.name}>{m.name}</option>
            ))}
          </select>
          {isCard && (
            <p className="text-xs text-blue-600 mt-1">
              Cartão de crédito — o vencimento será calculado pela data de corte
            </p>
          )}
        </div>

        {/* Amount + installments (installments hidden for receita) */}
        <div className={isReceita ? '' : 'grid grid-cols-2 gap-4'}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isReceita ? 'Valor recebido (R$)' : 'Valor total (R$)'}
            </label>
            <input
              type="number" step="0.01" min="0.01"
              value={form.total_amount} onChange={set('total_amount')} required
              placeholder="0,00"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          {!isReceita && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Parcelas</label>
              <input
                type="number" min="1" max="60"
                value={form.installments} onChange={set('installments')}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          )}
        </div>

        {!isReceita && p && p.inst > 1 && (
          <p className="text-xs text-gray-500 bg-gray-50 rounded px-3 py-2">
            {p.inst}x de {fmtCurrency(p.per)} &mdash; total {fmtCurrency(p.amt)}
          </p>
        )}

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descrição (opcional)</label>
          <input
            type="text" value={form.description} onChange={set('description')}
            placeholder="Observações..."
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <button
          type="submit" disabled={loading}
          className={`w-full disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors ${
            isReceita
              ? 'bg-green-600 hover:bg-green-700'
              : 'bg-brand-600 hover:bg-brand-700'
          }`}
        >
          {loading
            ? 'Salvando...'
            : isReceita ? 'Salvar Receita' : 'Salvar Gasto'
          }
        </button>
      </form>
    </div>
  );
}
