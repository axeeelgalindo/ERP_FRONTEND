"use client";

function fmtCLP(n) {
  const v = Number(n || 0);
  return v.toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
}

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
      {sub ? <div className="mt-1 text-xs text-slate-500">{sub}</div> : null}
    </div>
  );
}

export default function ComprasHeader({ totals, loading, onReload, onOpenCreate }) {
  return (
    <div className="rounded-2xl border bg-white shadow-sm">
      <div className="p-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Compras</h1>
          <p className="mt-1 text-sm text-slate-500">
            Importa el CSV RCV del SII y el sistema crea automáticamente proveedores y compras.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="h-9 rounded-lg border px-3 text-sm hover:bg-slate-50 disabled:opacity-60"
              onClick={onReload}
              disabled={loading}
            >
              {loading ? "Cargando…" : "Recargar"}
            </button>

            <button
              className="h-9 rounded-lg bg-slate-900 px-3 text-sm text-white hover:bg-slate-800"
              onClick={onOpenCreate}
              title="Crear compra manual (uso excepcional)"
            >
              + Crear manual
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:w-[560px]">
          <StatCard label="Total registros" value={totals?.totalRows ?? 0} sub={`Página ${totals?.page ?? 1}`} />
          <StatCard label="Total en esta página" value={fmtCLP(totals?.totalCLP)} sub={`Tamaño pág: ${totals?.pageSize ?? 20}`} />
          <StatCard label="Origen recomendado" value="CSV RCV (SII)" sub="Importación masiva" />
        </div>
      </div>
    </div>
  );
}
