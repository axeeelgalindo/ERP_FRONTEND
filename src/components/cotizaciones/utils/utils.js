export function formatCLP(value) {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return Number(value).toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}

export function formatMoney(value, moneda = "CLP") {
  if (value == null || Number.isNaN(Number(value))) return "-";
  const m = String(moneda || "CLP").toUpperCase();
  if (m === "USD") {
    return Number(value).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } else if (m === "UF") {
    return "UF " + Number(value).toLocaleString("es-CL", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  } else {
    return Number(value).toLocaleString("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
    });
  }
}

export function estadoColor(estado) {
  switch (estado) {
    case "COTIZACION":
      return "default";
    case "ACEPTADA":
      return "info";
    case "ORDEN_VENTA":
      return "primary";
    case "ENTREGADO":
      return "secondary";
    case "POR_FACTURAR":
      return "warning";
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
  if (estadoActual === "ORDEN_VENTA") return ["POR_FACTURAR"];
  if (estadoActual === "POR_FACTURAR") return ["FACTURADA"];
  if (estadoActual === "FACTURADA") return ["PAGADA"];
  if (estadoActual === "PAGADA") return ["ENTREGADO"];
  // ✅ finales: ENTREGADO, RECHAZADA, etc.
  return [];
}

export function estadoLabel(estado) {
  return String(estado || "").replaceAll("_", " ");
}

export function fechaCL(value) {
  return value ? new Date(value).toLocaleDateString("es-CL", { timeZone: "UTC" }) : "-";
}