"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";
import { makeHeaders } from "@/lib/api";
import { safeJson } from "@/components/ventas/utils/safeJson";
import { formatCLP } from "@/components/ventas/utils/money";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

function calcTotalVenta(v) {
  return (v?.detalles || []).reduce(
    (s, d) => s + (Number(d.total ?? d.ventaTotal) || 0),
    0
  );
}

export default function CotizacionFromVentasDialog({
  open,
  onClose,
  session,
  empresaIdFromToken,
  ventas = [],
  preselectedVentaIds = [],
  onCreated,
}) {
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const [proyectos, setProyectos] = useState([]);
  const [clientes, setClientes] = useState([]);

  const [cotProyectoId, setCotProyectoId] = useState("");
  const [cotClienteId, setCotClienteId] = useState("");
  const [cotDescripcion, setCotDescripcion] = useState("");
  const [cotCantidad, setCotCantidad] = useState("");
  const [cotTerminos, setCotTerminos] = useState("");
  const [cotAcuerdoPago, setCotAcuerdoPago] = useState("");

  const [cotVentaIds, setCotVentaIds] = useState([]);

  const ventasDisponiblesCot = useMemo(() => ventas || [], [ventas]);

  // Reset + aplicar preselección al abrir
  useEffect(() => {
    if (!open) return;

    setErr("");
    setCotProyectoId("");
    setCotClienteId("");
    setCotDescripcion("");
    setCotCantidad("");
    setCotTerminos("");
    setCotAcuerdoPago("");

    setCotVentaIds(preselectedVentaIds?.length ? preselectedVentaIds : []);
  }, [open, preselectedVentaIds]);

  // Cargar catálogos al abrir
  useEffect(() => {
    if (!open) return;
    if (!session?.user) return;

    (async () => {
      try {
        setErr("");
        const headers = makeHeaders(session, empresaIdFromToken);

        const urlProy = new URL(`${API_URL}/proyectos`);
        urlProy.searchParams.set("pageSize", "100");

        const urlCli = new URL(`${API_URL}/clientes`);
        urlCli.searchParams.set("pageSize", "100");

        const [resProy, resCli] = await Promise.all([
          fetch(urlProy, { headers, cache: "no-store" }),
          fetch(urlCli, { headers, cache: "no-store" }),
        ]);

        const [jsonProy, jsonCli] = await Promise.all([
          safeJson(resProy),
          safeJson(resCli),
        ]);

        if (!resProy.ok) {
          throw new Error(
            jsonProy?.message || jsonProy?.msg || "Error al cargar proyectos"
          );
        }
        if (!resCli.ok) {
          throw new Error(
            jsonCli?.message || jsonCli?.msg || "Error al cargar clientes"
          );
        }

        const proyList = Array.isArray(jsonProy?.data)
          ? jsonProy.data
          : Array.isArray(jsonProy?.items)
          ? jsonProy.items
          : Array.isArray(jsonProy)
          ? jsonProy
          : [];

        const cliList = Array.isArray(jsonCli?.data)
          ? jsonCli.data
          : Array.isArray(jsonCli?.items)
          ? jsonCli.items
          : Array.isArray(jsonCli)
          ? jsonCli
          : [];

        setProyectos(proyList);
        setClientes(cliList);
      } catch (e) {
        setErr(e?.message || "Error cargando catálogos");
      }
    })();
  }, [open, session, empresaIdFromToken]);

  const submit = async () => {
    try {
      setSaving(true);
      setErr("");

      if (!cotProyectoId) throw new Error("Selecciona un proyecto");
      if (!cotVentaIds.length) throw new Error("Selecciona al menos 1 venta");

      const payload = {
        proyecto_id: cotProyectoId,
        cliente_id: cotClienteId || null,
        descripcion: cotDescripcion || null,
        cantidad: cotCantidad ? Number(cotCantidad) : null,
        terminos_condiciones: cotTerminos || null,
        acuerdo_pago: cotAcuerdoPago || null,
        ventaIds: cotVentaIds,
      };

      const res = await fetch(`${API_URL}/cotizaciones/add`, {
        method: "POST",
        headers: makeHeaders(session),
        body: JSON.stringify(payload),
      });

      const data = await safeJson(res);
      if (!res.ok) {
        throw new Error(
          data?.detalle || data?.error || data?.message || "Error creando cotización"
        );
      }

      onClose?.();
      await onCreated?.();
    } catch (e) {
      setErr(e?.message || "Error creando cotización");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Crear cotización cliente (desde ventas)</DialogTitle>

      <DialogContent dividers>
        {err && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {err}
          </Alert>
        )}

        <Stack spacing={2}>
          <TextField
            select
            label="Proyecto"
            size="small"
            value={cotProyectoId}
            onChange={(e) => setCotProyectoId(e.target.value)}
            fullWidth
          >
            <MenuItem value="">(Selecciona)</MenuItem>
            {proyectos.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.nombre || p.id}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Cliente (opcional)"
            size="small"
            value={cotClienteId}
            onChange={(e) => setCotClienteId(e.target.value)}
            fullWidth
          >
            <MenuItem value="">(Sin cliente)</MenuItem>
            {clientes.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.nombre || c.id}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Descripción (opcional)"
            size="small"
            value={cotDescripcion}
            onChange={(e) => setCotDescripcion(e.target.value)}
            fullWidth
          />

          <TextField
            label="Cantidad (opcional)"
            size="small"
            type="number"
            value={cotCantidad}
            onChange={(e) => setCotCantidad(e.target.value)}
            fullWidth
          />

          <TextField
            label="Términos y condiciones (opcional)"
            size="small"
            multiline
            minRows={3}
            value={cotTerminos}
            onChange={(e) => setCotTerminos(e.target.value)}
            fullWidth
          />

          <TextField
            label="Acuerdo de pago (opcional)"
            size="small"
            multiline
            minRows={2}
            value={cotAcuerdoPago}
            onChange={(e) => setCotAcuerdoPago(e.target.value)}
            fullWidth
          />

          <Divider />

          <TextField
            select
            label="Ventas a incluir"
            size="small"
            value={cotVentaIds}
            onChange={(e) => setCotVentaIds(e.target.value)}
            SelectProps={{ multiple: true }}
            fullWidth
            helperText="Se listan todas las ventas (puedes seleccionar más de una)."
          >
            {ventasDisponiblesCot.map((v) => {
              const total = calcTotalVenta(v);
              return (
                <MenuItem key={v.id} value={v.id}>
                  Venta #{v.numero ?? "—"} — {formatCLP(total)}
                </MenuItem>
              );
            })}
          </TextField>

          <Alert severity="info">
            Subtotal / IVA / Total se calculan en backend desde las ventas seleccionadas.
          </Alert>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={saving} color="inherit">
          Cancelar
        </Button>
        <Button variant="contained" onClick={submit} disabled={saving}>
          {saving ? "Creando..." : "Crear cotización"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
