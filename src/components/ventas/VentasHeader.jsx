"use client";

import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import AddIcon from "@mui/icons-material/Add";
import DescriptionIcon from "@mui/icons-material/Description";

export default function VentasHeader({
  empresaLabel,
  loadingVentas,
  onRefresh,
  onOpenNewVenta,
  onOpenCotizacion,
}) {
  return (
    <Box sx={{ mb: 2.5 }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        alignItems={{ xs: "flex-start", md: "center" }}
        justifyContent="space-between"
        spacing={1.5}
      >
        <Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h4" fontWeight={900} letterSpacing={-0.5}>
              Costeos
            </Typography>

            {/*{empresaLabel ? (
              <Chip
                size="small"
                label={empresaLabel}
                variant="outlined"
                sx={{ borderRadius: 999 }}
              />
            ) : null}*/}
          </Stack>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Gestión de costeos, ítems y generación de cotizaciones.
          </Typography>
        </Box>

        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          flexWrap="wrap"
          sx={{ justifyContent: { xs: "flex-start", md: "flex-end" } }}
        >
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={onRefresh}
            disabled={loadingVentas}
            sx={{ borderRadius: 2, textTransform: "none", fontWeight: 800 }}
          >
            {loadingVentas ? "Actualizando..." : "Actualizar"}
          </Button>

          <Button
            variant="outlined"
            startIcon={<DescriptionIcon />}
            onClick={onOpenCotizacion}
            sx={{ borderRadius: 2, textTransform: "none", fontWeight: 800 }}
          >
            Cotización cliente
          </Button>

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={onOpenNewVenta}
            sx={{ borderRadius: 2, textTransform: "none", fontWeight: 900 }}
          >
            Nuevo costeo
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
