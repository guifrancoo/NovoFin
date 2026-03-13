import React, { useState, useEffect, useCallback } from 'react';
import {
  getPaymentMethods, createPaymentMethod, deletePaymentMethod,
  getCategories, createCategory, deleteCategory,
  getAllSubcategories, createSubcategory, deleteSubcategory,
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

// ─── Categories + Subcategories section ──────────────────────────────────────

function CategoriesSection() {
  const [cats, setCats]       = useState([]);
  const [allSubs, setAllSubs] = useState([]); // [{id, category_id, name, category_name}]
  const [catName, setCatName] = useState('');
  const [catErr, setCatErr]   = useState('');

  // Subcategory form state
  const [subCatId, setSubCatId] = useState('');
  const [subName, setSubName]   = useState('');
  const [subErr, setSubErr]     = useState('');

  const [expandedCat, setExpandedCat] = useState(null);

  const loadCats = useCallback(() => getCategories().then((r) => {
    setCats(r.data);
    if (!subCatId && r.data.length > 0) setSubCatId(String(r.data[0].id));
  }), [subCatId]);

  const loadSubs = useCallback(() => getAllSubcategories().then((r) => setAllSubs(r.data)), []);

  useEffect(() => { loadCats(); loadSubs(); }, []);

  const addCat = async () => {
    setCatErr('');
    if (!catName.trim()) return setCatErr('Digite um nome');
    try {
      await createCategory({ name: catName.trim() });
      setCatName('');
      loadCats();
    } catch (e) {
      setCatErr(e.response?.data?.error || 'Erro ao adicionar');
    }
  };

  const removeCat = async (id) => {
    setCatErr('');
    try {
      await deleteCategory(id);
      loadCats(); loadSubs();
    } catch (e) {
      setCatErr(e.response?.data?.error || 'Erro ao remover');
    }
  };

  const addSub = async () => {
    setSubErr('');
    if (!subName.trim()) return setSubErr('Digite um nome');
    if (!subCatId) return setSubErr('Selecione uma categoria');
    try {
      await createSubcategory({ category_id: Number(subCatId), name: subName.trim() });
      setSubName('');
      loadSubs();
      setExpandedCat(Number(subCatId));
    } catch (e) {
      setSubErr(e.response?.data?.error || 'Erro ao adicionar');
    }
  };

  const removeSub = async (id) => {
    setSubErr('');
    try {
      await deleteSubcategory(id);
      loadSubs();
    } catch (e) {
      setSubErr(e.response?.data?.error || 'Erro ao remover');
    }
  };

  // Group subcategories by category_id
  const subsByCategory = allSubs.reduce((acc, s) => {
    if (!acc[s.category_id]) acc[s.category_id] = [];
    acc[s.category_id].push(s);
    return acc;
  }, {});

  return (
    <SectionCard
      title="Categorias e Subcategorias"
      description="Adicione categorias e vincule subcategorias a elas (ex: Família → Babá, Educação filha)."
    >
      {/* Category list with expandable subcategories */}
      <div className="space-y-1">
        {cats.map((c) => {
          const subs = subsByCategory[c.id] || [];
          const isOpen = expandedCat === c.id;
          return (
            <div key={c.id} className="border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100">
                <button
                  className="flex items-center gap-2 flex-1 text-left text-sm font-medium"
                  onClick={() => setExpandedCat(isOpen ? null : c.id)}
                >
                  <span>{c.name}</span>
                  {subs.length > 0 && (
                    <span className="text-xs text-gray-400 bg-white border rounded-full px-1.5 py-0.5">
                      {subs.length}
                    </span>
                  )}
                  {subs.length > 0 && (
                    <span className="text-gray-400 text-xs ml-auto mr-2">{isOpen ? '▲' : '▼'}</span>
                  )}
                </button>
                <button
                  onClick={() => removeCat(c.id)}
                  title="Remover categoria"
                  className="text-gray-400 hover:text-red-500 transition-colors text-xs ml-2"
                >✕</button>
              </div>
              {isOpen && (
                <div className="px-3 py-2 bg-white space-y-1">
                  {subs.map((s) => (
                    <div key={s.id} className="flex items-center justify-between py-1 border-b last:border-0">
                      <span className="text-sm text-gray-600">› {s.name}</span>
                      <button
                        onClick={() => removeSub(s.id)}
                        className="text-gray-400 hover:text-red-500 text-xs transition-colors"
                        title="Remover subcategoria"
                      >✕</button>
                    </div>
                  ))}
                  {subs.length === 0 && (
                    <p className="text-xs text-gray-400 py-1">Nenhuma subcategoria</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {cats.length === 0 && <p className="text-sm text-gray-400">Nenhuma categoria cadastrada</p>}
      </div>

      {/* Add category */}
      <div className="flex gap-2 items-center pt-2 border-t">
        <input
          type="text"
          value={catName}
          onChange={(e) => setCatName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addCat()}
          placeholder="Nova categoria..."
          className="border rounded-lg px-3 py-1.5 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button
          onClick={addCat}
          className="bg-brand-600 hover:bg-brand-700 text-white text-sm px-4 py-1.5 rounded-lg transition-colors"
        >
          Adicionar categoria
        </button>
      </div>
      <ErrorBanner msg={catErr} />

      {/* Add subcategory */}
      <div className="border-t pt-4 space-y-2">
        <p className="text-sm font-medium text-gray-700">Adicionar subcategoria</p>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={subCatId}
            onChange={(e) => setSubCatId(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input
            type="text"
            value={subName}
            onChange={(e) => setSubName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addSub()}
            placeholder="Nome da subcategoria..."
            className="border rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[160px] focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            onClick={addSub}
            className="bg-brand-600 hover:bg-brand-700 text-white text-sm px-4 py-1.5 rounded-lg transition-colors"
          >
            Adicionar
          </button>
        </div>
        <ErrorBanner msg={subErr} />
      </div>
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
