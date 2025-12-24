"use client";

import { useEffect, useState, Fragment } from "react";
import { useSession } from "next-auth/react";
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Snackbar,
  Collapse,
  useMediaQuery,
} from "@mui/material";
import MuiAlert from "@mui/material/Alert";
import { useTheme } from "@mui/material/styles";

import RefreshIcon from "@mui/icons-material/Refresh";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";

import { makeHeaders } from "@/lib/api";
import CotizacionPDFButton from "@/components/cotizaciones/CotizacionPDFButton";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

/* =========================
   Utils
========================= */
function formatCLP(value) {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return Number(value).toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function nextEstados(estadoActual) {
  if (estadoActual === "COTIZACION") return ["ORDEN_VENTA"];
  if (estadoActual === "ORDEN_VENTA") return ["FACTURADA"];
  if (estadoActual === "FACTURADA") return ["PAGADA"];
  return [];
}

function estadoColor(estado) {
  switch (estado) {
    case "COTIZACION":
      return "default";
    case "ORDEN_VENTA":
      return "primary";
    case "FACTURADA":
      return "warning";
    case "PAGADA":
      return "success";
    default:
      return "default";
  }
}

/* =========================
   Page
========================= */
export default function CotizacionesPage() {
  const { data: session, status } = useSession();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [cotizaciones, setCotizaciones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [expandedId, setExpandedId] = useState(null);

  const [snackOpen, setSnackOpen] = useState(false);
  const [snackMsg, setSnackMsg] = useState("");
  const [snackSev, setSnackSev] = useState("success");

  const toggleExpanded = (id) =>
    setExpandedId((prev) => (prev === id ? null : id));

  const showSnack = (severity, message) => {
    setSnackSev(severity);
    setSnackMsg(message);
    setSnackOpen(true);
  };

  const closeSnack = (_, reason) => {
    if (reason === "clickaway") return;
    setSnackOpen(false);
  };

  /* =========================
     Fetch cotizaciones
  ========================= */
  const fetchCotizaciones = async () => {
    if (!session) return;
    try {
      setLoading(true);
      setErr("");

      const res = await fetch(`${API_URL}/cotizaciones`, {
        headers: makeHeaders(session),
        cache: "no-store",
      });

      const data = await safeJson(res);
      if (!res.ok) {
        throw new Error(
          data?.error || data?.detalle || "Error al listar cotizaciones"
        );
      }

      setCotizaciones(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e?.message || "Error al cargar cotizaciones");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") fetchCotizaciones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  /* =========================
     Cambiar estado
  ========================= */
  const updateEstado = async (cotizacionId, estado) => {
    try {
      const res = await fetch(
        `${API_URL}/cotizaciones/${cotizacionId}/estado`,
        {
          method: "POST",
          headers: makeHeaders(session),
          body: JSON.stringify({ estado }),
        }
      );

      const data = await safeJson(res);
      if (!res.ok) {
        throw new Error(
          data?.error || data?.detalle || "Error al actualizar estado"
        );
      }

      showSnack("success", `Estado actualizado a ${estado}`);
      setCotizaciones((prev) =>
        prev.map((c) => (c.id === cotizacionId ? data : c))
      );
    } catch (e) {
      showSnack("error", e?.message || "Error actualizando estado");
    }
  };

  /* =========================
     Render items (detalle)
  ========================= */
  const renderItemsTable = (c) => {
    const items = c.items || [];

    return (
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Tipo</TableCell>
              <TableCell>Producto / Servicio</TableCell>
              <TableCell>Descripción</TableCell>
              <TableCell align="right">Cantidad</TableCell>
              <TableCell align="right">Precio unit.</TableCell>
              <TableCell align="right">Total</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {items.map((it) => {
              const tipo = it.tipo || "-";
              const nombre =
                tipo === "PRODUCTO"
                  ? it.producto?.nombre || "(Producto)"
                  : it.Item || "(Servicio)";

              return (
                <TableRow key={it.id}>
                  <TableCell>{tipo}</TableCell>
                  <TableCell>{nombre}</TableCell>
                  <TableCell>{it.descripcion || "-"}</TableCell>
                  <TableCell align="right">{it.cantidad}</TableCell>
                  <TableCell align="right">
                    {formatCLP(it.precioUnitario)}
                  </TableCell>
                  <TableCell align="right">{formatCLP(it.total)}</TableCell>
                </TableRow>
              );
            })}

            {!items.length && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    Esta cotización no tiene ítems.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  /* =========================
     Estados base
  ========================= */
  if (status === "loading") {
    return (
      <Box
        sx={{
          minHeight: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (status === "unauthenticated") {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h6">
          Debes iniciar sesión para ver cotizaciones.
        </Typography>
      </Box>
    );
  }

  /* =========================
     UI
  ========================= */
  return (
    <Box sx={{ maxWidth: "1400px", mx: "auto", p: { xs: 2, md: 3 } }}>
      {/* Header */}
      <Box
        sx={{
          mb: 3,
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <Typography variant="h4" fontWeight={700}>
          Cotizaciones
        </Typography>

        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchCotizaciones}
          disabled={loading}
        >
          {loading ? "Actualizando..." : "Actualizar"}
        </Button>
      </Box>

      {err && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {err}
        </Alert>
      )}

      {!loading && !cotizaciones.length && !err && (
        <Alert severity="info">No hay cotizaciones registradas aún.</Alert>
      )}

      {/* ===== DESKTOP ===== */}
      {!isMobile && cotizaciones.length > 0 && (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell width={56} />
                <TableCell>#</TableCell>
                <TableCell>Fecha</TableCell>
                <TableCell>Proyecto</TableCell>
                <TableCell>Cliente</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell align="right" width={280}>
                  Acciones
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {cotizaciones.map((c) => {
                const fecha = c.creada_en
                  ? new Date(c.creada_en).toLocaleDateString("es-CL")
                  : "-";
                const estado = c.estado || "COTIZACION";
                const opciones = nextEstados(estado);
                const open = expandedId === c.id;

                return (
                  <Fragment key={c.id}>
                    <TableRow hover sx={{ cursor: "pointer" }} onClick={() => toggleExpanded(c.id)}>
                      <TableCell>
                        <IconButton size="small">
                          {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                        </IconButton>
                      </TableCell>

                      <TableCell>{c.numero ?? "—"}</TableCell>
                      <TableCell>{fecha}</TableCell>
                      <TableCell>{c.proyecto?.nombre || "—"}</TableCell>
                      <TableCell>{c.cliente?.nombre || "Sin cliente"}</TableCell>

                      <TableCell>
                        <Chip
                          label={estado}
                          size="small"
                          color={estadoColor(estado)}
                          variant="outlined"
                        />
                      </TableCell>

                      <TableCell align="right">{formatCLP(c.total)}</TableCell>

                      {/* ✅ Acciones + PDF */}
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end", flexWrap: "wrap" }}>
                          {opciones.length ? (
                            opciones.map((st) => (
                              <Button
                                key={st}
                                size="small"
                                variant="contained"
                                onClick={() => updateEstado(c.id, st)}
                              >
                                {st}
                              </Button>
                            ))
                          ) : (
                            <Button size="small" variant="outlined" disabled>
                              PAGADA
                            </Button>
                          )}

                          <CotizacionPDFButton cotizacion={c} />
                        </Box>
                      </TableCell>
                    </TableRow>

                    <TableRow>
                      <TableCell colSpan={8} sx={{ p: 0 }}>
                        <Collapse in={open} timeout="auto" unmountOnExit>
                          <Box sx={{ p: 2 }}>
                            {c.descripcion && (
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                {c.descripcion}
                              </Typography>
                            )}
                            {renderItemsTable(c)}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Snackbar */}
      <Snackbar
        open={snackOpen}
        autoHideDuration={4000}
        onClose={closeSnack}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <MuiAlert
          onClose={closeSnack}
          severity={snackSev}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {snackMsg}
        </MuiAlert>
      </Snackbar>
    </Box>
  );
}
