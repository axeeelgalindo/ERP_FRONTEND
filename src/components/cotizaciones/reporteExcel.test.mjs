import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { crearReporteExcel } from "./reporteExcel.mjs";
import { filtrarReporte } from "./reporteFiltros.mjs";

test("exporta selección, valores tipados, fórmulas y formato al guardar XLSX", async () => {
  const rows = [
    { numero: "0001", estado: "COTIZACION", total: "123456789", fecha_documento: "2026-10-01T00:00:00Z", asunto: "Mantenimiento preventivo de instalaciones industriales ".repeat(6), cliente: { nombre: "Cliente con nombre largo ".repeat(5) } },
    { numero: 2, estado: "ACEPTADA", total: 0, creada_en: "2026-10-02T01:00:00Z", asunto: "=SUM(A1:A2)", cliente: { nombre: "Cliente B" } },
    { numero: 3, estado: "PAGADA", total: 999, fecha_documento: "2026-10-01" },
  ];
  const estados = ["COTIZACION", "ACEPTADA"];
  const cotizaciones = filtrarReporte(rows, { estados, periodo: "mensual", mes: "2026-10" });
  const wb = await crearReporteExcel({ cotizaciones, empresa: "Empresa prueba", periodo: "Octubre 2026", estados, cliente: "Todos" });
  const saved = new ExcelJS.Workbook();
  await saved.xlsx.load(await wb.xlsx.writeBuffer());
  const detail = saved.getWorksheet("Cotizaciones");
  const summary = saved.getWorksheet("Resumen");
  assert.equal(saved.worksheets.length, 2);
  assert.equal(detail.rowCount, 7);
  assert.equal(detail.getCell("B5").value, "=SUM(A1:A2)"); // Text must not become a formula.
  assert.equal(detail.getCell("A6").value, "0001");
  assert.equal(detail.getCell("F6").value, 123456789);
  assert.equal(detail.getCell("D6").value.toISOString(), "2026-10-01T00:00:00.000Z");
  assert.equal(detail.getCell("F7").value.result, 123456789);
  assert.equal(detail.getCell("F7").value.formula, "SUBTOTAL(109,F5:F6)");
  assert.equal(summary.getCell("C11").value.result, 123456789);
  assert.equal(summary.getCell("B11").value.result, 2);
  assert.equal(detail.getCell("A4").fill.fgColor.argb, "FF174766");
  assert.equal(detail.views[0].ySplit, 4);
  assert.equal(detail.autoFilter, "A4:F6");
  assert.ok(detail.getColumn(2).width <= 62);
  assert.ok(detail.getRow(6).height > 28);
  assert.equal(detail.getCell("B6").alignment.wrapText, true);
});

test("no exporta datos vacíos o montos inválidos", async () => {
  await assert.rejects(crearReporteExcel({ cotizaciones: [] }), /No hay cotizaciones/);
  await assert.rejects(crearReporteExcel({ cotizaciones: [{ total: "incorrecto" }], estados: ["COTIZACION"] }), /monto inválido/);
});
