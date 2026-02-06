"use client";

import { Fragment, useMemo, useState } from "react";
import {
  Box,
  Chip,
  Collapse,
  Divider,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Tooltip,
} from "@mui/material";

import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import MoreVertIcon from "@mui/icons-material/MoreVert";

import {
  estadoColor,
  fechaCL,
  formatCLP,
  nextEstados,
} from "@/components/cotizaciones/utils/utils";

import CotizacionActionsMenu from "@/components/cotizaciones/CotizacionActionsMenu";
import CotizacionPDFButton from "@/components/cotizaciones/CotizacionPDFButton";
import CotizacionGlosasTable from "@/components/cotizaciones/CotizacionGlosasTable";

export default function CotizacionesDesktopTable({
  cotizaciones = [],
  expandedId,
  onToggleExpanded,
  onUpdateEstado,
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [menuCot, setMenuCot] = useState(null);
  const openMenu = Boolean(anchorEl);

  const handleOpenMenu = (e, cot) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
    setMenuCot(cot);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
    setMenuCot(null);
  };

  const rows = useMemo(() => cotizaciones ?? [], [cotizaciones]);

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell width={52} />
              <TableCell width={80}>#</TableCell>
              <TableCell width={130}>Fecha</TableCell>

              {/* ✅ ELIMINADO: Proyecto */}
              <TableCell width={240}>Cliente</TableCell>

              <TableCell width={220}>Estado</TableCell>

              <TableCell align="right" width={160}>
                Subtotal
              </TableCell>
              <TableCell align="right" width={160}>
                IVA
              </TableCell>
              <TableCell align="right" width={160}>
                Total
              </TableCell>

              <TableCell align="center" width={120}>
                PDF
              </TableCell>

              <TableCell align="center" width={90}>
                Acciones
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {rows.map((c) => {
              const open = expandedId === c.id;
              const estado = c.estado || "COTIZACION";
              const opciones = nextEstados(estado);
              const siguiente = opciones?.[0] || null;

              return (
                <Fragment key={c.id}>
                  <TableRow
                    hover
                    onClick={() => onToggleExpanded?.(c.id)}
                    sx={{
                      cursor: "pointer",
                      "&:hover td": { bgcolor: "action.hover" },
                    }}
                  >
                    <TableCell>
                      <Tooltip title={open ? "Ocultar detalle" : "Ver detalle"}>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleExpanded?.(c.id);
                          }}
                        >
                          {open ? (
                            <KeyboardArrowUpIcon />
                          ) : (
                            <KeyboardArrowDownIcon />
                          )}
                        </IconButton>
                      </Tooltip>
                    </TableCell>

                    <TableCell>
                      <Typography fontWeight={900}>
                        {c.numero ?? "—"}
                      </Typography>
                    </TableCell>

                    <TableCell>{fechaCL(c.creada_en)}</TableCell>

                    {/* ✅ Cliente (queda aquí) */}
                    <TableCell>{c.cliente?.nombre || "Sin cliente"}</TableCell>

                    <TableCell>
                      <Box
                        sx={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 0.75,
                        }}
                      >
                        <Chip
                          label={estado.replaceAll("_", " ")}
                          size="small"
                          color={estadoColor(estado)}
                          variant="outlined"
                          sx={{ width: "fit-content", fontWeight: 700 }}
                        />
                        {!["PAGADA", "RECHAZADA"].includes(estado) &&
                        siguiente ? (
                          <Typography variant="caption" color="text.secondary">
                            Siguiente:{" "}
                            <strong>{siguiente.replaceAll("_", " ")}</strong>
                          </Typography>
                        ) : null}
                      </Box>
                    </TableCell>

                    <TableCell align="right">
                      <Typography fontWeight={900}>
                        {formatCLP(c.subtotal)}
                      </Typography>
                    </TableCell>

                    <TableCell align="right">
                      <Typography fontWeight={900}>
                        {formatCLP(c.iva)}
                      </Typography>
                    </TableCell>

                    <TableCell align="right">
                      <Typography fontWeight={900}>
                        {formatCLP(c.total)}
                      </Typography>
                    </TableCell>

                    <TableCell
                      align="center"
                      onClick={(e) => e.stopPropagation()}
                      sx={{ whiteSpace: "nowrap" }}
                    >
                      <CotizacionPDFButton cotizacion={c} />
                    </TableCell>

                    <TableCell
                      align="center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Tooltip title="Acciones">
                        <IconButton
                          size="small"
                          onClick={(e) => handleOpenMenu(e, c)}
                        >
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>

                  {/* ✅ DETAIL: colSpan baja a 10 */}
                  <TableRow>
                    <TableCell colSpan={10} sx={{ p: 0, borderBottom: 0 }}>
                      <Collapse in={open} timeout="auto" unmountOnExit>
                        <Box sx={{ px: 2, pb: 2 }}>
                          <Divider sx={{ my: 1.5 }} />
                          <CotizacionGlosasTable cotizacion={c} />
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <CotizacionActionsMenu
        open={openMenu}
        anchorEl={anchorEl}
        cotizacion={menuCot}
        onClose={handleCloseMenu}
        onUpdateEstado={onUpdateEstado}
      />
    </Paper>
  );
}
