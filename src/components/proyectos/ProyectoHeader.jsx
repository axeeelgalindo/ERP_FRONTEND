import { StatPill } from "./ProyectoUI";
import { formatCurrencyCLP } from "@/lib/formatters";

export default function ProyectoHeader({ proyecto }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {proyecto.nombre}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {proyecto.descripcion || "Sin descripción registrada."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <StatPill
            label="Estado"
            value={proyecto.estado || "—"}
            color={
              proyecto.estado === "aprobado"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : proyecto.estado === "activo"
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : "bg-gray-50 text-gray-700 border-gray-200"
            }
          />
          <StatPill
            label="Presupuesto"
            value={formatCurrencyCLP(proyecto.presupuesto)}
          />
          <StatPill
            label="Creado"
            value={
              proyecto.creada_en
                ? new Date(proyecto.creada_en).toLocaleString()
                : "—"
            }
          />
        </div>
      </div>
    </section>
  );
}
