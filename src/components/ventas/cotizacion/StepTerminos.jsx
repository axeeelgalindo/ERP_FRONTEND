"use client";

import { Box, TextField, Typography } from "@mui/material";
import GavelIcon from "@mui/icons-material/Gavel";
import CreditCardIcon from "@mui/icons-material/CreditCard";

export default function StepTerminos({ terminos, setTerminos, acuerdoPago, setAcuerdoPago }) {
  return (
    <Box sx={{ display: "grid", gap: 2.5 }}>
      <Box sx={{ p: 3, borderRadius: 3, border: "1px solid", borderColor: "divider", bgcolor: "action.hover" }}>
        <Typography sx={{ display: "flex", alignItems: "center", gap: 1, fontSize: 14, fontWeight: 900, color: "text.primary", mb: 1.5 }}>
          <GavelIcon sx={{ color: "text.secondary" }} /> Términos y condiciones
        </Typography>
        <TextField
          fullWidth
          multiline
          minRows={4}
          value={terminos}
          onChange={(e) => setTerminos(e.target.value)}
          placeholder="Detalle las cláusulas legales relevantes..."
        />
      </Box>

      <Box sx={{ p: 3, borderRadius: 3, border: "1px solid", borderColor: "divider", bgcolor: "action.hover" }}>
        <Typography sx={{ display: "flex", alignItems: "center", gap: 1, fontSize: 14, fontWeight: 900, color: "text.primary", mb: 1.5 }}>
          <CreditCardIcon sx={{ color: "text.secondary" }} /> Acuerdo de pago
        </Typography>
        <TextField
          fullWidth
          multiline
          minRows={4}
          value={acuerdoPago}
          onChange={(e) => setAcuerdoPago(e.target.value)}
          placeholder="Especifique plazos y métodos de transferencia..."
        />
      </Box>
    </Box>
  );
}
