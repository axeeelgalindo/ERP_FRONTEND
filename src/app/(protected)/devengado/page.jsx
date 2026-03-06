// src/app/(protected)/devengado/page.jsx
"use client";

import React, { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
                Devengado · {proyecto.nombre}
              </h1>
              <Pill tone={estadoTone}>{proyecto.estado}</Pill>
            </div>
            <div className="mt-1 text-sm text-slate-600">
              Periodo: <span className="font-semibold">{periodo.mes}/{periodo.anio}</span> ·
              Plan: <span className="font-semibold">{fmtDate(proyecto.fecha_inicio_plan)} → {fmtDate(proyecto.fecha_fin_plan)}</span> ·
              Presupuesto: <span className="font-semibold">{money(proyecto.presupuesto)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`/devengado?proyectoId=${proyecto.id}`}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            >
              Link directo
            </a>
            <button
              onClick={() => location.reload()}
              className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:opacity-95"
            >
              Refrescar mock
            </button>
          </div>
        </div>

        <div className={`rounded-2xl border p-4 ${riesgoTone === "danger" ? "border-red-200 bg-red-50" : riesgoTone === "warn" ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div className="text-sm font-semibold text-slate-900">Estado financiero</div>
            <div className="text-sm text-slate-700">{resumen.riesgo.msg}</div>
          </div>
        </div>

        {/* BARRAS DE PROGRESO INYECTADAS */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Venta (Lo que se va a ganar)</div>
              <div className="font-semibold text-slate-900">{money(resumen.ventaBase)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Costo Total Estimado</div>
              <div className="font-semibold text-slate-900">{money(resumen.costoReal)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Ganancia Esperada</div>
              <div className="font-semibold text-slate-900">{money(resumen.ventaBase - resumen.costoReal)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-semibold text-slate-700">Avance General</span>
                <span className="text-sm font-bold text-slate-900">{pct1(resumen.avancePct)}</span>
              </div>
              <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-slate-900 rounded-full transition-all duration-500" style={{ width: `${resumen.avancePct}%` }}></div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Ingreso Dev.</div>
                  <div className="font-semibold">{money(resumen.devengadoMonto)}</div>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Costo Dev.</div>
                  <div className="font-semibold">{money(resumen.costoReal * (resumen.avancePct / 100))}</div>
                </div>
                <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                  <div className="text-[10px] text-emerald-600 uppercase font-bold tracking-wider">Ganancia Dev.</div>
                  <div className="font-semibold text-emerald-700">{money(resumen.gananciaPos)}</div>
                </div>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-semibold text-slate-700">Avance Esta Semana</span>
                <span className="text-sm font-bold text-slate-900">+{pct1(repThisMux.deltaWeekPct)}</span>
              </div>
              <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
                <div className="h-full bg-slate-300 transition-all duration-500" style={{ width: `${resumen.avancePct - repThisMux.deltaWeekPct}%`, borderRight: repThisMux.deltaWeekPct > 0 ? '2px solid white' : 'none' }}></div>
                <div className="h-full bg-emerald-500 relative transition-all duration-500" style={{ width: `${repThisMux.deltaWeekPct}%` }}>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Ingreso Sem.</div>
                  <div className="font-semibold">{money(repThisMux.ingresoSemana)}</div>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Costo Sem.</div>
                  <div className="font-semibold">{money(repThisMux.costoSemana)}</div>
                </div>
                <div className={`${repThisMux.gananciaSemanaPos > 0 ? "bg-emerald-50 border-emerald-100" : "bg-slate-50 border-slate-100"} p-2 rounded-lg border`}>
                  <div className={`text-[10px] uppercase font-bold tracking-wider ${repThisMux.gananciaSemanaPos > 0 ? "text-emerald-600" : "text-slate-500"}`}>Ganancia Sem.</div>
                  <div className={`font-semibold ${repThisMux.gananciaSemanaPos > 0 ? "text-emerald-700" : "text-slate-700"}`}>
                    {money(repThisMux.gananciaSemanaPos)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs (sin negativos) */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <Kpi title="Venta base (neto)" value={money(round0(resumen.ventaBase))} hint="Desde costeo (Venta.detalles neto)" />
        <Kpi title="Avance ponderado" value={pct1(resumen.avancePct)} hint="Subtareas ponderadas por costo/horas" />
        <Kpi title="Devengado $" value={money(round0(resumen.devengadoMonto))} hint="Venta base × avance" />
        <Kpi title="Costo real (facturado)" value={money(round0(resumen.costoReal))} hint="HH + compras facturadas" />
        <Kpi
          title="Ganancia (solo positivos)"
          value={money(round0(resumen.gananciaPos))}
          hint={`Si era negativo, aquí se muestra 0`}
          tone={resumen.gananciaPos > 0 ? "ok" : "warn"}
        />
      </div>

      {/* Top row: donut + breakdown + Ganancia semanal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Section
          title="Progreso"
          right={<Pill tone="neutral">{stTerminadas} listas · {stPendientes} pendientes</Pill>}
        >
          <Donut valuePct={resumen.avancePct} subtitle="avance" big />
        </Section>

        <Section
          title="Breakdown de costos"
          right={<Pill tone={resumen.comprasFacturadas > 0 ? "ok" : "warn"}>{comprasFact} fact. · {comprasSinFactura} sin fact.</Pill>}
        >
          <Bars
            items={[
              { label: "HH (costo real)", value: resumen.hhCostoReal },
              { label: "Compras facturadas", value: resumen.comprasFacturadas },
              { label: "Compras no facturadas (info)", value: Math.max(0, resumen.comprasTotal - resumen.comprasFacturadas) },
            ]}
          />
          <div className="mt-3 text-xs text-slate-500">
            Nota: costo real usa compras facturadas. Total compras se muestra para control (OC).
          </div>
        </Section>

        <Section
          title="Ganancia por semana"
          right={
            <div className="flex items-center gap-2">
              <button
                onClick={() => setWeekTab("last")}
                className={`rounded-lg px-2 py-1 text-xs font-semibold border ${weekTab === "last" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200"
                  }`}
              >
                Semana pasada
              </button>
              <button
                onClick={() => setWeekTab("this")}
                className={`rounded-lg px-2 py-1 text-xs font-semibold border ${weekTab === "this" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200"
                  }`}
              >
                Esta semana
              </button>
              <button
                onClick={() => setWeekTab("next")}
                className={`rounded-lg px-2 py-1 text-xs font-semibold border ${weekTab === "next" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200"
                  }`}
              >
                Próxima
              </button>
            </div>
          }
        >
          <div className="flex flex-col gap-3">
            <Sparkline data={active.daily} valueKey="ganancia" />
            <div className="grid grid-cols-2 gap-2">
              <Kpi title="Ingreso devengado" value={money(round0(active.ingresoSemana))} hint={`${active.week.label}`} />
              <Kpi title="Ganancia (solo positivos)" value={money(round0(active.gananciaSemanaPos))} hint={`Δ avance: ${pct1(active.deltaWeekPct)}`} tone={active.gananciaSemanaPos > 0 ? "ok" : "warn"} />
            </div>
            <Table
              cols={["Día", "Ingreso", "Costo", "Ganancia"]}
              rows={active.daily.map((d) => [
                <span key="d" className="text-slate-700">{fmtDate(d.date)}</span>,
                <span key="i" className="font-semibold text-slate-900">{money(round0(d.ingreso))}</span>,
                <span key="c" className="text-slate-700">{money(round0(d.costo))}</span>,
                <span key="g" className="font-semibold text-slate-900">{money(round0(d.ganancia))}</span>,
              ])}
            />
          </div>
        </Section>
      </div>

      {/* NUEVO: Breakdown por jerarquía (épicas/tareas/subtareas) */}
      <Section
        title={`Detalle de ganancias · ${active.week.label}`}
        right={<Pill tone="neutral">Todo se muestra en positivo (si era negativo → 0)</Pill>}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-slate-200 p-3">
            <div className="text-sm font-semibold text-slate-900 mb-2">Épicas</div>
            <Table
              cols={["Épica", "Ingreso", "Ganancia"]}
              rows={active.epicasRows.slice(0, 12).map((x) => [
                <span key="n" className="text-slate-700">{x.nombre}</span>,
                <span key="i" className="text-slate-700">{money(round0(x.ingreso))}</span>,
                <span key="g" className="font-semibold text-slate-900">{money(round0(x.ganancia))}</span>,
              ])}
              empty="Sin movimiento esta semana"
            />
          </div>

          <div className="rounded-2xl border border-slate-200 p-3">
            <div className="text-sm font-semibold text-slate-900 mb-2">Tareas</div>
            <Table
              cols={["Tarea", "Ingreso", "Ganancia"]}
              rows={active.tareasRows.slice(0, 12).map((x) => [
                <div key="n" className="text-slate-700">
                  <div className="font-medium text-slate-900">{x.nombre}</div>
                  <div className="text-xs text-slate-500">{x.epicaNombre}</div>
                </div>,
                <span key="i" className="text-slate-700">{money(round0(x.ingreso))}</span>,
                <span key="g" className="font-semibold text-slate-900">{money(round0(x.ganancia))}</span>,
              ])}
              empty="Sin movimiento esta semana"
            />
          </div>

          <div className="rounded-2xl border border-slate-200 p-3">
            <div className="text-sm font-semibold text-slate-900 mb-2">Subtareas</div>
            <Table
              cols={["Subtarea", "Ingreso", "Ganancia"]}
              rows={active.subtRows.slice(0, 12).map((x) => [
                <div key="n" className="text-slate-700">
                  <div className="font-medium text-slate-900">{x.nombre}</div>
                  <div className="text-xs text-slate-500">{x.tareaNombre}</div>
                </div>,
                <span key="i" className="text-slate-700">{money(round0(x.ingreso))}</span>,
                <span key="g" className="font-semibold text-slate-900">{money(round0(x.ganancia))}</span>,
              ])}
              empty="Sin movimiento esta semana"
            />
          </div>
        </div>

        <div className="mt-3 text-xs text-slate-500">
          * “Ingreso” viene del delta de avance (semana) × venta base. “Ganancia” = max(0, ingreso − costo estimado del periodo).
          Cuando conectes a tu backend, aquí reemplazamos el costo estimado por costo real por fecha (HH y compras por día).
        </div>
      </Section>

      {/* Comercial: cotización + venta */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Section
          title="Contrato / Cotización"
          right={<Pill tone="neutral">#{cotizacion.numero} · {cotizacion.estado}</Pill>}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Kpi title="Subtotal (neto)" value={money(cotizacion.subtotal)} />
            <Kpi title="IVA" value={money(cotizacion.iva)} />
            <Kpi title="Total" value={money(cotizacion.total)} />
          </div>
          <div className="mt-3 text-sm text-slate-600">
            Fecha documento: <span className="font-semibold">{fmtDate(cotizacion.fecha)}</span>
          </div>
        </Section>

        <Section
          title="Costeo / Venta asociada"
          right={<Pill tone="neutral">Venta #{venta.numero}</Pill>}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Kpi title="Total neto (líneas)" value={money(venta.totalNeto)} hint={`Descuento general: ${Number(venta.descuentoPct || 0)}%`} />
            <Kpi title="HH (costo)" value={money(resumen.hhCostoReal)} />
            <Kpi title="Compras asignadas" value={money(resumen.comprasAsignadas)} hint="CompraCosteo hacia esta venta" />
          </div>
        </Section>
      </div>

      {/* Compras + facturas + asignación */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Section
          title="Compras del proyecto"
          right={<Pill tone={comprasSinFactura ? "warn" : "ok"}>{comprasFact} con factura · {comprasSinFactura} sin factura</Pill>}
        >
          <Table
            cols={["OC", "Estado", "Proveedor", "Fecha", "Total", "Factura"]}
            rows={compras
              .slice()
              .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
              .map((c) => [
                <span key="n" className="font-semibold text-slate-900">#{c.numero}</span>,
                <Pill key="s" tone={c.estado === "ORDEN_COMPRA" ? "warn" : "ok"}>{c.estado}</Pill>,
                <span key="p" className="text-slate-700">{c.proveedor}</span>,
                <span key="f" className="text-slate-700">{fmtDate(c.fecha)}</span>,
                <span key="t" className="font-semibold text-slate-900">{money(c.total)}</span>,
                c.factura_url ? <Pill key="x" tone="ok">✅</Pill> : <Pill key="x" tone="warn">—</Pill>,
              ])}
            empty="Aún no hay compras"
          />
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
            <Kpi title="Total compras (OC)" value={money(resumen.comprasTotal)} />
            <Kpi title="Facturado" value={money(resumen.comprasFacturadas)} />
            <Kpi title="No facturado (info)" value={money(Math.max(0, resumen.comprasTotal - resumen.comprasFacturadas))} />
          </div>
        </Section>

        <Section
          title="Asignación de compras a costeo (CompraCosteo)"
          right={<Pill tone={resumen.comprasAsignadas > 0 ? "ok" : "warn"}>{money(resumen.comprasAsignadas)}</Pill>}
        >
          <Table
            cols={["Compra", "Venta", "Monto", "Fecha"]}
            rows={compraCosteos
              .slice()
              .sort((a, b) => new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime())
              .map((x) => [
                <span key="c" className="text-slate-700">{x.compra_id.slice(0, 8)}…</span>,
                <span key="v" className="text-slate-700">{x.venta_id.slice(0, 8)}…</span>,
                <span key="m" className="font-semibold text-slate-900">{money(x.monto)}</span>,
                <span key="f" className="text-slate-700">{fmtDate(x.creado_en)}</span>,
              ])}
            empty="Aún no hay asignaciones"
          />
        </Section>
      </div>

      {/* RRHH */}
      <Section
        title="RRHH · Empleados / Costo HH / CIF"
        right={<Pill tone="neutral">CIF {periodo.mes}/{periodo.anio}: {money(cif.valor)}</Pill>}
      >
        <Table
          cols={["Empleado", "Cargo", "Costo HH", "Estimación mensual (150h)"]}
          rows={empleados
            .slice()
            .sort((a, b) => b.costoHH - a.costoHH)
            .map((e) => [
              <span key="n" className="font-semibold text-slate-900">{e.nombre}</span>,
              <span key="c" className="text-slate-700">{e.cargo}</span>,
              <span key="h" className="font-semibold text-slate-900">{money(e.costoHH)}</span>,
              <span key="m" className="text-slate-700">{money(e.costoHH * 150)}</span>,
            ])}
        />
        <div className="mt-3 text-xs text-slate-500">
          En real: aquí saldrá desde HH (periodos) + CIF mensual real. Este mock es “sensación”.
        </div>
      </Section>

      <div className="pb-10" />
    </div>
  );
}