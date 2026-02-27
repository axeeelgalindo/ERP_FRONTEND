"use client";

import {
  MoreVertical,
  Eye,
  Pencil,
  Trash,
  Users,
  Play,
  SquareCheckBig,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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
  if (!clientes.length) return <span className="text-gray-500 dark:text-gray-400">—</span>;

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
          className="inline-flex items-center gap-1 rounded-full
            bg-blue-50 text-blue-700 border border-blue-100
            dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800
            px-2 py-0.5 text-xs"
        >
          <Users size={12} />
          {c.nombre}
        </span>
      ))}
      {restantes > 0 && (
        <span
          className="inline-flex items-center rounded-full
            bg-gray-100 text-gray-700 border border-gray-200
            dark:bg-slate-700 dark:text-gray-200 dark:border-slate-600
            px-2 py-0.5 text-xs"
        >
          +{restantes}
        </span>
      )}
    </div>
  );
}

function clampPct(n) {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
}

function fmtCLShort(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
}

function fmtCL(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CL");
}

function EstadoPill({ estado }) {
  const s = String(estado || "activo").toLowerCase();

  const isActivo = ["activo", "en_curso", "en_progreso"].includes(s);
  const isPausado = ["pausado", "pause", "detenido"].includes(s);
  const isCompletado = ["completado", "completa", "finalizado", "cerrado"].includes(s);

  const label = isCompletado ? "Completado" : isPausado ? "Pausado" : "Activo";

  const cls = isCompletado
    ? "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800"
    : isPausado
      ? "bg-gray-100 text-gray-600 border-gray-200 dark:bg-slate-700 dark:text-gray-200 dark:border-slate-600"
      : "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800";

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${cls}`}>
      {label}
    </span>
  );
}

function ProgressDatesCell({ row }) {
  const pct = clampPct(row?.progresoPct ?? row?.avance ?? row?.progress ?? 0);

  const iniP = row?.fecha_inicio_plan ? fmtCLShort(row.fecha_inicio_plan) : null;
  const finP = row?.fecha_fin_plan ? fmtCLShort(row.fecha_fin_plan) : null;

  const planLine =
    row?.fecha_inicio_plan && row?.fecha_fin_plan
      ? `Plan: ${fmtCL(row.fecha_inicio_plan)} → ${fmtCL(row.fecha_fin_plan)}`
      : null;

  const topLeft =
    iniP && finP ? `${iniP} - ${finP}` : pct > 0 ? "No iniciado" : "Sin fechas";

  // estilo como tu HTML (primary azul para normal)
  const barColor =
    pct >= 100
      ? "bg-green-500"
      : pct >= 90
        ? "bg-red-500"
        : pct >= 70
          ? "bg-amber-500"
          : pct > 0
            ? "bg-sky-500"
            : "bg-gray-400 dark:bg-slate-600";

  const pctColor =
    pct >= 100
      ? "text-green-600 dark:text-green-400"
      : pct >= 90
        ? "text-red-500"
        : pct >= 70
          ? "text-amber-500"
          : pct > 0
            ? "text-sky-600 dark:text-sky-400"
            : "text-gray-400";

  return (
    <div className="w-full">
      <div className="flex justify-between text-xs mb-1.5">
        <span className={iniP && finP ? "text-gray-600 dark:text-gray-400" : "text-gray-400 dark:text-gray-500 italic"}>
          {topLeft}
        </span>
        <span className={`font-medium ${pctColor}`}>{pct}%</span>
      </div>

      <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
        <div className={`${barColor} h-2 rounded-full`} style={{ width: `${pct}%` }} />
      </div>

      {planLine ? (
        <div className="text-[10px] text-gray-400 mt-1">{planLine}</div>
      ) : null}
    </div>
  );
}

/**
 * Menú acciones robusto:
 * - cierra al click fuera
 * - posiciona el dropdown con coords del botón
 * - usa "fixed" para que no lo corte overflow-hidden del contenedor
 */
function RowMenu({ row, onEdit, onDelete, onStart, onFinish }) {
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const started = !!row?.fecha_inicio_real;
  const finished = !!row?.fecha_fin_real;

  const showStart = !started && !finished;
  const showFinish = started && !finished;

  const calcPos = () => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = 224; // w-56
    const gap = 8;

    // derecha alineada al botón
    let left = r.right - width;
    if (left < 8) left = 8;

    let top = r.bottom + gap;

    // si se sale por abajo, lo subimos
    const maxBottom = window.innerHeight - 8;
    const estimatedHeight = 5 * 40; // aprox
    if (top + estimatedHeight > maxBottom) {
      top = Math.max(8, r.top - gap - estimatedHeight);
    }

    setPos({ top, left });
  };

  useEffect(() => {
    if (!open) return;

    calcPos();

    const onResize = () => calcPos();
    const onScroll = () => calcPos();

    const onDown = (e) => {
      const t = e.target;
      if (btnRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    document.addEventListener("mousedown", onDown);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300
          p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
        onClick={() => setOpen((o) => !o)}
        aria-label="Abrir menú"
        type="button"
      >
        <MoreVertical size={18} />
      </button>

      {open && (
        <div
          ref={menuRef}
          className="fixed z-[60] w-56 origin-top-right rounded-lg
            border border-gray-200 dark:border-slate-700
            bg-white dark:bg-slate-800 shadow-lg overflow-hidden"
          style={{ top: pos.top, left: pos.left }}
        >
          <div className="py-1 text-sm">
            <Link
              href={`/proyectos/${row.id}`}
              className="flex items-center gap-2 px-3 py-2
                text-gray-700 dark:text-gray-200
                hover:bg-gray-50 dark:hover:bg-slate-700/60"
              onClick={() => setOpen(false)}
            >
              <Eye size={14} /> Ver
            </Link>

            {showStart && (
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-left
                  text-gray-700 dark:text-gray-200
                  hover:bg-gray-50 dark:hover:bg-slate-700/60"
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
                className="w-full flex items-center gap-2 px-3 py-2 text-left
                  text-gray-700 dark:text-gray-200
                  hover:bg-gray-50 dark:hover:bg-slate-700/60"
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
              className="w-full flex items-center gap-2 px-3 py-2 text-left
                text-gray-700 dark:text-gray-200
                hover:bg-gray-50 dark:hover:bg-slate-700/60"
              onClick={() => {
                setOpen(false);
                onEdit?.(row);
              }}
              type="button"
            >
              <Pencil size={14} /> Editar
            </button>

            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-left
                text-red-600 dark:text-red-400
                hover:bg-red-50 dark:hover:bg-red-900/20"
              onClick={() => {
                setOpen(false);
                onDelete?.(row);
              }}
              type="button"
            >
              <Trash size={14} /> Eliminar
            </button>
          </div>
        </div>
      )}
    </>
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
  if (loading) {
    return (
      <div className="p-6 text-sm text-gray-500 dark:text-gray-400">
        Cargando proyectos…
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-6 text-sm text-red-500">
        Error: {error}
      </div>
    );
  }
  if (!rows?.length) {
    return (
      <div className="p-6 text-sm text-gray-500 dark:text-gray-400">
        Sin resultados.
      </div>
    );
  }

  const _page = Number.isFinite(Number(page)) ? Number(page) : 1;
  const _size = Number.isFinite(Number(pageSize)) ? Number(pageSize) : 10;
  const _total = Number.isFinite(Number(total)) ? Number(total) : rows.length;

  const from = (_page - 1) * _size + 1;
  const to = Math.min(_page * _size, _total);
  const totalPages = Math.max(1, Math.ceil(_total / _size));

  return (
    <div className="w-full">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50">
              <th className="p-5 text-sm font-semibold text-gray-500 dark:text-gray-400">
                Nombre
              </th>
              <th className="p-5 text-sm font-semibold text-gray-500 dark:text-gray-400">
                Cliente
              </th>
              <th className="p-5 text-sm font-semibold text-gray-500 dark:text-gray-400">
                Estado
              </th>
              <th className="p-5 text-sm font-semibold text-gray-500 dark:text-gray-400 w-[360px]">
                Progreso / Fechas
              </th>
              <th className="p-5 text-sm font-semibold text-gray-500 dark:text-gray-400">
                Descripción
              </th>
              <th className="p-5 text-sm font-semibold text-gray-500 dark:text-gray-400 text-right">
                Acciones
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
            {rows.map((row) => {
              const id = row.id;
              const nombre = row.nombre ?? "Sin nombre";
              const codigo = row.codigo ?? row.code ?? row.folio ?? null;

              return (
                <tr
                  key={id}
                  className="group hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <td className="p-5">
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {nombre}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      ID: {codigo ? `#${String(codigo)}` : `#${String(id).slice(-6)}`}
                    </div>
                  </td>

                  <td className="p-5">
                    <ClientsCell ventas={row.ventas} />
                  </td>

                  <td className="p-5">
                    <EstadoPill estado={row.estado || "activo"} />
                  </td>

                  <td className="p-5">
                    <ProgressDatesCell row={row} />
                  </td>

                  <td className="p-5 text-sm text-gray-500 dark:text-gray-400">
                    {row.descripcion || "—"}
                  </td>

                  <td className="p-5 text-right">
                    <RowMenu
                      row={row}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onStart={onStart}
                      onFinish={onFinish}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t border-gray-200 dark:border-slate-700 flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Mostrando{" "}
          <span className="font-medium text-gray-900 dark:text-white">{from}</span>{" "}
          a{" "}
          <span className="font-medium text-gray-900 dark:text-white">{to}</span>{" "}
          de{" "}
          <span className="font-medium text-gray-900 dark:text-white">{_total}</span>{" "}
          resultados
        </p>

        <Pagination page={_page} totalPages={totalPages} onPageChange={onPageChange} />
      </div>
    </div>
  );
}