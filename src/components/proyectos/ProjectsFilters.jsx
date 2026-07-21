"use client";

import { Search, Users, ListFilter } from "lucide-react";

export default function ProjectsFilters({
  q = "",
  onQ,
  estado = "",
  onEstado,
  clienteId = "",
  onClienteId,
  clientes = [],
  loadingClientes = false,
  loading = false,
}) {
  return (
    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Búsqueda por texto */}
        <div className="relative">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            Buscar Proyecto
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Nombre del proyecto..."
              value={q}
              onChange={(e) => onQ && onQ(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 placeholder:text-gray-400 transition-colors"
            />
          </div>
        </div>

        {/* Filtrar por Estado */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            Estado del Proyecto
          </label>
          <div className="relative">
            <ListFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
            <select
              value={estado}
              onChange={(e) => onEstado && onEstado(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 appearance-none transition-colors cursor-pointer"
            >
              <option value="">Todos los estados</option>
              <option value="activo">En espera</option>
              <option value="en_progreso">En progreso</option>
              <option value="finalizado">Finalizado</option>
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 text-xs">
              ▼
            </div>
          </div>
        </div>

        {/* Filtrar por Cliente */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            Cliente / Partner
          </label>
          <div className="relative">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
            <select
              value={clienteId}
              onChange={(e) => onClienteId && onClienteId(e.target.value)}
              className="w-full pl-9 pr-8 py-2 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 appearance-none transition-colors cursor-pointer truncate"
              disabled={loadingClientes}
            >
              <option value="">Todos los clientes</option>
              {loadingClientes ? (
                <option disabled>Cargando clientes...</option>
              ) : (
                clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} {c.rut ? `(${c.rut})` : ""}
                  </option>
                ))
              )}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 text-xs">
              ▼
            </div>
          </div>
        </div>
      </div>

      {(loading || loadingClientes) && (
        <div className="mt-3 text-xs text-blue-600 animate-pulse flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-600"></span>
          Cargando datos filtrados...
        </div>
      )}
    </div>
  );
}
