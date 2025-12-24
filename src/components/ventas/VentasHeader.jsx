"use client";

import { Box, Button, Typography } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import AddIcon from "@mui/icons-material/Add";

export default function VentasHeader({
  empresaLabel,
  loadingVentas,
  onRefresh,
  onOpenNewVenta,
  onOpenCotizacion,
}) {
  return (
    <Box
      sx={{
        mb: 3,
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
        alignItems: { xs: "flex-start", md: "center" },
        justifyContent: "space-between",
        gap: 1,
      }}
    >
      <Box>
        <Typography variant="h4" fontWeight={700}>
          Ventas
        </Typography>

        <Typography variant="body2" color="text.secondary">
          Empresa: <strong>{empresaLabel}</strong>
        </Typography>

        <Typography variant="body2" color="text.secondary">
          Crea ventas por HH (mano de obra) o por ítems de compra (insumos), con
          margen por tipo de ítem.
        </Typography>
      </Box>

      <Box sx={{ display: "flex", gap: 1, mt: { xs: 1, md: 0 }, flexWrap: "wrap" }}>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={onRefresh}
          disabled={loadingVentas}
        >
          {loadingVentas ? "Actualizando..." : "Actualizar"}
        </Button>

        <Button variant="outlined" onClick={onOpenCotizacion}>
          Crear cotización cliente
        </Button>

        <Button variant="contained" startIcon={<AddIcon />} onClick={onOpenNewVenta}>
          Nueva venta
        </Button>
      </Box>
    </Box>
  );
}
