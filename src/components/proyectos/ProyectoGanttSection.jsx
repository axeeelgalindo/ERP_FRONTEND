"use client";

import { useState } from "react";
import ProyectoGanttSectionClient from "./ProyectoGanttSectionClient";
import { ChevronDown, ChevronUp, BarChart2 } from "lucide-react";

export default function ProyectoGanttSection({ tareas = [], proyectoId, miembros }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!tareas || tareas.length === 0) return null;

  return (
    <div className="group mt-6">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full py-4 flex items-center justify-between text-left bg-surface-container-lowest hover:bg-surface-container-low px-5 rounded-xl transition-all border border-outline-variant/10 shadow-sm"
      >
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-tertiary-fixed text-tertiary rounded-lg">
            <BarChart2 size={24} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-on-surface">Carta Gantt & Cronograma</h3>
            <p className="text-[11px] text-on-surface-variant">Línea de tiempo detallada de hitos y entregables</p>
          </div>
        </div>
        <ChevronDown size={20} className={`text-on-surface-variant transition-transform ${isExpanded ? 'rotate-180' : 'group-hover:translate-x-1 -rotate-90'}`} />
      </button>

      {isExpanded && (
        <div className="p-5 mt-2 bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/10">
          <ProyectoGanttSectionClient tareas={tareas} proyectoId={proyectoId} miembros={miembros} />
        </div>
      )}
    </div>
  );
}