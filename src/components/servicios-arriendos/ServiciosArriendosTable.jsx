"use client";

import { useMemo } from "react";
import { fechaCL, formatCLP } from "@/components/cotizaciones/utils/utils";

function EstadoBadge({ estado }) {
  const e = (estado || "COTIZACION").toUpperCase();

  let label = e.replaceAll("_", " ");
  let cls = "bg-slate-100 text-slate-600";

  if (e === "COTIZACION") {
    label = "Borrador de Servicio";
    cls = "bg-amber-100 text-amber-700";
  } else if (e === "ACEPTADA") {
    label = "Proyecto Andando";
    cls = "bg-emerald-100 text-emerald-700 font-extrabold";
  } else if (e === "RECHAZADA") {
    label = "Servicio Cancelado";
    cls = "bg-rose-100 text-rose-700";
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold w-fit ${cls}`}
    >
      {label}
    </span>
  );
}

export default function ServiciosArriendosTable({
  servicios = [],
  onRowClick,
}) {
  const rows = useMemo(() => servicios ?? [], [servicios]);

  // Helper for displaying monthly rate
  const formatTarifa = (c) => {
    const totalUF = (c.glosas || []).reduce((acc, g) => acc + Number(g.monto_uf || 0), 0);
    const hasIva = c.iva && c.iva > 0;

    if (c.moneda === "UF") {
      if (!hasIva) {
        return `${totalUF.toFixed(2)} UF`;
      }
      const rate = c.subtotal > 0 ? (c.iva / c.subtotal) : 0.19;
      const grossUF = totalUF * (1 + rate);
      return (
        <div className="flex flex-col items-end">
          <span className="font-bold text-blue-800">{grossUF.toFixed(2)} UF <span className="text-[10px] text-slate-500 font-normal">incl.</span></span>
          <span className="text-[11px] text-slate-400 font-normal">Neto: {totalUF.toFixed(2)} UF</span>
        </div>
      );
    }

    if (!hasIva) {
      return formatCLP(c.subtotal);
    }
    return (
      <div className="flex flex-col items-end">
        <span className="font-bold text-blue-800">{formatCLP(c.total)} <span className="text-[10px] text-slate-500 font-normal">incl.</span></span>
        <span className="text-[11px] text-slate-400 font-normal">Neto: {formatCLP(c.subtotal)}</span>
      </div>
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider">
              <th className="px-6 py-4">Nº</th>
              <th className="px-6 py-4">Fecha Inicio</th>
              <th className="px-6 py-4">Cliente</th>
              <th className="px-6 py-4">Servicio / Glosa Principal</th>
              <th className="px-6 py-4 text-center">Duración</th>
              <th className="px-6 py-4 text-right">Tarifa Mensual</th>
              <th className="px-6 py-4 text-right">Total Mensual (CLP)</th>
              <th className="px-6 py-4 text-right">Total Contrato (CLP)</th>
              <th className="px-6 py-4">Estado</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {rows.map((c) => {
              const totalContratoCLP = c.total * (c.ciclos_mensuales || 12);

              return (
                <tr
                  key={c.id}
                  className="hover:bg-blue-50/50 cursor-pointer transition-colors group"
                  onClick={() => onRowClick?.(c)}
                >
                  <td className="px-6 py-4 text-sm font-semibold">
                    {c.numero ? (c.numero >= 1000000 ? c.numero - 1000000 : c.numero) : "—"}
                  </td>

                  <td className="px-6 py-4 text-sm text-slate-600">
                    {fechaCL(c.fecha_documento || c.creada_en)}
                  </td>

                  <td className="px-6 py-4 text-sm font-medium">
                    {c.cliente?.nombre || "Sin cliente"}
                  </td>

                  <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate" title={c.asunto || ""}>
                    {c.asunto || "—"}
                  </td>

                  <td className="px-6 py-4 text-sm text-center font-medium text-slate-700">
                    {c.ciclos_mensuales || 12} meses
                  </td>

                  <td className="px-6 py-4 text-sm text-right font-medium text-slate-700">
                    {formatTarifa(c)}
                  </td>

                  <td className="px-6 py-4 text-sm text-right text-slate-700 font-bold">
                    {formatCLP(c.total)}
                  </td>

                  <td className="px-6 py-4 text-sm text-right font-bold text-slate-800">
                    {formatCLP(totalContratoCLP)}
                  </td>

                  <td className="px-6 py-4">
                    <EstadoBadge estado={c.estado} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
        <span className="text-xs text-slate-500">
          Mostrando {rows.length} servicio(s) / arriendo(s)
        </span>
      </div>
    </div>
  );
}
