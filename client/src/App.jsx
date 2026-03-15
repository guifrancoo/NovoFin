import React from 'react';
import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import Dashboard   from './pages/Dashboard';
import NewExpense  from './pages/NewExpense';
import Invoices    from './pages/Invoices';
import Reports     from './pages/Reports';
import Settings    from './pages/Settings';
import Login       from './pages/Login';
import Profile     from './pages/Profile';

const NAV = [
  { to: '/',              label: 'Dashboard' },
  { to: '/novo',          label: 'Lançamentos' },
  { to: '/faturas',       label: 'Faturas' },
  { to: '/relatorios',    label: 'Relatórios' },
  { to: '/configuracoes', label: 'Configurações' },
];

function RequireAuth({ children }) {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function Layout() {
  const navigate = useNavigate();
  const username = localStorage.getItem('username') || 'admin';

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-brand-700 text-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-8">
          <span className="font-bold text-lg tracking-tight">Financeiro Pessoal</span>
          <nav className="flex gap-1 flex-wrap flex-1">
            {NAV.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'text-blue-100 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-1 ml-auto shrink-0">
            <NavLink
              to="/perfil"
              className={({ isActive }) =>
                `text-sm font-medium px-3 py-1.5 rounded transition-colors ${
                  isActive ? 'bg-white/20 text-white' : 'text-blue-200 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              {username}
            </NavLink>
            <button
              onClick={handleLogout}
              className="text-blue-100 hover:bg-white/10 hover:text-white px-3 py-1.5 rounded text-sm font-medium transition-colors"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        <Routes>
          <Route path="/"              element={<Dashboard />} />
          <Route path="/novo"          element={<NewExpense />} />
          <Route path="/faturas"       element={<Invoices />} />
          <Route path="/relatorios"    element={<Reports />} />
          <Route path="/configuracoes" element={<Settings />} />
          <Route path="/perfil"       element={<Profile />} />
        </Routes>
      </main>

      <footer className="text-center text-xs text-gray-400 py-3 border-t">
        Financeiro Pessoal &mdash; {new Date().getFullYear()}
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      />
    </Routes>
  );
}
