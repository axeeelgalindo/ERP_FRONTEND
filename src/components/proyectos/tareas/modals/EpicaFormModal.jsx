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
} from "@mui/material";
import { makeHeaders } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL;

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setBusy(false);
    setNombre(epica?.nombre || "");
    setDescripcion(epica?.descripcion || "");
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