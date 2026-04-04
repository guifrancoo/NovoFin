import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
  const navigate = useNavigate();

  function handleLogout() {
    localStorage.removeItem('adminToken');
    navigate('/admin/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-semibold text-navy">Painel Admin</h1>
            <p className="text-gray-500 text-sm mt-0.5">NovoFin — Administração</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-red-500 border border-gray-200 hover:border-red-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            Sair
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
          Em construção — em breve mais funcionalidades aqui.
        </div>
      </div>
    </div>
  );
}
