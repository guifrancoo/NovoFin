import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from './AdminLayout';

function fmt(dateStr) {
  if (!dateStr) return 'Nenhuma';
  const [y, m, d] = dateStr.split('-');
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y}`;
}

function InfoCard({ label, value, sub }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">{label}</div>
      <div className="text-2xl font-semibold text-gray-900">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mb-8">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">{title}</h2>
      {children}
    </div>
  );
}

export default function AdminDbHealth() {
  const navigate = useNavigate();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const fetchData = useCallback(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) { navigate('/admin/login', { replace: true }); return; }

    setLoading(true);
    setError('');

    fetch('/api/admin/db-health', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async res => {
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem('adminToken');
          navigate('/admin/login', { replace: true });
          return;
        }
        if (!res.ok) throw new Error('Falha ao carregar diagnóstico');
        return res.json();
      })
      .then(d => { if (d) setData(d); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [navigate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Saúde do Banco</h1>
          <p className="text-gray-400 text-sm mt-0.5">Diagnóstico do banco de dados</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-medium border border-gray-200 hover:border-gray-300 text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            className={loading ? 'animate-spin' : ''}>
            <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/>
          </svg>
          Verificar agora
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-red-600 text-sm mb-6">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="space-y-8">
          {[5, 3, 2].map((cols, si) => (
            <div key={si}>
              <div className="h-4 bg-gray-100 rounded w-24 mb-3 animate-pulse" />
              <div className={`grid grid-cols-2 md:grid-cols-${cols === 5 ? 3 : cols} gap-4`}>
                {Array.from({ length: cols > 3 ? 3 : cols }).map((_, i) => (
                  <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 h-24 animate-pulse">
                    <div className="h-2.5 bg-gray-100 rounded w-2/3 mb-3" />
                    <div className="h-7 bg-gray-100 rounded w-1/3" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {data && (
        <>
          {/* Section 1 — Visão Geral */}
          <Section title="Visão Geral">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <InfoCard label="Tamanho do Banco"     value={`${data.sizeKB.toLocaleString('pt-BR')} KB`} />
              <InfoCard label="Usuários"             value={data.totalUsers} />
              <InfoCard label="Transações"           value={data.totalTransactions.toLocaleString('pt-BR')} />
              <InfoCard label="Categorias"           value={data.totalCategories} />
              <InfoCard label="Métodos de Pagamento" value={data.totalPaymentMethods} />
            </div>
          </Section>

          {/* Section 2 — Integridade */}
          <Section title="Integridade">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Integrity status */}
              <div className={`bg-white rounded-xl border p-5 flex items-center gap-4 md:col-span-1 ${
                data.integrityCheck === 'ok' ? 'border-green-200' : 'border-red-200'
              }`}>
                {data.integrityCheck === 'ok' ? (
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5">
                      <path d="M20 6L9 17l-5-5"/>
                    </svg>
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                  </div>
                )}
                <div>
                  <div className={`text-sm font-semibold ${data.integrityCheck === 'ok' ? 'text-green-700' : 'text-red-600'}`}>
                    {data.integrityCheck === 'ok' ? 'Banco íntegro' : 'Erro detectado'}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">PRAGMA integrity_check</div>
                </div>
              </div>

              {/* WAL mode */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Modo Journal</div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-semibold text-gray-900 uppercase">{data.walMode}</span>
                  {data.walMode === 'wal' && (
                    <span className="text-xs bg-blue-100 text-blue-700 font-medium px-2 py-0.5 rounded-full">WAL</span>
                  )}
                </div>
              </div>

              {/* Uptime */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Uptime do Servidor</div>
                <div className="text-2xl font-semibold text-gray-900">{data.lastRestart}</div>
                <div className="text-xs text-gray-400 mt-1">desde o último restart</div>
              </div>
            </div>
          </Section>

          {/* Section 3 — Transações */}
          <Section title="Transações">
            <div className="grid grid-cols-2 gap-4">
              <InfoCard
                label="Primeira Transação"
                value={fmt(data.oldestTransaction)}
                sub={data.oldestTransaction ? 'data de compra mais antiga' : undefined}
              />
              <InfoCard
                label="Última Transação"
                value={fmt(data.newestTransaction)}
                sub={data.newestTransaction ? 'data de compra mais recente' : undefined}
              />
            </div>
          </Section>
        </>
      )}
    </AdminLayout>
  );
}
