"use client";

import React, { useState, useEffect } from "react";
import ModalBase from "./ModalBase";

export default function CompraManualModal({
  open,
  onClose,
  onSuccess,
  API,
  session,
  proveedores = [],
  proyectos = [],
  lookupsLoading = false,
  onAddProveedorClick,
}) {
  // --- Estados del formulario principal ---
  const [proveedorId, setProveedorId] = useState("");
  const [destino, setDestino] = useState("PROYECTO");
  const [centroCosto, setCentroCosto] = useState("");
  const [proyectoId, setProyectoId] = useState("");
  const [tipoDoc, setTipoDoc] = useState("33"); // 33: Factura Electrónica, etc.
  const [folio, setFolio] = useState("");
  const [fechaDocto, setFechaDocto] = useState("");
  const [fechaEntregaEsperada, setFechaEntregaEsperada] = useState("");
  const [moneda, setMoneda] = useState("CLP");
  const [condicionPago, setCondicionPago] = useState("");
  const [condicionEntrega, setCondicionEntrega] = useState("");
  const [estadoPago, setEstadoPago] = useState("ORDEN_COMPRA");
  const [observaciones, setObservaciones] = useState("");
  const [terminosCondiciones, setTerminosCondiciones] = useState("");

  // Lista de items de la orden de compra
  const [items, setItems] = useState([]);

  // Búsqueda de cotizaciones internas
  const [buscarCotizacionQ, setBuscarCotizacionQ] = useState("");
  const [cotizacionesList, setCotizacionesList] = useState([]);
  const [todasLasCotizaciones, setTodasLasCotizaciones] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [cotizacionSel, setCotizacionSel] = useState(null);
  const [itemsCotizacionInterna, setItemsCotizacionInterna] = useState([]);
  const [cargandoCotizacionInterna, setCargandoCotizacionInterna] = useState(false);

  // Guardado definitivo
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // --- Resetear estados al abrir ---
  useEffect(() => {
    if (open) {
      setErrorMsg("");
      setItems([]);
      setProveedorId("");
      setDestino("PROYECTO");
      setCentroCosto("");
      setProyectoId("");
      setTipoDoc("33");
      setFolio("");
      setFechaDocto(new Date().toISOString().split("T")[0]);
      setFechaEntregaEsperada("");
      setMoneda("CLP");
      setCondicionPago("");
      setCondicionEntrega("");
      setEstadoPago("ORDEN_COMPRA");
      setObservaciones("");
      setTerminosCondiciones("");
      setBuscarCotizacionQ("");
      setCotizacionesList([]);
      setTodasLasCotizaciones([]);
      setShowDropdown(false);
      setCotizacionSel(null);
      setItemsCotizacionInterna([]);
    }
  }, [open]);

  // --- Auto-seleccionar nuevo proveedor si se agrega a la lista ---
  const prevProvIds = React.useRef(proveedores.map((p) => p.id));
  useEffect(() => {
    const currentIds = proveedores.map((p) => p.id);
    if (currentIds.length > prevProvIds.current.length) {
      const addedId = currentIds.find((id) => !prevProvIds.current.includes(id));
      if (addedId) {
        setProveedorId(addedId);
      }
    }
    prevProvIds.current = currentIds;
  }, [proveedores]);

  // --- Cargar cotizaciones al abrir o cambiar sesión ---
  useEffect(() => {
    if (!open) return;
    const cargarTodasCotizaciones = async () => {
      try {
        const headers = {
          Authorization: `Bearer ${session?.token}`,
          "x-empresa-id": session?.empresaId || "",
        };
        const res = await fetch(`${API}/cotizaciones?estado=ACEPTADA`, { headers });
        if (res.ok) {
          const data = await res.json();
          setTodasLasCotizaciones(data);
          setCotizacionesList(data);
        }
      } catch (err) {
        console.error("Error cargando cotizaciones:", err);
      }
    };
    cargarTodasCotizaciones();
  }, [open, API, session]);

  // --- Filtrar cotizaciones localmente según la búsqueda ---
  useEffect(() => {
    const q = String(buscarCotizacionQ || "").toLowerCase().trim();
    if (!q) {
      setCotizacionesList(todasLasCotizaciones);
      return;
    }
    const filtered = todasLasCotizaciones.filter(
      (c) =>
        String(c.numero).includes(q) ||
        String(c.cliente?.nombre || "").toLowerCase().includes(q) ||
        String(c.proyecto?.nombre || "").toLowerCase().includes(q)
    );
    setCotizacionesList(filtered);
  }, [buscarCotizacionQ, todasLasCotizaciones]);

  // --- Cargar items de cotización interna seleccionada ---
  const handleSelectCotizacionInterna = async (cot) => {
    setCotizacionSel(cot);
    setBuscarCotizacionQ("");
    setCotizacionesList([]);
    setCargandoCotizacionInterna(true);
    setItemsCotizacionInterna([]);

    try {
      const headers = {
        Authorization: `Bearer ${session?.token}`,
        "x-empresa-id": session?.empresaId || "",
      };
      const res = await fetch(
        `${API}/compras/items-costeo-disponibles?cotizacionIds=${cot.id}`,
        { headers }
      );
      if (res.ok) {
        const data = await res.json();
        setItemsCotizacionInterna(
          data.map((x) => ({
            id: x.id,
            descripcion: x.descripcion,
            cantidad: x.cantidad,
            precioUnitario: x.costoUnitario || x.total / (x.cantidad || 1),
            totalLinea: x.costoTotal || x.total,
            selected: false,
          }))
        );
      } else {
        const errorText = await res.text();
        console.error("Error obteniendo items de costeo:", errorText);
      }
    } catch (err) {
      console.error("Error al obtener items de cotización:", err);
    } finally {
      setCargandoCotizacionInterna(false);
    }
  };

  // --- Agregar items seleccionados de la cotización interna ---
  const agregarItemsCotizacionInterna = () => {
    const seleccionados = itemsCotizacionInterna.filter((it) => it.selected);
    if (seleccionados.length === 0) return;

    const nuevosItems = seleccionados.map((it) => ({
      id: `internal-${Date.now()}-${Math.random()}`,
      codigo: "",
      descripcion: it.descripcion,
      cantidad: it.cantidad,
      unidad: "Uni",
      precioUnitario: it.precioUnitario,
      descuento: 0,
      impuesto: null,
      totalLinea: it.totalLinea,
      detalleVentaId: it.id,
      origen: "Cotización Interna",
    }));

    setItems((prev) => [...prev, ...nuevosItems]);
    setItemsCotizacionInterna([]);
    setCotizacionSel(null);
  };

  // --- Acciones de la Tabla de Ítems ---
  const handleItemChange = (itemId, field, value) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const updated = { ...it, [field]: value };
        
        if (["precioUnitario", "cantidad", "descuento"].includes(field)) {
          const qty = Number(updated.cantidad || 0);
          const price = Number(updated.precioUnitario || 0);
          const desc = Number(updated.descuento || 0);
          updated.totalLinea = qty * price - desc;
        }
        return updated;
      })
    );
  };

  const handleRemoveItem = (itemId) => {
    setItems((prev) => prev.filter((it) => it.id !== itemId));
  };

  const handleAddItemManual = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `manual-${Date.now()}-${Math.random()}`,
        codigo: "",
        descripcion: "",
        cantidad: 1,
        unidad: "Uni",
        precioUnitario: 0,
        descuento: 0,
        impuesto: null,
        totalLinea: 0,
        origen: "Manual",
      },
    ]);
  };

  // --- Cálculos de Totales ---
  const calculatedSubtotal = items.reduce((sum, it) => sum + Number(it.totalLinea || 0), 0);
  const calculatedDescuento = items.reduce((sum, it) => sum + Number(it.descuento || 0), 0);
  const isCLP = moneda === "CLP";
  const calculatedImpuestos = items.reduce((sum, it) => {
    const hasCustomImpuesto = it.impuesto !== null && it.impuesto !== undefined && it.impuesto !== "";
    const defaultTax = isCLP ? (Number(it.totalLinea || 0) * 0.19) : 0;
    const taxVal = hasCustomImpuesto ? Number(it.impuesto) : defaultTax;
    return sum + (isNaN(taxVal) ? 0 : taxVal);
  }, 0);
  const calculatedTotal = calculatedSubtotal + calculatedImpuestos;

  // --- Validación del Formulario ---
  const validateForm = () => {
    if (!proveedorId) return "Debe seleccionar un proveedor.";
    if (destino === "PROYECTO" && !proyectoId) return "Debe seleccionar un proyecto para este destino.";
    if (destino !== "PROYECTO" && !centroCosto) return "Debe seleccionar el centro de costo.";
    if (items.length === 0) return "La orden de compra debe contener al menos un ítem.";
    
    for (const it of items) {
      if (!it.descripcion || !it.descripcion.trim()) return "Todos los ítems deben tener una descripción.";
      if (Number(it.cantidad) <= 0) return "La cantidad de todos los ítems debe ser mayor a 0.";
      if (Number(it.precioUnitario) < 0) return "El precio unitario no puede ser negativo.";
    }

    return null;
  };

  // --- Guardar en la base de datos ---
  const handleConfirmar = async (estadoOcDestino) => {
    const error = validateForm();
    if (error) {
      alert(error);
      return;
    }

    setSaving(true);
    setErrorMsg("");
    try {
      const payload = {
        proveedorId,
        destino,
        centro_costo: destino !== "PROYECTO" ? centroCosto : null,
        proyecto_id: destino === "PROYECTO" ? proyectoId : null,
        cotizacionId: cotizacionSel?.id || null,
        tipo_doc: Number(tipoDoc),
        folio,
        fecha_docto: new Date(fechaDocto).toISOString(),
        fecha_entrega_esperada: fechaEntregaEsperada ? new Date(fechaEntregaEsperada).toISOString() : null,
        moneda,
        subtotal: calculatedSubtotal,
        descuento: calculatedDescuento,
        impuestos: calculatedImpuestos,
        total: calculatedTotal,
        estado: estadoPago, // Estado de pago ("ORDEN_COMPRA", "FACTURADA", "PAGADA")
        estado_oc: estadoOcDestino, // "BORRADOR" o "CONFIRMADA"
        observaciones,
        terminos_condiciones: terminosCondiciones,
        items: items.map((it) => ({
          codigo: it.codigo,
          descripcion: it.descripcion,
          cantidad: Number(it.cantidad),
          unidad: it.unidad,
          precio_unit: Number(it.precioUnitario),
          descuento: Number(it.descuento),
          impuesto: Number(it.impuesto),
          totalLinea: Number(it.totalLinea),
          detalleVentaId: it.detalleVentaId || null,
        })),
      };

      const res = await fetch(`${API}/compras/ordenes-compra`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.token}`,
          "x-empresa-id": session?.empresaId || "",
        },
        body: JSON.stringify(payload),
      });

      const payloadRes = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payloadRes.error || "Error al registrar la orden de compra.");
      }

      onSuccess?.(payloadRes);
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "Error al guardar la orden de compra.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalBase
      open={open}
      onClose={onClose}
      title=""
      hideHeader={true}
      className="max-w-6xl"
    >
      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        rel="stylesheet"
      />

      {/* HEADER */}
      <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-t-2xl">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-indigo-400 bg-indigo-500/10 p-2 rounded-lg text-2xl">
            shopping_cart_checkout
          </span>
          <div>
            <h1 className="text-xl font-bold">Crear compra manual</h1>
            <p className="text-slate-400 text-xs mt-0.5">
              Ingrese los detalles generales, asocie cotizaciones internas del ERP y defina los ítems de compra.
            </p>
          </div>
        </div>
      </div>

      <div className="max-h-[78vh] overflow-y-auto p-8 bg-slate-50/50">
        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
            <span className="material-symbols-outlined text-lg">error</span>
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* PANEL IZQUIERDO: DETALLES DE IMPUTACIÓN Y PROVEEDOR */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            {/* 1. Proveedor */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200 flex flex-col gap-4">
              <div className="flex items-center gap-2 text-[#1e3a8a] font-bold border-b border-slate-100 pb-3">
                <span className="material-symbols-outlined">store</span>
                <span>1. Datos del Proveedor</span>
              </div>
              
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">Seleccionar Proveedor *</label>
                  <button
                    type="button"
                    onClick={onAddProveedorClick}
                    className="text-[10px] font-bold text-[#1e3a8a] hover:underline"
                  >
                    ＋ CREAR NUEVO
                  </button>
                </div>
                <select
                  className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] text-xs transition-all"
                  value={proveedorId}
                  onChange={(e) => setProveedorId(e.target.value)}
                  required
                >
                  <option value="">Seleccione proveedor</option>
                  {proveedores.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} {p.rut ? `(${p.rut})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 2. Imputación / Destino */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200 flex flex-col gap-4">
              <div className="flex items-center gap-2 text-[#1e3a8a] font-bold border-b border-slate-100 pb-3">
                <span className="material-symbols-outlined">location_on</span>
                <span>2. Destino e Imputación</span>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-700">Destino Principal *</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {[
                    { val: "PROYECTO", lab: "Proyecto", icon: "construction" },
                    { val: "TALLER", lab: "Taller", icon: "precision_manufacturing" },
                    { val: "ADMINISTRACION", lab: "Admin", icon: "corporate_fare" }
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => {
                        setDestino(opt.val);
                        if (opt.val !== "PROYECTO") setProyectoId("");
                        else setCentroCosto("");
                      }}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all cursor-pointer ${
                        destino === opt.val
                          ? "bg-indigo-50/70 text-[#1e3a8a] border-[#1e3a8a] shadow-sm font-bold"
                          : "bg-slate-50 text-slate-600 border-transparent hover:border-slate-200"
                      }`}
                    >
                      <span
                        className="material-symbols-outlined mb-1 text-lg"
                        style={{ fontVariationSettings: destino === opt.val ? "'FILL' 1" : "" }}
                      >
                        {opt.icon}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-tight">{opt.lab}</span>
                    </button>
                  ))}
                </div>
              </div>

              {destino === "PROYECTO" ? (
                <div className="flex flex-col gap-1.5 mt-2">
                  <label className="text-xs font-bold text-slate-700">Proyecto *</label>
                  <select
                    className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:border-[#1e3a8a] text-xs transition-all"
                    value={proyectoId}
                    onChange={(e) => setProyectoId(e.target.value)}
                    required={destino === "PROYECTO"}
                  >
                    <option value="">Seleccione proyecto</option>
                    {proyectos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5 mt-2">
                  <label className="text-xs font-bold text-slate-700">Centro de Costo *</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {["PMC", "PUQ"].map((cc) => (
                      <button
                        key={cc}
                        type="button"
                        onClick={() => setCentroCosto(cc)}
                        className={`py-2.5 rounded-lg text-xs font-bold transition-all border-2 cursor-pointer ${
                          centroCosto === cc
                            ? "bg-[#1e3a8a] text-white border-[#1e3a8a]"
                            : "bg-slate-50 text-slate-600 border-transparent hover:border-slate-200"
                        }`}
                      >
                        {cc === "PMC" ? "Puerto Montt" : "Punta Arenas"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* PANEL DERECHO: DATOS DE COTIZACIÓN E ÍTEMS */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* 3. Datos Documento */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200 flex flex-col gap-4">
              <div className="flex items-center gap-2 text-[#1e3a8a] font-bold border-b border-slate-100 pb-3">
                <span className="material-symbols-outlined">receipt_long</span>
                <span>3. Datos del Documento</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700">Tipo Documento *</label>
                  <select
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-900"
                    value={tipoDoc}
                    onChange={(e) => setTipoDoc(e.target.value)}
                    required
                  >
                    <option value="33">Factura Electrónica (33)</option>
                    <option value="61">Nota de Crédito (61)</option>
                    <option value="56">Nota de Débito (56)</option>
                    <option value="34">Factura Exenta (34)</option>
                    <option value="39">Boleta Electrónica (39)</option>
                    <option value="99">Documento Manual / OC (99)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700">Folio / N° Documento</label>
                  <input
                    type="text"
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-900"
                    value={folio}
                    onChange={(e) => setFolio(e.target.value)}
                    placeholder="Ej: 125489"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700">Fecha del Documento *</label>
                  <input
                    type="date"
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-900"
                    value={fechaDocto}
                    onChange={(e) => setFechaDocto(e.target.value)}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700">Fecha de Entrega Esperada</label>
                  <input
                    type="date"
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-900"
                    value={fechaEntregaEsperada}
                    onChange={(e) => setFechaEntregaEsperada(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700">Moneda *</label>
                  <select
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-900"
                    value={moneda}
                    onChange={(e) => setMoneda(e.target.value)}
                    required
                  >
                    <option value="CLP">CLP ($)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700">Estado de Pago *</label>
                  <select
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-900"
                    value={estadoPago}
                    onChange={(e) => setEstadoPago(e.target.value)}
                    required
                  >
                    <option value="ORDEN_COMPRA">ORDEN_COMPRA</option>
                    <option value="FACTURADA">FACTURADA</option>
                    <option value="PAGADA">PAGADA</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700">Condición de Pago</label>
                  <input
                    type="text"
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-900"
                    value={condicionPago}
                    onChange={(e) => setCondicionPago(e.target.value)}
                    placeholder="Ej: 30 días contra factura"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700">Condición de Entrega</label>
                  <input
                    type="text"
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-900"
                    value={condicionEntrega}
                    onChange={(e) => setCondicionEntrega(e.target.value)}
                    placeholder="Ej: EXW, FOB, CIF"
                  />
                </div>
              </div>
            </div>

            {/* 4. Vinculación con Cotización Interna */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200 flex flex-col gap-4">
              <div className="flex items-center gap-2 text-[#1e3a8a] font-bold border-b border-slate-100 pb-3">
                <span className="material-symbols-outlined">link</span>
                <span>4. Vincular Ítems de Cotización Interna</span>
              </div>

              <div className="relative">
                <label className="text-xs font-bold text-slate-700 block mb-1">Buscar Cotización Aceptada del ERP</label>
                <input
                  type="text"
                  className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] outline-none"
                  value={buscarCotizacionQ}
                  onChange={(e) => setBuscarCotizacionQ(e.target.value)}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 250)}
                  placeholder="Haga clic para ver la lista o escriba para buscar..."
                />

                {/* Resultados de Búsqueda */}
                {showDropdown && (
                  <div className="absolute left-0 right-0 z-50 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {cotizacionesList.length > 0 ? (
                      cotizacionesList.map((cot) => (
                        <button
                          key={cot.id}
                          type="button"
                          onClick={() => handleSelectCotizacionInterna(cot)}
                          className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 border-b border-slate-100 text-xs flex justify-between items-center transition-colors"
                        >
                          <div>
                            <p className="font-bold text-slate-900">Cotización #{cot.numero}</p>
                            <p className="text-slate-500 text-[10px]">Cliente: {cot.cliente?.nombre || "—"}</p>
                          </div>
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                            Aceptada
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="p-4 text-center text-slate-400 text-xs italic">
                        No se encontraron cotizaciones aceptadas.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Detalle Cotización Interna Seleccionada */}
              {cotizacionSel && (
                <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#1e3a8a]">
                      Cotización #{cotizacionSel.numero} seleccionada
                    </span>
                    <button
                      type="button"
                      className="text-xs text-red-600 font-bold hover:underline"
                      onClick={() => {
                        setCotizacionSel(null);
                        setItemsCotizacionInterna([]);
                      }}
                    >
                      Quitar
                    </button>
                  </div>

                  {cargandoCotizacionInterna ? (
                    <p className="text-xs text-slate-500 italic">Cargando costeos...</p>
                  ) : itemsCotizacionInterna.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      <p className="text-[10px] font-bold text-slate-600">
                        Marque los materiales/costeos que desea importar a la Orden de Compra:
                      </p>
                      <div className="max-h-40 overflow-y-auto flex flex-col gap-1.5 border border-slate-100 p-2 rounded-lg bg-white">
                        {itemsCotizacionInterna.map((it) => (
                          <label
                            key={it.id}
                            className="flex items-start gap-2.5 p-1.5 hover:bg-slate-50 rounded cursor-pointer text-xs"
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5 rounded border-slate-300 text-indigo-600"
                              checked={it.selected}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setItemsCotizacionInterna((prev) =>
                                  prev.map((x) => (x.id === it.id ? { ...x, selected: checked } : x))
                                );
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-800 truncate">{it.descripcion}</p>
                              <p className="text-[10px] text-slate-500">
                                Cant: {it.cantidad} | Costo Unit: {moneda} {it.precioUnitario.toLocaleString()}
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={agregarItemsCotizacionInterna}
                        className="mt-2 w-full py-2 bg-[#1e3a8a] text-white font-bold rounded-lg text-xs hover:bg-[#1e3a8a]/90 transition-all"
                      >
                        Agregar seleccionados
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 font-medium">No hay costeos de compra pendientes en esta cotización o ya han sido asociados.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* TABLA DE DETALLE DE ITEMS */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 flex flex-col gap-4 mt-8">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-[#1e3a8a] font-bold">
              <span className="material-symbols-outlined">list_alt</span>
              <span>5. Ítems y Detalles de la Orden de Compra</span>
            </div>
            <button
              type="button"
              onClick={handleAddItemManual}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-xs">add</span>
              Agregar manual
            </button>
          </div>

          {items.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs italic">
              No hay ítems en la orden de compra. Agregue manualmente o importe desde cotizaciones internas de arriba.
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {items.map((it, idx) => (
                <div
                  key={it.id}
                  className="relative bg-slate-50/70 hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl p-5 pt-8 md:pt-5 transition-all flex flex-col gap-4"
                >
                  {/* Botón Eliminar Absoluto */}
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(it.id)}
                    className="absolute top-3 right-3 text-slate-400 hover:text-red-600 transition-colors p-1.5 hover:bg-slate-100 rounded-lg flex items-center justify-center"
                    title="Eliminar ítem"
                  >
                    <span className="material-symbols-outlined text-lg">delete</span>
                  </button>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    {/* Código */}
                    <div className="md:col-span-2 flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Código
                      </label>
                      <input
                        type="text"
                        className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] outline-none transition-all"
                        value={it.codigo || ""}
                        onChange={(e) => handleItemChange(it.id, "codigo", e.target.value)}
                        placeholder="Ej: 001"
                      />
                    </div>

                    {/* Descripción */}
                    <div className="md:col-span-10 flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Descripción / Detalle del Ítem
                      </label>
                      <textarea
                        rows={2}
                        className="w-full min-h-[40px] py-2 px-3 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] outline-none transition-all resize-y"
                        value={it.descripcion || ""}
                        onChange={(e) => handleItemChange(it.id, "descripcion", e.target.value)}
                        placeholder="Nombre del ítem..."
                      />
                      {it.origen && (
                        <div className="mt-0.5">
                          <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full inline-block">
                            {it.origen}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-12 gap-4">
                    {/* Cantidad */}
                    <div className="md:col-span-2 flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Cantidad
                      </label>
                      <input
                        type="number"
                        className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 text-center focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] outline-none transition-all"
                        value={it.cantidad}
                        onChange={(e) => handleItemChange(it.id, "cantidad", Number(e.target.value))}
                        min="1"
                      />
                    </div>

                    {/* Unidad */}
                    <div className="md:col-span-2 flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Unidad
                      </label>
                      <input
                        type="text"
                        className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 text-center focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] outline-none transition-all"
                        value={it.unidad || ""}
                        onChange={(e) => handleItemChange(it.id, "unidad", e.target.value)}
                        placeholder="Ej: Uni"
                      />
                    </div>

                    {/* Precio Unitario */}
                    <div className="col-span-2 md:col-span-2 flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Precio Unitario
                      </label>
                      <input
                        type="number"
                        className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 text-right focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] outline-none transition-all"
                        value={it.precioUnitario}
                        onChange={(e) => handleItemChange(it.id, "precioUnitario", Number(e.target.value))}
                        min="0"
                      />
                    </div>

                    {/* Descuento */}
                    <div className="md:col-span-2 flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Descuento
                      </label>
                      <input
                        type="number"
                        className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 text-right focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] outline-none transition-all"
                        value={it.descuento || 0}
                        onChange={(e) => handleItemChange(it.id, "descuento", Number(e.target.value))}
                        min="0"
                      />
                    </div>

                    {/* IVA / Imp */}
                    <div className="md:col-span-2 flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        IVA / Imp (%)
                      </label>
                      <input
                        type="number"
                        className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 text-right focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] outline-none transition-all"
                        value={
                          it.impuesto !== null && it.impuesto !== undefined && it.impuesto !== ""
                            ? it.impuesto
                            : Math.round(isCLP ? Number(it.totalLinea || 0) * 0.19 : 0)
                        }
                        onChange={(e) =>
                          handleItemChange(it.id, "impuesto", e.target.value === "" ? null : Number(e.target.value))
                        }
                        min="0"
                      />
                    </div>

                    {/* Total Línea */}
                    <div className="col-span-2 md:col-span-2 flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-[#1e3a8a] uppercase tracking-wider">
                        Total Línea
                      </label>
                      <div className="w-full h-10 px-3 flex items-center justify-end rounded-lg bg-indigo-50/50 border border-indigo-100 text-xs font-bold text-[#1e3a8a]">
                        {moneda} {Number(it.totalLinea || 0).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* TOTALES GENERALES */}
        <div className="p-6 rounded-2xl bg-[#1e3a8a]/5 border-2 border-[#1e3a8a]/10 flex flex-col md:flex-row items-center justify-between gap-6 mt-8">
          <div className="text-center md:text-left">
            <span className="text-xs font-bold text-[#1e3a8a] uppercase tracking-wider block">
              Resumen de Montos
            </span>
            <p className="text-slate-500 text-xs mt-1">
              Los valores se calculan automáticamente basándose en los ítems ingresados.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 justify-center md:justify-end">
            <div className="bg-white border border-slate-200 px-4 py-2.5 rounded-xl text-center">
              <span className="text-[10px] text-slate-400 font-bold block uppercase">Subtotal</span>
              <span className="text-base font-bold text-slate-700">
                {moneda} {calculatedSubtotal.toLocaleString()}
              </span>
            </div>
            <div className="bg-white border border-slate-200 px-4 py-2.5 rounded-xl text-center">
              <span className="text-[10px] text-slate-400 font-bold block uppercase">IVA/Impuestos</span>
              <span className="text-base font-bold text-slate-700">
                {moneda} {calculatedImpuestos.toLocaleString()}
              </span>
            </div>
            <div className="bg-indigo-50 border border-indigo-100 px-5 py-3 rounded-xl text-center">
              <span className="text-[10px] text-indigo-500 font-bold block uppercase">Total General</span>
              <span className="text-xl font-extrabold text-[#1e3a8a]">
                {moneda} {calculatedTotal.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* SECCIÓN MÁS OPCIONES */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Observaciones</label>
            <textarea
              className="w-full p-3 border border-slate-200 rounded-lg text-xs bg-white text-slate-900"
              rows="3"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Instrucciones especiales para el proveedor..."
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Términos y Condiciones</label>
            <textarea
              className="w-full p-3 border border-slate-200 rounded-lg text-xs bg-white text-slate-900"
              rows="3"
              value={terminosCondiciones}
              onChange={(e) => setTerminosCondiciones(e.target.value)}
              placeholder="Lugar de entrega, multas, vigencia de cotización..."
            />
          </div>
        </div>

        {/* BOTONES DE ACCIÓN */}
        <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-end gap-3 mt-8">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="w-full sm:w-auto px-6 py-2.5 rounded-lg text-slate-500 font-semibold hover:bg-slate-100 text-xs transition-colors text-center"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => handleConfirmar("BORRADOR")}
            disabled={saving}
            className="w-full sm:w-auto px-6 py-2.5 rounded-lg border border-[#1e3a8a] text-[#1e3a8a] font-bold hover:bg-[#1e3a8a]/5 text-xs transition-all text-center"
          >
            {saving ? "Guardando..." : "Guardar como borrador"}
          </button>
          <button
            type="button"
            onClick={() => handleConfirmar("CONFIRMADA")}
            disabled={saving}
            className="w-full sm:w-auto px-8 py-2.5 rounded-lg bg-[#1e3a8a] text-white font-bold hover:bg-[#1e3a8a]/90 text-xs transition-all shadow-lg shadow-blue-900/10 text-center"
          >
            {saving ? "Guardando..." : "Crear Orden de Compra"}
          </button>
        </div>
      </div>
    </ModalBase>
  );
}