import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { updateProfile, getUsers, createUser, deleteUser, getMe, getWhatsappStatus, generateLinkCode, unlinkWhatsapp } from '../api';

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy/40 transition-colors';
const labelCls = 'block text-xs font-medium text-gray-500 mb-1';

export default function Profile() {
  const navigate = useNavigate();
  const currentUsername = localStorage.getItem('username') || '';
  const [isAdmin, setIsAdmin] = useState(localStorage.getItem('is_admin') === '1');

  useEffect(() => {
    getMe().then((res) => {
      const adminFromServer = res.data.is_admin === true;
      localStorage.setItem('is_admin', adminFromServer ? '1' : '0');
      setIsAdmin(adminFromServer);
    }).catch(() => {});
  }, []);

  // ── Perfil ─────────────────────────────────────────────────────────────────
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
    setError(''); setSuccess('');
    if (form.new_password && form.new_password !== form.confirm_password)
      return setError('A nova senha e a confirmação não coincidem.');
    if (form.new_password && form.new_password.length < 6)
      return setError('A nova senha deve ter pelo menos 6 caracteres.');
    setSaving(true);
    try {
      const payload = { current_password: form.current_password };
      if (form.new_username.trim() !== currentUsername) payload.new_username = form.new_username.trim();
      if (form.new_password) payload.new_password = form.new_password;
      const res = await updateProfile(payload);
      localStorage.setItem('token',    res.data.token);
      localStorage.setItem('username', res.data.username);
      localStorage.setItem('is_admin', res.data.is_admin ? '1' : '0');
      setSuccess('Dados atualizados com sucesso!');
      setForm((f) => ({ ...f, current_password: '', new_password: '', confirm_password: '' }));
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  // ── Usuários (admin) ───────────────────────────────────────────────────────
  const [users, setUsers]             = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [newUser, setNewUser]         = useState({ username: '', password: '' });
  const [userError, setUserError]     = useState('');
  const [userSuccess, setUserSuccess] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);

  useEffect(() => { if (isAdmin) loadUsers(); }, [isAdmin]);

  const loadUsers = async () => {
    setUsersLoading(true);
    try { const res = await getUsers(); setUsers(res.data); }
    catch {} finally { setUsersLoading(false); }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setUserError(''); setUserSuccess(''); setCreatingUser(true);
    try {
      await createUser(newUser);
      setUserSuccess(`Usuário "${newUser.username}" criado com sucesso!`);
      setNewUser({ username: '', password: '' });
      loadUsers();
    } catch (err) {
      setUserError(err.response?.data?.error || 'Erro ao criar usuário.');
    } finally { setCreatingUser(false); }
  };

  const handleDeleteUser = async (user) => {
    if (!confirm(`Excluir o usuário "${user.username}"? Os lançamentos não serão removidos.`)) return;
    try {
      await deleteUser(user.id);
      setUserSuccess(`Usuário "${user.username}" removido.`);
      loadUsers();
    } catch (err) {
      setUserError(err.response?.data?.error || 'Erro ao excluir usuário.');
    }
  };

  // ── WhatsApp ───────────────────────────────────────────────────────────────
  const [waStatus, setWaStatus]     = useState(null);  // null | { linked, phone }
  const [waCode, setWaCode]         = useState('');
  const [waLoading, setWaLoading]   = useState(false);
  const [waError, setWaError]       = useState('');

  useEffect(() => {
    getWhatsappStatus()
      .then((res) => setWaStatus(res.data))
      .catch(() => {});
  }, []);

  const handleGenerateCode = async () => {
    setWaError(''); setWaCode(''); setWaLoading(true);
    try {
      const res = await generateLinkCode();
      setWaCode(res.data.code);
    } catch (err) {
      setWaError(err.response?.data?.error || 'Erro ao gerar código.');
    } finally { setWaLoading(false); }
  };

  const handleUnlink = async () => {
    if (!confirm('Desvincular o WhatsApp desta conta?')) return;
    setWaError(''); setWaLoading(true);
    try {
      await unlinkWhatsapp();
      setWaStatus({ linked: false, phone: null });
      setWaCode('');
    } catch (err) {
      setWaError(err.response?.data?.error || 'Erro ao desvincular.');
    } finally { setWaLoading(false); }
  };

  const initials = currentUsername.charAt(0).toUpperCase();

  return (
    <div className="p-4 md:px-5 md:py-4">
      <div className="max-w-lg mx-auto space-y-4">

        {/* Avatar + nome */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-semibold shrink-0"
            style={{ background: '#1a1a2e' }}>
            {initials}
          </div>
          <div>
            <div className="text-base font-semibold text-navy">{currentUsername}</div>
            <div className="text-xs text-gray-400 mt-0.5">
              {isAdmin
                ? <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">Administrador</span>
                : <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Usuário</span>}
            </div>
          </div>
        </div>

        {/* Formulário de perfil */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="text-sm font-semibold text-navy">Editar perfil</div>
          </div>
          <form onSubmit={handleSave} className="p-5 space-y-4">
            {error   && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            {success && <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">{success}</p>}

            <div>
              <label className={labelCls}>Nome de usuário</label>
              <input type="text" value={form.new_username} onChange={set('new_username')}
                required autoComplete="username" className={inputCls} />
            </div>

            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs text-gray-400 mb-3">Preencha para alterar a senha. Deixe em branco para manter a atual.</p>
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>Senha atual <span className="text-red-400">*</span></label>
                  <input type="password" value={form.current_password} onChange={set('current_password')}
                    required autoComplete="current-password" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Nova senha</label>
                  <input type="password" value={form.new_password} onChange={set('new_password')}
                    autoComplete="new-password" placeholder="Deixe em branco para não alterar" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Confirmar nova senha</label>
                  <input type="password" value={form.confirm_password} onChange={set('confirm_password')}
                    autoComplete="new-password" placeholder="Repita a nova senha" className={inputCls} />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => navigate(-1)}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={saving}
                className="px-4 py-2 rounded-lg bg-navy text-white text-sm hover:bg-navy-light disabled:opacity-50 transition-colors">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>

        {/* Gestão de usuários — admin only */}
        {isAdmin && (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <div className="text-sm font-semibold text-navy">Usuários</div>
            </div>
            <div className="p-5 space-y-4">
              {userError   && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{userError}</p>}
              {userSuccess && <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">{userSuccess}</p>}

              {/* Lista */}
              <div className="space-y-1.5">
                {usersLoading ? (
                  <p className="text-xs text-gray-400 animate-pulse">Carregando...</p>
                ) : users.map((u) => (
                  <div key={u.id}
                    className="flex items-center justify-between border border-gray-100 rounded-lg px-3 py-2.5 hover:bg-gray-50/60 transition-colors group">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600">
                        {u.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-navy">{u.username}</span>
                      {u.is_admin === 1 && (
                        <span className="text-[10px] bg-blue-50 text-blue-700 rounded-full px-2 py-0.5 font-medium">admin</span>
                      )}
                    </div>
                    {u.is_admin !== 1 && (
                      <button onClick={() => handleDeleteUser(u)}
                        className="text-xs text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all px-2 py-1 rounded hover:bg-red-50">
                        Excluir
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Criar usuário */}
              <form onSubmit={handleCreateUser} className="pt-3 border-t border-gray-100 space-y-3">
                <div className="text-xs font-medium text-gray-500">Criar novo usuário</div>
                <div>
                  <label className={labelCls}>Nome de usuário</label>
                  <input type="text" value={newUser.username}
                    onChange={(e) => setNewUser((u) => ({ ...u, username: e.target.value }))}
                    required placeholder="nome_usuario" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Senha <span className="text-gray-400 font-normal">(mín. 6 caracteres)</span></label>
                  <input type="password" value={newUser.password}
                    onChange={(e) => setNewUser((u) => ({ ...u, password: e.target.value }))}
                    required placeholder="••••••" className={inputCls} />
                </div>
                <div className="flex justify-end">
                  <button type="submit" disabled={creatingUser}
                    className="px-4 py-2 rounded-lg bg-success text-white text-sm hover:opacity-90 disabled:opacity-50 transition-opacity">
                    {creatingUser ? 'Criando...' : 'Criar usuário'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* WhatsApp */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="text-sm font-semibold text-navy">WhatsApp</div>
          </div>
          <div className="p-5 space-y-3">
            {waError && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{waError}</p>}

            {waStatus === null ? (
              <p className="text-xs text-gray-400 animate-pulse">Verificando status...</p>
            ) : waStatus.linked ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium bg-green-50 text-green-700 px-2.5 py-1 rounded-full">
                    ✓ WhatsApp vinculado
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  Número: <span className="font-medium text-navy">{waStatus.phone}</span>
                </p>
                <button
                  onClick={handleUnlink}
                  disabled={waLoading}
                  className="px-4 py-2 rounded-lg border border-red-200 text-red-600 text-sm hover:bg-red-50 disabled:opacity-50 transition-colors"
                >
                  {waLoading ? 'Desvinculando...' : 'Desvincular'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-500">
                  Vincule seu WhatsApp para registrar lançamentos por mensagem.
                </p>
                <button
                  onClick={handleGenerateCode}
                  disabled={waLoading}
                  className="px-4 py-2 rounded-lg bg-navy text-white text-sm hover:bg-navy-light disabled:opacity-50 transition-colors"
                >
                  {waLoading ? 'Gerando...' : 'Gerar código de vinculação'}
                </button>
                {waCode && (
                  <div className="space-y-2">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                      <p className="text-xs text-amber-700 font-medium mb-1">Seu código:</p>
                      <p className="text-2xl font-bold tracking-widest text-amber-800">{waCode}</p>
                      <p className="text-xs text-amber-600 mt-1">válido por 15 minutos</p>
                    </div>
                    <p className="text-xs text-gray-500">
                      Envie <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">/vincular {waCode}</span> no WhatsApp para o número{' '}
                      <span className="font-medium text-navy">+1 415 523 8886</span>.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
