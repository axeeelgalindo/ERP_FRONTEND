"use client";

import React, { Fragment } from "react";
import {
  Add as AddIcon,
  AddTask as AddTaskIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  KeyboardArrowRight as ArrowRightIcon,
  ExpandMore as ExpandMoreIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  TaskAlt as TaskAltIcon,
  Commit as CommitIcon,
} from "@mui/icons-material";
import { Avatar, Tooltip, CircularProgress } from "@mui/material";

import ImportJiraCsvButton from "./ImportJiraCsvButton"; // ✅ AJUSTA RUTA si corresponde

function clampPct(n) {
  const v = Number(n || 0);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
}

function formatDate(d) {
  if (!d) return "—";
  try {
    const dt = typeof d === "string" ? new Date(d) : new Date(d);
    if (Number.isNaN(dt.getTime())) return "—";
    return dt.toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
  } catch {
    return "—";
  }
}

function EstadoPill({ estado }) {
  const s = String(estado || "pendiente").toLowerCase();
  const label =
    s === "completada"
      ? "Completada"
      : s === "en_progreso"
        ? "En Progreso"
        : "Pendiente";

  const cls =
    s === "completada"
      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
      : s === "en_progreso"
        ? "bg-amber-100 text-amber-700 border-amber-200"
        : "bg-slate-100 text-slate-700 border-slate-200";

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${cls}`}>
      {label}
    </span>
  );
}

function AvatarMini({ label }) {
  const txt = String(label || "").trim();
  const initials = txt
    ? txt
        .split(" ")
        .slice(0, 2)
        .map((x) => x[0]?.toUpperCase())
        .join("")
    : "—";

  return (
    <Avatar
      sx={{
        width: 24,
        height: 24,
        fontSize: 11,
        border: "1px solid #E2E8F0",
      }}
    >
      {initials}
    </Avatar>
  );
}

export default function TasksTreePremium({
  proyectoId, // ✅ NUEVO (OBLIGATORIO para importar)
  epicasAgrupadas = [],
  expandedEpicaIds = [],
  expandedTareaIds = [],
  deletingId = null,

  // toggles
  onToggleEpica,
  onToggleTarea,

  // header actions
  onOpenNewEpica,
  onOpenWizard,
  onOpenNewTarea,

  // reload after import
  reloadEpicas, // ✅ opcional, si lo tienes en el padre

  // epica actions
  onEditEpica,
  onNewTareaInEpica,

  // tarea actions
  onEditTarea,
  onDeleteTarea,

  // subtarea actions
  onNewSubtareaInTarea,
  onEditSubtarea,

  // subtarea action cell (start/finish/reset)
  renderSubtareaAccionCell,
}) {
  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 md:p-6 gap-3 border-b border-slate-200 bg-white">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-1">Tareas del proyecto</h2>
          <p className="text-sm text-slate-500 font-medium">Épicas → Tareas → Subtareas</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
            type="button"
            onClick={onOpenNewEpica}
          >
            <AddIcon sx={{ fontSize: 18 }} />
            AGREGAR ÉPICA
          </button>

          <button
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-blue-600 text-blue-600 rounded text-xs font-semibold shadow-sm hover:bg-blue-50 transition-colors"
            type="button"
            onClick={onOpenWizard}
          >
            <AddIcon sx={{ fontSize: 18 }} />
            CREAR MASIVO
          </button>

          <button
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-md transition-all"
            type="button"
            onClick={onOpenNewTarea}
          >
            <AddTaskIcon sx={{ fontSize: 18 }} />
            AGREGAR TAREA
          </button>

          {/* ✅ IMPORT JIRA */}
          <ImportJiraCsvButton
            proyectoId={proyectoId}
            onDone={async () => {
              if (reloadEpicas) await reloadEpicas();
            }}
          />
        </div>
      </div>

      {/* TABLE HEAD */}
      <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider items-center">
        <div className="col-span-4 pl-8">Nombre / Estructura</div>
        <div className="col-span-2">Responsable</div>
        <div className="col-span-1 text-center">Estado</div>
        <div className="col-span-1">Inicio Plan</div>
        <div className="col-span-1">Fin Plan</div>
        <div className="col-span-2">Avance</div>
        <div className="col-span-1 text-right">Acciones</div>
      </div>

      {/* BODY */}
      <div>
        {epicasAgrupadas.map((ep) => {
          const expandedEp = expandedEpicaIds.includes(ep.id);
          const epIsSinEpica = ep.id === "SIN_EPICA";

          return (
            <Fragment key={ep.id}>
              {/* EPICA ROW */}
              <div className={`group border-b border-slate-200 hover:bg-slate-50 transition-colors relative ${epIsSinEpica ? "bg-orange-50/40" : ""}`}>
                <div className="grid grid-cols-12 gap-4 px-6 py-5 items-center">
                  <div className="col-span-4 flex items-center gap-3">
                    <button
                      className="p-1 rounded-md hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-all"
                      type="button"
                      onClick={(ev) => onToggleEpica?.(ep.id, ev)}
                    >
                      {expandedEp ? <ExpandMoreIcon sx={{ fontSize: 20 }} /> : <ArrowRightIcon sx={{ fontSize: 20 }} />}
                    </button>

                    <div className="flex items-start gap-2.5">
                      {epIsSinEpica ? (
                        <FolderOpenIcon sx={{ fontSize: 20, color: "#FB923C" }} />
                      ) : (
                        <FolderIcon sx={{ fontSize: 20, color: "#94A3B8" }} />
                      )}

                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-slate-900 leading-tight">{ep.nombre}</span>
                        <span className={`text-[10px] font-medium ${epIsSinEpica ? "text-orange-500" : "text-slate-400"}`}>
                          {epIsSinEpica ? "Tareas sin asignar" : ""}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-2" />
                  <div className="col-span-1 flex justify-center">
                    <EstadoPill estado={ep.stats?.estado} />
                  </div>

                  <div className="col-span-1 text-xs font-medium text-slate-600">
                    {formatDate(ep.stats?.fecha_inicio_plan)}
                  </div>
                  <div className="col-span-1 text-xs font-medium text-slate-600">
                    {formatDate(ep.stats?.fecha_fin_plan)}
                  </div>

                  <div className="col-span-2 flex items-center gap-3">
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-blue-600 h-1.5 rounded-full shadow-sm" style={{ width: `${clampPct(ep.stats?.avance)}%` }} />
                    </div>
                    <span className="text-xs font-bold text-slate-600 w-8 text-right">{clampPct(ep.stats?.avance)}%</span>
                  </div>

                  <div className="col-span-1 flex justify-end">
                    {epIsSinEpica ? null : (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Tooltip title="Agregar tarea en esta épica">
                          <button
                            className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-all"
                            type="button"
                            onClick={() => onNewTareaInEpica?.(ep)}
                          >
                            <AddIcon sx={{ fontSize: 18 }} />
                          </button>
                        </Tooltip>

                        <Tooltip title="Editar épica">
                          <button
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all"
                            type="button"
                            onClick={() => onEditEpica?.(ep)}
                          >
                            <EditIcon sx={{ fontSize: 18 }} />
                          </button>
                        </Tooltip>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* EPICA CONTENT */}
              {expandedEp ? (
                <div className="bg-white">
                  {(ep.tareas || []).map((t) => {
                    const expandedT = expandedTareaIds.includes(t.id);
                    const responsableNombre =
                      t.responsable?.usuario?.nombre || t.responsable?.usuario?.correo || "—";

                    const detalles = t.detalles || t.detalle || t.tareasDetalle || [];

                    return (
                      <Fragment key={t.id}>
                        {/* TAREA ROW */}
                        <div className="group border-b border-slate-200 bg-slate-50/40 hover:bg-slate-100/60 transition-colors relative">
                          <div className="grid grid-cols-12 gap-4 px-6 py-4 items-center">
                            <div className="col-span-4 flex items-center gap-3 pl-8 relative">
                              <div className="absolute left-[1.35rem] -top-1/2 bottom-1/2 w-px bg-slate-200 h-[200%]" />
                              <div className="absolute left-[1.35rem] top-1/2 w-5 h-px bg-slate-200" />

                              <button
                                className="p-1 rounded-md hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-all relative z-10 bg-white shadow-sm border border-slate-100"
                                type="button"
                                onClick={(ev) => onToggleTarea?.(t.id, ev)}
                              >
                                {expandedT ? <ExpandMoreIcon sx={{ fontSize: 20 }} /> : <ArrowRightIcon sx={{ fontSize: 20 }} />}
                              </button>

                              <div className="flex items-start gap-2.5">
                                <TaskAltIcon sx={{ fontSize: 20, color: "#2563EB" }} />
                                <div className="flex flex-col">
                                  <span
                                    className="font-semibold text-sm text-slate-800 cursor-pointer"
                                    onClick={() => onEditTarea?.(t)}
                                  >
                                    {t.nombre}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    ({detalles.filter((d) => d.estado === "completada").length}/{detalles.length} subtareas)
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="col-span-2 flex items-center gap-2">
                              <AvatarMini label={responsableNombre} />
                              <span className="text-xs text-slate-600 truncate">{responsableNombre}</span>
                            </div>

                            <div className="col-span-1 flex justify-center">
                              <EstadoPill estado={t.estado} />
                            </div>

                            <div className="col-span-1 text-xs font-medium text-slate-600">
                              {formatDate(t.fecha_inicio_plan)}
                            </div>
                            <div className="col-span-1 text-xs font-medium text-slate-600">
                              {formatDate(t.fecha_fin_plan)}
                            </div>

                            <div className="col-span-2 flex items-center gap-3">
                              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div className="bg-blue-600 h-1.5 rounded-full shadow-sm" style={{ width: `${clampPct(t.avance)}%` }} />
                              </div>
                              <span className="text-xs font-bold text-slate-600 w-8 text-right">{clampPct(t.avance)}%</span>
                            </div>

                            <div className="col-span-1 flex justify-end">
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Tooltip title="Editar tarea">
                                  <button
                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all"
                                    type="button"
                                    onClick={() => onEditTarea?.(t)}
                                  >
                                    <EditIcon sx={{ fontSize: 18 }} />
                                  </button>
                                </Tooltip>

                                <Tooltip title="Eliminar tarea">
                                  <button
                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all disabled:opacity-60"
                                    type="button"
                                    disabled={deletingId === t.id}
                                    onClick={(ev) => onDeleteTarea?.(t, ev)}
                                  >
                                    {deletingId === t.id ? <CircularProgress size={16} /> : <DeleteIcon sx={{ fontSize: 18 }} />}
                                  </button>
                                </Tooltip>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* SUBTAREAS */}
                        {expandedT ? (
                          <div>
                            {detalles.map((d) => {
                              const respNombre =
                                d.responsable?.usuario?.nombre || d.responsable?.usuario?.correo || "—";

                              return (
                                <div
                                  key={d.id}
                                  className="group border-b border-slate-200 bg-white hover:bg-slate-50 transition-colors relative"
                                >
                                  <div className="grid grid-cols-12 gap-4 px-6 py-3 items-center">
                                    <div className="col-span-4 flex items-center gap-3 pl-16 relative">
                                      <div className="absolute left-[1.35rem] -top-1/2 bottom-1/2 w-px bg-slate-200 h-[200%]" />
                                      <div className="absolute left-[3.35rem] -top-1/2 bottom-1/2 w-px bg-slate-200 h-[100%]" />
                                      <div className="absolute left-[3.35rem] top-1/2 w-5 h-px bg-slate-200" />

                                      <CommitIcon sx={{ fontSize: 16, color: "#CBD5E1" }} />
                                      <span className="text-sm text-slate-600 font-medium">{d.titulo}</span>
                                    </div>

                                    <div className="col-span-2 flex items-center gap-2">
                                      <AvatarMini label={respNombre} />
                                      <span className="text-xs text-slate-600 truncate">{respNombre}</span>
                                    </div>

                                    <div className="col-span-1 flex justify-center">
                                      <EstadoPill estado={d.estado} />
                                    </div>

                                    <div className="col-span-1 text-xs font-medium text-slate-600">
                                      {formatDate(d.fecha_inicio_plan)}
                                    </div>
                                    <div className="col-span-1 text-xs font-medium text-slate-600">
                                      {formatDate(d.fecha_fin_plan)}
                                    </div>

                                    <div className="col-span-2 flex items-center gap-3">
                                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                        <div className="bg-blue-600 h-1.5 rounded-full shadow-sm" style={{ width: `${clampPct(d.avance)}%` }} />
                                      </div>
                                      <span className="text-xs font-bold text-slate-600 w-8 text-right">{clampPct(d.avance)}%</span>
                                    </div>

                                    <div className="col-span-1 flex justify-end">
                                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {renderSubtareaAccionCell ? renderSubtareaAccionCell(d) : null}

                                        <Tooltip title="Editar subtarea">
                                          <button
                                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all"
                                            type="button"
                                            onClick={() => onEditSubtarea?.(t, d)}
                                          >
                                            <EditIcon sx={{ fontSize: 18 }} />
                                          </button>
                                        </Tooltip>

                                        <Tooltip title="Eliminar subtarea">
                                          <button
                                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
                                            type="button"
                                            onClick={() => onEditSubtarea?.(t, { ...d, __delete: true })}
                                          >
                                            <DeleteIcon sx={{ fontSize: 18 }} />
                                          </button>
                                        </Tooltip>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}

                            {/* Add subtarea row */}
                            <div className="group border-b border-slate-200 bg-white hover:bg-slate-50 transition-colors relative">
                              <div className="grid grid-cols-12 gap-4 px-6 py-2 items-center">
                                <div className="col-span-4 flex items-center gap-3 pl-16 relative">
                                  <div className="absolute left-[1.35rem] -top-1/2 bottom-1/2 w-px bg-slate-200 h-[200%]" />
                                  <div className="absolute left-[3.35rem] -top-1/2 w-px bg-slate-200 h-[100%]" />
                                  <div className="absolute left-[3.35rem] top-1/2 w-5 h-px bg-slate-200" />

                                  <button
                                    className="flex items-center gap-2 px-3 py-1.5 bg-transparent hover:bg-blue-50/50 border border-dashed border-blue-600/30 hover:border-blue-600/60 text-blue-600 rounded-md text-xs font-medium transition-all opacity-70 hover:opacity-100"
                                    type="button"
                                    onClick={() => onNewSubtareaInTarea?.(t)}
                                  >
                                    <AddIcon sx={{ fontSize: 16 }} />
                                    Agregar subtarea
                                  </button>
                                </div>
                                <div className="col-span-8" />
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </div>
              ) : null}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}