"use client";
import { Search, Users, ListFilter } from "lucide-react";

export default function ProjectsFilters({
  q, onQ,
  estado, onEstado,
  cliente, onCliente,
  loading
}) {
  return (
    <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={16} />
        <input
          placeholder="Buscar por nombre o descripción…"
          value={q}
          onChange={(e) => onQ(e.target.value)}
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
        />
      </div>

      <div className="relative">
        <ListFilter className="absolute left-3 top-1/2 -translate-y-1/2" size={16} />
        <input
          placeholder="Filtrar por estado (ej: en progreso, finalizado)…"
          value={estado}
          onChange={(e) => onEstado(e.target.value)}
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
        />
      </div>

      <div className="relative">
        <Users className="absolute left-3 top-1/2 -translate-y-1/2" size={16} />
        <input
          placeholder="Filtrar por cliente…"
          value={cliente}
          onChange={(e) => onCliente(e.target.value)}
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
        />
      </div>

      {loading && (
        <div className="md:col-span-3 text-sm text-gray-500">Cargando…</div>
      )}
    </div>
  );
}
