"use client";

import { useMemo, useState, Fragment } from "react";
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  IconButton,
  Collapse,
  Divider,
  Menu,
  MenuItem,
  TablePagination,
  useMediaQuery,
  Card,
  CardContent,
  Tooltip,
  Button,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import DescriptionIcon from "@mui/icons-material/Description";
import WorkOutlineIcon from "@mui/icons-material/WorkOutline";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";

import { formatCLP } from "@/components/ventas/utils/money";

// Helpers
function calcTotalVenta(venta) {
  const detalles = venta?.detalles || [];
  return detalles.reduce((s, d) => s + (Number(d.total ?? d.ventaTotal) || 0), 0);
}

function getOvLabel(venta) {
  if (venta?.ordenVenta) return `#${venta.ordenVenta.numero}`;
  if (venta?.ordenVentaId) return String(venta.ordenVentaId);
  return "Sin cotización/OV";
}

function getFechaLabel(venta) {
  return venta?.fecha ? new Date(venta.fecha).toLocaleDateString("es-CL") : "-";
}

function buildOrigen(det) {
  if (det?.empleado) {
    return `Empleado: ${det.empleado.usuario?.nombre || det.empleado.id}`;
  }
  if (det?.compras) {
    const prod = det.compras.producto?.nombre;
    const item = det.compras.item;
    return `Compra: ${prod || item || det.compras.id}`;
  }
  return "-";
}

function DetallesVentaTable({ detalles }) {
  return (
    <Box sx={{ p: { xs: 1.5, md: 2 } }}>
      <Box
        sx={{
          mb: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          flexWrap: "wrap",
        }}
      >
        <Typography variant="subtitle2" color="text.secondary">
          Detalle de ítems
        </Typography>

        <Chip
          size="small"
          variant="outlined"
          label={`${(detalles || []).length} ítem(s)`}
          sx={{ borderRadius: 999 }}
        />
      </Box>

      <Table size="small" sx={{ minWidth: 900 }}>
        <TableHead>
          <TableRow>
            <TableCell>Ítem</TableCell>
            <TableCell>Tipo</TableCell>
            <TableCell>Unidad</TableCell>
            <TableCell align="right">Cant.</TableCell>
            <TableCell>Origen</TableCell>
            <TableCell align="right">Costo</TableCell>
            <TableCell align="right">Venta</TableCell>
            <TableCell align="right">% Util.</TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {(detalles || []).map((det) => {
            const tipoItemNombre = det.tipoItem?.nombre || "-";
            const unidadNombre = det.tipoItem?.unidadItem?.nombre || "-";
            const origen = buildOrigen(det);

            const isHH = !!det?.empleado;
            const badgeIcon = isHH ? (
              <WorkOutlineIcon fontSize="small" />
            ) : (
              <Inventory2OutlinedIcon fontSize="small" />
            );
            const badgeLabel = isHH ? "HH" : "Compra";

            return (
              <TableRow key={det.id} hover>
                <TableCell sx={{ maxWidth: 420 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Chip
                      icon={badgeIcon}
                      label={badgeLabel}
                      size="small"
                      variant="outlined"
                      sx={{ borderRadius: 999 }}
                    />
                    <Typography
                      variant="body2"
                      sx={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {det.descripcion || "—"}
                    </Typography>
                  </Box>
                </TableCell>

                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {tipoItemNombre}
                  </Typography>
                </TableCell>

                <TableCell>{unidadNombre}</TableCell>

                <TableCell align="right">
                  <Typography fontWeight={700}>{det.cantidad}</Typography>
                </TableCell>

                <TableCell sx={{ maxWidth: 360 }}>
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
                    {origen}
                  </Typography>
                </TableCell>

                <TableCell align="right">
                  <Typography variant="body2">{formatCLP(det.costoTotal)}</Typography>
                </TableCell>

                <TableCell align="right">
                  <Typography fontWeight={800}>{formatCLP(det.total ?? det.ventaTotal)}</Typography>
                </TableCell>

                <TableCell align="right">
                  <Chip
                    size="small"
                    label={
                      det.porcentajeUtilidad != null
                        ? `${Number(det.porcentajeUtilidad).toFixed(1)}%`
                        : "—"
                    }
                    sx={{ borderRadius: 999 }}
                    color={det.porcentajeUtilidad >= 0 ? "success" : "error"}
                    variant="outlined"
                  />
                </TableCell>
              </TableRow>
            );
          })}

          {(!detalles || detalles.length === 0) && (
            <TableRow>
              <TableCell colSpan={8} align="center">
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                  Este costeo no tiene ítems de detalle.
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Box>
  );
}

/**
 * Props:
 * - ventas: Venta[]
 * - onCreateCotizacionFromVenta: (ventaId: string) => void
 */
export default function VentasTable({ ventas = [], onCreateCotizacionFromVenta }) {
  const isMobile = useMediaQuery("(max-width:900px)");

  // Expand rows
  const [openMap, setOpenMap] = useState({});

  // Actions menu (opcional)
  const [anchorEl, setAnchorEl] = useState(null);
  const [menuVenta, setMenuVenta] = useState(null);
  const openMenu = Boolean(anchorEl);

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const ventasSorted = useMemo(() => {
    return [...ventas].sort((a, b) => {
      const da = a?.fecha ? new Date(a.fecha).getTime() : 0;
      const db = b?.fecha ? new Date(b.fecha).getTime() : 0;
      return db - da;
    });
  }, [ventas]);

  const paged = useMemo(() => {
    const start = page * rowsPerPage;
    return ventasSorted.slice(start, start + rowsPerPage);
  }, [ventasSorted, page, rowsPerPage]);

  const handleToggle = (ventaId) => {
    setOpenMap((prev) => ({ ...prev, [ventaId]: !prev[ventaId] }));
  };

  // para que clicks en botones no togglen la fila/card
  const stopRowToggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleOpenMenu = (e, venta) => {
    stopRowToggle(e);
    setAnchorEl(e.currentTarget);
    setMenuVenta(venta);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
    setMenuVenta(null);
  };

  const handleCreateCotFromRow = (e, ventaId) => {
    stopRowToggle(e);
    onCreateCotizacionFromVenta?.(ventaId);
  };

  const handleCreateCotFromMenu = () => {
    const ventaId = menuVenta?.id;
    handleCloseMenu();
    if (!ventaId) return;
    onCreateCotizacionFromVenta?.(ventaId);
  };

  const handleChangePage = (_, newPage) => setPage(newPage);

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // ===== MOBILE VIEW (cards) =====
  if (isMobile) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        {paged.map((venta) => {
          const total = calcTotalVenta(venta);
          const detalles = venta?.detalles || [];
          const opened = !!openMap[venta.id];

          return (
            <Card
              key={venta.id}
              variant="outlined"
              sx={{ borderRadius: 2, cursor: "pointer" }}
              onClick={() => handleToggle(venta.id)}
            >
              <CardContent>
                <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
                  <Box>
                    <Typography fontWeight={900}>Costeo #{venta.numero ?? "—"}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Fecha: {getFechaLabel(venta)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      OV/Cot: <strong>{getOvLabel(venta)}</strong>
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Ítems: <strong>{detalles.length}</strong>
                    </Typography>
                  </Box>

                  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 0.75 }}>
                    <Chip
                      label={formatCLP(total)}
                      color="primary"
                      variant="outlined"
                      size="small"
                      sx={{ borderRadius: 999 }}
                    />

                    <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
                      <Tooltip title="Crear cotización">
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<DescriptionIcon fontSize="small" />}
                          onClick={(e) => handleCreateCotFromRow(e, venta.id)}
                          sx={{ borderRadius: 2, textTransform: "none", fontWeight: 800 }}
                        >
                          Cotizar
                        </Button>
                      </Tooltip>

                      <Box sx={{ display: "flex", alignItems: "center", px: 0.5 }}>
                        {opened ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
                      </Box>

                      {/* menú opcional */}
                      <Tooltip title="Más acciones">
                        <IconButton size="small" onClick={(e) => handleOpenMenu(e, venta)}>
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                </Box>

                {venta.descripcion && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {venta.descripcion}
                  </Typography>
                )}

                <Collapse in={opened} timeout="auto" unmountOnExit>
                  <Divider sx={{ my: 1.5 }} />
                  <Box sx={{ overflowX: "auto" }}>
                    <DetallesVentaTable detalles={detalles} />
                  </Box>
                </Collapse>
              </CardContent>
            </Card>
          );
        })}

        <Paper variant="outlined" sx={{ borderRadius: 2 }}>
          <TablePagination
            component="div"
            count={ventasSorted.length}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[5, 10, 25, 50]}
          />
        </Paper>

        {/* Menú (opcional) */}
        <Menu
          anchorEl={anchorEl}
          open={openMenu}
          onClose={handleCloseMenu}
          PaperProps={{ sx: { borderRadius: 2, minWidth: 240 } }}
        >
          <MenuItem onClick={handleCreateCotFromMenu} sx={{ py: 1.2, gap: 1 }}>
            <DescriptionIcon fontSize="small" />
            <Box>
              <Typography fontWeight={700} variant="body2">
                Crear cotización
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Usar este costeo como base
              </Typography>
            </Box>
          </MenuItem>
        </Menu>
      </Box>
    );
  }

  // ===== DESKTOP TABLE VIEW =====
  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 52 }} />
              <TableCell>#</TableCell>
              <TableCell>Fecha</TableCell>
              <TableCell>OV/Cot</TableCell>
              <TableCell>Descripción</TableCell>
              <TableCell align="right">Ítems</TableCell>
              <TableCell align="right">Total</TableCell>

              {/* ✅ NUEVO: botón por registro */}
              <TableCell align="right" sx={{ width: 170 }}>
                Cotización
              </TableCell>

              {/* menú opcional */}
              <TableCell align="right" sx={{ width: 56 }}>
                Más
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {paged.map((venta) => {
              const opened = !!openMap[venta.id];
              const detalles = venta?.detalles || [];
              const total = calcTotalVenta(venta);

              return (
                <Fragment key={venta.id}>
                  <TableRow hover onClick={() => handleToggle(venta.id)} sx={{ cursor: "pointer" }}>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          stopRowToggle(e);
                          handleToggle(venta.id);
                        }}
                      >
                        {opened ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                      </IconButton>
                    </TableCell>

                    <TableCell>
                      <Typography fontWeight={800}>{venta.numero ?? "—"}</Typography>
                    </TableCell>

                    <TableCell>{getFechaLabel(venta)}</TableCell>

                    <TableCell>
                      <Chip
                        label={getOvLabel(venta)}
                        variant="outlined"
                        size="small"
                        sx={{ borderRadius: 999 }}
                        onClick={stopRowToggle}
                      />
                    </TableCell>

                    <TableCell sx={{ maxWidth: 420 }}>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {venta.descripcion || "—"}
                      </Typography>
                    </TableCell>

                    <TableCell align="right">{detalles.length}</TableCell>

                    <TableCell align="right">
                      <Typography fontWeight={900}>{formatCLP(total)}</Typography>
                    </TableCell>

                    {/* ✅ BOTÓN DIRECTO */}
                    <TableCell align="right">
                      <Tooltip title="Crear cotización desde este costeo">
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<DescriptionIcon fontSize="small" />}
                          onClick={(e) => handleCreateCotFromRow(e, venta.id)}
                          sx={{
                            borderRadius: 2,
                            textTransform: "none",
                            fontWeight: 900,
                            px: 1.25,
                          }}
                        >
                          Cotizar
                        </Button>
                      </Tooltip>
                    </TableCell>

                    {/* menú opcional */}
                    <TableCell align="right">
                      <Tooltip title="Más acciones">
                        <IconButton size="small" onClick={(e) => handleOpenMenu(e, venta)}>
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell colSpan={9} sx={{ p: 0, borderBottom: 0 }}>
                      <Collapse in={opened} timeout="auto" unmountOnExit>
                        <Box sx={{ px: 1, pb: 1 }}>
                          <Divider sx={{ my: 1 }} />
                          <Box sx={{ overflowX: "auto" }}>
                            <DetallesVentaTable detalles={detalles} />
                          </Box>
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

      <TablePagination
        component="div"
        count={ventasSorted.length}
        page={page}
        onPageChange={handleChangePage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        rowsPerPageOptions={[5, 10, 25, 50]}
      />

      {/* Menú opcional */}
      <Menu
        anchorEl={anchorEl}
        open={openMenu}
        onClose={handleCloseMenu}
        PaperProps={{ sx: { borderRadius: 2, minWidth: 240 } }}
      >
        <MenuItem onClick={handleCreateCotFromMenu} sx={{ py: 1.2, gap: 1 }}>
          <DescriptionIcon fontSize="small" />
          <Box>
            <Typography fontWeight={700} variant="body2">
              Crear cotización
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Usar este costeo como base
            </Typography>
          </Box>
        </MenuItem>
      </Menu>
    </Paper>
  );
}
