"use client";

import { Box, Button, MenuItem, TextField, Typography } from "@mui/material";
import PersonAddAltIcon from "@mui/icons-material/PersonAddAlt";

export default function StepClienteOferta({
  clientes,
  clienteId,
  setClienteId,
  asunto,
  setAsunto,
  vigenciaDias,
  setVigenciaDias,
  ventasDisponibles,
  ventaIds,
  setVentaIds,
  preselectedVentaIds,
}) {
  return (
    <Box sx={{ display: "grid", gap: 3 }}>
      {/* Cliente */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 900, color: "text.primary" }}>Cliente</Typography>
        <Button
          size="small"
          startIcon={<PersonAddAltIcon />}
          sx={{ fontWeight: 900, letterSpacing: ".06em" }}
          disabled
        >
          Crear nuevo cliente
        </Button>
      </Box>

      <TextField
        select
        size="small"
        value={clienteId}
        onChange={(e) => setClienteId(e.target.value)}
        fullWidth
        placeholder="Seleccionar un cliente de la lista..."
      >
        <MenuItem value="">Seleccionar un cliente de la lista...</MenuItem>
        {clientes.map((c) => (
          <MenuItem key={c.id} value={c.id}>
            {c.nombre || c.razonSocial || c.id}
          </MenuItem>
        ))}
      </TextField>

      {/* Asunto */}
      <Box>
        <Typography sx={{ fontSize: 14, fontWeight: 900, mb: 1 }}>Asunto de la cotización</Typography>
        <TextField
          size="small"
          fullWidth
          placeholder="Ej: Renovación de servicios TI 2024"
          value={asunto}
          onChange={(e) => setAsunto(e.target.value)}
        />
      </Box>

      {/* Condiciones comerciales */}
      <Box
        sx={{
          p: 3,
          borderRadius: 3,
          border: "1px solid",
          borderColor: "rgba(0,97,223,.18)",
          bgcolor: "rgba(0,97,223,.06)",
        }}
      >
        <Typography sx={{ fontSize: 12, fontWeight: 1000, color: "primary.main", letterSpacing: ".14em", textTransform: "uppercase", mb: 2 }}>
          Condiciones comerciales
        </Typography>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
          <Box>
            <Typography sx={{ fontSize: 11, fontWeight: 1000, color: "text.secondary", letterSpacing: ".12em", textTransform: "uppercase", mb: 1 }}>
              Vigencia (días)
            </Typography>
            <TextField
              size="small"
              type="number"
              value={vigenciaDias}
              onChange={(e) => setVigenciaDias(e.target.value)}
              fullWidth
              inputProps={{ min: 1, max: 365, step: 1 }}
              helperText="Validez estándar: 15-30 días"
            />
          </Box>

          <Box>
            <Typography sx={{ fontSize: 11, fontWeight: 1000, color: "text.secondary", letterSpacing: ".12em", textTransform: "uppercase", mb: 1 }}>
              Venta relacionada
            </Typography>

            <TextField
              select
              size="small"
              fullWidth
              value={ventaIds}
              onChange={(e) => {
                const v = e.target.value;
                setVentaIds(Array.isArray(v) ? v : [v]);
              }}
              SelectProps={{ multiple: true }}
              helperText={
                preselectedVentaIds?.length
                  ? "Preseleccionada desde Costeos"
                  : "Define el subtotal base"
              }
            >
              {ventasDisponibles.map((v) => (
                <MenuItem key={v.id} value={v.id}>
                  Venta #{v.numero ?? "—"}
                </MenuItem>
              ))}
            </TextField>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}