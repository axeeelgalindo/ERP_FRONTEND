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
    
    let countCotizaciones = 0;
    let countConOC = 0;
    let sumTotalConOC = 0;
    let sumFacturado = 0;
    let sumPagado = 0;

    for (const c of list) {
      if (c.eliminado) continue;
      if (c.es_suscripcion) continue; // standard quotes only

      countCotizaciones++;

      const cTotal = Number(c.total || 0);
      // COT con OC: cualquier estado diferente de COTIZACION y RECHAZADA (aceptadas/orden de venta/etc.)
      const hasOC = c.estado !== "COTIZACION" && c.estado !== "RECHAZADA";

      if (hasOC) {
        countConOC++;
        sumTotalConOC += cTotal;

        const totalVentas = (c.ventas || []).reduce((sum, v) => {
          const detallesTotal = (v.detalles || []).reduce((acc, d) => acc + (Number(d.ventaTotal ?? d.total) || 0), 0);
          return sum + (v.total || detallesTotal || 0);
        }, 0);
        sumFacturado += totalVentas;

        const totalPagado = c.total_pagado ?? (c.pagos?.reduce((a, p) => a + Number(p.monto || 0), 0) || 0);
        sumPagado += totalPagado;
      }
    }

    const conversionRate = countCotizaciones > 0 ? (countConOC / countCotizaciones) * 100 : 0;
    const facturadasRate = sumTotalConOC > 0 ? (sumFacturado / sumTotalConOC) * 100 : 0;
    const pagadasRate = sumFacturado > 0 ? (sumPagado / sumFacturado) * 100 : 0;

    return {
      conversionRate,
      ventaTotalOC: sumTotalConOC,
      facturadasRate,
      facturadoTotal: sumFacturado,
      pagadasRate,
      pagadoTotal: sumPagado,
    };
  }, [cotizaciones]);

  const cards = [
    {
      title: "CONVERSIÓN",
      subtitle: "% de COT a venta",
      value: `${totals.conversionRate.toFixed(1).replace(".", ",")}%`,
      valueClass: "text-blue-600",
      iconBg: "bg-blue-50",
      iconText: "text-blue-600",
      icon: "📈",
    },
    {
      title: "VENTA",
      subtitle: "COT con OC",
      value: shortCLP(totals.ventaTotalOC),
      valueClass: "text-green-600",
      iconBg: "bg-green-50",
      iconText: "text-green-600",
      icon: "🛒",
    },
    {
      title: "FACTURADAS",
      subtitle: "% de OC facturadas",
      value: `${totals.facturadasRate.toFixed(1).replace(".", ",")}%`,
      valueClass: "text-purple-600",
      iconBg: "bg-purple-50",
      iconText: "text-purple-600",
      icon: "📋",
    },
    {
      title: "FACTURADO",
      subtitle: "OC facturadas",
      value: shortCLP(totals.facturadoTotal),
      valueClass: "text-purple-600",
      iconBg: "bg-purple-50",
      iconText: "text-purple-600",
      icon: "💵",
    },
    {
      title: "PAGADAS",
      subtitle: "% de facturas pagadas",
      value: `${totals.pagadasRate.toFixed(1).replace(".", ",")}%`,
      valueClass: "text-amber-600",
      iconBg: "bg-amber-50",
      iconText: "text-amber-600",
      icon: "💳",
    },
    {
      title: "PAGADO",
      subtitle: "Facturas pagadas",
      value: shortCLP(totals.pagadoTotal),
      valueClass: "text-green-600",
      iconBg: "bg-green-50",
      iconText: "text-green-600",
      icon: "✅",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
      {cards.map((c) => (
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
