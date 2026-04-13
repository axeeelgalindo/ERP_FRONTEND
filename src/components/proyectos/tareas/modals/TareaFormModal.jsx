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
      ...(action === "approve" ? { avance: 100 } : {})
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

    const fromTarea = tarea?.epica?.id || tarea?.epica_id || "";
    setEpicaId(fromTarea || presetEpicaId || "");

    setFechaInicioPlan(toISODateInput(tarea?.fecha_inicio_plan));
    setFechaFinPlan(toISODateInput(tarea?.fecha_fin_plan));

    setFechaInicioReal(toISODateInput(tarea?.fecha_inicio_real));
    setFechaFinReal(toISODateInput(tarea?.fecha_fin_real));
  }, [open, tarea, presetEpicaId]);

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

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="md">
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
        <Button onClick={onClose} disabled={busy}>
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