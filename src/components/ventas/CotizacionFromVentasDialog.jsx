"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";

import { makeHeaders } from "@/lib/api";
import { safeJson } from "@/components/ventas/utils/safeJson";
import { formatCLP } from "@/components/ventas/utils/money";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const round0 = (n) => Math.round(Number(n || 0));

function distributeGlosas(glosas, subtotalNeto) {
  const t = round0(subtotalNeto);

  const manualSum = glosas.reduce(
    (acc, g) => acc + (g.manual ? round0(g.monto || 0) : 0),
    0
  );

  if (manualSum > t) {
    return {
      glosas,
      error: `La suma manual (${formatCLP(manualSum)}) supera el subtotal (${formatCLP(
        t
      )}).`,
    };
  }

  const autosIdx = glosas
    .map((g, i) => (!g.manual ? i : -1))
    .filter((i) => i !== -1);

  if (autosIdx.length === 0) {
    if (manualSum !== t) {
      return {
        glosas,
        error: `Falta cuadrar el subtotal: manual ${formatCLP(
          manualSum
        )} vs subtotal ${formatCLP(t)}.`,
      };
    }
    return {
      glosas: glosas.map((g) => ({ ...g, monto: round0(g.monto || 0) })),
      error: "",
    };
  }

  const rem = t - manualSum;
  const base = Math.floor(rem / autosIdx.length);
  const ajuste = rem - base * autosIdx.length;

  const next = glosas.map((g) => {
    if (g.manual) return { ...g, monto: round0(g.monto || 0) };
    return { ...g, monto: base };
  });

  // ajuste al último auto
  const lastAuto = autosIdx[autosIdx.length - 1];
  next[lastAuto] = { ...next[lastAuto], monto: round0(next[lastAuto].monto + ajuste) };

  return { glosas: next, error: "" };
}

export default function NuevaCotizacionDialog({
  open,
  onClose,
  session,
  empresaIdFromToken,
  onCreated,

  // ✅ NUEVO: viene del costeo (ventas)
  subtotalBase = 0,

  // ✅ IVA (siempre 0.19 por defecto)
  ivaRate = 0.19,
}) {
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const [clientes, setClientes] = useState([]);

  // form
  const [clienteId, setClienteId] = useState("");
  const [asunto, setAsunto] = useState("");
  const [terminos, setTerminos] = useState("");
  const [acuerdoPago, setAcuerdoPago] = useState("");

  const emptyGlosa = () => ({
    descripcion: "",
    monto: 0,
    manual: false,
    orden: 0,
  });

  const [glosas, setGlosas] = useState([emptyGlosa()]);
  const [glosaErr, setGlosaErr] = useState("");

  // ✅ cálculo desde el costeo (no editable)
  const subtotalNeto = useMemo(() => round0(subtotalBase), [subtotalBase]);
  const iva = useMemo(() => round0(subtotalNeto * Number(ivaRate || 0)), [subtotalNeto, ivaRate]);
  const totalFinal = useMemo(() => round0(subtotalNeto + iva), [subtotalNeto, iva]);

  const sumGlosas = useMemo(
    () => glosas.reduce((acc, g) => acc + round0(g.monto || 0), 0),
    [glosas]
  );

  // Reset al abrir
  useEffect(() => {
    if (!open) return;
    setErr("");
    setClienteId("");
    setAsunto("");
    setTerminos("");
    setAcuerdoPago("");
    setGlosas([emptyGlosa()]);
    setGlosaErr("");
  }, [open]);

  // Re-distribuir glosas cuando cambia el subtotalBase
  useEffect(() => {
    if (!open) return;
    setGlosas((prev) => {
      const { glosas: dist, error } = distributeGlosas(prev, subtotalNeto);
      setGlosaErr(error);
      return dist;
    });
  }, [subtotalNeto, open]);

  // cargar clientes
  useEffect(() => {
    if (!open) return;
    if (!session?.user) return;

    (async () => {
      try {
        setErr("");
        const headers = makeHeaders(session, empresaIdFromToken);

        const urlCli = new URL(`${API_URL}/clientes`);
        urlCli.searchParams.set("pageSize", "100");

        const resCli = await fetch(urlCli, { headers, cache: "no-store" });
        const jsonCli = await safeJson(resCli);

        if (!resCli.ok) {
          throw new Error(
            jsonCli?.detalle || jsonCli?.error || jsonCli?.message || "Error al cargar clientes"
          );
        }

        const cliList = Array.isArray(jsonCli?.data)
          ? jsonCli.data
          : Array.isArray(jsonCli?.items)
          ? jsonCli.items
          : Array.isArray(jsonCli)
          ? jsonCli
          : [];

        setClientes(cliList);
      } catch (e) {
        setErr(e?.message || "Error cargando clientes");
      }
    })();
  }, [open, session, empresaIdFromToken]);

  const setGlosa = (idx, patch) => {
    setGlosas((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch, orden: idx };

      // Si escribió monto => manual true
      if (patch.monto !== undefined) {
        const raw = patch.monto;
        const hasValue = String(raw ?? "").trim() !== "";
        next[idx].manual = hasValue;
        next[idx].monto = hasValue ? round0(raw) : 0;
      }

      const { glosas: dist, error } = distributeGlosas(next, subtotalNeto);
      setGlosaErr(error);
      return dist;
    });
  };

  const addGlosa = () => {
    setGlosas((prev) => {
      const next = [...prev, emptyGlosa()].map((g, i) => ({ ...g, orden: i }));
      const { glosas: dist, error } = distributeGlosas(next, subtotalNeto);
      setGlosaErr(error);
      return dist;
    });
  };

  const removeGlosa = (idx) => {
    setGlosas((prev) => {
      const base = prev.filter((_, i) => i !== idx);
      const next = (base.length ? base : [emptyGlosa()]).map((g, i) => ({ ...g, orden: i }));
      const { glosas: dist, error } = distributeGlosas(next, subtotalNeto);
      setGlosaErr(error);
      return dist;
    });
  };

  const validate = () => {
    if (!session?.user) return "Sesión inválida";
    if (!clienteId) return "Debes seleccionar un cliente.";

    if (!subtotalNeto || subtotalNeto <= 0) {
      return "No hay subtotal (costeo) para cotizar. Selecciona ventas / costeo primero.";
    }

    for (let i = 0; i < glosas.length; i++) {
      if (!String(glosas[i].descripcion || "").trim()) {
        return `Glosa #${i + 1}: Falta descripción.`;
      }
    }

    if (sumGlosas !== subtotalNeto) {
      return `Las glosas suman ${formatCLP(sumGlosas)} y el subtotal es ${formatCLP(subtotalNeto)}.`;
    }

    if (glosaErr) return glosaErr;

    return "";
  };

  const submit = async () => {
    try {
      setSaving(true);
      setErr("");

      const msg = validate();
      if (msg) throw new Error(msg);

      const payload = {
        cliente_id: clienteId,
        asunto: asunto || null,

        // ✅ enviar calculados desde costeo
        subtotal: subtotalNeto,
        iva,
        total: totalFinal,
        ivaRate: Number(ivaRate || 0),

        terminos_condiciones: terminos || null,
        acuerdo_pago: acuerdoPago || null,

        // glosas suman subtotal
        glosas: glosas.map((g, i) => ({
          descripcion: String(g.descripcion || "").trim(),
          monto: round0(g.monto || 0),
          manual: !!g.manual,
          orden: i,
        })),
      };

      const res = await fetch(`${API_URL}/cotizaciones/add`, {
        method: "POST",
        headers: makeHeaders(session, empresaIdFromToken),
        body: JSON.stringify(payload),
      });

      const data = await safeJson(res);
      if (!res.ok) {
        throw new Error(data?.detalle || data?.error || data?.message || "Error creando cotización");
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
      <DialogTitle>Crear cotización</DialogTitle>

      <DialogContent dividers>
        {err && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {err}
          </Alert>
        )}
        {glosaErr && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {glosaErr}
          </Alert>
        )}

        <Stack spacing={2}>
          <TextField
            select
            label="Cliente"
            size="small"
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
            fullWidth
          >
            <MenuItem value="">(Selecciona)</MenuItem>
            {clientes.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.nombre || c.id}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Glosa general / Asunto (opcional)"
            size="small"
            value={asunto}
            onChange={(e) => setAsunto(e.target.value)}
            fullWidth
          />

          {/* ✅ NO editable: viene del costeo */}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" }, gap: 2 }}>
            <TextField label="Subtotal (neto)" size="small" value={formatCLP(subtotalNeto)} fullWidth disabled />
            <TextField label="IVA" size="small" value={formatCLP(iva)} fullWidth disabled />
            <TextField label="Total" size="small" value={formatCLP(totalFinal)} fullWidth disabled />
          </Box>

          <TextField
            label="Términos y condiciones (opcional)"
            size="small"
            multiline
            minRows={3}
            value={terminos}
            onChange={(e) => setTerminos(e.target.value)}
            fullWidth
          />

          <TextField
            label="Acuerdo de pago (opcional)"
            size="small"
            multiline
            minRows={2}
            value={acuerdoPago}
            onChange={(e) => setAcuerdoPago(e.target.value)}
            fullWidth
          />

          <Typography variant="subtitle2" color="text.secondary">
            Glosas (deben sumar el SUBTOTAL neto)
          </Typography>

          {glosas.map((g, idx) => (
            <Card key={idx} variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent>
                <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
                  <Typography fontWeight={700}>Glosa #{idx + 1}</Typography>
                  {glosas.length > 1 && (
                    <IconButton onClick={() => removeGlosa(idx)} size="small">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>

                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "2fr 1fr" },
                    gap: 2,
                    mt: 1,
                  }}
                >
                  <TextField
                    label="Descripción"
                    size="small"
                    value={g.descripcion}
                    onChange={(e) => setGlosa(idx, { descripcion: e.target.value })}
                    fullWidth
                  />

                  <TextField
                    label="Monto (CLP)"
                    size="small"
                    type="number"
                    value={g.monto}
                    onChange={(e) => setGlosa(idx, { monto: e.target.value })}
                    fullWidth
                    inputProps={{ min: 0, step: 1 }}
                    helperText={g.manual ? "Manual" : "Auto (remanente)"}
                  />
                </Box>
              </CardContent>
            </Card>
          ))}

          <Button variant="outlined" startIcon={<AddIcon />} onClick={addGlosa}>
            Agregar glosa
          </Button>

          <Alert severity="info">
            Subtotal: {formatCLP(subtotalNeto)} — Suma glosas: {formatCLP(sumGlosas)} — IVA: {formatCLP(iva)} — Total:{" "}
            {formatCLP(totalFinal)}
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
