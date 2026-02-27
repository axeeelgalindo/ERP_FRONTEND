"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * ====== CONFIG ======
 */
const DEFAULT_CELL = 40;
const MIN_CELL = 6;
const MAX_CELL = 90;

const DEFAULT_HEIGHT_PX = 720;

/**
 * ====== FECHAS (local) ======
 */
function startOfLocalDay(date) {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseDateSafe(d) {
  if (!d) return null;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return startOfLocalDay(dt);
}

function diffDays(a, b) {
  const A = startOfLocalDay(a).getTime();
  const B = startOfLocalDay(b).getTime();
  return Math.round((B - A) / (1000 * 60 * 60 * 24));
}

function clampPct(v) {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function fmtMonth(date) {
  return date.toLocaleDateString("es-CL", { month: "long", year: "numeric" });
}
function fmtDay(date) {
  return date.getDate();
}

// ==== Normalizadores
function getEpicaId(t) {
  return t?.epica_id || t?.epicaId || t?.epica?.id || null;
}
function getEpicaNombre(t) {
  return t?.epica?.nombre || t?.epica?.name || null;
}
function getResponsableLabel(t) {
  return (
    t?.responsable?.usuario?.nombre ||
    t?.responsable?.nombre ||
    t?.responsable?.id ||
    t?.responsable_id ||
    "Sin responsable"
  );
}
function getSubtareasFromTarea(t) {
  const arr = t?.detalles || t?.detalle || t?.tareasDetalle || [];
  return Array.isArray(arr) ? arr : [];
}
function getNombre(item) {
  return item?.nombre || item?.titulo || "Sin nombre";
}
function getEstado(item) {
  return item?.estado || "pendiente";
}
function getStartPlan(item) {
  return parseDateSafe(item?.fecha_inicio_plan || item?.fechaInicioPlan);
}
function getEndPlan(item) {
  return (
    parseDateSafe(item?.fecha_fin_plan || item?.fechaFinPlan) ||
    getStartPlan(item)
  );
}

function buildMonthSegments(days) {
  if (!days.length) return [];
  const segs = [];
  let curKey = `${days[0].getFullYear()}-${days[0].getMonth()}`;
  let startIdx = 0;

  for (let i = 1; i < days.length; i++) {
    const k = `${days[i].getFullYear()}-${days[i].getMonth()}`;
    if (k !== curKey) {
      segs.push({
        key: curKey,
        label: fmtMonth(days[i - 1]),
        startIdx,
        len: i - startIdx,
      });
      curKey = k;
      startIdx = i;
    }
  }

  segs.push({
    key: curKey,
    label: fmtMonth(days[days.length - 1]),
    startIdx,
    len: days.length - startIdx,
  });

  return segs;
}

/**
 * ✅ % tarea desde subtareas (si tiene)
 */
function calcTaskPct(taskAvance, subtareas) {
  const subs = Array.isArray(subtareas) ? subtareas : [];
  if (!subs.length) return clampPct(taskAvance);
  const avg =
    subs.reduce((s, x) => s + clampPct(x?.__avance ?? x?.avance), 0) /
    subs.length;
  return Math.round(avg);
}

/**
 * ✅ % épica desde tareas (tareas ya calculadas por subtareas)
 */
function calcEpicPct(tasks) {
  const arr = Array.isArray(tasks) ? tasks : [];
  if (!arr.length) return 0;
  const avg = arr.reduce((s, t) => s + clampPct(t?.__avance), 0) / arr.length;
  return Math.round(avg);
}

export default function GanttChart({
  tareas = [],
  heightPx = DEFAULT_HEIGHT_PX,
}) {
  const [cellWidth, setCellWidth] = useState(DEFAULT_CELL);

  // refs scroll
  const leftBodyRef = useRef(null);
  const headerXRef = useRef(null);
  const bodyXRef = useRef(null);
  const rightBodyYRef = useRef(null);

  // ✅ siempre expandido
  const expandedEpicsAlways = true;
  const expandedTasksAlways = true;

  const model = useMemo(() => {
    const tasksArr = Array.isArray(tareas) ? tareas : [];
    const noEpicKey = "SIN_EPICA";
    const epMap = new Map();

    function ensureEpic(id, nombre) {
      if (!epMap.has(id)) epMap.set(id, { id, nombre, tareas: [] });
      return epMap.get(id);
    }

    for (const t of tasksArr) {
      const start = getStartPlan(t);
      const end = getEndPlan(t);
      if (!start || !end) continue;

      const eid = getEpicaId(t) || noEpicKey;
      const enombre =
        getEpicaNombre(t) || (eid === noEpicKey ? "Sin agrupar" : "Épica");
      const epic = ensureEpic(eid, enombre);

      const subtareasRaw = getSubtareasFromTarea(t);

      // ⚠️ keys únicas subtareas:
      // - si s.id existe, la usamos
      // - si no existe, usamos índice (estable dentro de esa tarea)
      const subtareas = subtareasRaw
        .map((s, idx) => {
          const sStart = getStartPlan(s);
          const sEnd = getEndPlan(s);
          if (!sStart || !sEnd) return null;

          const subId = s?.id ? String(s.id) : `IDX:${idx}`;
          const taskId = String(t?.id ?? "");

          return {
            ...s,
            __tipo: "SUBTAREA",
            __tareaId: taskId,
            __epicaId: eid,
            __start: sStart,
            __end: sEnd,
            __avance: clampPct(s?.avance),
            __estado: getEstado(s),
            __nombre: getNombre(s),
            __responsable: getResponsableLabel(s),
            __key: `SUB:${taskId}:${subId}`, // ✅ KEY ÚNICA
          };
        })
        .filter(Boolean);

      const taskId = String(t?.id ?? "");
      const tareaPct = calcTaskPct(t?.avance, subtareas);

      epic.tareas.push({
        ...t,
        __tipo: "TAREA",
        __epicaId: eid,
        __start: start,
        __end: end,
        __avance: tareaPct,
        __estado: getEstado(t),
        __nombre: getNombre(t),
        __responsable: getResponsableLabel(t),
        __subtareas: subtareas,
        __key: `TAREA:${taskId}`, // ✅ KEY ÚNICA
      });
    }

    if (epMap.size === 0) {
      return {
        epics: [],
        rows: [],
        days: [],
        minDate: null,
        maxDate: null,
        monthSegments: [],
        todayIdx: null,
      };
    }

    const epics = Array.from(epMap.values()).sort((a, b) => {
      if (a.id === noEpicKey) return 1;
      if (b.id === noEpicKey) return -1;
      return String(a.nombre || "").localeCompare(String(b.nombre || ""), "es");
    });

    for (const e of epics) {
      e.tareas.sort((a, b) =>
        String(a.__nombre || "").localeCompare(String(b.__nombre || ""), "es"),
      );
      for (const t of e.tareas) {
        t.__subtareas.sort((a, b) =>
          String(a.__nombre || "").localeCompare(
            String(b.__nombre || ""),
            "es",
          ),
        );
      }
    }

    let gMin = null;
    let gMax = null;

    for (const e of epics) {
      let eMin = null;
      let eMax = null;

      let tareasCount = 0;
      let subtCount = 0;

      for (const t of e.tareas) {
        tareasCount += 1;
        subtCount += t.__subtareas.length;

        if (!eMin || t.__start < eMin) eMin = t.__start;
        if (!eMax || t.__end > eMax) eMax = t.__end;

        for (const s of t.__subtareas) {
          if (!eMin || s.__start < eMin) eMin = s.__start;
          if (!eMax || s.__end > eMax) eMax = s.__end;
        }
      }

      if (!eMin || !eMax) continue;

      e.__start = eMin;
      e.__end = eMax;
      e.__avance = calcEpicPct(e.tareas);
      e.__tareasCount = tareasCount;
      e.__subtCount = subtCount;
      e.__key = `EPICA:${String(e.id)}`; // ✅ KEY ÚNICA

      if (!gMin || eMin < gMin) gMin = eMin;
      if (!gMax || eMax > gMax) gMax = eMax;
    }

    if (!gMin || !gMax) {
      return {
        epics: [],
        rows: [],
        days: [],
        minDate: null,
        maxDate: null,
        monthSegments: [],
        todayIdx: null,
      };
    }

    const minDate = startOfLocalDay(gMin);
    const maxDate = startOfLocalDay(gMax);

    const days = [];
    for (let d = new Date(minDate); d <= maxDate; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }

    const monthSegments = buildMonthSegments(days);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayIdx =
      today >= minDate && today <= maxDate ? diffDays(minDate, today) : null;

    // ✅ rows SIEMPRE EXPANDIDO
    const rows = [];
    for (const e of epics) {
      rows.push({
        __tipo: "EPICA",
        id: `EPICA:${e.id}`,
        __epicaId: e.id,
        __nombre: e.nombre,
        __start: e.__start,
        __end: e.__end,
        __avance: clampPct(e.__avance),
        __tareasCount: e.__tareasCount,
        __subtCount: e.__subtCount,
        __key: e.__key,
      });

      if (!expandedEpicsAlways) continue;

      for (const t of e.tareas) {
        rows.push(t);

        if (!expandedTasksAlways) continue;
        for (const s of t.__subtareas) rows.push(s);
      }
    }

    return { epics, rows, days, minDate, maxDate, monthSegments, todayIdx };
  }, [tareas]);

  // ===== Scroll sync Y
  useEffect(() => {
    const L = leftBodyRef.current;
    const R = rightBodyYRef.current;
    if (!L || !R) return;

    let lock = false;

    const onL = () => {
      if (lock) return;
      lock = true;
      R.scrollTop = L.scrollTop;
      lock = false;
    };

    const onR = () => {
      if (lock) return;
      lock = true;
      L.scrollTop = R.scrollTop;
      lock = false;
    };

    L.addEventListener("scroll", onL);
    R.addEventListener("scroll", onR);

    return () => {
      L.removeEventListener("scroll", onL);
      R.removeEventListener("scroll", onR);
    };
  }, []);

  // ===== Scroll sync X (header <-> body)
  useEffect(() => {
    const H = headerXRef.current;
    const B = bodyXRef.current;
    if (!H || !B) return;

    let lock = false;

    const onH = () => {
      if (lock) return;
      lock = true;
      B.scrollLeft = H.scrollLeft;
      lock = false;
    };

    const onB = () => {
      if (lock) return;
      lock = true;
      H.scrollLeft = B.scrollLeft;
      lock = false;
    };

    H.addEventListener("scroll", onH);
    B.addEventListener("scroll", onB);

    return () => {
      H.removeEventListener("scroll", onH);
      B.removeEventListener("scroll", onB);
    };
  }, []);

  // re-sync al cambiar zoom
  useEffect(() => {
    const H = headerXRef.current;
    const B = bodyXRef.current;
    if (!H || !B) return;
    H.scrollLeft = B.scrollLeft;
  }, [cellWidth]);

  if (!model.rows.length || !model.days.length) {
    return (
      <p className="mt-3 text-xs text-slate-500">
        Aún no hay fechas planificadas suficientes para mostrar el cronograma.
      </p>
    );
  }

  const totalWidth = model.days.length * cellWidth;

  const zoomOut = () => setCellWidth((w) => Math.max(MIN_CELL, w - 4));
  const zoomIn = () => setCellWidth((w) => Math.min(MAX_CELL, w + 4));

  const fitToScreen = () => {
    const viewport = bodyXRef.current?.clientWidth || 900;
    const target = Math.floor(viewport / Math.max(1, model.days.length));
    setCellWidth(Math.max(MIN_CELL, Math.min(MAX_CELL, target)));
  };

  const rowH = (row) => (row.__tipo === "SUBTAREA" ? 40 : 48);

  const getBarLeftWidth = (row) => {
    const startOffset = diffDays(model.minDate, row.__start);
    const endOffset = diffDays(model.minDate, row.__end);
    const len = Math.max(1, endOffset - startOffset + 1);
    return { left: startOffset * cellWidth, width: len * cellWidth };
  };

  const barColor = (estado, avance) => {
    const a = clampPct(avance);
    if (a >= 100 || estado === "completada") return "bg-emerald-500";
    if (estado === "en_progreso" || (a > 0 && a < 100)) return "bg-blue-500";
    return "bg-slate-300 dark:bg-slate-600";
  };

  return (
    <div className="w-full">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Cronograma del proyecto
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Jerarquía 3 niveles: Épica → Tarea → Subtarea (siempre expandido)
            </p>
          </div>
        </div>

        {/* Header */}
        <div className="flex overflow-hidden border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="w-[320px] min-w-[320px] px-4 py-3 text-sm font-semibold border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
            Épica / Tarea / Subtarea
          </div>

          <div ref={headerXRef} className="flex-1 overflow-x-auto">
            <div className="min-w-max" style={{ width: totalWidth }}>
              <div className="flex border-b border-slate-200 dark:border-slate-700">
                {model.monthSegments.map((m) => (
                  <div
                    key={m.key}
                    className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    style={{ width: m.len * cellWidth }}
                  >
                    {m.label}
                  </div>
                ))}
              </div>

              <div className="flex bg-slate-50 dark:bg-slate-800">
                {model.days.map((d, idx) => (
                  <div
                    key={idx}
                    className="text-center py-1 text-[10px] font-medium text-slate-400 border-r border-slate-200/50 dark:border-slate-700/50"
                    style={{ width: cellWidth }}
                  >
                    {fmtDay(d)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex relative">
          {/* Left list */}
          <div
            ref={leftBodyRef}
            className="w-[320px] min-w-[320px] border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-y-auto"
            style={{ maxHeight: heightPx }}
          >
            {model.rows.map((row) => {
              const key = row.__key || row.id;

              if (row.__tipo === "EPICA") {
                const pct = clampPct(row.__avance);
                return (
                  <div
                    key={key}
                    className="h-12 flex items-center gap-2 px-3 border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30"
                    title={row.__nombre}
                  >
                    <div className="w-6 text-slate-400">▾</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                        Épica: {row.__nombre}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        {row.__tareasCount} Tareas • {row.__subtCount} Subtareas
                      </div>
                    </div>
                    <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                      {pct}%
                    </div>
                  </div>
                );
              }

              if (row.__tipo === "TAREA") {
                return (
                  <div
                    key={key}
                    className="h-12 flex items-center gap-2 pl-6 pr-3 border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30"
                    title={row.__nombre}
                  >
                    <div className="w-6 text-slate-400">
                      {row.__subtareas?.length ? "▾" : "·"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                        {row.__nombre}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {row.__responsable} • {row.__estado} • {row.__avance}%
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={key}
                  className="h-10 flex items-center gap-2 pl-12 pr-3 border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30"
                  title={row.__nombre}
                >
                  <div className="w-6 text-slate-300">•</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-slate-600 dark:text-slate-400 truncate">
                      {row.__nombre}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {row.__responsable} • {row.__estado} • {row.__avance}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Timeline */}
          <div
            ref={rightBodyYRef}
            className="flex-1 overflow-y-auto bg-white dark:bg-slate-900"
            style={{ maxHeight: heightPx }}
          >
            <div ref={bodyXRef} className="overflow-x-auto">
              <div className="min-w-max relative" style={{ width: totalWidth }}>
                {model.todayIdx != null && (
                  <div
                    className="absolute top-0 bottom-0 w-px bg-red-500/60 z-10 pointer-events-none"
                    style={{ left: model.todayIdx * cellWidth }}
                  >
                    <div className="absolute top-2 left-2 text-[9px] font-bold bg-red-100 text-red-600 px-1 rounded">
                      Hoy
                    </div>
                  </div>
                )}

                {model.rows.map((row) => {
                  const key = row.__key || row.id;
                  const h = rowH(row);
                  const { left, width } = getBarLeftWidth(row);
                  const pct = clampPct(row.__avance);

                  const gridLines = (
                    <div className="absolute inset-0 pointer-events-none">
                      {model.days.map((_, i) => (
                        <div
                          key={i}
                          className="absolute top-0 bottom-0 border-r border-slate-200/40 dark:border-slate-700/40"
                          style={{ left: i * cellWidth }}
                        />
                      ))}
                    </div>
                  );

                  if (row.__tipo === "EPICA") {
                    return (
                      <div
                        key={key}
                        className="relative border-b border-slate-100 dark:border-slate-800/50"
                        style={{ height: h }}
                      >
                        {gridLines}
                        <div
                          className="absolute top-2 bottom-2 rounded-md border border-purple-300 bg-purple-100/70 px-2 flex items-center gap-2 hover:shadow-md transition-shadow"
                          style={{ left, width }}
                          title={`${row.__nombre} (${pct}%)`}
                        >
                          <div className="h-1.5 w-full bg-purple-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-purple-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-purple-800 whitespace-nowrap truncate max-w-[260px]">
                            {row.__nombre} ({pct}%)
                          </span>
                        </div>
                      </div>
                    );
                  }

                  if (row.__tipo === "TAREA") {
                    const cls = barColor(row.__estado, pct);
                    return (
                      <div
                        key={key}
                        className="relative border-b border-slate-100 dark:border-slate-800/50"
                        style={{ height: h }}
                      >
                        {gridLines}
                        <div
                          className={`absolute top-3 bottom-3 rounded flex items-center px-2 shadow-sm hover:brightness-110 ${cls}`}
                          style={{ left, width }}
                          title={`${row.__nombre} (${pct}%)`}
                        >
                          <span className="text-[10px] font-semibold text-white truncate w-full">
                            {row.__nombre}
                          </span>
                        </div>
                      </div>
                    );
                  }

                  const cls = barColor(row.__estado, pct);
                  return (
                    <div
                      key={key}
                      className="relative border-b border-slate-100 dark:border-slate-800/50"
                      style={{ height: h }}
                    >
                      {gridLines}
                      <div
                        className={`absolute top-3 bottom-3 rounded-sm flex items-center justify-center ${cls}`}
                        style={{ left, width }}
                        title={`${row.__nombre} (${pct}%)`}
                      >
                        <span className="text-[9px] text-white opacity-0 hover:opacity-100 transition-opacity">
                          {pct}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center gap-4 px-4 py-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-6 h-4 border border-purple-400 bg-purple-100 rounded" />
            <span className="text-xs text-slate-600 dark:text-slate-400">
              Épica
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-6 h-4 bg-slate-500 rounded" />
            <span className="text-xs text-slate-600 dark:text-slate-400">
              Tarea
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-6 h-2 bg-slate-400 rounded-sm" />
            <span className="text-xs text-slate-600 dark:text-slate-400">
              Subtarea
            </span>
          </div>

          <div className="ml-auto flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-md">
            <button
              type="button"
              className="px-2 py-1 text-xs hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
              onClick={zoomOut}
            >
              −
            </button>

            <button
              type="button"
              className="px-2 py-1 text-xs hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
              onClick={fitToScreen}
              title="Ajustar todo a pantalla"
            >
              Fit
            </button>

            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
              Zoom
            </span>

            <button
              type="button"
              className="px-2 py-1 text-xs hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
              onClick={zoomIn}
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
