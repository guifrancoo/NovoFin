import React, { useState, useEffect } from 'react';
import {
  createExpense, getPaymentMethods, getCategories, fmtCurrency,
} from '../api';

const INITIAL = {
  purchase_date: new Date().toISOString().slice(0, 10),
  category: '',
  location: '',
  payment_method: '',
  description: '',
  total_amount: '',
  installments: '1',
};

export default function NewExpense() {
  const [form, setForm]       = useState(INITIAL);
  const [methods, setMethods] = useState([]);
  const [categories, setCats] = useState([]);
  const [success, setSuccess] = useState(null);
  const [error, setError]     = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getPaymentMethods().then((r) => setMethods(r.data));
    getCategories().then((r) => setCats(r.data));
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

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
        total_amount: parseFloat(form.total_amount),
        installments: parseInt(form.installments, 10) || 1,
      });
      setSuccess(res.data);
      setForm(INITIAL);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar');
    } finally {
      setLoading(false);
    }
  };

  const p = preview();

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Novo Gasto</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">
          {success.length} parcela(s) criada(s) com sucesso!
          {success.length > 1 && (
            <span className="ml-1">
              ({fmtCurrency(success[0].installment_amount)} / parcela)
            </span>
          )}
          {success[0] && (
            <span className="ml-1">
              — 1ª parcela: {success[0].due_date.slice(0, 7).split('-').reverse().join('/')}
            </span>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 space-y-4">
        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Data da compra</label>
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
            {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Local / Estabelecimento</label>
          <input
            type="text" value={form.location} onChange={set('location')}
            placeholder="Ex: Supermercado Extra"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {/* Payment method */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Método de Pagamento</label>
          <select
            value={form.payment_method} onChange={set('payment_method')} required
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Selecione...</option>
            {methods.map((m) => (
              <option key={m.id} value={m.name}>{m.name}</option>
            ))}
          </select>
          {isCard && (
            <p className="text-xs text-blue-600 mt-1">
              Cartão de crédito — o vencimento será calculado pela data de corte
            </p>
          )}
        </div>

        {/* Amount + installments */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Valor total (R$)</label>
            <input
              type="number" step="0.01" min="0.01"
              value={form.total_amount} onChange={set('total_amount')} required
              placeholder="0,00"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Parcelas</label>
            <input
              type="number" min="1" max="60"
              value={form.installments} onChange={set('installments')}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        {p && p.inst > 1 && (
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
          className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors"
        >
          {loading ? 'Salvando...' : 'Salvar Gasto'}
        </button>
      </form>
    </div>
  );
}
