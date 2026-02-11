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

  // millones
  if (abs >= 1_000_000) {
    const m = n / 1_000_000;
    // 56M / 5.5M
    const s =
      Math.abs(m) >= 10 ? `${Math.round(m)}M` : `${m.toFixed(1)}M`;
    return `$${s}`;
  }

  if (abs >= 1_000) {
    const k = n / 1_000;
    const s = Math.abs(k) >= 10 ? `${Math.round(k)}K` : `${k.toFixed(1)}K`;
    return `$${s}`;
  }

  return clp(n).replace("CLP", "").trim();
}

function calcTotalVenta(venta) {
  const detalles = venta?.detalles || [];
  return detalles.reduce((s, d) => s + (Number(d.total ?? d.ventaTotal) || 0), 0);
}

function calcTotalCosto(venta) {
  const detalles = venta?.detalles || [];
  return detalles.reduce((s, d) => s + (Number(d.costoTotal) || 0), 0);
}

export default function VentasSummary({ ventas }) {
  const totals = useMemo(() => {
    const list = ventas || [];
    let totalVenta = 0;
    let totalCosto = 0;

    for (const v of list) {
      totalVenta += calcTotalVenta(v);
      totalCosto += calcTotalCosto(v);
    }

    const utilidad = totalVenta - totalCosto;

    const count = list.length || 0;
    const ventaProm = count ? totalVenta / count : 0;
    const costoProm = count ? totalCosto / count : 0;

    return {
      count,
      totalCosto,
      totalVenta,
      utilidad,
      ventaProm,
      costoProm,
    };
  }, [ventas]);

  // KPI “sin endpoint aún” (placeholder)
  const kpiPendiente = 66;

  const cards = [
    {
      title: "Costeos totales",
      subtitle: "(mes actual)",
      value: totals.count,
      iconBg: "bg-blue-50 dark:bg-blue-900/20",
      iconText: "text-blue-600 dark:text-blue-400",
      icon: "📊",
    },
    {
      title: "Costo total",
      subtitle: "Monto total costeado",
      value: shortCLP(totals.totalCosto),
      iconBg: "bg-slate-50 dark:bg-slate-800",
      iconText: "text-slate-600 dark:text-slate-400",
      icon: "💼",
    },
    {
      title: "Venta total",
      subtitle: "",
      value: shortCLP(totals.totalVenta),
      valueClass: "text-green-600 dark:text-green-400",
      iconBg: "bg-green-50 dark:bg-green-900/20",
      iconText: "text-green-600 dark:text-green-400",
      icon: "💵",
    },
    {
      title: "Utilidad proyectada",
      subtitle: "",
      value: shortCLP(totals.utilidad),
      valueClass: "text-purple-600 dark:text-purple-400",
      iconBg: "bg-purple-50 dark:bg-purple-900/20",
      iconText: "text-purple-600 dark:text-purple-400",
      icon: "📈",
    },
    {
      title: "Venta promedio",
      subtitle: "",
      value: shortCLP(totals.ventaProm),
      iconBg: "bg-amber-50 dark:bg-amber-900/20",
      iconText: "text-amber-600 dark:text-amber-400",
      icon: "📉",
    },
    {
      title: "KPI pendiente",
      subtitle: "reemplazar por endpoint",
      value: kpiPendiente,
      iconBg: "bg-rose-50 dark:bg-rose-900/20",
      iconText: "text-rose-600 dark:text-rose-400",
      icon: "🧾",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
      {cards.map((c) => (
        <div
          key={c.title}
          className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between"
        >
          <div className="flex items-start justify-between mb-2">
            <div className={`p-2 rounded-lg ${c.iconBg} ${c.iconText}`}>
              <span className="text-[18px]">{c.icon}</span>
            </div>
          </div>

          <div>
            <p className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">
              {c.title}{" "}
              {c.subtitle ? (
                <span className="text-[10px] font-medium block opacity-70">
                  {c.subtitle}
                </span>
              ) : null}
              {c.subtitle && c.subtitle.includes("reemplazar") ? null : null}
            </p>

            {!c.subtitle || c.subtitle === "" ? null : null}

            {c.subtitle === "reemplazar por endpoint" ? (
              <p className="text-[10px] font-medium text-slate-400 opacity-70">
                {c.subtitle}
              </p>
            ) : null}

            <h3 className={`text-xl font-bold mt-1 ${c.valueClass || ""}`}>
              {c.value}
            </h3>
          </div>
        </div>
      ))}
    </div>
  );
}
