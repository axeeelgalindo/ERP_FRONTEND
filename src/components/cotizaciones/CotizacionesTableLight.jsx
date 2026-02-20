"use client";

import { useMemo, useState } from "react";
import CotizacionPDFButtonLight from "@/components/cotizaciones/CotizacionPDFButtonLight";
import CotizacionPDFButton from "./CotizacionPDFButton";
import { fechaCL, formatCLP } from "@/components/cotizaciones/utils/utils";
import { IconButton } from "@mui/material";
import { MoreVerticalIcon } from "lucide-react";
import CotizacionActionsMenu from "@/components/cotizaciones/CotizacionActionsMenu";

function EstadoBadge({ estado, siguiente }) {
  const e = (estado || "COTIZACION").toUpperCase();

  const cls =
    e === "COTIZACION"
      ? "bg-blue-100 text-blue-700"
      : e === "ACEPTADA"
        ? "bg-emerald-100 text-emerald-700"
        : e === "PENDIENTE"
          ? "bg-amber-100 text-amber-700"
          : e === "RECHAZADA"
            ? "bg-red-100 text-red-700"
            : "bg-slate-100 text-slate-600";

  

  return (
    <div className="flex flex-col">
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold w-fit ${cls}`}
      >
        {e.replaceAll("_", " ")}
      </span>
      {siguiente ? (
        <span className="text-[10px] text-slate-400 mt-1 uppercase tracking-tight">
          Sig: {String(siguiente).replaceAll("_", " ")}
        </span>
      ) : null}
    </div>
  );
}

// Si tienes nextEstados en utils, úsalo; si no, lo dejamos simple
function getSiguienteEstado(c) {
  // Si ya tienes `nextEstados` en utils, cámbialo acá por tu función real
  // return nextEstados(c.estado || "COTIZACION")?.[0] || null;
  return c?.estado === "COTIZACION" ? "ACEPTADA" : null;
}

export default function CotizacionesTableLight({
  cotizaciones = [],
  onRowClick,
  onEdit,

  onUpdateEstado,
  onEditCotizacion, // ✅ NUEVO
}) {
  const rows = useMemo(() => cotizaciones ?? [], [cotizaciones]);
  const [menuId, setMenuId] = useState(null);

  const [anchorEl, setAnchorEl] = useState(null);
  const [menuCot, setMenuCot] = useState(null);
  const openMenu = Boolean(anchorEl);

  const handleOpenMenu = (e, cot) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
    setMenuCot(cot);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
    setMenuCot(null);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider">
              <th className="px-6 py-4">#</th>
              <th className="px-6 py-4">Fecha</th>
              <th className="px-6 py-4">Cliente</th>
              <th className="px-6 py-4">Estado</th>
              <th className="px-6 py-4 text-right">Subtotal</th>
              <th className="px-6 py-4 text-right">IVA</th>
              <th className="px-6 py-4 text-right">Total</th>
              <th className="px-6 py-4 text-center">PDF</th>
              <th className="px-6 py-4 text-center">Acciones</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {rows.map((c) => {
              const siguiente = getSiguienteEstado(c);

              return (
                <tr
                  key={c.id}
                  className="hover:bg-blue-50/50 cursor-pointer transition-colors group"
                  onClick={() => onRowClick?.(c)}
                >
                  <td className="px-6 py-4 text-sm font-semibold">
                    {c.numero ?? "—"}
                  </td>

                  <td className="px-6 py-4 text-sm text-slate-600">
                    {fechaCL(c.creada_en)}
                  </td>

                  <td className="px-6 py-4 text-sm font-medium">
                    {c.cliente?.nombre || "Sin cliente"}
                  </td>

                  <td className="px-6 py-4">
                    <EstadoBadge estado={c.estado} siguiente={siguiente} />
                  </td>

                  <td className="px-6 py-4 text-sm text-right font-medium">
                    {formatCLP(c.subtotal)}
                  </td>

                  <td className="px-6 py-4 text-sm text-right text-slate-600">
                    {formatCLP(c.iva)}
                  </td>

                  <td className="px-6 py-4 text-sm text-right font-bold">
                    {formatCLP(c.total)}
                  </td>

                  <td
                    className="px-6 py-4 text-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <CotizacionPDFButton cotizacion={c} />
                  </td>

                  <td
                    className="px-6 py-4 text-center relative"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <IconButton
                      size="small"
                      onClick={(e) => handleOpenMenu(e, c)}
                    >
                      <MoreVerticalIcon fontSize="small" />
                    </IconButton>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer (mismo look ejemplo) - por ahora solo informativo */}
      <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
        <span className="text-xs text-slate-500">
          Mostrando 1-{rows.length} de {rows.length} resultados
        </span>

        <div className="flex gap-2">
          <button
            className="p-2 border border-slate-200 rounded-lg disabled:opacity-50"
            disabled
            title="Anterior"
          >
            ‹
          </button>

          <button className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-lg">
            1
          </button>

          <button
            className="p-2 border border-slate-200 rounded-lg"
            title="Siguiente"
          >
            ›
          </button>
        </div>
      </div>
      <CotizacionActionsMenu
        open={openMenu}
        anchorEl={anchorEl}
        cotizacion={menuCot}
        onClose={handleCloseMenu}
        onUpdateEstado={onUpdateEstado}
        onEdit={(id) => {
          handleCloseMenu();
          onEditCotizacion?.(id);
        }} // ✅ NUEVO
      />
    </div>
  );
}
