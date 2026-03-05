"use client";

import React from "react";

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
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
          : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
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
  // filtros header
  q,
  onChangeQ,
  estadoFilter,
  onChangeEstado,
  periodo,
  onChangePeriodo,
  onClear,
  pageSize,
  onChangePageSize,
  // acciones
  uploadingId,
  onOpenVincular,
  onOpenRendicion,
  onUploadPdfClick,
  // helpers
  fmtDateDMY,
  toCLP,
  getVincPct,
}) {
  return (
    <div className="bg-white  rounded-xl border border-slate-200  shadow-sm overflow-hidden">
      {/* toolbar filtros */}
      <div className="p-4 border-b border-slate-100  bg-slate-50/50 ">
        <div className="flex flex-col xl:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
            <div className="relative w-full md:w-80">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                🔎
              </span>
              <input
                className="w-full pl-10 pr-4 py-2 bg-white  border border-slate-200  rounded-lg text-sm focus:ring-2 focus:ring-slate-200 "
                placeholder="Proveedor, RUT, folio, proyecto..."
                value={q}
                onChange={(e) => onChangeQ?.(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-500 uppercase">
                Estado
              </label>
              <select
                className="bg-white  border border-slate-200  rounded-lg text-sm py-2 px-3"
                value={estadoFilter}
                onChange={(e) => onChangeEstado?.(e.target.value)}
              >
                <option value="ALL">Todos</option>
                <option value="ORDEN_COMPRA">ORDEN_COMPRA</option>
                <option value="FACTURADA">FACTURADA</option>
                <option value="PAGADA">PAGADA</option>
                <option value="PENDIENTE">PENDIENTE</option>
                <option value="VINCULADO">VINCULADO</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-500 uppercase">
                Periodo
              </label>
              <input
                type="month"
                className="bg-white  border border-slate-200  rounded-lg text-sm py-2 px-3"
                value={periodo}
                onChange={(e) => onChangePeriodo?.(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 w-full xl:w-auto justify-end">
            <button
              type="button"
              onClick={onClear}
              className="px-4 py-2 text-sm font-medium text-slate-600  hover:bg-slate-100  rounded-lg transition-colors"
            >
              Limpiar
            </button>
            <div className="h-6 w-px bg-slate-200  mx-1" />
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
            </div>
          </div>
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
                Proyecto
              </th>
              <th className="px-6 py-4 font-medium uppercase tracking-wider text-[11px] text-center">
                PDF
              </th>
              <th className="px-6 py-4 font-medium uppercase tracking-wider text-[11px] text-center">
                Rendición
              </th>
              <th className="px-6 py-4 font-medium uppercase tracking-wider text-[11px] text-center">
                Vínculo Costeo
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
                      <span className="text-xs bg-slate-100  px-2 py-1 rounded-md text-slate-600  whitespace-nowrap">
                        {proyecto}
                      </span>
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
                      <div className="flex flex-col items-center gap-1">
                        <span className={pctBadge(pct)}>
                          {pct >= 100 ? "⛓️" : pct > 0 ? "🔗" : "⛓️‍💥"}
                        </span>
                        <span
                          className={`text-[10px] font-bold ${
                            pct >= 100
                              ? "text-emerald-600"
                              : pct > 0
                                ? "text-amber-600"
                                : "text-slate-400"
                          }`}
                        >
                          {Math.round(pct)}%
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-right font-bold text-slate-900 ">
                      {toCLP(c?.total)}
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          className="p-1.5 text-slate-400 hover:text-primary hover:bg-blue-50  rounded-lg transition-all"
                          title="Vincular a Costeo"
                          type="button"
                          onClick={() => onOpenVincular?.(c)}
                        >
                          🔗
                        </button>

                        <button
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50  rounded-lg transition-all"
                          title="Ver Rendición"
                          type="button"
                          onClick={() => onOpenRendicion?.(c)}
                        >
                          🧾
                        </button>

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