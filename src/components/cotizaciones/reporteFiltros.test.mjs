import test from "node:test";
import assert from "node:assert/strict";
import { fechaReporte, filtrarReporte, errorFiltros } from "./reporteFiltros.mjs";

const filtros = { estados: ["COTIZACION"], periodo: "total", cliente: "" };
const rows = [
  { numero: 1, estado: "COTIZACION", fecha_documento: "2026-09-01T00:00:00Z", cliente_id: "a" },
  { numero: 2, estado: "ACEPTADA", fecha_documento: "2026-09-30T00:00:00Z", cliente_id: "b" },
  { numero: 3, estado: "COTIZACION", fecha_documento: "2026-10-01T00:00:00Z", cliente_id: "a" },
  { numero: 4, estado: "COTIZACION", fecha_documento: "2026-09-15T00:00:00Z", es_suscripcion: true },
];
test("solo cotización por defecto, sin suscripciones", () => {
  assert.deepEqual(filtrarReporte(rows, filtros).map(c => c.numero), [3, 1]);
});
test("múltiples estados y rango con ambos extremos incluidos", () => {
  assert.deepEqual(filtrarReporte(rows, { ...filtros, estados: ["COTIZACION", "ACEPTADA"], periodo: "rango", desde: "2026-09-01", hasta: "2026-09-30" }).map(c => c.numero), [2, 1]);
});
test("mes, año y cliente", () => {
  assert.equal(filtrarReporte(rows, { ...filtros, periodo: "mensual", mes: "2026-09" }).length, 1);
  assert.equal(filtrarReporte(rows, { ...filtros, periodo: "anual", anio: "2025" }).length, 0);
  assert.equal(filtrarReporte(rows, { ...filtros, cliente: "b" }).length, 0);
});
test("fechas civiles y creación en Chile", () => {
  assert.equal(fechaReporte(rows[0]), "2026-09-01");
  assert.equal(fechaReporte({ creada_en: "2026-10-01T01:00:00Z" }), "2026-09-30");
  assert.equal(fechaReporte({ creada_en: "inválida" }), "");
});
test("rechaza filtros vacíos e inválidos", () => {
  for (const f of [
    { estados: [] }, { periodo: "mensual", mes: "2026-13" },
    { periodo: "anual", anio: "" },
    { periodo: "rango", desde: "2026-02-30", hasta: "2026-03-01" },
    { periodo: "rango", desde: "2026-10-01", hasta: "2026-09-01" },
  ]) {
    assert.ok(errorFiltros({ ...filtros, ...f }));
    assert.equal(filtrarReporte(rows, { ...filtros, ...f }).length, 0);
  }
});
