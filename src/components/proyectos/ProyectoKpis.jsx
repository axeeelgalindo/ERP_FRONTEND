// src/components/proyectos/ProyectoKpis.jsx
"use client";

import { ClipboardList, CircleDollarSign, User2 } from "lucide-react";
import { AdvancedMetricsCard, Row, Bar } from "./ProyectoUI";
import { formatCurrencyCLP, formatPercent } from "@/lib/formatters";

export default function ProyectoKpis({ fin, tareas, clientePrincipal }) {
  return (
    <section className="grid gap-4 lg:grid-cols-4">
      {/* 1: Resumen financiero */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-medium text-gray-900 flex items-center gap-2">
          <CircleDollarSign size={16} className="text-blue-600" />
          Resumen financiero
        </h2>

        <div className="space-y-2 text-sm">
          <Row label="Total ventas" value={formatCurrencyCLP(fin.totalVentas)} />
          <Row
            label="Total compras"
            value={formatCurrencyCLP(fin.totalCompras)}
          />
          <Row
            label="Rendiciones"
            value={formatCurrencyCLP(fin.totalRendiciones)}
          />
          <Row label="Costo total" value={formatCurrencyCLP(fin.costoTotal)} />

          {/* 👇 NUEVO: HH del proyecto, calculadas desde subtareas */}
          <Row
            label="Valor HH plan"
            value={formatCurrencyCLP(fin.valorHHPlan ?? 0)}
          />
          <Row
            label="Valor HH real"
            value={formatCurrencyCLP(fin.valorHHReal ?? 0)}
          />
        </div>

        <div className="mt-3 border-t pt-3 space-y-2">
          <Row
            label="Margen bruto"
            value={formatCurrencyCLP(fin.margenBruto)}
            strong
          />
          <Row
            label="Utilidad neta"
            value={formatCurrencyCLP(fin.utilidadNeta)}
            strong
          />
        </div>
      </div>

      {/* 2: Estado de tareas */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-medium text-gray-900 flex items-center gap-2">
          <ClipboardList size={16} className="text-indigo-600" />
          Estado de tareas
        </h2>

        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg bg-slate-50 p-2">
            <div className="text-[11px] text-gray-500">Total</div>
            <div className="text-base font-semibold text-gray-800">
              {tareas.totalTareas ?? 0}
            </div>
          </div>
          <div className="rounded-lg bg-emerald-50 p-2">
            <div className="text-[11px] text-emerald-600">Completas</div>
            <div className="text-base font-semibold text-emerald-700">
              {tareas.tareasCompletas ?? 0}
            </div>
          </div>
          <div className="rounded-lg bg-amber-50 p-2">
            <div className="text-[11px] text-amber-600">En curso</div>
            <div className="text-base font-semibold text-amber-700">
              {tareas.tareasEnCurso ?? 0}
            </div>
          </div>
        </div>

        <div className="space-y-2 text-sm mt-2">
          <Row label="Pendientes" value={tareas.tareasPendientes ?? 0} />
          <Row
            label="Avance promedio"
            value={formatPercent((tareas.avancePromedio ?? 0) * 1)}
          />
          <Row
            label="Proyecto completado"
            value={formatPercent((tareas.porcentajeCompletado ?? 0) * 1)}
          />
        </div>
      </div>

      {/* 3: Cliente + presupuesto */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-medium text-gray-900 flex items-center gap-2">
          <User2 size={16} className="text-purple-600" />
          Cliente y presupuesto
        </h2>

        <div className="space-y-3 text-sm">
          <div>
            <div className="text-xs text-gray-500 mb-1">Cliente principal</div>
            {clientePrincipal ? (
              <div className="rounded-lg border border-gray-200 bg-slate-50 px-3 py-2">
                <div className="font-medium text-gray-800">
                  {clientePrincipal.nombre}
                </div>
                <div className="text-xs text-gray-500">
                  {clientePrincipal.correo || "Sin correo"} ·{" "}
                  {clientePrincipal.telefono || "Sin teléfono"}
                </div>
              </div>
            ) : (
              <div className="text-xs text-gray-500">
                Sin ventas asociadas aún.
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Row
              label="Presupuesto asignado"
              value={formatCurrencyCLP(fin.presupuesto)}
            />
            <Row
              label="Presupuesto usado"
              value={formatCurrencyCLP(fin.presupuestoUsado)}
            />
            <Row
              label="Saldo de presupuesto"
              value={formatCurrencyCLP(fin.presupuestoRestante)}
            />
          </div>

          <div className="mt-2">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Uso de presupuesto</span>
              <span>{formatPercent(fin.usoPresupuestoPct ?? 0)}</span>
            </div>
            <Bar
              percent={Math.min(
                100,
                Math.max(0, fin.usoPresupuestoPct ?? 0)
              )}
            />
          </div>
        </div>
      </div>

      {/* 4: Indicadores avanzados */}
      <AdvancedMetricsCard fin={fin} tareas={tareas} />
    </section>
  );
}
