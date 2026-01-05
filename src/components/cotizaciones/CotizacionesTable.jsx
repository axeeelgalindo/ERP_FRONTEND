"use client";

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
} from "@mui/material";
import { formatCLP } from "@/components/cotizaciones/utils";

export default function CotizacionItemsTable({ items = [] }) {
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Tipo</TableCell>
            <TableCell>Producto / Servicio</TableCell>
            <TableCell>Descripción</TableCell>
            <TableCell align="right">Cantidad</TableCell>
            <TableCell align="right">Precio unit.</TableCell>
            <TableCell align="right">Total</TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {items.map((it) => {
            const tipo = it.tipo || "-";
            const nombre =
              tipo === "PRODUCTO"
                ? it.producto?.nombre || "(Producto)"
                : it.Item || "(Servicio)";

            return (
              <TableRow key={it.id} hover>
                <TableCell>
                  <Chip size="small" variant="outlined" label={tipo} />
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{nombre}</TableCell>
                <TableCell sx={{ color: "text.secondary" }}>
                  {it.descripcion || "-"}
                </TableCell>
                <TableCell align="right">{it.cantidad}</TableCell>
                <TableCell align="right">{formatCLP(it.precioUnitario)}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800 }}>
                  {formatCLP(it.total)}
                </TableCell>
              </TableRow>
            );
          })}

          {!items.length && (
            <TableRow>
              <TableCell colSpan={6} align="center">
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                  Esta cotización no tiene ítems.
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {!!items.length && (
        <Box sx={{ px: 2, py: 1, borderTop: "1px solid", borderColor: "divider" }}>
          <Typography variant="caption" color="text.secondary">
            Ítems: <strong>{items.length}</strong>
          </Typography>
        </Box>
      )}
    </TableContainer>
  );
}
