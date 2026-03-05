"use client";

import React, { useMemo } from "react";

function kpiCard({ title, value, subtitle, icon, iconBg }) {
  return (
    <div className="bg-white  p-6 rounded-xl border border-slate-200  shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-500  uppercase tracking-wider">
          {title}
        </span>
        <div className={`p-2 rounded-lg ${iconBg}`}>{icon}</div>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-slate-900  ">
          {value}
        </span>
        {subtitle ? (
          <span className="text-xs font-medium text-slate-500  ">
            {subtitle}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default function ComprasKpis({
  totalMes,
  pendientesRendicion,
  sinPdf,
  sinVincularCosteo,
}) {
  // icons simples (no dependemos de Material Symbols)
  const icons = useMemo(
    () => ({
      analytics: <span className="text-primary text-lg">▦</span>,
      receipt: <span className="text-amber-600 text-lg">🧾</span>,
      pdf: <span className="text-red-600 text-lg">PDF</span>,
      linkoff: <span className="text-purple-600 text-lg">⛓️</span>,
    }),
    [],
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {kpiCard({
        title: "Total Compras (Mes)",
        value: totalMes ?? 0,
        subtitle: "",
        icon: icons.analytics,
        iconBg: "bg-blue-50 ",
      })}

      {kpiCard({
        title: "Pendientes Rendición",
        value: pendientesRendicion ?? 0,
        subtitle: "Faltan para vincular",
        icon: icons.receipt,
        iconBg: "bg-amber-50 ",
      })}

      {kpiCard({
        title: "Sin Documento PDF",
        value: sinPdf ?? 0,
        subtitle: "Archivos faltantes",
        icon: icons.pdf,
        iconBg: "bg-red-50 ",
      })}

      {kpiCard({
        title: "Sin Vincular a Costeo",
        value: sinVincularCosteo ?? 0,
        subtitle: "Pendientes costeo",
        icon: icons.linkoff,
        iconBg: "bg-purple-50 ",
      })}
    </div>
  );
}