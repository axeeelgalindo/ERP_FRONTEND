"use client";

import { Box, Button, Typography } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";

export default function CotizacionesHeader({ loading, onRefresh }) {
  return (
    <Box
      sx={{
        mb: 3,
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
        justifyContent: "space-between",
        gap: 1,
      }}
    >
      <Box>
        <Typography variant="h4" fontWeight={800}>
          Cotizaciones
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Gestiona estados, revisa detalle y exporta a PDF.
        </Typography>
      </Box>

      <Button
        variant="outlined"
        startIcon={<RefreshIcon />}
        onClick={onRefresh}
        disabled={loading}
        sx={{ alignSelf: { xs: "flex-start", md: "center" } }}
      >
        {loading ? "Actualizando..." : "Actualizar"}
      </Button>
    </Box>
  );
}
