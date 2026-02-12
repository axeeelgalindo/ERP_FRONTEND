"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

import VentasHeader from "@/components/ventas/VentasHeader";
import VentasSummary from "@/components/ventas/VentasSummary";
import VentasTable from "@/components/ventas/VentasTable";

import NuevaVentaDialog from "@/components/ventas/NuevaVentaDialog";

// ✅ usa SOLO el nuevo modal (paso a paso)
import { CotizacionFromVentasDialog } from "@/components/ventas/cotizacion";

// import DisableVentaModal from "@/components/ventas/DisableVentaModal";
import { VentaDeleteDialog } from "@/components/ventas/modalForm";

import { useVentas } from "@/components/ventas/hooks/useVentas";

export default function VentasPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const empresaNombreFromToken = useMemo(
    () => session?.user?.empresa?.nombre || session?.user?.empresaNombre || "",
    [session],
  );

  const empresaIdFromToken = useMemo(
    () => session?.user?.empresa?.id || session?.user?.empresaId || null,
    [session],
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

  // ✅ EDIT
  const [openEdit, setOpenEdit] = useState(false);
  const [ventaIdEditing, setVentaIdEditing] = useState(null);

  // Cotización
  const [openCot, setOpenCot] = useState(false);
  const [preselectedVentaIds, setPreselectedVentaIds] = useState([]);

  const onCreateCotizacionFromVenta = useCallback((ventaId) => {
    if (!ventaId) return;
    setPreselectedVentaIds([ventaId]);
    setOpenCot(true);
  }, []);

  const openCotManual = useCallback(() => {
    setPreselectedVentaIds([]);
    setOpenCot(true);
  }, []);

  const onEditVenta = useCallback((ventaId) => {
    if (!ventaId) return;
    setVentaIdEditing(ventaId);
    setOpenEdit(true);
  }, []);

  // ✅ deshabilitar
  const [openDisable, setOpenDisable] = useState(false);
  const [ventaDisable, setVentaDisable] = useState(null);

  const onDisableVenta = useCallback((venta) => {
    if (!venta?.id) return;
    setVentaDisable(venta);
    setOpenDisable(true);
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-4 border-slate-200 border-t-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="w-full max-w-none px-6 md:px-8 py-6 md:py-8">
        <VentasHeader
          empresaLabel={empresaLabel}
          loadingVentas={loadingVentas}
          onRefresh={fetchVentas}
          onOpenNewVenta={() => {
            setVentaIdEditing(null);
            setOpenNew(true);
          }}
          onOpenCotizacion={openCotManual}
        />

        <VentasSummary ventas={ventas} />

        <VentasTable
          ventas={ventas}
          error={errorVentas}
          loading={loadingVentas}
          onCreateCotizacionFromVenta={onCreateCotizacionFromVenta}
          onEditVenta={onEditVenta}
          onDisableVenta={onDisableVenta}
        />
      </div>

      {/* FAB mobile */}
      <button
        onClick={() => {
          setVentaIdEditing(null);
          setOpenNew(true);
        }}
        className="lg:hidden fixed bottom-6 right-6 h-14 w-14 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center active:scale-95 transition"
        title="Nuevo costeo"
      >
        <span className="text-2xl leading-none">+</span>
      </button>

      {/* CREATE */}
      <NuevaVentaDialog
        open={openNew}
        onClose={() => setOpenNew(false)}
        session={session}
        empresaIdFromToken={empresaIdFromToken}
        onCreated={fetchVentas}
      />

      {/* EDIT */}
      <NuevaVentaDialog
        open={openEdit}
        onClose={() => {
          setOpenEdit(false);
          setVentaIdEditing(null);
        }}
        session={session}
        empresaIdFromToken={empresaIdFromToken}
        onCreated={fetchVentas}
        ventaId={ventaIdEditing}
      />

      {/* ✅ NUEVO MODAL COTIZACIÓN (Stepper) */}
      <CotizacionFromVentasDialog
        open={openCot}
        onClose={() => setOpenCot(false)}
        session={session}
        empresaIdFromToken={empresaIdFromToken}
        ventas={ventas}
        preselectedVentaIds={preselectedVentaIds}
        ivaRate={0.19}
        onCreated={fetchVentas}
      />

      {/* Eliminar costeo */}
      <VentaDeleteDialog
        open={openDisable}
        onClose={() => {
          setOpenDisable(false);
          setVentaDisable(null);
        }}
        venta={ventaDisable}
        session={session}
        empresaIdFromToken={empresaIdFromToken}
        onDisabled={fetchVentas}
      />
    </main>
  );
}
