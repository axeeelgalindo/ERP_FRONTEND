// src/components/proyectos/ProyectoGanttSectionClient.jsx
"use client";

import { useState } from "react";
import GanttChart from "./GanttChart";
import AddTareaButton from "./tareas/AddTareaButton";

export default function ProyectoGanttSectionClient({
  tareas,
  proyectoId,
  miembros = [],
}) {
  const [selected, setSelected] = useState(null);

  return (
    <>
      <GanttChart tasks={tareas} onTaskClick={setSelected} />

      {selected && (
        <AddTareaButton
          proyectoId={proyectoId}
          miembros={miembros}
          tarea={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
