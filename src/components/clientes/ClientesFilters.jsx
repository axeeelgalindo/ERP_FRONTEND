"use client";

import { useCallback } from "react";
import { Search, Phone, IdCard } from "lucide-react";

/**
 * Componente de filtros que acepta indistintamente:
 * - q, setQ / rut, setRut / tel, setTel
 * - q, onQ   / rut, onRut   / tel, onTel
 */
export default function ClientsFilters(props) {
  const {
    q = "",
    rut = "",
    tel = "",
    loading = false,
    className = "",
  } = props;

  // Normaliza handlers: usa onX si existe, sino setX; si no hay, noop
  const changeQ = props.onQ || props.setQ || (() => {});
  const changeRut = props.onRut || props.setRut || (() => {});
  const changeTel = props.onTel || props.setTel || (() => {});

  const handleQ = useCallback((e) => changeQ(e.target.value), [changeQ]);
  const handleRut = useCallback((e) => changeRut(e.target.value), [changeRut]);
  const handleTel = useCallback((e) => changeTel(e.target.value), [changeTel]);

  return (
    <div className={`grid grid-cols-1 md:grid-cols-3 gap-3 ${className}`}>
      {/* Buscar por nombre/correo */}
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
          size={16}
          aria-hidden
        />
        <input
          placeholder="Buscar por nombre o correo…"
          value={q ?? ""}
          onChange={handleQ}
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
          autoComplete="off"
        />
      </div>

      {/* Filtrar por RUT */}
      <div className="relative">
        <IdCard
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
          size={16}
          aria-hidden
        />
        <input
          placeholder="Filtrar por RUT…"
          value={rut ?? ""}
          onChange={handleRut}
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
          autoComplete="off"
        />
      </div>

      {/* Filtrar por teléfono */}
      <div className="relative">
        <Phone
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
          size={16}
          aria-hidden
        />
        <input
          placeholder="Filtrar por teléfono…"
          value={tel ?? ""}
          onChange={handleTel}
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
          autoComplete="off"
        />
      </div>

      
    </div>
  );
}
