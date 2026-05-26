import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AdminLayout from "./AdminLayout";

const PLAN_STYLES = {
  free:      "bg-gray-100 text-gray-600",
  pro:       "bg-green-100 text-green-700",
  suspended: "bg-red-100 text-red-600",
};
const PLAN_LABELS = { free: "Free", pro: "Pro", suspended: "Suspenso" };

function fmt(dateStr) {
  if (!dateStr) return "Nunca";
  const d = new Date(dateStr);
  return isNaN(d) ? "Nunca" : d.toLocaleDateString("pt-BR");
}

function PlanBadge({ plan }) {
  const p = plan || "free";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PLAN_STYLES[p] ?? PLAN_STYLES.free}`}>
      {PLAN_LABELS[p] ?? p}
    </span>
  );
}

function StatusBadge({ pending }) {
  return pending
    ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">Pendente</span>
    : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Ativo</span>;
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">x</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function adminFetch(url, options = {}) {
  const token = localStorage.getItem("adminToken");
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
}

const EMPTY_NEW = { email: "", whatsapp: "", plan: "free" };

export default function AdminUsers() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("userId");

  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [success, setSuccess]     = useState("");

  const [showNew, setShowNew]       = useState(false);
  const [newForm, setNewForm]       = useState(EMPTY_NEW);
  const [newLoading, setNewLoading] = useState(false);
  const [newError, setNewError]     = useState("");

  const [editUser, setEditUser]           = useState(null);
  const [editForm, setEditForm]           = useState({});
  const [editLoading, setEditLoading]     = useState(false);
  const [editError, setEditError]         = useState("");
  const [editSuccess, setEditSuccess]     = useState("");
  const [actionLoading, setActionLoading] = useState("");

  const loadUsers = () => {
    const token = localStorage.getItem("adminToken");
    if (!token) { navigate("/admin/login", { replace: true }); return; }
    setLoading(true);
    adminFetch("/api/admin/users")
      .then(async res => {
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem("adminToken");
          navigate("/admin/login", { replace: true });
          return;
        }
        if (!res.ok) throw new Error("Falha ao carregar usuários");
        return res.json();
      })
      .then(data => { if (data) setUsers(data); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(loadUsers, [navigate]);

  function flash(msg) {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 4000);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setNewError("");
    setNewLoading(true);
    try {
      const res = await adminFetch("/api/admin/users", {
        method: "POST",
        body: JSON.stringify(newForm),
      });
      const data = await res.json();
      if (!res.ok) { setNewError(data.error || "Erro ao criar usuário"); return; }
      setShowNew(false);
      setNewForm(EMPTY_NEW);
      loadUsers();
      flash("Usuário criado e convite enviado!");
    } catch {
      setNewError("Erro de conexão");
    } finally {
      setNewLoading(false);
    }
  }

  function openEdit(u) {
    setEditUser(u);
    setEditForm({ username: u.name, email: u.email || "", whatsapp: u.whatsapp || "", plan: u.plan || "free" });
    setEditError("");
    setEditSuccess("");
    setActionLoading("");
  }

  async function handleEdit(e) {
    e.preventDefault();
    setEditError("");
    setEditLoading(true);
    try {
      const res = await adminFetch(`/api/admin/users/${editUser.id}`, {
        method: "PATCH",
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) { setEditError(data.error || "Erro ao salvar"); return; }
      setEditUser(null);
      loadUsers();
      flash("Usuário atualizado!");
    } catch {
      setEditError("Erro de conexão");
    } finally {
      setEditLoading(false);
    }
  }

  async function handleAction(action) {
    setActionLoading(action);
    setEditSuccess("");
    setEditError("");
    try {
      const res = await adminFetch(`/api/admin/users/${editUser.id}/${action}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) setEditError(data.error || "Erro");
      else setEditSuccess(
        action === "invite"            ? "Convite enviado!" :
        action === "seed-categories"   ? "Categorias criadas!" :
                                         "E-mail de reset enviado!"
      );
    } catch {
      setEditError("Erro de conexão");
    } finally {
      setActionLoading("");
    }
  }

  async function handleDelete(u) {
    if (!window.confirm(`Tem certeza que deseja excluir o usuário "${u.name}"?`)) return;
    try {
      const res = await adminFetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Erro ao excluir"); return; }
      loadUsers();
      flash("Usuário excluído.");
    } catch {
      setError("Erro de conexão");
    }
  }

  async function quickAction(u, action) {
    const label = action === "invite" ? `Reenviar convite para ${u.email}?` : `Enviar reset de senha para ${u.email}?`;
    if (!window.confirm(label)) return;
    try {
      const res = await adminFetch(`/api/admin/users/${u.id}/${action}`, { method: "POST" });
      const data = await res.json();
      if (res.ok) flash(action === "invite" ? "Convite enviado!" : "E-mail de reset enviado!");
      else setError(data.error || "Erro ao enviar");
    } catch {
      setError("Erro de conexão");
    }
  }

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Usuários</h1>
          <p className="text-gray-400 text-sm mt-0.5">{users.length} usuário{users.length !== 1 ? "s" : ""} cadastrado{users.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => { setShowNew(true); setNewError(""); setNewForm(EMPTY_NEW); }}
          className="bg-green-600 hover:bg-green-700 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Novo usuário
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-red-600 text-sm mb-4">{error}</div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 text-green-700 text-sm mb-4">{success}</div>
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
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">E-mail</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">WhatsApp</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Plano</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Transações</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Último Acesso</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Cadastro</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map(u => (
                  <tr key={u.id} className={`transition-colors ${String(u.id) === highlightId ? "bg-blue-50" : "hover:bg-gray-50/50"}`}>
                    <td className="px-5 py-3 font-medium text-gray-900 whitespace-nowrap">{u.name}</td>
                    <td className="px-4 py-3 text-gray-500" style={{maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={u.email ?? ""}>{u.email ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500" style={{maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={u.whatsapp ?? ""}>{u.whatsapp ?? "—"}</td>
                    <td className="px-4 py-3"><PlanBadge plan={u.plan} /></td>
                    <td className="px-4 py-3"><StatusBadge pending={u.must_change_password} /></td>
                    <td className="px-4 py-3 text-right text-gray-700 tabular-nums">{u.transactionCount.toLocaleString("pt-BR")}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmt(u.lastActivity)}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmt(u.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(u)}
                          className="text-xs text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-300 px-2 py-1 rounded-md transition-colors"
                        >
                          Editar
                        </button>
                        {u.must_change_password ? (
                          <button
                            onClick={() => quickAction(u, "invite")}
                            title="Enviar convite"
                            className="text-xs text-green-700 hover:text-green-900 border border-green-200 hover:border-green-300 px-2 py-1 rounded-md transition-colors"
                          >
                            Convidar
                          </button>
                        ) : (
                          <button
                            onClick={() => quickAction(u, "reset-password")}
                            title="Reset senha"
                            className="text-gray-400 hover:text-blue-600 border border-gray-200 hover:border-blue-200 p-1 rounded-md transition-colors"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/admin/subscriptions?userId=${u.id}`)}
                          title="Ver assinatura"
                          className="text-xs text-purple-600 hover:text-purple-800 border border-purple-200 hover:border-purple-300 px-2 py-1 rounded-md transition-colors whitespace-nowrap"
                        >
                          Ass. →
                        </button>
                        <button
                          onClick={() => handleDelete(u)}
                          title="Excluir usuário"
                          className="text-gray-400 hover:text-red-600 border border-gray-200 hover:border-red-200 p-1 rounded-md transition-colors"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showNew && (
        <Modal title="Novo usuário" onClose={() => setShowNew(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            {newError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{newError}</div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">E-mail <span className="text-red-500">*</span></label>
              <input
                type="email" required autoFocus
                value={newForm.email}
                onChange={e => setNewForm(f => ({ ...f, email: e.target.value }))}
                placeholder="usuário@email.com"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">WhatsApp</label>
              <input
                type="text"
                value={newForm.whatsapp}
                onChange={e => setNewForm(f => ({ ...f, whatsapp: e.target.value }))}
                placeholder="+55 11 99999-9999"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Plano</label>
              <select
                value={newForm.plan}
                onChange={e => setNewForm(f => ({ ...f, plan: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="free">Free</option>
                <option value="pro">Pro</option>
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setShowNew(false)}
                className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={newLoading}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors">
                {newLoading ? "Criando..." : "Criar e convidar"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editUser && (
        <Modal title={`Editar — ${editUser.name}`} onClose={() => setEditUser(null)}>
          <form onSubmit={handleEdit} className="space-y-4">
            {editError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{editError}</div>
            )}
            {editSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">{editSuccess}</div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">usuário</label>
              <input type="text"
                value={editForm.username}
                onChange={e => setEditForm(f => ({ ...f, username: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">E-mail</label>
              <input type="email"
                value={editForm.email}
                onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">WhatsApp</label>
              <input type="text"
                value={editForm.whatsapp}
                onChange={e => setEditForm(f => ({ ...f, whatsapp: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Plano</label>
              <select
                value={editForm.plan}
                onChange={e => setEditForm(f => ({ ...f, plan: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="free">Free</option>
                <option value="pro">Pro</option>
                <option value="suspended">Suspenso</option>
              </select>
            </div>

            <div className="flex gap-2 pt-1 border-t border-gray-100">
              <button type="button" disabled={!!actionLoading}
                onClick={() => handleAction("invite")}
                className="flex-1 text-xs text-green-700 border border-green-200 hover:bg-green-50 disabled:opacity-50 py-2 rounded-lg transition-colors">
                {actionLoading === "invite" ? "Enviando..." : "Enviar convite de primeiro acesso"}
              </button>
              <button type="button" disabled={!!actionLoading}
                onClick={() => handleAction("reset-password")}
                className="flex-1 text-xs text-blue-600 border border-blue-200 hover:bg-blue-50 disabled:opacity-50 py-2 rounded-lg transition-colors">
                {actionLoading === "reset-password" ? "Enviando..." : "Enviar reset de senha"}
              </button>
            </div>
            <div className="pt-1">
              <button type="button" disabled={!!actionLoading}
                onClick={() => handleAction("seed-categories")}
                className="w-full text-xs text-orange-600 border border-orange-200 hover:bg-orange-50 disabled:opacity-50 py-2 rounded-lg transition-colors">
                {actionLoading === "seed-categories" ? "Criando..." : "Seed categorias"}
              </button>
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={() => setEditUser(null)}
                className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={editLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors">
                {editLoading ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </AdminLayout>
  );
}
