import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { login } from '../api';

export default function Login() {
  const navigate  = useNavigate();
  const location  = useLocation();
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
          <h1 className="text-2xl font-bold text-gray-800 mt-3">
            <span>gr</span><span style={{color:'#2ecc71'}}>ã</span><span>o</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">Entre com suas credenciais</p>
        </div>

        {location.state?.message && (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm mb-4">
            {location.state.message}
          </div>
        )}

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

          <hr className="border-gray-100" />

          <div className="flex flex-col gap-2 text-center">
            <Link to="/first-access" className="text-sm text-gray-500 hover:text-blue-600 transition-colors">
              Primeiro acesso
            </Link>
            <Link to="/forgot-password" className="text-sm text-gray-500 hover:text-blue-600 transition-colors">
              Esqueci minha senha
            </Link>
            <Link to="/forgot-username" className="text-sm text-gray-500 hover:text-blue-600 transition-colors">
              Esqueci meu usuário
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
