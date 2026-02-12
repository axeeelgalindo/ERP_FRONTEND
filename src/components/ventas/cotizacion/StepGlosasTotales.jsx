"use client";

import { Alert, Box, Button, IconButton, TextField, Typography } from "@mui/material";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import VerifiedIcon from "@mui/icons-material/Verified";

export default function StepGlosasTotales({
  glosas,
  setGlosa,
  addGlosa,
  removeGlosa,
  glosaErr,
  okCuadra,
}) {
  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 1000, letterSpacing: ".08em", textTransform: "uppercase" }}>
          Glosas del documento
        </Typography>

        <Button
          onClick={addGlosa}
          startIcon={<AddCircleIcon />}
          sx={{ fontWeight: 900, letterSpacing: ".06em" }}
        >
          Añadir línea
        </Button>
      </Box>

      <Box sx={{ display: "grid", gap: 1.5 }}>
        {glosas.map((g, idx) => (
          <Box
            key={idx}
            sx={{
              p: 2,
              borderRadius: 3,
              border: "1px solid",
              borderColor: "divider",
              bgcolor: "background.paper",
              display: "flex",
              gap: 2,
              alignItems: "flex-start",
            }}
          >
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: 10, fontWeight: 1000, color: "text.disabled", letterSpacing: ".16em", textTransform: "uppercase" }}>
                Descripción del ítem
              </Typography>
              <TextField
                variant="standard"
                value={g.descripcion}
                onChange={(e) => setGlosa(idx, { descripcion: e.target.value })}
                fullWidth
                placeholder="Ej: Servicios de consultoría estratégica"
              />
            </Box>

            <Box sx={{ width: 160 }}>
              <Typography sx={{ fontSize: 10, fontWeight: 1000, color: "text.disabled", letterSpacing: ".16em", textTransform: "uppercase" }}>
                Precio (CLP)
              </Typography>
              <TextField
                variant="standard"
                type="number"
                value={g.monto}
                onChange={(e) => setGlosa(idx, { monto: e.target.value })}
                fullWidth
                inputProps={{ min: 0, step: 1, style: { textAlign: "right", fontWeight: 800 } }}
              />
              <Typography sx={{ fontSize: 11, color: "text.secondary", mt: 0.5 }}>
                {g.manual ? "Manual" : "Auto (remanente)"}
              </Typography>
            </Box>

            <IconButton onClick={() => removeGlosa(idx)} sx={{ mt: 2 }} disabled={glosas.length === 1}>
              <DeleteOutlineIcon />
            </IconButton>
          </Box>
        ))}
      </Box>

      {glosaErr ? (
        <Alert severity="warning">{glosaErr}</Alert>
      ) : okCuadra ? (
        <Alert icon={<VerifiedIcon />} severity="success">
          Las glosas coinciden exactamente con el subtotal neto de las ventas seleccionadas.
        </Alert>
      ) : null}
    </Box>
  );
}