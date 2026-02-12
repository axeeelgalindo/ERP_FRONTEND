"use client";

import { Box, TextField, Typography } from "@mui/material";
import { formatCLP } from "@/components/ventas/utils/money";

export default function GeneralInfoSticky({
  theme,
  descripcionVenta,
  setDescripcionVenta,
  utilidadPctObjetivo,
  setUtilidadPctObjetivo,
  preview,
}) {
  const pct =
    preview?.total > 0
      ? ((preview.utilidad / preview.total) * 100).toFixed(1)
      : "0.0";

  return (
    <Box
      sx={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        // importante para que tape lo que pasa por debajo mientras scrolleas
        bgcolor:
          theme.palette.mode === "dark"
            ? "rgba(255,255,255,.92)"
            : "rgba(255,255,255,.92)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid",
        borderColor: "divider",
        px: 2.5,
        py: 2,
      }}
    >
      {/* =======================
          Información General
      ======================= */}
      <Box
        sx={{
          p: 2,
          borderRadius: 2.5,
          border: "1px solid",
          borderColor: "divider",
          bgcolor:
            theme.palette.mode === "dark" ? "#fff" : "#fff",
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
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: 1.5,
                bgcolor:
                  theme.palette.mode === "dark"
                    ? "rgba(15,23,42,.03)"
                    : "rgba(15,23,42,.03)",
              },
            }}
          />

          <TextField
            label="% UTILIDAD"
            size="small"
            type="number"
            value={utilidadPctObjetivo}
            onChange={(e) => setUtilidadPctObjetivo(e.target.value)}
            fullWidth
            inputProps={{ step: 0.1, min: 0 }}
            
             sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 1.5,
                      bgcolor:
                        theme.palette.mode === "dark"
                          ? "rgba(15,23,42,.03)"
                          : "rgba(15,23,42,.03)",
                    },
                  }}
          />
        </Box>
      </Box>

      {/* =======================
          Totales
      ======================= */}
      <Box
        sx={{
          mt: 1.5,
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 1.5,
        }}
      >
        {/* Venta */}
        <Box
          sx={{
            p: 1.25,
            borderRadius: 2,
            border: "1px solid",
            borderColor: "divider",
            bgcolor:
              theme.palette.mode === "dark"
                ? "rgba(15,23,42,.03)"
                : "rgba(15,23,42,.03)",
          }}
        >
          <Typography
            sx={{
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: ".08em",
              color: "text.secondary",
              textTransform: "uppercase",
            }}
          >
            Venta
          </Typography>
          <Typography sx={{ fontWeight: 900 }}>
            {formatCLP(preview?.total || 0)}
          </Typography>
        </Box>

        {/* Costo */}
        <Box
          sx={{
            p: 1.25,
            borderRadius: 2,
            border: "1px solid",
            borderColor: "divider",
            bgcolor:
              theme.palette.mode === "dark"
                ? "rgba(15,23,42,.03)"
                : "rgba(15,23,42,.03)",
          }}
        >
          <Typography
            sx={{
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: ".08em",
              color: "text.secondary",
              textTransform: "uppercase",
            }}
          >
            Costo
          </Typography>
          <Typography sx={{ fontWeight: 800, color: "text.secondary" }}>
            {formatCLP(preview?.costo || 0)}
          </Typography>
        </Box>

        {/* Utilidad */}
        <Box
          sx={{
            p: 1.25,
            borderRadius: 2,
            border: "1px solid",
            borderColor: "rgba(16,185,129,.25)",
            bgcolor:
              theme.palette.mode === "dark"
                ? "rgba(16,185,129,.10)"
                : "rgba(16,185,129,.10)",
          }}
        >
          <Box
            sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}
          >
            <Typography
              sx={{
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: ".08em",
                color: "success.main",
                textTransform: "uppercase",
              }}
            >
              Utilidad
            </Typography>

            <Typography
              sx={{ fontSize: 10, fontWeight: 900, color: "success.main" }}
            >
              {pct}%
            </Typography>
          </Box>

          <Typography sx={{ fontWeight: 900, color: "success.main" }}>
            {formatCLP(preview?.utilidad || 0)}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
