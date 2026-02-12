"use client";

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";

import {
  GeneralInfoSection,
  TotalesBar,
  DetalleItemsSection,
  useVentaForm,
  GeneralInfoSticky,
} from "@/components/ventas/modalForm";

export default function NuevaVentaDialog({
  open,
  onClose,
  session,
  empresaIdFromToken,
  onCreated,
  ventaId = null, // edit si viene
}) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

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

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullScreen={fullScreen}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { borderRadius: fullScreen ? 0 : 3, overflow: "hidden" },
      }}
    >
      <DialogTitle sx={{ fontWeight: 900 }}>
        {form.isEdit
          ? `Editar costeo #${ventaId?.slice?.(0, 6) || ""}`
          : "Nueva Venta / Costeo"}
      </DialogTitle>

<DialogContent
  dividers
  sx={{
    p: 0,
    // MUY IMPORTANTE: asegurar que ESTE es el scroll container
    overflowY: "auto",
    bgcolor:
      theme.palette.mode === "dark"
        ? "rgba(248,250,252,1)"
        : "rgba(248,250,252,1)",
  }}
>
  {/* ✅ STICKY debe ser el primer hijo del contenedor scrolleable */}
  <GeneralInfoSticky
    theme={theme}
    descripcionVenta={form.descripcionVenta}
    setDescripcionVenta={form.setDescripcionVenta}
    utilidadPctObjetivo={form.utilidadPctObjetivo}
    setUtilidadPctObjetivo={form.setUtilidadPctObjetivo}
    preview={form.preview}
  />

  {/* el resto va debajo */}
  <Box sx={{ p: 2.5 }}>
    {(form.loadingCatalogos || form.loadingVenta) && (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <CircularProgress size={18} />
        <Typography variant="body2" color="text.secondary">
          {form.loadingVenta ? "Cargando costeo..." : "Cargando catálogos..."}
        </Typography>
      </Box>
    )}

    {form.catalogosErr && (
      <Alert severity="error" sx={{ mb: 2 }}>
        {form.catalogosErr}
      </Alert>
    )}
  </Box>

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
</DialogContent>


      <DialogActions sx={{ px: 2.5, py: 2 }}>
        <Button onClick={handleClose} color="inherit" disabled={form.saving}>
          Cancelar
        </Button>

        <Button
          variant="contained"
          onClick={() => form.submitVenta({ onClose: handleClose, onCreated })}
          disabled={form.saving || form.loadingCatalogos || form.loadingVenta}
        >
          {form.saving
            ? "Guardando..."
            : form.isEdit
              ? "Guardar cambios"
              : "Crear venta"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
