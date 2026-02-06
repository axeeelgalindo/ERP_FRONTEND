"use client";

import { MoreVertical, Eye, Pencil, Trash, Users, Play, SquareCheckBig } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import Pagination from "@/components/ui/Pagination";

/* ===== helpers ===== */
function uniqueClients(ventas = []) {
  const map = new Map();
  for (const v of ventas || []) {
    const c = v?.cliente;
    if (!c) continue;
    if (!map.has(c.id)) {
      map.set(c.id, {
        id: c.id,
        nombre: c.nombre || c.razonSocial || "Sin nombre",
        rut: c.rut || "",
      });
    }
  }
  return Array.from(map.values());
}

function ClientsCell({ ventas }) {
  const clientes = uniqueClients(ventas);
  if (!clientes.length) return <span className="text-gray-400">—</span>;

  const visibles = clientes.slice(0, 2);
  const restantes = clientes.length - visibles.length;

  const tooltip =
    restantes > 0
      ? clientes.map((c) => `${c.nombre}${c.rut ? ` (${c.rut})` : ""}`).join("\n")
      : undefined;

  return (
    <div className="flex flex-wrap items-center gap-1.5" title={tooltip}>
      {visibles.map((c) => (
        <span
          key={c.id}
          className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 text-xs"
        >
          <Users size={12} />
          {c.nombre}
        </span>
      ))}
      {restantes > 0 && (
        <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-700 border border-gray-200 px-2 py-0.5 text-xs">
          +{restantes}
        </span>
      )}
    </div>
  );
}

function fmtCLDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CL");
}

function DatesCell({ row }) {
  const iniP = fmtCLDate(row?.fecha_inicio_plan);
  const finP = fmtCLDate(row?.fecha_fin_plan);
  const iniR = fmtCLDate(row?.fecha_inicio_real);
  const finR = fmtCLDate(row?.fecha_fin_real);

  const hasPlan = row?.fecha_inicio_plan || row?.fecha_fin_plan;
  const hasReal = row?.fecha_inicio_real || row?.fecha_fin_real;

  return (
    <div className="text-xs leading-5">
      <div className={hasPlan ? "text-gray-700" : "text-gray-400"}>
        <span className="font-medium">Plan:</span> {iniP} → {finP}
      </div>
      <div className={hasReal ? "text-gray-600" : "text-gray-400"}>
        <span className="font-medium">Real:</span> {iniR} → {finR}
      </div>
      {!hasPlan && !hasReal ? <span className="text-gray-400">—</span> : null}
    </div>
  );
}

/* ===== fila con menú ===== */
function RowMenu({ row, onEdit, onDelete, onStart, onFinish }) {
  const [open, setOpen] = useState(false);

  const started = !!row?.fecha_inicio_real;
  const finished = !!row?.fecha_fin_real;

  const showStart = !started && !finished;
  const showFinish = started && !finished;

  return (
    <div className="relative inline-block text-left">
      <button
        className="inline-flex items-center justify-center p-2 rounded-md hover:bg-gray-100 hover:cursor-pointer"
        onClick={() => setOpen((o) => !o)}
        aria-label="Abrir menú"
        type="button"
      >
        <MoreVertical size={16} />
      </button>

      {open && (
        <div
          className="absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-md border border-gray-200 bg-white shadow-lg"
          onMouseLeave={() => setOpen(false)}
        >
          <div className="py-1 text-sm">
            <Link
              href={`/proyectos/${row.id}`}
              className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50"
            >
              <Eye size={14} /> Ver
            </Link>

            {showStart && (
              <button
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left"
                onClick={() => {
                  setOpen(false);
                  onStart?.(row);
                }}
                type="button"
              >
                <Play size={14} /> Iniciar proyecto
              </button>
            )}

            {showFinish && (
              <button
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left"
                onClick={() => {
                  setOpen(false);
                  onFinish?.(row);
                }}
                type="button"
              >
                <SquareCheckBig size={14} /> Finalizar proyecto
              </button>
            )}

            <button
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left"
              onClick={() => {
                setOpen(false);
                onEdit(row);
              }}
              type="button"
            >
              <Pencil size={14} /> Editar
            </button>

            <button
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-50 text-left text-red-600"
              onClick={() => {
                setOpen(false);
                onDelete(row);
              }}
              type="button"
            >
              <Trash size={14} /> Eliminar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProjectsTable({
  rows,
  loading,
  error,
  onEdit,
  onDelete,
  onStart,
  onFinish,
  page = 1,
  pageSize = 10,
  total = 0,
  onPageChange,
}) {
  if (loading) return <div className="p-6 text-sm text-gray-500">Cargando proyectos…</div>;
  if (error) return <div className="p-6 text-sm text-red-500">Error: {error}</div>;
  if (!rows?.length) return <div className="p-6 text-sm text-gray-500">Sin resultados.</div>;

  const _page = Number.isFinite(Number(page)) ? Number(page) : 1;
  const _size = Number.isFinite(Number(pageSize)) ? Number(pageSize) : 10;
  const _total = Number.isFinite(Number(total)) ? Number(total) : rows.length;

  const from = (_page - 1) * _size + 1;
  const to = Math.min(_page * _size, _total);
  const totalPages = Math.max(1, Math.ceil(_total / _size));

  return (
    <div className="w-full">
      <table className="w-full text-sm text-left text-gray-600">
        <thead className="bg-gray-50 text-gray-700 font-semibold border-b">
          <tr>
            <th className="px-4 py-3">Nombre</th>
            <th className="px-4 py-3">Cliente</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Fechas</th>
            <th className="px-4 py-3">Descripción</th>
            <th className="px-4 py-3 w-[60px] text-right">Acciones</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b last:border-0 hover:bg-gray-50">
              <td className="px-4 py-2 font-medium text-gray-800">{row.nombre}</td>
              <td className="px-4 py-2"><ClientsCell ventas={row.ventas} /></td>
              <td className="px-4 py-2">{row.estado || "Sin estado"}</td>
              <td className="px-4 py-2"><DatesCell row={row} /></td>
              <td className="px-4 py-2 text-gray-500">{row.descripcion || "—"}</td>
              <td className="px-4 py-2 text-right">
                <RowMenu
                  row={row}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onStart={onStart}
                  onFinish={onFinish}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t bg-gray-50">
        <div className="text-xs text-gray-500">
          Mostrando <span className="font-medium text-gray-700">{from}-{to}</span> de{" "}
          <span className="font-medium text-gray-700">{_total}</span>
        </div>
        <Pagination page={_page} totalPages={totalPages} onPageChange={onPageChange} />
      </div>
    </div>
  );
}
