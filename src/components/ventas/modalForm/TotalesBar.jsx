
"use client";

import { Box, Typography } from "@mui/material";
import { formatCLP } from "@/components/ventas/utils/money";

export default function TotalesBar({ theme, preview }) {
  return (
    <Box
      sx={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        backdropFilter: "blur(8px)",
        bgcolor:
          theme.palette.mode === "dark"
            ? "rgba(2,6,23,.55)"
            : "rgba(255,255,255,.85)",
        borderTop: "1px solid",
        borderBottom: "1px solid",
        borderColor: "divider",
        px: 2.5,
        py: 1.5,
      }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 1.5,
        }}
      >
        <Box
          sx={{
            p: 1.25,
            borderRadius: 2,
            border: "1px solid",
            borderColor: "divider",
            bgcolor:
              theme.palette.mode === "dark"
                ? "rgba(148,163,184,.08)"
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
            {formatCLP(preview.total)}
          </Typography>
        </Box>

        <Box
          sx={{
            p: 1.25,
            borderRadius: 2,
            border: "1px solid",
            borderColor: "divider",
            bgcolor:
              theme.palette.mode === "dark"
                ? "rgba(148,163,184,.08)"
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
            {formatCLP(preview.costo)}
          </Typography>
        </Box>

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
          <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
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
            <Typography sx={{ fontSize: 10, fontWeight: 900, color: "success.main" }}>
              {preview.total > 0
                ? `${((preview.utilidad / preview.total) * 100).toFixed(1)}%`
                : "0%"}
            </Typography>
          </Box>
          <Typography sx={{ fontWeight: 900, color: "success.main" }}>
            {formatCLP(preview.utilidad)}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
