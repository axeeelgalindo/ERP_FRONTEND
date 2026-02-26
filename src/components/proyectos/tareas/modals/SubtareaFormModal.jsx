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
} from "@mui/material";
import { makeHeaders } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL;

const ESTADOS = [
  { value: "pendiente", label: "Pendiente" },
  { value: "en_progreso", label: "En progreso" },
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

  // normalizar a medianoche
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);

  const MS = 24 * 60 * 60 * 1000;
  const diff = Math.round((b.getTime() - a.getTime()) / MS);
  return diff >= 0 ? diff + 1 : null; // inclusive
}

export default function SubtareaFormModal({
  open,
  onClose,
  session,
  tarea, // necesitamos tarea.id
  miembros = [],
  subtarea, // null => create, obj => edit
  onSaved,
}) {
  const isEdit = !!subtarea?.id;

  const [titulo, setTitulo] = useState("");
  const [estado, setEstado] = useState("pendiente");
  const [responsableId, setResponsableId] = useState("");

  // plan
  const [fechaInicioPlan, setFechaInicioPlan] = useState("");
  const [fechaFinPlan, setFechaFinPlan] = useState("");
  const [diasPlanManual, setDiasPlanManual] = useState(""); // por si no usan fin

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    setError("");
    setBusy(false);

    setTitulo(subtarea?.titulo || "");
    setEstado(subtarea?.estado || "pendiente");

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

    // si viene dias_plan, lo mostramos
    setDiasPlanManual(subtarea?.dias_plan != null ? String(subtarea.dias_plan) : "");
  }, [open, subtarea]);

  const diasPlanComputed = useMemo(() => {
    const d = daysBetweenInclusive(fechaInicioPlan, fechaFinPlan);
    return d;
  }, [fechaInicioPlan, fechaFinPlan]);

  const diasPlanFinal = useMemo(() => {
    // si hay fin, se calcula
    if (diasPlanComputed != null) return diasPlanComputed;
    // si no, usar manual
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
        // ✅ backend: POST /tareas-detalle/add
        const body = {
          tarea_id: tarea.id, // ✅ requerido
          titulo: titulo.trim(),
          descripcion: null,
          responsable_id: responsableId || null,
          estado,
          fecha_inicio_plan: new Date(fechaInicioPlan).toISOString(), // ✅ requerido
          dias_plan: diasPlanFinal, // ✅ requerido
          // los reales son opcionales (los dejamos fuera)
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

      // ✅ backend: PATCH /tareas-detalle/update/:id
      const body = {
        titulo: titulo.trim(),
        responsable_id: responsableId || null,
        estado,
        fecha_inicio_plan: new Date(fechaInicioPlan).toISOString(),
        dias_plan: diasPlanFinal,
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
                m?.nombre ||
                m?.usuario?.correo ||
                m?.correo ||
                `Miembro ${id}`;
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