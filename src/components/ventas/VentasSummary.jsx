"use client";

import { useMemo } from "react";
import { Box, Card, CardContent, Typography } from "@mui/material";
import { formatCLP } from "@/components/ventas/utils/money";

export default function VentasSummary({ ventas }) {
  const totalVentas = ventas?.length || 0;

  const totalFacturado = useMemo(() => {
    return (ventas || []).reduce((acc, v) => {
      const totalVenta = (v.detalles || []).reduce(
        (suma, d) => suma + (Number(d.total ?? d.ventaTotal) || 0),
        0
      );
      return acc + totalVenta;
    }, 0);
  }, [ventas]);

  return (
    <Card sx={{ mb: 3, borderRadius: 3, boxShadow: 2 }}>
      <CardContent>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
            gap: 2,
          }}
        >
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Cantidad de ventas
            </Typography>
            <Typography variant="h5" fontWeight={700}>
              {totalVentas}
            </Typography>
          </Box>

          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Monto total facturado
            </Typography>
            <Typography variant="h5" fontWeight={700}>
              {formatCLP(totalFacturado)}
            </Typography>
          </Box>

          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Ticket promedio (aprox.)
            </Typography>
            <Typography variant="h5" fontWeight={700}>
              {totalVentas
                ? formatCLP(totalFacturado / totalVentas)
                : formatCLP(0)}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
