"use client";

import { useMemo, useState } from "react";
import Modal from "@/components/ui/Modal";

function calcTotal(items) {
  return (items || []).reduce((acc, it) => {
    const c = Number(it.cantidad || 0);
    const p = Number(it.precio_unit || 0);
    return acc + c * p;
  }, 0);
}

async function jsonOrNull(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export default function CreateCompraModal({
  open,
  onClose,
  session,
  apiBase,
  makeHeadersJson,
  onCreated,
  lookups,
}) {
  const [creating, setCreating] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const [estado, setEstado] = useState("ORDEN_COMPRA");
  const [proveedorId, setProveedorId] = useState("");
  const [proyectoId, setProyectoId] = useState("");
  const [cotizacionId, setCotizacionId] = useState("");

  const [items, setItems] = useState([{ producto_id: "", item: "", cantidad: 1, precio_unit: 0 }]);
  const totalCalculado = useMemo(() => calcTotal(items), [items]);

  const proveedores = lookups?.proveedores || [];
  const proyectos = lookups?.proyectos || [];
  const productos = lookups?.productos || [];
  const lookupsLoading = lookups?.loading;

  function setItemField(index, key, value) {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [key]: value };
      return copy;
    });
  }

  function addItem() {
    setItems((prev) => [...prev, { producto_id: "", item: "", cantidad: 1, precio_unit: 0 }]);
  }

  function removeItem(i) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!session) return;

    try {
      setCreating(true);
      setFormErr("");
      setOkMsg("");

      const cleanItems = (items || [])
        .map((it) => ({
          producto_id: it.producto_id?.trim() || undefined,
          item: it.item?.trim() || undefined,
          cantidad: Number(it.cantidad || 0),
          precio_unit: Number(it.precio_unit || 0),
        }))
        .filter((it) => (it.producto_id || it.item) && it.cantidad > 0);

      if (cleanItems.length === 0) {
        setFormErr("Agrega al menos 1 ítem (producto o texto libre) y cantidad > 0.");
        return;
      }

      const body = {
        estado,
        proveedorId: proveedorId || undefined,
        proyecto_id: proyectoId || undefined,
        cotizacionId: cotizacionId.trim() || undefined,
        items: cleanItems,
        total: totalCalculado,
      };

      const res = await fetch(`${apiBase}/compras`, {
        method: "POST",
        headers: makeHeadersJson(session),
        body: JSON.stringify(body),
      });

      const payload = await jsonOrNull(res);
      if (!res.ok) {
        const msg = payload?.message || payload?.msg || payload?.error || "Error al crear compra";
        throw new Error(msg);
      }

      setOkMsg(`Compra creada ✅ (N° ${payload?.numero ?? "-"})`);

      // reset
      setEstado("ORDEN_COMPRA");
      setCotizacionId("");
      setItems([{ producto_id: "", item: "", cantidad: 1, precio_unit: 0 }]);

      await onCreated?.();
    } catch (e2) {
      setFormErr(e2?.message || "Error");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Crear compra (manual)">
      <form onSubmit={handleCreate} className="space-y-4">
        <p className="text-sm text-slate-600">
          Esto es opcional. La mayoría de compras se importarán desde el CSV del SII (RCV).
        </p>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <label className="text-sm font-medium">Estado</label>
            <select
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
            >
              <option value="ORDEN_COMPRA">ORDEN_COMPRA</option>
              <option value="FACTURADA">FACTURADA</option>
              <option value="PAGADA">PAGADA</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">Proveedor (opcional)</label>
            <select
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={proveedorId}
              onChange={(e) => setProveedorId(e.target.value)}
              disabled={lookupsLoading || proveedores.length === 0}
            >
              <option value="">
                {proveedores.length ? "— Sin proveedor —" : "No hay proveedores"}
              </option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} {p.rut ? `(${p.rut})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">Proyecto (opcional)</label>
            <select
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={proyectoId}
              onChange={(e) => setProyectoId(e.target.value)}
              disabled={lookupsLoading || proyectos.length === 0}
            >
              <option value="">
                {proyectos.length ? "— Sin proyecto —" : "No hay proyectos"}
              </option>
              {proyectos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">Cotización (opcional)</label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={cotizacionId}
              onChange={(e) => setCotizacionId(e.target.value)}
              placeholder="cuid cotización (manual)"
            />
          </div>
        </div>

        <div className="rounded-xl border p-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Items</div>
            <button
              type="button"
              className="h-9 rounded-lg border px-3 text-sm hover:bg-slate-50"
              onClick={addItem}
            >
              + Agregar item
            </button>
          </div>

          <div className="mt-3 space-y-3">
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-1 gap-2 md:grid-cols-12 items-end">
                <div className="md:col-span-4">
                  <label className="text-xs text-slate-600">Producto (opcional)</label>
                  <select
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={it.producto_id}
                    onChange={(e) => setItemField(i, "producto_id", e.target.value)}
                    disabled={lookupsLoading || productos.length === 0}
                  >
                    <option value="">
                      {productos.length ? "— Sin producto —" : "No hay productos"}
                    </option>
                    {productos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} {p.sku ? `(${p.sku})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-3">
                  <label className="text-xs text-slate-600">Item (texto libre)</label>
                  <input
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={it.item}
                    onChange={(e) => setItemField(i, "item", e.target.value)}
                    placeholder="Ej: Flete, Tornillos…"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs text-slate-600">Cantidad</label>
                  <input
                    type="number"
                    min="0"
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={it.cantidad}
                    onChange={(e) => setItemField(i, "cantidad", e.target.value)}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs text-slate-600">Precio unit</label>
                  <input
                    type="number"
                    min="0"
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={it.precio_unit}
                    onChange={(e) => setItemField(i, "precio_unit", e.target.value)}
                  />
                </div>

                <div className="md:col-span-1 flex md:justify-end">
                  <button
                    type="button"
                    className="h-9 w-10 rounded-lg border text-sm hover:bg-slate-50 disabled:opacity-50"
                    onClick={() => removeItem(i)}
                    disabled={items.length === 1}
                    title={items.length === 1 ? "Debe existir al menos 1 item" : "Eliminar"}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between border-t pt-3">
            <div className="text-sm text-slate-600">
              Total calculado:{" "}
              <b className="text-slate-900">{totalCalculado.toLocaleString("es-CL")}</b>
            </div>

            <button
              type="submit"
              className="h-10 rounded-lg bg-slate-900 px-4 text-sm text-white hover:opacity-90 disabled:opacity-60"
              disabled={creating || !session}
            >
              {creating ? "Creando…" : "Crear compra"}
            </button>
          </div>
        </div>

        {formErr && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {formErr}
          </div>
        )}

        {okMsg && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            {okMsg}
          </div>
        )}
      </form>
    </Modal>
  );
}
