import React from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import Dashboard   from './pages/Dashboard';
import NewExpense  from './pages/NewExpense';
import Invoices    from './pages/Invoices';
import Reports     from './pages/Reports';
import Settings    from './pages/Settings';

const NAV = [
  { to: '/',             label: 'Dashboard' },
  { to: '/novo',         label: 'Novo Gasto' },
  { to: '/faturas',      label: 'Faturas' },
  { to: '/relatorios',   label: 'Relatórios' },
  { to: '/configuracoes',label: 'Configurações' },
];

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-brand-700 text-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-8">
          <span className="font-bold text-lg tracking-tight">Financeiro Pessoal</span>
          <nav className="flex gap-1 flex-wrap">
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
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        <Routes>
          <Route path="/"              element={<Dashboard />} />
          <Route path="/novo"          element={<NewExpense />} />
          <Route path="/faturas"       element={<Invoices />} />
          <Route path="/relatorios"    element={<Reports />} />
          <Route path="/configuracoes" element={<Settings />} />
        </Routes>
      </main>

      <footer className="text-center text-xs text-gray-400 py-3 border-t">
        Financeiro Pessoal &mdash; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
