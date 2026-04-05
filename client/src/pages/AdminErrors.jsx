import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from './AdminLayout';

function fmt(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleString('pt-BR');
}

function ErrorRow({ row }) {
  const [expanded, setExpanded] = useState(false);
  const preview = row.error ? row.error.slice(0, 80) + (row.error.length > 80 ? '…' : '') : '—';

  return (
    <>
      <tr className="hover:bg-gray-50/50 transition-colors">
        <td className="px-5 py-3 text-gray-500 whitespace-nowrap text-xs">{fmt(row.created_at)}</td>
        <td className="px-4 py-3 text-gray-600 whitespace-nowrap font-mono text-xs">{row.phone ?? '—'}</td>
        <td className="px-4 py-3 text-gray-600 text-xs">{row.user_id ?? '—'}</td>
        <td className="px-4 py-3 text-gray-700 text-xs max-w-[180px] truncate" title={row.message ?? ''}>
          {row.message ?? '—'}
        </td>
        <td className="px-4 py-3 text-xs">
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-left text-red-500 hover:text-red-700 transition-colors"
          >
            {preview}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-red-50/60">
          <td colSpan={5} className="px-5 py-3">
            <div className="text-xs font-semibold text-red-600 mb-1">Erro completo</div>
            <pre className="text-xs text-red-700 whitespace-pre-wrap break-all font-mono bg-red-50 border border-red-100 rounded-lg p-3">
              {row.error ?? ''}
            </pre>
            {row.stack && (
              <>
                <div className="text-xs font-semibold text-gray-500 mt-3 mb-1">Stack trace</div>
                <pre className="text-xs text-gray-500 whitespace-pre-wrap break-all font-mono bg-gray-50 border border-gray-100 rounded-lg p-3">
                  {row.stack}
                </pre>
              </>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export default function AdminErrors() {
  const navigate = useNavigate();
  const [errors, setErrors]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) { navigate('/admin/login', { replace: true }); return; }

    fetch('/api/admin/errors', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async res => {
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem('adminToken');
          navigate('/admin/login', { replace: true });
          return;
        }
        if (!res.ok) throw new Error('Falha ao carregar erros');
        return res.json();
      })
      .then(data => { if (data) setErrors(data); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [navigate]);

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900">Erros do Bot</h1>
        <p className="text-gray-400 text-sm mt-0.5">Últimos 50 erros registrados</p>
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
                <div className="h-3 bg-gray-100 rounded w-48 ml-auto" />
              </div>
            ))}
          </div>
        ) : errors.length === 0 ? (
          <div className="px-5 py-16 text-center text-gray-400 text-sm">
            Nenhum erro registrado 🎉
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Data/Hora</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Telefone</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Usuário</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Mensagem enviada</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Erro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {errors.map(row => <ErrorRow key={row.id} row={row} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
