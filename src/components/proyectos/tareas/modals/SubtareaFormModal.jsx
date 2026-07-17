"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Box,
  MenuItem,
  FormControlLabel,
  Switch,
  FormControl,
  InputLabel,
  Select,
  Typography,
} from "@mui/material";
import { makeHeaders } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL;

async function handleRevisionTask(id, action, comentario, session, isSubtarea) {
  try {
    const estadoParams = action === "approve" ? "completada" : "en_progreso";
      const body = {
        estado: estadoParams,
        comentario_revision: comentario,
        ...(action === "approve" ? { 
          avance: 100,
          fecha_fin_real: new Date().toISOString()
        } : {})
      };
    const endpoint = isSubtarea ? `tareas-detalle/update/${id}` : `tareas/update/${id}`;
    
    const res = await fetch(`${API}/${endpoint}`, {
      method: "PATCH",
      headers: { ...makeHeaders(session), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("Error en revisión");
    return true;
  } catch (err) {
    alert("Error al guardar revisión: " + err.message);
    return false;
  }
}


const ESTADOS = [
  { value: "pendiente", label: "Pendiente" },
  { value: "en_progreso", label: "En progreso" },
  { value: "en_revision", label: "En Revisión" },
  { value: "completada", label: "Completada" },
];

function toISODateInput(d) {
  if (!d) return "";
  try {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return "";
    const yyyy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(dt.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return "";
  }
}

function daysBetweenInclusive(dateStartStr, dateEndStr) {
  if (!dateStartStr) return null;
  const a = new Date(dateStartStr);
  if (Number.isNaN(a.getTime())) return null;
  if (!dateEndStr) return 1;

  const b = new Date(dateEndStr);
  if (Number.isNaN(b.getTime())) return null;

  const a0 = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate()));
  const b0 = new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()));

  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const diff = Math.round((b0.getTime() - a0.getTime()) / MS_PER_DAY);
  return Math.max(1, diff + 1);
}

export default function SubtareaFormModal({
  open,
  onClose,
  session,
  tarea,
  miembros = [],
  subtarea,
  onSaved,
  onSwitchTab,
}) {
  const isEdit = !!subtarea?.id;

  const [titulo, setTitulo] = useState("");
  const [estado, setEstado] = useState("pendiente");
  const [responsableId, setResponsableId] = useState("");
  const [esPlanificado, setEsPlanificado] = useState(true);
  const [avance, setAvance] = useState(0);

  const [fechaInicioPlan, setFechaInicioPlan] = useState("");
  const [fechaFinPlan, setFechaFinPlan] = useState("");
  const [diasPlanManual, setDiasPlanManual] = useState("");

  const [fechaInicioReal, setFechaInicioReal] = useState("");
  const [fechaFinReal, setFechaFinReal] = useState("");

  const [comentarioRevision, setComentarioRevision] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    setError("");
    setBusy(false);

    setTitulo(subtarea?.titulo || "");
    setEstado(subtarea?.estado || "pendiente");
    setAvance(subtarea?.avance || 0);
    setEsPlanificado(subtarea?.es_planificado ?? true);
    setComentarioRevision(subtarea?.comentario_revision || "");

    setResponsableId(
      subtarea?.responsable_id ||
        subtarea?.responsable?.id ||
        subtarea?.responsable?.usuario_id ||
        ""
    );

    const fip = toISODateInput(subtarea?.fecha_inicio_plan);
    const ffp = toISODateInput(subtarea?.fecha_fin_plan);

    setFechaInicioPlan(fip);
    setFechaFinPlan(ffp);

    setFechaInicioReal(toISODateInput(subtarea?.fecha_inicio_real));
    setFechaFinReal(toISODateInput(subtarea?.fecha_fin_real));

    setDiasPlanManual(subtarea?.dias_plan != null ? String(subtarea.dias_plan) : "");
  }, [open, subtarea]);

  const diasPlanComputed = useMemo(() => {
    const d = daysBetweenInclusive(fechaInicioPlan, fechaFinPlan);
    return d;
  }, [fechaInicioPlan, fechaFinPlan]);

  const diasPlanFinal = useMemo(() => {
    if (diasPlanComputed != null) return diasPlanComputed;
    const n = Number(diasPlanManual);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.trunc(n);
  }, [diasPlanComputed, diasPlanManual]);

  const canSave = useMemo(() => {
    return titulo.trim().length >= 2 && !!tarea?.id && !!fechaInicioPlan && diasPlanFinal != null;
  }, [titulo, tarea?.id, fechaInicioPlan, diasPlanFinal]);

  const handleSubmit = async () => {
    if (!session?.user) return;
    if (!canSave) return;

    try {
      setBusy(true);
      setError("");

      const headers = {
        ...makeHeaders(session),
        "Content-Type": "application/json",
      };

      if (!isEdit) {
        const body = {
          tarea_id: tarea.id,
          titulo: titulo.trim(),
          descripcion: null,
          responsable_id: responsableId || null,
          estado,
          fecha_inicio_plan: new Date(fechaInicioPlan).toISOString(),
          dias_plan: diasPlanFinal,
          es_planificado: esPlanificado,
        };

        const res = await fetch(`${API}/tareas-detalle/add`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error || json?.message || "Error creando subtarea");

        onSaved?.();
        onClose?.();
        return;
      }

      const body = {
        titulo: titulo.trim(),
        responsable_id: responsableId || null,
        estado,
        fecha_inicio_plan: new Date(fechaInicioPlan).toISOString(),
        dias_plan: diasPlanFinal,
        es_planificado: esPlanificado,
        comentario_revision: comentarioRevision,
        avance,
        ...(fechaInicioReal ? { fecha_inicio_real: new Date(fechaInicioReal).toISOString() } : {}),
        ...(fechaFinReal ? { fecha_fin_real: new Date(fechaFinReal).toISOString() } : {}),
      };

      const res = await fetch(`${API}/tareas-detalle/update/${subtarea.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || json?.message || "Error actualizando subtarea");

      onSaved?.();
      onClose?.();
    } catch (e) {
      setError(e?.message || "Error guardando subtarea");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!session?.user) return;
    if (!subtarea?.id) return;
    if (!window.confirm("¿Eliminar esta subtarea?")) return;

    try {
      setBusy(true);
      setError("");

      const headers = { ...makeHeaders(session) };

      const res = await fetch(`${API}/tareas-detalle/delete/${subtarea.id}`, {
        method: "DELETE",
        headers,
        body: JSON.stringify({}),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || json?.message || "Error eliminando subtarea");

      onSaved?.();
      onClose?.();
    } catch (e) {
      setError(e?.message || "Error eliminando subtarea");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          borderRadius: "16px",
          overflow: "hidden",
          bgcolor: "#ffffff",
          boxShadow: "0 25px 50px -12px rgb(0 0 0 / 0.25)",
        },
      }}
    >
      {/* Modal Header */}
      <div className="px-8 pt-8 pb-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-[#191c1e]">{isEdit ? "Editar subtarea" : "Nueva subtarea"}</h2>
          <button
            onClick={onClose}
            disabled={busy}
            className="text-[#737685] hover:text-[#191c1e] transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Tab Navigation */}
        {!isEdit && (
          <div className="flex w-full bg-[#f3f4f6] rounded-lg p-1">
            <button
              type="button"
              onClick={() => onSwitchTab?.("tarea")}
              className="flex-1 py-2 font-medium text-xs rounded-md transition-all text-[#434654] hover:text-[#191c1e]"
            >
              Tarea
            </button>
            <button
              type="button"
              onClick={() => onSwitchTab?.("epica")}
              className="flex-1 py-2 font-medium text-xs rounded-md transition-all text-[#434654] hover:text-[#191c1e]"
            >
              Épica
            </button>
            <button
              type="button"
              className="flex-1 py-2 font-medium text-xs rounded-md transition-all bg-white shadow-sm text-[#003d9b] font-semibold"
            >
              Subtarea
            </button>
          </div>
        )}
      </div>

      {/* Modal Content */}
      <div className="flex-1 overflow-y-auto px-8 py-4 custom-scrollbar max-h-[60vh]">
        {error ? (
          <div className="bg-red-50 border border-red-200 text-[#ba1a1a] px-4 py-3 rounded-lg text-sm mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined">error</span>
            <span>{error}</span>
          </div>
        ) : null}

        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative group">
              <label className="block text-xs font-semibold text-[#434654] mb-1 ml-1">Título</label>
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                autoFocus
                className="w-full bg-white border border-[#c3c6d6] rounded-lg p-3 text-sm focus:border-[#003d9b] focus:ring-2 focus:ring-[#003d9b]/20 transition-all outline-none"
                placeholder="Ej: Configurar base de datos"
              />
            </div>

            <div className="relative group">
              <label className="block text-xs font-semibold text-[#434654] mb-1 ml-1">Estado</label>
              <div className="relative">
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  className="w-full appearance-none bg-white border border-[#c3c6d6] rounded-lg p-3 text-sm focus:border-[#003d9b] focus:ring-2 focus:ring-[#003d9b]/20 transition-all outline-none pr-10"
                >
                  {ESTADOS.map((x) => (
                    <option key={x.value} value={x.value}>
                      {x.label}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#737685]">
                  expand_more
                </span>
              </div>
            </div>
          </div>

          <div className="relative group">
            <label className="block text-xs font-semibold text-[#434654] mb-1 ml-1">Responsable (opcional)</label>
            <div className="relative">
              <select
                value={responsableId}
                onChange={(e) => setResponsableId(e.target.value)}
                className="w-full appearance-none bg-white border border-[#c3c6d6] rounded-lg p-3 text-sm focus:border-[#003d9b] focus:ring-2 focus:ring-[#003d9b]/20 transition-all outline-none pr-10"
              >
                <option value="">Sin asignar</option>
                {miembros.map((m) => {
                  const id = m?.empleado_id || m?.empleado?.id || null;
                  const label =
                    m?.usuario?.nombre ||
                    m?.empleado?.usuario?.nombre ||
                    m?.nombre ||
                    m?.usuario?.correo ||
                    m?.correo ||
                    `Empleado ${id}`;
                  if (!id) return null;
                  return (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  );
                })}
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#737685]">
                person_add
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative group">
              <label className="block text-xs font-semibold text-[#434654] mb-1 ml-1">Inicio plan</label>
              <div className="relative">
                <input
                  type="date"
                  value={fechaInicioPlan}
                  onChange={(e) => setFechaInicioPlan(e.target.value)}
                  className="w-full bg-white border border-[#c3c6d6] rounded-lg p-3 text-sm focus:border-[#003d9b] focus:ring-2 focus:ring-[#003d9b]/20 outline-none pr-10"
                />
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#737685]">
                  calendar_today
                </span>
              </div>
            </div>

            <div className="relative group">
              <label className="block text-xs font-semibold text-[#434654] mb-1 ml-1">Fin plan (opcional)</label>
              <div className="relative">
                <input
                  type="date"
                  value={fechaFinPlan}
                  onChange={(e) => setFechaFinPlan(e.target.value)}
                  className="w-full bg-white border border-[#c3c6d6] rounded-lg p-3 text-sm focus:border-[#003d9b] focus:ring-2 focus:ring-[#003d9b]/20 outline-none pr-10"
                />
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#737685]">
                  event_busy
                </span>
              </div>
            </div>
          </div>

          {isEdit && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative group">
                <label className="block text-xs font-semibold text-[#434654] mb-1 ml-1">Inicio real (manual)</label>
                <div className="relative">
                  <input
                    type="date"
                    value={fechaInicioReal}
                    onChange={(e) => setFechaInicioReal(e.target.value)}
                    className="w-full bg-white border border-[#c3c6d6] rounded-lg p-3 text-sm focus:border-[#003d9b] focus:ring-2 focus:ring-[#003d9b]/20 outline-none pr-10"
                  />
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#737685]">
                    calendar_today
                  </span>
                </div>
              </div>
              <div className="relative group">
                <label className="block text-xs font-semibold text-[#434654] mb-1 ml-1">Fin real (manual)</label>
                <div className="relative">
                  <input
                    type="date"
                    value={fechaFinReal}
                    onChange={(e) => setFechaFinReal(e.target.value)}
                    className="w-full bg-white border border-[#c3c6d6] rounded-lg p-3 text-sm focus:border-[#003d9b] focus:ring-2 focus:ring-[#003d9b]/20 outline-none pr-10"
                  />
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#737685]">
                    event_busy
                  </span>
                </div>
              </div>
            </div>
          )}

          {diasPlanComputed != null ? (
            <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-500">info</span>
              <span>Días plan calculados: <strong>{diasPlanComputed}</strong></span>
            </div>
          ) : (
            <div className="relative group">
              <label className="block text-xs font-semibold text-[#434654] mb-1 ml-1">Días plan</label>
              <input
                type="number"
                min={1}
                value={diasPlanManual}
                onChange={(e) => setDiasPlanManual(e.target.value)}
                className="w-full bg-white border border-[#c3c6d6] rounded-lg p-3 text-sm focus:border-[#003d9b] focus:ring-2 focus:ring-[#003d9b]/20 transition-all outline-none"
                placeholder="Ej: 5"
              />
            </div>
          )}

          <div className="flex items-center justify-between p-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEsPlanificado(!esPlanificado)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  esPlanificado ? "bg-[#003d9b]" : "bg-[#c3c6d6]"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    esPlanificado ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
              <span className="text-sm text-[#191c1e] font-medium">Definido en Planificación Inicial</span>
            </div>
          </div>

          {estado === "en_revision" && isEdit && (
            <div className="mt-4 p-4 border border-amber-200 rounded-xl bg-amber-50/50 space-y-4">
              <h3 className="text-sm font-bold text-amber-800 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px]">warning</span>
                Subtarea en Revisión - Evidencias
              </h3>

              {subtarea?.evidencias?.length > 0 && (
                <div className="space-y-3">
                  {subtarea.evidencias.map((ev) => (
                    <div key={ev.id} className="p-3 bg-white rounded-lg border border-slate-200 shadow-sm space-y-2">
                      <span className="block text-[10px] font-bold text-slate-500">
                        Enviado el {new Date(ev.creado_en).toLocaleString()}
                      </span>
                      {ev.comentario && (
                        <p className="text-xs text-slate-700 italic">
                          "{ev.comentario}"
                        </p>
                      )}
                      {ev.archivo_url && (
                        <div className="mt-1 rounded-lg overflow-hidden border border-slate-100">
                          {ev.archivo_url.toLowerCase().match(/\.(mp4|webm|ogg)$/) ? (
                            <video controls className="w-full max-h-[240px] block">
                              <source src={`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}${ev.archivo_url}`} />
                            </video>
                          ) : (
                            <img
                              src={`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}${ev.archivo_url}`}
                              alt="Evidencia"
                              className="w-full max-h-[300px] object-contain block cursor-pointer"
                              onClick={() => window.open(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}${ev.archivo_url}`, '_blank')}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-slate-600">
                El trabajador ha indicado que terminó esta subtarea. Revisa e indica si la apruebas o la rechazas.
              </p>

              <textarea
                value={comentarioRevision}
                onChange={(e) => setComentarioRevision(e.target.value)}
                rows={2}
                className="w-full bg-white border border-[#c3c6d6] rounded-lg p-3 text-sm focus:border-[#003d9b] focus:ring-2 focus:ring-[#003d9b]/20 outline-none resize-none"
                placeholder="Comentario al Trabajador..."
              />

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={async () => {
                    setBusy(true);
                    const ok = await handleRevisionTask(subtarea.id, "reject", comentarioRevision, session, true);
                    if (ok) { onSaved?.(); onClose?.(); }
                    setBusy(false);
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
                >
                  Rechazar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setBusy(true);
                    const ok = await handleRevisionTask(subtarea.id, "approve", comentarioRevision, session, true);
                    if (ok) { onSaved?.(); onClose?.(); }
                    setBusy(false);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
                >
                  Aprobar (Completar)
                </button>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Modal Footer */}
      <div className="px-8 py-6 bg-[#f3f4f6] flex justify-end items-center gap-3 border-t border-[#c3c6d6]/30">
        {isEdit ? (
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            className="mr-auto text-red-600 hover:text-red-700 font-semibold text-sm transition-colors uppercase tracking-wide"
          >
            Eliminar
          </button>
        ) : null}

        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="text-[#003d9b] font-semibold text-sm px-4 py-2 rounded-lg hover:bg-[#003d9b]/5 transition-colors uppercase tracking-wide"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSave || busy}
          className={`font-semibold text-sm px-6 py-2.5 rounded-lg uppercase tracking-wide flex items-center gap-2 transition-all ${
            canSave && !busy
              ? "bg-[#003d9b] text-white hover:bg-[#003d9b]/90 shadow-md active:scale-95 cursor-pointer"
              : "bg-[#e1e2e4] text-[#737685] cursor-not-allowed"
          }`}
        >
          {busy && <CircularProgress size={16} color="inherit" />}
          {isEdit ? "Guardar cambios" : "Crear subtarea"}
        </button>
      </div>
    </Dialog>
  );
}