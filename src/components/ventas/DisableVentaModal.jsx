// src/components/ventas/DisableVentaModal.jsx
"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import Modal from "@/components/ui/Modal";
import { Button } from "@mui/material";
import BlockIcon from "@mui/icons-material/Block";
import { makeHeaders } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL;

export default function DisableVentaModal({
  open,
  onClose,
  venta,
  onDisabled,
}) {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDisable = async () => {
    if (!venta?.id) return;

    try {
      setLoading(true);
      setError("");

      const res = await fetch(`${API}/ventas/${venta.id}/disable`, {
        method: "PATCH",
        headers: makeHeaders(session),
        // ⚠️ Fastify a veces exige body si mandas application/json
        body: JSON.stringify({}),
      });

      let data = null;
      try {
        data = await res.json();
      } catch {}

      if (!res.ok) {
        throw new Error(data?.error || data?.message || "No se pudo deshabilitar");
      }

      onClose?.();
      onDisabled?.(); // refrescar tabla
    } catch (e) {
      setError(e?.message || "Error al deshabilitar");
    } finally {
      setLoading(false);
    }
  };

  const numero = venta?.numero ?? "—";
  const desc = venta?.descripcion || "";

  return (
    <Modal
      open={open}
      onClose={() => (loading ? null : onClose?.())}
      title={`Eliminar costeo #${numero}`}
    >
      <div className="space-y-3">
        <p className="text-sm text-gray-700">
          ¿Seguro que quieres <b>ELIMINAR</b> este costeo?
        </p>

        {desc ? (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs font-semibold text-gray-600">Descripción</p>
            <p className="text-sm text-gray-800">{desc}</p>
          </div>
        ) : null}

        {/*<p className="text-xs text-gray-500">
          Esto no borra datos: solo lo marca como <b>eliminado</b> y no aparecerá en el listado.
        </p>*/}

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            variant="outlined"
            onClick={() => onClose?.()}
            disabled={loading}
            sx={{ borderRadius: 2, textTransform: "none", fontWeight: 800 }}
          >
            Cancelar
          </Button>

          <Button
            variant="contained"
            color="warning"
            startIcon={<BlockIcon />}
            onClick={handleDisable}
            disabled={loading}
            sx={{ borderRadius: 2, textTransform: "none", fontWeight: 900 }}
          >
            {loading ? "Eliminando..." : "Eliminar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
