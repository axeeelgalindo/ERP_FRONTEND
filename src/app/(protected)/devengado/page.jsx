// src/app/(protected)/devengado/page.jsx
"use client";

import React, { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

/**
 * ✅ DEVENGADO DETALLADO (1 PROYECTO) — UI “real” con gráficos (sin libs)
 * - Avance ponderado por subtareas (costo_plan || horas_plan || 1)
 * - Devengado $ = Venta base (neto) * Avance
 * - Costos reales = HH (desde costeo) + Compras (facturadas/total)
 * - Panel semanal: deltas de avance + devengado semanal (mock)
 *
 * Nota: aquí todo es mock dentro del archivo para que funcione “copiar/pegar”.
 * Cuando tengas endpoint real, reemplazas makeProjectDevengadoMock() por fetch.
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

/* ----------------------- mock “realista” ----------------------- */
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

  // Cotización + Venta (costeo)
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

  const empleados = Array.from({ length: 6 }).map((_, i) => ({
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

  // CIF (para que se sienta “ERP”)
  const cif = {
    valor: int(rng, 120_000, 420_000),
    anio,
    mes,
  };

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
      const avance = int(rng, 10, 95);
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
        estado: avance >= 100 ? "terminada" : avance >= 45 ? "en_progreso" : "pendiente",
        avance,
        fecha_inicio_plan: inicioPlan,
        fecha_fin_plan: finPlan,
        responsable_id: pick(rng, empleados).id,
      };
      tareas.push(tarea);

      const sN = int(rng, 2, 6);
      for (let s = 0; s < sN; s++) {
        const sId = cuidLike(rng);
        const horasPlan = int(rng, 6, 28);
        const detAv = clamp(avance + int(rng, -25, 25), 0, 100);

        const resp = rng() < 0.8 ? pick(rng, empleados) : null;
        const valorHora = resp ? resp.costoHH : null;

        const costoPlan = valorHora != null ? valorHora * horasPlan : null;
        const horasReal =
          detAv > 0
            ? Math.max(0, round0(horasPlan * (detAv / 100) + int(rng, -3, 6)))
            : null;
        const costoReal =
          valorHora != null && horasReal != null ? valorHora * horasReal : null;

        subtareas.push({
          id: sId,
          tarea_id: tId,
          titulo: pick(rng, ["DTO/Schema", "Tabla UI", "Validaciones", "Seeds", "Fix UX", "Tests"]),
          estado: detAv >= 100 ? "terminada" : detAv >= 45 ? "en_progreso" : "pendiente",
          avance: detAv,
          horas_plan: horasPlan,
          horas_real: horasReal,
          valor_hora: valorHora,
          costo_plan: costoPlan,
          costo_real: costoReal,
          responsable_id: resp?.id ?? null,
          fecha: addDays(monthStart, int(rng, 0, dim - 1)),
        });
      }
    }
  }

  // Venta (costeo) con líneas HH y COMPRA
  // (para que el costo real pueda salir de “detalleVenta”)
  const venta = {
    id: cuidLike(rng),
    numero: int(rng, 100, 999),
    descuentoPct: rng() < 0.3 ? int(rng, 2, 8) : 0,
    totalNeto: ventaBaseNeto,
    detalles: [],
  };

  // HH: derivar desde subtareas (más horas -> más peso)
  const hhLines = int(rng, 3, 6);
  for (let i = 0; i < hhLines; i++) {
    const emp = pick(rng, empleados);
    const cantHoras = int(rng, 12, 42);
    const alpha = int(rng, 8, 22);
    const alphaMult = 1 + alpha / 100;

    const costoSinAlpha = emp.costoHH * cantHoras + (cif.valor || 0) / hhLines;
    const costoTotal = costoSinAlpha * alphaMult;

    // venta = costo (tu lógica típica en costeo) menos descuentos
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

  // Compras: OC/Facturas + asignación a costeo (CompraCosteo)
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

    // asignación a costeo (monto asignado <= total)
    if (rng() < 0.65) {
      compraCosteos.push({
        id: cuidLike(rng),
        compra_id: compra.id,
        venta_id: venta.id,
        monto: round0(total * (0.5 + rng() * 0.5)),
        creado_en: addDays(compra.fecha, int(rng, 0, 7)),
      });
    }

    // si quieres que COMPRA aparezca también en venta.detalles (modo COMPRA)
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

  // aplicar descuento general a venta
  const multGeneral = 1 - Number(venta.descuentoPct || 0) / 100;
  for (const d of venta.detalles) {
    const bruto = Number(d.ventaTotalBruto || d.ventaTotal || 0);
    const neto = bruto * (1 - Number(d.descuentoPct || 0) / 100) * multGeneral;
    d.ventaTotal = neto;
  }

  // recalcular total neto desde líneas (más realista)
  venta.totalNeto = round0(venta.detalles.reduce((s, x) => s + Number(x.ventaTotal || 0), 0));

  // ---------- avance ponderado por subtareas ----------
  let wSum = 0;
  let wProg = 0;
  for (const st of subtareas) {
    const w = Number(st.costo_plan ?? 0) || Number(st.horas_plan ?? 0) || 1;
    const prog = clamp(Number(st.avance ?? 0), 0, 100) / 100;
    wSum += w;
    wProg += w * prog;
  }
  const avance = wSum > 0 ? wProg / wSum : 0;

  // venta base (neto): usa venta.totalNeto (tu costeo real)
  const ventaBase = Number(venta.totalNeto || 0);
  const devengadoMonto = ventaBase * avance;

  // costos reales
  const hhCostoReal = venta.detalles
    .filter((x) => x.modo === "HH")
    .reduce((s, x) => s + Number(x.costoTotal || 0), 0);

  const comprasFacturadas = compras
    .filter((c) => c.factura_url)
    .reduce((s, c) => s + Number(c.factura_monto || c.total || 0), 0);

  const comprasTotal = compras.reduce((s, c) => s + Number(c.total || 0), 0);

  const comprasAsignadas = compraCosteos.reduce((s, x) => s + Number(x.monto || 0), 0);

  const costoReal = hhCostoReal + comprasFacturadas;
  const utilidadDevengada = devengadoMonto - costoReal;

  // ---------- Semana pasada (mock) ----------
  // generamos 7 días con “delta avance” + costo + devengado día
  const hoy = new Date();
  const days = Array.from({ length: 7 }).map((_, i) => addDays(hoy, -6 + i));

  // “avance semanal” como delta total (pequeño)
  const deltaSemana = (2 + rng() * 10) / 100; // 2%..12%
  const avanceInicioSemana = clamp(avance - deltaSemana, 0, 1);

  const serieSemana = [];
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const avanceDia = avanceInicioSemana + (avance - avanceInicioSemana) * t;
    const devDia = ventaBase * (avanceDia - (i > 0 ? serieSemana[i - 1].avance : avanceInicioSemana));
    // costos del día (HH + compras puntuales)
    const costoHHdia = int(rng, 80_000, 320_000);
    const costoCompraDia = rng() < 0.25 ? int(rng, 50_000, 600_000) : 0;
    serieSemana.push({
      date: days[i],
      avance: avanceDia,
      delta_avance: i === 0 ? avanceDia - avanceInicioSemana : avanceDia - serieSemana[i - 1].avance,
      devengado: round0(Math.max(0, devDia)),
      costo_hh: costoHHdia,
      costo_compra: costoCompraDia,
    });
  }

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
      subtareas: (subtareasByTarea.get(t.id) || []).sort(
        (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime(),
      ),
    });
  }

  const epicasUI = epicas.map((e) => ({
    ...e,
    tareas: (tareasByEpica.get(e.id) || []).sort((a, b) => a.nombre.localeCompare(b.nombre)),
  }));

  // ---------- riesgo / alertas ----------
  const burnPct = ventaBase > 0 ? (costoReal / ventaBase) * 100 : 0;
  const riesgo =
    burnPct > 105
      ? { level: "critico", msg: "Costo real (facturado) supera la venta base. Riesgo alto de pérdida." }
      : burnPct > 85
        ? { level: "alto", msg: "Costo real está muy cerca de la venta base. Controla compras y HH." }
        : burnPct > 65
          ? { level: "medio", msg: "Costo real en zona media. Mantén control de compras asignadas." }
          : { level: "ok", msg: "Costo real controlado vs venta base." };

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
    resumen: {
      ventaBase,
      avancePct: avance * 100,
      devengadoMonto,
      costoReal,
      utilidadDevengada,
      hhCostoReal,
      comprasFacturadas,
      comprasTotal,
      comprasAsignadas,
      burnPct,
      riesgo,
    },
    semana: serieSemana,
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

function Sparkline({ data = [], valueKey = "devengado" }) {
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
  // items: [{label, value}]
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

  const [semanaMode, setSemanaMode] = useState("devengado"); // devengado | costo

  const data = useMemo(() => {
    return makeProjectDevengadoMock({
      seed: 20260302,
      anio: 2026,
      mes: 3,
      proyectoId,
    });
  }, [proyectoId]);

  const { proyecto, periodo, cotizacion, venta, empleados, cif, epicas, compras, compraCosteos, resumen, semana } = data;

  const riesgoTone =
    resumen.riesgo.level === "critico" ? "danger" : resumen.riesgo.level === "alto" ? "warn" : resumen.riesgo.level === "medio" ? "warn" : "ok";

  const estadoTone =
    proyecto.estado === "activo" ? "ok" : proyecto.estado === "en_riesgo" ? "warn" : "neutral";

  // Top insights “gerente”
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
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <Kpi title="Venta base (neto)" value={money(round0(resumen.ventaBase))} hint="Desde costeo (Venta.detalles neto)" />
        <Kpi title="Avance ponderado" value={pct1(resumen.avancePct)} hint="Subtareas ponderadas por costo/horas" />
        <Kpi title="Devengado $" value={money(round0(resumen.devengadoMonto))} hint="Venta base × avance" tone={resumen.devengadoMonto < 0 ? "danger" : "default"} />
        <Kpi title="Costo real (facturado)" value={money(round0(resumen.costoReal))} hint="HH + compras facturadas" tone={resumen.costoReal > resumen.ventaBase ? "danger" : "default"} />
        <Kpi title="Utilidad devengada" value={money(round0(resumen.utilidadDevengada))} hint={`Burn: ${pct1(resumen.burnPct)} (costo/venta)`} tone={resumen.utilidadDevengada < 0 ? "danger" : "ok"} />
      </div>

      {/* Top row: donut + breakdown */}
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
          title="Semana pasada"
          right={
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSemanaMode("devengado")}
                className={`rounded-lg px-2 py-1 text-xs font-semibold border ${
                  semanaMode === "devengado" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200"
                }`}
              >
                Devengado
              </button>
              <button
                onClick={() => setSemanaMode("costo")}
                className={`rounded-lg px-2 py-1 text-xs font-semibold border ${
                  semanaMode === "costo" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200"
                }`}
              >
                Costos
              </button>
            </div>
          }
        >
          <div className="flex flex-col gap-3">
            <Sparkline data={semana} valueKey={semanaMode === "devengado" ? "devengado" : "costo_hh"} />
            <div className="grid grid-cols-2 gap-2">
              <Kpi
                title="Devengado semana"
                value={money(semana.reduce((s, x) => s + Number(x.devengado || 0), 0))}
                hint="Suma últimos 7 días"
              />
              <Kpi
                title="Delta avance semana"
                value={pct1(
                  (semana[semana.length - 1].avance - (semana[0].avance - semana[0].delta_avance)) * 100,
                )}
                hint="Crecimiento de avance"
              />
            </div>
            <div className="mt-1">
              <Table
                cols={["Día", "Δ avance", "Devengado", "Costo HH", "Costo compras"]}
                rows={semana.map((d) => [
                  <span key="d" className="text-slate-700">{fmtDate(d.date)}</span>,
                  <span key="a" className="font-semibold text-slate-900">{pct1(d.delta_avance * 100)}</span>,
                  <span key="v" className="font-semibold text-slate-900">{money(d.devengado)}</span>,
                  <span key="h" className="text-slate-700">{money(d.costo_hh)}</span>,
                  <span key="c" className="text-slate-700">{money(d.costo_compra)}</span>,
                ])}
              />
            </div>
          </div>
        </Section>
      </div>

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
            <Kpi title="Total neto (líneas)" value={money(venta.totalNeto)} hint={`Descuento general: ${Number(venta.descuentoPct||0)}%`} />
            <Kpi title="HH (costo)" value={money(resumen.hhCostoReal)} />
            <Kpi title="Compras asignadas" value={money(resumen.comprasAsignadas)} hint="CompraCosteo hacia esta venta" />
          </div>

          <div className="mt-4">
            <div className="text-sm font-semibold text-slate-900 mb-2">Líneas del costeo</div>
            <Table
              cols={["Modo", "Descripción", "Venta neto", "Costo", "Alpha", "Desc."]}
              rows={venta.detalles
                .slice()
                .sort((a, b) => String(a.modo).localeCompare(String(b.modo)))
                .map((x) => [
                  <Pill key="m" tone={x.modo === "HH" ? "neutral" : "warn"}>{x.modo}</Pill>,
                  <div key="d" className="text-slate-700">
                    <div className="font-medium text-slate-900">{x.descripcion}</div>
                    {x.modo === "HH" ? (
                      <div className="text-xs text-slate-500">Empleado: {empleados.find((e) => e.id === x.empleadoId)?.nombre || "-"}</div>
                    ) : (
                      <div className="text-xs text-slate-500">Compra: {String(x.compraId || "").slice(0, 6)}…</div>
                    )}
                  </div>,
                  <span key="v" className="font-semibold text-slate-900">{money(x.ventaTotal)}</span>,
                  <span key="c" className="text-slate-700">{money(x.costoTotal)}</span>,
                  <span key="a" className="text-slate-700">{x.alpha != null ? `${x.alpha}%` : "-"}</span>,
                  <span key="p" className="text-slate-700">{x.descuentoPct ? `${x.descuentoPct}%` : "-"}</span>,
                ])}
              empty="Sin líneas"
            />
          </div>
        </Section>
      </div>

      {/* Ejecución: épicas/tareas/subtareas (detalle) */}
      <Section
        title="Ejecución · Épicas / Tareas / Subtareas"
        right={<Pill tone="neutral">Ponderación: costo_plan → horas_plan → 1</Pill>}
      >
        <div className="space-y-4">
          {epicas.map((ep) => (
            <EpicaCard key={ep.id} epica={ep} empleados={empleados} />
          ))}
        </div>
      </Section>

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

          <div className="mt-4">
            <div className="text-sm font-semibold text-slate-900 mb-2">Control rápido</div>
            <Bars
              items={[
                { label: "Compras totales (OC)", value: resumen.comprasTotal },
                { label: "Compras asignadas a costeo", value: resumen.comprasAsignadas },
                { label: "Compras facturadas", value: resumen.comprasFacturadas },
              ]}
            />
          </div>
        </Section>
      </div>

      {/* RRHH: costoHH + CIF */}
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
          Esta tabla es para “sensación real”: cuando lo conectes, saldrá desde HHEmpleado (Excel) y sus cálculos.
        </div>
      </Section>

      <div className="pb-10" />
    </div>
  );
}

/* ----------------------- epica card ----------------------- */
function EpicaCard({ epica, empleados }) {
  const [open, setOpen] = useState(true);

  // métricas epica (desde subtareas)
  const subt = epica.tareas.flatMap((t) => t.subtareas || []);
  const done = subt.filter((s) => s.avance >= 100).length;
  const total = subt.length || 1;
  const pct = (done / total) * 100;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <button
        onClick={() => setOpen((s) => !s)}
        className="w-full flex items-start justify-between gap-3 p-4 text-left"
      >
        <div>
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-slate-900">{epica.nombre}</div>
            <Pill tone={epica.estado === "bloqueada" ? "danger" : epica.estado === "en_progreso" ? "warn" : epica.estado === "terminada" ? "ok" : "neutral"}>
              {epica.estado}
            </Pill>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Subtareas: {done}/{total} · Progreso: {pct1(pct)}
          </div>
        </div>

        <div className="shrink-0">
          <div className="text-xs text-slate-500 mb-1">{open ? "Ocultar" : "Ver"}</div>
          <div className="h-2 w-24 rounded-full bg-slate-200">
            <div className="h-2 rounded-full bg-slate-900" style={{ width: `${clamp(pct, 0, 100)}%` }} />
          </div>
        </div>
      </button>

      {open ? (
        <div className="border-t border-slate-100 p-4 space-y-3">
          {epica.tareas.map((t) => (
            <div key={t.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <div className="font-semibold text-slate-900">{t.nombre}</div>
                  <div className="text-xs text-slate-500">
                    Estado: {t.estado} · Avance: {t.avance}% · Responsable:{" "}
                    <span className="font-semibold text-slate-700">
                      {empleados.find((e) => e.id === t.responsable_id)?.nombre || "—"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Pill tone={t.avance >= 100 ? "ok" : t.avance >= 45 ? "warn" : "neutral"}>{t.avance}%</Pill>
                  <div className="h-2 w-28 rounded-full bg-slate-200">
                    <div className="h-2 rounded-full bg-slate-900" style={{ width: `${clamp(t.avance, 0, 100)}%` }} />
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <div className="text-xs font-semibold text-slate-600 mb-2">Subtareas</div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="text-left text-slate-500">
                      <tr>
                        <th className="py-2 pr-3 font-medium">Subtarea</th>
                        <th className="py-2 pr-3 font-medium">Estado</th>
                        <th className="py-2 pr-3 font-medium">Avance</th>
                        <th className="py-2 pr-3 font-medium">Horas plan</th>
                        <th className="py-2 pr-3 font-medium">Costo plan</th>
                        <th className="py-2 pr-3 font-medium">Horas real</th>
                        <th className="py-2 pr-3 font-medium">Costo real</th>
                        <th className="py-2 pr-3 font-medium">Resp.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(t.subtareas || []).length ? (
                        t.subtareas.map((s) => (
                          <tr key={s.id} className="border-t border-slate-100">
                            <td className="py-2 pr-3">
                              <div className="font-medium text-slate-900">{s.titulo}</div>
                              <div className="text-xs text-slate-500">{fmtDate(s.fecha)}</div>
                            </td>
                            <td className="py-2 pr-3">
                              <Pill tone={s.estado === "en_progreso" ? "warn" : s.estado === "terminada" ? "ok" : "neutral"}>
                                {s.estado}
                              </Pill>
                            </td>
                            <td className="py-2 pr-3">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-900">{s.avance}%</span>
                                <div className="h-2 w-20 rounded-full bg-slate-200">
                                  <div className="h-2 rounded-full bg-slate-900" style={{ width: `${clamp(s.avance, 0, 100)}%` }} />
                                </div>
                              </div>
                            </td>
                            <td className="py-2 pr-3 text-slate-700">{s.horas_plan ?? "—"}</td>
                            <td className="py-2 pr-3 text-slate-700">{s.costo_plan != null ? money(s.costo_plan) : "—"}</td>
                            <td className="py-2 pr-3 text-slate-700">{s.horas_real ?? "—"}</td>
                            <td className="py-2 pr-3 text-slate-700">{s.costo_real != null ? money(s.costo_real) : "—"}</td>
                            <td className="py-2 pr-3 text-slate-700">
                              {s.responsable_id ? empleados.find((e) => e.id === s.responsable_id)?.nombre || "—" : "—"}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr className="border-t border-slate-100">
                          <td className="py-3 text-slate-500" colSpan={8}>
                            Sin subtareas
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                  <MiniStat label="Subtareas listas" value={`${(t.subtareas || []).filter((x) => x.avance >= 100).length}`} />
                  <MiniStat label="Subtareas pendientes" value={`${(t.subtareas || []).filter((x) => x.avance < 100).length}`} />
                  <MiniStat
                    label="Costo real subtareas (info)"
                    value={money(
                      (t.subtareas || []).reduce((s, x) => s + Number(x.costo_real || 0), 0),
                    )}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3 bg-white">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-sm font-semibold text-slate-900 mt-1">{value}</div>
    </div>
  );
}