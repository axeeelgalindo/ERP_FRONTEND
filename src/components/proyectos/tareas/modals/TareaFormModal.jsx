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
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
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

  const a0 = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const b0 = new Date(b.getFullYear(), b.getMonth(), b.getDate());

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
    <Dialog open={open} onClose={busy ? undefined : handleClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 900 }}>
        {isEdit ? "Editar tarea" : "Nueva tarea"}
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : null}

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: 2,
          }}
        >
          <TextField
            label="Nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            fullWidth
          />

          <TextField
            select
            label="Estado"
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            fullWidth
          >
            {ESTADOS.map((x) => (
              <MenuItem key={x.value} value={x.value}>
                {x.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Épica (requerida)"
            value={epicaId}
            onChange={(e) => setEpicaId(e.target.value)}
            fullWidth
          >
            <MenuItem value="" disabled>
              Selecciona una épica...
            </MenuItem>
            {epicas.map((e) => (
              <MenuItem key={e.id} value={e.id}>
                {e.nombre}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Responsable (opcional)"
            value={responsableId}
            onChange={(e) => setResponsableId(e.target.value)}
            fullWidth
          >
            <MenuItem value="">Sin asignar</MenuItem>
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
                <MenuItem key={empId} value={empId}>
                  {label}
                </MenuItem>
              );
            })}
          </TextField>

          {/* Requisitos Checklist */}
          <Box sx={{ mt: 2, pt: 2, borderTop: "1px solid #e2e8f0" }}>
            <Typography variant="caption" sx={{ fontWeight: "bold", color: "text.secondary", textTransform: "uppercase", tracking: "0.1em", display: "flex", alignItems: "center", gap: 0.5, mb: 1 }}>
              <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>playlist_add_check</span>
              Requisitos y Pendientes ({requisitos.length})
            </Typography>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mb: 2 }}>
              {requisitos.map((req, idx) => (
                <Box
                  key={req.id || idx}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    bgcolor: "action.hover",
                    p: 1,
                    px: 1.5,
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <FormControlLabel
                    control={
                      <input
                        type="checkbox"
                        checked={req.completado || false}
                        onChange={(e) => handleToggleRequisito(req.id, idx, e.target.checked)}
                        style={{ marginRight: "8px", width: "16px", height: "16px", cursor: "pointer" }}
                      />
                    }
                    label={
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 500,
                          textDecoration: req.completado ? "line-through" : "none",
                          color: req.completado ? "text.secondary" : "text.primary",
                        }}
                      >
                        {req.nombre}
                        {(req.predecesora_id || req.predecesora?.id) && (
                          <span style={{ marginLeft: "8px", fontSize: "9px", background: "#eff6ff", color: "#2563eb", padding: "2px 6px", borderRadius: "4px", fontWeight: "bold", border: "1px solid #dbeafe" }}>
                            TAREA
                          </span>
                        )}
                      </Typography>
                    }
                    sx={{ m: 0 }}
                  />

                  <button
                    type="button"
                    onClick={() => handleDeleteRequisito(req.id, idx)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#94a3b8",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.color = "#ef4444")}
                    onMouseOut={(e) => (e.currentTarget.style.color = "#94a3b8")}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>delete</span>
                  </button>
                </Box>
              ))}

              {requisitos.length === 0 && (
                <Typography variant="body2" sx={{ fontStyle: "italic", color: "text.secondary" }}>
                  No hay requisitos agregados aún.
                </Typography>
              )}
            </Box>

            {/* Agregar Requisito */}
            <Box sx={{ bgcolor: "action.hover", border: "1px solid", borderColor: "divider", p: 2, borderRadius: 3, display: "flex", flexDirection: "column", gap: 1.5 }}>
              <Typography variant="caption" sx={{ fontWeight: "bold", color: "text.secondary", textTransform: "uppercase" }}>
                Agregar Requisito desde Tarea Existente
              </Typography>
              <TextField
                select
                label="Seleccionar tarea previa"
                value=""
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) return;
                  const predTask = taskOptions.find(t => t.id === val);
                  if (predTask) {
                    const inputEl = document.getElementById("modal-new-req-input");
                    if (inputEl) {
                      inputEl.value = predTask.nombre;
                      inputEl.dataset.predecesoraId = predTask.id;
                    }
                  }
                }}
                fullWidth
                size="small"
                disabled={loadingTasks}
              >
                <MenuItem value="">-- Ninguna --</MenuItem>
                {taskOptions.map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.nombre}
                  </MenuItem>
                ))}
              </TextField>

              <Typography variant="caption" sx={{ fontWeight: "bold", color: "text.secondary", textTransform: "uppercase" }}>
                O escribe un Requisito Personalizado
              </Typography>
              <Box sx={{ display: "flex", gap: 1 }}>
                <input
                  id="modal-new-req-input"
                  type="text"
                  placeholder="Ej. Tener los implementos, comprar insumos..."
                  style={{
                    flex: 1,
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    fontSize: "13px",
                    outline: "none",
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      document.getElementById("btn-add-req-project-modal")?.click();
                    }
                  }}
                />
                <Button
                  id="btn-add-req-project-modal"
                  variant="contained"
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
                  sx={{ textTransform: "none", fontWeight: "bold" }}
                >
                  Añadir
                </Button>
              </Box>
            </Box>
          </Box>

          <TextField
            label="Inicio plan"
            type="date"
            value={fechaInicioPlan}
            onChange={(e) => setFechaInicioPlan(e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />

          <TextField
            label="Fin plan"
            type="date"
            value={fechaFinPlan}
            onChange={(e) => setFechaFinPlan(e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />

          {isEdit && (
            <>
              <TextField
                label="Inicio real (manual)"
                type="date"
                value={fechaInicioReal}
                onChange={(e) => setFechaInicioReal(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label="Fin real (manual)"
                type="date"
                value={fechaFinReal}
                onChange={(e) => setFechaFinReal(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </>
          )}

          <FormControlLabel
            control={<Switch checked={esPlanificado} onChange={(e) => setEsPlanificado(e.target.checked)} color="primary" />}
            label="Definido en Planificación Inicial"
            sx={{ gridColumn: { xs: "1 / -1", md: "1 / -1" } }}
          />

          <TextField
            label="Descripción (opcional)"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            multiline
            minRows={3}
            fullWidth
            sx={{ gridColumn: { xs: "1 / -1", md: "1 / -1" } }}
          />

          {estado === "en_revision" && isEdit && (
            <Box sx={{ mt: 3, p: 2, border: '1px solid', borderColor: 'warning.main', borderRadius: 2, bgcolor: 'warning.light', gridColumn: { xs: "1 / -1", md: "1 / -1" } }}>
              <Typography variant="subtitle2" color="warning.dark" sx={{ mb: 1, fontWeight: 'bold' }}>
                Tarea en Revisión - Evidencias
              </Typography>
              
              {/* ✅ VISUALIZACIÓN DE EVIDENCIAS SUBIDAS POR TRABAJADOR */}
              {tarea?.evidencias?.length > 0 && (
                <Box sx={{ mb: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {tarea.evidencias.map((ev) => (
                    <Box key={ev.id} sx={{ p: 1.5, bgcolor: 'white', borderRadius: 1, border: '1px solid #e0e0e0' }}>
                      <Typography variant="caption" sx={{ display: 'block', mb: 0.5, fontWeight: 'bold', color: 'text.secondary' }}>
                        Enviado el {new Date(ev.creado_en).toLocaleString()}
                      </Typography>
                      {ev.comentario && (
                        <Typography variant="body2" sx={{ mb: 1, fontStyle: 'italic' }}>
                          "{ev.comentario}"
                        </Typography>
                      )}
                      {ev.archivo_url && (
                        <Box sx={{ mt: 1, borderRadius: 1, overflow: 'hidden', border: '1px solid #eee' }}>
                          {ev.archivo_url.toLowerCase().match(/\.(mp4|webm|ogg)$/) ? (
                            <video controls style={{ width: '100%', maxHeight: '300px', display: 'block' }}>
                              <source src={`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}${ev.archivo_url}`} />
                            </video>
                          ) : (
                            <img 
                              src={`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}${ev.archivo_url}`} 
                              alt="Evidencia" 
                              style={{ width: '100%', maxHeight: '400px', objectFit: 'contain', display: 'block', cursor: 'pointer' }}
                              onClick={() => window.open(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}${ev.archivo_url}`, '_blank')}
                            />
                          )}
                        </Box>
                      )}
                    </Box>
                  ))}
                </Box>
              )}

              <Typography variant="body2" sx={{ mb: 2 }}>
                El trabajador ha indicado que terminó esta tarea. Revisa e indica si la apruebas o la rechazas.
              </Typography>
              <TextField
                label="Comentario al Trabajador"
                multiline
                rows={2}
                value={comentarioRevision}
                onChange={(e) => setComentarioRevision(e.target.value)}
                fullWidth
                sx={{ mb: 2, bgcolor: 'white' }}
              />
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                 <Button 
                   variant="contained" 
                   color="error"
                   onClick={async () => {
                     setBusy(true);
                     const ok = await handleRevisionTask(tarea.id, "reject", comentarioRevision, session, false);
                     if(ok) { onSaved?.(); onClose?.(); }
                     setBusy(false);
                   }}
                 >
                   Rechazar
                 </Button>
                 <Button 
                   variant="contained" 
                   color="success"
                   onClick={async () => {
                     setBusy(true);
                     const ok = await handleRevisionTask(tarea.id, "approve", comentarioRevision, session, false);
                     if(ok) { onSaved?.(); onClose?.(); }
                     setBusy(false);
                   }}
                 >
                   Aprobar (Completar)
                 </Button>
              </Box>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={busy}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!canSave || busy}
          startIcon={busy ? <CircularProgress size={18} /> : null}
        >
          {isEdit ? "Guardar cambios" : "Crear tarea"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}