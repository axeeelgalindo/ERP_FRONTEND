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

function daysBetweenInclusive(dateStartStr, dateEndStr) {
  if (!dateStartStr || !dateEndStr) return null;
  const a = new Date(dateStartStr);
  const b = new Date(dateEndStr);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;

  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);

  const MS = 24 * 60 * 60 * 1000;
  const diff = Math.round((b.getTime() - a.getTime()) / MS);
  return diff >= 0 ? diff + 1 : null;
}

export default function SubtareaFormModal({
  open,
  onClose,
  session,
  tarea,
  miembros = [],
  subtarea,
  onSaved,
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
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 900 }}>
        {isEdit ? "Editar subtarea" : "Nueva subtarea"}
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : null}

        <Box sx={{ display: "grid", gap: 2 }}>
          <TextField
            label="Título"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            autoFocus
            fullWidth
          />

          <FormControl fullWidth>
            <InputLabel>Estado</InputLabel>
            <Select
              value={estado}
              label="Estado"
              onChange={(e) => setEstado(e.target.value)}
            >
              {ESTADOS.map((x) => (
                <MenuItem key={x.value} value={x.value}>
                  {x.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            select
            label="Responsable (opcional)"
            value={responsableId}
            onChange={(e) => setResponsableId(e.target.value)}
            fullWidth
          >
            <MenuItem value="">Sin asignar</MenuItem>
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
                <MenuItem key={id} value={id}>
                  {label}
                </MenuItem>
              );
            })}
          </TextField>

          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
            <TextField
              label="Inicio plan"
              type="date"
              value={fechaInicioPlan}
              onChange={(e) => setFechaInicioPlan(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="Fin plan (opcional)"
              type="date"
              value={fechaFinPlan}
              onChange={(e) => setFechaFinPlan(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Box>

          {isEdit && (
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
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
            </Box>
          )}

          {diasPlanComputed != null ? (
            <Alert severity="info">
              Días plan calculados: <b>{diasPlanComputed}</b>
            </Alert>
          ) : (
            <TextField
              label="Días plan"
              type="number"
              value={diasPlanManual}
              onChange={(e) => setDiasPlanManual(e.target.value)}
              inputProps={{ min: 1 }}
              fullWidth
            />
          )}

          <FormControlLabel
            control={<Switch checked={esPlanificado} onChange={(e) => setEsPlanificado(e.target.checked)} color="primary" />}
            label="Definido en Planificación Inicial"
          />

          {estado === "en_revision" && isEdit && (
            <Box sx={{ mt: 3, p: 2, border: '1px solid', borderColor: 'warning.main', borderRadius: 2, bgcolor: 'warning.light', gridColumn: { xs: "1 / -1", md: "1 / -1" } }}>
              <Typography variant="subtitle2" color="warning.dark" sx={{ mb: 1, fontWeight: 'bold' }}>
                Subtarea en Revisión - Evidencias
              </Typography>

              {/* ✅ VISUALIZACIÓN DE EVIDENCIAS SUBIDAS POR TRABAJADOR */}
              {subtarea?.evidencias?.length > 0 && (
                <Box sx={{ mb: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {subtarea.evidencias.map((ev) => (
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
                El trabajador ha indicado que terminó esta subtarea. Revisa e indica si la apruebas o la rechazas.
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
                     const ok = await handleRevisionTask(subtarea.id, "reject", comentarioRevision, session, true);
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
                     const ok = await handleRevisionTask(subtarea.id, "approve", comentarioRevision, session, true);
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
        {isEdit ? (
          <Button color="error" onClick={handleDelete} disabled={busy}>
            Eliminar
          </Button>
        ) : (
          <span />
        )}

        <Button onClick={onClose} disabled={busy}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!canSave || busy}
          startIcon={busy ? <CircularProgress size={18} /> : null}
        >
          {isEdit ? "Guardar cambios" : "Crear subtarea"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}