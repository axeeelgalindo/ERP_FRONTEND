"use client";

import { Box, IconButton, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import CheckIcon from "@mui/icons-material/Check";

function StepDot({ state, label, icon }) {
  // state: "done" | "active" | "pending"
  const isDone = state === "done";
  const isActive = state === "active";

  return (
    <Box sx={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: 999,
          display: "grid",
          placeItems: "center",
          transition: "all .25s",
          ...(isDone && {
            bgcolor: "primary.main",
            color: "common.white",
            boxShadow: "0 8px 18px rgba(0,97,223,.25)",
          }),
          ...(isActive && {
            bgcolor: "background.paper",
            color: "primary.main",
            border: "2px solid",
            borderColor: "primary.main",
            boxShadow: "0 10px 20px rgba(0,0,0,.06)",
            outline: "6px solid",
            outlineColor: "rgba(0,97,223,.10)",
          }),
          ...(state === "pending" && {
            bgcolor: "action.hover",
            color: "text.disabled",
            border: "1px solid",
            borderColor: "divider",
          }),
        }}
      >
        {isDone ? <CheckIcon /> : icon}
      </Box>

      <Typography
        sx={{
          mt: 1,
          fontSize: 12,
          fontWeight: isActive ? 900 : isDone ? 800 : 700,
          color: isActive ? "text.primary" : isDone ? "primary.main" : "text.disabled",
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

export default function CotizacionStepperHeader({ step, onClose }) {
  const progress = step === 1 ? 0 : step === 2 ? 50 : 100;

  const s1 = step > 1 ? "done" : step === 1 ? "active" : "pending";
  const s2 = step > 2 ? "done" : step === 2 ? "active" : "pending";
  const s3 = step === 3 ? "active" : "pending";

  return (
    <Box sx={{ px: { xs: 3, md: 5 }, pt: { xs: 3, md: 4 }, pb: 2, borderBottom: "1px solid", borderColor: "divider" }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2, mb: 3 }}>
        <Box>
          <Typography sx={{ fontSize: 24, fontWeight: 900, color: "text.primary" }}>
            Crear nueva cotización
          </Typography>
          <Typography sx={{ fontSize: 13, color: "text.secondary", mt: 0.5 }}>
            Siga los pasos para generar un documento comercial
          </Typography>
        </Box>

        <IconButton onClick={onClose} sx={{ color: "text.secondary" }}>
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Stepper */}
      <Box sx={{ position: "relative", maxWidth: 720, mx: "auto", mt: 1 }}>
        <Box
          sx={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 24,
            height: 6,
            borderRadius: 999,
            bgcolor: "action.hover",
            overflow: "hidden",
            transform: "translateY(-50%)",
          }}
        >
          <Box
            sx={{
              height: "100%",
              width: `${progress}%`,
              bgcolor: "primary.main",
              transition: "width .35s cubic-bezier(.4,0,.2,1)",
            }}
          />
        </Box>

        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
          <StepDot state={s1} label="Cliente y Oferta" icon={<PersonOutlineIcon />} />
          <StepDot state={s2} label="Términos" icon={<DescriptionOutlinedIcon />} />
          <StepDot state={s3} label="Glosas y Totales" icon={<PaymentsOutlinedIcon />} />
        </Box>
      </Box>
    </Box>
  );
}
