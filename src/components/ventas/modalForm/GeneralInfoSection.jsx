"use client";

import {
  Box,
  Typography,
  TextField,
  FormControlLabel,
  Checkbox,
  Alert,
  Button,
} from "@mui/material";

import { formatCLP } from "@/components/ventas/utils/money";

export default function GeneralInfoSection({
  theme,
  descripcionVenta,
  setDescripcionVenta,
  utilidadPctObjetivo,
  setUtilidadPctObjetivo,

  // ✅ NUEVO: descuento general
  descuentoPct,
  setDescuentoPct,

  // ✅ flags por costeo
  isFeriado,
  setIsFeriado,
  isUrgencia,
  setIsUrgencia,

  // ✅ si estás usando "form" adentro, necesitas pasarlo
  form,
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
          gridTemplateColumns: { xs: "1fr", md: "2fr 1fr 1fr" },
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
          inputProps={{ step: 0.1, min: 0, max: 99.99 }}
          helperText="Objetivo (no es el % real; el real se calcula con venta/costo)."
        />

        {/* ✅ NUEVO: Descuento general */}
        <TextField
          label="% Descuento general"
          size="small"
          type="number"
          value={descuentoPct}
          onChange={(e) => setDescuentoPct(e.target.value)}
          fullWidth
          inputProps={{ step: 0.1, min: 0, max: 99.99 }}
          helperText="Se aplica a toda la venta (post-utilidad objetivo)."
        />
      </Box>

      {/* ✅ NUEVO: Vincular a Cotización */}
      <Box sx={{ mt: 2 }}>
        <Typography
          sx={{
            fontSize: 12,
            fontWeight: 700,
            color: "text.secondary",
            mb: 0.5,
          }}
        >
          Vincular a Cotización (Opcional)
        </Typography>

        <Box
          component="select"
          value={form.ordenVentaId || ""}
          onChange={(e) => form.setOrdenVentaId(e.target.value)}
          style={{
            width: "100%",
            borderRadius: 12,
            border: "1px solid rgba(15,23,42,.12)",
            padding: "10px 12px",
            outline: "none",
            fontFamily: "inherit",
            fontSize: 13,
            background: "#fff",
          }}
        >
          <option value="">-- Sin vincular --</option>
          {form.ordenesVenta.map((ov) => (
            <option key={ov.id} value={ov.id}>
              #{ov.numero} - {ov.cliente?.nombre || "Sin cliente"} ({formatCLP(ov.total || 0)})
            </option>
          ))}
        </Box>

        {form.selectedOrdenVenta && (
          <Box sx={{ mt: 1.5, display: "grid", gap: 1 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: "primary.main" }}>
                Presupuesto Cotización: {formatCLP(form.selectedOrdenVenta.total || 0)}
              </Typography>
              
              <Button 
                size="small" 
                variant="outlined" 
                onClick={form.adjustToQuote}
                sx={{ 
                  fontSize: 10, 
                  py: 0.25, 
                  borderRadius: 1.5,
                  textTransform: "none",
                  fontWeight: 700
                }}
              >
                Ajustar para calzar
              </Button>
            </Box>

            <Box 
              sx={{ 
                p: 1.25, 
                borderRadius: 2, 
                bgcolor: form.isOverQuoteLimit ? "rgba(239,68,68,.08)" : "rgba(34,197,94,.08)",
                border: "1px solid",
                borderColor: form.isOverQuoteLimit ? "rgba(239,68,68,.2)" : "rgba(34,197,94,.2)",
                display: "flex",
                justifyContent: "space-between"
              }}
            >
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: "text.secondary" }}>
                Saldo Disponible:
              </Typography>
              <Typography sx={{ 
                fontSize: 11, 
                fontWeight: 1000, 
                color: form.isOverQuoteLimit ? "error.main" : "success.main" 
              }}>
                {formatCLP(form.remainingBudget || 0)}
              </Typography>
            </Box>

            {form.isOverQuoteLimit && (
              <Alert 
                severity="error" 
                variant="filled" 
                sx={{ 
                  py: 0.25, 
                  px: 1.25, 
                  borderRadius: 2,
                  ".MuiAlert-message": { fontSize: 10.5, fontWeight: 700, lineHeight: 1.2 },
                  ".MuiAlert-icon": { fontSize: 16 }
                }}
              >
                ¡Exceso! El costeo supera el monto cotizado. Pulsa "Ajustar para calzar".
              </Alert>
            )}
          </Box>
        )}

        {!form.selectedOrdenVenta && (
          <Typography sx={{ fontSize: 11, color: "text.disabled", mt: 0.25 }}>
            Si ya tienes una cotización aprobada, vincúlala aquí.
          </Typography>
        )}
      </Box>

      {/* ✅ Fecha HH (Período) */}
      <Box sx={{ mt: 2 }}>
        <Typography
          sx={{
            fontSize: 12,
            fontWeight: 700,
            color: "text.secondary",
            mb: 0.5,
          }}
        >
          Fecha HH (Período)
        </Typography>

        <Box sx={{ display: "grid", gap: 0.75 }}>
          <Box
            component="select"
            value={form.hhPeriodoKey}
            onChange={(e) => form.setHhPeriodoKey(e.target.value)}
            style={{
              width: "100%",
              borderRadius: 12,
              border: "1px solid rgba(15,23,42,.12)",
              padding: "10px 12px",
              outline: "none",
              fontFamily: "inherit",
              fontSize: 13,
              background: "#fff",
            }}
            disabled={form.loadingHHPeriodos}
          >
            <option value="">
              {form.loadingHHPeriodos
                ? "Cargando períodos..."
                : "Selecciona un período HH"}
            </option>

            {form.hhPeriodos.map((p) => (
              <option key={`${p.anio}-${p.mes}`} value={`${p.anio}-${p.mes}`}>
                {p.nombre || `${String(p.mes).padStart(2, "0")}/${p.anio}`}
              </option>
            ))}
          </Box>

          {!!form.hhPeriodosErr && (
            <Typography sx={{ fontSize: 11, color: "error.main" }}>
              {form.hhPeriodosErr}
            </Typography>
          )}

          <Typography sx={{ fontSize: 11, color: "text.disabled" }}>
            Este período se usará para validar los HH del costeo.
          </Typography>
        </Box>
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