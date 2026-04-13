import { formatCurrencyCLP } from "@/lib/formatters";
import Link from "next/link";
import { TrendingDown, TrendingUp, Presentation, Calendar, CalendarCheck, AlertCircle, Clock } from "lucide-react";

export default function ProyectoHeader({ proyecto, metrics, tareas = [] }) {
  const financiero = metrics?.financiero || {};
  const tareasStats = metrics?.tareas || {};

  const progreso = tareasStats.porcentajeCompletado || 0;

  // SVG Math
  const radius = 72;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progreso / 100) * circumference;

  // --- Date Logic ---
  const fIniPlan = proyecto.fecha_inicio_plan ? new Date(proyecto.fecha_inicio_plan) : null;
  const fFinPlan = proyecto.fecha_fin_plan ? new Date(proyecto.fecha_fin_plan) : null;

  let fIniReal = proyecto.fecha_inicio_real ? new Date(proyecto.fecha_inicio_real) : null;
  let fFinReal = proyecto.fecha_fin_real ? new Date(proyecto.fecha_fin_real) : null;

  let isTaskInProgress = false;

  // If the user hasn't explicitly set project dates, derive from tasks
  if (!fIniReal || !fFinReal) {
    for (const t of tareas) {
      const estado = String(t?.estado || "pendiente").toLowerCase();
      if (estado === "en_progreso" || (t.avance > 0 && t.avance < 100)) {
        isTaskInProgress = true;
      }
      if (t.fecha_inicio_real) {
        const d = new Date(t.fecha_inicio_real);
        if (!fIniReal || d < fIniReal) fIniReal = d;
      }
      if (t.fecha_fin_real) {
        const d = new Date(t.fecha_fin_real);
        if (!fFinReal || d > fFinReal) fFinReal = d;
      }
    }
  }

  const formatD = (d) => {
    if (!d) return "No defin.";
    return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric"});
  };

  const today = new Date();
  today.setHours(0,0,0,0);
  const finPlanM = fFinPlan ? new Date(fFinPlan) : null;
  if (finPlanM) finPlanM.setHours(0,0,0,0);

  const isDelayed = finPlanM && today > finPlanM && progreso < 100;
  
  const statusRealStart = fIniReal ? formatD(fIniReal) : (isTaskInProgress ? "En progreso" : "No iniciada");
  const statusRealEnd = fFinReal && progreso >= 100 ? formatD(fFinReal) : (progreso >= 100 ? "Completada" : (isTaskInProgress ? "En curso" : "Pendiente"));

  return (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 p-8 bg-surface-container-lowest rounded-xl shadow-sm relative overflow-hidden flex flex-col justify-between border border-outline-variant/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-container/5 rounded-full -mr-20 -mt-20"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 bg-secondary-container text-on-secondary-container text-[11px] font-bold rounded-full uppercase tracking-wider">
              {proyecto.estado || "En Ejecución"}
            </span>
            <h1 className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1">
              <Presentation size={14} /> Proyecto de Ingeniería
            </h1>
          </div>
          <h2 className="text-3xl font-extrabold text-on-surface tracking-tight mb-3">
            {proyecto.nombre}
          </h2>
          <p className="text-sm text-on-surface-variant max-w-xl leading-relaxed">
            {proyecto.descripcion || "Sin descripción detallada del proyecto."}
          </p>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
            {/* Planificado */}
            <div className="bg-surface-container-low/50 p-4 rounded-xl border border-outline-variant/30 flex flex-col gap-2 relative overflow-hidden group hover:border-outline-variant/60 transition-colors">
              <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                <Calendar size={40} />
              </div>
              <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest flex items-center gap-1.5">
                <Calendar size={14} className="text-primary"/> Fechas Planificadas
              </span>
              <div className="flex items-center gap-3">
                <div className="flex flex-col">
                  <span className="text-[10px] text-on-surface-variant/70 uppercase">Inicio</span>
                  <span className="text-sm font-semibold text-on-surface">{fIniPlan ? formatD(fIniPlan) : "No def."}</span>
                </div>
                <span className="text-outline-variant">→</span>
                <div className="flex flex-col">
                  <span className="text-[10px] text-on-surface-variant/70 uppercase">Término</span>
                  <span className="text-sm font-semibold text-on-surface">{fFinPlan ? formatD(fFinPlan) : "No def."}</span>
                </div>
              </div>
            </div>

            {/* Real */}
            <div className={`p-4 rounded-xl border flex flex-col gap-2 relative overflow-hidden group transition-colors ${
              isDelayed && progreso < 100 ? 'bg-error-container/20 border-error/30 hover:border-error/50' : (
                progreso >= 100 ? 'bg-emerald-50 border-emerald-200 hover:border-emerald-300' : 'bg-primary-container/10 border-primary/20 hover:border-primary/40'
              )
            }`}>
              <div className={`absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity ${
                isDelayed && progreso < 100 ? 'text-error' : (progreso >= 100 ? 'text-emerald-600' : 'text-primary')
              }`}>
                {isDelayed && progreso < 100 ? <AlertCircle size={40} /> : (progreso >= 100 ? <CalendarCheck size={40} /> : <Clock size={40} />)}
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 ${
                 progreso >= 100 ? 'text-emerald-700' : (isDelayed ? 'text-error' : 'text-primary')
              }`}>
                {progreso >= 100 ? <CalendarCheck size={14} /> : (isDelayed ? <AlertCircle size={14} /> : <Clock size={14} />)}
                Lo que va realmente
              </span>
              <div className="flex items-center gap-3">
                <div className="flex flex-col z-10">
                  <span className={`text-[10px] uppercase ${isDelayed && progreso < 100 ? 'text-error/70' : 'text-on-surface-variant/70'}`}>Inicio</span>
                  <span className="text-sm font-semibold text-on-surface">{statusRealStart}</span>
                </div>
                <span className={`${isDelayed && progreso < 100 ? 'text-error/40' : 'text-outline-variant'} z-10`}>→</span>
                <div className="flex flex-col z-10">
                  <span className={`text-[10px] uppercase ${isDelayed && progreso < 100 ? 'text-error/70' : 'text-on-surface-variant/70'}`}>Término</span>
                  <span className={`text-sm font-semibold ${isDelayed && progreso < 100 ? 'text-error' : 'text-on-surface'}`}>{statusRealEnd}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-8 bg-surface-container-lowest rounded-xl shadow-sm flex flex-col items-center justify-center text-center border-l-4 border-primary border-t border-r border-b border-outline-variant/10">
        <div className="relative w-40 h-40 flex items-center justify-center mb-6">
          <svg className="w-full h-full transform -rotate-90">
            <circle className="text-surface-container" cx="80" cy="80" fill="transparent" r="72" stroke="currentColor" strokeWidth="10"></circle>
            <circle
              className="text-primary transition-all duration-1000 ease-out"
              cx="80" cy="80" fill="transparent" r="72" stroke="currentColor"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round" strokeWidth="10"
            ></circle>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-black text-on-surface tracking-tighter">{Math.round(progreso)}%</span>
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">Avance Real</span>
          </div>
        </div>

        <div className="space-y-2 w-full bg-surface-container-low/30 p-4 rounded-lg">
          <Link
            href={`/proyectos/${proyecto.id}/devengado`}
            className="w-full flex items-center justify-center gap-2 bg-on-surface hover:bg-on-surface/90 text-surface px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm"
          >
            <TrendingUp size={16} /> Resumen Financiero
          </Link>
        </div>
      </div>
    </section>
  );
}
