"use client";

import React, { useState, useMemo } from "react";
import ModalBase from "./ModalBase";

export default function VincularCotizacionModal({
  open,
  onClose,
  compraSel,
  cotizacionesDisponibles,
  cotizacionesLoading,
  cotizacionesErr,
  selectedCotizacionId,
  setSelectedCotizacionId,
  savingVinc,
  savingErr,
  onSave,
  toCLP,
  fmtDateDMY,
}) {
  const [filterNumero, setFilterNumero] = useState("");
  const [filterCliente, setFilterCliente] = useState("");
  const [filterProyecto, setFilterProyecto] = useState("");
  const [filterEstado, setFilterEstado] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Opciones de Clientes
  const clientesOptions = useMemo(() => {
    const map = new Map();
    (cotizacionesDisponibles || []).forEach((c) => {
      if (c.cliente?.id && c.cliente?.nombre) {
        map.set(c.cliente.id, c.cliente.nombre);
      }
    });
    return Array.from(map.entries())
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));
  }, [cotizacionesDisponibles]);

  // Opciones de Proyectos
  const proyectosOptions = useMemo(() => {
    const map = new Map();
    (cotizacionesDisponibles || []).forEach((c) => {
      if (c.proyecto?.id && c.proyecto?.nombre) {
        map.set(c.proyecto.id, c.proyecto.nombre);
      }
    });
    return Array.from(map.entries())
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));
  }, [cotizacionesDisponibles]);

  // Opciones de Estados
  const estadosOptions = [
    { value: "", label: "Todos los estados" },
    { value: "ACEPTADA", label: "ACEPTADA" },
    { value: "ORDEN_VENTA", label: "ORDEN DE VENTA" },
    { value: "ENTREGADO", label: "ENTREGADO" },
    { value: "POR_FACTURAR", label: "POR FACTURAR" },
    { value: "FACTURADA", label: "FACTURADA" },
    { value: "PAGADA", label: "PAGADA" },
  ];

  const hasActiveFilters = Boolean(
    filterNumero || filterCliente || filterProyecto || filterEstado || searchTerm
  );

  const resetFilters = () => {
    setFilterNumero("");
    setFilterCliente("");
    setFilterProyecto("");
    setFilterEstado("");
    setSearchTerm("");
  };

  const filteredCotizaciones = useMemo(() => {
    // Solo cotizaciones "desde ACEPTADA en adelante" (cualquier estado que NO sea COTIZACION ni RECHAZADA)
    const baseList = (cotizacionesDisponibles || []).filter(
      (c) => (c.estado && c.estado !== "COTIZACION" && c.estado !== "RECHAZADA") || c.id === selectedCotizacionId
    );

    return baseList.filter((c) => {
      // 1. Filtro N° Cotización
      if (filterNumero.trim()) {
        const numStr = String(c.numero || "");
        if (!numStr.includes(filterNumero.trim())) return false;
      }

      // 2. Filtro Cliente
      if (filterCliente) {
        if (c.cliente?.id !== filterCliente) return false;
      }

      // 3. Filtro Proyecto
      if (filterProyecto) {
        if (c.proyecto?.id !== filterProyecto) return false;
      }

      // 4. Filtro Estado
      if (filterEstado) {
        if (c.estado !== filterEstado) return false;
      }

      // 5. Búsqueda rápida por texto libre
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const numMatch = String(c.numero).includes(term);
        const clientMatch = String(c.cliente?.nombre || "").toLowerCase().includes(term);
        const projMatch = String(c.proyecto?.nombre || "").toLowerCase().includes(term);
        const asuntoMatch = String(c.asunto || "").toLowerCase().includes(term);
        if (!numMatch && !clientMatch && !projMatch && !asuntoMatch) return false;
      }

      return true;
    });
  }, [
    cotizacionesDisponibles,
    filterNumero,
    filterCliente,
    filterProyecto,
    filterEstado,
    searchTerm,
    selectedCotizacionId,
  ]);

  return (
    <ModalBase
      open={open}
      title={
        compraSel
          ? `Vincular compra #${compraSel?.numero ?? "-"} · Total ${toCLP(compraSel?.total)}`
          : "Vincular compra a Cotización"
      }
      onClose={onClose}
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            className="h-9 rounded-lg border border-slate-200 px-4 text-sm font-semibold hover:bg-slate-50 transition-colors text-slate-600 cursor-pointer"
            onClick={onClose}
            disabled={savingVinc}
            type="button"
          >
            Cancelar
          </button>

          <button
            className="h-9 rounded-lg bg-[#1e3a8a] px-5 text-sm font-bold text-white hover:bg-[#1e3a8a]/90 transition-all disabled:opacity-60 shadow-md cursor-pointer"
            onClick={onSave}
            disabled={savingVinc}
            type="button"
          >
            {savingVinc ? "Guardando…" : "Guardar"}
          </button>
        </div>
      }
    >
      {cotizacionesErr ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {cotizacionesErr}
        </div>
      ) : null}

      {savingErr ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {savingErr}
        </div>
      ) : null}

      <div className="flex flex-col gap-3.5">
        {/* Panel de Filtros Específicos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200/80 shadow-2xs">
          {/* N° Cotización */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              N° Cotización
            </label>
            <input
              type="number"
              placeholder="Ej: 480"
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] placeholder:text-slate-400"
              value={filterNumero}
              onChange={(e) => setFilterNumero(e.target.value)}
            />
          </div>

          {/* Cliente */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Cliente
            </label>
            <select
              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a]"
              value={filterCliente}
              onChange={(e) => setFilterCliente(e.target.value)}
            >
              <option value="">Todos los clientes</option>
              {clientesOptions.map((cli) => (
                <option key={cli.id} value={cli.id}>
                  {cli.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Proyecto */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Proyecto
            </label>
            <select
              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a]"
              value={filterProyecto}
              onChange={(e) => setFilterProyecto(e.target.value)}
            >
              <option value="">Todos los proyectos</option>
              {proyectosOptions.map((proj) => (
                <option key={proj.id} value={proj.id}>
                  {proj.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Estado Cotización */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Estado Cotización
            </label>
            <select
              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a]"
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value)}
            >
              {estadosOptions.map((est) => (
                <option key={est.value} value={est.value}>
                  {est.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Buscador Rápido y Limpiar Filtros */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
            <input
              type="text"
              placeholder="Búsqueda rápida por texto o asunto..."
              className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] bg-white text-slate-800 font-medium placeholder:text-slate-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="px-2.5 py-1.5 text-xs font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 border border-slate-200 hover:border-red-200 rounded-lg transition-colors shrink-0 cursor-pointer flex items-center gap-1"
            >
              <span className="text-sm leading-none">×</span> Limpiar filtros
            </button>
          )}
        </div>

        {/* Lista de Cotizaciones */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex flex-col">
          <div className="p-2.5 border-b border-slate-200 bg-white flex items-center justify-between">
            <span className="font-bold text-xs text-slate-600 uppercase tracking-wider">
              Seleccionar Cotización
            </span>
            <span className="text-xs font-semibold text-slate-400">
              {filteredCotizaciones.length} encontradas
            </span>
          </div>

          <div className="max-h-[300px] overflow-y-auto p-2 flex flex-col gap-1.5 custom-scrollbar">
            {/* Opción desvincular */}
            <label
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                !selectedCotizacionId
                  ? "bg-amber-50/60 border-amber-200 text-amber-900 shadow-2xs"
                  : "bg-white border-slate-100 hover:bg-slate-50 text-slate-600"
              }`}
            >
              <input
                type="radio"
                name="cotizacion_select"
                checked={!selectedCotizacionId}
                onChange={() => setSelectedCotizacionId("")}
                className="text-[#1e3a8a] focus:ring-[#1e3a8a]"
              />
              <div className="flex-1">
                <div className="text-sm font-bold text-slate-900">Ninguna (Desvincular compra)</div>
                <p className="text-xs text-slate-400">La compra quedará huérfana de cotización</p>
              </div>
            </label>

            {cotizacionesLoading ? (
              <div className="p-6 text-center text-sm text-slate-500 font-medium">Cargando cotizaciones...</div>
            ) : filteredCotizaciones.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-400 font-medium italic">
                No se encontraron cotizaciones con los filtros aplicados
              </div>
            ) : (
              filteredCotizaciones.map((c) => {
                const isSelected = selectedCotizacionId === c.id;
                return (
                  <label
                    key={c.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? "bg-blue-50/60 border-blue-200 text-blue-900 shadow-2xs"
                        : "bg-white border-slate-100 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="cotizacion_select"
                      checked={isSelected}
                      onChange={() => setSelectedCotizacionId(c.id)}
                      className="mt-1 text-[#1e3a8a] focus:ring-[#1e3a8a]"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-extrabold text-slate-900">
                          Cot. #{c.numero}
                        </span>
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide ${
                            c.estado === "ACEPTADA" || c.estado === "FACTURADA" || c.estado === "PAGADA"
                              ? "bg-emerald-100 text-emerald-800"
                              : c.estado === "ORDEN_VENTA"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {c.estado}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-600 truncate mt-0.5">
                        Cliente: <span className="font-bold text-slate-800">{c.cliente?.nombre || "-"}</span>
                      </p>
                      {c.proyecto?.nombre && (
                        <p className="text-[11px] text-slate-500 font-medium truncate">
                          Proyecto: <span className="font-bold text-slate-700">{c.proyecto.nombre}</span>
                        </p>
                      )}
                      {c.asunto && (
                        <p className="text-[11px] text-slate-400 italic truncate mt-0.5">
                          "{c.asunto}"
                        </p>
                      )}
                      <p className="text-xs font-bold text-slate-900 mt-1">
                        Total: {toCLP(c.total)}
                      </p>
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>
      </div>
    </ModalBase>
  );
}
