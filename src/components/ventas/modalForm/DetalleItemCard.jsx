"use client";

import {
  Alert,
  Box,
  Card,
  CardContent,
  Divider,
  IconButton,
  MenuItem,
  TextField,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import DeleteIcon from "@mui/icons-material/Delete";

import { formatCLP } from "@/components/ventas/utils/money";

export default function DetalleItemCard({
  idx,
  det,
  detallesLen,
  onRemove,
  updateDetalle,

  tipoItems,
  tipoDias,
  empleados,
  tipoItemHH,

  empleadoLabel,
  parseCLPToNumberString,
  toCLPDisplay,

  findHHForEmpleado,
  getHHCIFValue,
  isTipoItemAllowedTipoDia,
  isTipoDiaEnabled,

  mes,
  anio,
  previewLine,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const tipoDiaEnabled = isTipoDiaEnabled(det);

  const hhSelected =
    det.modo === "HH" ? findHHForEmpleado(det.empleadoId) : null;

  const hhSelectedCostoHH =
    hhSelected?.costoHH != null ? Number(hhSelected.costoHH) : 0;

  const hhSelectedCIF = getHHCIFValue(hhSelected);
  const faltaHH = det.modo === "HH" && det.empleadoId && !hhSelected;

  const subtotal = Number(previewLine?.ventaTotal ?? 0);

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 3,
        position: "relative",
        overflow: "visible",
        borderColor: "rgba(15,23,42,.10)",
        bgcolor: "#fff",
        boxShadow: "0 1px 2px rgba(15,23,42,.05)",
        transition: "all .15s ease",
        "&:hover": {
          borderColor: "rgba(25,118,210,.25)",
          boxShadow: "0 12px 26px rgba(15,23,42,.10)",
        },
      }}
    >
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
        {/* HEADER ROW: número + (delete inline en mobile) */}
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.75 }}>
          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: 2,
              flexShrink: 0,
              display: "grid",
              placeItems: "center",
              fontWeight: 1000,
              fontSize: 12,
              color: "text.secondary",
              bgcolor: "rgba(15,23,42,.06)",
            }}
          >
            {idx + 1}
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(12, minmax(0, 1fr))",
                },
                gap: 1.5,
              }}
            >
              {/* DESCRIPCIÓN */}
              <Box sx={{ gridColumn: { xs: "1 / -1", sm: "span 6" } }}>
                <Typography
                  sx={{
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: ".08em",
                    color: "text.secondary",
                    textTransform: "uppercase",
                    mb: 0.5,
                  }}
                >
                  Descripción
                </Typography>
                <TextField
                  value={det.descripcion}
                  onChange={(e) =>
                    updateDetalle(idx, { descripcion: e.target.value })
                  }
                  size="small"
                  fullWidth
                  placeholder="Nombre producto o servicio..."
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 1.5,
                      bgcolor: "rgba(15,23,42,.03)",
                    },
                  }}
                />
              </Box>

              {/* MODO */}
              <Box sx={{ gridColumn: { xs: "1 / -1", sm: "span 3" } }}>
                <Typography
                  sx={{
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: ".08em",
                    color: "text.secondary",
                    textTransform: "uppercase",
                    mb: 0.5,
                  }}
                >
                  Modo
                </Typography>

                <TextField
                  select
                  value={det.modo}
                  onChange={(e) => {
                    const modo = e.target.value;

                    if (modo === "HH") {
                      updateDetalle(idx, {
                        modo,
                        empleadoId: det.empleadoId || "",
                        compraId: "",
                        costoUnitarioManual: "",
                        tipoItemId: tipoItemHH?.id || det.tipoItemId || "",
                      });
                    } else {
                      const nextTipoItemId =
                        det.tipoItemId &&
                        det.tipoItemId !== (tipoItemHH?.id || "")
                          ? det.tipoItemId
                          : "";

                      const ti =
                        tipoItems.find((t) => t.id === nextTipoItemId) || null;
                      const enabled = isTipoItemAllowedTipoDia(ti);

                      updateDetalle(idx, {
                        modo,
                        empleadoId: "",
                        compraId: "",
                        costoUnitarioManual: "",
                        tipoItemId: nextTipoItemId,
                        tipoDiaId: enabled ? det.tipoDiaId : "",
                      });
                    }
                  }}
                  size="small"
                  fullWidth
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 1.5,
                      bgcolor: "rgba(15,23,42,.03)",
                    },
                  }}
                >
                  <MenuItem value="HH">HH (Empleado)</MenuItem>
                  <MenuItem value="COMPRA">Compra (Insumo)</MenuItem>
                </TextField>
              </Box>

              {/* CANTIDAD */}
              <Box sx={{ gridColumn: { xs: "1 / -1", sm: "span 3" } }}>
                <Typography
                  sx={{
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: ".08em",
                    color: "text.secondary",
                    textTransform: "uppercase",
                    mb: 0.5,
                  }}
                >
                  Cantidad
                </Typography>
                <TextField
                  value={det.cantidad}
                  onChange={(e) =>
                    updateDetalle(idx, { cantidad: Number(e.target.value) })
                  }
                  size="small"
                  type="number"
                  fullWidth
                  inputProps={{ min: 1 }}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 1.5,
                      bgcolor: "rgba(15,23,42,.03)",
                    },
                  }}
                />
              </Box>

              {det.modo === "HH" ? (
                <>
                  {/* EMPLEADO */}
                  <Box sx={{ gridColumn: { xs: "1 / -1", sm: "span 4" } }}>
                    <Typography
                      sx={{
                        fontSize: 10,
                        fontWeight: 900,
                        letterSpacing: ".08em",
                        color: "text.secondary",
                        textTransform: "uppercase",
                        mb: 0.5,
                      }}
                    >
                      Empleado / Recurso
                    </Typography>
                    <TextField
                      select
                      value={det.empleadoId}
                      onChange={(e) =>
                        updateDetalle(idx, { empleadoId: e.target.value })
                      }
                      size="small"
                      fullWidth
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          borderRadius: 1.5,
                          bgcolor: "rgba(15,23,42,.03)",
                        },
                      }}
                    >
                      <MenuItem value="">(Selecciona)</MenuItem>
                      {empleados.map((emp) => (
                        <MenuItem key={emp.id} value={emp.id}>
                          {empleadoLabel(emp)}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Box>

                  {/* TIPO DÍA */}
                  <Box sx={{ gridColumn: { xs: "1 / -1", sm: "span 4" } }}>
                    <Typography
                      sx={{
                        fontSize: 10,
                        fontWeight: 900,
                        letterSpacing: ".08em",
                        color: "text.secondary",
                        textTransform: "uppercase",
                        mb: 0.5,
                      }}
                    >
                      Tipo de Día
                    </Typography>
                    <TextField
                      select
                      value={det.tipoDiaId}
                      onChange={(e) =>
                        updateDetalle(idx, { tipoDiaId: e.target.value })
                      }
                      size="small"
                      fullWidth
                      disabled={!tipoDiaEnabled}
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          borderRadius: 1.5,
                          bgcolor: "rgba(15,23,42,.03)",
                        },
                      }}
                    >
                      {tipoDias.map((t) => (
                        <MenuItem key={t.id} value={t.id}>
                          {t.nombre}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Box>

                  {/* AJUSTE */}
                  <Box sx={{ gridColumn: { xs: "1 / -1", sm: "span 2" } }}>
                    <Typography
                      sx={{
                        fontSize: 10,
                        fontWeight: 900,
                        letterSpacing: ".08em",
                        color: "text.secondary",
                        textTransform: "uppercase",
                        mb: 0.5,
                      }}
                    >
                      Ajuste %
                    </Typography>
                    <TextField
                      value={det.alphaPct}
                      onChange={(e) =>
                        updateDetalle(idx, {
                          alphaPct:
                            e.target.value === "" ? "" : Number(e.target.value),
                        })
                      }
                      size="small"
                      type="number"
                      fullWidth
                      inputProps={{ step: 1, min: 0 }}
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          borderRadius: 1.5,
                          bgcolor: "rgba(15,23,42,.03)",
                        },
                      }}
                    />
                 
                  </Box>

                  {/* SUBTOTAL */}
                  <Box
                    sx={{
                      gridColumn: { xs: "1 / -1", sm: "span 2" },
                      display: "flex",
                      alignItems: "flex-end",
                      justifyContent: { xs: "flex-start", sm: "flex-end" },
                    }}
                  >
                    <Box sx={{ textAlign: { xs: "left", sm: "right" } }}>
                      <Typography
                        sx={{
                          fontSize: 10,
                          fontWeight: 900,
                          letterSpacing: ".08em",
                          color: "text.secondary",
                          textTransform: "uppercase",
                          mb: 0.5,
                        }}
                      >
                        Subtotal
                      </Typography>
                      <Typography sx={{ fontWeight: 900, color: "primary.main" }}>
                        {formatCLP(subtotal)}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Costo HH display */}
                  <Box sx={{ gridColumn: { xs: "1 / -1", sm: "span 12" } }}>
                    <TextField
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          borderRadius: 1.5,
                          bgcolor: "rgba(15,23,42,.03)",
                        },
                      }}
                      label="Costo HH (según período)"
                      size="small"
                      value={
                        det.empleadoId
                          ? hhSelected
                            ? `${formatCLP(hhSelectedCostoHH)} | CIF: ${formatCLP(
                                hhSelectedCIF,
                              )}`
                            : "-"
                          : "-"
                      }
                      fullWidth
                      disabled
                      helperText={
                        det.empleadoId && !hhSelected
                          ? `No hay HHEmpleado para este empleado en ${mes}/${anio}.`
                          : "CIF se muestra aunque sea 0."
                      }
                    />

                    {faltaHH && (
                      <Alert severity="warning" sx={{ mt: 1 }}>
                        Falta HH del período para este empleado ({mes}/{anio}).
                      </Alert>
                    )}
                  </Box>
                </>
              ) : (
                <>
                  {/* TIPO ÍTEM */}
                  <Box sx={{ gridColumn: { xs: "1 / -1", sm: "span 4" } }}>
                    <Typography
                      sx={{
                        fontSize: 10,
                        fontWeight: 900,
                        letterSpacing: ".08em",
                        color: "text.secondary",
                        textTransform: "uppercase",
                        mb: 0.5,
                      }}
                    >
                      Tipo ítem (categoría)
                    </Typography>
                    <TextField
                      select
                      value={det.tipoItemId}
                      onChange={(e) => {
                        const nextId = e.target.value;
                        const ti =
                          tipoItems.find((t) => t.id === nextId) || null;
                        const enabled = isTipoItemAllowedTipoDia(ti);

                        updateDetalle(idx, {
                          tipoItemId: nextId,
                          tipoDiaId: enabled ? det.tipoDiaId : "",
                        });
                      }}
                      size="small"
                      fullWidth
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          borderRadius: 1.5,
                          bgcolor: "rgba(15,23,42,.03)",
                        },
                      }}
                    >
                      <MenuItem value="">(Selecciona)</MenuItem>

                      {tipoItems
                        .filter(
                          (t) => String(t?.codigo || "").toUpperCase() !== "HH",
                        )
                        .filter(
                          (t) => String(t?.nombre || "").toUpperCase() !== "HH",
                        )
                        .map((t) => (
                          <MenuItem key={t.id} value={t.id}>
                            {t.nombre}
                            {t.unidadItem?.nombre
                              ? ` (${t.unidadItem.nombre})`
                              : ""}
                          </MenuItem>
                        ))}
                    </TextField>
                  </Box>

                  {/* TIPO DÍA */}
                  <Box sx={{ gridColumn: { xs: "1 / -1", sm: "span 4" } }}>
                    <Typography
                      sx={{
                        fontSize: 10,
                        fontWeight: 900,
                        letterSpacing: ".08em",
                        color: "text.secondary",
                        textTransform: "uppercase",
                        mb: 0.5,
                      }}
                    >
                      Tipo de Día
                    </Typography>
                    <TextField
                      select
                      value={det.tipoDiaId}
                      onChange={(e) =>
                        updateDetalle(idx, { tipoDiaId: e.target.value })
                      }
                      size="small"
                      fullWidth
                      disabled={!tipoDiaEnabled}
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          borderRadius: 1.5,
                          bgcolor: "rgba(15,23,42,.03)",
                        },
                      }}
                    >
                      {tipoDias.map((t) => (
                        <MenuItem key={t.id} value={t.id}>
                          {t.nombre}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Box>

                  {/* AJUSTE */}
                  <Box sx={{ gridColumn: { xs: "1 / -1", sm: "span 2" } }}>
                    <Typography
                      sx={{
                        fontSize: 10,
                        fontWeight: 900,
                        letterSpacing: ".08em",
                        color: "text.secondary",
                        textTransform: "uppercase",
                        mb: 0.5,
                      }}
                    >
                      Ajuste %
                    </Typography>
                    <TextField
                      value={det.alphaPct}
                      onChange={(e) =>
                        updateDetalle(idx, {
                          alphaPct:
                            e.target.value === "" ? "" : Number(e.target.value),
                        })
                      }
                      size="small"
                      type="number"
                      fullWidth
                      inputProps={{ step: 1, min: 0 }}
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          borderRadius: 1.5,
                          bgcolor: "rgba(15,23,42,.03)",
                        },
                      }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      Ej: 10 = +10%
                    </Typography>
                  </Box>

                  {/* SUBTOTAL */}
                  <Box
                    sx={{
                      gridColumn: { xs: "1 / -1", sm: "span 2" },
                      display: "flex",
                      alignItems: "flex-end",
                      justifyContent: { xs: "flex-start", sm: "flex-end" },
                    }}
                  >
                    <Box sx={{ textAlign: { xs: "left", sm: "right" } }}>
                      <Typography
                        sx={{
                          fontSize: 10,
                          fontWeight: 900,
                          letterSpacing: ".08em",
                          color: "text.secondary",
                          textTransform: "uppercase",
                          mb: 0.5,
                        }}
                      >
                        Subtotal
                      </Typography>
                      <Typography sx={{ fontWeight: 900, color: "primary.main" }}>
                        {formatCLP(subtotal)}
                      </Typography>
                    </Box>
                  </Box>

                  {/* PU Manual */}
                  <Box sx={{ gridColumn: { xs: "1 / -1", sm: "span 12" } }}>
                    <TextField
                      label="Precio unitario"
                      size="small"
                      type="text"
                      required
                      value={det.costoUnitarioManual}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const clean = parseCLPToNumberString(raw);

                        updateDetalle(idx, {
                          costoUnitarioManual: clean ? toCLPDisplay(clean) : "",
                          ...(clean ? { compraId: "" } : {}),
                        });
                      }}
                      fullWidth
                      inputProps={{ inputMode: "numeric" }}
                      disabled={!!det.compraId}
                      helperText={
                        det.compraId
                          ? "Deshabilitado porque seleccionaste un CompraItem."
                          : "Ingresa PU para estimación (COMPRA manual)."
                      }
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          borderRadius: 1.5,
                          bgcolor: "rgba(15,23,42,.03)",
                        },
                      }}
                    />
                  </Box>
                </>
              )}
            </Box>

            <Divider sx={{ my: 1.8 }} />

          
          </Box>

          {/* Delete SOLO DESKTOP: absoluto (está ok en pantallas grandes) */}
          {!isMobile && detallesLen > 1 ? (
            <IconButton
              onClick={onRemove}
              size="small"
              aria-label="Eliminar ítem"
              sx={{
                position: "absolute",
                right: 10,
                top: 10,
                bgcolor: "rgba(239,68,68,.12)",
                color: "error.main",
                border: "1px solid rgba(239,68,68,.25)",
                transition: "all .15s ease",
                "&:hover": { bgcolor: "rgba(239,68,68,.18)" },
                opacity: { xs: 1, sm: 0 },
                ".MuiCard-root:hover &": { opacity: 1 },
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          ) : null}
        </Box>
      </CardContent>
    </Card>
  );
}
