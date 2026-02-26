import ProyectoGanttSectionClient from "./ProyectoGanttSectionClient";

export default function ProyectoGanttSection({ tareas = [] }) {
  if (!tareas || tareas.length === 0) return null;

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <ProyectoGanttSectionClient tareas={tareas} />
    </section>
  );
}