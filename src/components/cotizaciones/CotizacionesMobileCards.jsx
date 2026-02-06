"use client";

import { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Chip,
  Collapse,
  Divider,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";

import MoreVertIcon from "@mui/icons-material/MoreVert";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";

import {
  estadoColor,
  fechaCL,
  formatCLP,
  nextEstados,
} from "@/components/cotizaciones/utils/utils";

import CotizacionActionsMenu from "@/components/cotizaciones/CotizacionActionsMenu";
import CotizacionPDFButton from "@/components/cotizaciones/CotizacionPDFButton";
import CotizacionGlosasTable from "@/components/cotizaciones/CotizacionGlosasTable";

export default function CotizacionesMobileCards({
  cotizaciones = [],
  expandedId,
  onToggleExpanded,
  onUpdateEstado,
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [menuCot, setMenuCot] = useState(null);

  const openMenu = Boolean(anchorEl);
  const canGoTo = nextEstados(menuCot?.estado || "COTIZACION");

  const openActions = (e, cot) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
    setMenuCot(cot);
  };

  const closeActions = () => {
    setAnchorEl(null);
    setMenuCot(null);
  };

  const handleMenuAction = (action) => {
    if (!menuCot) return;
    if (action.startsWith("to:")) {
      const estado = action.replace("to:", "");
      onUpdateEstado?.(menuCot.id, estado);
    }
  };

  return (
    <>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        {cotizaciones.map((c) => {
          const open = expandedId === c.id;
          const estado = c.estado || "COTIZACION";

          return (
            <Card
              key={c.id}
              variant="outlined"
              sx={{ borderRadius: 2, cursor: "pointer" }}
              onClick={() => onToggleExpanded?.(c.id)}
            >
              <CardContent>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 1,
                  }}
                >
                  <Box>
                    <Typography fontWeight={900}>
                      Cotización #{c.numero ?? "—"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Fecha: {fechaCL(c.creada_en)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Proyecto: <strong>{c.proyecto?.nombre || "—"}</strong>
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Cliente:{" "}
                      <strong>{c.cliente?.nombre || "Sin cliente"}</strong>
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: 0.75,
                    }}
                  >
                    <Chip
                      label={estado.replaceAll("_", " ")}
                      size="small"
                      color={estadoColor(estado)}
                      variant="outlined"
                    />
                    <Typography fontWeight={900}>
                      {formatCLP(c.total)}
                    </Typography>

                    <Box onClick={(e) => e.stopPropagation()}>
                      <Tooltip title="Acciones">
                        <IconButton
                          size="small"
                          onClick={(e) => openActions(e, c)}
                        >
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>

                      <Tooltip title="Exportar PDF">
                        <span>
                          <CotizacionPDFButton cotizacion={c} />
                        </span>
                      </Tooltip>

                      <Tooltip title={open ? "Ocultar detalle" : "Ver detalle"}>
                        <IconButton
                          size="small"
                          onClick={() => onToggleExpanded?.(c.id)}
                        >
                          {open ? (
                            <KeyboardArrowUpIcon fontSize="small" />
                          ) : (
                            <KeyboardArrowDownIcon fontSize="small" />
                          )}
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                </Box>

                <Collapse in={open} timeout="auto" unmountOnExit>
                  <Divider sx={{ my: 1.5 }} />
                  {c.descripcion && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 1 }}
                    >
                      {c.descripcion}
                    </Typography>
                  )}

                  <CotizacionGlosasTable cotizacion={c} />
                </Collapse>
              </CardContent>
            </Card>
          );
        })}
      </Box>

      <CotizacionActionsMenu
        anchorEl={anchorEl}
        open={openMenu}
        cotizacion={menuCot}
        onClose={closeActions}
        onUpdateEstado={onUpdateEstado}
      />
    </>
  );
}
