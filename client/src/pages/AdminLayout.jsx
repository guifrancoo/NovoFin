import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

export default function AdminLayout({ children }) {
  const navigate = useNavigate();

  function handleLogout() {
    localStorage.removeItem('adminToken');
    navigate('/admin/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-[#1a1a2e] px-5 h-14 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-5">
          <span className="text-white font-semibold text-sm tracking-tight shrink-0">
            NovoFin Admin
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
          </nav>
        </div>
        <button
          onClick={handleLogout}
          className="text-white/60 hover:text-white text-xs border border-white/20 hover:border-white/40 px-3 py-1.5 rounded-lg transition-colors"
        >
          Sair
        </button>
      </header>

      <main className="flex-1 p-5 sm:p-8">
        <div className="max-w-5xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
