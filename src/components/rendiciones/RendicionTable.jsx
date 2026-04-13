"use client";

import React from "react";

function toCLP(v) {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return "$0";
  return n.toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}

function getStatusBadge(estado) {
  const e = String(estado || "").toLowerCase();
  if (e === "pagada") return { label: "Pagada", bg: "bg-secondary-container text-on-secondary-container" };
  if (e === "aprobada") return { label: "Aprobada", bg: "bg-primary-container text-on-primary-container" };
  if (e === "rechazada") return { label: "Rechazada", bg: "bg-error-container text-on-error-container" };
  return { label: "Pendiente", bg: "bg-surface-container-high text-on-surface-variant" };
}

export default function RendicionTable({
  rows,
  loading,
  onVerRendicion,
  onPagar,
}) {
  if (loading && !rows.length) {
    return (
      <div className="flex flex-col gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 bg-surface-container-lowest animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="bg-surface-container-lowest rounded-xl p-12 text-center border-2 border-dashed border-surface-container">
        <span className="material-symbols-outlined text-4xl text-outline-variant mb-2">receipt_long</span>
        <p className="text-on-surface font-bold">Sin rendiciones</p>
        <p className="text-on-surface-variant text-sm">No se encontraron registros con los filtros actuales.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {rows.map((r) => {
        const saldo = (r.monto_total || 0) - (r.monto_entregado || 0);
        const st = getStatusBadge(r.estado);

        return (
          <div
            key={r.id}
            onClick={() => onVerRendicion(r)}
            className="bg-surface-container-lowest hover:bg-surface-container-low transition-all rounded-xl p-5 flex flex-wrap md:flex-nowrap items-center gap-6 group border border-transparent hover:border-outline-variant/20 cursor-pointer"
          >
            {/* Solicitante */}
            <div className="flex items-center gap-4 w-full md:w-1/4">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-surface-container flex items-center justify-center text-on-surface-variant">
                <span className="material-symbols-outlined">person</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-on-surface">
                  {r.empleado?.usuario?.nombre || r.empleado?.rut || "Sin nombre"}
                </span>
                <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-medium">
                  {r.empleado?.rut || "-"}
                </span>
              </div>
            </div>

            {/* Proyecto */}
            <div className="w-full md:w-1/4">
              <div className="flex flex-col">
                <span className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold mb-1">Proyecto / Centro Costo</span>
                <span className="text-sm font-semibold text-on-surface truncate">
                  {r.proyecto?.nombre || r.centro_costo || r.destino || "-"}
                </span>
              </div>
            </div>

            {/* Financial Data */}
            <div className="flex-grow grid grid-cols-4 gap-4 px-4 border-l border-outline-variant/10">
              <div className="flex flex-col">
                <span className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold mb-1">Rendido</span>
                <span className="text-sm font-bold text-on-surface">{toCLP(r.monto_total)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold mb-1">Fondo por rendir</span>
                <span className="text-sm font-bold text-on-surface">{toCLP(r.monto_entregado)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold mb-1">Balance</span>
                <span className={`text-sm font-bold ${(r.monto_entregado || 0) >= (r.monto_total || 0) ? "text-secondary" : "text-error"}`}>
                  {(r.monto_entregado || 0) >= (r.monto_total || 0) ? "+" : ""}{toCLP((r.monto_entregado || 0) - (r.monto_total || 0))}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold mb-1">Restante</span>
                <span className={`text-sm font-black ${Math.abs(Math.abs((r.monto_total || 0) - (r.monto_entregado || 0)) - (r.monto_pagado || 0)) < 1 ? "text-secondary" : "text-on-surface"}`}>
                  {toCLP(Math.abs(Math.abs((r.monto_total || 0) - (r.monto_entregado || 0)) - (r.monto_pagado || 0)))}
                </span>
              </div>
            </div>

            {/* Actions & Status */}
            <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tighter ${st.bg}`}>
                {st.label}
              </span>
              <div className="flex items-center gap-2">
                {(r.estado?.toUpperCase() !== "PAGADA" && r.estado?.toUpperCase() !== "RECHAZADA") && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPagar(r);
                    }}
                    className="px-4 py-2 text-xs font-bold bg-primary text-white rounded-lg shadow-sm hover:shadow-md transition-all active:scale-95 whitespace-nowrap"
                  >
                    {r.monto_pagado > 0 ? "Abonar" : "Pagar"}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
