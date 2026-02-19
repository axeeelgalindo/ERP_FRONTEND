"use client";

import { Box, Typography, TextField, FormControlLabel, Checkbox } from "@mui/material";

export default function GeneralInfoSection({
  theme,
  descripcionVenta,
  setDescripcionVenta,
  utilidadPctObjetivo,
  setUtilidadPctObjetivo,

  // ✅ NUEVO
  isFeriado,
  setIsFeriado,
  isUrgencia,
  setIsUrgencia,
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
          label="Descripción del costeo"
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
          helperText="Objetivo (no es el % real; el real se calcula con venta/costo)."
        />
      </Box>

      {/* ✅ Tipo día por costeo */}
      <Box
        sx={{
          mt: 1.5,
          display: "flex",
          gap: 2,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <FormControlLabel
          control={
            <Checkbox
              checked={!!isFeriado}
              onChange={(e) => setIsFeriado(e.target.checked)}
            />
          }
          label="Feriado"
        />

        <FormControlLabel
          control={
            <Checkbox
              checked={!!isUrgencia}
              onChange={(e) => setIsUrgencia(e.target.checked)}
            />
          }
          label="Urgencia"
        />

        <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
          Se suman 1 vez al costeo (máximo 1 feriado + 1 urgencia).
        </Typography>
      </Box>
    </Box>
  );
}
