import React, { useState, useEffect, useCallback } from 'react';
import {
  getPaymentMethods, createPaymentMethod, deletePaymentMethod,
  getCategories, createCategory, deleteCategory,
  getAllSubcategories, createSubcategory, deleteSubcategory,
  getAllCutoffDates, saveCutoffDate, deleteCutoffDate, updateCutoffDate,
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

function AddBtn({ onClick, children }) {
  return (
    <button onClick={onClick}
      className="w-full sm:w-auto px-4 py-3 sm:py-2 rounded-lg text-xs font-medium bg-navy hover:bg-navy-light text-white transition-colors whitespace-nowrap">
      {children}
    </button>
  );
}

const TYPE_LABEL = { credit: 'Crédito', debit: 'Débito', cash: 'Dinheiro' };
const TYPE_STYLE = {
  credit: 'bg-blue-100 text-blue-700',
  debit:  'bg-emerald-100 text-emerald-700',
  cash:   'bg-gray-100 text-gray-600',
};

function TypeBadge({ type }) {
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${TYPE_STYLE[type] || TYPE_STYLE.cash}`}>
      {TYPE_LABEL[type] || type}
    </span>
  );
}

// ─── Inline cutoff panel (per credit card) ────────────────────────────────────
function CutoffPanel({ method, allCutoffs, onChanged }) {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [day, setDay]     = useState(25);
  const [err, setErr]     = useState('');

  const [editingId, setEditingId]   = useState(null);
  const [editYear, setEditYear]     = useState(now.getFullYear());
  const [editMonth, setEditMonth]   = useState(1);
  const [editDay, setEditDay]       = useState(25);

  const myCutoffs = allCutoffs.filter((c) => c.payment_method_id === method.id);
  const addYears = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];
  const editYears = [-2, -1, 0, 1, 2].map((d) => now.getFullYear() + d);

  const save = async () => {
    setErr('');
    try {
      await saveCutoffDate({ payment_method_id: method.id, year, month, cutoff_day: day });
      onChanged();
    } catch (e) { setErr(e.response?.data?.error || 'Erro ao salvar'); }
  };

  const remove = async (id) => {
    setErr('');
    try { await deleteCutoffDate(id); onChanged(); }
    catch (e) { setErr(e.response?.data?.error || 'Erro ao remover'); }
  };

  const startEdit = (c) => {
    console.log('startEdit called', c.id, c.year, c.month, c.cutoff_day);
    setEditingId(c.id);
    setEditYear(Number(c.year));
    setEditMonth(Number(c.month));
    setEditDay(Number(c.cutoff_day));
    setErr('');
  };

  const saveEdit = async (id) => {
    console.log('saveEdit called', id, editYear, editMonth, editDay);
    setErr('');
    try {
      const result = await updateCutoffDate(id, { year: editYear, month: editMonth, day: editDay });
      console.log('response:', result);
      setEditingId(null);
      onChanged();
    } catch (e) {
      console.error('saveEdit error:', e);
      setErr(e.response?.data?.error || 'Erro ao salvar');
    }
  };

  return (
    <div className="border-t border-gray-100 bg-gray-50/40 px-4 py-3 space-y-3">
      {/* Existing cutoffs */}
      {myCutoffs.length === 0 ? (
        <p className="text-xs text-gray-400">Nenhuma data configurada. Padrão: dia 25.</p>
      ) : (
        <div className="space-y-1">
          {myCutoffs.map((c) => {
            const cutMonth = `${MONTH_NAMES[c.month - 1]} ${c.year}`;
            const nextM    = c.month === 12
              ? `Jan ${c.year + 1}`
              : `${MONTH_NAMES[c.month]} ${c.year}`;

            if (editingId === c.id) {
              return (
                <div key={c.id} className="relative z-10 overflow-visible flex flex-wrap items-center gap-2 min-h-[44px] py-1.5 border-b border-gray-100 last:border-0">
                  <select value={editYear} onChange={(e) => setEditYear(Number(e.target.value))} className={inputCls}>
                    {editYears.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <select value={editMonth} onChange={(e) => setEditMonth(Number(e.target.value))} className={inputCls}>
                    {MONTH_NAMES.map((n, i) => <option key={i + 1} value={i + 1}>{n}</option>)}
                  </select>
                  <input type="number" min="1" max="31" value={editDay}
                    onChange={(e) => setEditDay(Number(e.target.value))}
                    className={`${inputCls} w-20`} />
                  <button type="button" onClick={() => saveEdit(c.id)}
                    className="px-3 py-1.5 text-xs font-medium bg-navy text-white rounded-lg hover:bg-navy-light transition-colors">
                    Salvar
                  </button>
                  <button onClick={() => setEditingId(null)}
                    className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    Cancelar
                  </button>
                </div>
              );
            }

            return (
              <div key={c.id} className="flex items-center justify-between min-h-[44px] border-b border-gray-100 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-navy">{cutMonth}</span>
                  <span className="text-xs text-gray-400">· dia {c.cutoff_day}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <span className="hidden sm:inline bg-green-50 text-green-700 px-1.5 py-0.5 rounded-full">até: {cutMonth}</span>
                  <span className="hidden sm:inline bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full">após: {nextM}</span>
                  <button onClick={() => startEdit(c)} title="Editar"
                    className="w-11 h-11 sm:w-6 sm:h-6 flex items-center justify-center rounded text-gray-300 hover:text-navy hover:bg-navy/5 transition-colors">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button onClick={() => remove(c.id)} title="Remover"
                    className="w-11 h-11 sm:w-6 sm:h-6 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add cutoff form */}
      <div className="mt-4 pt-3 border-t border-gray-200">
        <p className="text-sm font-medium text-gray-600 mb-2">Inclusão de nova data de corte</p>
      </div>
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:items-end pt-1">
        <div>
          <label className={labelCls}>Ano</label>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={inputCls}>
            {addYears.map((y) => <option key={y} value={y}>{y}</option>)}
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
    </div>
  );
}

// ─── Cartões e Métodos de Pagamento ───────────────────────────────────────────
function PaymentMethodsSection() {
  const [methods, setMethods]               = useState([]);
  const [allCutoffs, setAllCutoffs]         = useState([]);
  const [name, setName]                     = useState('');
  const [tipo, setTipo]                     = useState('cash');
  const [err, setErr]                       = useState('');
  const [confirmDelete, setConfirmDelete]   = useState(null);
  const [expandedCardId, setExpandedCardId] = useState(null);

  const load = useCallback(() =>
    Promise.all([getPaymentMethods(), getAllCutoffDates()])
      .then(([m, c]) => { setMethods(m.data); setAllCutoffs(c.data); }),
  []);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    setErr('');
    if (!name.trim()) return setErr('Digite um nome');
    try {
      await createPaymentMethod({ name: name.trim(), card_type: tipo });
      setName(''); setTipo('cash'); load();
    } catch (e) { setErr(e.response?.data?.error || 'Erro ao adicionar'); }
  };

  const remove = async (id) => {
    setErr('');
    setConfirmDelete(null);
    if (expandedCardId === id) setExpandedCardId(null);
    try { await deletePaymentMethod(id); load(); }
    catch (e) { setErr(e.response?.data?.error || 'Erro ao remover'); }
  };

  return (
    <SectionCard
      title="Cartões e métodos de pagamento"
      description="Gerencie seus cartões e formas de pagamento. Clique nas datas de corte de um cartão de crédito para expandir.">

      <div className="space-y-2">
        {methods.map((m) => {
          const cardType  = m.card_type || (m.is_card ? 'credit' : 'cash');
          const isCredit  = cardType === 'credit';
          const myCutoffs = allCutoffs.filter((c) => c.payment_method_id === m.id);
          const isOpen    = expandedCardId === m.id;

          return (
            <div key={m.id} className="border border-gray-100 rounded-lg overflow-hidden">
              {/* Row */}
              <div className="flex items-center gap-2 px-3 min-h-[44px]">
                <TypeBadge type={cardType} />
                <span className="text-xs font-medium text-navy flex-1">{m.name}</span>

                {/* Credit card: cutoff toggle */}
                {isCredit && (
                  <button
                    onClick={() => setExpandedCardId(isOpen ? null : m.id)}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-navy transition-colors mr-2">
                    <span>
                      {myCutoffs.length} {myCutoffs.length === 1 ? 'data de corte' : 'datas de corte'}
                    </span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2"
                      className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>
                )}

                {/* Delete */}
                {confirmDelete === m.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-600">Confirmar?</span>
                    <button onClick={() => remove(m.id)}
                      className="px-2 py-1 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">Sim</button>
                    <button onClick={() => setConfirmDelete(null)}
                      className="px-2 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Não</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDelete(m.id)} title="Remover"
                    className="w-11 h-11 sm:w-7 sm:h-7 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                  </button>
                )}
              </div>

              {/* Inline cutoff panel */}
              {isCredit && isOpen && (
                <CutoffPanel method={m} allCutoffs={allCutoffs} onChanged={load} />
              )}
            </div>
          );
        })}
        {methods.length === 0 && <p className="text-xs text-gray-400">Nenhum método cadastrado</p>}
      </div>

      {/* Add method form */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end pt-3 border-t border-gray-100">
        <div className="flex-1 min-w-[140px]">
          <label className={labelCls}>Nome</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Ex: Nubank, Pix..." className={`${inputCls} w-full`} />
        </div>
        <div>
          <label className={labelCls}>Tipo</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputCls}>
            <option value="credit">Crédito</option>
            <option value="debit">Débito</option>
            <option value="cash">Dinheiro / Outro</option>
          </select>
        </div>
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

  const addSub = async (catId) => {
    setSubErr('');
    if (!subName.trim()) return setSubErr('Digite um nome');
    const cid = Number(catId ?? subCatId);
    if (!cid) return setSubErr('Selecione uma categoria');
    try {
      await createSubcategory({ category_id: cid, name: subName.trim() });
      setSubName(''); setSubCatId(String(cid)); loadSubs(); setExpandedCat(cid);
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

  const sortedCats = [...cats].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  return (
    <SectionCard
      title="Categorias e subcategorias"
      description="Adicione categorias e vincule subcategorias (ex: Família → Babá, Educação filha).">

      {/* Lista de categorias */}
      <div className="space-y-1">
        {sortedCats.map((c) => {
          const subs   = subsByCategory[c.id] || [];
          const isOpen = expandedCat === c.id;
          return (
            <div key={c.id} className="border border-gray-100 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-3 min-h-[44px] bg-gray-50/60 hover:bg-gray-50 transition-colors">
                <button
                  className="flex items-center gap-2 flex-1 text-left text-xs font-medium text-navy"
                  onClick={() => setExpandedCat(isOpen ? null : c.id)}>
                  <span>{c.name}</span>
                  {subs.length > 0 && (
                    <span className="text-[10px] text-gray-400 bg-white border border-gray-200 rounded-full px-1.5 py-0.5">
                      {subs.length}
                    </span>
                  )}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                    stroke="#9ca3af" strokeWidth="2"
                    className={`ml-1 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                <button onClick={() => removeCat(c.id)} title="Remover categoria"
                  className="w-11 h-11 sm:w-7 sm:h-7 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors ml-2">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>
              {isOpen && (
                <div className="px-3 py-2 bg-white space-y-1 border-t border-gray-100">
                  {subs.map((s) => (
                    <div key={s.id} className="flex items-center justify-between min-h-[44px] border-b border-gray-50 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-gray-300" />
                        <span className="text-xs text-gray-600">{s.name}</span>
                      </div>
                      <button onClick={() => removeSub(s.id)}
                        className="w-11 h-11 sm:w-6 sm:h-6 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                  {subs.length === 0 && <p className="text-xs text-gray-400 py-1">Nenhuma subcategoria</p>}
                  {/* Add subcategory inline */}
                  <div className="pt-2 border-t border-gray-100 space-y-1.5">
                    <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Adicionar subcategoria</div>
                    <div className="flex gap-2 items-center min-h-[44px]">
                      <input type="text" value={expandedCat === c.id ? subName : ''}
                        onChange={(e) => { setSubCatId(String(c.id)); setSubName(e.target.value); }}
                        onKeyDown={(e) => e.key === 'Enter' && addSub(c.id)}
                        placeholder="Nome da subcategoria..." className={`${inputCls} flex-1 text-xs`} />
                      <button onClick={() => addSub(c.id)}
                        className="px-3 py-3 sm:py-2 rounded-lg text-xs font-medium bg-navy hover:bg-navy-light text-white transition-colors whitespace-nowrap min-h-[44px] sm:min-h-0">
                        Adicionar
                      </button>
                    </div>
                    {expandedCat === c.id && subErr && <ErrorBanner msg={subErr} />}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {cats.length === 0 && <p className="text-xs text-gray-400">Nenhuma categoria cadastrada</p>}
      </div>

      {/* Add category */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center pt-3 border-t border-gray-100">
        <input type="text" value={catName} onChange={(e) => setCatName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addCat()}
          placeholder="Nova categoria..." className={`${inputCls} flex-1`} />
        <AddBtn onClick={addCat}>Adicionar categoria</AddBtn>
      </div>
      <ErrorBanner msg={catErr} />
    </SectionCard>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Settings() {
  return (
    <div className="p-4 md:px-5 md:py-4 space-y-4">
      <PaymentMethodsSection />
      <CategoriesSection />
    </div>
  );
}
