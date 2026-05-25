import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../api';

export default function ResetPassword() {
  const [searchParams]        = useSearchParams();
  const token                 = searchParams.get('token') || '';
  const [newPassword, setNew] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone]       = useState(false);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirm) {
      setError('As senhas não coincidem.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await resetPassword({ token, newPassword });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Token inválido ou expirado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-4xl">💰</span>
          <h1 className="text-2xl font-bold text-gray-800 mt-3">
            <span>gr</span><span style={{ color: '#2ecc71' }}>ã</span><span>o</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">Nova senha</p>
        </div>

        <div className="bg-white rounded-xl shadow p-6 space-y-4">
          {done ? (
            <>
              <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">
                Senha redefinida com sucesso!
              </div>
              <div className="text-center">
                <Link to="/login" className="text-sm text-blue-600 hover:underline">
                  Ir para o login →
                </Link>
              </div>
            </>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nova senha</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNew(e.target.value)}
                  autoFocus
                  required
                  placeholder="••••••••"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar senha</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
              >
                {loading ? 'Salvando...' : 'Redefinir senha'}
              </button>
            </form>
          )}

          {!done && (
            <div className="text-center">
              <Link to="/login" className="text-sm text-blue-600 hover:underline">
                ← Voltar para o login
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
