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
} from "@mui/material";
import { makeHeaders } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL;

const ESTADOS = [
  { value: "pendiente", label: "Pendiente" },
  { value: "en_progreso", label: "En progreso" },
  { value: "completada", label: "Completada" },
];

export default function EpicaFormModal({
  open,
  onClose,
  session,
  proyectoId,
  epica, // null => create, objeto => edit
  onSaved,
}) {
  const isEdit = !!epica?.id;

  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [estado, setEstado] = useState("pendiente");
  const [esPlanificado, setEsPlanificado] = useState(true);

  // Reales
  const [fechaInicioReal, setFechaInicioReal] = useState("");
  const [fechaFinReal, setFechaFinReal] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Helper local (igual q en tarea)
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

  useEffect(() => {
    if (!open) return;
    setError("");
    setBusy(false);
    setNombre(epica?.nombre || "");
    setDescripcion(epica?.descripcion || "");
    setEstado(epica?.estado || "pendiente");
    setEsPlanificado(epica?.es_planificado ?? true);

    setFechaInicioReal(toISODateInput(epica?.fecha_inicio_real));
    setFechaFinReal(toISODateInput(epica?.fecha_fin_real));
  }, [open, epica]);

  const canSave = useMemo(() => nombre.trim().length >= 2 && !!proyectoId, [nombre, proyectoId]);

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
        // ✅ backend requiere proyecto_id
        const body = {
          proyecto_id: proyectoId,
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || null,
          estado,
          es_planificado: esPlanificado,
        };

        const res = await fetch(`${API}/epicas/add`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error || json?.message || "Error creando épica");

        onSaved?.();
        onClose?.();
        return;
      }

      const body = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        estado,
        es_planificado: esPlanificado,
        ...(isEdit && fechaInicioReal ? { fecha_inicio_real: new Date(fechaInicioReal).toISOString() } : {}),
        ...(isEdit && fechaFinReal ? { fecha_fin_real: new Date(fechaFinReal).toISOString() } : {}),
      };

      const res = await fetch(`${API}/epicas/update/${epica.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || json?.message || "Error actualizando épica");

      onSaved?.();
      onClose?.();
    } catch (e) {
      setError(e?.message || "Error guardando épica");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 900 }}>
        {isEdit ? "Editar épica" : "Nueva épica"}
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : null}

        <Box sx={{ display: "grid", gap: 2 }}>
          <TextField label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus fullWidth />
          
          <TextField
            select
            label="Estado"
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            fullWidth
            SelectProps={{ native: false }}
          >
            {ESTADOS.map((x) => (
              <MenuItem key={x.value} value={x.value}>
                {x.label}
              </MenuItem>
            ))}
          </TextField>

          <FormControlLabel
            control={<Switch checked={esPlanificado} onChange={(e) => setEsPlanificado(e.target.checked)} color="primary" />}
            label="Definido en Planificación Inicial"
          />

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

          <TextField
            label="Descripción (opcional)"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            multiline
            minRows={3}
            fullWidth
          />
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
          {isEdit ? "Guardar cambios" : "Crear épica"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}