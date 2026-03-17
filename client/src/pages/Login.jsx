import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api';

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm]   = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login(form);
      const { token, username, is_admin } = res.data;

      console.log('[login] resposta recebida:', {
        token:    token ? `${token.slice(0, 20)}...(${token.length} chars)` : 'AUSENTE',
        username,
        is_admin,
      });

      localStorage.setItem('token',    token);
      localStorage.setItem('username', username);
      localStorage.setItem('is_admin', is_admin ? '1' : '0');

      console.log('[login] localStorage após salvar:', {
        token:    localStorage.getItem('token') ? 'OK' : 'FALHOU',
        username: localStorage.getItem('username'),
        is_admin: localStorage.getItem('is_admin'),
      });

      navigate('/', { replace: true });
    } catch (err) {
      console.error('[login] erro:', err.response?.data || err.message);
      setError(err.response?.data?.error || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-4xl">💰</span>
          <h1 className="text-2xl font-bold text-gray-800 mt-3">Financeiro Pessoal</h1>
          <p className="text-sm text-gray-500 mt-1">Entre com suas credenciais</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Usuário</label>
            <input
              type="text"
              value={form.username}
              onChange={set('username')}
              autoFocus
              required
              placeholder="admin"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
            <input
              type="password"
              value={form.password}
              onChange={set('password')}
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
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
