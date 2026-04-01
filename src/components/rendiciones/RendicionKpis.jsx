"use client";

import React from "react";

function toCLP(v) {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return "$0";
  return n.toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}

export default function RendicionKpis({ kpis, loading }) {
  const items = [
    {
      label: "Total Rendido (Mes)",
      value: toCLP(kpis?.totalGeneral),
      color: "text-slate-900",
      bg: "bg-white",
      icon: "📊",
    },
    {
      label: "Por Pagar (Saldo)",
      value: toCLP(kpis?.totalSaldoPendiente),
      color: "text-amber-600",
      bg: "bg-amber-50",
      icon: "⏳",
    },
    {
      label: "Pagado (Total)",
      value: toCLP(kpis?.totalMontoPagado),
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      icon: "✅",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      {items.map((it, idx) => (
        <div
          key={idx}
          className={`${it.bg} p-6 rounded-2xl border border-slate-200/60 shadow-sm flex items-center gap-4 transition-all hover:shadow-md`}
        >
          <div className="text-2xl">{it.icon}</div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-none mb-2">
              {it.label}
            </p>
            <p className={`text-2xl font-black ${it.color}`}>
              {loading ? "..." : it.value}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
