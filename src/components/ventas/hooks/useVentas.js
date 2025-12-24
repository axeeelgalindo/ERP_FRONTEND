"use client";

import { useCallback, useEffect, useState } from "react";
import { makeHeaders } from "@/lib/api";
import { safeJson } from "@/components/ventas/utils/safeJson";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export function useVentas({ session, status }) {
  const [ventas, setVentas] = useState([]);
  const [loadingVentas, setLoadingVentas] = useState(false);
  const [errorVentas, setErrorVentas] = useState("");

  const fetchVentas = useCallback(async () => {
    try {
      setLoadingVentas(true);
      setErrorVentas("");

      const res = await fetch(`${API_URL}/ventas`, {
        headers: makeHeaders(session),
        cache: "no-store",
      });

      const data = await safeJson(res);
      if (!res.ok)
        throw new Error(
          data?.error || data?.message || "Error al listar ventas"
        );

      setVentas(Array.isArray(data) ? data : []);
    } catch (err) {
      setErrorVentas(err?.message || "Error al cargar ventas");
    } finally {
      setLoadingVentas(false);
    }
  }, [session]);

  useEffect(() => {
    if (status === "authenticated") fetchVentas();
  }, [status, fetchVentas]);

  return { ventas, loadingVentas, errorVentas, fetchVentas };
}
