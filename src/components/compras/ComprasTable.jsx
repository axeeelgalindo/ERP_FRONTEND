"use client";

function toCLP(v) {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}

function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("es-CL");
}

function Badge({ tone = "slate", children }) {
  const map = {
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    blue: "bg-blue-50 text-blue-700 ring-blue-200",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
  };
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs ring-1",
        map[tone] || map.slate,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function estadoTone(estado) {
  if (estado === "PAGADA") return "green";
  if (estado === "FACTURADA") return "blue";
  if (estado === "ORDEN_COMPRA") return "amber";
  return "slate";
}

export default function ComprasTable({
  rows,
  loading,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}) {
  return (
    <div className="p-4 md:p-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="text-xs text-slate-500">
          Mostrando <b>{rows?.length ?? 0}</b> en esta página · Total registros:{" "}
          <b>{total ?? 0}</b>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Tamaño página</span>
          <select
            className="h-9 rounded-lg border px-2 text-sm bg-white"
            value={pageSize}
            onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3 overflow-auto rounded-xl border">
        <table className="min-w-[1100px] w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
              <th className="w-[70px]">N°</th>
              <th className="w-[120px]">Estado</th>
              <th className="w-[260px]">Proveedor</th>
              <th className="w-[260px]">Razón social (RCV)</th>
              <th className="w-[120px]">RUT</th>
              <th className="w-[90px]">Tipo doc</th>
              <th className="w-[120px]">Folio</th>
              <th className="w-[120px]">Fecha docto</th>
              <th className="w-[120px]">Recepción</th>
              <th className="w-[220px]">Proyecto</th>
              <th className="w-[140px] text-right">Total</th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {loading && (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-slate-500">
                  Cargando…
                </td>
              </tr>
            )}

            {!loading && (!rows || rows.length === 0) && (
              <tr>
                <td colSpan={11} className="px-3 py-10 text-center text-slate-500">
                  Sin compras
                </td>
              </tr>
            )}

            {!loading &&
              rows?.map((c) => {
                const provName = c?.proveedor?.nombre ?? "-";
                const provRut = c?.rut_proveedor ?? c?.proveedor?.rut ?? "-";
                const razon = c?.razon_social ?? "-";
                const tipoDoc = c?.tipo_doc ?? "-";
                const folio = c?.folio ?? "-";

                return (
                  <tr key={c.id} className="hover:bg-slate-50/60">
                    <td className="px-3 py-3 font-medium text-slate-800">
                      {c.numero ?? "-"}
                    </td>

                    <td className="px-3 py-3">
                      <Badge tone={estadoTone(c.estado)}>{c.estado ?? "-"}</Badge>
                    </td>

                    <td className="px-3 py-3">
                      <div className="font-medium text-slate-900 leading-5">
                        {provName}
                      </div>
                      <div className="text-xs text-slate-500">{c?.proveedor?.rut || "-"}</div>
                    </td>

                    <td className="px-3 py-3">
                      <div className="text-slate-900 leading-5">{razon}</div>
                    </td>

                    <td className="px-3 py-3 text-slate-700">{provRut}</td>
                    <td className="px-3 py-3 text-slate-700">{tipoDoc}</td>
                    <td className="px-3 py-3 text-slate-700">{folio}</td>

                    <td className="px-3 py-3 text-slate-700">{fmtDate(c.fecha_docto)}</td>
                    <td className="px-3 py-3 text-slate-700">{fmtDate(c.fecha_recepcion)}</td>

                    <td className="px-3 py-3 text-slate-700">
                      {c?.proyecto?.nombre ?? "-"}
                    </td>

                    <td className="px-3 py-3 text-right font-semibold text-slate-900">
                      {toCLP(c.total)}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* paginación simple */}
      <div className="mt-3 flex items-center justify-between">
        <div className="text-xs text-slate-500">
          Página <b>{page}</b>
        </div>

        <div className="flex gap-2">
          <button
            className="h-9 rounded-lg border px-3 text-sm hover:bg-slate-50 disabled:opacity-50"
            onClick={() => onPageChange?.(Math.max(1, page - 1))}
            disabled={page <= 1 || loading}
          >
            ← Anterior
          </button>

          <button
            className="h-9 rounded-lg border px-3 text-sm hover:bg-slate-50 disabled:opacity-50"
            onClick={() => onPageChange?.(page + 1)}
            disabled={loading}
            title="Siguiente página"
          >
            Siguiente →
          </button>
        </div>
      </div>
    </div>
  );
}
