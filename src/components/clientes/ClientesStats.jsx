// src/components/clientes/ClientesStats.jsx
"use client";

import { cx } from "./utils";

import {
  Group,
  Checklist,
  RequestQuote,
  RocketLaunch,
} from "@mui/icons-material";

function StatCard({ Icon, label, value, tone }) {
  const tones = {
    blue: "bg-blue-50 dark:bg-blue-900/20 text-blue-600",
    emerald: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600",
    amber: "bg-amber-50 dark:bg-amber-900/20 text-amber-600",
    purple: "bg-purple-50 dark:bg-purple-900/20 text-purple-600",
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-4">
        <div className={cx("p-3 rounded-lg", tones[tone] || tones.blue)}>
          <Icon fontSize="small" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * stats: { totalClientes, activos, cotPend, proyectos }
 * Puedes alimentar “activos/cotizaciones/proyectos” desde tu backend cuando los tengas,
 * por ahora deja números reales si ya existen.
 */
export default function ClientesStats({ stats }) {
  const s = stats || {};
  return (
    <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-1 gap-6">
      <StatCard
        Icon={Group}
        label="Total Clientes"
        value={s.totalClientes ?? 0}
        tone="blue"
      />
{/*
      <StatCard
        Icon={Checklist}
        label="Activos"
        value={s.activos ?? 0}
        tone="emerald"
      /> */}
    </div>
  );
}
