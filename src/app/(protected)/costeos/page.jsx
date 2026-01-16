"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Box, CircularProgress } from "@mui/material";
import { useRouter } from "next/navigation";

import VentasHeader from "@/components/ventas/VentasHeader";
import VentasSummary from "@/components/ventas/VentasSummary";
import VentasTable from "@/components/ventas/VentasTable";
import NuevaVentaDialog from "@/components/ventas/NuevaVentaDialog";

import NuevaCotizacionDialog from "@/components/ventas/CotizacionFromVentasDialog";
import { useVentas } from "@/components/ventas/hooks/useVentas";

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
  const [preselectedVentaIds, setPreselectedVentaIds] = useState([]);

  // ✅ ESTA ES LA FUNCIÓN QUE FALTABA (la que la tabla intenta llamar)
  const onCreateCotizacionFromVenta = useCallback((ventaId) => {
    if (!ventaId) return;
    setPreselectedVentaIds([ventaId]);
    setOpenCot(true);
  }, []);

  const openCotManual = useCallback(() => {
    setPreselectedVentaIds([]); // sin preselección
    setOpenCot(true);
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

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
        // ✅ ahora sí existe y se pasa correctamente
        onCreateCotizacionFromVenta={onCreateCotizacionFromVenta}
      />

      <NuevaVentaDialog
        open={openNew}
        onClose={() => setOpenNew(false)}
        session={session}
        empresaIdFromToken={empresaIdFromToken}
        onCreated={fetchVentas}
      />

      {/* ✅ Modal: selecciona ventas y calcula total desde ellas */}
      <NuevaCotizacionDialog
        open={openCot}
        onClose={() => setOpenCot(false)}
        session={session}
        empresaIdFromToken={empresaIdFromToken}
        ventas={ventas}
        preselectedVentaIds={preselectedVentaIds}
        ivaRate={0.19}
        onCreated={fetchVentas}
      />
    </Box>
  );
}
