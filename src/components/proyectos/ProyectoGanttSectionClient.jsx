"use client";

import GanttChart from "./GanttChart";

export default function ProyectoGanttSectionClient({ tareas = [] }) {
  return <GanttChart tareas={tareas} heightPx={1600}/>;
}