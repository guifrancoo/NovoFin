import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

export default function AdminLayout({ children }) {
  const navigate = useNavigate();
  const [botErrors, setBotErrors] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) return;
    fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setBotErrors(data.botErrors ?? 0); })
      .catch(() => {});
  }, []);

  function handleLogout() {
    localStorage.removeItem('adminToken');
    navigate('/admin/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-[#1a1a2e] px-5 h-14 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-5">
          <span className="text-white font-semibold text-sm tracking-tight shrink-0">
            <span>gr</span><span style={{color:'#2ecc71'}}>ã</span><span>o</span> Admin
          </span>
          <nav className="flex items-center gap-1">
            <NavLink
              to="/admin/dashboard"
              className={({ isActive }) =>
                `text-xs px-3 py-1.5 rounded-md transition-colors ${
                  isActive
                    ? 'bg-white/15 text-white font-medium'
                    : 'text-white/55 hover:text-white hover:bg-white/10'
                }`
              }
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/admin/users"
              className={({ isActive }) =>
                `text-xs px-3 py-1.5 rounded-md transition-colors ${
                  isActive
                    ? 'bg-white/15 text-white font-medium'
                    : 'text-white/55 hover:text-white hover:bg-white/10'
                }`
              }
            >
              Usuários
            </NavLink>
            <NavLink
              to="/admin/subscriptions"
              className={({ isActive }) =>
                `text-xs px-3 py-1.5 rounded-md transition-colors ${
                  isActive
                    ? 'bg-white/15 text-white font-medium'
                    : 'text-white/55 hover:text-white hover:bg-white/10'
                }`
              }
            >
              Assinaturas
            </NavLink>
            <NavLink
              to="/admin/errors"
              className={({ isActive }) =>
                `relative text-xs px-3 py-1.5 rounded-md transition-colors ${
                  isActive
                    ? 'bg-white/15 text-white font-medium'
                    : 'text-white/55 hover:text-white hover:bg-white/10'
                }`
              }
            >
              Erros
              {botErrors > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold leading-none rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                  {botErrors > 99 ? '99+' : botErrors}
                </span>
              )}
            </NavLink>
            <NavLink
              to="/admin/db-health"
              className={({ isActive }) =>
                `text-xs px-3 py-1.5 rounded-md transition-colors ${
                  isActive
                    ? 'bg-white/15 text-white font-medium'
                    : 'text-white/55 hover:text-white hover:bg-white/10'
                }`
              }
            >
              Banco
            </NavLink>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="https://graofin.up.railway.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-3 py-1.5 rounded-md transition-colors text-white/55 hover:text-white hover:bg-white/10"
          >
            ← Ir para o app
          </a>
          <button
            onClick={handleLogout}
            className="text-white/60 hover:text-white text-xs border border-white/20 hover:border-white/40 px-3 py-1.5 rounded-lg transition-colors"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="flex-1 p-5 sm:p-8">
        <div className="max-w-5xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
