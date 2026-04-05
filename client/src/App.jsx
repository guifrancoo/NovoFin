import React from 'react';
import { Routes, Route, NavLink, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Dashboard      from './pages/Dashboard';
import NewExpense     from './pages/NewExpense';
import Invoices       from './pages/Invoices';
import Reports        from './pages/Reports';
import Settings       from './pages/Settings';
import Login          from './pages/Login';
import Profile        from './pages/Profile';
import AdminLogin     from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers     from './pages/AdminUsers';

function RequireAuth({ children }) {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function RequireAdmin({ children }) {
  const token = localStorage.getItem('adminToken');
  if (!token) return <Navigate to="/admin/login" replace />;
  return children;
}

const NAV = [
  {
    to: '/',
    label: 'Dashboard',
    icon: (active) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke={active ? '#fff' : 'rgba(255,255,255,0.45)'} strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
    mobileIcon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={active ? '#1a1a2e' : '#9ca3af'} strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    to: '/novo',
    label: 'Lançamentos',
    icon: (active) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke={active ? '#fff' : 'rgba(255,255,255,0.45)'} strokeWidth="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 8v8M8 12h8"/>
      </svg>
    ),
    mobileIcon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={active ? '#1a1a2e' : '#9ca3af'} strokeWidth="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 8v8M8 12h8"/>
      </svg>
    ),
  },
  {
    to: '/faturas',
    label: 'Faturas',
    icon: (active) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke={active ? '#fff' : 'rgba(255,255,255,0.45)'} strokeWidth="2">
        <rect x="2" y="5" width="20" height="14" rx="2"/>
        <path d="M2 10h20"/>
      </svg>
    ),
    mobileIcon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={active ? '#1a1a2e' : '#9ca3af'} strokeWidth="2">
        <rect x="2" y="5" width="20" height="14" rx="2"/>
        <path d="M2 10h20"/>
      </svg>
    ),
  },
  {
    to: '/relatorios',
    label: 'Relatórios',
    icon: (active) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke={active ? '#fff' : 'rgba(255,255,255,0.45)'} strokeWidth="2">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
    mobileIcon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={active ? '#1a1a2e' : '#9ca3af'} strokeWidth="2">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
  {
    to: '/configuracoes',
    label: 'Configurações',
    icon: (active) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke={active ? '#fff' : 'rgba(255,255,255,0.45)'} strokeWidth="2">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 2v2m0 16v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M2 12h2m16 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
      </svg>
    ),
    mobileIcon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={active ? '#1a1a2e' : '#9ca3af'} strokeWidth="2">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 2v2m0 16v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M2 12h2m16 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
      </svg>
    ),
  },
  {
    to: '/perfil',
    label: 'Perfil',
    icon: (active) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke={active ? '#fff' : 'rgba(255,255,255,0.45)'} strokeWidth="2">
        <circle cx="12" cy="8" r="4"/>
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
      </svg>
    ),
    mobileIcon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={active ? '#1a1a2e' : '#9ca3af'} strokeWidth="2">
        <circle cx="12" cy="8" r="4"/>
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
      </svg>
    ),
  },
];

function Sidebar({ username, onLogout }) {
  const location = useLocation();

  return (
    <aside className="hidden md:flex flex-col w-40 bg-navy shrink-0 h-screen sticky top-0">
      {/* Logo */}
      <div className="px-3 py-4 border-b border-white/8">
        <div className="text-white font-semibold text-sm tracking-tight">NovoFin</div>
        <div className="text-white/35 text-xs mt-0.5">Controle financeiro</div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5">
        {NAV.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-2 px-2 py-2 rounded-md text-xs transition-colors ${
                isActive
                  ? 'bg-white/12 text-white font-medium'
                  : 'text-white/60 hover:bg-white/6 hover:text-white/90'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className="shrink-0">{icon(isActive)}</span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer user */}
      <div className="px-2 py-3 border-t border-white/8">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center text-white text-xs font-medium shrink-0">
            {username.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-white/75 text-xs truncate">{username}</div>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="mt-2 w-full text-left text-white/40 hover:text-white/70 text-xs px-1 py-1 transition-colors"
        >
          Sair
        </button>
      </div>
    </aside>
  );
}

function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  // Exclui /novo (FAB dedicado) e /perfil (ícone no Topbar), pega 2 esquerda + 2 direita
  const navItems = NAV.filter(({ to }) => to !== '/novo' && to !== '/perfil');
  const left  = navItems.slice(0, 2);
  const right = navItems.slice(2, 4);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="flex items-center h-16">
        {left.map(({ to, label, mobileIcon }) => {
          const isActive = to === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(to);
          return (
            <NavLink key={to} to={to} end={to === '/'}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2">
              {mobileIcon(isActive)}
              <span className={`text-[10px] font-medium ${isActive ? 'text-navy' : 'text-gray-400'}`}>
                {label}
              </span>
            </NavLink>
          );
        })}

        {/* FAB */}
        <div className="flex-1 flex justify-center">
          <NavLink to="/novo"
            className="w-13 h-13 -mt-5 bg-navy rounded-full flex items-center justify-center shadow-lg border-2 border-gray-100"
            style={{ width: 52, height: 52 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </NavLink>
        </div>

        {right.map(({ to, label, mobileIcon }) => {
          const isActive = location.pathname.startsWith(to);
          return (
            <NavLink key={to} to={to}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2">
              {mobileIcon(isActive)}
              <span className={`text-[10px] font-medium ${isActive ? 'text-navy' : 'text-gray-400'}`}>
                {label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

function Topbar() {
  const location = useLocation();
  const titles = {
    '/':              'Dashboard',
    '/novo':          'Novo lançamento',
    '/faturas':       'Faturas',
    '/relatorios':    'Relatórios',
    '/configuracoes': 'Configurações',
    '/perfil':        'Perfil',
  };
  const title = titles[location.pathname] ?? 'NovoFin';
  const showNewBtn = location.pathname !== '/novo';

  return (
    <header className="bg-white border-b border-gray-200 px-4 md:px-5 h-12 flex items-center justify-between shrink-0">
      <span className="font-semibold text-navy text-sm">{title}</span>
      <div className="flex items-center gap-3">
        {showNewBtn && (
          <NavLink to="/novo"
            className="hidden md:flex items-center gap-1.5 bg-navy text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-navy-light transition-colors">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Novo lançamento
          </NavLink>
        )}
        <NavLink to="/perfil"
          className={({ isActive }) =>
            `md:hidden w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
              isActive ? 'bg-navy/10 text-navy' : 'text-gray-400 hover:text-navy hover:bg-gray-100'
            }`
          }>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="8" r="4"/>
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
          </svg>
        </NavLink>
      </div>
    </header>
  );
}

function Layout() {
  const navigate = useNavigate();
  const username = localStorage.getItem('username') || 'admin';

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('is_admin');
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar username={username} onLogout={handleLogout} />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar />

        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <Routes>
            <Route path="/"              element={<Dashboard />} />
            <Route path="/novo"          element={<NewExpense />} />
            <Route path="/faturas"       element={<Invoices />} />
            <Route path="/relatorios"    element={<Reports />} />
            <Route path="/configuracoes" element={<Settings />} />
            <Route path="/perfil"        element={<Profile />} />
          </Routes>
        </main>
      </div>

      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Admin routes — completely separate from the user app */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route
        path="/admin/dashboard"
        element={
          <RequireAdmin>
            <AdminDashboard />
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/users"
        element={
          <RequireAdmin>
            <AdminUsers />
          </RequireAdmin>
        }
      />
      <Route path="/admin" element={<Navigate to="/admin/login" replace />} />

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
