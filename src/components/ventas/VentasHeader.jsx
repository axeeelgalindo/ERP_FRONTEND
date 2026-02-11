"use client";

export default function VentasHeader({
  loadingVentas,
  onRefresh,
  onOpenNewVenta,
  onOpenCotizacion, // lo dejamos disponible, aunque la plantilla no lo muestra
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          Costeos
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Gestión avanzada de costos, ítems y generación de cotizaciones.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onRefresh}
          disabled={loadingVentas}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-60"
        >
          <span className="text-[18px]">⟳</span>
          {loadingVentas ? "Actualizando..." : "Actualizar"}
        </button>

        <button
          onClick={onOpenNewVenta}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 shadow-lg shadow-blue-600/20 hover:scale-[1.02] active:scale-95 transition"
        >
          <span className="text-[18px]">＋</span> Nuevo costeo
        </button>
      </div>
    </div>
  );
}
