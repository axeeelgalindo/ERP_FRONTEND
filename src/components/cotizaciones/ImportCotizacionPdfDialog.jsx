"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Alert,
  CircularProgress,
  Chip,
} from "@mui/material";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

const fmtCLP = (n) =>
  Number(n || 0).toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });

function makeMultipartHeaders(session) {
  const token = session?.user?.accessToken || "";
  const empresaId = session?.user?.empresaId ?? null;

  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(empresaId ? { "x-empresa-id": String(empresaId) } : {}),
    // ⚠️ NO Content-Type acá (FormData lo setea solo)
  };
}

export default function ImportCotizacionPdfDialog({
  open,
  onClose,
  session,
  clientes = [], // opcional: para fallback manual si el PDF no trae/extrae cliente bien
  onCreated,
  showSnack, // (severity, msg)
}) {
  const [file, setFile] = useState(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [preview, setPreview] = useState(null);

  // ✅ Cliente detectado por PDF (backend)
  const [clientePdf, setClientePdf] = useState(null); // { id, nombre, rut, created? } o similar
  const [forceClienteId, setForceClienteId] = useState(""); // fallback manual

  // ✅ Fecha documento manual (YYYY-MM-DD)
  const [fechaDoc, setFechaDoc] = useState("");

  const canPreview = useMemo(() => !!file, [file]);

  // Para crear: necesitamos preview + subtotal + fecha.
  // Además: si backend no logra cliente, permitimos elegir uno manualmente.
  const needsManualCliente = useMemo(() => !clientePdf?.id, [clientePdf]);
  const canCreate = useMemo(() => {
    const okBase = !!preview?.extracted?.subtotal && !!fechaDoc;
    if (!okBase) return false;
    if (needsManualCliente) return !!forceClienteId; // si no hay cliente del PDF, obliga a elegir
    return true;
  }, [preview, fechaDoc, needsManualCliente, forceClienteId]);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setErr("");
    setPreview(null);
    setClientePdf(null);
    setForceClienteId("");
    setFechaDoc("");
    setLoading(false);
  }, [open]);

  const handlePickFile = (e) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setPreview(null);
    setErr("");
    setClientePdf(null);
    setForceClienteId("");
    setFechaDoc("");
  };

  const requestImport = async (modo) => {
    if (!session) return;
    if (!file) return setErr("Selecciona un PDF.");

    if (modo === "create" && !fechaDoc) {
      return setErr("Debes ingresar la fecha del documento.");
    }
    if (modo === "create" && needsManualCliente && !forceClienteId) {
      return setErr("No se detectó cliente desde el PDF. Selecciona uno.");
    }

    try {
      setLoading(true);
      setErr("");

      const fd = new FormData();
      fd.append("modo", modo); // "preview" | "create"
      fd.append("file", file);

      // ✅ si estás usando fecha manual en backend
      if (modo === "create" && fechaDoc) {
        fd.append("fecha_documento_manual", fechaDoc); // YYYY-MM-DD
      }

      // ✅ fallback manual SOLO si el PDF no trae cliente o no se pudo resolver
      // (Tu backend puede ignorarlo si no lo necesita; pero es útil por robustez)
      if (modo === "create" && needsManualCliente && forceClienteId) {
        fd.append("cliente_id", forceClienteId);
      }

      const res = await fetch(`${API_URL}/cotizaciones/import/pdf`, {
        method: "POST",
        headers: makeMultipartHeaders(session),
        body: fd,
      });

      const data = await safeJson(res);

      if (!res.ok) {
        console.log("IMPORT PDF FAIL:", JSON.stringify(data, null, 2));
        throw new Error(data?.error || data?.detalle || "Error importando PDF");
      }

      if (modo === "preview") {
        setPreview(data);

        // ✅ esperable desde backend (ajusta a tu payload real):
        // data.extracted.cliente => { id, nombre, rut, created? }
        const cli = data?.extracted?.cliente || data?.cliente || null;
        setClientePdf(cli);

        // ✅ precargar fecha sugerida (si backend la manda)
        const sugerida = data?.extracted?.fecha_documento_sugerida || "";
        setFechaDoc(sugerida);

        // si vino cliente, limpiamos fallback manual
        setForceClienteId("");

        showSnack?.("success", "Preview generado");
        return;
      }

      // create
      showSnack?.("success", "Cotización creada desde PDF");
      onCreated?.(data?.cotizacion || null);
      onClose?.();
    } catch (e) {
      setErr(e?.message || "Error importando PDF");
      showSnack?.("error", e?.message || "Error importando PDF");
    } finally {
      setLoading(false);
    }
  };

  const renderClienteSection = () => {
    // Cliente detectado OK
    if (clientePdf?.id) {
      const nombre = clientePdf?.nombre || "Cliente";
      const rut = clientePdf?.rut ? `(${clientePdf.rut})` : "";
      const created = clientePdf?.created === true || clientePdf?.created === "true";

      return (
        <Stack spacing={1}>
          <TextField
            size="small"
            label="Cliente (detectado desde PDF)"
            value={`${nombre} ${rut}`.trim()}
            fullWidth
            InputProps={{ readOnly: true }}
          />
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip size="small" label={created ? "Creado automáticamente" : "Encontrado en BBDD"} />
            {clientePdf?.id ? (
              <Typography variant="caption" color="text.secondary">
                ID: {String(clientePdf.id).slice(0, 8)}…
              </Typography>
            ) : null}
          </Stack>
        </Stack>
      );
    }

    // Cliente NO detectado: fallback manual
    return (
      <Stack spacing={1}>
        <Alert severity="warning">
          No se detectó el cliente desde el PDF. Selecciona uno manualmente para poder crear.
        </Alert>

        <FormControl fullWidth size="small">
          <InputLabel id="cliente-pdf-fallback-label">Cliente</InputLabel>
          <Select
            labelId="cliente-pdf-fallback-label"
            label="Cliente"
            value={forceClienteId}
            onChange={(e) => setForceClienteId(e.target.value)}
          >
            <MenuItem value="">
              <em>Selecciona cliente</em>
            </MenuItem>
            {clientes.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.nombre} {c.rut ? `(${c.rut})` : ""}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Importar cotización desde PDF</DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Sube un PDF y genera una cotización. Primero haz <b>Preview</b> para validar.
          </Typography>

          {!!err && <Alert severity="error">{err}</Alert>}

          <Stack direction="row" spacing={2} alignItems="center">
            <Button variant="outlined" component="label">
              Seleccionar PDF
              <input hidden type="file" accept="application/pdf" onChange={handlePickFile} />
            </Button>

            <Typography variant="body2" sx={{ wordBreak: "break-word" }}>
              {file?.name || "Ningún archivo seleccionado"}
            </Typography>
          </Stack>

          {preview?.extracted && (
            <>
              <Divider />
              <Typography variant="subtitle2">Preview extraído</Typography>

              {renderClienteSection()}

              <TextField
                size="small"
                label="Asunto (detectado)"
                value={preview.extracted.asunto || ""}
                fullWidth
                InputProps={{ readOnly: true }}
                helperText="Este es el asunto detectado (ej: MESON PLANILLERO)."
              />

              <TextField
                size="small"
                label="Fecha documento"
                type="date"
                value={fechaDoc}
                onChange={(e) => setFechaDoc(e.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
                helperText="Confirma/ingresa la fecha real del documento (se guardará en fecha_documento)."
              />

              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  size="small"
                  label="Subtotal"
                  value={fmtCLP(preview.extracted.subtotal)}
                  fullWidth
                  InputProps={{ readOnly: true }}
                />
                <TextField
                  size="small"
                  label="IVA"
                  value={fmtCLP(preview.extracted.iva)}
                  fullWidth
                  InputProps={{ readOnly: true }}
                />
                <TextField
                  size="small"
                  label="Total"
                  value={fmtCLP(preview.extracted.total)}
                  fullWidth
                  InputProps={{ readOnly: true }}
                />
              </Stack>

              {!!preview.extracted?.items?.length && (
                <Alert severity="info">
                  Items detectados: {preview.extracted.items.length} (depende del formato del PDF).
                </Alert>
              )}

              {!fechaDoc && (
                <Alert severity="warning">
                  Falta la <b>fecha del documento</b>. Ingresa una fecha para poder crear la cotización.
                </Alert>
              )}
            </>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancelar
        </Button>

        <Button
          onClick={() => requestImport("preview")}
          disabled={loading || !canPreview}
          variant="outlined"
        >
          {loading ? <CircularProgress size={18} /> : "Preview"}
        </Button>

        <Button
          onClick={() => requestImport("create")}
          disabled={loading || !canPreview || !canCreate}
          variant="contained"
        >
          {loading ? <CircularProgress size={18} /> : "Crear cotización"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
