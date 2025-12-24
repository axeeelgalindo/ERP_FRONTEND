// src/components/proyectos/GanttChart.jsx
"use client";

import { useMemo, useEffect, useRef, useState } from "react";

const BASE_CELL_WIDTH = 28; // ancho "normal" por día
const MIN_CELL_WIDTH = 20;  // ancho mínimo al estirar

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function diffDays(a, b) {
  const ms = startOfDay(b) - startOfDay(a);
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function formatDay(date) {
  return date.getDate();
}

function formatMonth(date) {
  return date.toLocaleDateString("es-CL", { month: "short", year: "2-digit" });
}

export default function GanttChart({ tasks = [] }) {
  const [containerWidth, setContainerWidth] = useState(0);
  const headerScrollRef = useRef(null); // para medir el ancho disponible

  const { normalizedTasks, days, minDate, maxDate } = useMemo(() => {
    // Normalizar tareas con fechas válidas
    const norm = tasks
      .map((t) => {
        if (!t.fecha_inicio_plan) return null;
        const start = new Date(t.fecha_inicio_plan);
        const end = t.fecha_fin_plan ? new Date(t.fecha_fin_plan) : start;
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
          return null;
        return { ...t, _start: startOfDay(start), _end: startOfDay(end) };
      })
      .filter(Boolean);

    if (!norm.length) {
      return { normalizedTasks: [], days: [], minDate: null, maxDate: null };
    }

    // Rango global
    let min = norm[0]._start;
    let max = norm[0]._end;
    for (const t of norm) {
      if (t._start < min) min = t._start;
      if (t._end > max) max = t._end;
    }

    min = startOfDay(min);
    max = startOfDay(max);

    const daysArr = [];
    for (let d = new Date(min); d <= max; d.setDate(d.getDate() + 1)) {
      daysArr.push(new Date(d));
    }

    return { normalizedTasks: norm, days: daysArr, minDate: min, maxDate: max };
  }, [tasks]);

  // Si no hay datos, mensaje
  if (!normalizedTasks.length || !days.length) {
    return (
      <p className="mt-3 text-xs text-gray-500">
        Aún no hay fechas planificadas suficientes para mostrar el Gantt.
      </p>
    );
  }

  // Medimos el ancho disponible del área de scroll
  useEffect(() => {
    const el = headerScrollRef.current;
    if (!el) return;

    const updateWidth = () => {
      setContainerWidth(el.clientWidth || 0);
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  // Ancho por día dinámico
  const naturalWidth = days.length * BASE_CELL_WIDTH;
  let cellWidth = BASE_CELL_WIDTH;

  if (containerWidth && naturalWidth < containerWidth) {
    // estiramos para que ocupe todo el ancho
    cellWidth = Math.max(
      MIN_CELL_WIDTH,
      containerWidth / Math.max(1, days.length)
    );
  }

  const totalWidth = days.length * cellWidth;

  // Índice del día de hoy si está dentro del rango
  const today = startOfDay(new Date());
  const todayIdx =
    today >= minDate && today <= maxDate ? diffDays(minDate, today) : null;

  return (
    <div className="mt-4 border-t pt-4">
      <div className="text-xs font-medium text-gray-700 mb-2">
        Cronograma planificado (Gantt)
      </div>

      <div className="rounded-xl border border-gray-200 bg-slate-50 overflow-hidden">
        {/* CABECERA (meses y días) */}
        <div className="flex text-[11px] text-gray-500 border-b border-gray-200 bg-white sticky top-0 z-10">
          <div className="w-52 shrink-0 px-3 py-2 bg-white">Tarea</div>
          <div className="flex-1 overflow-x-auto" ref={headerScrollRef}>
            <div className="relative" style={{ width: totalWidth }}>
              {/* Línea de meses */}
              <div className="flex border-b border-gray-100">
                {days.map((d, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-center"
                    style={{ width: cellWidth }}
                  >
                    {idx === 0 || d.getDate() === 1 ? formatMonth(d) : ""}
                  </div>
                ))}
              </div>

              {/* Línea de días (resaltamos HOY) */}
              <div className="flex">
                {days.map((d, idx) => {
                  const isToday = todayIdx === idx;
                  return (
                    <div
                      key={idx}
                      className={
                        "flex items-center justify-center border-l border-gray-100 py-1 " +
                        (isToday
                          ? "bg-red-50 text-red-600 font-semibold"
                          : "")
                      }
                      style={{ width: cellWidth }}
                    >
                      {formatDay(d)}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* CUERPO (tareas) */}
        <div className="max-h-80 overflow-y-auto">
          <div className="flex">
            {/* Columna izquierda: info de la tarea */}
            <div className="w-52 shrink-0">
              {normalizedTasks.map((t) => (
                <div
                  key={t.id}
                  className="h-10 flex flex-col justify-center border-t border-gray-100 bg-white px-3"
                >
                  <div
                    className={
                      "font-medium text-gray-800 truncate text-xs " +
                      (t.isDetalle ? "pl-4" : "")
                    }
                  >
                    {t.numero && (
                      <span className="mr-1 text-[10px] text-gray-400">
                        {t.numero}
                      </span>
                    )}
                    {t.nombre}
                  </div>
                  <div className="text-[11px] text-gray-500 truncate">
                    {t.responsable?.usuario?.nombre ||
                      t.responsable?.id ||
                      "Sin responsable"}
                    {" · "}
                    {t.avance ?? 0}% · {t.estado}
                  </div>
                </div>
              ))}
            </div>

            {/* Timeline derecha */}
            <div className="flex-1 overflow-x-auto">
              <div className="relative" style={{ width: totalWidth }}>
                {/* Banda vertical de HOY (una sola, para todas las filas) */}
                {todayIdx != null && (
                  <div
                    className="absolute top-0 bottom-0 bg-red-50/70 pointer-events-none"
                    style={{
                      left: todayIdx * cellWidth,
                      width: cellWidth,
                    }}
                  />
                )}

                {/* Filas de timeline */}
                {normalizedTasks.map((t) => {
                  const startOffset = diffDays(minDate, t._start);
                  const endOffset = diffDays(minDate, t._end);
                  const lenDays = Math.max(1, endOffset - startOffset + 1);

                  const left = startOffset * cellWidth;
                  const width = lenDays * cellWidth;

                  const completed =
                    t.avance >= 100 || t.estado === "completada"; // 👈 aquí el fix
                  const inProgress =
                    t.estado === "en_progreso" ||
                    (t.avance > 0 && t.avance < 100);

                  const color = t.es_hito
                    ? "bg-purple-500"
                    : completed
                    ? "bg-emerald-500"
                    : inProgress
                    ? "bg-blue-500"
                    : "bg-gray-400";

                  return (
                    <div
                      key={t.id}
                      className="relative h-10 border-t border-gray-100 bg-white hover:bg-slate-50"
                    >
                      {/* Grid de fondo */}
                      {days.map((_, idx) => (
                        <div
                          key={idx}
                          className="absolute top-0 bottom-0 border-l border-dashed border-gray-100"
                          style={{ left: idx * cellWidth }}
                        />
                      ))}

                      {/* Barra de tarea */}
                      <div
                        className={`absolute top-2 bottom-2 rounded-full shadow-sm flex items-center px-2 text-[10px] text-white ${color}`}
                        style={{ left, width }}
                        title={`${t.nombre} (${t.avance ?? 0}%)`}
                      >
                        <span className="truncate">{t.nombre}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Leyenda */}
      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-gray-500">
        <div className="flex items-center gap-1">
          <span className="inline-block h-2 w-4 rounded-full bg-emerald-500" />
          Completas
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block h-2 w-4 rounded-full bg-blue-500" />
          En curso
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block h-2 w-4 rounded-full bg-gray-400" />
          Pendientes
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block h-2 w-4 rounded-full bg-purple-500" />
          Hitos
        </div>
      </div>
    </div>
  );
}
