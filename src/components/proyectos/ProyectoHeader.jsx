"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  TrendingUp,
  Presentation,
  Calendar,
  CalendarCheck,
  AlertCircle,
  Clock,
  Users,
  UserPlus,
  X,
} from "lucide-react";
import AsignarEquipoModal from "./AsignarEquipoModal";
import { makeHeaders } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL;

export default function ProyectoHeader({ proyecto, metrics, tareas = [] }) {
  const router = useRouter();
  const { data: session } = useSession();

  const [openModalEquipo, setOpenModalEquipo] = useState(false);
  const [empleados, setEmpleados] = useState([]);
  const [loadingEmpleados, setLoadingEmpleados] = useState(false);
  const [savingEquipo, setSavingEquipo] = useState(false);
  const [localMiembros, setLocalMiembros] = useState(proyecto?.miembros || []);

  useEffect(() => {
    setLocalMiembros(proyecto?.miembros || []);
  }, [proyecto?.miembros]);

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
    return d.toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  };

  const getEstadoLabel = (estado, hasStarted) => {
    const s = String(estado || "activo").toLowerCase();
    if (s === "finalizado" || s === "completado" || s === "cerrado") return "Finalizado";
    if (s === "pausado" || s === "detenido") return "Pausado";
    if (s === "en_progreso" || s === "en_curso" || (s === "activo" && hasStarted)) return "En progreso";
    return "En espera";
  };

  const getEstadoCls = (estado, hasStarted) => {
    const s = String(estado || "activo").toLowerCase();
    if (s === "finalizado" || s === "completado" || s === "cerrado") return "bg-green-50 text-green-700 border border-green-200";
    if (s === "pausado" || s === "detenido") return "bg-amber-50 text-amber-700 border border-amber-200";
    if (s === "en_progreso" || s === "en_curso" || (s === "activo" && hasStarted)) return "bg-blue-50 text-blue-700 border border-blue-200";
    return "bg-slate-50 text-slate-700 border border-slate-200";
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const finPlanM = fFinPlan ? new Date(fFinPlan) : null;
  if (finPlanM) finPlanM.setHours(0, 0, 0, 0);

  const isDelayed = finPlanM && today > finPlanM && progreso < 100;

  const statusRealStart = fIniReal ? formatD(fIniReal) : (isTaskInProgress ? "En progreso" : "No iniciada");
  const statusRealEnd = fFinReal && progreso >= 100 ? formatD(fFinReal) : (progreso >= 100 ? "Completada" : (isTaskInProgress ? "En curso" : "Pendiente"));

  // Cargar empleados para el modal
  const handleOpenEquipoModal = async () => {
    setOpenModalEquipo(true);
    if (empleados.length === 0) {
      try {
        setLoadingEmpleados(true);
        const res = await fetch(`${API}/empleados?page=1&pageSize=100`, {
          headers: makeHeaders(session),
        });
        if (!res.ok) throw new Error("Error al cargar empleados");
        const data = await res.json();
        setEmpleados(data?.items || data?.rows || data || []);
      } catch (e) {
        console.error("Error cargando empleados:", e);
      } finally {
        setLoadingEmpleados(false);
      }
    }
  };

  // Guardar asignación de equipo
  const handleSaveEquipo = async (selectedIds) => {
    try {
      setSavingEquipo(true);
      const res = await fetch(`${API}/proyectos/update/${proyecto.id}`, {
        method: "PATCH",
        headers: {
          ...makeHeaders(session),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          miembros: selectedIds,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.message || "Error al actualizar equipo del proyecto");
      }

      // Optimistic update
      const updatedMiembros = selectedIds.map((empId) => {
        const empFound = empleados.find((e) => e.id === empId);
        const existing = localMiembros.find((m) => (m.empleado_id || m.empleado?.id) === empId);
        return existing || {
          id: `temp-${empId}`,
          proyecto_id: proyecto.id,
          empleado_id: empId,
          empleado: empFound || null,
        };
      });
      setLocalMiembros(updatedMiembros);
      setOpenModalEquipo(false);

      // Sincronizar servidor y resto de componentes
      router.refresh();
    } catch (e) {
      console.error(e);
      alert(e.message || "No se pudo actualizar el equipo asignado.");
    } finally {
      setSavingEquipo(false);
    }
  };

  // Quitar miembro individual rápido
  const handleRemoveMember = async (empId, e) => {
    e.stopPropagation();
    const currentIds = localMiembros.map((m) => m.empleado_id || m.empleado?.id).filter(Boolean);
    const newIds = currentIds.filter((id) => id !== empId);
    await handleSaveEquipo(newIds);
  };

  const getInitials = (name) => {
    if (!name) return "E";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 p-7 lg:p-8 bg-surface-container-lowest rounded-xl shadow-sm relative overflow-hidden flex flex-col justify-between border border-outline-variant/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-container/5 rounded-full -mr-20 -mt-20 pointer-events-none"></div>

        <div className="relative z-10 flex flex-col justify-between h-full">
          {/* Main Top Grid: Left Project Info + Right Team Members Zone */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch h-full">
            {/* Left Col (md:col-span-7): Estado, Título, Descripción y Fechas como Filas */}
            <div className="md:col-span-7 flex flex-col justify-between gap-5">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span className={`px-3 py-1 text-[11px] font-bold rounded-full uppercase tracking-wider ${getEstadoCls(proyecto.estado, !!proyecto.fecha_inicio_real)}`}>
                    {getEstadoLabel(proyecto.estado, !!proyecto.fecha_inicio_real)}
                  </span>
                  <h1 className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1">
                    <Presentation size={14} /> Proyecto de Ingeniería
                  </h1>
                </div>
                <h2 className="text-2xl lg:text-3xl font-extrabold text-on-surface tracking-tight mb-2">
                  {proyecto.nombre}
                </h2>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  {proyecto.descripcion || "Sin descripción detallada del proyecto."}
                </p>
              </div>

              {/* Fechas estructuradas como filas */}
              <div className="flex flex-col gap-2.5">
                {/* Planificado - Fila */}
                <div className="bg-surface-container-low/50 p-3 rounded-xl border border-outline-variant/30 flex items-center justify-between relative overflow-hidden group hover:border-outline-variant/60 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Calendar size={16} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">
                        Fechas Planificadas
                      </span>
                      <span className="text-[11px] text-on-surface-variant/70 hidden sm:inline">
                        Cronograma base
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 sm:gap-3 pr-1">
                    <div className="flex flex-col text-right sm:text-left">
                      <span className="text-[9px] text-on-surface-variant/70 uppercase">Inicio</span>
                      <span className="text-xs font-semibold text-on-surface">{fIniPlan ? formatD(fIniPlan, true) : "No def."}</span>
                    </div>
                    <span className="text-outline-variant text-xs">→</span>
                    <div className="flex flex-col text-right">
                      <span className="text-[9px] text-on-surface-variant/70 uppercase">Término</span>
                      <span className="text-xs font-semibold text-on-surface">{fFinPlan ? formatD(fFinPlan, true) : "No def."}</span>
                    </div>
                  </div>
                </div>

                {/* Real - Fila */}
                <div className={`p-3 rounded-xl border flex items-center justify-between relative overflow-hidden group transition-colors ${
                  isDelayed && progreso < 100 ? 'bg-error-container/20 border-error/30 hover:border-error/50' : (
                    progreso >= 100 ? 'bg-emerald-50 border-emerald-200 hover:border-emerald-300' : 'bg-primary-container/10 border-primary/20 hover:border-primary/40'
                  )
                }`}>
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isDelayed && progreso < 100 ? 'bg-error/10 text-error' : (progreso >= 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-primary/10 text-primary')
                    }`}>
                      {isDelayed && progreso < 100 ? <AlertCircle size={16} /> : (progreso >= 100 ? <CalendarCheck size={16} /> : <Clock size={16} />)}
                    </div>
                    <div className="flex flex-col">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${
                        progreso >= 100 ? 'text-emerald-700' : (isDelayed ? 'text-error' : 'text-primary')
                      }`}>
                        Lo que va realmente
                      </span>
                      <span className="text-[11px] text-on-surface-variant/70 hidden sm:inline">
                        Ejecución en obra
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 sm:gap-3 pr-1">
                    <div className="flex flex-col text-right sm:text-left">
                      <span className={`text-[9px] uppercase ${isDelayed && progreso < 100 ? 'text-error/70' : 'text-on-surface-variant/70'}`}>Inicio</span>
                      <span className="text-xs font-semibold text-on-surface">{statusRealStart}</span>
                    </div>
                    <span className={`${isDelayed && progreso < 100 ? 'text-error/40' : 'text-outline-variant'} text-xs`}>→</span>
                    <div className="flex flex-col text-right">
                      <span className={`text-[9px] uppercase ${isDelayed && progreso < 100 ? 'text-error/70' : 'text-on-surface-variant/70'}`}>Término</span>
                      <span className={`text-xs font-semibold ${isDelayed && progreso < 100 ? 'text-error' : 'text-on-surface'}`}>{statusRealEnd}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Col (md:col-span-5): Equipo Asignado ocupando toda la tarjeta derecha */}
            <div className="md:col-span-5 flex flex-col h-full">
              <div className="bg-surface-container-low/40 rounded-xl p-4 border border-outline-variant/30 flex flex-col h-full shadow-sm justify-between">
                {/* Header de la tarjeta de equipo */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100/80">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
                      <Users size={16} />
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider text-on-surface">
                      Equipo Asignado
                    </span>
                    <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-primary/10 text-primary">
                      {localMiembros.length}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleOpenEquipoModal}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-primary hover:text-white bg-primary/10 hover:bg-primary rounded-lg border border-primary/20 hover:border-primary transition-all cursor-pointer shadow-xs"
                    title="Asignar o modificar personal del proyecto"
                  >
                    <UserPlus size={13} />
                    <span>{localMiembros.length > 0 ? "Gestionar" : "+ Asignar"}</span>
                  </button>
                </div>

                {/* Cuerpo: Lista de Personal Asignado o Estado Vacío ocupando el alto completo */}
                <div className="flex-1 flex flex-col pt-3 min-h-[160px]">
                  {localMiembros.length > 0 ? (
                    <div className="flex flex-col gap-2 overflow-y-auto max-h-[220px] pr-1">
                      {localMiembros.map((m) => {
                        const empId = m.empleado_id || m.empleado?.id;
                        const nombre = m.empleado?.usuario?.nombre || m.empleado?.nombre || "Sin nombre";
                        const cargo = m.empleado?.cargo || m.empleado?.usuario?.rol?.nombre || "Personal de Proyecto";

                        return (
                          <div
                            key={m.id || empId}
                            className="group flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-100 hover:border-primary/30 hover:shadow-sm transition-all"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/15 to-primary/5 text-primary flex items-center justify-center text-xs font-bold shrink-0 border border-primary/20 shadow-2xs">
                                {getInitials(nombre)}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-xs font-bold text-slate-800 truncate leading-tight">
                                  {nombre}
                                </span>
                                <span className="text-[10px] text-slate-400 truncate">
                                  {cargo}
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => handleRemoveMember(empId, e)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all shrink-0 ml-1"
                              title={`Desasignar a ${nombre}`}
                            >
                              <X size={13} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div
                      onClick={handleOpenEquipoModal}
                      className="flex-1 rounded-xl border border-dashed border-slate-300 hover:border-primary bg-slate-50/50 hover:bg-primary/5 cursor-pointer text-center flex flex-col items-center justify-center p-6 gap-2 transition-all group"
                    >
                      <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-primary/10 text-slate-400 group-hover:text-primary flex items-center justify-center transition-colors">
                        <UserPlus size={20} />
                      </div>
                      <span className="text-xs font-bold text-slate-700 group-hover:text-primary">
                        Sin personal asignado
                      </span>
                      <span className="text-[11px] text-slate-400 group-hover:text-primary/70 max-w-[200px] leading-snug">
                        Haz clic aquí para asignar el personal a este proyecto
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress & Financial section */}
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

      {/* Modal Asignar Equipo */}
      <AsignarEquipoModal
        open={openModalEquipo}
        onClose={() => setOpenModalEquipo(false)}
        proyecto={proyecto}
        empleados={empleados}
        loadingEmpleados={loadingEmpleados}
        onSave={handleSaveEquipo}
        saving={savingEquipo}
      />
    </section>
  );
}
