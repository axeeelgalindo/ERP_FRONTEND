// src/app/(protected)/devengado/page.jsx
"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { BarChart, LineChart, PieChart, SparkLineChart, Gauge } from '@mui/x-charts';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import PendingIcon from '@mui/icons-material/Pending';
import SyncIcon from '@mui/icons-material/Sync';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import UpdateIcon from '@mui/icons-material/Update';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

/**
 * ✅ DEVENGADO / GANANCIA (SOLO POSITIVOS) — UI real con forecast semanal
 *
 * Cambios clave:
 * - Ya NO mostramos “utilidad devengada” negativa.
 * - Mostramos “GANANCIA (solo positivos)” = max(0, ingresoDevengadoPeriodo - costoPeriodo)
 * - Ingreso devengado semanal se calcula con el DELTA de avance de la semana:
 *      ingresoSemana = ventaBaseNeto * deltaAvanceSemana
 * - Además breakdown por épicas / tareas / subtareas:
 *      asignamos el ingreso semanal según ponderación por subtarea (costo_plan || horas_plan || 1)
 * - Forecast: “esta semana” y “próxima semana” usando promedio diario de la semana pasada.
 */

/* ----------------------- helpers base ----------------------- */
function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const round0 = (n) => Math.round(Number(n || 0));
const money = (n) => `$${Number(n || 0).toLocaleString("es-CL")}`;
const pct1 = (n) => `${Number(n || 0).toFixed(1)}%`;
const fmtDate = (d) =>
  new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "short" });

function cuidLike(rng, prefix = "cm") {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const len = 25;
  let s = prefix;
  for (let i = 0; i < len; i++) s += chars[Math.floor(rng() * chars.length)];
  return s;
}
function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}
function int(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}
function addDays(d, days) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}
function startOfMonthUTC(y, m1to12) {
  return new Date(Date.UTC(y, m1to12 - 1, 1, 12, 0, 0));
}
function endOfMonthUTC(y, m1to12) {
  return new Date(Date.UTC(y, m1to12, 0, 12, 0, 0));
}
function daysInMonth(y, m1to12) {
  return new Date(y, m1to12, 0).getDate();
}
function dateKey(d) {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const dd = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/* ----------------------- ventanas semanales (7 días) -----------------------
   - Semana pasada: [-13 .. -7]
   - Esta semana:   [-6  ..  0]   (incluye hoy)
   - Próx semana:   [+1  .. +7]
--------------------------------------------------------------------------- */
function makeWeekWindows(today = new Date()) {
  const startLast = addDays(today, -13);
  const endLast = addDays(today, -7);
  const startThis = addDays(today, -6);
  const endThis = addDays(today, 0);
  const startNext = addDays(today, 1);
  const endNext = addDays(today, 7);
  return {
    last: { key: "last", label: "Semana pasada", start: startLast, end: endLast },
    this: { key: "this", label: "Esta semana", start: startThis, end: endThis },
    next: { key: "next", label: "Próxima semana", start: startNext, end: endNext },
  };
}

function daysBetweenInclusive(start, end) {
  const out = [];
  const s = new Date(start);
  const e = new Date(end);
  s.setHours(12, 0, 0, 0);
  e.setHours(12, 0, 0, 0);
  for (let d = new Date(s); d <= e; d = addDays(d, 1)) out.push(new Date(d));
  return out;
}

/* ----------------------- MOCK con “historial” de avance por subtarea -----------------------
   Cada subtarea tendrá progress_events: [{date, avance}] en últimos 21 días.
   Así podemos calcular delta de avance en semana pasada / esta / próxima.
------------------------------------------------------------------------------------------- */
function makeProjectDevengadoMock({
  seed = 20260302,
  anio = 2026,
  mes = 3,
  proyectoId = null,
} = {}) {
  const rng = mulberry32(seed);
  const monthStart = startOfMonthUTC(anio, mes);
  const monthEnd = endOfMonthUTC(anio, mes);
  const dim = daysInMonth(anio, mes);

  const hoy = new Date();
  const windows = makeWeekWindows(hoy);

  const proyecto = {
    id: proyectoId || cuidLike(rng),
    nombre: pick(rng, [
      "ERP Blueinge — Módulo Proyectos",
      "SEST 2.0 — Devengado",
      "Mooh — Alarmas",
      "Captaciones — PreSiniestro",
    ]),
    estado: pick(rng, ["activo", "en_riesgo", "en_pausa"]),
    fecha_inicio_plan: addDays(monthStart, int(rng, -15, 5)),
    fecha_fin_plan: addDays(monthEnd, int(rng, 10, 45)),
    presupuesto: int(rng, 8_000_000, 42_000_000),
  };

  // Cotización + Venta base
  const ventaBaseNeto = int(rng, 8_000_000, 28_000_000);
  const iva = round0(ventaBaseNeto * 0.19);
  const totalConIva = ventaBaseNeto + iva;

  const cotizacion = {
    id: cuidLike(rng),
    numero: int(rng, 1000, 9999),
    estado: pick(rng, ["COTIZACION", "ACEPTADA", "ORDEN_VENTA"]),
    subtotal: ventaBaseNeto,
    iva,
    total: totalConIva,
    fecha: addDays(monthStart, int(rng, 0, 10)),
  };

  const empleados = Array.from({ length: 6 }).map(() => ({
    id: cuidLike(rng),
    nombre: pick(rng, [
      "Axel",
      "Daniela",
      "Camila",
      "Ignacio",
      "Francisca",
      "Matías",
      "Javiera",
      "Sebastián",
    ]),
    cargo: pick(rng, ["Dev Fullstack", "Dev Backend", "Dev Frontend", "PM", "QA"]),
    costoHH: int(rng, 12_000, 28_000),
  }));

  const cif = { valor: int(rng, 120_000, 420_000), anio, mes };

  // Estructura: épicas -> tareas -> subtareas
  const epicasN = int(rng, 2, 4);
  const epicas = [];
  const tareas = [];
  const subtareas = [];

  for (let e = 0; e < epicasN; e++) {
    const epId = cuidLike(rng);
    const ep = {
      id: epId,
      nombre: pick(rng, ["Planificación", "Implementación", "Integración", "QA/Deploy"]),
      estado: pick(rng, ["pendiente", "en_progreso", "bloqueada", "terminada"]),
      orden: e,
    };
    epicas.push(ep);

    const tN = int(rng, 2, 5);
    for (let t = 0; t < tN; t++) {
      const tId = cuidLike(rng);
      const avanceTarea = int(rng, 10, 95);
      const tPlanDias = int(rng, 6, 18);
      const inicioPlan = addDays(monthStart, int(rng, 0, Math.max(1, dim - 10)));
      const finPlan = addDays(inicioPlan, tPlanDias);

      const tarea = {
        id: tId,
        epica_id: epId,
        nombre: pick(rng, [
          "Implementar endpoint",
          "Armar UI",
          "Sincronizar Jira",
          "Optimizar query",
          "Devengado dashboard",
          "Rendiciones + flujo",
        ]),
        estado:
          avanceTarea >= 100 ? "terminada" : avanceTarea >= 45 ? "en_progreso" : "pendiente",
        avance: avanceTarea,
        fecha_inicio_plan: inicioPlan,
        fecha_fin_plan: finPlan,
        responsable_id: pick(rng, empleados).id,
      };
      tareas.push(tarea);

      const sN = int(rng, 2, 6);
      for (let s = 0; s < sN; s++) {
        const sId = cuidLike(rng);
        const horasPlan = int(rng, 6, 28);
        const detAvFinal = clamp(avanceTarea + int(rng, -25, 25), 0, 100);

        const resp = rng() < 0.8 ? pick(rng, empleados) : null;
        const valorHora = resp ? resp.costoHH : null;

        const costoPlan = valorHora != null ? valorHora * horasPlan : null;

        // Historial de avance en últimos 21 días: 2 a 5 “eventos”
        const eventsN = int(rng, 2, 5);
        const baseStart = clamp(detAvFinal - int(rng, 15, 55), 0, 95);

        const allDays = daysBetweenInclusive(addDays(hoy, -21), hoy);
        const picks = new Set();
        while (picks.size < eventsN) picks.add(int(rng, 0, allDays.length - 1));
        const idxs = Array.from(picks).sort((a, b) => a - b);

        const progress_events = idxs.map((idx, k) => {
          const t = k / Math.max(1, idxs.length - 1);
          const av = clamp(baseStart + (detAvFinal - baseStart) * t + int(rng, -3, 3), 0, detAvFinal);
          return { date: allDays[idx], avance: round0(av) };
        });

        // horas/costo real (info): aproximación a final
        const horasReal =
          detAvFinal > 0 ? Math.max(0, round0(horasPlan * (detAvFinal / 100) + int(rng, -3, 6))) : null;
        const costoReal =
          valorHora != null && horasReal != null ? valorHora * horasReal : null;

        subtareas.push({
          id: sId,
          tarea_id: tId,
          titulo: pick(rng, ["DTO/Schema", "Tabla UI", "Validaciones", "Seeds", "Fix UX", "Tests"]),
          estado:
            detAvFinal >= 100 ? "terminada" : detAvFinal >= 45 ? "en_progreso" : "pendiente",
          avance: detAvFinal,
          horas_plan: horasPlan,
          horas_real: horasReal,
          valor_hora: valorHora,
          costo_plan: costoPlan,
          costo_real: costoReal,
          responsable_id: resp?.id ?? null,
          fecha: addDays(monthStart, int(rng, 0, dim - 1)),
          progress_events,
        });
      }
    }
  }

  // Venta (costeo) con líneas HH y COMPRA (mock)
  const venta = {
    id: cuidLike(rng),
    numero: int(rng, 100, 999),
    descuentoPct: rng() < 0.3 ? int(rng, 2, 8) : 0,
    totalNeto: ventaBaseNeto,
    detalles: [],
  };

  // HH
  const hhLines = int(rng, 3, 6);
  for (let i = 0; i < hhLines; i++) {
    const emp = pick(rng, empleados);
    const cantHoras = int(rng, 12, 42);
    const alpha = int(rng, 8, 22);
    const alphaMult = 1 + alpha / 100;

    const costoSinAlpha = emp.costoHH * cantHoras + (cif.valor || 0) / hhLines;
    const costoTotal = costoSinAlpha * alphaMult;

    const ventaTotalBruto = costoTotal;
    const descItem = rng() < 0.25 ? int(rng, 3, 12) : 0;
    const ventaTotal = ventaTotalBruto * (1 - descItem / 100);

    venta.detalles.push({
      id: cuidLike(rng),
      modo: "HH",
      descripcion: `HH ${emp.nombre} (${cantHoras}h)`,
      empleadoId: emp.id,
      cantidad: cantHoras,
      costoHH: emp.costoHH,
      costoTotal,
      alpha,
      descuentoPct: descItem,
      ventaTotalBruto,
      ventaTotal,
    });
  }

  // Compras
  const comprasN = int(rng, 3, 7);
  const compras = [];
  const compraCosteos = [];
  for (let i = 0; i < comprasN; i++) {
    const estado = pick(rng, ["ORDEN_COMPRA", "FACTURADA", "PAGADA"]);
    const total = int(rng, 120_000, 2_200_000);
    const facturada = estado !== "ORDEN_COMPRA" && rng() < 0.85;

    const compra = {
      id: cuidLike(rng),
      numero: int(rng, 10, 999),
      estado,
      total,
      factura_url: facturada ? "/uploads/facturas/mock.pdf" : null,
      factura_monto: facturada ? total : null,
      fecha: addDays(monthStart, int(rng, 0, dim - 1)),
      proveedor: pick(rng, ["PC Factory", "Sodimac Empresa", "TecnoSur", "Distribuidora Osorno"]),
    };
    compras.push(compra);

    if (rng() < 0.65) {
      compraCosteos.push({
        id: cuidLike(rng),
        compra_id: compra.id,
        venta_id: venta.id,
        monto: round0(total * (0.5 + rng() * 0.5)),
        creado_en: addDays(compra.fecha, int(rng, 0, 7)),
      });
    }

    if (rng() < 0.55) {
      const alpha = int(rng, 5, 18);
      const alphaMult = 1 + alpha / 100;
      const costoTotal = total * alphaMult;
      const descItem = rng() < 0.2 ? int(rng, 2, 10) : 0;
      const ventaTotalBruto = costoTotal;
      const ventaTotal = ventaTotalBruto * (1 - descItem / 100);

      venta.detalles.push({
        id: cuidLike(rng),
        modo: "COMPRA",
        descripcion: `Materiales (${compra.proveedor})`,
        compraId: compra.id,
        cantidad: 1,
        costoTotal,
        alpha,
        descuentoPct: descItem,
        ventaTotalBruto,
        ventaTotal,
      });
    }
  }

  // descuento general
  const multGeneral = 1 - Number(venta.descuentoPct || 0) / 100;
  for (const d of venta.detalles) {
    const bruto = Number(d.ventaTotalBruto || d.ventaTotal || 0);
    const neto = bruto * (1 - Number(d.descuentoPct || 0) / 100) * multGeneral;
    d.ventaTotal = neto;
  }
  venta.totalNeto = round0(venta.detalles.reduce((s, x) => s + Number(x.ventaTotal || 0), 0));

  // ---------- avance ponderado (estado actual) ----------
  let wSum = 0;
  let wProg = 0;
  for (const st of subtareas) {
    const w = Number(st.costo_plan ?? 0) || Number(st.horas_plan ?? 0) || 1;
    const prog = clamp(Number(st.avance ?? 0), 0, 100) / 100;
    wSum += w;
    wProg += w * prog;
  }
  const avance = wSum > 0 ? wProg / wSum : 0;

  const ventaBase = Number(venta.totalNeto || 0);
  const devengadoMonto = ventaBase * avance;

  // costos reales globales
  const hhCostoReal = venta.detalles.filter((x) => x.modo === "HH").reduce((s, x) => s + Number(x.costoTotal || 0), 0);
  const comprasFacturadas = compras.filter((c) => c.factura_url).reduce((s, c) => s + Number(c.factura_monto || c.total || 0), 0);
  const comprasTotal = compras.reduce((s, c) => s + Number(c.total || 0), 0);
  const comprasAsignadas = compraCosteos.reduce((s, x) => s + Number(x.monto || 0), 0);

  const costoRealGlobal = hhCostoReal + comprasFacturadas;

  // (para “solo positivos”)
  const gananciaGlobalPos = Math.max(0, devengadoMonto - costoRealGlobal);

  // ---------- agrupar subtareas por tarea y épica ----------
  const subtareasByTarea = new Map();
  for (const st of subtareas) {
    if (!subtareasByTarea.has(st.tarea_id)) subtareasByTarea.set(st.tarea_id, []);
    subtareasByTarea.get(st.tarea_id).push(st);
  }
  const tareasByEpica = new Map();
  for (const t of tareas) {
    if (!tareasByEpica.has(t.epica_id)) tareasByEpica.set(t.epica_id, []);
    tareasByEpica.get(t.epica_id).push({
      ...t,
      subtareas: (subtareasByTarea.get(t.id) || []).sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()),
    });
  }
  const epicasUI = epicas.map((e) => ({
    ...e,
    tareas: (tareasByEpica.get(e.id) || []).sort((a, b) => a.nombre.localeCompare(b.nombre)),
  }));

  // ---------- riesgo ----------
  const burnPct = ventaBase > 0 ? (costoRealGlobal / ventaBase) * 100 : 0;
  const riesgo =
    burnPct > 105
      ? { level: "critico", msg: "Costo real (facturado) supera la venta base. En esta vista verás solo ganancias positivas." }
      : burnPct > 85
        ? { level: "alto", msg: "Costo real está muy cerca de la venta base." }
        : burnPct > 65
          ? { level: "medio", msg: "Costo real en zona media." }
          : { level: "ok", msg: "Costo real controlado vs venta base." };

  const resumen = {
    ventaBase,
    avancePct: avance * 100,
    devengadoMonto,
    costoReal: costoRealGlobal,
    // IMPORTANTES:
    gananciaPos: gananciaGlobalPos, // <- solo positivos
    hhCostoReal,
    comprasFacturadas,
    comprasTotal,
    comprasAsignadas,
    burnPct,
    riesgo,
    wSum,
  };

  // OVERRIDE FOR ERP DEMO (80M venta, 30M costo, 78% avance)
  resumen.ventaBase = 80_000_000;
  resumen.costoReal = 30_000_000;
  resumen.avancePct = 78;
  resumen.devengadoMonto = resumen.ventaBase * (resumen.avancePct / 100);
  resumen.gananciaPos = Math.max(0, resumen.devengadoMonto - resumen.costoReal);

  cotizacion.subtotal = 80_000_000;
  cotizacion.iva = 80_000_000 * 0.19;
  cotizacion.total = 80_000_000 * 1.19;
  venta.totalNeto = 80_000_000;
  proyecto.nombre = "ERP Blueinge — Módulo Proyectos";
  proyecto.estado = "activo";

  return {
    proyecto,
    periodo: { anio, mes },
    cotizacion,
    venta,
    empleados,
    cif,
    epicas: epicasUI,
    compras,
    compraCosteos,
    windows,
    resumen,
  };
}

/* ----------------------- cálculo: avance en una fecha desde progress_events ----------------------- */
function progressAtDate(subtarea, atDate) {
  const events = subtarea.progress_events || [];
  if (!events.length) return clamp(Number(subtarea.avance || 0), 0, 100) / 100;
  const t = new Date(atDate).getTime();
  let last = null;
  for (const e of events) {
    const te = new Date(e.date).getTime();
    if (te <= t) last = e;
    else break;
  }
  if (!last) return clamp(Number(events[0].avance || 0), 0, 100) / 100;
  return clamp(Number(last.avance || 0), 0, 100) / 100;
}

/* ----------------------- calcular “ganancia” semanal por jerarquía -----------------------
   - ingresoDevengadoSemana: ventaBase * deltaAvanceSemana (ponderado)
   - costoSemana: estimación (para esta vista): usamos % del costo global basado en avance
     y para FUTURO: usamos promedio diario de semana pasada.
   - gananciaPos: max(0, ingreso - costo)
------------------------------------------------------------------------------------------ */
function computeWeekReport({ data, weekKey }) {
  const { windows, resumen, epicas } = data;
  const week = windows[weekKey];
  const days = daysBetweenInclusive(week.start, week.end);

  // construir lista plana de subtareas con referencias
  const flat = [];
  for (const ep of epicas) {
    for (const t of ep.tareas) {
      for (const st of t.subtareas || []) {
        flat.push({
          epicaId: ep.id,
          epicaNombre: ep.nombre,
          tareaId: t.id,
          tareaNombre: t.nombre,
          subtareaId: st.id,
          subtareaTitulo: st.titulo,
          subtarea: st,
        });
      }
    }
  }

  // ponderación
  const weights = new Map();
  let wSum = 0;
  for (const x of flat) {
    const st = x.subtarea;
    const w = Number(st.costo_plan ?? 0) || Number(st.horas_plan ?? 0) || 1;
    weights.set(st.id, w);
    wSum += w;
  }
  if (wSum <= 0) wSum = resumen.wSum || 1;

  // delta avance ponderado de la semana (start -> end)
  const p0 = new Map();
  const p1 = new Map();
  for (const x of flat) {
    const st = x.subtarea;
    p0.set(st.id, progressAtDate(st, week.start));
    p1.set(st.id, progressAtDate(st, week.end));
  }

  let deltaWeek = 0;
  for (const x of flat) {
    const st = x.subtarea;
    const w = weights.get(st.id) || 1;
    const d = Math.max(0, (p1.get(st.id) || 0) - (p0.get(st.id) || 0)); // SOLO delta positivo
    deltaWeek += (w / wSum) * d;
  }

  const ingresoSemana = resumen.ventaBase * deltaWeek;

  // costo semana:
  // - semana pasada: aproximamos como “costo global * deltaWeek” (siempre proporcional a avance)
  // - esta/próxima: forecast usando promedio diario semana pasada (calculado abajo)
  let costoSemana = resumen.costoReal * deltaWeek;

  // Breakdown por jerarquía: asignar ingreso según contribución de cada subtarea
  const epMap = new Map();
  const tareaMap = new Map();
  const subtMap = new Map();

  for (const x of flat) {
    const st = x.subtarea;
    const w = weights.get(st.id) || 1;
    const d = Math.max(0, (p1.get(st.id) || 0) - (p0.get(st.id) || 0));
    const share = (w / wSum) * d; // contribución al delta ponderado
    const ingreso = resumen.ventaBase * share;

    // costeamos igual: proporcional a ingreso (misma share)
    const costo = resumen.costoReal * share;

    const gPos = Math.max(0, ingreso - costo);

    // épica
    const eKey = x.epicaId;
    if (!epMap.has(eKey)) epMap.set(eKey, { id: x.epicaId, nombre: x.epicaNombre, ingreso: 0, costo: 0, ganancia: 0 });
    const e = epMap.get(eKey);
    e.ingreso += ingreso; e.costo += costo; e.ganancia += gPos;

    // tarea
    const tKey = x.tareaId;
    if (!tareaMap.has(tKey)) tareaMap.set(tKey, { id: x.tareaId, nombre: x.tareaNombre, epicaNombre: x.epicaNombre, ingreso: 0, costo: 0, ganancia: 0 });
    const tt = tareaMap.get(tKey);
    tt.ingreso += ingreso; tt.costo += costo; tt.ganancia += gPos;

    // subtarea
    const sKey = x.subtareaId;
    if (!subtMap.has(sKey)) subtMap.set(sKey, { id: x.subtareaId, nombre: x.subtareaTitulo, tareaNombre: x.tareaNombre, ingreso: 0, costo: 0, ganancia: 0 });
    const ss = subtMap.get(sKey);
    ss.ingreso += ingreso; ss.costo += costo; ss.ganancia += gPos;
  }

  // ordenar
  const epicasRows = Array.from(epMap.values()).sort((a, b) => b.ganancia - a.ganancia);
  const tareasRows = Array.from(tareaMap.values()).sort((a, b) => b.ganancia - a.ganancia);
  const subtRows = Array.from(subtMap.values()).sort((a, b) => b.ganancia - a.ganancia);

  // KPIs semana (solo positivos)
  const gananciaSemanaPos = Math.max(0, ingresoSemana - costoSemana);

  // tabla diaria (para “sensación real”)
  // ingreso diario = ingresoSemana / 7 (simple)
  // costo diario = costoSemana / 7 (simple)
  const ingresoDia = ingresoSemana / days.length;
  const costoDia = costoSemana / days.length;

  const daily = days.map((d) => {
    const g = Math.max(0, ingresoDia - costoDia);
    return { date: d, ingreso: ingresoDia, costo: costoDia, ganancia: g };
  });

  return {
    week,
    deltaWeekPct: deltaWeek * 100,
    ingresoSemana,
    costoSemana,
    gananciaSemanaPos,
    epicasRows,
    tareasRows,
    subtRows,
    daily,
  };
}

/* ----------------------- mini charts (SVG/HTML) ----------------------- */
function Donut({ valuePct = 0, subtitle, big }) {
  const size = big ? 128 : 104;
  const stroke = big ? 12 : 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = clamp(valuePct, 0, 100);
  const dash = (v / 100) * c;

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} className="shrink-0">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="fill-none stroke-slate-200" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          className="fill-none stroke-slate-900"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text x="50%" y="48%" textAnchor="middle" className="fill-slate-900" style={{ fontSize: big ? 22 : 18, fontWeight: 800 }}>
          {pct1(v)}
        </text>
        <text x="50%" y="64%" textAnchor="middle" className="fill-slate-500" style={{ fontSize: 12 }}>
          {subtitle}
        </text>
      </svg>
      <div className="text-sm text-slate-600">
        <div className="font-semibold text-slate-900">Avance del proyecto</div>
        <div className="mt-1">Ponderado por costo/horas de subtareas.</div>
      </div>
    </div>
  );
}

function Sparkline({ data = [], valueKey = "ganancia" }) {
  const w = 280;
  const h = 64;
  const pad = 6;

  const values = data.map((d) => Number(d[valueKey] || 0));
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);

  const x = (i) => pad + (i * (w - 2 * pad)) / Math.max(1, values.length - 1);
  const y = (v) => {
    const t = (v - min) / (max - min || 1);
    return h - pad - t * (h - 2 * pad);
  };

  const dPath = values
    .map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
    .join(" ");

  return (
    <svg width={w} height={h} className="block">
      <path d={dPath} className="fill-none stroke-slate-900" strokeWidth="2" />
      <path d={`${dPath} L ${x(values.length - 1)} ${h - pad} L ${x(0)} ${h - pad} Z`} className="fill-slate-100" />
    </svg>
  );
}

function Bars({ items }) {
  const max = Math.max(...items.map((x) => Number(x.value || 0)), 1);
  return (
    <div className="space-y-3">
      {items.map((it) => {
        const v = Number(it.value || 0);
        const w = clamp((v / max) * 100, 0, 100);
        return (
          <div key={it.label}>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">{it.label}</span>
              <span className="font-semibold text-slate-900">{money(v)}</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-slate-200">
              <div className="h-2 rounded-full bg-slate-900" style={{ width: `${w}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ----------------------- UI blocks ----------------------- */
function Kpi({ title, value, hint, tone = "default" }) {
  const toneCls =
    tone === "danger"
      ? "border-red-200 bg-red-50"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50"
        : tone === "ok"
          ? "border-emerald-200 bg-emerald-50"
          : "border-slate-200 bg-white";

  return (
    <div className={`rounded-2xl border p-4 ${toneCls}`}>
      <div className="text-xs text-slate-500">{title}</div>
      <div className="mt-1 text-xl font-extrabold tracking-tight text-slate-900">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-600">{hint}</div> : null}
    </div>
  );
}

function Section({ title, right, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-4">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Pill({ children, tone = "neutral" }) {
  const cls =
    tone === "ok"
      ? "bg-emerald-100 text-emerald-900"
      : tone === "warn"
        ? "bg-amber-100 text-amber-900"
        : tone === "danger"
          ? "bg-red-100 text-red-900"
          : "bg-slate-100 text-slate-700";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{children}</span>;
}

function Table({ cols, rows, empty }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="text-left text-slate-500">
          <tr>
            {cols.map((c) => (
              <th key={c} className="py-2 pr-3 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((r, i) => (
              <tr key={i} className="border-t border-slate-100">
                {r.map((cell, j) => (
                  <td key={j} className="py-2 pr-3 align-top">
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr className="border-t border-slate-100">
              <td className="py-3 text-slate-500" colSpan={cols.length}>
                {empty || "Sin datos"}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ----------------------- main page ----------------------- */
export default function DevengadoProyectoPage() {
  const sp = useSearchParams();
  const proyectoId = sp.get("proyectoId");

  const [weekTab, setWeekTab] = useState("last"); // last | this | next

  const data = useMemo(() => {
    return makeProjectDevengadoMock({
      seed: 20260302,
      anio: 2026,
      mes: 3,
      proyectoId,
    });
  }, [proyectoId]);

  const { proyecto, periodo, cotizacion, venta, empleados, cif, epicas, compras, compraCosteos, resumen } = data;

  const riesgoTone =
    resumen.riesgo.level === "critico"
      ? "danger"
      : resumen.riesgo.level === "alto"
        ? "warn"
        : resumen.riesgo.level === "medio"
          ? "warn"
          : "ok";

  const estadoTone =
    proyecto.estado === "activo" ? "ok" : proyecto.estado === "en_riesgo" ? "warn" : "neutral";

  // Reportes semanales (real+forecast)
  const repLast = useMemo(() => computeWeekReport({ data, weekKey: "last" }), [data]);
  const repThis = useMemo(() => {
    // forecast con promedio diario semana pasada
    const base = computeWeekReport({ data, weekKey: "this" });
    const avgIngreso = repLast.ingresoSemana / 7;
    const avgCosto = repLast.costoSemana / 7;
    base.ingresoSemana = avgIngreso * 7;
    base.costoSemana = avgCosto * 7;
    base.gananciaSemanaPos = Math.max(0, base.ingresoSemana - base.costoSemana);
    base.daily = base.daily.map((d) => ({
      ...d,
      ingreso: avgIngreso,
      costo: avgCosto,
      ganancia: Math.max(0, avgIngreso - avgCosto),
    }));
    return base;
  }, [data, repLast]);

  const repNext = useMemo(() => {
    // forecast similar (puedes hacer “tendencia” si quieres)
    const base = computeWeekReport({ data, weekKey: "next" });
    const avgIngreso = repLast.ingresoSemana / 7;
    const avgCosto = repLast.costoSemana / 7;
    base.ingresoSemana = avgIngreso * 7;
    base.costoSemana = avgCosto * 7;
    base.gananciaSemanaPos = Math.max(0, base.ingresoSemana - base.costoSemana);
    base.daily = base.daily.map((d) => ({
      ...d,
      ingreso: avgIngreso,
      costo: avgCosto,
      ganancia: Math.max(0, avgIngreso - avgCosto),
    }));
    return base;
  }, [data, repLast]);

  // Sobrescribir "Esta semana" para matchear con los requerimientos (avanzó ~2% extra)
  const repThisMux = { ...repThis };
  repThisMux.deltaWeekPct = 2.0; // 2%
  repThisMux.ingresoSemana = resumen.ventaBase * 0.02;
  repThisMux.costoSemana = resumen.costoReal * 0.02;
  repThisMux.gananciaSemanaPos = repThisMux.ingresoSemana - repThisMux.costoSemana;

  const active = weekTab === "last" ? repLast : weekTab === "this" ? repThisMux : repNext;

  // Insights
  const comprasSinFactura = compras.filter((c) => !c.factura_url).length;
  const comprasFact = compras.filter((c) => !!c.factura_url).length;

  const subtareasAll = epicas.flatMap((e) => e.tareas.flatMap((t) => t.subtareas || []));
  const stPendientes = subtareasAll.filter((s) => s.avance < 100).length;
  const stTerminadas = subtareasAll.filter((s) => s.avance >= 100).length;

  return (
    <div className="bg-slate-50 text-slate-900 min-h-screen transition-colors duration-200">
      <main className="p-8 max-w-[1500px] mx-auto space-y-8">
        <header className="mb-4">
          <nav className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
            <span>Proyectos</span>
            <ChevronRightIcon fontSize="small" className="text-sm" />
            <span>{proyecto.nombre.split("—")[0].trim()}</span>
            <ChevronRightIcon fontSize="small" className="text-sm" />
            <span className="text-slate-600">{proyecto.nombre.split("—").length > 1 ? proyecto.nombre.split("—")[1].trim() : "Detalle"}</span>
          </nav>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-4">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Devengado - {proyecto.nombre}</h1>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${estadoTone === 'ok' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${estadoTone === 'ok' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                  {proyecto.estado}
                </span>
              </div>
              <div className="flex items-center gap-4 text-slate-500 mt-2">
                <div className="flex items-center gap-1.5 text-sm">
                  <CalendarMonthIcon fontSize="small" className="text-[18px]" />
                  <span>Periodo: {periodo.mes}/{periodo.anio}</span>
                </div>
                <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                <div className="flex items-center gap-1.5 text-sm">
                  <UpdateIcon fontSize="small" className="text-[18px]" />
                  <span>Plan: {fmtDate(proyecto.fecha_inicio_plan)} → {fmtDate(proyecto.fecha_fin_plan)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button className="px-4 py-1.5 text-xs font-bold bg-white shadow-sm rounded-md text-slate-900">Realtime</button>
                <button className="px-4 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700">Histórico</button>
              </div>
              <button onClick={() => location.reload()} className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-slate-900 text-white rounded-xl hover:opacity-95 transition-all shadow-lg shadow-slate-900/10">
                <SyncIcon fontSize="small" className="text-lg" />
                Refrescar Mock
              </button>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white border border-slate-200/60 rounded-[12px] p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Venta Total</span>
              <span className="text-emerald-500 flex items-center text-xs font-bold bg-emerald-50 px-1.5 py-0.5 rounded">Target</span>
            </div>
            <div className="text-2xl font-bold mb-4 tracking-tight">{money(resumen.ventaBase)}</div>
            <div className="h-10 w-full relative -mx-2 -mb-2">
              <SparkLineChart
                data={[2, 4, 4, 6, 8, 12, 15]}
                colors={['#3B82F6']}
                area
                curve="step"
                margin={{ top: 5, bottom: 5, left: 5, right: 5 }}
                sx={{
                  '& .MuiAreaElement-root': { fill: 'url(#gradient-blue)' },
                  '& .MuiLineElement-root': { strokeWidth: 2 }
                }}
              />
              <svg style={{ height: 0 }}><defs><linearGradient id="gradient-blue" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#3B82F6" stopOpacity={0.2} /><stop offset="100%" stopColor="#3B82F6" stopOpacity={0} /></linearGradient></defs></svg>
            </div>
          </div>
          <div className="bg-white border border-slate-200/60 rounded-[12px] p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Costo Real</span>
              <span className={`flex items-center text-xs font-bold px-1.5 py-0.5 rounded ${resumen.costoReal > resumen.ventaBase / 2 ? 'text-amber-500 bg-amber-50' : 'text-emerald-500 bg-emerald-50'}`}>Facturado</span>
            </div>
            <div className="text-2xl font-bold mb-4 tracking-tight text-rose-500">{money(resumen.costoReal)}</div>
            <div className="h-10 w-full relative -mx-2 -mb-2">
              <SparkLineChart
                data={[1, 3, 5, 8, 12, 13, 16]}
                colors={['#F43F5E']}
                area
                curve="monotoneX"
                margin={{ top: 5, bottom: 5, left: 5, right: 5 }}
                sx={{
                  '& .MuiAreaElement-root': { fill: 'url(#gradient-rose)' },
                  '& .MuiLineElement-root': { strokeWidth: 2 }
                }}
              />
              <svg style={{ height: 0 }}><defs><linearGradient id="gradient-rose" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#F43F5E" stopOpacity={0.2} /><stop offset="100%" stopColor="#F43F5E" stopOpacity={0} /></linearGradient></defs></svg>
            </div>
          </div>
          <div className="bg-white border border-slate-200/60 rounded-[12px] p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Ganancia (Devengada)</span>
              <span className="text-emerald-500 flex items-center text-[10px] font-bold bg-emerald-50 px-1.5 py-0.5 rounded">Solo Positivos</span>
            </div>
            <div className="text-2xl font-bold mb-4 tracking-tight text-emerald-600">{money(resumen.gananciaPos)}</div>
            <div className="h-12 w-full relative -mx-2 -mb-4">
              <BarChart
                series={[{ data: [2, 5, 3, 8, 10, 15, 12], color: '#10B981', valueFormatter: () => '' }]}
                xAxis={[{ scaleType: 'band', data: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7'], display: false }]}
                yAxis={[{ display: false }]}
                margin={{ left: 0, right: 0, top: 0, bottom: 0 }}
                tooltip={{ trigger: 'none' }}
                sx={{ '& .MuiBarElement-root': { rx: 2 } }}
              />
            </div>
          </div>
          <div className="bg-white border border-slate-200/60 rounded-[12px] p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Margen Bruto</span>
                <span className="text-slate-400 flex items-center text-[10px] font-bold">Target: 65%</span>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center relative -mt-4">
              <Gauge
                value={Number(((resumen.ventaBase - resumen.costoReal) / resumen.ventaBase) * 100)}
                startAngle={-110}
                endAngle={110}
                innerRadius="75%"
                sx={{
                  '& .MuiGauge-valueArc': { fill: '#64748B' },
                  '& .MuiGauge-referenceArc': { fill: '#F1F5F9' },
                  '& .MuiGauge-valueText': { fontSize: 24, fontWeight: 'bold', fill: '#0F172A', transform: 'translate(0px, 4px)' }
                }}
                text={`${Math.round(((resumen.ventaBase - resumen.costoReal) / resumen.ventaBase) * 100)}%`}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-7 bg-white border border-slate-200/60 rounded-[12px] p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="font-bold text-lg text-slate-800">Avance General del Proyecto</h3>
                <p className="text-sm text-slate-500">Métricas de ejecución física vs. financiera</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                <button className="px-3 py-1 bg-white shadow-sm rounded-md text-slate-900 border border-slate-100">Mensual</button>
                <button className="px-3 py-1 hover:text-slate-600 transition-colors">Acumulado</button>
              </div>
            </div>
            <div className="flex flex-col md:flex-row items-center gap-12">
              <div className="relative w-56 h-56 flex items-center justify-center shrink-0">
                <PieChart
                  series={[
                    {
                      data: [
                        { id: 0, value: resumen.avancePct, color: '#3B82F6' },
                        { id: 1, value: 100 - resumen.avancePct, color: '#E2E8F0' },
                      ],
                      innerRadius: 80,
                      outerRadius: 100,
                      paddingAngle: 0,
                      cornerRadius: 0,
                      startAngle: 0,
                      endAngle: 360,
                      cx: 100,
                      cy: 100,
                    }
                  ]}
                  width={220}
                  height={220}
                  margin={{ left: 10, right: 10, top: 10, bottom: 10 }}
                  sx={{ '& .MuiPieArc-root': { stroke: 'none' } }}
                  tooltip={{ trigger: 'none' }}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-5xl font-extrabold text-slate-900">{Math.round(resumen.avancePct)}<span className="text-2xl font-bold text-slate-400">%</span></span>
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-1">Completado</span>
                </div>
              </div>
              <div className="flex-1 w-full space-y-6">
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-end">
                      <span className="text-sm font-semibold text-slate-600">Avance Ponderado</span>
                      <span className="text-sm font-bold text-blue-500">{pct1(resumen.avancePct)}</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${resumen.avancePct}%` }}></div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 opacity-80">
                    <div className="flex justify-between items-end">
                      <span className="text-sm font-semibold text-slate-600">Costeo / Venta Actual</span>
                      <span className="text-sm font-bold text-slate-800">{pct1((resumen.costoReal / resumen.ventaBase) * 100)}</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-slate-400 rounded-full" style={{ width: `${(resumen.costoReal / resumen.ventaBase) * 100}%` }}></div>
                    </div>
                  </div>
                </div>
                <div className="pt-6 border-t border-slate-100 grid grid-cols-2 gap-4">
                  <div className="flex items-start gap-2.5">
                    <CheckCircleIcon fontSize="small" className="text-blue-500 mt-0.5" />
                    <div>
                      <p className="text-xs text-slate-400 uppercase font-bold tracking-tight">Hitos OK</p>
                      <p className="text-sm font-bold">{stTerminadas} de {stTerminadas + stPendientes}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <PendingActionsIcon fontSize="small" className="text-amber-500 mt-0.5" />
                    <div>
                      <p className="text-xs text-slate-400 uppercase font-bold tracking-tight">Pendientes</p>
                      <p className="text-sm font-bold">{stPendientes} Tareas</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-span-12 lg:col-span-5 bg-white border border-slate-200/60 rounded-[12px] p-8 flex flex-col shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-bold text-lg text-slate-800">Weekly Pulse ({active.week.label})</h3>
              <div className="text-xs font-semibold text-slate-400 flex items-center gap-2">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Ingreso</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-200"></span> Costo</span>
              </div>
            </div>
            <div className="flex-1 mb-8 h-48 border-slate-100 pb-2 relative w-full -ml-4">
              <BarChart
                series={[
                  { data: active.daily.map(d => d.costo), color: '#E2E8F0', valueFormatter: (v) => money(v) },
                  { data: active.daily.map(d => d.ingreso), color: '#3B82F6', valueFormatter: (v) => money(v) }
                ]}
                xAxis={[{ data: active.daily.map(d => d.date.toLocaleString('es-ES', { weekday: 'short' }).charAt(0).toUpperCase() + d.date.toLocaleString('es-ES', { weekday: 'short' }).slice(1)), scaleType: 'band' }]}
                margin={{ left: 10, right: 10, top: 10, bottom: 20 }}
                yAxis={[{ display: false }]}
                slotProps={{ legend: { hidden: true } }}
                barLabel={(item, context) => { return null; }}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[10px] text-slate-400 uppercase font-bold mb-1 tracking-wider">Ingreso Sem. (+{pct1(active.deltaWeekPct)})</p>
                <p className="text-xl font-bold text-slate-900">{money(active.ingresoSemana)}</p>
              </div>
              <div className={`p-4 rounded-xl border ${active.gananciaSemanaPos > 0 ? "bg-emerald-50 border-emerald-100/50" : "bg-slate-50 border-slate-100"}`}>
                <p className={`text-[10px] uppercase font-bold mb-1 tracking-wider ${active.gananciaSemanaPos > 0 ? "text-emerald-600" : "text-slate-500"}`}>Neto Sem.</p>
                <p className={`text-xl font-bold ${active.gananciaSemanaPos > 0 ? "text-emerald-700" : "text-slate-700"}`}>{money(active.gananciaSemanaPos)}</p>
              </div>
            </div>
            {active.gananciaSemanaPos === 0 && (
              <div className="text-xs text-amber-600 mt-4 font-medium bg-amber-50 p-2 rounded-lg border border-amber-100 flex items-center gap-2">
                <WarningAmberIcon fontSize="small" className="text-sm" /> Este proyecto lleva semanas sin generar ganancia real.
              </div>
            )}
          </div>
        </div>

        <section className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="px-8 pt-6 border-b border-slate-100 flex justify-between items-end pb-0">
            <div className="flex gap-8">
              <button className="pb-4 text-sm font-bold border-b-2 border-slate-900 text-slate-900">Desglose de Épicas</button>
              <button className="pb-4 text-sm font-medium text-slate-400 hover:text-slate-600">Tareas Específicas</button>
            </div>
            <div className="pb-4 hidden md:block">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest border border-slate-100 px-3 py-1 bg-slate-50 rounded-full">Período: {active.week.label}</span>
            </div>
          </div>
          <div className="grid grid-cols-12">
            <div className="col-span-12 lg:col-span-8 p-0 border-r border-slate-100">
              <div className="overflow-x-auto max-h-[350px]">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/50 text-[11px] text-slate-400 uppercase tracking-widest sticky top-0 z-10 border-b border-slate-100">
                    <tr>
                      <th className="text-left px-8 py-4 font-semibold">Identificador de Épica</th>
                      <th className="text-right px-8 py-4 font-semibold">Ingreso Semanal</th>
                      <th className="text-right px-8 py-4 font-semibold">Ganancia Neta</th>
                      <th className="text-right px-8 py-4 font-semibold">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {active.epicasRows.slice(0, 10).map((x, i) => (
                      <tr key={i} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-blue-500' : i === 1 ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                            <span className="font-bold text-slate-700 uppercase tracking-tight">{x.nombre}</span>
                          </div>
                        </td>
                        <td className="px-8 py-5 text-right font-medium text-slate-600">{money(round0(x.ingreso))}</td>
                        <td className="px-8 py-5 text-right">
                          <span className="font-bold text-emerald-600">{money(round0(x.ganancia))}</span>
                          <div className="text-[10px] text-slate-400 mt-0.5">Rentabilidad {pct1(x.ingreso > 0 ? (x.ganancia / x.ingreso) * 100 : 0)}</div>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <button className="p-1.5 hover:bg-white rounded-md border border-transparent hover:border-slate-200">
                            <OpenInNewIcon fontSize="small" className="text-sm text-slate-400" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {active.epicasRows.length === 0 && <tr><td colSpan="4" className="text-center py-6 text-slate-400">Sin movimiento esta semana</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="col-span-12 lg:col-span-4 bg-slate-50/50 p-8">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Resumen de Drilldown</h4>
              <div className="space-y-6">
                <div>
                  <p className="text-2xl font-bold text-slate-900">{money(round0(active.ingresoSemana))}</p>
                  <p className="text-xs text-slate-400">Ingreso Total Generado (Semana)</p>
                </div>
                <div className="h-px bg-slate-200 w-full"></div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-600">Tareas Activas</span>
                    <span className="text-sm font-bold px-2 py-0.5 bg-slate-200 rounded text-slate-700">{active.tareasRows.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-600">Subtareas Pendientes</span>
                    <span className="text-sm font-bold px-2 py-0.5 bg-slate-200 rounded text-slate-700">{stPendientes}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-600">Avance Total</span>
                    <span className="text-sm font-bold text-emerald-500">{pct1(resumen.avancePct)}</span>
                  </div>
                </div>
                <div className="pt-4">
                  <button className="w-full py-2.5 text-xs font-bold border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition-all flex justify-center items-center gap-2">
                    <span className="material-symbols-outlined text-sm">description</span> Ver Reporte Full
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-12 gap-8">
          <div className="col-span-12">
            <div className="flex items-center gap-3 mb-6">
              <BusinessCenterIcon className="text-slate-900" />
              <h2 className="text-lg font-bold">Gestión de Operaciones & Contratos</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-8 rounded-2xl border border-slate-200/60 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4">
                  <span className="px-3 py-1 bg-slate-900 text-white text-[10px] font-bold rounded-full">COT-{cotizacion.numero}</span>
                </div>
                <div className="space-y-6">
                  <div>
                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1">Cotización Estimada / Contrato</p>
                    <h3 className="text-4xl font-extrabold text-slate-900 tracking-tight">{money(cotizacion.total)}</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-8 py-6 border-y border-slate-100">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase mb-1 font-bold">Subtotal Neto</p>
                      <p className="text-lg font-bold text-slate-700">{money(cotizacion.subtotal)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase mb-1 font-bold">IVA Impuesto (19%)</p>
                      <p className="text-lg font-bold text-slate-700">{money(cotizacion.iva)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>Emisión: {fmtDate(cotizacion.fecha)}</span>
                  </div>
                </div>
              </div>
              <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4">
                  <span className="px-3 py-1 bg-emerald-500 text-white text-[10px] font-bold rounded-full">COSTEO REAL GLOBAL</span>
                </div>
                <div className="space-y-6">
                  <div>
                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1">Inversión Devengada Real</p>
                    <h3 className="text-4xl font-extrabold text-white tracking-tight">{money(resumen.costoReal)}</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-8 py-6 border-y border-slate-700/50">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase mb-1 font-bold">Costo HH Acumulado</p>
                      <p className="text-lg font-bold text-emerald-400">{money(resumen.hhCostoReal)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase mb-1 font-bold">Compras (OC Facturadas)</p>
                      <p className="text-lg font-bold text-white">{money(resumen.comprasFacturadas)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
                    <TrendingDownIcon fontSize="small" className="text-sm" />
                    Costo Actual {pct1((resumen.costoReal / resumen.ventaBase) * 100)} del Presupuesto de Venta Base
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-12 gap-8 pb-10">
          <div className="col-span-12 lg:col-span-7">
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden h-full">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-bold text-sm text-slate-900">Compras del Proyecto</h3>
                <div className="flex gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">{comprasFact} FACTURADAS</span>
                  {comprasSinFactura > 0 && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">{comprasSinFactura} PENDIENTES</span>}
                </div>
              </div>
              <div className="max-h-[380px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white text-[10px] text-slate-400 uppercase border-b border-slate-100 z-10 shadow-sm">
                    <tr>
                      <th className="text-left px-6 py-4 font-semibold">OC / Ref</th>
                      <th className="text-left px-6 py-4 font-semibold">Estado</th>
                      <th className="text-right px-6 py-4 font-semibold">Total Bruto</th>
                      <th className="text-center px-6 py-4 font-semibold">Docs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {compras.slice().sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).map((c, i) => (
                      <tr key={i} className="hover:bg-slate-50 border-transparent transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-mono text-xs font-bold text-slate-700">#{c.numero}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5 flex flex-col"><span className="font-medium text-slate-500 truncate" style={{ maxWidth: '130px' }} title={c.proveedor}>{c.proveedor}</span><span>{fmtDate(c.fecha)}</span></div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${c.factura_url ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                            {c.factura_url ? 'Facturada' : c.estado}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-slate-900">{money(c.total)}</td>
                        <td className="px-6 py-4 text-center">
                          {c.factura_url ? <CheckCircleIcon fontSize="small" className="text-emerald-500 text-lg" /> : <PendingIcon fontSize="small" className="text-slate-300 text-lg" />}
                        </td>
                      </tr>
                    ))}
                    {compras.length === 0 && <tr><td colSpan="4" className="text-center py-6 text-slate-400">Sin historial de OC</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center rounded-b-2xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Inversión Facturada (OC)</span>
                <span className="text-sm font-extrabold text-slate-900">{money(resumen.comprasFacturadas)}</span>
              </div>
            </div>
          </div>
          <div className="col-span-12 lg:col-span-5">
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden h-full flex flex-col">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-bold text-sm text-slate-900">Equipo Asignado</h3>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white border border-slate-200 px-2 py-1 rounded shadow-sm">Impacto HH</span>
              </div>
              <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                {empleados.slice().sort((a, b) => b.costoHH - a.costoHH).map((e, i) => {
                  const m = Math.max(...empleados.map(o => o.costoHH), 1);
                  const w = Math.min((e.costoHH / m) * 100, 100);
                  const cs = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-indigo-500'];
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center text-slate-500 font-bold">{e.nombre.slice(0, 2)}</div>
                            <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 border-2 border-white rounded-full ${cs[i % 4]}`}></div>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{e.nombre}</p>
                            <p className="text-[10px] text-slate-400 uppercase font-medium">{e.cargo.slice(0, 25)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-slate-900">{money(e.costoHH / 1000)}k</p>
                          <p className="text-[9px] text-slate-400 uppercase">Cost HH: {money(e.costoHH)}</p>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                        <div className={`${cs[i % 4]} h-full rounded-full transition-all duration-700`} style={{ width: `${w}%` }}></div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}