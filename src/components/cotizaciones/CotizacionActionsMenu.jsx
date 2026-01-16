"use client";

import {
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Divider,
} from "@mui/material";

import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import VisibilityIcon from "@mui/icons-material/Visibility";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

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

  const goNext = () => {
    if (!cotizacion?.id || !siguiente) return;
    onClose?.();
    onUpdateEstado?.(cotizacion.id, siguiente);
  };

  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { borderRadius: 2, minWidth: 260 } }}
    >
      {siguiente ? (
        <MenuItem onClick={goNext}>
          <ListItemIcon>
            <ArrowForwardIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary={`Avanzar a ${siguiente.replaceAll("_", " ")}`}
            secondary="Cambia el estado al siguiente paso"
          />
        </MenuItem>
      ) : (
        <MenuItem disabled>
          <ListItemIcon>
            <CheckCircleOutlineIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Cotización finalizada" secondary="Ya está PAGADA" />
        </MenuItem>
      )}

      <Divider />

      <MenuItem
        onClick={() => {
          // ejemplo (si quieres agregar un “ver detalle” sin expand)
          onClose?.();
        }}
      >
        <ListItemIcon>
          <VisibilityIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="Ver detalle" secondary="Abrir/mostrar ítems" />
      </MenuItem>
    </Menu>
  );
}
