import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { updateProfile } from '../api';

export default function Profile() {
  const navigate = useNavigate();
  const currentUsername = localStorage.getItem('username') || '';

  const [form, setForm] = useState({
    new_username:     currentUsername,
    current_password: '',
    new_password:     '',
    confirm_password: '',
  });
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (form.new_password && form.new_password !== form.confirm_password) {
      setError('A nova senha e a confirmação não coincidem.');
      return;
    }
    if (form.new_password && form.new_password.length < 6) {
      setError('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setSaving(true);
    try {
      const payload = { current_password: form.current_password };
      if (form.new_username.trim() !== currentUsername)
        payload.new_username = form.new_username.trim();
      if (form.new_password)
        payload.new_password = form.new_password;

      const res = await updateProfile(payload);
      localStorage.setItem('token',    res.data.token);
      localStorage.setItem('username', res.data.username);

      setSuccess('Dados atualizados com sucesso!');
      setForm((f) => ({ ...f, current_password: '', new_password: '', confirm_password: '' }));
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Minha Conta</h1>

      <div className="bg-white rounded-xl shadow p-6">
        <form onSubmit={handleSave} className="space-y-4">
          {error   && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
          {success && <p className="text-sm text-green-700 bg-green-50 rounded px-3 py-2">{success}</p>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome de usuário</label>
            <input
              type="text" value={form.new_username} onChange={set('new_username')}
              required autoComplete="username"
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>

          <hr className="my-2" />
          <p className="text-xs text-gray-500">Preencha os campos abaixo para alterar a senha. Deixe em branco para manter a senha atual.</p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha atual <span className="text-red-500">*</span></label>
            <input
              type="password" value={form.current_password} onChange={set('current_password')}
              required autoComplete="current-password"
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nova senha</label>
            <input
              type="password" value={form.new_password} onChange={set('new_password')}
              autoComplete="new-password" placeholder="Deixe em branco para não alterar"
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar nova senha</label>
            <input
              type="password" value={form.confirm_password} onChange={set('confirm_password')}
              autoComplete="new-password" placeholder="Repita a nova senha"
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button" onClick={() => navigate(-1)}
              className="px-4 py-2 rounded border text-sm hover:bg-gray-50"
            >Cancelar</button>
            <button
              type="submit" disabled={saving}
              className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
