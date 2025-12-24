"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

const API = process.env.NEXT_PUBLIC_API_URL;

function makeHeaders(session) {
  const token = session?.user?.accessToken || "";
  const empresaId = session?.user?.empresaId ?? null;

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(empresaId ? { "x-empresa-id": String(empresaId) } : {}),
  };
}

async function jsonOrNull(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function calcTotal(items) {
  return (items || []).reduce((acc, it) => {
    const c = Number(it.cantidad || 0);
    const p = Number(it.precio_unit || 0);
    return acc + c * p;
  }, 0);
}

export default function ComprasPage() {
  const { data: session, status } = useSession();

  // ===== Listado =====
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  // ===== Lookups (selects) =====
  const [proveedores, setProveedores] = useState([]);
  const [proyectos, setProyectos] = useState([]);
  const [productos, setProductos] = useState([]);

  const [lookupsLoading, setLookupsLoading] = useState(false);
  const [lookupsErr, setLookupsErr] = useState("");

  // ===== Form =====
  const [creating, setCreating] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const [estado, setEstado] = useState("ORDEN_COMPRA");
  const [proveedorId, setProveedorId] = useState(""); // select
  const [proyectoId, setProyectoId] = useState("");   // select
  const [cotizacionId, setCotizacionId] = useState(""); // texto (por ahora)

  // cada item ahora usa producto_id desde select (cuid automatico)
  const [items, setItems] = useState([
    { producto_id: "", item: "", cantidad: 1, precio_unit: 0 },
  ]);

  const totalCalculado = useMemo(() => calcTotal(items), [items]);

  // ===== Load listado =====
  async function loadCompras() {
    if (status === "loading") return;
    if (!session) {
      setErr("No hay sesión. Inicia sesión para ver compras.");
      return;
    }

    try {
      setLoading(true);
      setErr("");

      const res = await fetch(`${API}/compras?page=1&pageSize=20`, {
        headers: makeHeaders(session),
      });

      const payload = await jsonOrNull(res);
      if (!res.ok) {
        const msg = payload?.message || payload?.msg || "Error al cargar compras";
        throw new Error(msg);
      }

      setData(payload);
    } catch (e) {
      setErr(e.message || "Error");
    } finally {
      setLoading(false);
    }
  }

  // ===== Load selects =====
  async function loadLookups() {
    if (status === "loading") return;
    if (!session) return;

    try {
      setLookupsLoading(true);
      setLookupsErr("");

      // Intentamos con pageSize grande para tener selects útiles
      const [rProv, rProy, rProd] = await Promise.all([
        fetch(`${API}/proveedores?page=1&pageSize=200`, { headers: makeHeaders(session) }),
        fetch(`${API}/proyectos?page=1&pageSize=200`, { headers: makeHeaders(session) }),
        fetch(`${API}/productos?page=1&pageSize=200`, { headers: makeHeaders(session) }),
      ]);

      const [pProv, pProy, pProd] = await Promise.all([
        jsonOrNull(rProv),
        jsonOrNull(rProy),
        jsonOrNull(rProd),
      ]);

      // si alguno falla, no matamos todo: solo avisamos
      if (!rProv.ok) throw new Error(pProv?.message || pProv?.msg || "Error al cargar proveedores");
      if (!rProy.ok) throw new Error(pProy?.message || pProy?.msg || "Error al cargar proyectos");
      if (!rProd.ok) throw new Error(pProd?.message || pProd?.msg || "Error al cargar productos");

      // tus list endpoints suelen devolver {data:[...]} o directamente []
      const provArr = Array.isArray(pProv) ? pProv : (pProv?.data || []);
      const proyArr = Array.isArray(pProy) ? pProy : (pProy?.data || []);
      const prodArr = Array.isArray(pProd) ? pProd : (pProd?.data || []);

      setProveedores(provArr);
      setProyectos(proyArr);
      setProductos(prodArr);

      // defaults suaves si hay data
      if (!proveedorId && provArr.length) setProveedorId(provArr[0].id);
      if (!proyectoId && proyArr.length) setProyectoId(proyArr[0].id);
    } catch (e) {
      setLookupsErr(e.message || "Error en lookups");
    } finally {
      setLookupsLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await Promise.all([loadCompras(), loadLookups()]);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status]);

  function setItemField(index, key, value) {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [key]: value };
      return copy;
    });
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      { producto_id: "", item: "", cantidad: 1, precio_unit: 0 },
    ]);
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
          // producto_id ya viene de select (cuid automático)
          producto_id: it.producto_id?.trim() || undefined,
          item: it.item?.trim() || undefined,
          cantidad: Number(it.cantidad || 0),
          precio_unit: Number(it.precio_unit || 0),
        }))
        .filter((it) => (it.producto_id || it.item) && it.cantidad > 0);

      if (cleanItems.length === 0) {
        setFormErr("Agrega al menos 1 ítem (elige un producto o escribe item), y cantidad > 0.");
        return;
      }

      const body = {
        estado,
        proveedorId: proveedorId || undefined,
        proyecto_id: proyectoId || undefined,
        cotizacionId: cotizacionId.trim() || undefined,
        items: cleanItems,
        total: totalCalculado, // backend puede recalcular, esto es solo para test
      };

      const res = await fetch(`${API}/compras`, {
        method: "POST",
        headers: makeHeaders(session),
        body: JSON.stringify(body),
      });

      const payload = await jsonOrNull(res);
      if (!res.ok) {
        const msg = payload?.message || payload?.msg || "Error al crear compra";
        throw new Error(msg);
      }

      setOkMsg(`Compra creada ✅ (N° ${payload?.numero ?? "-"} | ID ${payload?.id ?? "ok"})`);

      // reset básico
      setEstado("ORDEN_COMPRA");
      setCotizacionId("");
      setItems([{ producto_id: "", item: "", cantidad: 1, precio_unit: 0 }]);

      await loadCompras();
    } catch (e2) {
      setFormErr(e2.message || "Error");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Compras</h1>
        <p className="text-sm text-gray-500">
          La <b>empresa</b> se asigna automáticamente por el token/scope del usuario (y opcionalmente con{" "}
          <code>x-empresa-id</code>).
        </p>

        <div className="mt-4 flex gap-2">
          <button
            className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
            onClick={async () => {
              await Promise.all([loadCompras(), loadLookups()]);
            }}
            disabled={loading || lookupsLoading}
          >
            {(loading || lookupsLoading) ? "Cargando…" : "Recargar"}
          </button>
        </div>

        {err && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {err}
          </div>
        )}
      </div>

      {/* ===== LOOKUPS STATUS ===== */}
      {lookupsErr && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {lookupsErr} (igual puedes crear compras con “item” texto libre)
        </div>
      )}

      {/* ===== FORM CREATE ===== */}
      <div className="rounded-md border p-4">
        <h2 className="text-lg font-semibold">Crear compra</h2>
        <p className="text-sm text-gray-500">
          Proyecto / Proveedor / Productos se cargan automáticamente (si existen).
        </p>

        <form onSubmit={handleCreate} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
              <label className="text-sm font-medium">Estado</label>
              <select
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
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
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
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
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
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
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                value={cotizacionId}
                onChange={(e) => setCotizacionId(e.target.value)}
                placeholder="cuid cotizacion (por ahora manual)"
              />
            </div>
          </div>

          <div className="rounded-md border p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Items</div>
              <button
                type="button"
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
                onClick={addItem}
              >
                + Agregar item
              </button>
            </div>

            <div className="mt-3 space-y-3">
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-1 gap-2 md:grid-cols-12 items-end">
                  {/* Producto select (cuid automático) */}
                  <div className="md:col-span-4">
                    <label className="text-xs text-gray-600">Producto (opcional)</label>
                    <select
                      className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                      value={it.producto_id}
                      onChange={(e) => setItemField(i, "producto_id", e.target.value)}
                      disabled={lookupsLoading || productos.length === 0}
                      title={productos.length ? "Selecciona un producto" : "No hay productos"}
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

                    <div className="mt-1 text-[11px] text-gray-500">
                      ID (cuid) se asigna automáticamente al seleccionar.
                    </div>
                  </div>

                  {/* Texto libre alternativo */}
                  <div className="md:col-span-3">
                    <label className="text-xs text-gray-600">Item (texto libre, opcional)</label>
                    <input
                      className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                      value={it.item}
                      onChange={(e) => setItemField(i, "item", e.target.value)}
                      placeholder="Ej: Flete, Tornillos..."
                    />
                    <div className="mt-1 text-[11px] text-gray-500">
                      Usa esto si no seleccionas producto.
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-600">Cantidad</label>
                    <input
                      type="number"
                      min="0"
                      className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                      value={it.cantidad}
                      onChange={(e) => setItemField(i, "cantidad", e.target.value)}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-600">Precio unit</label>
                    <input
                      type="number"
                      min="0"
                      className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                      value={it.precio_unit}
                      onChange={(e) => setItemField(i, "precio_unit", e.target.value)}
                    />
                  </div>

                  <div className="md:col-span-1 flex gap-2 md:justify-end">
                    <button
                      type="button"
                      className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
                      onClick={() => removeItem(i)}
                      disabled={items.length === 1}
                      title={items.length === 1 ? "Debe existir al menos 1 item" : "Eliminar item"}
                    >
                      🗑️
                    </button>
                  </div>

                  <div className="md:col-span-12 text-xs text-gray-500">
                    Subtotal:{" "}
                    <b>
                      {(Number(it.cantidad || 0) * Number(it.precio_unit || 0)).toLocaleString("es-CL")}
                    </b>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between border-t pt-3">
              <div className="text-sm text-gray-600">
                Total calculado:{" "}
                <b className="text-gray-900">{totalCalculado.toLocaleString("es-CL")}</b>
              </div>

              <button
                type="submit"
                className="rounded-md bg-black px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-60"
                disabled={creating || !session}
              >
                {creating ? "Creando..." : "Crear compra"}
              </button>
            </div>
          </div>

          {formErr && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {formErr}
            </div>
          )}
          {okMsg && (
            <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              {okMsg}
            </div>
          )}
        </form>
      </div>

      {/* ===== LISTADO ===== */}
      {loading && <div className="text-sm">Cargando listado…</div>}

      {data && (
        <div>
          <div className="text-sm text-gray-600">
            Total: <b>{data.total ?? 0}</b> · Página: <b>{data.page ?? 1}</b>
          </div>

          <div className="mt-3 overflow-auto rounded-md border">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">N°</th>
                  <th className="px-3 py-2 text-left">Estado</th>
                  <th className="px-3 py-2 text-left">Proyecto</th>
                  <th className="px-3 py-2 text-left">Proveedor</th>
                  <th className="px-3 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {(data.data || []).map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="px-3 py-2">{c.numero ?? "-"}</td>
                    <td className="px-3 py-2">{c.estado ?? "-"}</td>
                    <td className="px-3 py-2">{c.proyecto?.nombre ?? "-"}</td>
                    <td className="px-3 py-2">{c.proveedor?.nombre ?? "-"}</td>
                    <td className="px-3 py-2 text-right">
                      {typeof c.total === "number" ? c.total.toLocaleString("es-CL") : c.total ?? "-"}
                    </td>
                  </tr>
                ))}

                {(!data.data || data.data.length === 0) && (
                  <tr>
                    <td className="px-3 py-6 text-center text-gray-500" colSpan={5}>
                      Sin compras
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <pre className="mt-4 rounded-md border bg-gray-50 p-3 text-xs overflow-auto">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
