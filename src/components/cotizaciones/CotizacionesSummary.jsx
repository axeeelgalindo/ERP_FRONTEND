"use client";

import { useMemo } from "react";

function clp(v) {
  const n = Number(v || 0);
  return n.toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}

function shortCLP(v) {
  const n = Number(v || 0);
  const abs = Math.abs(n);

  if (abs >= 1_000_000) {
    const m = n / 1_000_000;
    const s = Math.abs(m) >= 10 ? `${Math.round(m)}M` : `${m.toFixed(1)}M`;
    return `$${s}`;
  }

  if (abs >= 1_000) {
    const k = n / 1_000;
    const s = Math.abs(k) >= 10 ? `${Math.round(k)}K` : `${k.toFixed(1)}K`;
    return `$${s}`;
  }

  return clp(n).replace("CLP", "").trim();
}

export default function CotizacionesSummary({ cotizaciones }) {
  const totals = useMemo(() => {
    const list = cotizaciones || [];
    let count = list.length || 0;
    let totalCotizado = 0;
    let totalCostoReal = 0;
    let totalVentaReal = 0;
    let totalPagado = 0;

    for (const c of list) {
      totalCotizado += Number(c.total || 0);

      const pagado = c.total_pagado ?? (c.pagos?.reduce((a,p) => a + Number(p.monto||0), 0) || 0);
      totalPagado += pagado;

      const ventas = c.ventas || [];
      for (const v of ventas) {
        const ventaTotal = (v.detalles || []).reduce(
          (acc, d) => acc + (Number(d.ventaTotal ?? d.total) || 0),
          0
        );
        const costoTotal = (v.detalles || []).reduce(
          (acc, d) => acc + (Number(d.costoTotal) || 0),
          0
        );
        totalVentaReal += ventaTotal;
        totalCostoReal += costoTotal;
      }
    }

    const utilidadReal = totalVentaReal - totalCostoReal;
    const pctPagado = totalCotizado > 0 ? (totalPagado / totalCotizado) * 100 : 0;

    return {
      count,
      totalCotizado,
      totalVentaReal,
      totalCostoReal,
      utilidadReal,
      totalPagado,
      pctPagado,
    };
  }, [cotizaciones]);

  const cards = [
    {
      title: "Cotizaciones totales",
      subtitle: "(mostradas)",
      value: totals.count,
      iconBg: "bg-blue-50",
      iconText: "text-blue-600",
      icon: "📋",
    },
    {
      title: "Venta Cotizada",
      subtitle: "Total emitido",
      value: shortCLP(totals.totalCotizado),
      iconBg: "bg-slate-50",
      iconText: "text-slate-600",
      icon: "💵",
    },
    {
      title: "Total Pagado",
      subtitle: `${totals.pctPagado.toFixed(1)}% del coti.`,
      value: shortCLP(totals.totalPagado),
      valueClass: "text-indigo-600",
      iconBg: "bg-indigo-50",
      iconText: "text-indigo-600",
      icon: "💰",
    },
    {
      title: "Costo Real",
      subtitle: "De ventas vinculadas",
      value: shortCLP(totals.totalCostoReal),
      iconBg: "bg-amber-50",
      iconText: "text-amber-600",
      icon: "💼",
    },
    {
      title: "Venta Real",
      subtitle: "De ventas vinculadas",
      value: shortCLP(totals.totalVentaReal),
      valueClass: "text-green-600",
      iconBg: "bg-green-50",
      iconText: "text-green-600",
      icon: "💵",
    },
    {
      title: "Utilidad Real",
      subtitle: "Venta Real - Costo Real",
      value: shortCLP(totals.utilidadReal),
      valueClass: "text-purple-600",
      iconBg: "bg-purple-50",
      iconText: "text-purple-600",
      icon: "📈",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
      {cards.map((c) => (
        <div
          key={c.title}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between"
        >
          <div className="flex items-start justify-between mb-2">
            <div className={`p-2 rounded-lg ${c.iconBg} ${c.iconText}`}>
              <span className="text-[18px]">{c.icon}</span>
            </div>
          </div>

          <div>
            <p className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">
              {c.title}
              {c.subtitle ? (
                <span className="text-[10px] font-medium block opacity-70">
                  {c.subtitle}
                </span>
              ) : null}
            </p>

            <h3 className={`text-xl font-bold mt-1 ${c.valueClass || ""}`}>
              {c.value}
            </h3>
          </div>
        </div>
      ))}
    </div>
  );
}
