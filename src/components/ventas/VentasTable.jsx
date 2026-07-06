"use client";

import { useEffect, useMemo, useRef, useState } from "react";

//components
import DropdownPortal from "../ui/DropdownPortal";
import BorderColorRoundedIcon from "@mui/icons-material/BorderColorRounded";

//icons
import DeleteForeverRoundedIcon from "@mui/icons-material/DeleteForeverRounded";
import { exportGeneralPDF } from "./utils/exportGeneralPDF";

function clp(v) {
  const n = Number(v || 0);
  return n.toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}

function calcTotalVenta(venta) {
  // ✅ si el backend ya entrega totalFinal, úsalo
  if (venta?.totalFinal != null) return Number(venta.totalFinal) || 0;

  const detalles = venta?.detalles || [];
  return detalles.reduce(
    (s, d) => s + (Number(d.total ?? d.ventaTotal) || 0),
    0,
  );
}

function calcTotalCosto(venta) {
  // ✅ si el backend ya entrega costoFinal, úsalo
  if (venta?.costoFinal != null) return Number(venta.costoFinal) || 0;

  const detalles = venta?.detalles || [];
  return detalles.reduce((s, d) => s + (Number(d.costoTotal) || 0), 0);
}

function calcPctUtilSobreCosto(venta) {
  const totalCosto = calcTotalCosto(venta);
  const utilidad = calcTotalVenta(venta) - totalCosto;
  return totalCosto > 0 ? (utilidad / totalCosto) * 100 : 0;
}

function getFechaLabel(venta) {
  return venta?.fecha ? new Date(venta.fecha).toLocaleDateString("es-CL") : "-";
}

function getCotLabel(venta) {
  // tu plantilla dice “Sin Cotización” o “COT #004”
  if (venta?.ordenVenta?.numero) return `COT #${venta.ordenVenta.numero}`;
  if (venta?.ordenVentaId)
    return `COT #${String(venta.ordenVentaId).slice(-4)}`;
  return "Sin Cotización";
}

function isCot(venta) {
  return !!(venta?.ordenVenta || venta?.ordenVentaId);
}

function inMonth(dateLike, year, monthIndex0) {
  const d = dateLike ? new Date(dateLike) : null;
  if (!d || isNaN(d.getTime())) return false;
  return d.getFullYear() === year && d.getMonth() === monthIndex0;
}

export default function VentasTable({
  ventas = [],
  loading,
  error,
  onCreateCotizacionFromVenta,
  onEditVenta,
  onDisableVenta,
  onOpenReport,
  session,
}) {
  // Tabs arriba (Costeos / Cotizaciones) -> Cotizaciones placeholder
  const [tab, setTab] = useState("costeos"); // "costeos" | "cotizaciones"
  const [exportingPdf, setExportingPdf] = useState(false);

  // paginación
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // menú por card
  const [menuOpenId, setMenuOpenId] = useState(null);
  const menuRef = useRef(null);

  const filtered = useMemo(() => {
    const list = [...(ventas || [])].sort((a, b) => {
      const da = a?.fecha ? new Date(a.fecha).getTime() : 0;
      const db = b?.fecha ? new Date(b.fecha).getTime() : 0;
      return db - da;
    });

    // si usuario cambia a “cotizaciones” (placeholder), por ahora mostramos solo los que tienen cot
    let out = list;
    if (tab === "cotizaciones") out = out.filter((v) => isCot(v));

    return out;
  }, [ventas, tab]);

  const paged = useMemo(() => {
    const start = page * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, page, rowsPerPage]);

  useEffect(() => {
    // si cambia el filtro/busqueda, vuelve a 0 para evitar páginas vacías
    setPage(0);
  }, [tab, rowsPerPage]);

  const showingFrom = filtered.length === 0 ? 0 : page * rowsPerPage + 1;
  const showingTo = Math.min(filtered.length, (page + 1) * rowsPerPage);

  if (error) {
    return (
      <div className="bg-white  p-4 rounded-2xl border border-red-200  text-red-600">
        {String(error)}
      </div>
    );
  }

  function calcPctUtilSobreVenta(venta) {
    const totalVenta = calcTotalVenta(venta);
    const totalCosto = calcTotalCosto(venta);
    const utilidad = totalVenta - totalCosto;

    // %u = (venta - costo) / venta
    return totalVenta > 0 ? (utilidad / totalVenta) * 100 : 0;
  }

  //console.log("venta:", venta.id, venta.totalFinal, venta.costoFinal, venta.extraVenta);

  return (
    <div>
      {/* Filtros / Toolbar (plantilla) */}
      {/* 
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-6 flex items-center justify-between">
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setTab("costeos")}
            className={`px-6 py-2 rounded-lg text-sm transition ${
              tab === "costeos"
                ? "font-semibold bg-white text-blue-600 shadow-sm"
                : "font-medium text-slate-500 hover:text-slate-700"
            }`}
          >
            Costeos
          </button>

          <button
            onClick={() => setTab("cotizaciones")}
            className={`px-6 py-2 rounded-lg text-sm transition ${
              tab === "cotizaciones"
                ? "font-semibold bg-white text-blue-600 shadow-sm"
                : "font-medium text-slate-500 hover:text-slate-700"
            }`}
          >
            Cotizaciones
          </button>
        </div>
      </div>
      */}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center gap-2 text-slate-500  mb-6">
          <div className="h-5 w-5 rounded-full border-2 border-slate-200 border-t-blue-600 animate-spin" />
          Cargando costeos...
        </div>
      ) : null}

      {/* Lista */}
      <div className="space-y-4 mb-8">
        {!loading && filtered.length === 0 ? (
          <div className="bg-white  p-6 rounded-2xl border border-slate-200  text-slate-600 ">
            No hay registros para los filtros actuales.
          </div>
        ) : (
          paged.map((venta) => {
            const totalVenta = calcTotalVenta(venta);
            const totalCosto = calcTotalCosto(venta);
            const pct = Number(venta?.utilidadObjetivoPct ?? 0) || 0;
            //const pct = Number(venta?.ordenVenta?.subtotal ?? 3);

            const items = (venta?.detalles || []).length;

            const cotLabel = getCotLabel(venta);
            const cotIsReal = isCot(venta);

            //const pctWidth = Math.max(0, Math.min(100, pct));

            const pctReal = calcPctUtilSobreVenta(venta); // ✅ real según venta/costo finales
            const pctWidth = Math.max(0, Math.min(100, pctReal));

            return (
              <div
                key={venta.id}
                className="group bg-white  rounded-2xl border border-slate-200  shadow-sm hover:shadow-md hover:border-blue-600/30  transition overflow-visible"
              >
                <div className="p-5 flex flex-col lg:flex-row lg:items-center gap-6">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="h-12 w-12 bg-slate-100  flex items-center justify-center rounded-xl font-bold text-slate-700 ">
                      #{venta.numero ?? "—"}
                    </div>

                    <div>
                      <h4 className="font-bold text-lg group-hover:text-blue-600 transition flex items-center gap-2 flex-wrap">
                        {venta.descripcion || "Sin descripción"}
                        {venta.esProyectado && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-wider">
                            Proyectado
                          </span>
                        )}
                      </h4>

                      <p className="text-sm text-slate-500  flex items-center gap-2">
                        <span className="text-base">📅</span>{" "}
                        {getFechaLabel(venta)}
                        <span className="mx-1 text-slate-300">•</span>
                        {!cotIsReal ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100  text-slate-600  uppercase tracking-wider">
                            {cotLabel}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-100  text-blue-600  uppercase tracking-wider">
                            {cotLabel}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 items-center">
                    <div className="text-center lg:text-left">
                      <p className="text-xs uppercase font-semibold text-slate-400 tracking-wider mb-1">
                        Ítems
                      </p>
                      <p className="font-semibold">
                        {items} {items === 1 ? "Ítem" : "Ítems"}
                      </p>
                    </div>

                    <div className="text-center lg:text-left">
                      <p className="text-xs uppercase font-semibold text-slate-400 tracking-wider mb-1">
                        Total
                      </p>
                      <p className="font-bold text-lg">{clp(totalVenta)}</p>
                    </div>

                    <div className="flex flex-col items-center lg:items-start min-w-[140px]">
                      <p className="text-xs uppercase font-semibold text-slate-400 tracking-wider mb-2">
                        % Utilidad
                      </p>
                      <div className="w-full bg-slate-100  rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-green-500 h-full rounded-full"
                          style={{ width: `${pctWidth}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-green-500 mt-1">
                        {pctReal.toFixed(1)}%
                      </span>
                    </div>

                    <div className="flex justify-end gap-2 relative z-50">
                      {/* Botón Crear Cotización */}
                      <button
                        onClick={() => onCreateCotizacionFromVenta?.(venta.id)}
                        className="p-2.5 text-blue-600 bg-blue-600/10 hover:bg-blue-600 hover:text-white rounded-xl transition hover:cursor-pointer"
                        title="Ver / Crear cotización"
                      >
                        📄
                      </button>

                      {/* Botón Reporte de Costeo */}
                      <button
                        onClick={() => onOpenReport?.(venta)}
                        className="p-2.5 text-indigo-600 bg-indigo-600/10 hover:bg-indigo-600 hover:text-white rounded-xl transition hover:cursor-pointer flex items-center justify-center"
                        title="Ver Reporte de Costeo"
                      >
                        📊
                      </button>

                      {/* Botón menú ⋮ */}
                      <button
                        ref={menuOpenId === venta.id ? menuRef : null}
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId((prev) =>
                            prev === venta.id ? null : venta.id,
                          );
                        }}
                        className="p-2.5 text-slate-400 hover:bg-slate-100  rounded-xl transition hover:cursor-pointer"
                        title="Más"
                      >
                        ⋮
                      </button>

                      {/* Dropdown */}
                      {menuOpenId === venta.id && (
                        <DropdownPortal
                          open={true}
                          anchorRef={menuRef}
                          onClose={() => setMenuOpenId(null)}
                        >
                          {/* EDITAR */}
                          <button
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setMenuOpenId(null);
                              onEditVenta?.(venta.id);
                            }}
                            className="w-full flex items-center justify-between text-left px-3 py-2 rounded-lg hover:bg-slate-50  text-sm hover:cursor-pointer"
                          >
                            <span className="font-bold uppercase">
                              Editar costeo
                            </span>
                            <BorderColorRoundedIcon fontSize="small" />
                          </button>

                          {/* ELIMINAR */}
                          <button
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setMenuOpenId(null);
                              onDisableVenta?.(venta);
                            }}
                            className="w-full flex items-center justify-between text-left px-3 py-2 rounded-lg hover:bg-red-50  text-sm text-red-600 hover:cursor-pointer"
                          >
                            <span className="font-bold uppercase">
                              Eliminar costeo
                            </span>
                            <DeleteForeverRoundedIcon fontSize="small" />
                          </button>
                        </DropdownPortal>
                      )}
                    </div>
                  </div>
                </div>

                {/* mini detalle (opcional) */}
                <div className="px-5 pb-5 -mt-2 text-xs text-slate-400">
                  Costo:{" "}
                  <span className="font-semibold text-slate-600 ">
                    {clp(totalCosto)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Paginación (plantilla) */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-4 border-t border-slate-200 ">
        <p className="text-sm text-slate-500 ">
          Mostrando{" "}
          <span className="font-semibold text-slate-900 ">
            {showingFrom} - {showingTo}
          </span>{" "}
          de{" "}
          <span className="font-semibold text-slate-900 ">
            {filtered.length}
          </span>{" "}
          resultados
        </p>

        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500 mr-2">Filas por página:</span>

          <select
            value={rowsPerPage}
            onChange={(e) => setRowsPerPage(Number(e.target.value))}
            className="bg-white  border border-slate-200  text-sm rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>

          <div className="flex gap-1 ml-4">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-2 rounded-lg border border-slate-200  hover:bg-slate-50  disabled:opacity-50"
              title="Anterior"
            >
              ‹
            </button>

            <button
              onClick={() => {
                const maxPage = Math.max(
                  0,
                  Math.ceil(filtered.length / rowsPerPage) - 1,
                );
                setPage((p) => Math.min(maxPage, p + 1));
              }}
              disabled={(page + 1) * rowsPerPage >= filtered.length}
              className="p-2 rounded-lg border border-slate-200  hover:bg-slate-50  disabled:opacity-50"
              title="Siguiente"
            >
              ›
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
