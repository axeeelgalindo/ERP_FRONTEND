"use client";

import { Box, Button, Typography } from "@mui/material";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

export default function CotizacionFooterTotals({
  step,
  onPrev,
  onNext,
  onCreate,
  saving,
  subtotalNetoLabel,
  ivaLabel,
  totalLabel,
}) {
  return (
    <Box
      sx={{
        borderTop: "1px solid",
        borderColor: "divider",
        px: { xs: 2.5, md: 4 },
        py: 2.5,
        bgcolor: "rgba(255,255,255,.65)",
        backdropFilter: "blur(10px)",
        position: "sticky",
        bottom: 0,
        zIndex: 2,
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          gap: 2,
          alignItems: { xs: "stretch", md: "center" },
          justifyContent: "space-between",
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr 1fr 1fr", sm: "repeat(3, 160px)" },
            gap: 1.5,
            width: { xs: "100%", md: "auto" },
          }}
        >
          <Box sx={{ p: 1.5, borderRadius: 2, border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
            <Typography sx={{ fontSize: 10, fontWeight: 900, color: "text.disabled", letterSpacing: ".1em", textTransform: "uppercase" }}>
              Subtotal Neto
            </Typography>
            <Typography sx={{ fontSize: 18, fontWeight: 900 }}>{subtotalNetoLabel}</Typography>
          </Box>

          <Box sx={{ p: 1.5, borderRadius: 2, border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
            <Typography sx={{ fontSize: 10, fontWeight: 900, color: "text.disabled", letterSpacing: ".1em", textTransform: "uppercase" }}>
              IVA (19%)
            </Typography>
            <Typography sx={{ fontSize: 18, fontWeight: 900 }}>{ivaLabel}</Typography>
          </Box>

          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              border: "2px solid",
              borderColor: "primary.main",
              bgcolor: "rgba(0,97,223,.06)",
            }}
          >
            <Typography sx={{ fontSize: 10, fontWeight: 900, color: "primary.main", letterSpacing: ".1em", textTransform: "uppercase" }}>
              Total Final
            </Typography>
            <Typography sx={{ fontSize: 20, fontWeight: 1000, color: "primary.main" }}>{totalLabel}</Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", gap: 1.5, justifyContent: { xs: "flex-end", md: "flex-end" }, alignItems: "center" }}>
          <Button
            variant="outlined"
            sx={{ minWidth: 46, height: 46, borderRadius: 2 }}
            title="Vista previa PDF"
            disabled
          >
            <PictureAsPdfIcon />
          </Button>

          {step > 1 ? (
            <Button
              onClick={onPrev}
              disabled={saving}
              startIcon={<ArrowBackIcon />}
              sx={{ height: 46, borderRadius: 2, fontWeight: 900, letterSpacing: ".08em" }}
              color="inherit"
            >
              Atrás
            </Button>
          ) : null}

          {step < 3 ? (
            <Button
              variant="contained"
              onClick={onNext}
              disabled={saving}
              endIcon={<ArrowForwardIcon />}
              sx={{
                height: 46,
                borderRadius: 2,
                px: 3,
                fontWeight: 900,
                letterSpacing: ".08em",
                boxShadow: "0 12px 26px rgba(0,97,223,.25)",
              }}
            >
              Siguiente
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={onCreate}
              disabled={saving}
              sx={{
                height: 46,
                borderRadius: 2,
                px: 3,
                fontWeight: 900,
                letterSpacing: ".08em",
                boxShadow: "0 12px 26px rgba(0,97,223,.25)",
              }}
            >
              {saving ? "Creando..." : "Finalizar cotización"}
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );
}