"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { makeHeaders } from "@/lib/api";
import { safeJson } from "@/components/ventas/utils/safeJson";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export function useVentaCatalogos({
  open,
  session,
  empresaIdFromToken,
  anio,
  mes,
}) {
  const [tipoItems, setTipoItems] = useState([]);
  const [tipoDias, setTipoDias] = useState([]);
  const [ordenesVenta, setOrdenesVenta] = useState([]);

  const [empleados, setEmpleados] = useState([]);
  const [hhRegistros, setHhRegistros] = useState([]);
  const [compraItems, setCompraItems] = useState([]);

  const [loadingCatalogos, setLoadingCatalogos] = useState(false);
  const [catalogosErr, setCatalogosErr] = useState("");

  const fetchCatalogos = useCallback(async () => {
    if (!session?.user) return;

    try {
      setLoadingCatalogos(true);
      setCatalogosErr("");

      const headers = makeHeaders(session, empresaIdFromToken);

      const [resTipoItems, resTipoDias, resOV] = await Promise.all([
        fetch(`${API_URL}/ventas/tipoitems`, { headers, cache: "no-store" }),
        fetch(`${API_URL}/ventas/tipodias`, { headers, cache: "no-store" }),
        fetch(`${API_URL}/ventas/ordenes-venta`, { headers, cache: "no-store" }),
      ]);

      const [dataTipoItems, dataTipoDias, dataOV] = await Promise.all([
        safeJson(resTipoItems),
        safeJson(resTipoDias),
        safeJson(resOV),
      ]);

      if (!resTipoItems.ok)
        throw new Error(
          dataTipoItems?.error ||
            dataTipoItems?.message ||
            "Error cargando tipoItems"
        );
      if (!resTipoDias.ok)
        throw new Error(
          dataTipoDias?.error ||
            dataTipoDias?.message ||
            "Error cargando tipoDias"
        );
      if (!resOV.ok)
        throw new Error(
          dataOV?.error || dataOV?.message || "Error cargando cotizaciones/OV"
        );

      setTipoItems(Array.isArray(dataTipoItems) ? dataTipoItems : []);
      setTipoDias(Array.isArray(dataTipoDias) ? dataTipoDias : []);
      setOrdenesVenta(Array.isArray(dataOV) ? dataOV : []);

      const [resEmpleados, resHH, resCompraDisp] = await Promise.all([
        fetch(`${API_URL}/ventas/empleados`, { headers, cache: "no-store" }),
        fetch(`${API_URL}/ventas/hh-empleados?anio=${anio}&mes=${mes}`, {
          headers,
          cache: "no-store",
        }),
        fetch(`${API_URL}/compras/disponibles-venta`, {
          headers,
          cache: "no-store",
        }),
      ]);

      const [dataEmpleados, dataHH, dataCompraDisp] = await Promise.all([
        safeJson(resEmpleados),
        safeJson(resHH),
        safeJson(resCompraDisp),
      ]);

      if (!resEmpleados.ok)
        throw new Error(
          dataEmpleados?.error || dataEmpleados?.message || "Error cargando empleados"
        );
      if (!resHH.ok)
        throw new Error(dataHH?.error || dataHH?.message || "Error HHEmpleado");
      if (!resCompraDisp.ok)
        throw new Error(
          dataCompraDisp?.error ||
            dataCompraDisp?.message ||
            "Error cargando compras disponibles"
        );

      setEmpleados(Array.isArray(dataEmpleados) ? dataEmpleados : []);
      setHhRegistros(Array.isArray(dataHH) ? dataHH : []);

      const raw = Array.isArray(dataCompraDisp)
        ? dataCompraDisp
        : Array.isArray(dataCompraDisp?.data)
        ? dataCompraDisp.data
        : [];

      const isCompraItemArray =
        raw.length > 0 &&
        (raw[0]?.compra_id !== undefined ||
          raw[0]?.precio_unit !== undefined ||
          raw[0]?.item !== undefined);

      if (isCompraItemArray) {
        setCompraItems(raw.map((it) => ({ ...it, compra: it.compra || null })));
      } else {
        const comprasArr = raw;
        const itemsFlat = comprasArr.flatMap((c) =>
          (c.items || []).map((it) => ({ ...it, compra: c }))
        );
        setCompraItems(itemsFlat);
      }
    } catch (e) {
      setCatalogosErr(e?.message || "Error cargando catálogos");
    } finally {
      setLoadingCatalogos(false);
    }
  }, [session, empresaIdFromToken, anio, mes]);

  // carga inicial al abrir
  useEffect(() => {
    if (open) fetchCatalogos();
  }, [open, fetchCatalogos]);

  // refrescar HH al cambiar periodo (si está abierto)
  useEffect(() => {
    if (!open) return;
    if (!session?.user) return;

    (async () => {
      try {
        const headers = makeHeaders(session);
        const resHH = await fetch(
          `${API_URL}/ventas/hh-empleados?anio=${anio}&mes=${mes}`,
          { headers, cache: "no-store" }
        );
        const dataHH = await safeJson(resHH);
        if (!resHH.ok) throw new Error(dataHH?.error || "Error HHEmpleado");
        setHhRegistros(Array.isArray(dataHH) ? dataHH : []);
      } catch {
        // silencioso
      }
    })();
  }, [anio, mes, open, session]);

  return {
    tipoItems,
    tipoDias,
    ordenesVenta,
    empleados,
    hhRegistros,
    compraItems,
    loadingCatalogos,
    catalogosErr,
    refetchCatalogos: fetchCatalogos,
  };
}
