"use client";

import { Alert, Box, CircularProgress, Typography } from "@mui/material";
import VentaCard from "@/components/ventas/VentaCard";

export default function VentasList({ ventas, loading, error }) {
  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  if (loading) {
    return (
      <Box sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1 }}>
        <CircularProgress size={20} />
        <Typography variant="body2" color="text.secondary">
          Cargando ventas...
        </Typography>
      </Box>
    );
  }

  if (!ventas?.length) {
    return (
      <Alert severity="info">
        No hay ventas registradas aún. Crea una nueva venta para comenzar.
      </Alert>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {ventas.map((venta) => (
        <VentaCard key={venta.id} venta={venta} />
      ))}
    </Box>
  );
}
