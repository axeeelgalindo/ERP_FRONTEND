"use client";

import { Box, Typography, TextField } from "@mui/material";

export default function GeneralInfoSection({
  theme,
  descripcionVenta,
  setDescripcionVenta,
  utilidadPctObjetivo,
  setUtilidadPctObjetivo,
}) {
  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2.5,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: theme.palette.mode === "dark" ? "#fff" : "#fff",
      }}
    >
      <Typography
        sx={{
          fontSize: 12,
          fontWeight: 900,
          letterSpacing: ".08em",
          color: "text.secondary",
          textTransform: "uppercase",
          mb: 1.25,
        }}
      >
        Información General
      </Typography>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "2fr 1fr" },
          gap: 2,
        }}
      >
        <TextField
          label="Descripción de la venta"
          value={descripcionVenta}
          onChange={(e) => setDescripcionVenta(e.target.value)}
          fullWidth
          size="small"
          required
        />

        <TextField
          label="% Utilidad Objetivo"
          size="small"
          type="number"
          value={utilidadPctObjetivo}
          onChange={(e) => setUtilidadPctObjetivo(e.target.value)}
          fullWidth
          inputProps={{ step: 0.1, min: 0 }}
          helperText="Markup sobre costo con factor alpha."
        />
      </Box>
    </Box>
  );
}
