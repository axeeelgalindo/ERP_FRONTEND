"use client";

import { useMemo, useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Box, CircularProgress } from "@mui/material";
import { useRouter } from "next/navigation";

import VentasHeader from "@/components/ventas/VentasHeader";
import VentasSummary from "@/components/ventas/VentasSummary";
import VentasTable from "@/components/ventas/VentasTable";
import NuevaVentaDialog from "@/components/ventas/NuevaVentaDialog";

// ✅ ojo: este ahora debe ser el NUEVO modal de cotización (con glosas)
// cámbialo por el archivo que creaste/pegaste (ej: NuevaCotizacionDialog.jsx)
import NuevaCotizacionDialog from "@/components/ventas/CotizacionFromVentasDialog";
import { useVentas } from "@/components/ventas/hooks/useVentas";

function calcTotalVenta(v) {
  return (v?.detalles || []).reduce(
    (s, d) => s + (Number(d.total ?? d.ventaTotal) || 0),
    0
  );
}

export default function VentasPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const empresaNombreFromToken = useMemo(
    () => session?.user?.empresa?.nombre || session?.user?.empresaNombre || "",
    [session]
  );

  const empresaIdFromToken = useMemo(
    () => session?.user?.empresa?.id || session?.user?.empresaId || null,
    [session]
  );

  const empresaLabel =
    empresaNombreFromToken && empresaIdFromToken
      ? `${empresaNombreFromToken} (${empresaIdFromToken})`
      : empresaNombreFromToken || empresaIdFromToken || "Sin empresa";

  const { ventas, loadingVentas, errorVentas, fetchVentas } = useVentas({
    session,
    status,
  });

  const [openNew, setOpenNew] = useState(false);
  const [openCot, setOpenCot] = useState(false);

  // ✅ abrir cotización con venta preseleccionada
  const [preselectedVentaIds, setPreselectedVentaIds] = useState([]);

  const openCotFromVenta = (ventaId) => {
    setPreselectedVentaIds([ventaId]);
    setOpenCot(true);
  };

  const openCotManual = () => {
    setPreselectedVentaIds([]); // sin preselección
    setOpenCot(true);
  };

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  // ✅ subtotalBase = suma de ventas seleccionadas (neto)
  const subtotalBase = useMemo(() => {
    if (!Array.isArray(ventas) || ventas.length === 0) return 0;
    if (!Array.isArray(preselectedVentaIds) || preselectedVentaIds.length === 0)
      return 0;

    const setIds = new Set(preselectedVentaIds.map(String));

    return ventas
      .filter((v) => setIds.has(String(v.id)))
      .reduce((acc, v) => acc + calcTotalVenta(v), 0);
  }, [ventas, preselectedVentaIds]);

  if (status === "loading") {
    return (
      <Box
        sx={{
          minHeight: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: "2xl", mx: "auto", p: { xs: 2, md: 3 } }}>
      <VentasHeader
        empresaLabel={empresaLabel}
        loadingVentas={loadingVentas}
        onRefresh={fetchVentas}
        onOpenNewVenta={() => setOpenNew(true)}
        onOpenCotizacion={openCotManual}
      />

      <VentasSummary ventas={ventas} />

      <VentasTable
        ventas={ventas}
        error={errorVentas}
        loading={loadingVentas}
        onCreateCotizacionFromVenta={openCotFromVenta}
      />

      {/* Dialogs */}
      <NuevaVentaDialog
        open={openNew}
        onClose={() => setOpenNew(false)}
        session={session}
        empresaIdFromToken={empresaIdFromToken}
        onCreated={fetchVentas}
      />

      {/* ✅ NUEVO: total NO editable, viene de subtotalBase */}
      <NuevaCotizacionDialog
        open={openCot}
        onClose={() => setOpenCot(false)}
        session={session}
        empresaIdFromToken={empresaIdFromToken}
        subtotalBase={subtotalBase}
        ivaRate={0.19}
        onCreated={fetchVentas}
      />
    </Box>
  );
}
