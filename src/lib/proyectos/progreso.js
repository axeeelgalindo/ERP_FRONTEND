// src/lib/proyectos/progreso.js
function clampPct(n) {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
}
// ✅ NUEVO: redondeo centralizado
function roundPct(n, decimals = 0) {
  const v = clampPct(n);
  const d = Math.max(0, Math.min(2, Number(decimals) || 0)); // 0..2
  const factor = 10 ** d;
  return Math.round(v * factor) / factor;
}

function getSubtareas(tarea) {
  if (!tarea) return [];
  if (Array.isArray(tarea.detalles)) return tarea.detalles; // ✅ TU SCHEMA
  return [];
}

function calcProgresoTarea(t) {
  const subs = getSubtareas(t);

  if (subs.length > 0) {
    const values = subs.map((s) => {
      if (typeof s.avance === "number") return clampPct(s.avance);

      const st = String(s.estado || "pendiente").toLowerCase();
      if (st === "completada" || st === "completa" || st === "finalizada" || st === "cerrada")
        return 100;
      if (st === "en_progreso" || st === "en curso") return 50;
      return 0;
    });

    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return clampPct(avg);
  }

  if (typeof t?.avance === "number") return clampPct(t.avance);

  const st = String(t?.estado || "pendiente").toLowerCase();
  if (st === "completada" || st === "completa" || st === "finalizada" || st === "cerrada")
    return 100;
  if (st === "en_progreso" || st === "en curso") return 50;
  return 0;
}

function calcProgresoEpica(ep) {
  const tareas = Array.isArray(ep?.tareas) ? ep.tareas : [];
  if (!tareas.length) return 0;
  const avg = tareas.reduce((s, t) => s + calcProgresoTarea(t), 0) / tareas.length;
  return clampPct(avg);
}

export function calcProgresoProyecto(proyecto, decimals = 0) {
  const epicas = Array.isArray(proyecto?.epicas) ? proyecto.epicas : [];
  if (epicas.length) {
    const avg = epicas.reduce((s, ep) => s + calcProgresoEpica(ep), 0) / epicas.length;
    return roundPct(avg, decimals);
  }

  const tareas = Array.isArray(proyecto?.tareas) ? proyecto.tareas : [];
  if (tareas.length) {
    const avg = tareas.reduce((s, t) => s + calcProgresoTarea(t), 0) / tareas.length;
    return roundPct(avg, decimals);
  }

  return 0;
}

export function calcRangoPlanProyecto(proyecto) {
  const dates = [];

  const pushDate = (d) => {
    if (!d) return;
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return;
    dates.push(dt);
  };

  const epicas = Array.isArray(proyecto?.epicas) ? proyecto.epicas : [];
  if (epicas.length) {
    for (const ep of epicas) {
      for (const t of ep?.tareas || []) {
        const subs = getSubtareas(t);
        if (subs.length) {
          for (const s of subs) {
            pushDate(s.fecha_inicio_plan);
            pushDate(s.fecha_fin_plan);
          }
        } else {
          pushDate(t.fecha_inicio_plan);
          pushDate(t.fecha_fin_plan);
        }
      }
    }
  } else {
    const tareas = Array.isArray(proyecto?.tareas) ? proyecto.tareas : [];
    for (const t of tareas) {
      const subs = getSubtareas(t);
      if (subs.length) {
        for (const s of subs) {
          pushDate(s.fecha_inicio_plan);
          pushDate(s.fecha_fin_plan);
        }
      } else {
        pushDate(t.fecha_inicio_plan);
        pushDate(t.fecha_fin_plan);
      }
    }
  }

  if (!dates.length) {
    pushDate(proyecto?.fecha_inicio_plan);
    pushDate(proyecto?.fecha_fin_plan);
  }

  if (!dates.length) return { inicio: null, fin: null };

  const inicio = new Date(Math.min(...dates.map((d) => d.getTime()))).toISOString();
  const fin = new Date(Math.max(...dates.map((d) => d.getTime()))).toISOString();
  return { inicio, fin };
}