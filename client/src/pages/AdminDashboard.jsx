import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from './AdminLayout';

const CARDS = [
  {
    key: 'totalUsers',
    label: 'Total de Usuários',
    icon: '👥',
    format: (v) => v,
  },
  {
    key: 'activeUsers',
    label: 'Usuários Ativos (30d)',
    icon: '✅',
    format: (v) => v,
  },
  {
    key: 'totalTransactions',
    label: 'Total de Transações',
    icon: '📊',
    format: (v) => v.toLocaleString('pt-BR'),
  },
  {
    key: 'newUsersThisMonth',
    label: 'Novos este Mês',
    icon: '🆕',
    format: (v) => v,
  },
  {
    key: 'dbSizeKB',
    label: 'Tamanho do Banco',
    icon: '🗄️',
    format: (v) => `${v.toLocaleString('pt-BR')} KB`,
  },
  {
    key: 'botErrors',
    label: 'Erros do Bot (24h)',
    icon: '⚠️',
    format: (v) => v,
    alert: (v) => v > 0,
  },
];

function StatCard({ icon, label, value, isAlert }) {
  return (
    <div className={`bg-white rounded-xl border ${isAlert ? 'border-red-200' : 'border-gray-200'} p-5 flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        <span className="text-lg leading-none">{icon}</span>
      </div>
      <div className={`text-2xl font-semibold ${isAlert ? 'text-red-500' : 'text-gray-900'}`}>
        {value}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats]     = useState(null);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      navigate('/admin/login', { replace: true });
      return;
    }

    fetch('/api/admin/stats', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem('adminToken');
          navigate('/admin/login', { replace: true });
          return;
        }
        if (!res.ok) throw new Error('Falha ao carregar estatísticas');
        return res.json();
      })
      .then((data) => { if (data) setStats(data); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [navigate]);

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
        <p className="text-gray-400 text-sm mt-0.5">Visão geral do sistema</p>
      </div>

      {loading && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 h-28 animate-pulse">
              <div className="h-3 bg-gray-100 rounded w-2/3 mb-4" />
              <div className="h-7 bg-gray-100 rounded w-1/3" />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-red-600 text-sm">
          {error}
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {CARDS.map(({ key, label, icon, format, alert }) => (
            <StatCard
              key={key}
              icon={icon}
              label={label}
              value={format(stats[key])}
              isAlert={alert?.(stats[key]) ?? false}
            />
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
