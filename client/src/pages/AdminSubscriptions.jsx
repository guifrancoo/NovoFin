import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from './AdminLayout';

const STATUS_STYLES = {
  active:    'bg-green-100 text-green-700',
  expired:   'bg-orange-100 text-orange-600',
  suspended: 'bg-red-100 text-red-600',
};
const STATUS_LABELS = { active: 'Ativo', expired: 'Expirado', suspended: 'Suspenso' };

const PLAN_LABELS = {
  free:        'Free',
  pro:         'Pro',
  pro_monthly: 'Pro Mensal',
  pro_annual:  'Pro Anual',
  suspended:   'Suspenso',
};

function fmt(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('pt-BR');
}

function fmtBRL(n) {
  return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function StatusBadge({ status }) {
  const s = status || 'active';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[s] ?? STATUS_STYLES.active}`}>
      {STATUS_LABELS[s] ?? s}
    </span>
  );
}

function PaymentForm({ userId, onSuccess }) {
  const [amount, setAmount]   = useState('');
  const [plan, setPlan]       = useState('pro_monthly');
  const [months, setMonths]   = useState(1);
  const [notes, setNotes]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`/api/admin/users/${userId}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: parseFloat(amount), plan, months: parseInt(months), notes }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Erro ao registrar pagamento'); return; }
      setAmount(''); setNotes('');
      await onSuccess();
    } catch { setError('Erro de conexão'); }
    finally { setLoading(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500">Valor (R$)</label>
        <input type="number" step="0.01" min="0.01" required value={amount}
          onChange={e => setAmount(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-navy/30"
          placeholder="29,90" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500">Plano</label>
        <select value={plan} onChange={e => {
          setPlan(e.target.value);
          setMonths(e.target.value === 'pro_annual' ? 12 : 1);
        }} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30">
          <option value="pro_monthly">Pro Mensal</option>
          <option value="pro_annual">Pro Anual</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500">Meses</label>
        <input type="number" min="1" max="24" required value={months}
          onChange={e => setMonths(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-20 focus:outline-none focus:ring-2 focus:ring-navy/30" />
      </div>
      <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
        <label className="text-xs text-gray-500">Notas (opcional)</label>
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
          placeholder="Ex: Pix confirmado" />
      </div>
      <button type="submit" disabled={loading}
        className="bg-[#1a1a2e] text-white text-xs font-medium px-4 py-2 rounded-lg hover:bg-navy-light transition-colors disabled:opacity-50 shrink-0">
        {loading ? 'Salvando…' : 'Registrar Pagamento'}
      </button>
      {error && <p className="w-full text-xs text-red-500 mt-1">{error}</p>}
    </form>
  );
}

function UserAccordion({ user }) {
  const [open, setOpen]         = useState(false);
  const [detail, setDetail]     = useState(null);
  const [loadingD, setLoadingD] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  async function fetchDetail() {
    setLoadingD(true);
    const token = localStorage.getItem('adminToken');
    try {
      const res = await fetch(`/api/admin/users/${user.id}/subscription`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setDetail(await res.json());
    } finally { setLoadingD(false); }
  }

  function toggle() {
    if (!open && !detail) fetchDetail();
    setOpen(o => !o);
  }

  async function updateStatus(status) {
    setActionLoading(true);
    const token = localStorage.getItem('adminToken');
    try {
      const res = await fetch(`/api/admin/users/${user.id}/subscription`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      if (res.ok) await fetchDetail();
    } finally { setActionLoading(false); }
  }

  async function onPaymentSuccess() {
    await fetchDetail();
  }

  const sub = detail?.subscription;
  const payments = detail?.payments ?? [];

  return (
    <>
      <tr
        className={`cursor-pointer hover:bg-gray-50/50 transition-colors ${open ? 'bg-gray-50/50' : ''}`}
        onClick={toggle}
      >
        <td className="px-5 py-3 font-medium text-gray-900 whitespace-nowrap">
          <div className="flex items-center gap-2">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
              className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`}>
              <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {user.name}
          </div>
        </td>
        <td className="px-4 py-3 text-gray-500 text-sm">{user.whatsapp ?? '—'}</td>
        <td className="px-4 py-3 text-sm">
          <span className="text-gray-600">{PLAN_LABELS[user.plan] ?? user.plan}</span>
        </td>
        <td className="px-4 py-3">
          <StatusBadge status={user.subscriptionStatus ?? (user.plan === 'suspended' ? 'suspended' : 'active')} />
        </td>
        <td className="px-4 py-3 text-gray-500 text-sm whitespace-nowrap">{fmt(user.expiresAt)}</td>
        <td className="px-4 py-3 text-gray-500 text-sm whitespace-nowrap">{fmt(user.lastPayment)}</td>
      </tr>

      {open && (
        <tr>
          <td colSpan={6} className="px-5 py-5 bg-gray-50/80 border-t border-gray-100">
            {loadingD && (
              <div className="text-xs text-gray-400 animate-pulse">Carregando...</div>
            )}

            {!loadingD && (
              <div className="space-y-5">
                {/* Subscription details */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  {[
                    ['Plano', PLAN_LABELS[sub?.plan] ?? (sub?.plan || '—')],
                    ['Status', STATUS_LABELS[sub?.status] ?? (sub?.status || '—')],
                    ['Início', fmt(sub?.started_at)],
                    ['Vencimento', fmt(sub?.expires_at)],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-white rounded-lg border border-gray-200 p-3">
                      <div className="text-gray-400 mb-1">{label}</div>
                      <div className="font-medium text-gray-800">{value}</div>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button onClick={() => updateStatus('suspended')} disabled={actionLoading}
                    className="text-xs border border-red-200 text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                    Suspender
                  </button>
                  <button onClick={() => updateStatus('active')} disabled={actionLoading}
                    className="text-xs border border-green-200 text-green-600 hover:bg-green-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                    Reativar
                  </button>
                </div>

                {/* Payment history */}
                {payments.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-gray-600 mb-2">Histórico de Pagamentos</div>
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="text-left px-4 py-2 font-medium text-gray-500">Data</th>
                            <th className="text-left px-4 py-2 font-medium text-gray-500">Valor</th>
                            <th className="text-left px-4 py-2 font-medium text-gray-500">Plano</th>
                            <th className="text-left px-4 py-2 font-medium text-gray-500">Período</th>
                            <th className="text-left px-4 py-2 font-medium text-gray-500">Método</th>
                            <th className="text-left px-4 py-2 font-medium text-gray-500">Notas</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {payments.map(p => (
                            <tr key={p.id} className="hover:bg-gray-50/50">
                              <td className="px-4 py-2 text-gray-600">{fmt(p.created_at)}</td>
                              <td className="px-4 py-2 font-medium text-gray-800">{fmtBRL(p.amount)}</td>
                              <td className="px-4 py-2 text-gray-600">{PLAN_LABELS[p.plan] ?? p.plan}</td>
                              <td className="px-4 py-2 text-gray-500">{fmt(p.period_start)} – {fmt(p.period_end)}</td>
                              <td className="px-4 py-2 text-gray-500 capitalize">{p.method}</td>
                              <td className="px-4 py-2 text-gray-500">{p.notes ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Register payment form */}
                <div>
                  <div className="text-xs font-semibold text-gray-600 mb-2">Registrar Pagamento</div>
                  <PaymentForm userId={user.id} onSuccess={onPaymentSuccess} />
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export default function AdminSubscriptions() {
  const navigate = useNavigate();
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const fetchUsers = useCallback(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) { navigate('/admin/login', { replace: true }); return; }

    setLoading(true);
    Promise.all([
      fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      // fetch subscription statuses for all users in one go via stats (we'll enrich per-row lazily)
    ])
      .then(([usersData]) => {
        if (!Array.isArray(usersData)) throw new Error('Falha ao carregar usuários');
        setUsers(usersData);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [navigate]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900">Assinaturas</h1>
        <p className="text-gray-400 text-sm mt-0.5">
          {users.length} usuário{users.length !== 1 ? 's' : ''} — clique para ver detalhes e registrar pagamentos
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-red-600 text-sm mb-4">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="divide-y divide-gray-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-5 py-4 flex gap-4 animate-pulse">
                <div className="h-3 bg-gray-100 rounded w-32" />
                <div className="h-3 bg-gray-100 rounded w-20" />
                <div className="h-3 bg-gray-100 rounded w-16 ml-auto" />
              </div>
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="px-5 py-12 text-center text-gray-400 text-sm">Nenhum usuário encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Nome</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">WhatsApp</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Plano</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Vencimento</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Último Pagamento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map(u => <UserAccordion key={u.id} user={u} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
