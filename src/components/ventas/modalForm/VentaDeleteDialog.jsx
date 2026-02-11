"use client";

import { useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";

import { makeHeaders } from "@/lib/api";
import { safeJson } from "@/components/ventas/utils/safeJson";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function VentaDeleteDialog({
  open,
  onClose,
  session,
  empresaIdFromToken,
  ventaId,
  onDeleted,
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handleDelete = async () => {
    if (!ventaId || !session?.user) return;

    try {
      setLoading(true);
      setErr("");

      // OJO: makeHeaders mete Content-Type: application/json
      // Fastify tira error si Content-Type json y body vacío.
      // => mandamos {} para que no sea vacío.
      const res = await fetch(`${API_URL}/ventas/${ventaId}`, {
        method: "DELETE",
        headers: makeHeaders(session, empresaIdFromToken),
        body: JSON.stringify({}),
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.message || data?.error || "Error al eliminar");

      onClose?.();
      await onDeleted?.();
    } catch (e) {
      setErr(e?.message || "Error al eliminar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 900 }}>Eliminar costeo</DialogTitle>
      <DialogContent dividers>
        {err ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {err}
          </Alert>
        ) : null}

        <Typography>
          ¿Seguro que deseas eliminar este costeo? Esta acción no se puede deshacer.
        </Typography>

        {ventaId ? (
          <Typography sx={{ mt: 1, color: "text.secondary", fontSize: 13 }}>
            ID: <b>{ventaId}</b>
          </Typography>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 2.5, py: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={loading}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={handleDelete}
          disabled={loading || !ventaId}
        >
          {loading ? "Eliminando..." : "Eliminar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
