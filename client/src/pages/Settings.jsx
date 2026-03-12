import React, { useState, useEffect, useCallback } from 'react';
import {
  getPaymentMethods, createPaymentMethod, deletePaymentMethod,
  getCategories, createCategory, deleteCategory,
  getCutoffDates, saveCutoffDate, deleteCutoffDate,
  MONTH_NAMES,
} from '../api';

// ─── Generic small helpers ───────────────────────────────────────────────────

function SectionCard({ title, description, children }) {
  return (
    <div className="bg-white rounded-xl shadow p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function ErrorBanner({ msg }) {
  if (!msg) return null;
  return <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{msg}</p>;
}

function Tag({ label, onDelete, disabled }) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-gray-100 rounded-full px-3 py-1 text-sm">
      {label}
      <button
        onClick={onDelete}
        disabled={disabled}
        title="Remover"
        className="text-gray-400 hover:text-red-500 disabled:opacity-30 transition-colors leading-none"
      >
        ✕
      </button>
    </span>
  );
}

// ─── Payment Methods section ─────────────────────────────────────────────────

function PaymentMethodsSection() {
  const [methods, setMethods] = useState([]);
  const [name, setName]       = useState('');
  const [isCard, setIsCard]   = useState(false);
  const [err, setErr]         = useState('');

  const load = useCallback(() => getPaymentMethods().then((r) => setMethods(r.data)), []);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    setErr('');
    if (!name.trim()) return setErr('Digite um nome');
    try {
      await createPaymentMethod({ name: name.trim(), is_card: isCard });
      setName(''); setIsCard(false);
      load();
    } catch (e) {
      setErr(e.response?.data?.error || 'Erro ao adicionar');
    }
  };

  const remove = async (id) => {
    setErr('');
    try {
      await deletePaymentMethod(id);
      load();
    } catch (e) {
      setErr(e.response?.data?.error || 'Erro ao remover');
    }
  };

  return (
    <SectionCard
      title="Métodos de Pagamento"
      description="Adicione ou remova formas de pagamento. Métodos marcados como cartão de crédito têm fatura e data de corte."
    >
      <div className="flex flex-wrap gap-2">
        {methods.map((m) => (
          <Tag
            key={m.id}
            label={m.is_card ? `${m.name} (cartão)` : m.name}
            onDelete={() => remove(m.id)}
          />
        ))}
        {methods.length === 0 && <p className="text-sm text-gray-400">Nenhum método cadastrado</p>}
      </div>

      <div className="flex flex-wrap gap-2 items-center pt-2 border-t">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Novo método..."
          className="border rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[160px] focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isCard}
            onChange={(e) => setIsCard(e.target.checked)}
            className="accent-brand-600"
          />
          É cartão de crédito
        </label>
        <button
          onClick={add}
          className="bg-brand-600 hover:bg-brand-700 text-white text-sm px-4 py-1.5 rounded-lg transition-colors"
        >
          Adicionar
        </button>
      </div>
      <ErrorBanner msg={err} />
    </SectionCard>
  );
}

// ─── Categories section ───────────────────────────────────────────────────────

function CategoriesSection() {
  const [cats, setCats] = useState([]);
  const [name, setName] = useState('');
  const [err, setErr]   = useState('');

  const load = useCallback(() => getCategories().then((r) => setCats(r.data)), []);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    setErr('');
    if (!name.trim()) return setErr('Digite um nome');
    try {
      await createCategory({ name: name.trim() });
      setName('');
      load();
    } catch (e) {
      setErr(e.response?.data?.error || 'Erro ao adicionar');
    }
  };

  const remove = async (id) => {
    setErr('');
    try {
      await deleteCategory(id);
      load();
    } catch (e) {
      setErr(e.response?.data?.error || 'Erro ao remover');
    }
  };

  return (
    <SectionCard
      title="Categorias"
      description="Adicione ou remova categorias de gastos."
    >
      <div className="flex flex-wrap gap-2">
        {cats.map((c) => (
          <Tag key={c.id} label={c.name} onDelete={() => remove(c.id)} />
        ))}
        {cats.length === 0 && <p className="text-sm text-gray-400">Nenhuma categoria cadastrada</p>}
      </div>

      <div className="flex gap-2 items-center pt-2 border-t">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Nova categoria..."
          className="border rounded-lg px-3 py-1.5 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button
          onClick={add}
          className="bg-brand-600 hover:bg-brand-700 text-white text-sm px-4 py-1.5 rounded-lg transition-colors"
        >
          Adicionar
        </button>
      </div>
      <ErrorBanner msg={err} />
    </SectionCard>
  );
}

// ─── Cutoff Dates section ─────────────────────────────────────────────────────

function CutoffDatesSection() {
  const [cardMethods, setCardMethods] = useState([]);
  const [selectedId, setSelectedId]  = useState('');
  const [cutoffs, setCutoffs]         = useState([]);
  const [year, setYear]               = useState(new Date().getFullYear());
  const [month, setMonth]             = useState(new Date().getMonth() + 1);
  const [day, setDay]                 = useState(25);
  const [err, setErr]                 = useState('');

  useEffect(() => {
    getPaymentMethods().then((r) => {
      const cards = r.data.filter((m) => m.is_card);
      setCardMethods(cards);
      if (cards.length > 0) setSelectedId(String(cards[0].id));
    });
  }, []);

  const loadCutoffs = useCallback(() => {
    if (!selectedId) return;
    getCutoffDates(selectedId).then((r) => setCutoffs(r.data));
  }, [selectedId]);

  useEffect(() => { loadCutoffs(); }, [loadCutoffs]);

  const save = async () => {
    setErr('');
    try {
      await saveCutoffDate({ payment_method_id: selectedId, year, month, cutoff_day: day });
      loadCutoffs();
    } catch (e) {
      setErr(e.response?.data?.error || 'Erro ao salvar');
    }
  };

  const remove = async (id) => {
    setErr('');
    try {
      await deleteCutoffDate(id);
      loadCutoffs();
    } catch (e) {
      setErr(e.response?.data?.error || 'Erro ao remover');
    }
  };

  const years = [new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1];

  return (
    <SectionCard
      title="Datas de Corte dos Cartões"
      description={
        <>
          Define o dia de corte por cartão e mês. Compras até o corte vão para a fatura do mês seguinte;
          compras após o corte vão para dois meses à frente.{' '}
          <strong>Padrão: dia 25</strong> quando não configurado.
        </>
      }
    >
      {cardMethods.length === 0 ? (
        <p className="text-sm text-gray-400">
          Nenhum cartão de crédito cadastrado. Adicione um método marcado como "cartão de crédito" acima.
        </p>
      ) : (
        <>
          {/* Card selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cartão</label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {cardMethods.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* Add form */}
          <div className="flex flex-wrap gap-2 items-end pt-2 border-t">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Ano</label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Mês</label>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {MONTH_NAMES.map((n, i) => <option key={i + 1} value={i + 1}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Dia de corte</label>
              <input
                type="number" min="1" max="31"
                value={day}
                onChange={(e) => setDay(Number(e.target.value))}
                className="border rounded-lg px-3 py-1.5 text-sm w-20 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <button
              onClick={save}
              className="bg-brand-600 hover:bg-brand-700 text-white text-sm px-4 py-1.5 rounded-lg transition-colors"
            >
              Salvar
            </button>
          </div>
          <ErrorBanner msg={err} />

          {/* Existing cutoffs table */}
          {cutoffs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm mt-2">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-1 pr-6">Mês / Ano</th>
                    <th className="pb-1 pr-6">Dia de corte</th>
                    <th className="pb-1 pr-6">Compras até o corte</th>
                    <th className="pb-1 pr-6">Compras após o corte</th>
                    <th className="pb-1"></th>
                  </tr>
                </thead>
                <tbody>
                  {cutoffs.map((c) => {
                    const cutMonth = `${MONTH_NAMES[c.month - 1]} ${c.year}`;
                    const nextM    = c.month === 12 ? `Jan ${c.year + 1}` : `${MONTH_NAMES[c.month]} ${c.year}`;
                    const next2M   = c.month >= 11
                      ? `${MONTH_NAMES[(c.month + 1) % 12]} ${c.month >= 11 ? c.year + 1 : c.year}`
                      : `${MONTH_NAMES[c.month + 1]} ${c.year}`;
                    return (
                      <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-2 pr-6 font-medium">{cutMonth}</td>
                        <td className="py-2 pr-6">dia {c.cutoff_day}</td>
                        <td className="py-2 pr-6 text-green-700">Fatura de {nextM}</td>
                        <td className="py-2 pr-6 text-blue-700">Fatura de {next2M}</td>
                        <td className="py-2">
                          <button
                            onClick={() => remove(c.id)}
                            className="text-red-400 hover:text-red-600 text-xs"
                          >
                            Remover
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-400">
              Nenhuma data de corte configurada para este cartão. Será usado o dia 25 como padrão.
            </p>
          )}
        </>
      )}
    </SectionCard>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Settings() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Configurações</h1>
      <CutoffDatesSection />
      <PaymentMethodsSection />
      <CategoriesSection />
    </div>
  );
}
