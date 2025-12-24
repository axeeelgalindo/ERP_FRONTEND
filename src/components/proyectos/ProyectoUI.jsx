import { TrendingUp } from "lucide-react";
import { formatCurrencyCLP, formatPercent } from "@/lib/formatters";

export function StatPill({ label, value, color }) {
  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs ${
        color || "bg-slate-50 text-gray-700 border-gray-200"
      }`}
    >
      <span className="text-[11px] uppercase tracking-wide text-gray-400">
        {label}
      </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export function Row({ label, value, strong }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs sm:text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={strong ? "font-semibold text-gray-900" : "text-gray-800"}>
        {value}
      </span>
    </div>
  );
}

export function Bar({ percent }) {
  const p = Math.min(100, Math.max(0, Number(percent) || 0));
  return (
    <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
      <div
        className="h-full rounded-full bg-blue-500 transition-all"
        style={{ width: `${p}%` }}
      />
    </div>
  );
}

export function PercentRow({ label, value }) {
  const v = value ?? 0;
  const positive = v >= 0;

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1 text-xs text-gray-500">
        <TrendingUp
          size={14}
          className={positive ? "text-emerald-500" : "text-red-500 rotate-180"}
        />
        <span>{label}</span>
      </div>
      <div
        className={`text-sm font-semibold ${
          positive ? "text-emerald-600" : "text-red-600"
        }`}
      >
        {formatPercent(v)}
      </div>
    </div>
  );
}

export function AdvancedMetricsCard({ fin, tareas }) {
  const margenBrutoPct = fin.margenBrutoPct ?? 0;
  const utilidadNetaPct = fin.utilidadNetaPct ?? 0;
  const usoPresupuestoPct = fin.usoPresupuestoPct ?? 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
      <h2 className="text-sm font-medium text-gray-900 flex items-center gap-2">
        <TrendingUp size={16} className="text-emerald-600" />
        Indicadores avanzados
      </h2>

      <div className="space-y-3 text-sm">
        <PercentRow label="Margen bruto" value={margenBrutoPct} />
        <PercentRow label="Utilidad neta" value={utilidadNetaPct} />
        <Row
          label="Costo promedio por tarea"
          value={formatCurrencyCLP(tareas.costoPromedioPorTarea)}
        />
        <Row
          label="Venta promedio por tarea"
          value={formatCurrencyCLP(tareas.ventaPromedioPorTarea)}
        />
        <PercentRow label="Uso de presupuesto" value={usoPresupuestoPct} />
      </div>
    </div>
  );
}
