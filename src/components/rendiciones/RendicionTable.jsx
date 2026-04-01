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

function fmtDateDMY(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear());
  return `${dd}-${mm}-${yy}`;
}

export default function RendicionTable({
  rows,
  loading,
  onVerRendicion,
  onPagar,
}) {
  const getEstadoColor = (estado) => {
    const e = String(estado || "").toUpperCase();
    if (e === "PAGADA" || e === "PAGADO") return "bg-emerald-100 text-emerald-800 border-emerald-200";
    if (e === "PAGADA_PARCIAL") return "bg-teal-100 text-teal-800 border-teal-200";
    if (e === "APROBADA" || e === "APROBADO") return "bg-blue-100 text-blue-800 border-blue-200";
    if (e === "RECHAZADA" || e === "RECHAZADO") return "bg-rose-100 text-rose-800 border-rose-200";
    return "bg-amber-100 text-amber-800 border-amber-200"; // Pendiente
  };

  if (loading && !rows.length) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
        <p className="text-slate-500 font-medium tracking-tight">Cargando rendiciones...</p>
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center justify-center gap-4 text-center">
        <div className="text-4xl">📎</div>
        <div>
          <p className="text-slate-900 font-bold text-lg leading-tight">Sin rendiciones</p>
          <p className="text-slate-500 text-sm mt-1 max-w-xs">
            No encontramos rendiciones de gastos con los filtros actuales.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest leading-none">
                Código / Fecha
              </th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest leading-none">
                Empleado
              </th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest leading-none">
                Destino / Proyecto
              </th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest leading-none">
                Monto
              </th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest leading-none">
                Estado
              </th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest leading-none text-right">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 italic-last-row">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/50 transition-colors group">
                <td className="px-6 py-4">
                  <div className="font-bold text-slate-900">
                    RD-{String(r.id).slice(-6).toUpperCase()}
                  </div>
                  <div className="text-xs text-slate-400 font-medium">
                    {fmtDateDMY(r.creado_en)}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="font-semibold text-slate-700">
                    {r.empleado?.nombre ?? r.empleado?.rut ?? "Sin nombre"}
                  </div>
                  <div className="text-xs text-slate-400">
                    {r.empleado?.rut || ""}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-tighter">
                    {r.destino}
                  </div>
                  <div className="text-sm font-bold text-slate-800 truncate max-w-[200px]">
                    {r.proyecto?.nombre || r.centro_costo || "-"}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-lg font-black text-slate-900 leading-none">
                    {toCLP(r.monto_total)}
                  </div>
                  {r.monto_pagado > 0 && r.monto_pagado < r.monto_total && (
                    <div className="text-[10px] font-bold text-emerald-600 mt-1 uppercase tracking-tighter">
                      Pagado: {toCLP(r.monto_pagado)}
                    </div>
                  )}
                  {r.monto_pagado > 0 && r.monto_pagado < r.monto_total && (
                     <div className="w-full bg-slate-100 h-1 rounded-full mt-1 overflow-hidden">
                        <div 
                          className="bg-emerald-500 h-full transition-all" 
                          style={{ width: `${(r.monto_pagado / r.monto_total) * 100}%` }}
                        />
                     </div>
                  )}
                </td>
                <td className="px-6 py-4 text-sm font-medium">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${getEstadoColor(r.estado)}`}>
                    {r.estado}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => onVerRendicion(r)}
                      className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-400 rounded-lg transition-all bg-white"
                    >
                      Detalle
                    </button>
                    {(r.estado?.toUpperCase() === "PENDIENTE" || r.estado?.toUpperCase() === "APROBADA" || r.estado?.toUpperCase() === "PAGADA_PARCIAL") && (
                      <button
                        onClick={() => onPagar(r)}
                        className="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm active:scale-95 transition-all"
                      >
                        {r.monto_pagado > 0 ? "Abonar" : "Pagar"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
