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
  Alert,
  CircularProgress,
  Chip,
  Divider,
} from "@mui/material";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function makeMultipartHeaders(session) {
  const token = session?.user?.accessToken || "";
  const empresaId = session?.user?.empresaId ?? null;

  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(empresaId ? { "x-empresa-id": String(empresaId) } : {}),
    // ⚠️ NO Content-Type (FormData lo setea solo)
  };
}

export default function ImportCotizacionPdfDialog({
  open,
  onClose,
  session,
  onCreated,
  showSnack,
}) {
  const [files, setFiles] = useState([]); // File[]
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [results, setResults] = useState([]); // [{ ok, filename, message, cotizacion? }]

  const canImport = useMemo(() => files.length > 0 && !loading, [files, loading]);

  useEffect(() => {
    if (!open) return;
    setFiles([]);
    setErr("");
    setResults([]);
    setLoading(false);
  }, [open]);

  const handlePickFiles = (e) => {
    const list = Array.from(e.target.files || []);
    setFiles(list);
    setErr("");
    setResults([]);
  };

  const importOne = async (file) => {
    const fd = new FormData();
    // tu backend usa "modo": "preview" | "create"
    fd.append("modo", "create");
    fd.append("file", file);

    const res = await fetch(`${API_URL}/cotizaciones/import/pdf`, {
      method: "POST",
      headers: makeMultipartHeaders(session),
      body: fd,
    });

    const data = await safeJson(res);

    if (!res.ok) {
      const msg = data?.detalle || data?.error || data?.message || "Error importando PDF";
      throw new Error(msg);
    }

    return data; // normalmente { mode:"create", cotizacion: {...} }
  };

  const handleImportAll = async () => {
    if (!session) return;
    if (!files.length) return setErr("Selecciona al menos 1 PDF.");

    try {
      setLoading(true);
      setErr("");
      setResults([]);

      const temp = [];

      // ✅ secuencial (más estable). Si quieres concurrente después, lo hacemos.
      for (const f of files) {
        try {
          const data = await importOne(f);
          temp.push({
            ok: true,
            filename: f.name,
            message: "Importado",
            cotizacion: data?.cotizacion || null,
          });
          setResults([...temp]);
        } catch (e) {
          temp.push({
            ok: false,
            filename: f.name,
            message: e?.message || "Error importando",
          });
          setResults([...temp]);
        }
      }

      const ok = temp.filter((r) => r.ok).length;
      const fail = temp.length - ok;

      if (fail === 0) {
        showSnack?.("success", `Listo: ${ok}/${temp.length} importados`);
        onCreated?.();
        onClose?.();
      } else {
        showSnack?.("warning", `Importación parcial: ${ok} OK, ${fail} fallidos`);
        onCreated?.(); // refresca lista igual
      }
    } catch (e) {
      setErr(e?.message || "Error importando PDFs");
      showSnack?.("error", e?.message || "Error importando PDFs");
    } finally {
      setLoading(false);
    }
  };

  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.filter((r) => !r.ok).length;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Importar cotizaciones desde PDF (múltiples)</DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Selecciona varios PDFs y se importarán uno por uno.
          </Typography>

          {!!err && <Alert severity="error">{err}</Alert>}

          <Stack direction="row" spacing={2} alignItems="center">
            <Button variant="outlined" component="label" disabled={loading}>
              Seleccionar PDFs
              <input
                hidden
                type="file"
                accept="application/pdf"
                multiple
                onChange={handlePickFiles}
              />
            </Button>

            <Typography variant="body2" sx={{ wordBreak: "break-word" }}>
              {files.length ? `${files.length} archivo(s) seleccionado(s)` : "Ningún archivo"}
            </Typography>
          </Stack>

          {files.length ? (
            <Stack spacing={0.5}>
              {files.slice(0, 8).map((f) => (
                <Typography key={f.name} variant="caption" color="text.secondary">
                  • {f.name}
                </Typography>
              ))}
              {files.length > 8 ? (
                <Typography variant="caption" color="text.secondary">
                  … y {files.length - 8} más
                </Typography>
              ) : null}
            </Stack>
          ) : null}

          {results.length ? (
            <>
              <Divider />
              <Alert severity={failCount ? "warning" : "success"}>
                Resultado: {okCount} OK • {failCount} fallidos
              </Alert>

              <Stack spacing={1}>
                {results.map((r, idx) => (
                  <Stack
                    key={`${r.filename}-${idx}`}
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    sx={{
                      p: 1,
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 2,
                      flexWrap: "wrap",
                      gap: 1,
                    }}
                  >
                    <Chip
                      size="small"
                      label={r.ok ? "OK" : "FAIL"}
                      color={r.ok ? "success" : "error"}
                      variant="outlined"
                    />
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {r.filename}
                    </Typography>
                    <Typography variant="body2" color={r.ok ? "text.secondary" : "error"}>
                      {r.message}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </>
          ) : null}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancelar
        </Button>

        <Button
          onClick={handleImportAll}
          disabled={!canImport}
          variant="contained"
        >
          {loading ? <CircularProgress size={18} /> : "Importar PDFs"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
