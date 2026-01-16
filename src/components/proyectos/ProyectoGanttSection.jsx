// src/components/proyectos/ProyectoGanttSection.jsx
import ProyectoGanttSectionClient from "./ProyectoGanttSectionClient";

export default function ProyectoGanttSection({
  tareas = [],
  proyectoId,
  miembros = [],
}) {
  if (!tareas || tareas.length === 0) return null;

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-medium text-gray-900 mb-4">
        Cronograma del proyecto
      </h2>

      <ProyectoGanttSectionClient
        tareas={tareas}
        proyectoId={proyectoId}
        miembros={miembros}
      />
    </section>
  );
}
