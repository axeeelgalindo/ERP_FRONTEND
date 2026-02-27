"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import EditIcon from "@mui/icons-material/Edit";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

function formatCLP(n) {
  const num = Number(n ?? 0);
  return num.toLocaleString("es-CL", { style: "currency", currency: "CLP" });
}

function fmtDate(d) {
  if (!d) return "-";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleString("es-CL");
}

async function safeJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function getEmpresaIdFromSession(session) {
  // ✅ AJUSTA ESTA LÍNEA si tu sesión trae empresaId con otro nombre:
  return (
    session?.user?.empresaId ||
    session?.user?.empresa_id ||
    session?.empresaId ||
    session?.empresa_id ||
    null
  );
}

function getAccessTokenFromSession(session) {
  // ✅ Si tu NextAuth guarda el token en otro campo, ajusta aquí.
  return session?.accessToken || session?.user?.accessToken || session?.token || null;
}

function EditNumeroDialog({ open, onClose, row, onSaved }) {
  const { data: session } = useSession();

  const empresaId = getEmpresaIdFromSession(session);
  const token = getAccessTokenFromSession(session);

  const [nuevoNumero, setNuevoNumero] = useState("");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setNuevoNumero(row?.numero != null ? String(row.numero) : "");
    setMotivo("");
    setError("");
    setSaving(false);
  }, [open, row]);

  const canSave = useMemo(() => {
    const n = Number(nuevoNumero);
    return Number.isInteger(n) && n > 0 && !saving;
  }, [nuevoNumero, saving]);

  const handleSave = async () => {
    setError("");
    const n = Number(nuevoNumero);
    if (!Number.isInteger(n) || n <= 0) {
      setError("El nuevo número debe ser un entero positivo.");
      return;
    }
    if (!row?.id) {
      setError("No hay cotización seleccionada.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/admin/cotizaciones/${row.id}/numero`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(empresaId ? { "x-empresa-id": empresaId } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({
          nuevoNumero: n,
          motivo: motivo?.trim() || null,
        }),
      });

      const data = await safeJson(res);

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || data?.detalle || "Error al actualizar número");
      }

      onSaved?.(data?.row || null);
      onClose?.();
    } catch (e) {
      setError(e?.message || "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? null : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Editar folio de cotización</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error ? <Alert severity="error">{error}</Alert> : null}

          <Box>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Cotización
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 800 }}>
              #{row?.numero ?? "-"} · {row?.cliente?.nombre ?? "—"}
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              ID: {row?.id ?? "-"}
            </Typography>
          </Box>

          <TextField
            label="Nuevo número"
            value={nuevoNumero}
            onChange={(e) => setNuevoNumero(e.target.value)}
            placeholder="Ej: 231"
            inputProps={{ inputMode: "numeric" }}
            disabled={saving}
            fullWidth
          />

          <TextField
            label="Motivo (opcional, recomendado)"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej: Corrección por cotización histórica / folio duplicado"
            disabled={saving}
            fullWidth
            multiline
            minRows={3}
          />

          <Alert severity="warning">
            Esto es una acción sensible (solo SUPERADMIN). Se registrará en auditoría.
          </Alert>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving} variant="outlined">
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={!canSave} variant="contained">
          {saving ? "Guardando..." : "Actualizar número"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function FolioCotizacionesPageClient() {
  const { data: session, status } = useSession();

  const empresaId = getEmpresaIdFromSession(session);
  const token = getAccessTokenFromSession(session);

  const [q, setQ] = useState("");
  const [numero, setNumero] = useState("");

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const canFetch = useMemo(() => {
    // si tu backend requiere sí o sí empresaId, deja esto como !!empresaId
    return status === "authenticated";
  }, [status]);

  const fetchRows = async () => {
    if (!canFetch) return;

    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (numero.trim()) params.set("numero", numero.trim());

      const url = `${API_URL}/admin/cotizaciones?${params.toString()}`;

      const res = await fetch(url, {
        method: "GET",
        headers: {
          ...(empresaId ? { "x-empresa-id": empresaId } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
      });

      const data = await safeJson(res);

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || data?.detalle || "Error al listar cotizaciones");
      }

      setRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch (e) {
      setError(e?.message || "Error inesperado");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // carga inicial
    if (canFetch) fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canFetch]);

  const onCopyId = async (id) => {
    try {
      await navigator.clipboard.writeText(String(id));
    } catch {
      // fallback silencioso
    }
  };

  const onOpenEdit = (row) => {
    setSelected(row);
    setEditOpen(true);
  };

  const onSaved = async () => {
    // refrescar tabla después de guardar
    await fetchRows();
  };

  const onSubmitSearch = (e) => {
    e?.preventDefault?.();
    fetchRows();
  };

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 900 }}>
          Admin · Folio Cotizaciones
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Buscar y corregir números de cotización (solo SUPERADMIN).
        </Typography>
      </Box>

      <Card>
        <CardContent>
          <Box component="form" onSubmit={onSubmitSearch}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="stretch">
              <TextField
                label="Buscar (cliente/asunto)"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                fullWidth
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                label="Número"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="Ej: 231"
                sx={{ width: { xs: "100%", md: 220 } }}
                inputProps={{ inputMode: "numeric" }}
              />

              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Button
                  type="button"
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={fetchRows}
                  disabled={!canFetch || loading}
                >
                  Refrescar
                </Button>

                <Button type="submit" variant="contained" disabled={!canFetch || loading}>
                  Buscar
                </Button>
              </Stack>
            </Stack>
          </Box>

          {error ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          ) : null}

          <Box sx={{ mt: 2, position: "relative" }}>
            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
                <CircularProgress />
              </Box>
            ) : null}

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800 }}>Número</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Cliente</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Estado</TableCell>
                  <TableCell sx={{ fontWeight: 800, textAlign: "right" }}>Total</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Creada en</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>ID</TableCell>
                  <TableCell sx={{ fontWeight: 800, width: 110 }} align="right">
                    Acción
                  </TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} sx={{ color: "text.secondary" }}>
                      No hay resultados.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={r.id} hover>
                      <TableCell sx={{ fontWeight: 900 }}>#{r.numero}</TableCell>
                      <TableCell>{r?.cliente?.nombre ?? "—"}</TableCell>
                      <TableCell>{r?.estado ?? "—"}</TableCell>
                      <TableCell sx={{ textAlign: "right" }}>{formatCLP(r?.total)}</TableCell>
                      <TableCell>{fmtDate(r?.creada_en)}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
                            {String(r.id).slice(0, 10)}…
                          </Typography>
                          <Tooltip title="Copiar ID">
                            <IconButton size="small" onClick={() => onCopyId(r.id)}>
                              <ContentCopyIcon fontSize="inherit" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Editar número">
                          <IconButton size="small" onClick={() => onOpenEdit(r)}>
                            <EditIcon fontSize="inherit" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Box>
        </CardContent>
      </Card>

      <EditNumeroDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        row={selected}
        onSaved={onSaved}
      />
    </Box>
  );
}