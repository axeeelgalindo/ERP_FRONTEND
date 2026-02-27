"use client";

import { useMemo } from "react";
import { ClipboardList, CircleDollarSign, User2, Layers3 } from "lucide-react";
import { AdvancedMetricsCard, Row, Bar } from "./ProyectoUI";
import { formatCurrencyCLP, formatPercent } from "@/lib/formatters";

/**
 * Normalizadores seguros
 */
function n0(v) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}
function clampPct(v) {
  const n = n0(v);
  return Math.max(0, Math.min(100, n));
}
function estadoOf(x) {
  return String(x?.estado || "pendiente").toLowerCase();
}
function isDone(x) {
  const s = estadoOf(x);
  const a = clampPct(x?.avance);
  return s === "completada" || a >= 100;
}
function isInProgress(x) {
  const s = estadoOf(x);
  const a = clampPct(x?.avance);
  return s === "en_progreso" || (a > 0 && a < 100);
}

function getDetalles(t) {
  const arr = t?.detalles || t?.detalle || t?.tareasDetalle || [];
  return Array.isArray(arr) ? arr : [];
}
function getEpicId(t) {
  return t?.epica_id || t?.epicaId || t?.epica?.id || "SIN_EPICA";
}
function getEpicName(t) {
  return (
    t?.epica?.nombre ||
    t?.epica?.name ||
    (getEpicId(t) === "SIN_EPICA" ? "Sin agrupar" : "Épica")
  );
}

/**
 * Calcula KPIs desde el array real de tareas (con detalles/subtareas).
 * - avance de tarea = promedio subtareas si existen; si no, usa tarea.avance
 * - avance de épica = promedio de tareas (ya con subtareas)
 */
function computeKpisFromItems(items = []) {
  const tareasArr = Array.isArray(items) ? items : [];

  // --- subtareas stats
  let totalSubtareas = 0;
  let subtDone = 0;
  let subtProgress = 0;
  let subtPending = 0;

  // --- tareas stats
  let totalTareas = 0;
  let tareasDone = 0;
  let tareasProgress = 0;
  let tareasPending = 0;

  // --- épicas
  const epMap = new Map(); // epicId -> { id, nombre, tareas: [] }

  for (const t of tareasArr) {
    if (!t?.id) continue;

    const epicId = getEpicId(t);
    const epicName = getEpicName(t);

    if (!epMap.has(epicId)) epMap.set(epicId, { id: epicId, nombre: epicName, tareas: [] });

    const detalles = getDetalles(t);
    totalTareas += 1;

    // subtareas: acumular
    if (detalles.length) {
      totalSubtareas += detalles.length;

      for (const d of detalles) {
        if (isDone(d)) subtDone += 1;
        else if (isInProgress(d)) subtProgress += 1;
        else subtPending += 1;
      }
    }

    // avance tarea (con subtareas)
    let avanceTarea = clampPct(t?.avance);
    if (detalles.length) {
      const avg = detalles.reduce((s, d) => s + clampPct(d?.avance), 0) / detalles.length;
      avanceTarea = clampPct(avg);
    }

    const tareaComputed = {
      ...t,
      __avanceComputed: avanceTarea,
    };

    epMap.get(epicId).tareas.push(tareaComputed);

    // estado tarea (para KPI)
    // si tiene subtareas, el estado "real" lo derivamos del avance computed
    const done = avanceTarea >= 100 || estadoOf(t) === "completada";
    const prog = !done && (avanceTarea > 0 || estadoOf(t) === "en_progreso");

    if (done) tareasDone += 1;
    else if (prog) tareasProgress += 1;
    else tareasPending += 1;
  }

  // épicas: calcular avance y estado
  let totalEpicas = 0;
  let epDone = 0;
  let epProgress = 0;
  let epPending = 0;

  for (const e of epMap.values()) {
    // si quieres excluir SIN_EPICA del conteo de épicas reales:
    // const countEpic = e.id !== "SIN_EPICA";
    const countEpic = true;

    if (!countEpic) continue;

    totalEpicas += 1;

    const tareasE = e.tareas || [];
    const epicAvance =
      tareasE.length > 0
        ? clampPct(tareasE.reduce((s, x) => s + clampPct(x.__avanceComputed), 0) / tareasE.length)
        : 0;

    const done = epicAvance >= 100;
    const prog = !done && epicAvance > 0;

    if (done) epDone += 1;
    else if (prog) epProgress += 1;
    else epPending += 1;
  }

  // promedios / completado
  const avancePromedioTareas =
    totalTareas > 0
      ? clampPct(
          Array.from(epMap.values())
            .flatMap((e) => e.tareas)
            .reduce((s, t) => s + clampPct(t.__avanceComputed), 0) / totalTareas
        )
      : 0;

  const porcentajeCompletadoTareas =
    totalTareas > 0 ? clampPct((tareasDone / totalTareas) * 100) : 0;

  const avancePromedioEpicas =
    totalEpicas > 0
      ? clampPct(
          Array.from(epMap.values()).reduce((s, e) => {
            const tareasE = e.tareas || [];
            const epicAv =
              tareasE.length > 0
                ? tareasE.reduce((ss, t) => ss + clampPct(t.__avanceComputed), 0) /
                  tareasE.length
                : 0;
            return s + clampPct(epicAv);
          }, 0) / totalEpicas
        )
      : 0;

  return {
    epicas: {
      totalEpicas,
      epicasCompletas: epDone,
      epicasEnCurso: epProgress,
      epicasPendientes: epPending,
      avancePromedio: avancePromedioEpicas, // 0-100
    },
    tareas: {
      totalTareas,
      tareasCompletas: tareasDone,
      tareasEnCurso: tareasProgress,
      tareasPendientes: tareasPending,
      avancePromedio: avancePromedioTareas, // 0-100
      porcentajeCompletado: porcentajeCompletadoTareas, // 0-100
    },
    subtareas: {
      totalSubtareas,
      subtareasCompletas: subtDone,
      subtareasEnCurso: subtProgress,
      subtareasPendientes: subtPending,
      porcentajeCompletado:
        totalSubtareas > 0 ? clampPct((subtDone / totalSubtareas) * 100) : 0, // 0-100
    },
  };
}

export default function ProyectoKpis({ fin, tareas, clientePrincipal, items = [] }) {
  // ✅ defaults para que NUNCA reviente
  const finSafe = fin || {};
  const tareasSafe = tareas || {};

  // ✅ KPIs reales desde items (tareas + subtareas + épicas)
  const computed = useMemo(() => computeKpisFromItems(items), [items]);

  // ✅ si el backend ya te manda "tareas", lo respetamos pero completamos con computed
  // (si no viene, usamos computed)
  const tareasFinal = {
    totalTareas: tareasSafe.totalTareas ?? computed.tareas.totalTareas,
    tareasCompletas: tareasSafe.tareasCompletas ?? computed.tareas.tareasCompletas,
    tareasEnCurso: tareasSafe.tareasEnCurso ?? computed.tareas.tareasEnCurso,
    tareasPendientes: tareasSafe.tareasPendientes ?? computed.tareas.tareasPendientes,
    avancePromedio: tareasSafe.avancePromedio ?? computed.tareas.avancePromedio,
    porcentajeCompletado:
      tareasSafe.porcentajeCompletado ?? computed.tareas.porcentajeCompletado,
  };

  // Ojo: formatPercent -> asumimos que quiere 0..100
  const pct = (v) => formatPercent(clampPct(v));

  return (
    <section className="grid gap-4 lg:grid-cols-4">
      {/* 1: Resumen financiero */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-medium text-gray-900 flex items-center gap-2">
          <CircleDollarSign size={16} className="text-blue-600" />
          Resumen financiero
        </h2>

        <div className="space-y-2 text-sm">
          <Row label="Total ventas" value={formatCurrencyCLP(n0(finSafe.totalVentas))} />
          <Row label="Total compras" value={formatCurrencyCLP(n0(finSafe.totalCompras))} />
          <Row label="Rendiciones" value={formatCurrencyCLP(n0(finSafe.totalRendiciones))} />
          <Row label="Costo total" value={formatCurrencyCLP(n0(finSafe.costoTotal))} />

          {/* HH desde subtareas (si tu backend lo manda en fin, lo mostramos) */}
          <Row label="Valor HH plan" value={formatCurrencyCLP(n0(finSafe.valorHHPlan))} />
          <Row label="Valor HH real" value={formatCurrencyCLP(n0(finSafe.valorHHReal))} />
        </div>

        <div className="mt-3 border-t pt-3 space-y-2">
          <Row label="Margen bruto" value={formatCurrencyCLP(n0(finSafe.margenBruto))} strong />
          <Row label="Utilidad neta" value={formatCurrencyCLP(n0(finSafe.utilidadNeta))} strong />
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
              {tareasFinal.totalTareas ?? 0}
            </div>
          </div>
          <div className="rounded-lg bg-emerald-50 p-2">
            <div className="text-[11px] text-emerald-600">Completas</div>
            <div className="text-base font-semibold text-emerald-700">
              {tareasFinal.tareasCompletas ?? 0}
            </div>
          </div>
          <div className="rounded-lg bg-amber-50 p-2">
            <div className="text-[11px] text-amber-600">En curso</div>
            <div className="text-base font-semibold text-amber-700">
              {tareasFinal.tareasEnCurso ?? 0}
            </div>
          </div>
        </div>

        <div className="space-y-2 text-sm mt-2">
          <Row label="Pendientes" value={tareasFinal.tareasPendientes ?? 0} />
          <Row label="Avance promedio" value={pct(tareasFinal.avancePromedio ?? 0)} />
          <Row label="Proyecto completado" value={pct(tareasFinal.porcentajeCompletado ?? 0)} />
        </div>

        {/* Subtareas */}
        <div className="mt-4 border-t pt-3 space-y-2">
          <Row label="Subtareas (total)" value={computed.subtareas.totalSubtareas ?? 0} />
          <Row label="Subtareas completadas" value={computed.subtareas.subtareasCompletas ?? 0} />
          <Row label="Subtareas completado %" value={pct(computed.subtareas.porcentajeCompletado ?? 0)} />
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
                <div className="font-medium text-gray-800">{clientePrincipal.nombre}</div>
                <div className="text-xs text-gray-500">
                  {clientePrincipal.correo || "Sin correo"} ·{" "}
                  {clientePrincipal.telefono || "Sin teléfono"}
                </div>
              </div>
            ) : (
              <div className="text-xs text-gray-500">Sin ventas asociadas aún.</div>
            )}
          </div>

          <div className="space-y-2">
            <Row label="Presupuesto asignado" value={formatCurrencyCLP(n0(finSafe.presupuesto))} />
            <Row label="Presupuesto usado" value={formatCurrencyCLP(n0(finSafe.presupuestoUsado))} />
            <Row label="Saldo de presupuesto" value={formatCurrencyCLP(n0(finSafe.presupuestoRestante))} />
          </div>

          <div className="mt-2">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Uso de presupuesto</span>
              <span>{pct(finSafe.usoPresupuestoPct ?? 0)}</span>
            </div>
            <Bar percent={clampPct(finSafe.usoPresupuestoPct ?? 0)} />
          </div>

          {/* Épicas */}
          <div className="mt-4 border-t pt-3 space-y-2">
            <div className="text-xs font-semibold text-gray-700 flex items-center gap-2">
              <Layers3 size={14} className="text-slate-500" />
              Épicas
            </div>
            <Row label="Total épicas" value={computed.epicas.totalEpicas ?? 0} />
            <Row label="Épicas completadas" value={computed.epicas.epicasCompletas ?? 0} />
            <Row label="Avance épicas (promedio)" value={pct(computed.epicas.avancePromedio ?? 0)} />
          </div>
        </div>
      </div>

      {/* 4: Indicadores avanzados */}
      <AdvancedMetricsCard fin={finSafe} tareas={tareasFinal} />
    </section>
  );
}