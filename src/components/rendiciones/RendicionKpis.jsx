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
      label: "Total Rendido",
      value: toCLP(kpis?.totalGeneral),
      icon: "account_balance_wallet",
      progress: 75,
      trending: "12%",
      color: "primary"
    },
    {
      label: "Por Pagar",
      value: toCLP(kpis?.totalSaldoPendiente),
      icon: "warning",
      subtext: "14 rendiciones pendientes de revisión",
      borderColor: "border-error/20",
      textColor: "text-error"
    },
    {
      label: "Pagado",
      value: toCLP(kpis?.totalMontoPagado),
      icon: "check_circle",
      subtext: "88% del presupuesto anual ejecutado",
      borderColor: "border-secondary/20",
      textColor: "text-secondary"
    },
  ];

  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
      {items.map((it, idx) => (
        <div
          key={idx}
          className={`bg-surface-container-lowest p-7 rounded-xl flex flex-col gap-2 relative overflow-hidden group border-l-4 ${it.borderColor || "border-transparent"}`}
        >
          {it.icon === "account_balance_wallet" && (
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <span className="material-symbols-outlined text-5xl">
                {it.icon}
              </span>
            </div>
          )}
          
          <span className="text-on-surface-variant text-[11px] font-bold tracking-[0.05em] uppercase">
            {it.label}
          </span>
          
          <div className="flex items-baseline gap-2">
            <h2 className="text-3xl font-extrabold tracking-tighter text-on-surface">
              {loading ? "..." : it.value}
            </h2>
            {it.trending && (
              <span className="text-secondary text-xs font-semibold flex items-center">
                <span className="material-symbols-outlined text-xs mr-0.5">trending_up</span>
                {it.trending}
              </span>
            )}
            {it.icon === "warning" && (
                <span className="text-error text-xs font-semibold flex items-center">
                    <span className="material-symbols-outlined text-xs mr-0.5">warning</span>
                </span>
            )}
          </div>

          {it.progress !== undefined ? (
            <div className="w-full bg-surface-container h-1 rounded-full mt-2">
              <div className="bg-primary h-1 rounded-full" style={{ width: `${it.progress}%` }}></div>
            </div>
          ) : (
            <p className="text-on-surface-variant text-xs mt-2">{it.subtext}</p>
          )}
        </div>
      ))}
    </section>
  );
}
