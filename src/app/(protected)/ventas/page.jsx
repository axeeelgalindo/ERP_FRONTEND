"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Box, CircularProgress } from "@mui/material";
import { useRouter } from "next/navigation";

import VentasHeader from "@/components/ventas/VentasHeader";
import VentasSummary from "@/components/ventas/VentasSummary";
import VentasTable from "@/components/ventas/VentasTable";

import NuevaVentaDialog from "@/components/ventas/NuevaVentaDialog";
import CotizacionFromVentasDialog from "@/components/ventas/CotizacionFromVentasDialog";

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

  // ✅ para abrir cotización con una venta ya seleccionada (desde tabla)
  const [preselectedVentaIds, setPreselectedVentaIds] = useState([]);

  const openCotFromVenta = (ventaId) => {
    setPreselectedVentaIds([ventaId]);
    setOpenCot(true);
  };

  const openCotManual = () => {
    setPreselectedVentaIds([]); // manual: sin preselección
    setOpenCot(true);
  };

   useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login"); // mejor que push
    }
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

      {/* ✅ tabla con dropdown + acciones + paginación */}
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

      <CotizacionFromVentasDialog
        open={openCot}
        onClose={() => setOpenCot(false)}
        session={session}
        empresaIdFromToken={empresaIdFromToken}
        ventas={ventas}
        preselectedVentaIds={preselectedVentaIds}
        onCreated={fetchVentas}
      />
    </Box>
  );
}
