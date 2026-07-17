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

function daysBetweenInclusive(startISO, endISO) {
  if (!startISO) return null;
  const a = new Date(startISO);
  if (Number.isNaN(a.getTime())) return null;
  if (!endISO) return 1;

  const b = new Date(endISO);
  if (Number.isNaN(b.getTime())) return null;

  const a0 = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate()));
  const b0 = new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()));

  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const diff = Math.round((b0.getTime() - a0.getTime()) / MS_PER_DAY);
  return Math.max(1, diff + 1);
}

function getEmpleadoIdFromMiembro(m) {
  return (
    m?.empleado_id ||
    m?.empleado?.id ||
    m?.empleadoId ||
    null
  );
}

export default function TareaFormModal({
  open,
  onClose,
  session,
  proyectoId,
  miembros = [],
  epicas = [],
  tarea,
  presetEpicaId = null,
  onSaved,
  onSwitchTab,
}) {
  const isEdit = !!tarea?.id;

  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [estado, setEstado] = useState("pendiente");
  const [responsableId, setResponsableId] = useState("");
  const [epicaId, setEpicaId] = useState("");
  const [fechaInicioPlan, setFechaInicioPlan] = useState("");
  const [fechaFinPlan, setFechaFinPlan] = useState("");
  const [esPlanificado, setEsPlanificado] = useState(true);

  const [fechaInicioReal, setFechaInicioReal] = useState("");
  const [fechaFinReal, setFechaFinReal] = useState("");

  const [comentarioRevision, setComentarioRevision] = useState("");
  const [predecesoraId, setPredecesoraId] = useState("");
  const [requisitoTexto, setRequisitoTexto] = useState("");
  const [requisitos, setRequisitos] = useState([]);
  const [taskOptions, setTaskOptions] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    setError("");
    setBusy(false);

    setNombre(tarea?.nombre || "");
    setDescripcion(tarea?.descripcion || "");
    setEstado(tarea?.estado || "pendiente");
    setEsPlanificado(tarea?.es_planificado ?? true);
    setComentarioRevision(tarea?.comentario_revision || "");

    setResponsableId(tarea?.responsable_id || "");
    setPredecesoraId(tarea?.dependencias?.[0]?.predecesora_id || "");
    setRequisitoTexto(tarea?.requisito_texto || "");
    setRequisitos(tarea?.requisitos || []);

    const fromTarea = tarea?.epica?.id || tarea?.epica_id || "";
    setEpicaId(fromTarea || presetEpicaId || "");

    setFechaInicioPlan(toISODateInput(tarea?.fecha_inicio_plan));
    setFechaFinPlan(toISODateInput(tarea?.fecha_fin_plan));

    setFechaInicioReal(toISODateInput(tarea?.fecha_inicio_real));
    setFechaFinReal(toISODateInput(tarea?.fecha_fin_real));
  }, [open, tarea, presetEpicaId]);

  // Cargar tareas del proyecto para usarlas como requisitos (predecesoras)
  useEffect(() => {
    if (!open || !proyectoId) {
      setTaskOptions([]);
      return;
    }

    const fetchTasks = async () => {
      setLoadingTasks(true);
      try {
        const headers = makeHeaders(session);
        const res = await fetch(`${API}/tareas?proyectoId=${proyectoId}&pageSize=200`, { headers });
        const json = await res.json();
        if (json.ok) {
          const list = json.rows || json.items || [];
          // Filtrar la propia tarea que estamos editando
          const filtered = tarea?.id ? list.filter(t => t.id !== tarea.id) : list;
          setTaskOptions(filtered.map(t => ({
            id: t.id,
            nombre: t.nombre || "Sin nombre"
          })));
        }
      } catch (err) {
        console.error("Error fetching tasks for dependency selector:", err);
      } finally {
        setLoadingTasks(false);
      }
    };

    fetchTasks();
  }, [open, proyectoId, tarea?.id, session]);

  const handleAddRequisito = async (nombre, predecesora_id) => {
    if (!nombre) return;
    if (isEdit) {
      try {
        const headers = makeHeaders(session);
        const res = await fetch(`${API}/tareas-requisito/add`, {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tarea_id: tarea.id,
            nombre,
            predecesora_id,
          }),
        });
        if (!res.ok) throw new Error("No se pudo agregar el requisito");
        const json = await res.json();
        setRequisitos(prev => [...prev, json.row]);
      } catch (err) {
        console.error(err);
        setError("Error al agregar requisito: " + err.message);
      }
    } else {
      setRequisitos(prev => [...prev, { nombre, predecesora_id }]);
    }
  };

  const handleToggleRequisito = async (reqId, index, completado) => {
    if (isEdit) {
      setRequisitos(prev => prev.map(r => r.id === reqId ? { ...r, completado } : r));
      try {
        const headers = makeHeaders(session);
        const res = await fetch(`${API}/tareas-requisito/update/${reqId}`, {
          method: "PATCH",
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ completado }),
        });
        if (!res.ok) throw new Error("No se pudo actualizar el requisito");
      } catch (err) {
        console.error(err);
        setRequisitos(prev => prev.map(r => r.id === reqId ? { ...r, completado: !completado } : r));
        setError("Error al actualizar requisito: " + err.message);
      }
    } else {
      setRequisitos(prev => prev.map((r, i) => i === index ? { ...r, completado } : r));
    }
  };

  const handleDeleteRequisito = async (reqId, index) => {
    if (isEdit) {
      setRequisitos(prev => prev.filter(r => r.id !== reqId));
      try {
        const headers = makeHeaders(session);
        const res = await fetch(`${API}/tareas-requisito/delete/${reqId}`, {
          method: "DELETE",
          headers,
        });
        if (!res.ok) throw new Error("No se pudo eliminar el requisito");
      } catch (err) {
        console.error(err);
        setError("Error al eliminar requisito: " + err.message);
      }
    } else {
      setRequisitos(prev => prev.filter((_, i) => i !== index));
    }
  };

  const canSave = useMemo(() => {
    return nombre.trim().length >= 2 && !!proyectoId && !!epicaId;
  }, [nombre, proyectoId, epicaId]);

  const handleSubmit = async () => {
    if (!session?.user) return;

    if (!canSave) {
      setError(!epicaId ? "Debes seleccionar una épica" : "Completa los campos requeridos");
      return;
    }

    try {
      setBusy(true);
      setError("");

      const headers = {
        ...makeHeaders(session),
        "Content-Type": "application/json",
      };

      const diasPlan = daysBetweenInclusive(fechaInicioPlan, fechaFinPlan);
      if (!fechaInicioPlan || !diasPlan || diasPlan <= 0) {
        throw new Error("Debes indicar Inicio plan y un rango válido para calcular días plan.");
      }

      const responsableValido = responsableId
        ? miembros.some((m) => getEmpleadoIdFromMiembro(m) === responsableId)
        : true;

      const bodyCommon = {
        proyecto_id: proyectoId,
        epica_id: epicaId,
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        responsable_id: responsableValido ? (responsableId || null) : null,
        estado: estado || "pendiente",
        fecha_inicio_plan: new Date(fechaInicioPlan).toISOString(),
        dias_plan: diasPlan,
        es_planificado: esPlanificado,
        comentario_revision: comentarioRevision,
        ...(!isEdit ? { requisitos } : {}),
        ...(isEdit && fechaInicioReal ? { fecha_inicio_real: new Date(fechaInicioReal).toISOString() } : {}),
        ...(isEdit && fechaFinReal ? { fecha_fin_real: new Date(fechaFinReal).toISOString() } : {}),
      };

      const url = isEdit ? `${API}/tareas/update/${tarea.id}` : `${API}/tareas/add`;
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(bodyCommon),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || json?.message || "Error guardando tarea");

      onSaved?.();
      onClose?.();
    } catch (e) {
      setError(e?.message || "Error guardando tarea");
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => {
    if (isEdit) {
      onSaved?.();
    }
    onClose?.();
  };

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : handleClose}
      fullWidth
      maxWidth="md"
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
          <h2 className="text-xl font-bold text-[#191c1e]">{isEdit ? "Editar tarea" : "Nueva tarea"}</h2>
          <button
            onClick={handleClose}
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
              className="flex-1 py-2 font-medium text-xs rounded-md transition-all bg-white shadow-sm text-[#003d9b] font-semibold"
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
              onClick={() => onSwitchTab?.("subtarea")}
              className="flex-1 py-2 font-medium text-xs rounded-md transition-all text-[#434654] hover:text-[#191c1e]"
            >
              Subtarea
            </button>
          </div>
        )}
      </div>

      {/* Modal Content */}
      <div className="flex-1 overflow-y-auto px-8 py-4 custom-scrollbar max-h-[65vh]">
        {error ? (
          <div className="bg-red-50 border border-red-200 text-[#ba1a1a] px-4 py-3 rounded-lg text-sm mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined">error</span>
            <span>{error}</span>
          </div>
        ) : null}

        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative group">
              <label className="block text-xs font-semibold text-[#434654] mb-1 ml-1">Nombre</label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full bg-white border border-[#c3c6d6] rounded-lg p-3 text-sm focus:border-[#003d9b] focus:ring-2 focus:ring-[#003d9b]/20 transition-all outline-none"
                placeholder="Ej: Implementar autenticación OIDC"
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

            <div className="relative group">
              <label className="block text-xs font-semibold text-[#434654] mb-1 ml-1">Épica (requerida)</label>
              <div className="relative">
                <select
                  value={epicaId}
                  onChange={(e) => setEpicaId(e.target.value)}
                  className="w-full appearance-none bg-white border border-[#c3c6d6] rounded-lg p-3 text-sm focus:border-[#003d9b] focus:ring-2 focus:ring-[#003d9b]/20 transition-all outline-none pr-10"
                >
                  <option value="" disabled>
                    Selecciona una épica...
                  </option>
                  {epicas.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#737685]">
                  expand_more
                </span>
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
                    const empId = getEmpleadoIdFromMiembro(m);
                    if (!empId) return null;

                    const label =
                      m?.usuario?.nombre ||
                      m?.empleado?.usuario?.nombre ||
                      m?.nombre ||
                      m?.usuario?.correo ||
                      m?.correo ||
                      `Empleado ${empId}`;

                    return (
                      <option key={empId} value={empId}>
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
          </div>

          {/* Horizontal Divider for Requisitos */}
          <div className="flex items-center gap-4 py-2">
            <span className="material-symbols-outlined text-[#737685] text-md">assignment_late</span>
            <span className="text-xs font-bold uppercase tracking-widest text-[#737685]">
              Requisitos y pendientes ({requisitos.length})
            </span>
            <div className="h-[1px] flex-1 bg-[#c3c6d6]"></div>
          </div>

          {/* Requisitos Checklist */}
          <div className="space-y-2">
            {requisitos.map((req, idx) => (
              <div
                key={req.id || idx}
                className="flex items-center justify-between bg-[#f3f4f6] p-3 rounded-lg border border-[#c3c6d6]/50"
              >
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={req.completado || false}
                    onChange={(e) => handleToggleRequisito(req.id, idx, e.target.checked)}
                    className="w-4 h-4 rounded text-[#003d9b] border-[#c3c6d6] focus:ring-[#003d9b]/25 mr-3 cursor-pointer"
                  />
                  <span
                    className={`text-sm font-medium ${
                      req.completado ? "line-through text-[#737685]" : "text-[#191c1e]"
                    }`}
                  >
                    {req.nombre}
                    {(req.predecesora_id || req.predecesora?.id) && (
                      <span className="ml-2 text-[9px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100 font-bold uppercase">
                        Tarea
                      </span>
                    )}
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => handleDeleteRequisito(req.id, idx)}
                  className="text-[#737685] hover:text-red-600 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
            ))}

            {requisitos.length === 0 && (
              <p className="text-sm text-[#737685] italic ml-1">No hay requisitos agregados aún.</p>
            )}
          </div>

          {/* Requirement Selector Box */}
          <div className="bg-[#f3f4f6] border border-[#c3c6d6]/50 rounded-xl p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#434654] mb-2">
                  Agregar requisito desde tarea existente
                </label>
                <div className="relative">
                  <select
                    value=""
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) return;
                      const predTask = taskOptions.find((t) => t.id === val);
                      if (predTask) {
                        const inputEl = document.getElementById("modal-new-req-input");
                        if (inputEl) {
                          inputEl.value = predTask.nombre;
                          inputEl.dataset.predecesoraId = predTask.id;
                        }
                      }
                    }}
                    disabled={loadingTasks}
                    className="w-full appearance-none bg-white border border-[#c3c6d6] rounded-lg p-3 text-sm focus:border-[#003d9b] focus:ring-2 focus:ring-[#003d9b]/20 transition-all outline-none pr-10"
                  >
                    <option value="">Seleccionar tarea previa</option>
                    {taskOptions.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nombre}
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#737685]">
                    expand_more
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#434654] mb-2">
                  O escribe un requisito personalizado
                </label>
                <div className="flex gap-2">
                  <input
                    id="modal-new-req-input"
                    type="text"
                    placeholder="Ej. Tener los implementos, comprar insumos..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        document.getElementById("btn-add-req-project-modal")?.click();
                      }
                    }}
                    className="flex-1 bg-white border border-[#c3c6d6] rounded-lg p-3 text-sm focus:border-[#003d9b] focus:ring-2 focus:ring-[#003d9b]/20 transition-all outline-none"
                  />
                  <button
                    id="btn-add-req-project-modal"
                    type="button"
                    onClick={() => {
                      const inputEl = document.getElementById("modal-new-req-input");
                      const nombre = inputEl?.value?.trim();
                      const predecesora_id = inputEl?.dataset?.predecesoraId || null;
                      if (!nombre) return;
                      handleAddRequisito(nombre, predecesora_id);
                      if (inputEl) {
                        inputEl.value = "";
                        delete inputEl.dataset.predecesoraId;
                      }
                    }}
                    className="bg-[#003d9b] text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#003d9b]/90 transition-all active:scale-95 whitespace-nowrap"
                  >
                    Añadir
                  </button>
                </div>
              </div>
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
              <label className="block text-xs font-semibold text-[#434654] mb-1 ml-1">Fin plan</label>
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

          <div className="relative group">
            <label className="block text-xs font-semibold text-[#434654] mb-1 ml-1">Descripción (opcional)</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={4}
              className="w-full bg-white border border-[#c3c6d6] rounded-lg p-3 text-sm focus:border-[#003d9b] focus:ring-2 focus:ring-[#003d9b]/20 transition-all outline-none resize-none"
              placeholder="Escribe los detalles de la tarea..."
            />
          </div>

          {estado === "en_revision" && isEdit && (
            <div className="mt-4 p-4 border border-amber-200 rounded-xl bg-amber-50/50 space-y-4 col-span-1 md:col-span-2">
              <h3 className="text-sm font-bold text-amber-800 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px]">warning</span>
                Tarea en Revisión - Evidencias
              </h3>

              {tarea?.evidencias?.length > 0 && (
                <div className="space-y-3">
                  {tarea.evidencias.map((ev) => (
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
                El trabajador ha indicado que terminó esta tarea. Revisa e indica si la apruebas o la rechazas.
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
                    const ok = await handleRevisionTask(tarea.id, "reject", comentarioRevision, session, false);
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
                    const ok = await handleRevisionTask(tarea.id, "approve", comentarioRevision, session, false);
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
        <button
          type="button"
          onClick={handleClose}
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
          {isEdit ? "Guardar cambios" : "Crear tarea"}
        </button>
      </div>
    </Dialog>
  );
}