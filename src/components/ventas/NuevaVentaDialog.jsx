"use client";

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  IconButton,
  Typography,
  useMediaQuery,
  Switch,
  FormControlLabel,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import AddShoppingCartIcon from "@mui/icons-material/AddShoppingCart";

import { formatCLP } from "@/components/ventas/utils/money";
import {
  DetalleItemsSection,
  useVentaForm,
} from "@/components/ventas/modalForm";

export default function NuevaVentaDialog({
  open,
  onClose,
  session,
  empresaIdFromToken,
  onCreated,
  ventaId = null,
}) {
  const theme = useTheme();

  // fullScreen solo para xs (celulares)
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  // layout 1 columna para sm/md- (tablets) y 2 columnas para md+
  const isNarrow = useMediaQuery(theme.breakpoints.down("md"));

  const form = useVentaForm({
    open,
    session,
    empresaIdFromToken,
    ventaId,
  });

  const handleClose = () => {
    if (form.isEdit) form.setVentaCargada(false);
    onClose?.();
  };

  // ✅ % utilidad real sobre TOTAL FINAL (incluye extraCosteo)
  const utilidadPct =
    form.preview?.total > 0
      ? ((form.preview.utilidad / form.preview.total) * 100).toFixed(1)
      : "0.0";

  const extraCosteo = Number(
    form.preview?.extraCosteo || form.extraCosteo || 0,
  );

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullScreen={fullScreen}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: fullScreen ? 0 : 4,
          overflow: "hidden",
          boxShadow: "0 24px 80px rgba(15,23,42,.25)",
          border: "1px solid",
          borderColor: "divider",

          // ✅ clave: Paper como columna con alto controlado
          height: { xs: "100dvh", md: "90vh" },
          maxHeight: { xs: "100dvh", md: "90vh" },
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      {/* ===== Header ===== */}
      <Box
        sx={{
          px: { xs: 2, md: 4 },
          py: 2,
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 2,
          flexShrink: 0,
        }}
      >
        <Box>
          <Typography
            sx={{
              fontSize: 18,
              fontWeight: 1000,
              color: "text.primary",
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            <AddShoppingCartIcon sx={{ color: "primary.main" }} />
            {form.isEdit
              ? `Editar costeo #${ventaId?.slice?.(0, 6) || ""}`
              : "Nuevo costeo"}
          </Typography>

          <Typography sx={{ fontSize: 13, color: "text.secondary", mt: 0.25 }}>
            Configure los detalles generales y agregue ítems al costeo.
          </Typography>
        </Box>

        <IconButton onClick={handleClose} sx={{ mt: 0.25 }}>
          <CloseIcon />
        </IconButton>
      </Box>

      {/* ===== Body (UN SOLO SCROLL) ===== */}
      <Box
        sx={{
          flex: 1,
          bgcolor: "rgba(248,250,252,1)",
          overflowY: "auto", // ✅ único scroll
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: isNarrow ? "1fr" : "360px 1fr",
            alignItems: "start",
          }}
        >
          {/* ===== Left panel ===== */}
          <Box
            sx={{
              borderRight: isNarrow ? "none" : "1px solid",
              borderBottom: isNarrow ? "1px solid" : "none",
              borderColor: "rgba(15,23,42,.08)",
              bgcolor: "rgba(248,250,252,1)",
              p: { xs: 2, md: 3.5 },
            }}
          >
            <Box sx={{ display: "grid", gap: 3 }}>
              {/* Info general */}
              <Box sx={{ display: "grid", gap: 1.5 }}>
                <Typography
                  sx={{
                    fontSize: 11,
                    fontWeight: 1000,
                    letterSpacing: ".14em",
                    color: "text.disabled",
                    textTransform: "uppercase",
                  }}
                >
                  Información General
                </Typography>

                <Box sx={{ display: "grid", gap: 1.5 }}>
                  <Box>
                    <Typography
                      sx={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "text.secondary",
                        mb: 0.5,
                      }}
                    >
                      Descripción de la venta
                    </Typography>

                    <Box
                      component="textarea"
                      value={form.descripcionVenta}
                      onChange={(e) => form.setDescripcionVenta(e.target.value)}
                      placeholder="Ej: Proyecto Modernización Redes 2024"
                      rows={3}
                      style={{
                        width: "100%",
                        resize: "none",
                        borderRadius: 12,
                        border: "1px solid rgba(15,23,42,.12)",
                        padding: 12,
                        outline: "none",
                        fontFamily: "inherit",
                        fontSize: 13,
                        background: "#fff",
                      }}
                    />
                  </Box>

                  <Box>
                    <Typography
                      sx={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "text.secondary",
                        mb: 0.5,
                      }}
                    >
                      % Utilidad Objetivo
                    </Typography>

                    <Box sx={{ position: "relative" }}>
                      <Box
                        component="input"
                        type="number"
                        value={form.utilidadPctObjetivo}
                        onChange={(e) =>
                          form.setUtilidadPctObjetivo(e.target.value)
                        }
                        placeholder="25"
                        style={{
                          width: "100%",
                          borderRadius: 12,
                          border: "1px solid rgba(15,23,42,.12)",
                          padding: "10px 36px 10px 12px",
                          outline: "none",
                          fontFamily: "inherit",
                          fontSize: 13,
                          background: "#fff",
                        }}
                        min={0}
                        step={0.1}
                      />
                      <Box
                        sx={{
                          position: "absolute",
                          right: 12,
                          top: 9,
                          fontSize: 13,
                          color: "text.disabled",
                          fontWeight: 800,
                        }}
                      >
                        %
                      </Box>
                    </Box>

                    <Typography
                      sx={{
                        fontSize: 11,
                        color: "text.disabled",
                        fontStyle: "italic",
                        mt: 0.5,
                      }}
                    >
                      {/* aquí puedes mostrar un hint si quieres */}
                    </Typography>
                  </Box>

                  {/* ✅ NUEVO: Tipo día por costeo (1 vez) */}
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2.5,
                      border: "1px solid rgba(15,23,42,.10)",
                      bgcolor: "#fff",
                      boxShadow: "0 1px 2px rgba(15,23,42,.04)",
                      display: "grid",
                      gap: 1,
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: 12,
                        fontWeight: 900,
                        color: "text.secondary",
                      }}
                    >
                      Tipo día (costeo)
                    </Typography>

                    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                      <FormControlLabel
                        sx={{ m: 0 }}
                        control={
                          <Switch
                            checked={!!form.isFeriado}
                            onChange={(e) =>
                              form.setIsFeriado(e.target.checked)
                            }
                          />
                        }
                        label={
                          <Typography sx={{ fontSize: 12, fontWeight: 800 }}>
                            Feriado
                          </Typography>
                        }
                      />

                      <FormControlLabel
                        sx={{ m: 0 }}
                        control={
                          <Switch
                            checked={!!form.isUrgencia}
                            onChange={(e) =>
                              form.setIsUrgencia(e.target.checked)
                            }
                          />
                        }
                        label={
                          <Typography sx={{ fontSize: 12, fontWeight: 800 }}>
                            Urgencia
                          </Typography>
                        }
                      />
                    </Box>
                    {/* 
                    <Typography sx={{ fontSize: 11, color: "text.disabled" }}>
                      Se suma 1 vez al total (no por ítem).
                    </Typography>
                      */}
                  </Box>
                </Box>
              </Box>

              {/* Resumen financiero */}
              <Box sx={{ display: "grid", gap: 1.5, pt: 1 }}>
                <Typography
                  sx={{
                    fontSize: 11,
                    fontWeight: 1000,
                    letterSpacing: ".14em",
                    color: "text.disabled",
                    textTransform: "uppercase",
                  }}
                >
                  Resumen Financiero
                </Typography>

                <Box sx={{ display: "grid", gap: 1.25 }}>
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 2.5,
                      border: "1px solid rgba(15,23,42,.10)",
                      bgcolor: "#fff",
                      boxShadow: "0 1px 2px rgba(15,23,42,.04)",
                    }}
                  >
                    <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                      Total Venta
                    </Typography>
                    <Typography
                      sx={{ fontSize: 26, fontWeight: 1000, mt: 0.5 }}
                    >
                      {formatCLP(form.preview?.total || 0)}
                    </Typography>

                    {/* ✅ NUEVO: extraCosteo visible */}
                    {extraCosteo > 0 && (
                      <Typography
                        sx={{ fontSize: 12, color: "text.disabled", mt: 0.75 }}
                      >
                        Incluye extra costeo: <b>{formatCLP(extraCosteo)}</b>
                      </Typography>
                    )}
                  </Box>

                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 2.5,
                      border: "1px solid rgba(15,23,42,.10)",
                      bgcolor: "#fff",
                      boxShadow: "0 1px 2px rgba(15,23,42,.04)",
                    }}
                  >
                    <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                      Total Costo
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: 18,
                        fontWeight: 900,
                        color: "text.secondary",
                        mt: 0.5,
                      }}
                    >
                      {formatCLP(form.preview?.costo || 0)}
                    </Typography>

                    {/* 
                    {extraCosteo > 0 && (
                      <Typography sx={{ fontSize: 12, color: "text.disabled", mt: 0.5 }}>
                        Extra (passthrough): <b>{formatCLP(extraCosteo)}</b>
                      </Typography>
                    )}
                        */}
                  </Box>

                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 2.5,
                      border: "1px solid rgba(16,185,129,.20)",
                      bgcolor: "rgba(16,185,129,.10)",
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-end",
                      }}
                    >
                      <Box>
                        <Typography
                          sx={{
                            fontSize: 12,
                            fontWeight: 900,
                            color: "success.main",
                          }}
                        >
                          Utilidad Estimada
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: 26,
                            fontWeight: 1000,
                            color: "success.main",
                            mt: 0.5,
                          }}
                        >
                          {formatCLP(form.preview?.utilidad || 0)}
                        </Typography>
                      </Box>

                      <Typography
                        sx={{
                          fontSize: 12,
                          fontWeight: 1000,
                          color: "success.main",
                        }}
                      >
                        {utilidadPct}%
                      </Typography>
                    </Box>

                    {/* ✅ opcional: mostrar k 
                    {Number.isFinite(form.preview?.k) && form.preview?.k !== 1 && (
                      <Typography sx={{ fontSize: 12, color: "success.main", mt: 0.75, fontWeight: 900 }}>
                        Factor k aplicado: {Number(form.preview.k).toFixed(4)}
                      </Typography>
                    )} */}
                  </Box>
                </Box>
              </Box>

              {/* Estado */}
              <Box>
                {(form.loadingCatalogos || form.loadingVenta) && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <CircularProgress size={18} />
                    <Typography variant="body2" color="text.secondary">
                      {form.loadingVenta
                        ? "Cargando costeo..."
                        : "Cargando catálogos..."}
                    </Typography>
                  </Box>
                )}
                {form.catalogosErr && (
                  <Alert severity="error" sx={{ mt: 1.25 }}>
                    {form.catalogosErr}
                  </Alert>
                )}
              </Box>
            </Box>
          </Box>

          {/* ===== Right panel ===== */}
          <Box sx={{ p: { xs: 2, md: 3.5 } }}>
            <DetalleItemsSection
              theme={theme}
              detalles={form.detalles}
              addDetalle={form.addDetalle}
              removeDetalle={form.removeDetalle}
              updateDetalle={form.updateDetalle}
              tipoItems={form.tipoItems}
              tipoDias={form.tipoDias}
              empleados={form.empleados}
              tipoItemHH={form.tipoItemHH}
              empleadoLabel={form.empleadoLabel}
              parseCLPToNumberString={form.parseCLPToNumberString}
              toCLPDisplay={form.toCLPDisplay}
              findHHForEmpleado={form.findHHForEmpleado}
              getHHCIFValue={form.getHHCIFValue}
              isTipoItemAllowedTipoDia={form.isTipoItemAllowedTipoDia}
              isTipoDiaEnabled={form.isTipoDiaEnabled}
              mes={form.mes}
              anio={form.anio}
              preview={form.preview}
              formErr={form.formErr}
            />
          </Box>
        </Box>
      </Box>

      {/* ===== Footer (siempre visible) ===== */}
      <Box
        sx={{
          px: { xs: 2, md: 4 },
          py: 2,
          borderTop: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
          display: "flex",
          justifyContent: "flex-end",
          gap: 1.5,
          flexShrink: 0,
        }}
      >
        <Button onClick={handleClose} color="inherit" disabled={form.saving}>
          Cancelar
        </Button>

        <Button
          variant="contained"
          onClick={() => form.submitVenta({ onClose: handleClose, onCreated })}
          disabled={form.saving || form.loadingCatalogos || form.loadingVenta}
          sx={{
            fontWeight: 1000,
            px: 3,
            borderRadius: 2,
            boxShadow: "0 10px 22px rgba(25,118,210,.22)",
          }}
        >
          {form.saving
            ? "Guardando..."
            : form.isEdit
              ? "Guardar cambios"
              : "CREAR VENTA"}
        </Button>
      </Box>
    </Dialog>
  );
}
