// src/components/clientes/ClientesFiltersBar.jsx
"use client";

import { Search, Badge, FilterList } from "@mui/icons-material";

export default function ClientesFiltersBar({
  q,
  onQ,
  rut,
  onRut,
  showDeleted,
  onShowDeleted,
  onOpenFilters,
  loading,
}) {
  return (
    <div className="bg-white  p-4 rounded-xl border border-slate-200  flex items-center  gap-4 shadow-sm">
            <div className="flex items-center justify-center w-1/2 relative">

        <Search fontSize="small" />
        <input
          className="w-full pl-10 pr-4 py-2 bg-slate-50  border-none rounded-lg focus:ring-2 focus:ring-blue-600 text-sm placeholder:text-slate-400"
          placeholder="Buscar por nombre o correo..."
          type="text"
          value={q}
          onChange={(e) => onQ(e.target.value)}
          disabled={loading}
        />
      </div>

      <div className="flex items-center justify-center w-1/2 relative">
        <Badge fontSize="small" />
        <input
          className="w-full pl-10 pr-4 py-2 bg-slate-50  border-none rounded-lg focus:ring-2 focus:ring-blue-600 text-sm placeholder:text-slate-400"
          placeholder="Filtrar por RUT"
          type="text"
          value={rut}
          onChange={(e) => onRut(e.target.value)}
          disabled={loading}
        />
      </div>

      {/*<div className="flex items-center gap-3 ml-auto px-2">
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            className="sr-only peer"
            type="checkbox"
            checked={!!showDeleted}
            onChange={(e) => onShowDeleted(e.target.checked)}
          />
          <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer  peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
          <span className="ms-3 text-sm font-medium text-slate-500 ">
            Ver eliminados
          </span>
        </label>

        <button
          onClick={onOpenFilters}
          className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
          type="button"
          title="Más filtros"
        >
          <FilterList fontSize="small" />
        </button>
      </div> */}
    </div>
  );
}
