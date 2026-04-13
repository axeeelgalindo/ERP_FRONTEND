"use client";

import { useState, useMemo } from "react";
import { ClipboardList, Calendar, Layers3, AlertTriangle, MessageSquarePlus, ChevronDown, ChevronUp, History } from "lucide-react";
import { Row, Bar } from "./ProyectoUI";
import { formatPercent } from "@/lib/formatters";
import { makeHeaders } from "@/lib/api";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

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
    },
    extra: {
      tareasExtraPlanificacion: tareasArr.filter(t => t.es_planificado === false).length,
      subtareasExtraPlanificacion: tareasArr.flatMap(t => getDetalles(t)).filter(d => d.es_planificado === false).length
    }
  };
}

export default function ProyectoKpis({ proyecto = {}, items = [] }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [comentarioRetraso, setComentarioRetraso] = useState("");
  const [isSavingComentario, setIsSavingComentario] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);

  // ✅ KPIs reales desde items (tareas + subtareas + épicas)
  const computed = useMemo(() => computeKpisFromItems(items), [items]);

  // ✅ si el backend ya te manda "tareas", lo respetamos pero completamos con computed
  // (si no viene, usamos computed)
  const tareasFinal = {
    totalTareas: computed.tareas.totalTareas,
    tareasCompletas: computed.tareas.tareasCompletas,
    tareasEnCurso: computed.tareas.tareasEnCurso,
    tareasPendientes: computed.tareas.tareasPendientes,
    avancePromedio: computed.tareas.avancePromedio,
    porcentajeCompletado: computed.tareas.porcentajeCompletado,
  };

  // Ojo: formatPercent -> asumimos que quiere 0..100
  const pct = (v) => formatPercent(clampPct(v));
  
  const fInicio = proyecto?.fecha_inicio_plan ? new Date(proyecto.fecha_inicio_plan).toLocaleDateString() : "No definida";
  const fFin = proyecto?.fecha_fin_plan ? new Date(proyecto.fecha_fin_plan).toLocaleDateString() : "No definida";
  
  const today = new Date();
  today.setHours(0,0,0,0);
  const finPlanDate = proyecto?.fecha_fin_plan ? new Date(proyecto.fecha_fin_plan) : null;
  if (finPlanDate) finPlanDate.setHours(0,0,0,0);
  
  const isDelayed = finPlanDate && today > finPlanDate && clampPct(tareasFinal.porcentajeCompletado) < 100;

  let delayedDays = 0;
  if (finPlanDate) {
    if (clampPct(tareasFinal.porcentajeCompletado) < 100) {
      if (today > finPlanDate) {
        delayedDays = Math.ceil((today.getTime() - finPlanDate.getTime()) / (1000 * 3600 * 24));
      }
    } else {
      const finRealDate = proyecto?.fecha_fin_real ? new Date(proyecto.fecha_fin_real) : null;
      if (finRealDate) {
        finRealDate.setHours(0,0,0,0);
        if (finRealDate > finPlanDate) {
          delayedDays = Math.ceil((finRealDate.getTime() - finPlanDate.getTime()) / (1000 * 3600 * 24));
        }
      }
    }
  }

  const fInicioReal = proyecto?.fecha_inicio_real ? new Date(proyecto.fecha_inicio_real).toLocaleDateString() : (clampPct(tareasFinal.avancePromedio) > 0 ? "En curso" : "No iniciada");
  const fFinReal = proyecto?.fecha_fin_real ? new Date(proyecto.fecha_fin_real).toLocaleDateString() : (clampPct(tareasFinal.porcentajeCompletado) >= 100 ? "Completada sin fecha" : "Pendiente");

  // Validate if we should ask for a delay comment
  // "Solo aparece cuando no hay epicas, tareas, subtareas planificadas y/o fuera de planificacion"
  let hasOngoingTasksCoveringToday = false;
  if (isDelayed) {
    const checkCoveringToday = (itemsArr) => {
      for (const t of itemsArr) {
        if (estadoOf(t) === "completada" || clampPct(t.avance) >= 100) continue;
        const eDate = t.fecha_fin_real ? new Date(t.fecha_fin_real) : t.fecha_fin_plan ? new Date(t.fecha_fin_plan) : null;
        if (eDate) {
          eDate.setHours(0,0,0,0);
          if (eDate >= today) {
            hasOngoingTasksCoveringToday = true;
            break;
          }
        }
      }
    };
    checkCoveringToday(items);
    if (!hasOngoingTasksCoveringToday) {
      const allSubtareas = items.flatMap(t => t.detalles || t.detalle || t.tareasDetalle || []);
      checkCoveringToday(allSubtareas);
    }
  }

  const showDelayCommentInput = isDelayed && !hasOngoingTasksCoveringToday;

  const handleSaveComentario = async () => {
    if (!session || !proyecto.id || !comentarioRetraso.trim()) return;
    try {
      setIsSavingComentario(true);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/proyectos/${proyecto.id}/retrasos`, {
        method: "POST",
        headers: makeHeaders(session),
        body: JSON.stringify({
          comentario: comentarioRetraso
        })
      });
      if (res.ok) {
        setComentarioRetraso("");
        router.refresh();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingComentario(false);
    }
  };

  const retrasosHistory = proyecto.retrasos || [];

  return (
    <div className="space-y-4">
      {/* Delay Comment Prompt */}
      {showDelayCommentInput && (
        <div className="bg-error-container/10 p-6 rounded-xl border-l-4 border-error border-y border-r border-outline-variant/10">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-on-surface flex items-center gap-2">
              <History size={18} className="text-error" />
              Retraso Detectado
            </h4>
            <span className="text-[10px] font-bold text-error uppercase tracking-widest px-2 py-0.5 bg-error-container rounded">
              Atrasado ({delayedDays > 0 ? `+${delayedDays} Días` : 'Pendiente'})
            </span>
          </div>
          <div className="space-y-3">
             <p className="text-[12px] text-on-surface-variant leading-relaxed">
               El proyecto ha superado su plazo planificado y no tiene tareas futuras documentadas. Por favor documente el estado real o justifique el retraso en la plataforma:
             </p>
             <div className="flex gap-2">
                <textarea 
                  className="flex-1 rounded-md border-error/30 bg-surface-container-lowest text-sm p-3 focus:border-error focus:ring-error shadow-sm"
                  rows={2}
                  placeholder="Ej. Esperando respuesta de cliente, retraso logístico..."
                  value={comentarioRetraso}
                  onChange={(e) => setComentarioRetraso(e.target.value)}
                />
                <button 
                  disabled={isSavingComentario || !comentarioRetraso.trim()}
                  onClick={handleSaveComentario}
                  className="bg-error hover:bg-error/90 text-on-error px-5 py-2 rounded-md font-bold text-xs disabled:opacity-50 flex items-center gap-2 transition-colors shadow-sm"
                >
                  <MessageSquarePlus size={16} /> 
                  {isSavingComentario ? "..." : "REPORTAR"}
                </button>
             </div>
          </div>
        </div>
      )}

      {/* Primary Delay History Collapsible */}
      {retrasosHistory.length > 0 && (
        <div className="group mt-2">
          <button
            type="button"
            onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
            className="w-full py-4 flex items-center justify-between text-left bg-surface-container-lowest hover:bg-surface-container-low px-5 rounded-xl transition-all border border-outline-variant/10 shadow-sm"
          >
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-error-container text-error rounded-lg">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-on-surface">Historial de Retrasos</h3>
                <p className="text-[11px] text-on-surface-variant">
                  {retrasosHistory.length} eventos críticos reportados en el proyecto
                </p>
              </div>
            </div>
            <ChevronDown size={20} className={`text-on-surface-variant transition-transform ${isHistoryExpanded ? 'rotate-180' : 'group-hover:translate-x-1 -rotate-90'}`} />
          </button>
          
          {isHistoryExpanded && (
            <div className="p-5 mt-2 bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/10 space-y-4">
              {retrasosHistory.map((ret, i) => (
                <div key={ret.id || i} className="bg-error-container/5 p-4 rounded-lg border-l-2 border-error border-y border-r border-outline-variant/10 shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-error font-semibold flex items-center gap-1">
                      <Calendar size={14}/> {new Date(ret.creado_en).toLocaleString()}
                    </span>
                    {i === 0 && (
                      <span className="text-[9px] font-bold text-error uppercase tracking-widest px-2 py-0.5 bg-error-container rounded">Último Reporte</span>
                    )}
                  </div>
                  <div className="text-on-surface text-sm leading-relaxed font-medium">
                    {ret.comentario}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}