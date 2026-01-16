import { TrendingUp } from "lucide-react";
import { formatCurrencyCLP } from "@/lib/formatters";

export default function ProyectoVentasSection({ ventas }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-medium text-gray-900 flex items-center gap-2">
        <TrendingUp size={16} className="text-green-600" />
        Ventas asociadas
      </h2>

      {ventas.length === 0 ? (
        <p className="mt-3 text-xs text-gray-500">
          Este proyecto aún no tiene ventas registradas.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-gray-100 text-sm">
          {ventas.map((v) => (
            <li
              key={v.id}
              className="py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"
            >
              <div className="flex flex-col">
                <span className="font-medium text-gray-800">
                  {v.numero || v.id}
                </span>
                <span className="text-xs text-gray-500">
                  Cliente: {v.cliente?.nombre || "—"}
                </span>
              </div>
              <div className="text-sm font-semibold text-gray-900">
                {formatCurrencyCLP(v.total)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
