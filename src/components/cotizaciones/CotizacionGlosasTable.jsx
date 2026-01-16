"use client";

import {
  Box,
  Chip,
  Divider,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

import { estadoColor, fechaCL, formatCLP } from "@/components/cotizaciones/utils/utils";

function Field({ label, value }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 700, lineHeight: 1.2 }}>
        {value ?? "—"}
      </Typography>
    </Box>
  );
}

export default function CotizacionGlosasTable({ glosas = [], subtotal, cotizacion }) {
  const c = cotizacion ?? null;

  const rows = Array.isArray(c?.glosas)
    ? c.glosas
    : Array.isArray(glosas)
    ? glosas
    : [];

  const sub = c?.subtotal ?? subtotal;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      {/* INFO COTIZACION (opcional) */}
      {c ? (
        <Paper variant="outlined" sx={{ borderRadius: 2, p: 2 }}>
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1.5,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography fontWeight={900}>
                Cotización #{c.numero ?? "—"}
              </Typography>

              <Chip
                size="small"
                variant="outlined"
                color={estadoColor(c.estado || "COTIZACION")}
                label={(c.estado || "COTIZACION").replaceAll("_", " ")}
                sx={{ fontWeight: 800 }}
              />
            </Box>

            <Typography variant="body2" color="text.secondary">
              Creada: <strong>{c.creada_en ? fechaCL(c.creada_en) : "—"}</strong>
            </Typography>
          </Box>

          <Divider sx={{ my: 1.5 }} />

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "repeat(4, 1fr)" },
              gap: 1.5,
            }}
          >
            <Field label="Cliente" value={c.cliente?.nombre || "—"} />
            
            <Field
              label="Vendedor"
              value={
                c.vendedor?.nombre ||
                c.vendedor?.correo ||
                (c.vendedor_id ? `ID: ${c.vendedor_id}` : "—")
              }
            />

            <Field label="Subtotal (neto)" value={formatCLP(c.subtotal)} />
            <Field label="IVA" value={formatCLP(c.iva)} />
            <Field label="Total" value={formatCLP(c.total)} />
          </Box>

          {(c.asunto || c.terminos_condiciones || c.acuerdo_pago) ? (
            <>
              <Divider sx={{ my: 1.5 }} />

              {c.asunto ? (
                <Box sx={{ mb: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Asunto
                  </Typography>
                  <Typography sx={{ fontWeight: 700 }}>{c.asunto}</Typography>
                </Box>
              ) : null}

              {c.terminos_condiciones ? (
                <Box sx={{ mb: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Términos y condiciones
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {c.terminos_condiciones}
                  </Typography>
                </Box>
              ) : null}

              {c.acuerdo_pago ? (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Acuerdo de pago
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {c.acuerdo_pago}
                  </Typography>
                </Box>
              ) : null}
            </>
          ) : null}
        </Paper>
      ) : null}

      {/* TABLA GLOSAS (RESPONSIVE) */}
      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{
          borderRadius: 2,
          overflowX: "auto",          // ✅ scroll horizontal si no cabe
          WebkitOverflowScrolling: "touch",
        }}
      >
        <Table
          size="small"
          sx={{
            minWidth: 720,             // ✅ fuerza layout y evita colapsos raros
            tableLayout: "fixed",      // ✅ columnas controladas
          }}
        >
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 80, fontWeight: 900 }}>Orden</TableCell>
              <TableCell sx={{ width: "auto", fontWeight: 900 }}>
                Descripción
              </TableCell>
              <TableCell sx={{ width: 140, fontWeight: 900 }}>Tipo</TableCell>
              <TableCell
                align="right"
                sx={{ width: 170, fontWeight: 900, whiteSpace: "nowrap" }}
              >
                Monto
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {rows.map((g, idx) => {
              const orden = Number.isFinite(Number(g.orden))
                ? Number(g.orden) + 1
                : idx + 1;

              return (
                <TableRow key={g.id ?? `${idx}-${g.descripcion}`} hover>
                  <TableCell sx={{ fontWeight: 900 }}>{orden}</TableCell>

                  <TableCell sx={{ fontWeight: 700 }}>
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 0.25,
                        minWidth: 0,
                      }}
                    >
                      <Typography
                        sx={{
                          fontWeight: 700,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap", // ✅ no rompe el layout
                        }}
                      >
                        {String(g.descripcion || "").trim() || "-"}
                      </Typography>

                      {g.id ? (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          ID: {g.id}
                        </Typography>
                      ) : null}
                    </Box>
                  </TableCell>

                  <TableCell>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={g.manual ? "MANUAL" : "AUTO"}
                    />
                  </TableCell>

                  <TableCell
                    align="right"
                    sx={{ fontWeight: 900, whiteSpace: "nowrap" }}
                  >
                    {formatCLP(g.monto)}
                  </TableCell>
                </TableRow>
              );
            })}

            {!rows.length && (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    Esta cotización no tiene glosas.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <Box sx={{ px: 2, py: 1, borderTop: "1px solid", borderColor: "divider" }}>
          <Typography variant="caption" color="text.secondary">
            Glosas: <strong>{rows.length}</strong>
            {typeof sub !== "undefined" ? (
              <>
                {" "}
                — Subtotal: <strong>{formatCLP(sub)}</strong>
              </>
            ) : null}
          </Typography>
        </Box>
      </TableContainer>
    </Box>
  );
}
