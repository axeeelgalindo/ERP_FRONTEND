// src/app/(protected)/proyectos/[id]/page.jsx
import { notFound } from "next/navigation";
import { serverApi } from "@/lib/api";

import ProyectoBreadcrumbs from "@/components/proyectos/ProyectoBreadcrumbs";
import ProyectoHeader from "@/components/proyectos/ProyectoHeader";
import ProyectoKpis from "@/components/proyectos/ProyectoKpis";
import ProyectoGanttSection from "@/components/proyectos/ProyectoGanttSection";
import ProyectoVentasSection from "@/components/proyectos/ProyectoVentasSection";
import ProyectoTareasEquipoSection from "@/components/proyectos/ProyectoTareasEquipoSection";

// Construye filas para el Gantt: tarea 1, 1.1, 1.2, tarea 2, 2.1, etc.
function buildGanttRows(tareas) {
  if (!Array.isArray(tareas)) return [];

  const rows = [];

  tareas.forEach((t, idx) => {
    const numeroPadre = `${idx + 1}`;

    // Subtareas (detalles). Usa el nombre de relación que realmente venga.
    const detalles = t.detalles || t.detalle || t.tareasDetalle || [];

    // === RANGO PARA LA TAREA PADRE (usando subtareas si existen) ===
    let tareaStart = t.fecha_inicio_plan;
    let tareaEnd = t.fecha_fin_plan;

    if (detalles.length > 0) {
      let min = null;
      let max = null;

      detalles.forEach((d) => {
        if (!d.fecha_inicio_plan) return;

        const s = new Date(d.fecha_inicio_plan);
        if (Number.isNaN(s.getTime())) return;

        const e = d.fecha_fin_plan ? new Date(d.fecha_fin_plan) : s;

        if (!min || s < min) min = s;
        if (!max || e > max) max = e;
      });

      if (min && max) {
        tareaStart = min.toISOString();
        tareaEnd = max.toISOString();
      }
    }

    // Fila de la tarea principal (ya con rango ajustado)
    rows.push({
      ...t,
      fecha_inicio_plan: tareaStart,
      fecha_fin_plan: tareaEnd,
      numero: numeroPadre,
      isDetalle: false,
    });

    // === FILAS DE SUBTAREAS ===
    detalles.forEach((d, jdx) => {
      // Si no hay avance numérico, lo inferimos por estado
      const avanceInferido =
        typeof d.avance === "number"
          ? d.avance
          : d.estado === "completada"
          ? 100
          : d.estado === "en_progreso"
          ? 50
          : 0;

      rows.push({
        id: d.id,
        tarea_id: d.tarea_id ?? t.id,
        nombre: d.nombre || d.titulo, // usamos titulo del detalle
        descripcion: d.descripcion ?? null,
        responsable: d.responsable ?? null,
        fecha_inicio_plan: d.fecha_inicio_plan,
        fecha_fin_plan: d.fecha_fin_plan,
        avance: avanceInferido,
        estado: d.estado ?? "pendiente",
        es_hito: d.es_hito ?? false,
        numero: `${numeroPadre}.${jdx + 1}`, // 1.1, 1.2, 2.1, etc.
        isDetalle: true,
      });
    });
  });

  return rows;
}

export default async function ProyectoDetailPage({ params }) {
  // ⚠️ En Next 15 params es una promesa
  const { id } = await params;

  let data;
  try {
    data = await serverApi(`/proyectos/${id}`);
  } catch (err) {
    console.error("Error cargando proyecto", err);
    return notFound();
  }

  const proyecto = data?.row ?? data;
  const metrics = data?.metrics ?? {};

  if (!proyecto) return notFound();

  const fin = metrics.financiero ?? {};
  const tareasMetrics = metrics.tareas ?? {};
  const clientePrincipal =
    metrics.clientePrincipal ?? proyecto.ventas?.[0]?.cliente ?? null;

  const ventas = proyecto.ventas ?? [];
  const tareasList = proyecto.tareas ?? [];
  const miembros = proyecto.miembros ?? [];

  // 👉 aquí armamos las filas del Gantt con tareas + subtareas numeradas
  const tareasGantt = buildGanttRows(tareasList);

  return (
    <div className="px-6 py-6 space-y-6">
      <ProyectoBreadcrumbs id={id} nombre={proyecto.nombre} />

      <ProyectoHeader proyecto={proyecto} />

      <ProyectoKpis
        fin={fin}
        tareas={tareasMetrics}
        clientePrincipal={clientePrincipal}
      />

      {/* Gantt: recibe las tareas ya "aplanadas" (tarea + subtareas) */}
      {tareasGantt.length > 0 && (
        <ProyectoGanttSection
          tareas={tareasGantt}
          proyectoId={proyecto.id}
          miembros={miembros}
        />
      )}

      <ProyectoVentasSection ventas={ventas} />

      <ProyectoTareasEquipoSection
        proyectoId={proyecto.id}
        tareas={tareasList}
        miembros={miembros}
      />
    </div>
  );
}
