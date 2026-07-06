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
  const [searchTerm, setSearchTerm] = useState("");

  const filteredCotizaciones = useMemo(() => {
    // Solo cotizaciones "desde ACEPTADA en adelante" (excluyendo COTIZACION y RECHAZADA)
    const allowedStates = ["ACEPTADA", "ORDEN_VENTA", "ENTREGADO", "POR_FACTURAR", "FACTURADA", "PAGADA"];
    const list = (cotizacionesDisponibles || []).filter(
      (c) => allowedStates.includes(c.estado) || c.id === selectedCotizacionId
    );

    if (!searchTerm.trim()) return list;
    const term = searchTerm.toLowerCase();
    return list.filter((c) => {
      const numMatch = String(c.numero).includes(term);
      const clientMatch = String(c.cliente?.nombre || "").toLowerCase().includes(term);
      const projMatch = String(c.proyecto?.nombre || "").toLowerCase().includes(term);
      const asuntoMatch = String(c.asunto || "").toLowerCase().includes(term);
      return numMatch || clientMatch || projMatch || asuntoMatch;
    });
  }, [cotizacionesDisponibles, searchTerm, selectedCotizacionId]);

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
            className="h-9 rounded-lg border border-slate-200 px-4 text-sm font-semibold hover:bg-slate-50 transition-colors text-slate-600"
            onClick={onClose}
            disabled={savingVinc}
            type="button"
          >
            Cancelar
          </button>

          <button
            className="h-9 rounded-lg bg-[#1e3a8a] px-5 text-sm font-bold text-white hover:bg-[#1e3a8a]/90 transition-all disabled:opacity-60 shadow-md"
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

      <div className="flex flex-col gap-4">
        {/* Buscador */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
          <input
            type="text"
            placeholder="Buscar por N° cotización, cliente, proyecto, asunto..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] bg-white text-slate-900"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Lista de Cotizaciones */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex flex-col">
          <div className="p-3 border-b border-slate-200 bg-white flex items-center justify-between">
            <span className="font-semibold text-xs text-slate-500 uppercase tracking-wider">
              Seleccionar Cotización
            </span>
            <span className="text-xs text-slate-400">
              {filteredCotizaciones.length} encontradas
            </span>
          </div>

          <div className="max-h-[320px] overflow-y-auto p-2 flex flex-col gap-1.5 custom-scrollbar">
            {/* Opción desvincular */}
            <label
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                !selectedCotizacionId
                  ? "bg-amber-50/50 border-amber-200 text-amber-900 shadow-sm"
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
                <div className="text-sm font-semibold text-slate-900">Ninguna (Desvincular compra)</div>
                <p className="text-xs text-slate-400">La compra quedará huérfana de cotización</p>
              </div>
            </label>

            {cotizacionesLoading ? (
              <div className="p-4 text-center text-sm text-slate-500">Cargando cotizaciones...</div>
            ) : filteredCotizaciones.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-400">No se encontraron cotizaciones</div>
            ) : (
              filteredCotizaciones.map((c) => {
                const isSelected = selectedCotizacionId === c.id;
                return (
                  <label
                    key={c.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? "bg-blue-50/50 border-blue-200 text-blue-900 shadow-sm"
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
                        <span className="text-sm font-bold text-slate-900">
                          Cot. #{c.numero}
                        </span>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          c.estado === "ACEPTADA" || c.estado === "FACTURADA" || c.estado === "PAGADA"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}>
                          {c.estado}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-600 truncate mt-0.5">
                        Cliente: {c.cliente?.nombre || "-"}
                      </p>
                      {c.proyecto?.nombre && (
                        <p className="text-[11px] text-slate-500 font-medium truncate">
                          Proyecto: {c.proyecto.nombre}
                        </p>
                      )}
                      {c.asunto && (
                        <p className="text-[11px] text-slate-400 italic truncate mt-0.5">
                          "{c.asunto}"
                        </p>
                      )}
                      <p className="text-xs font-bold text-slate-800 mt-1">
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
