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

export default function CotizacionesSummary({ cotizaciones, filterEstado }) {
  const totals = useMemo(() => {
    const list = cotizaciones || [];
    let count = list.length || 0;
    
    let ventaCotizadaOnly = 0;
    let utilidadRealFiltered = 0;
    let pagadoRealOnly = 0;
    
    let totalVentaRealAll = 0;
    let totalCostoRealAll = 0;
    let totalPagadoAll = 0;
    let totalCotizadoAll = 0;

    const UTIL_STATES = ["ACEPTADA", "ORDEN_VENTA", "POR_FACTURAR", "FACTURADA"];

    for (const c of list) {
      const cTotal = Number(c.total || 0);
      totalCotizadoAll += cTotal;

      // 1. Venta Cotizada: Solo las en estado COTIZACION
      if (c.estado === "COTIZACION") {
        ventaCotizadaOnly += cTotal;
      }

      // 3. Pagado Real: Solo las en estado PAGADA
      if (c.estado === "PAGADA") {
        pagadoRealOnly += cTotal;
      }

      // Cálculo de pagos (Total Pagado KPI)
      const pagado = c.total_pagado ?? (c.pagos?.reduce((a,p) => a + Number(p.monto||0), 0) || 0);
      totalPagadoAll += pagado;

      // Cálculo de Ventas/Costos Reales (para Utilidad Real y otros cards)
      const ventas = c.ventas || [];
      let cVentaReal = 0;
      let cCostoReal = 0;

      if (c.estado !== "COTIZACION" && c.estado !== "RECHAZADA") {
        for (const v of ventas) {
          const vVenta = (v.detalles || []).reduce(
            (acc, d) => acc + (Number(d.ventaTotal ?? d.total) || 0),
            0
          );
          const vCosto = (v.detalles || []).reduce(
            (acc, d) => acc + (Number(d.costoTotal) || 0),
            0
          );
          cVentaReal += vVenta;
          cCostoReal += vCosto;
        }
      }

      totalVentaRealAll += cVentaReal;
      totalCostoRealAll += cCostoReal;

      // 2. Utilidad Real (según usuario): Suma de totales en estados "reales"
      if (UTIL_STATES.includes(c.estado)) {
        utilidadRealFiltered += cTotal;
      }
    }

    const pctPagado = totalCotizadoAll > 0 ? (totalPagadoAll / totalCotizadoAll) * 100 : 0;

    return {
      count,
      ventaCotizadaOnly,
      utilidadRealFiltered,
      pagadoRealOnly,
      totalVentaRealAll,
      totalCostoRealAll,
      totalPagadoAll,
      pctPagado,
    };
  }, [cotizaciones]);

  const cards = [
    {
      title: "Venta Cotizada",
      subtitle: "Solo est. COTIZACION",
      value: shortCLP(totals.ventaCotizadaOnly),
      iconBg: "bg-slate-50",
      iconText: "text-slate-600",
      icon: "💵",
    },
    {
      title: "Utilidad Real",
      subtitle: "Suma Totales Acep./Fact.",
      value: shortCLP(totals.utilidadRealFiltered),
      valueClass: "text-purple-600",
      iconBg: "bg-purple-50",
      iconText: "text-purple-600",
      icon: "📈",
    },
    {
      title: "PAGADO REAL",
      subtitle: "Total en est. PAGADA",
      value: shortCLP(totals.pagadoRealOnly),
      valueClass: "text-emerald-600",
      iconBg: "bg-emerald-50",
      iconText: "text-emerald-600",
      icon: "✅",
    },
    {
      title: "Total Pagado",
      subtitle: `${totals.pctPagado.toFixed(1)}% de abonos`,
      value: shortCLP(totals.totalPagadoAll),
      valueClass: "text-indigo-600",
      iconBg: "bg-indigo-50",
      iconText: "text-indigo-600",
      icon: "💰",
    },
    {
      title: "Venta Real",
      subtitle: "De ventas vinculadas",
      value: shortCLP(totals.totalVentaRealAll),
      valueClass: "text-green-600",
      iconBg: "bg-green-50",
      iconText: "text-green-600",
      icon: "💵",
    },
    {
      title: "Costo Real",
      subtitle: "De ventas vinculadas",
      value: shortCLP(totals.totalCostoRealAll),
      iconBg: "bg-amber-50",
      iconText: "text-amber-600",
      icon: "💼",
    },
    {
      title: "Cotizaciones totales",
      subtitle: "(mostradas)",
      value: totals.count,
      iconBg: "bg-blue-50",
      iconText: "text-blue-600",
      icon: "📋",
    },
  ];

  // Logic: prioritize "Utilidad Real" if filtered by something else than COTIZACION
  const sortedCards = useMemo(() => {
    if (filterEstado && filterEstado !== "COTIZACION") {
      const utilIndex = cards.findIndex(c => c.title === "Utilidad Real");
      if (utilIndex > -1) {
        const [utilCard] = cards.splice(utilIndex, 1);
        return [utilCard, ...cards];
      }
    }
    return cards;
  }, [cards, filterEstado]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4 mb-8">
      {sortedCards.map((c) => (
        <div
          key={c.title}
          className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${c.iconBg} ${c.iconText}`}>
              <span className="text-[20px]">{c.icon}</span>
            </div>
            <p className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider leading-tight">
              {c.title}
              {c.subtitle ? (
                <span className="text-[9px] font-medium block opacity-70 mt-0.5 normal-case tracking-normal">
                  {c.subtitle}
                </span>
              ) : null}
            </p>
          </div>

          <div>
            <h3 className={`text-2xl font-black tracking-tight ${c.valueClass || ""}`}>
              {c.value}
            </h3>
          </div>
        </div>
      ))}
    </div>
  );
}
