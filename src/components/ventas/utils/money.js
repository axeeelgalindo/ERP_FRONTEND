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
