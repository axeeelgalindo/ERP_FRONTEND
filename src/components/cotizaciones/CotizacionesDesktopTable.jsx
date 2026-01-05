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
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";

import {
  estadoColor,
  fechaCL,
  formatCLP,
  nextEstados,
} from "@/components/cotizaciones/utils/utils";

import CotizacionItemsTable from "@/components/cotizaciones/CotizacionItemsTable";
import CotizacionActionsMenu from "@/components/cotizaciones/CotizacionActionsMenu";
import CotizacionPDFButton from "@/components/cotizaciones/CotizacionPDFButton";

export default function CotizacionesDesktopTable({
  cotizaciones = [],
  expandedId,
  onToggleExpanded,
  onUpdateEstado,
}) {
  // Menú acciones (3 puntitos)
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
              <TableCell>Proyecto</TableCell>
              <TableCell width={240}>Cliente</TableCell>

              {/* ✅ Estado separado */}
              <TableCell width={220}>Estado</TableCell>

              <TableCell align="right" width={160}>
                Total
              </TableCell>

              {/* ✅ PDF separado */}
              <TableCell align="center" width={120}>
                PDF
              </TableCell>

              {/* ✅ Acciones separado */}
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
                  {/* ROW */}
                  <TableRow
                    hover
                    onClick={() => onToggleExpanded?.(c.id)}
                    sx={{
                      cursor: "pointer",
                      "&:hover td": { bgcolor: "action.hover" },
                    }}
                  >
                    {/* expand */}
                    <TableCell>
                      <Tooltip title={open ? "Ocultar detalle" : "Ver detalle"}>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleExpanded?.(c.id);
                          }}
                        >
                          {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                        </IconButton>
                      </Tooltip>
                    </TableCell>

                    <TableCell>
                      <Typography fontWeight={900}>{c.numero ?? "—"}</Typography>
                    </TableCell>

                    <TableCell>{fechaCL(c.creada_en)}</TableCell>

                    <TableCell sx={{ maxWidth: 520 }}>
                      <Typography fontWeight={700}>
                        {c.proyecto?.nombre || "—"}
                      </Typography>
                      {c.descripcion ? (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            display: "-webkit-box",
                            WebkitLineClamp: 1,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {c.descripcion}
                        </Typography>
                      ) : null}
                    </TableCell>

                    <TableCell>{c.cliente?.nombre || "Sin cliente"}</TableCell>

                    {/* ✅ Estado column */}
                    <TableCell>
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                        <Chip
                          label={estado.replaceAll("_", " ")}
                          size="small"
                          color={estadoColor(estado)}
                          variant="outlined"
                          sx={{ width: "fit-content", fontWeight: 700 }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {siguiente ? (
                            <>
                              Siguiente:{" "}
                              <strong>{siguiente.replaceAll("_", " ")}</strong>
                            </>
                          ) : (
                            <>Final: <strong>PAGADA</strong></>
                          )}
                        </Typography>
                      </Box>
                    </TableCell>

                    <TableCell align="right">
                      <Typography fontWeight={900}>{formatCLP(c.total)}</Typography>
                    </TableCell>

                    {/* ✅ PDF column */}
                    <TableCell
                      align="center"
                      onClick={(e) => e.stopPropagation()}
                      sx={{ whiteSpace: "nowrap" }}
                    >
                      <CotizacionPDFButton cotizacion={c} />
                    </TableCell>

                    {/* ✅ Actions column (solo 3 puntitos) */}
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

                  {/* DETAIL */}
                  <TableRow>
                    <TableCell colSpan={9} sx={{ p: 0, borderBottom: 0 }}>
                      <Collapse in={open} timeout="auto" unmountOnExit>
                        <Box sx={{ px: 2, pb: 2 }}>
                          <Divider sx={{ my: 1.5 }} />
                          <CotizacionItemsTable items={c.items || []} />
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

      {/* Menú acciones: aquí pones lo pro (cambiar estado, etc.) */}
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
