"use client";

import { useMemo, useState } from "react";
import { exportGeneralPDF } from "./utils/exportGeneralPDF";

function clp(v) {
  const n = Number(v || 0);
  return n.toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}

function shortCLP(v) {
  const n = Number(v || 0);
  const abs = Math.abs(n);

  if (abs >= 1_000_000) {
    const m = n / 1_000_000;
    const s = Math.abs(m) >= 10 ? `${Math.round(m)}M` : `${m.toFixed(1)}M`;
    return `$${s}`;
  }

  if (abs >= 1_000) {
    const k = n / 1_000;
    const s = Math.abs(k) >= 10 ? `${Math.round(k)}K` : `${k.toFixed(1)}K`;
    return `$${s}`;
  }

  return clp(n).replace("CLP", "").trim();
}

function calcTotalVenta(venta) {
  if (venta?.totalFinal != null) return Number(venta.totalFinal) || 0;
  const detalles = venta?.detalles || [];
  return detalles.reduce(
    (s, d) => s + (Number(d.total ?? d.ventaTotal) || 0),
    0
  );
}

function calcTotalCosto(venta) {
  if (venta?.costoFinal != null) return Number(venta.costoFinal) || 0;
  const detalles = venta?.detalles || [];
  return detalles.reduce((s, d) => s + (Number(d.costoTotal) || 0), 0);
}

function isCot(venta) {
  return !!(venta?.ordenVenta || venta?.ordenVentaId);
}

function getCotLabel(venta) {
  if (venta?.ordenVenta?.numero) return `COT #${venta.ordenVenta.numero}`;
  if (venta?.ordenVentaId)
    return `COT #${String(venta.ordenVentaId).slice(-4)}`;
  return "Sin Cotización";
}

function inMonth(dateLike, year, monthIndex0) {
  const d = dateLike ? new Date(dateLike) : null;
  if (!d || isNaN(d.getTime())) return false;
  return d.getFullYear() === year && d.getMonth() === monthIndex0;
}

export default function CosteosDashboard({ ventas = [], onOpenReport, session }) {
  const r = 50;
  const C = 2 * Math.PI * r; // ~314.16

  const filteredVentas = ventas;

  // Cálculos principales
  const stats = useMemo(() => {
    let totalCosto = 0;
    let totalVenta = 0;

    for (const v of filteredVentas) {
      totalCosto += calcTotalCosto(v);
      totalVenta += calcTotalVenta(v);
    }

    const utilidad = totalVenta - totalCosto;
    const margenProm = totalVenta > 0 ? (utilidad / totalVenta) * 100 : 0;
    const count = filteredVentas.length;

    // Desglose de Costos por Tipo de Ítem (HH + Subtipos de Compra)
    let costoHH = 0;
    const gruposCompra = {};

    for (const v of filteredVentas) {
      costoHH += Number(v.extraVenta || 0); // Feriado / Urgencia se imputa a HH
      for (const d of v.detalles || []) {
        const c = Number(d.costoTotal || 0);
        if (d.modo === "HH") {
          costoHH += c;
        } else {
          const tipo = d.tipoItem?.nombre || "Otros Insumos";
          gruposCompra[tipo] = (gruposCompra[tipo] || 0) + c;
        }
      }
    }

    const totalCostoItems = costoHH + Object.values(gruposCompra).reduce((a, b) => a + b, 0);

    const costSegments = [];
    if (costoHH > 0 || totalCostoItems === 0) {
      costSegments.push({
        name: "Horas Hombre (HH)",
        value: costoHH,
        color: "#10b981", // Emerald
      });
    }

    const compraColors = [
      "#3b82f6", // Blue
      "#8b5cf6", // Violet
      "#f59e0b", // Amber
      "#ef4444", // Red
      "#ec4899", // Pink
      "#14b8a6", // Teal
      "#64748b", // Slate
    ];

    Object.entries(gruposCompra).forEach(([name, value], idx) => {
      if (value > 0) {
        costSegments.push({
          name,
          value,
          color: compraColors[idx % compraColors.length],
        });
      }
    });

    const totalSegmentsValue = costSegments.reduce((sum, item) => sum + item.value, 0);

    let accumulatedPercent = 0;
    const donutSegments = costSegments.map((item) => {
      const percent = totalSegmentsValue > 0 ? (item.value / totalSegmentsValue) * 100 : 0;
      const strokeDasharray = `${(percent / 100) * C} ${C}`;
      const strokeDashoffset = -((accumulatedPercent / 100) * C);
      accumulatedPercent += percent;
      return {
        ...item,
        percent,
        strokeDasharray,
        strokeDashoffset,
      };
    });

    // Tasa de Vinculación
    const vinculados = filteredVentas.filter(isCot).length;
    const noVinculados = count - vinculados;
    const pctVinculados = count > 0 ? (vinculados / count) * 100 : 0;
    const pctNoVinculados = count > 0 ? (noVinculados / count) * 100 : 0;

    // Top 5 costeos
    const topCosteos = [...filteredVentas]
      .sort((a, b) => calcTotalVenta(b) - calcTotalVenta(a))
      .slice(0, 5)
      .map((v) => {
        const vTotal = calcTotalVenta(v);
        const cTotal = calcTotalCosto(v);
        const ut = vTotal - cTotal;
        const marg = vTotal > 0 ? (ut / vTotal) * 100 : 0;
        return {
          id: v.numero ?? v.id,
          descripcion: v.descripcion || "Sin descripción",
          estado: getCotLabel(v),
          isLinked: isCot(v),
          venta: vTotal,
          costo: cTotal,
          utilidad: ut,
          margen: marg,
          original: v,
        };
      });

    return {
      count,
      totalCosto,
      totalVenta,
      utilidad,
      margenProm,
      vinculados,
      noVinculados,
      pctVinculados,
      pctNoVinculados,
      topCosteos,
      donutSegments,
      totalSegmentsValue,
    };
  }, [filteredVentas, C]);

  const currentMonthLabel = useMemo(() => {
    const months = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];
    const now = new Date();
    return `${months[now.getMonth()]} ${now.getFullYear()}`;
  }, []);

  return (
    <div className="space-y-6">
      {/* 1. KPIs Principales (Tarjetas Resumen) - COMENTADO PARA NO DUPLICAR
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Costeos Totales</span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600 text-[18px]">📊</div>
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-900">{stats.count}</h3>
            <p className="text-[10px] text-slate-400 mt-1">Proyectos en el período</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Costo Total</span>
            <div className="p-2 rounded-lg bg-red-50 text-red-600 text-[18px]">📉</div>
          </div>
          <div>
            <h3 className="text-2xl font-black text-red-600">{shortCLP(stats.totalCosto)}</h3>
            <p className="text-[10px] text-slate-400 mt-1">Monto total proyectado</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Venta Total</span>
            <div className="p-2 rounded-lg bg-green-50 text-green-600 text-[18px]">📈</div>
          </div>
          <div>
            <h3 className="text-2xl font-black text-green-600">{shortCLP(stats.totalVenta)}</h3>
            <p className="text-[10px] text-slate-400 mt-1">Monto total proyectado</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Utilidad Proy.</span>
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600 text-[18px]">💰</div>
          </div>
          <div>
            <h3 className="text-2xl font-black text-purple-600">{shortCLP(stats.utilidad)}</h3>
            <p className="text-[10px] text-slate-400 mt-1">Retorno estimado</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Margen Prom.</span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600 text-[18px]">🎯</div>
          </div>
          <div>
            <h3 className="text-2xl font-black text-amber-600">{stats.margenProm.toFixed(1)}%</h3>
            <p className="text-[10px] text-slate-400 mt-1">Eficiencia promedio</p>
          </div>
        </div>
      </div>
      */}

      {/* 2. Gráficos de Análisis Operativo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico A: Distribución por Tipo de Costo */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-md font-bold text-slate-900">Distribución por Tipo de Costo</h4>
            <p className="text-xs text-slate-500 mb-6">Representación del peso de los ítems dentro de los costeos del período</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-8 py-4">
            {/* SVG Donut */}
            <div className="relative w-40 h-40 flex items-center justify-center shrink-0">
              <svg width="160" height="160" viewBox="0 0 160 160" className="transform -rotate-90">
                {/* Background Circle */}
                <circle
                  cx="80"
                  cy="80"
                  r={r}
                  fill="transparent"
                  stroke="#f1f5f9"
                  strokeWidth="14"
                />
                {stats.count > 0 && stats.totalSegmentsValue > 0 ? (
                  <>
                    {stats.donutSegments.map((segment, idx) => (
                      <circle
                        key={idx}
                        cx="80"
                        cy="80"
                        r={r}
                        fill="transparent"
                        stroke={segment.color}
                        strokeWidth="14"
                        strokeDasharray={segment.strokeDasharray}
                        strokeDashoffset={segment.strokeDashoffset}
                        className="transition-all duration-1000 ease-out"
                      />
                    ))}
                  </>
                ) : null}
              </svg>
              {/* Inner Label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Costo Final</span>
                <span className="text-lg font-black text-slate-800">{shortCLP(stats.totalCosto)}</span>
              </div>
            </div>

            {/* Legends */}
            <div className="space-y-3 flex-1 max-h-[220px] overflow-y-auto pr-1 w-full">
              {stats.donutSegments && stats.donutSegments.length > 0 ? (
                stats.donutSegments.map((segment, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100/50 transition">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2.5 h-2.5 rounded-full block shrink-0" style={{ backgroundColor: segment.color }}></span>
                      <span className="font-bold text-xs text-slate-700 truncate">{segment.name}</span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-base font-black" style={{ color: segment.color }}>{segment.percent.toFixed(1)}%</span>
                      <span className="text-xs font-semibold text-slate-500">{clp(segment.value)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-xs text-slate-400 italic py-6">
                  No hay costos registrados en este período.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Gráfico B: Tasa de Vinculación a Cotizaciones */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-md font-bold text-slate-900">Tasa de Vinculación a Cotizaciones</h4>
            <p className="text-xs text-slate-500 mb-6">Mide la efectividad comercial de los costeos realizados</p>
          </div>

          <div className="space-y-6 my-auto py-2">
            {/* Vinculados progress bar */}
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">VINCULADOS</span>
                  <span className="font-bold text-slate-700">Vinculados a Cotización</span>
                </div>
                <span className="font-bold text-slate-900">
                  {stats.vinculados} {stats.vinculados === 1 ? "Costeo" : "Costeos"} ({stats.pctVinculados.toFixed(1)}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${stats.pctVinculados}%` }}
                />
              </div>
            </div>

            {/* Sin Cotizacion progress bar */}
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">SIN VINCULAR</span>
                  <span className="font-bold text-slate-700">Sin Cotización</span>
                </div>
                <span className="font-bold text-slate-900">
                  {stats.noVinculados} {stats.noVinculados === 1 ? "Costeo" : "Costeos"} ({stats.pctNoVinculados.toFixed(1)}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                <div
                  className="bg-amber-400 h-full rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${stats.pctNoVinculados}%` }}
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 mt-6 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Objetivo Comercial: Tasa de vinculación &gt; 70%</span>
            <span className={`font-bold ${stats.pctVinculados >= 70 ? "text-emerald-600" : "text-amber-500"}`}>
              {stats.pctVinculados >= 70 ? "🎯 Cumplido" : "⚠️ Por Debajo del Objetivo"}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Top Costeos del Período (Tabla de Detalles) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="mb-4">
          <h4 className="text-md font-bold text-slate-900">Top Costeos del Período</h4>
          <p className="text-xs text-slate-500">Detalle de los 5 proyectos/costeos de mayor impacto para revisión ejecutiva rápida</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">Descripción / Proyecto</th>
                <th className="py-3 px-4">Estado Comercial</th>
                <th className="py-3 px-4 text-right">Venta Total</th>
                <th className="py-3 px-4 text-right">Costo Total</th>
                <th className="py-3 px-4 text-right">Utilidad</th>
                <th className="py-3 px-4 text-right">% Margen</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {stats.topCosteos.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-6 text-center text-slate-400">
                    No hay registros en este período.
                  </td>
                </tr>
              ) : (
                stats.topCosteos.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-bold text-slate-600">#{item.id}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{item.descripcion}</td>
                    <td className="py-3 px-4">
                      {item.isLinked ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-blue-50 text-blue-600 border border-blue-100">
                          🔗 {item.estado}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-600 border border-amber-100">
                          ⚠️ {item.estado}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">{clp(item.venta)}</td>
                    <td className="py-3 px-4 text-right font-medium text-slate-500">{clp(item.costo)}</td>
                    <td className="py-3 px-4 text-right font-bold text-purple-600">{clp(item.utilidad)}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full block ${item.margen > 30 ? "bg-emerald-500 animate-pulse" : item.margen > 10 ? "bg-amber-400" : "bg-red-500"}`}></span>
                        <span className={`font-bold ${item.margen > 30 ? "text-emerald-600" : item.margen > 10 ? "text-amber-500" : "text-red-500"}`}>
                          {item.margen.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => onOpenReport?.(item.original)}
                        className="p-1.5 text-indigo-600 bg-indigo-50 hover:bg-indigo-600 hover:text-white rounded-lg transition hover:cursor-pointer flex items-center justify-center mx-auto"
                        title="Ver Reporte de Costeo"
                      >
                        📊
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
