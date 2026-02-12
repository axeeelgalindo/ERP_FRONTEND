"use client";

import { useMemo } from "react";
import {
  Alert,
  Box,
  Button,
  IconButton,
  TextField,
  Typography,
  InputAdornment,
} from "@mui/material";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import VerifiedIcon from "@mui/icons-material/Verified";

import { formatCLP } from "@/components/ventas/utils/money";

const round0 = (n) => Math.round(Number(n || 0));

function formatCLPNumberOnly(n) {
  // "174326" -> "174.326"
  if (n == null || Number.isNaN(Number(n))) return "";
  return Number(n).toLocaleString("es-CL", { maximumFractionDigits: 0 });
}

function onlyDigits(str) {
  return String(str || "").replace(/[^\d]/g, "");
}

export default function StepGlosasTotales({
  glosas,
  setGlosa,
  addGlosa,
  removeGlosa,
  glosaErr,
  okCuadra,
  subtotalNeto, // ✅ NUEVO: necesario para validar máximo
}) {
  // suma manual total (según flag manual)
  const manualSum = useMemo(
    () => glosas.reduce((acc, g) => acc + (g.manual ? round0(g.monto) : 0), 0),
    [glosas]
  );

  // calcula cuánto máximo puede tener ESTA glosa, para no pasarse del subtotal
  const maxForIdx = (idx) => {
    const t = round0(subtotalNeto);
    const othersManual = glosas.reduce((acc, g, i) => {
      if (i === idx) return acc;
      return acc + (g.manual ? round0(g.monto) : 0);
    }, 0);

    const max = t - othersManual;
    return max < 0 ? 0 : max;
  };

  const handleMontoChange = (idx) => (e) => {
    const raw = e.target.value;

    // permitir "vacío" -> vuelve a auto (remanente)
    const digits = onlyDigits(raw);
    if (digits === "") {
      setGlosa(idx, { monto: "" }); // parent lo tratará como no-manual
      return;
    }

    let value = parseInt(digits, 10);
    if (!Number.isFinite(value)) value = 0;

    // ❌ no negativos
    if (value < 0) value = 0;

    // ✅ clamp al máximo permitido para esta glosa
    const max = maxForIdx(idx);
    if (value > max) value = max;

    setGlosa(idx, { monto: value });
  };

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        <Typography
          sx={{
            fontSize: 13,
            fontWeight: 1000,
            letterSpacing: ".08em",
            textTransform: "uppercase",
          }}
        >
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
        {glosas.map((g, idx) => {
          const max = maxForIdx(idx);
          const showValue = g.manual ? formatCLPNumberOnly(g.monto) : formatCLPNumberOnly(g.monto);

          return (
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
                <Typography
                  sx={{
                    fontSize: 10,
                    fontWeight: 1000,
                    color: "text.disabled",
                    letterSpacing: ".16em",
                    textTransform: "uppercase",
                  }}
                >
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

              <Box sx={{ width: 190 }}>
                <Typography
                  sx={{
                    fontSize: 10,
                    fontWeight: 1000,
                    color: "text.disabled",
                    letterSpacing: ".16em",
                    textTransform: "uppercase",
                  }}
                >
                  Precio (CLP)
                </Typography>

                <TextField
                  variant="standard"
                  type="text"
                  value={showValue}
                  onChange={handleMontoChange(idx)}
                  fullWidth
                  inputProps={{
                    inputMode: "numeric",
                    style: { textAlign: "right", fontWeight: 800 },
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start" sx={{ mr: 0.5 }}>
                        $
                      </InputAdornment>
                    ),
                  }}
                  helperText={
                    g.manual
                      ? `Manual (máx ${formatCLP(max)})`
                      : "Auto (remanente)"
                  }
                />

                <Typography sx={{ fontSize: 11, color: "text.secondary", mt: 0.5 }}>
                  {g.manual ? "Manual" : "Auto (remanente)"}
                </Typography>
              </Box>

              <IconButton
                onClick={() => removeGlosa(idx)}
                sx={{ mt: 2 }}
                disabled={glosas.length === 1}
              >
                <DeleteOutlineIcon />
              </IconButton>
            </Box>
          );
        })}
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
