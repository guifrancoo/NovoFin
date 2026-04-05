import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from './AdminLayout';

const PLAN_STYLES = {
  free:      'bg-gray-100 text-gray-600',
  pro:       'bg-green-100 text-green-700',
  suspended: 'bg-red-100 text-red-600',
};

const PLAN_LABELS = {
  free:      'Free',
  pro:       'Pro',
  suspended: 'Suspenso',
};

function fmt(dateStr) {
  if (!dateStr) return 'Nunca';
  const d = new Date(dateStr);
  if (isNaN(d)) return 'Nunca';
  return d.toLocaleDateString('pt-BR');
}

function PlanBadge({ plan }) {
  const p = plan || 'free';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PLAN_STYLES[p] ?? PLAN_STYLES.free}`}>
      {PLAN_LABELS[p] ?? p}
    </span>
  );
}

function PlanSelector({ userId, current, onChange }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function select(plan) {
    if (plan === current) { setOpen(false); return; }
    setLoading(true);
    setOpen(false);
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`/api/admin/users/${userId}/plan`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan }),
      });
      if (res.ok) onChange(userId, plan);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={loading}
        className="text-xs text-gray-500 hover:text-gray-800 border border-gray-200 hover:border-gray-300 px-2 py-1 rounded-md transition-colors disabled:opacity-50"
      >
        {loading ? '…' : 'Alterar'}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-32">
            {['free', 'pro', 'suspended'].map(p => (
              <button
                key={p}
                onClick={() => select(p)}
                className={`w-full text-left text-xs px-3 py-2 hover:bg-gray-50 transition-colors ${p === current ? 'font-semibold text-gray-900' : 'text-gray-600'}`}
              >
                {PLAN_LABELS[p]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function AdminUsers() {
  const navigate = useNavigate();
  const [users, setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) { navigate('/admin/login', { replace: true }); return; }

    fetch('/api/admin/users', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async res => {
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem('adminToken');
          navigate('/admin/login', { replace: true });
          return;
        }
        if (!res.ok) throw new Error('Falha ao carregar usuários');
        return res.json();
      })
      .then(data => { if (data) setUsers(data); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [navigate]);

  function handlePlanChange(userId, newPlan) {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, plan: newPlan } : u));
  }

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900">Usuários</h1>
        <p className="text-gray-400 text-sm mt-0.5">{users.length} usuário{users.length !== 1 ? 's' : ''} cadastrado{users.length !== 1 ? 's' : ''}</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-red-600 text-sm mb-4">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="divide-y divide-gray-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-5 py-4 flex gap-4 animate-pulse">
                <div className="h-3 bg-gray-100 rounded w-32" />
                <div className="h-3 bg-gray-100 rounded w-24" />
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
                  <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Transações</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Último Acesso</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Cadastro</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-900 whitespace-nowrap">{u.name}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{u.whatsapp ?? '—'}</td>
                    <td className="px-4 py-3"><PlanBadge plan={u.plan} /></td>
                    <td className="px-4 py-3 text-right text-gray-700 tabular-nums">{u.transactionCount.toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmt(u.lastActivity)}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmt(u.created_at)}</td>
                    <td className="px-4 py-3">
                      <PlanSelector userId={u.id} current={u.plan} onChange={handlePlanChange} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
