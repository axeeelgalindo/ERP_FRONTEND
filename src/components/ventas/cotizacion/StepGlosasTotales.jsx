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
  if (n == null || Number.isNaN(Number(n))) return "";
  return Number(n).toLocaleString("es-CL", { maximumFractionDigits: 0 });
}

function onlyDigits(str) {
  return String(str || "").replace(/[^\d]/g, "");
}

function clampPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(99.99, n));
}

export default function StepGlosasTotales({
  glosas,
  setGlosa,
  addGlosa,
  removeGlosa,
  glosaErr,
  okCuadra,
  subtotalNeto, // subtotal base BRUTO

  // ✅ NUEVO: flags desde el padre
  hasGeneralDiscount = false,
  conflict = false,
  conflictMsg = "",
}) {
  const manualSum = useMemo(
    () => glosas.reduce((acc, g) => acc + (g.manual ? round0(g.monto) : 0), 0),
    [glosas]
  );

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
    const digits = onlyDigits(raw);

    if (digits === "") {
      setGlosa(idx, { monto: "" });
      return;
    }

    let value = parseInt(digits, 10);
    if (!Number.isFinite(value)) value = 0;
    if (value < 0) value = 0;

    const max = maxForIdx(idx);
    if (value > max) value = max;

    setGlosa(idx, { monto: value });
  };

  const handleDescPctChange = (idx) => (e) => {
    const raw = String(e.target.value ?? "");
    if (raw.trim() === "") {
      setGlosa(idx, { descuento_pct: 0 });
      return;
    }
    let n = Number(raw);
    if (!Number.isFinite(n)) n = 0;
    n = clampPct(n);
    setGlosa(idx, { descuento_pct: n });
  };

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      {/* ✅ alerta de conflicto */}
      {conflict ? (
        <Alert severity="error">
          {conflictMsg || "No puedes usar descuento general y por glosas a la vez."}
        </Alert>
      ) : null}

      {hasGeneralDiscount ? (
        <Alert severity="info">
          Tienes <b>descuento general</b>. Los descuentos por glosa están deshabilitados.
        </Alert>
      ) : null}

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

          const bruto = round0(g.monto || 0);
          const descPct = clampPct(g.descuento_pct || 0);
          const descMonto = round0(bruto * (descPct / 100));
          const neto = round0(bruto - descMonto);

          const showValue = formatCLPNumberOnly(g.monto);

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
                flexWrap: "wrap",
              }}
            >
              <Box sx={{ flex: 1, minWidth: 260 }}>
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

              <Box sx={{ width: 190, minWidth: 190 }}>
                <Typography
                  sx={{
                    fontSize: 10,
                    fontWeight: 1000,
                    color: "text.disabled",
                    letterSpacing: ".16em",
                    textTransform: "uppercase",
                  }}
                >
                  Bruto (CLP)
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
                    g.manual ? `Manual (máx ${formatCLP(max)})` : "Auto (remanente)"
                  }
                />
              </Box>

              <Box sx={{ width: 140, minWidth: 140 }}>
                <Typography
                  sx={{
                    fontSize: 10,
                    fontWeight: 1000,
                    color: "text.disabled",
                    letterSpacing: ".16em",
                    textTransform: "uppercase",
                  }}
                >
                  % Descuento
                </Typography>

                <TextField
                  variant="standard"
                  type="number"
                  value={descPct}
                  onChange={handleDescPctChange(idx)}
                  fullWidth
                  disabled={hasGeneralDiscount} // ✅ bloqueo
                  inputProps={{
                    min: 0,
                    max: 99.99,
                    step: 0.01,
                    style: { textAlign: "right", fontWeight: 800 },
                  }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end" sx={{ ml: 0.5 }}>
                        %
                      </InputAdornment>
                    ),
                  }}
                  helperText={
                    hasGeneralDiscount
                      ? "Deshabilitado por descuento general"
                      : descPct > 0
                      ? "Con descuento"
                      : "Sin descuento"
                  }
                />
              </Box>

              <Box sx={{ width: 220, minWidth: 220 }}>
                <Typography
                  sx={{
                    fontSize: 10,
                    fontWeight: 1000,
                    color: "text.disabled",
                    letterSpacing: ".16em",
                    textTransform: "uppercase",
                  }}
                >
                  Neto (info)
                </Typography>

                <Typography sx={{ fontSize: 13, fontWeight: 900, mt: 0.8 }}>
                  {formatCLP(neto)}{" "}
                  <span style={{ fontWeight: 700, color: "rgba(0,0,0,.55)" }}>
                    (Desc: {formatCLP(descMonto)} / {descPct}%)
                  </span>
                </Typography>

                <Typography sx={{ fontSize: 11, color: "text.secondary", mt: 0.5 }}>
                  Neto = Bruto - Descuento
                </Typography>
              </Box>

              <IconButton
                onClick={() => removeGlosa(idx)}
                sx={{ mt: 1.4, ml: "auto" }}
                disabled={glosas.length === 1}
              >
                <DeleteOutlineIcon />
              </IconButton>
            </Box>
          );
        })}
      </Box>

      <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
        Manual: {formatCLP(manualSum)} / Subtotal bruto ventas: {formatCLP(subtotalNeto)}
      </Typography>

      {glosaErr ? (
        <Alert severity="warning">{glosaErr}</Alert>
      ) : okCuadra ? (
        <Alert icon={<VerifiedIcon />} severity="success">
          Las glosas coinciden exactamente con el subtotal <b>BRUTO</b> de las ventas seleccionadas.
        </Alert>
      ) : null}
    </Box>
  );
}