export function formatCurrencyCLP(n) {
  if (n == null) return "—";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatPercent(n) {
  if (n == null) return "—";
  const num = Number(n) || 0;
  return `${num.toFixed(1)}%`;
}
