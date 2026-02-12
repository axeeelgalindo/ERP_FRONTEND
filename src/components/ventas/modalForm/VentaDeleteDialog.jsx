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
  venta,        // 👈 ahora recibimos la venta completa
  onDisabled,   // 👈 mismo callback que tu modal actual
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const ventaId = venta?.id;

  const handleDisable = async () => {
    if (!ventaId || !session?.user) return;

    try {
      setLoading(true);
      setErr("");

      const res = await fetch(`${API_URL}/ventas/${ventaId}/disable`, {
        method: "PATCH", // ✅ como tu modal que funciona
        headers: makeHeaders(session, empresaIdFromToken),
        body: JSON.stringify({}), // ✅ evita error Fastify body vacío
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.message || data?.error || "No se pudo eliminar");

      onClose?.();
      await onDisabled?.(); // refrescar tabla
    } catch (e) {
      setErr(e?.message || "Error al eliminar");
    } finally {
      setLoading(false);
    }
  };

  const numero = venta?.numero ?? "—";
  const desc = venta?.descripcion || "";

  return (
    <Dialog open={open} onClose={() => (loading ? null : onClose?.())} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 900 }}>Eliminar costeo #{numero}</DialogTitle>

      <DialogContent dividers>
        {err ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {err}
          </Alert>
        ) : null}

        <Typography>
          ¿Seguro que deseas eliminar este costeo? Esta acción no se puede deshacer.
        </Typography>

        {desc ? (
          <Typography sx={{ mt: 1, color: "text.secondary", fontSize: 13 }}>
            <b>Costeo nombre/descripción:</b> {desc}
          </Typography>
        ) : null}

        {/*{ventaId ? (
          <Typography sx={{ mt: 1, color: "text.secondary", fontSize: 12 }}>
            ID: <b>{ventaId}</b>
          </Typography>
        ) : null} */}
      </DialogContent>

      <DialogActions sx={{ px: 2.5, py: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={loading}>
          Cancelar
        </Button>

        <Button
          variant="contained"
          color="error"
          onClick={handleDisable}
          disabled={loading || !ventaId}
        >
          {loading ? "Eliminando..." : "Eliminar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
