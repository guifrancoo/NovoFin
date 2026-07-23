import React from 'react';

export default function RecorrenteToggle({ value, onChange, meses, onMesesChange }) {
  return (
    <div className="flex flex-wrap items-center gap-3 py-1">
      <button type="button"
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          value ? 'bg-blue-500' : 'bg-gray-200'
        }`}>
        <span className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform"
          style={{ transform: value ? 'translateX(18px)' : 'translateX(2px)' }} />
      </button>
      <span className="text-sm text-gray-600">
        🔁 Recorrente
        <span className="text-xs text-gray-400 ml-1">cobrada todo mês</span>
      </span>
      {value && (
        <div className="flex items-center gap-1.5 w-full sm:w-auto mt-1 sm:mt-0">
          <label className="text-xs text-gray-500 whitespace-nowrap">Repetir por</label>
          <input
            type="number" min="1" max="36"
            value={meses}
            onChange={(e) => onMesesChange(e.target.value)}
            className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-navy/20 text-center"
          />
          <label className="text-xs text-gray-500 whitespace-nowrap">meses</label>
        </div>
      )}
    </div>
  );
}
