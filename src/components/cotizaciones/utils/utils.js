export function formatCLP(value) {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return Number(value).toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}

export function estadoColor(estado) {
  switch (estado) {
    case "COTIZACION":
      return "default";
    case "ACEPTADA":
      return "info";
    case "ORDEN_VENTA":
      return "primary";
    case "FACTURADA":
      return "warning";
    case "PAGADA":
      return "success";
    case "RECHAZADA":
      return "error";
    default:
      return "default";
  }
}

export function nextEstados(estadoActual) {
  if (estadoActual === "COTIZACION") return ["ACEPTADA"];
  if (estadoActual === "ACEPTADA") return ["ORDEN_VENTA"];
  if (estadoActual === "ORDEN_VENTA") return ["FACTURADA"];
  if (estadoActual === "FACTURADA") return ["PAGADA"];
  // ✅ finales: PAGADA, RECHAZADA, etc.
  return [];
}

export function estadoLabel(estado) {
  return String(estado || "").replaceAll("_", " ");
}

export function fechaCL(value) {
  return value ? new Date(value).toLocaleDateString("es-CL") : "-";
}