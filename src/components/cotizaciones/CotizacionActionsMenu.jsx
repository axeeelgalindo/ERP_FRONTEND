"use client";

import { useMemo, useState } from "react";
import {
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
} from "@mui/material";

import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import VisibilityIcon from "@mui/icons-material/Visibility";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ThumbUpAltOutlinedIcon from "@mui/icons-material/ThumbUpAltOutlined";
import ThumbDownAltOutlinedIcon from "@mui/icons-material/ThumbDownAltOutlined";

import { nextEstados } from "@/components/cotizaciones/utils/utils";

export default function CotizacionActionsMenu({
  open,
  anchorEl,
  cotizacion,
  onClose,
  onUpdateEstado,
}) {
  const estado = cotizacion?.estado || "COTIZACION";
  const siguiente = nextEstados(estado)?.[0] || null;

  // ✅ guardamos el ID localmente para que no se pierda si el padre limpia "cotizacion"
  const [cotizacionIdLocked, setCotizacionIdLocked] = useState(null);

  const [openAceptada, setOpenAceptada] = useState(false);
  const [openRechazar, setOpenRechazar] = useState(false);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [inicioPlan, setInicioPlan] = useState(todayStr);
  const [finPlan, setFinPlan] = useState(todayStr);
  const [errAceptada, setErrAceptada] = useState("");

  const [motivo, setMotivo] = useState("");
  const [errRechazo, setErrRechazo] = useState("");

  const openAceptarModal = () => {
    if (!cotizacion?.id) return;

    setCotizacionIdLocked(cotizacion.id); // ✅ lock ID
    setErrAceptada("");

    onClose?.(); // puede limpiar props en el padre
    setTimeout(() => setOpenAceptada(true), 0);
  };

  const openRechazarModal = () => {
    if (!cotizacion?.id) return;

    setCotizacionIdLocked(cotizacion.id); // ✅ lock ID
    setErrRechazo("");
    setMotivo("");

    onClose?.(); // puede limpiar props en el padre
    setTimeout(() => setOpenRechazar(true), 0);
  };

  const goNext = () => {
    if (!cotizacion?.id || !siguiente) return;

    if (siguiente === "ACEPTADA") return openAceptarModal();

    // transición normal
    onClose?.();
    onUpdateEstado?.(cotizacion.id, siguiente);
  };

  const confirmAceptada = () => {
    const id = cotizacionIdLocked || cotizacion?.id;
    if (!id) return;

    if (!inicioPlan || !finPlan) {
      setErrAceptada("Debes ingresar ambas fechas.");
      return;
    }
    if (finPlan < inicioPlan) {
      setErrAceptada("La fecha fin no puede ser menor que la fecha inicio.");
      return;
    }

    setErrAceptada("");
    setOpenAceptada(false);

    onUpdateEstado?.(id, "ACEPTADA", {
      fecha_inicio_plan: inicioPlan,
      fecha_fin_plan: finPlan,
    });

    // opcional: limpiar lock
    setCotizacionIdLocked(null);
  };

  const confirmRechazar = () => {
    const id = cotizacionIdLocked || cotizacion?.id;
    if (!id) return;

    const clean = motivo.trim();

    if (clean && clean.length < 3) {
      setErrRechazo("Si ingresas motivo, que sea más descriptivo (mín. 3).");
      return;
    }
    if (clean.length > 500) {
      setErrRechazo("Máximo 500 caracteres.");
      return;
    }

    setErrRechazo("");
    setOpenRechazar(false);

    onUpdateEstado?.(id, "RECHAZADA", {
      motivo_rechazo: clean || null,
    });

    // opcional: limpiar lock
    setCotizacionIdLocked(null);
  };

  const puedeRechazar = estado === "COTIZACION";

  return (
    <>
      <Menu
        anchorEl={anchorEl}
        open={open && !openAceptada && !openRechazar}
        onClose={onClose}
        PaperProps={{ sx: { borderRadius: 2, minWidth: 280 } }}
      >
        {siguiente ? (
          <MenuItem onClick={goNext}>
            <ListItemIcon>
              <ArrowForwardIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={
                siguiente === "ACEPTADA"
                  ? "Aceptar cotización"
                  : `Avanzar a ${siguiente.replaceAll("_", " ")}`
              }
              secondary={
                siguiente === "ACEPTADA"
                  ? "Define fechas planificadas y crea el proyecto"
                  : "Cambia el estado al siguiente paso"
              }
            />
          </MenuItem>
        ) : (
          <MenuItem disabled>
            <ListItemIcon>
              <CheckCircleOutlineIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="Cotización finalizada"
              secondary={`Estado: ${estado}`}
            />
          </MenuItem>
        )}

        {puedeRechazar && (
          <MenuItem onClick={openRechazarModal}>
            <ListItemIcon>
              <ThumbDownAltOutlinedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="Rechazar cotización"
              secondary="Marca como RECHAZADA (con motivo opcional)"
            />
          </MenuItem>
        )}

        <Divider />

        <MenuItem
          onClick={() => {
            onClose?.();
          }}
        >
          <ListItemIcon>
            <VisibilityIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Ver detalle" secondary="Abrir/mostrar ítems" />
        </MenuItem>
      </Menu>

      <Dialog
        open={openAceptada}
        onClose={() => {
          setOpenAceptada(false);
          setCotizacionIdLocked(null);
        }}
        maxWidth="xs"
        fullWidth
        sx={{ zIndex: (t) => t.zIndex.modal + 20 }}
      >
        <DialogTitle>Aceptar cotización</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Fecha inicio planificada"
              type="date"
              value={inicioPlan}
              onChange={(e) => setInicioPlan(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="Fecha fin planificada"
              type="date"
              value={finPlan}
              onChange={(e) => setFinPlan(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            {errAceptada ? (
              <div style={{ color: "#d32f2f", fontSize: 13 }}>
                {errAceptada}
              </div>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setOpenAceptada(false);
              setCotizacionIdLocked(null);
            }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            startIcon={<ThumbUpAltOutlinedIcon />}
            onClick={confirmAceptada}
          >
            Aceptar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openRechazar}
        onClose={() => {
          setOpenRechazar(false);
          setCotizacionIdLocked(null);
        }}
        maxWidth="xs"
        fullWidth
        sx={{ zIndex: (t) => t.zIndex.modal + 20 }}
      >
        <DialogTitle>Rechazar cotización</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Motivo (opcional)"
              placeholder="Ej: presupuesto fuera de alcance, fechas no calzan, etc."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              multiline
              minRows={3}
              fullWidth
            />
            {errRechazo ? (
              <div style={{ color: "#d32f2f", fontSize: 13 }}>
                {errRechazo}
              </div>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setOpenRechazar(false);
              setCotizacionIdLocked(null);
            }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<ThumbDownAltOutlinedIcon />}
            onClick={confirmRechazar}
          >
            Rechazar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
