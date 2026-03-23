import React, { useState, useEffect, useCallback } from 'react';
import {
  getPaymentMethods, createPaymentMethod, deletePaymentMethod,
  getCategories, createCategory, deleteCategory,
  getAllSubcategories, createSubcategory, deleteSubcategory,
  getCutoffDates, saveCutoffDate, deleteCutoffDate,
  MONTH_NAMES,
} from '../api';

const inputCls = 'border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy/40 transition-colors';
const labelCls = 'block text-xs font-medium text-gray-500 mb-1';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function SectionCard({ title, description, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="text-sm font-semibold text-navy">{title}</div>
        {description && <p className="text-xs text-gray-400 mt-1 leading-relaxed">{description}</p>}
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

function ErrorBanner({ msg }) {
  if (!msg) return null;
  return <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{msg}</p>;
}

function Tag({ label, onDelete }) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-gray-100 rounded-full px-3 py-1.5 text-xs font-medium text-gray-700">
      {label}
      <button onClick={onDelete} title="Remover"
        className="w-3.5 h-3.5 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors leading-none">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </span>
  );
}

function AddBtn({ onClick, children }) {
  return (
    <button onClick={onClick}
      className="w-full sm:w-auto px-4 py-2 rounded-lg bg-navy text-white text-xs font-medium hover:bg-navy-light transition-colors whitespace-nowrap">
      {children}
    </button>
  );
}

// ─── Métodos de pagamento ─────────────────────────────────────────────────────
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
      setName(''); setIsCard(false); load();
    } catch (e) { setErr(e.response?.data?.error || 'Erro ao adicionar'); }
  };

  const remove = async (id) => {
    setErr('');
    try { await deletePaymentMethod(id); load(); }
    catch (e) { setErr(e.response?.data?.error || 'Erro ao remover'); }
  };

  return (
    <SectionCard
      title="Métodos de pagamento"
      description="Adicione ou remova formas de pagamento. Métodos marcados como cartão de crédito têm fatura e data de corte.">
      <div className="flex flex-wrap gap-2 min-h-[32px]">
        {methods.map((m) => (
          <Tag key={m.id}
            label={m.is_card ? `${m.name} (cartão)` : m.name}
            onDelete={() => remove(m.id)} />
        ))}
        {methods.length === 0 && <p className="text-xs text-gray-400">Nenhum método cadastrado</p>}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center pt-3 border-t border-gray-100">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Novo método..." className={`${inputCls} flex-1 min-w-[160px]`} />
        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
          <input type="checkbox" checked={isCard} onChange={(e) => setIsCard(e.target.checked)}
            className="w-3.5 h-3.5 accent-navy rounded" />
          É cartão de crédito
        </label>
        <AddBtn onClick={add}>Adicionar</AddBtn>
      </div>
      <ErrorBanner msg={err} />
    </SectionCard>
  );
}

// ─── Categorias e subcategorias ───────────────────────────────────────────────
function CategoriesSection() {
  const [cats, setCats]           = useState([]);
  const [allSubs, setAllSubs]     = useState([]);
  const [catName, setCatName]     = useState('');
  const [catErr, setCatErr]       = useState('');
  const [subCatId, setSubCatId]   = useState('');
  const [subName, setSubName]     = useState('');
  const [subErr, setSubErr]       = useState('');
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
    try { await createCategory({ name: catName.trim() }); setCatName(''); loadCats(); }
    catch (e) { setCatErr(e.response?.data?.error || 'Erro ao adicionar'); }
  };

  const removeCat = async (id) => {
    setCatErr('');
    try { await deleteCategory(id); loadCats(); loadSubs(); }
    catch (e) { setCatErr(e.response?.data?.error || 'Erro ao remover'); }
  };

  const addSub = async () => {
    setSubErr('');
    if (!subName.trim()) return setSubErr('Digite um nome');
    if (!subCatId) return setSubErr('Selecione uma categoria');
    try {
      await createSubcategory({ category_id: Number(subCatId), name: subName.trim() });
      setSubName(''); loadSubs(); setExpandedCat(Number(subCatId));
    } catch (e) { setSubErr(e.response?.data?.error || 'Erro ao adicionar'); }
  };

  const removeSub = async (id) => {
    setSubErr('');
    try { await deleteSubcategory(id); loadSubs(); }
    catch (e) { setSubErr(e.response?.data?.error || 'Erro ao remover'); }
  };

  const subsByCategory = allSubs.reduce((acc, s) => {
    if (!acc[s.category_id]) acc[s.category_id] = [];
    acc[s.category_id].push(s);
    return acc;
  }, {});

  return (
    <SectionCard
      title="Categorias e subcategorias"
      description="Adicione categorias e vincule subcategorias (ex: Família → Babá, Educação filha).">

      {/* Lista de categorias */}
      <div className="space-y-1">
        {cats.map((c) => {
          const subs = subsByCategory[c.id] || [];
          const isOpen = expandedCat === c.id;
          return (
            <div key={c.id} className="border border-gray-100 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2.5 bg-gray-50/60 hover:bg-gray-50 transition-colors">
                <button
                  className="flex items-center gap-2 flex-1 text-left text-xs font-medium text-navy"
                  onClick={() => setExpandedCat(isOpen ? null : c.id)}>
                  <span>{c.name}</span>
                  {subs.length > 0 && (
                    <span className="text-[10px] text-gray-400 bg-white border border-gray-200 rounded-full px-1.5 py-0.5">
                      {subs.length}
                    </span>
                  )}
                  {subs.length > 0 && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                      stroke="#9ca3af" strokeWidth="2"
                      className={`ml-1 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  )}
                </button>
                <button onClick={() => removeCat(c.id)} title="Remover categoria"
                  className="w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors ml-2">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>
              {isOpen && (
                <div className="px-3 py-2 bg-white space-y-1 border-t border-gray-100">
                  {subs.map((s) => (
                    <div key={s.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-gray-300" />
                        <span className="text-xs text-gray-600">{s.name}</span>
                      </div>
                      <button onClick={() => removeSub(s.id)}
                        className="w-5 h-5 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                  {subs.length === 0 && <p className="text-xs text-gray-400 py-1">Nenhuma subcategoria</p>}
                </div>
              )}
            </div>
          );
        })}
        {cats.length === 0 && <p className="text-xs text-gray-400">Nenhuma categoria cadastrada</p>}
      </div>

      {/* Adicionar categoria */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center pt-3 border-t border-gray-100">
        <input type="text" value={catName} onChange={(e) => setCatName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addCat()}
          placeholder="Nova categoria..." className={`${inputCls} flex-1`} />
        <AddBtn onClick={addCat}>Adicionar categoria</AddBtn>
      </div>
      <ErrorBanner msg={catErr} />

      {/* Adicionar subcategoria */}
      <div className="pt-3 border-t border-gray-100 space-y-2">
        <div className="text-xs font-medium text-gray-500">Adicionar subcategoria</div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <select value={subCatId} onChange={(e) => setSubCatId(e.target.value)}
            className={inputCls}>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input type="text" value={subName} onChange={(e) => setSubName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addSub()}
            placeholder="Nome da subcategoria..." className={`${inputCls} flex-1 min-w-[160px]`} />
          <AddBtn onClick={addSub}>Adicionar</AddBtn>
        </div>
        <ErrorBanner msg={subErr} />
      </div>
    </SectionCard>
  );
}

// ─── Datas de corte ───────────────────────────────────────────────────────────
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
    try { await saveCutoffDate({ payment_method_id: selectedId, year, month, cutoff_day: day }); loadCutoffs(); }
    catch (e) { setErr(e.response?.data?.error || 'Erro ao salvar'); }
  };

  const remove = async (id) => {
    setErr('');
    try { await deleteCutoffDate(id); loadCutoffs(); }
    catch (e) { setErr(e.response?.data?.error || 'Erro ao remover'); }
  };

  const years = [new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1];

  return (
    <SectionCard
      title="Datas de corte dos cartões"
      description="Define o dia de corte por cartão e mês. Compras até o dia de corte vão para a fatura do mesmo mês; compras após o corte vão para o mês seguinte. Padrão: dia 25.">

      {cardMethods.length === 0 ? (
        <p className="text-xs text-gray-400">Nenhum cartão cadastrado. Adicione um método marcado como cartão de crédito.</p>
      ) : (
        <>
          <div>
            <label className={labelCls}>Cartão</label>
            <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className={inputCls}>
              {cardMethods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>

          <div className="flex flex-wrap gap-3 items-end pt-3 border-t border-gray-100">
            <div>
              <label className={labelCls}>Ano</label>
              <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={inputCls}>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Mês</label>
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={inputCls}>
                {MONTH_NAMES.map((n, i) => <option key={i + 1} value={i + 1}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Dia de corte</label>
              <input type="number" min="1" max="31" value={day}
                onChange={(e) => setDay(Number(e.target.value))}
                className={`${inputCls} w-20`} />
            </div>
            <AddBtn onClick={save}>Salvar</AddBtn>
          </div>
          <ErrorBanner msg={err} />

          {cutoffs.length > 0 ? (
            <div>
              {cutoffs.map((c) => {
                const cutMonth = `${MONTH_NAMES[c.month - 1]} ${c.year}`;
                const nextM    = c.month === 12 ? `Jan ${c.year + 1}` : `${MONTH_NAMES[c.month]} ${c.year}`;
                return (
                  <div key={c.id} className="border border-gray-100 rounded-lg p-3 mb-2 last:mb-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm text-navy">{cutMonth}</span>
                      <button onClick={() => remove(c.id)}
                        className="w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                      </button>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Corte: dia {c.cutoff_day}</div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-full">Até o corte: Fatura de {cutMonth}</span>
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">Após o corte: Fatura de {nextM}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-gray-400">Nenhuma data configurada. Será usado o dia 25 como padrão.</p>
          )}
        </>
      )}
    </SectionCard>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Settings() {
  return (
    <div className="p-4 md:px-5 md:py-4 space-y-4">
      <CutoffDatesSection />
      <PaymentMethodsSection />
      <CategoriesSection />
    </div>
  );
}
