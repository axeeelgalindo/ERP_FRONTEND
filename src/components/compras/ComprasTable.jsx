"use client";

import React from "react";
import CompraPDFButton from "./CompraPDFButton";

function pctBadge(p) {
  const v = Number(p || 0);
  if (v >= 100)
    return "text-emerald-600 ";
  if (v > 0) return "text-amber-600 ";
  return "text-slate-400";
}

function estadoBadge(estado) {
  const x = String(estado || "").toUpperCase();
  if (x === "ORDEN_COMPRA")
    return "bg-blue-100 text-blue-800 ";
  if (x === "PENDIENTE")
    return "bg-amber-100 text-amber-800 ";
  if (x === "VINCULADO")
    return "bg-emerald-100 text-emerald-800  ";
  return "bg-slate-100 text-slate-800  ";
}
function RendicionCell({ compra }) {
  const has = !!(compra?.rendicion_id || compra?.rendicionId || compra?.rendicion?.id);

  return (
    <span
      className={[
        "inline-flex items-center justify-center",
        "h-6 w-6 rounded-full text-xs font-bold",
        has
          ? "bg-emerald-100 text-emerald-700  "
          : "bg-rose-100 text-rose-700  ",
      ].join(" ")}
      title={has ? "Con rendición" : "Sin rendición"}
    >
      {has ? "✓" : "✕"}
    </span>
  );
}
export default function ComprasTable({
  API,
  loading,
  rows,
  pageSize,
  onChangePageSize,
  // acciones
  uploadingId,
  onOpenVincular,
  onOpenRendicion,
  onUploadPdfClick,
  onTogglePaid,
  onOpenImputacion,
  // helpers
  fmtDateDMY,
  toCLP,
  getVincPct,
}) {
  return (
    <div className="bg-white  rounded-xl border border-slate-200  shadow-sm overflow-hidden">
      {/* toolbar pagination size control */}
      <div className="p-4 border-b border-slate-100  bg-slate-50/50 flex justify-between items-center">
        <div className="text-sm font-semibold text-slate-700">
          Listado de Compras
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span>Mostrar</span>
          <select
            className="bg-white border border-slate-200  rounded-lg text-xs py-1 px-2"
            value={pageSize}
            onChange={(e) => onChangePageSize?.(e.target.value)}
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <span>registros por página</span>
        </div>
      </div>

      {/* tabla */}
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left text-sm border-collapse min-w-[1200px]">
          <thead>
            <tr className="bg-slate-50/50    text-slate-500  font-semibold border-b border-slate-100 ">
              <th className="px-6 py-4 font-medium uppercase tracking-wider text-[11px]">
                N°
              </th>
              <th className="px-6 py-4 font-medium uppercase tracking-wider text-[11px]">
                Estado
              </th>
              <th className="px-6 py-4 font-medium uppercase tracking-wider text-[11px]">
                Proveedor / RUT
              </th>
              <th className="px-6 py-4 font-medium uppercase tracking-wider text-[11px]">
                Doc / Folio
              </th>
              <th className="px-6 py-4 font-medium uppercase tracking-wider text-[11px]">
                Fecha
              </th>
              <th className="px-6 py-4 font-medium uppercase tracking-wider text-[11px]">
                Destino
              </th>
              <th className="px-6 py-4 font-medium uppercase tracking-wider text-[11px] text-center">
                PDF
              </th>
              <th className="px-6 py-4 font-medium uppercase tracking-wider text-[11px] text-center">
                Rendición
              </th>
              <th className="px-6 py-4 font-medium uppercase tracking-wider text-[11px] text-center">
                Vínculo Cotización
              </th>
              <th className="px-6 py-4 font-medium uppercase tracking-wider text-[11px] text-right">
                Monto Total
              </th>
              <th className="px-6 py-4 font-medium uppercase tracking-wider text-[11px] text-center">
                Acciones
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 ">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-6 py-4 text-slate-400" colSpan={11}>
                    Cargando…
                  </td>
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-6 py-4 text-slate-500" colSpan={11}>
                  No hay compras para mostrar.
                </td>
              </tr>
            ) : (
              rows.map((c, idx) => {
                const proveedor = c?.proveedor?.nombre ?? "-";
                const rut = c?.rut_proveedor ?? c?.proveedor?.rut ?? "-";
                const proyecto = c?.proyecto?.nombre ?? "—";
                const pct = getVincPct(c);
                const hasPdf = Boolean(c?.factura_url);

                const tipoDoc = c?.tipo_doc ?? c?.tipoDoc ?? "-";
                const folio = c?.folio ?? "-";

                const rendicionId =
                  c?.rendicion_id ?? c?.rendicionId ?? c?.rendicion?.id ?? null;

                // “numero” ya lo usas como correlativo
                const numero = c?.numero ?? c?.n ?? idx + 1;

                return (
                  <tr
                    key={c.id}
                    className={`hover:bg-slate-50/80  transition-colors ${
                      idx % 2 ? "bg-slate-50/30 " : ""
                    }`}
                  >
                    <td className="px-6 py-4 font-medium text-slate-400">
                      {numero}
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${estadoBadge(
                          c?.estado,
                        )}`}
                      >
                        {String(c?.estado ?? "-")}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-900  ">
                          {proveedor}
                        </span>
                        <span className="text-xs text-slate-400">{rut}</span>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="bg-slate-100  px-1.5 py-0.5 rounded text-[10px] font-bold">
                          {tipoDoc}
                        </span>
                        <span className="font-medium">{folio}</span>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-slate-600  whitespace-nowrap">
                      {fmtDateDMY(c?.fecha_docto)}
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onOpenImputacion?.(c)}
                          className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition-all border hover:opacity-85 ${
                            c?.destino === "PROYECTO"
                              ? "bg-blue-50 text-blue-700 border-blue-200 hover:border-blue-300"
                              : c?.destino === "TALLER"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:border-emerald-300"
                                : c?.destino === "ADMINISTRACION"
                                  ? "bg-purple-50 text-purple-700 border-purple-200 hover:border-purple-300"
                                  : "bg-slate-50 text-slate-400 border-dashed border-slate-300 hover:border-slate-400"
                          }`}
                          title="Asignar / Cambiar Imputación"
                        >
                          {c?.destino === "PROYECTO"
                            ? `Proyecto: ${proyecto}`
                            : c?.destino === "TALLER"
                              ? `Taller (${c.centro_costo || "S/CC"})`
                              : c?.destino === "ADMINISTRACION"
                                ? `Admin (${c.centro_costo || "S/CC"})`
                                : "No imputado"}
                          <span className="material-symbols-outlined text-[10px] ml-1.5 opacity-60">
                            edit
                          </span>
                        </button>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-center">
                      {hasPdf ? (
                        <a
                          href={`${API.replace(/\/$/, "")}${c.factura_url}`}
                          target="_blank"
                          rel="noreferrer"
                          title="Ver factura PDF"
                          className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200  hover:bg-slate-50 "
                        >
                          ✓
                        </a>
                      ) : (
                        <span
                          title="Sin factura"
                          className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200   bg-white  text-slate-300 "
                        >
                          ✕
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-center">
                      <RendicionCell compra={c} />
                    </td>

                    <td className="px-6 py-4 text-center">
                      {c?.cotizacion ? (
                        <span className="inline-flex flex-col items-center gap-0.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Cot. #{c.cotizacion.numero}
                          </span>
                          {c.cotizacion.estado && (
                            <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">
                              {c.cotizacion.estado}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-50 text-slate-400 border border-slate-200 border-dashed">
                          Sin Cotización
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-right font-bold text-slate-900 ">
                      {toCLP(c?.total)}
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          className={`p-1.5 rounded-lg transition-all ${
                            c?.estado === "PAGADA"
                              ? "text-emerald-600 bg-emerald-50 hover:bg-emerald-100"
                              : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                          }`}
                          title={c?.estado === "PAGADA" ? "Marcar como no pagada (FACTURADA)" : "Marcar como pagada (PAGADA)"}
                          type="button"
                          onClick={() => onTogglePaid?.(c)}
                        >
                          💵
                        </button>

                        <button
                          className="p-1.5 text-slate-400 hover:text-primary hover:bg-blue-50  rounded-lg transition-all"
                          title="Vincular a Cotización"
                          type="button"
                          onClick={() => onOpenVincular?.(c)}
                        >
                          🔗
                        </button>

                        <CompraPDFButton compra={c} />

                        <button
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50  rounded-lg transition-all disabled:opacity-60"
                          title="Subir PDF"
                          type="button"
                          onClick={() => onUploadPdfClick?.(c)}
                          disabled={uploadingId === c.id}
                        >
                          ⬆️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}