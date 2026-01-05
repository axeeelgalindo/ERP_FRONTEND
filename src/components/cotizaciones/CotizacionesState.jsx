"use client";

import { Box, Typography, CircularProgress, Alert } from "@mui/material";

export default function CotizacionesState({ status, loading, err, empty }) {
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

  return (
    <>
      {err && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {err}
        </Alert>
      )}

      {empty && (
        <Alert severity="info" sx={{ mb: 2 }}>
          No hay cotizaciones registradas aún.
        </Alert>
      )}
    </>
  );
}
