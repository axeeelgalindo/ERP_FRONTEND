"use client";

import React, { useMemo, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Alert,
  Stack,
} from "@mui/material";
import { makeHeaders } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL;

export default function AssignEpicToTaskModal({
  open,
  onClose,
  session,
  epicas = [],
  tarea,
  onSaved,
}) {
  const [epicaId, setEpicaId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const epicasOrdenadas = useMemo(() => {
    return [...(epicas || [])].sort((a, b) =>
      String(a?.nombre || "").localeCompare(String(b?.nombre || ""), "es"),
    );
  }, [epicas]);

  const handleSubmit = async () => {
    if (!tarea?.id) return;
    if (!epicaId) {
      setError("Selecciona una épica.");
      return;
    }

    try {
      setBusy(true);
      setError("");

      const res = await fetch(`${API}/tareas/assign-epica/${tarea.id}`, {
        method: "PATCH",
        headers: {
          ...makeHeaders(session),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          epica_id: epicaId,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok)
        throw new Error(json?.message || json?.msg || "Error asignando épica");

      onSaved?.();
      onClose?.();
      setEpicaId("");
    } catch (e) {
      setError(e?.message || "Error asignando épica");
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => {
    if (busy) return;
    setError("");
    setEpicaId("");
    onClose?.();
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Asignar épica a tarea</DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2}>
          {error ? <Alert severity="error">{error}</Alert> : null}

          <TextField
            label="Tarea"
            value={tarea?.nombre || "—"}
            fullWidth
            disabled
          />

          <TextField
            select
            label="Épica"
            value={epicaId}
            onChange={(e) => setEpicaId(e.target.value)}
            fullWidth
          >
            {epicasOrdenadas.map((e) => (
              <MenuItem key={e.id} value={e.id}>
                {e.nombre}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={busy}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={handleSubmit} disabled={busy}>
          Asignar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
