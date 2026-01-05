"use client";

export default function StatsCards({ totalRegistros, totalLabel, page, pageSize }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full md:w-auto">
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="text-xs text-slate-500">Total registros</div>
        <div className="mt-1 text-xl font-semibold text-slate-900">{totalRegistros ?? 0}</div>
        <div className="mt-1 text-xs text-slate-500">Página {page ?? 1}</div>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="text-xs text-slate-500">Total en esta página</div>
        <div className="mt-1 text-xl font-semibold text-slate-900">{totalLabel}</div>
        <div className="mt-1 text-xs text-slate-500">Tamaño pág: {pageSize ?? 20}</div>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="text-xs text-slate-500">Origen recomendado</div>
        <div className="mt-1 text-sm font-semibold text-slate-900">CSV RCV (SII)</div>
        <div className="mt-1 text-xs text-slate-500">Importación masiva</div>
      </div>
    </div>
  );
}
