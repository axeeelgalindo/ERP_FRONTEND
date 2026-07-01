"use client";

import React, { useState, useEffect } from "react";
import ModalBase from "./ModalBase";

export default function CompraProvOllamaModal({
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
  // --- Estados del flujo ---
  const [file, setFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [statusText, setStatusText] = useState("");

  // Datos extraídos por Ollama y editables por el usuario
  const [ollamaData, setOllamaData] = useState(null);

  // Campos del formulario principal
  const [proveedorId, setProveedorId] = useState("");
  const [destino, setDestino] = useState("PROYECTO");
  const [centroCosto, setCentroCosto] = useState("");
  const [proyectoId, setProyectoId] = useState("");
  const [tipoDoc, setTipoDoc] = useState("99"); // 99: Manual, etc.
  const [folio, setFolio] = useState("");
  const [fechaDocto, setFechaDocto] = useState("");
  const [fechaEntregaEsperada, setFechaEntregaEsperada] = useState("");
  const [moneda, setMoneda] = useState("CLP");
  const [condicionPago, setCondicionPago] = useState("");
  const [condicionEntrega, setCondicionEntrega] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [terminosCondiciones, setTerminosCondiciones] = useState("");

  // Archivo guardado temporalmente en backend
  const [archivoUrl, setArchivoUrl] = useState("");
  const [archivoNombre, setArchivoNombre] = useState("");

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

  // --- Resetear estados al abrir ---
  useEffect(() => {
    if (open) {
      setFile(null);
      setAnalyzing(false);
      setErrorMsg("");
      setStatusText("");
      setOllamaData(null);
      setItems([]);
      setProveedorId("");
      setDestino("PROYECTO");
      setCentroCosto("");
      setProyectoId("");
      setTipoDoc("99");
      setFolio("");
      setFechaDocto(new Date().toISOString().split("T")[0]);
      setFechaEntregaEsperada("");
      setMoneda("CLP");
      setCondicionPago("");
      setCondicionEntrega("");
      setObservaciones("");
      setTerminosCondiciones("");
      setArchivoUrl("");
      setArchivoNombre("");
      setBuscarCotizacionQ("");
      setCotizacionesList([]);
      setTodasLasCotizaciones([]);
      setShowDropdown(false);
      setCotizacionSel(null);
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

  // --- Intentar matchear proveedor por nombre/RUT ---
  useEffect(() => {
    if (ollamaData?.proveedor && proveedores.length > 0) {
      const { nombre, rut } = ollamaData.proveedor;
      const cleanRut = (r) => String(r || "").replace(/[^0-9kK]/g, "").toLowerCase();
      
      // 1. Buscar por RUT
      if (rut) {
        const foundByRut = proveedores.find(
          (p) => cleanRut(p.rut) === cleanRut(rut)
        );
        if (foundByRut) {
          setProveedorId(foundByRut.id);
          return;
        }
      }

      // 2. Buscar por coincidencia de nombre aproximada
      if (nombre) {
        const cleanName = (n) => String(n || "").toLowerCase().trim();
        const foundByName = proveedores.find((p) =>
          cleanName(p.nombre).includes(cleanName(nombre)) || cleanName(nombre).includes(cleanName(p.nombre))
        );
        if (foundByName) {
          setProveedorId(foundByName.id);
          return;
        }
      }
    }
  }, [ollamaData, proveedores]);

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
      // Endpoint que implementamos en el backend
      const res = await fetch(
        `${API}/compras/items-costeo-disponibles?cotizacionIds=${cot.id}`,
        { headers }
      );
      if (res.ok) {
        const data = await res.json();
        // Mapear al formato interno con checkbox marcado false por defecto
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
      impuesto: 0,
      totalLinea: it.totalLinea,
      detalleVentaId: it.id, // Referencia para asociarla al confirmar
      origen: "Cotización Interna",
    }));

    setItems((prev) => [...prev, ...nuevosItems]);
    // Limpiar selección
    setItemsCotizacionInterna([]);
    setCotizacionSel(null);
  };

  // --- Analizar Cotización con Ollama ---
  const handleAnalizar = async () => {
    if (!file) {
      setErrorMsg("Por favor, seleccione un archivo de cotización.");
      return;
    }

    setAnalyzing(true);
    setErrorMsg("");
    setStatusText("Subiendo archivo y procesando texto...");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API}/compras/ordenes-compra/analizar-cotizacion`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session?.token}`,
          "x-empresa-id": session?.empresaId || "",
        },
        body: formData,
      });

      if (!res.ok) {
        const errPayload = await res.json().catch(() => ({}));
        throw new Error(errPayload.detalle || errPayload.error || "Error analizando el archivo.");
      }

      const payload = await res.json();
      setOllamaData(payload);

      // Precargar campos del formulario
      const doc = payload.documentoProveedor || {};
      setFolio(doc.numeroCotizacion || doc.referencia || "");
      if (doc.fechaCotizacion) {
        try {
          setFechaDocto(new Date(doc.fechaCotizacion).toISOString().split("T")[0]);
        } catch {
          setFechaDocto(new Date().toISOString().split("T")[0]);
        }
      }
      if (doc.fechaEntregaEsperada) {
        try {
          setFechaEntregaEsperada(new Date(doc.fechaEntregaEsperada).toISOString().split("T")[0]);
        } catch {}
      }
      setMoneda(doc.moneda || "CLP");
      setCondicionPago(doc.condicionPago || "");
      setCondicionEntrega(doc.condicionEntrega || "");
      setObservaciones(payload.observaciones || "");
      setTerminosCondiciones(
        Array.isArray(payload.terminosCondiciones)
          ? payload.terminosCondiciones.join("\n")
          : ""
      );

      setArchivoUrl(payload.archivoUrl || "");
      setArchivoNombre(payload.archivoNombre || "");

      // Mapear items detectados
      const mappedItems = (payload.items || []).map((it) => ({
        id: `ollama-${Date.now()}-${Math.random()}`,
        codigo: it.codigo || "",
        descripcion: it.descripcion || "Item detectado",
        cantidad: Number(it.cantidad ?? 1),
        unidad: it.unidad || "Uni",
        precioUnitario: Number(it.precioUnitario ?? 0),
        descuento: Number(it.descuento ?? 0),
        impuesto: it.impuesto !== null && it.impuesto !== undefined ? Number(it.impuesto) : null,
        totalLinea: Number(it.totalLinea ?? 0),
        origen: "Detectado por Ollama",
      }));
      setItems(mappedItems);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "Error al procesar el archivo con Ollama.");
    } finally {
      setAnalyzing(false);
    }
  };

  // --- Continuar manualmente si Ollama falla o no se desea usar ---
  const handleContinuarManualmente = () => {
    setOllamaData({
      proveedor: { nombre: "", rut: "" },
      confianza: { advertencias: ["Flujo iniciado de forma manual."] },
    });
    setFechaDocto(new Date().toISOString().split("T")[0]);
    setItems([]);
  };

  // --- Acciones de la Tabla de Ítems ---
  const handleItemChange = (itemId, field, value) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const updated = { ...it, [field]: value };
        
        // Recalcular totalLinea si cambia precioUnitario, cantidad o descuento
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
    if (destino !== "PROYECTO" && !centroCosto) return "Debe ingresar el centro de costo.";
    if (items.length === 0) return "La orden de compra debe contener al menos un ítem.";
    
    for (const it of items) {
      if (!it.descripcion || !it.descripcion.trim()) return "Todos los ítems deben tener una descripción.";
      if (Number(it.cantidad) <= 0) return "La cantidad de todos los ítems debe ser mayor a 0.";
      if (Number(it.precioUnitario) < 0) return "El precio unitario no puede ser negativo.";
    }

    return null;
  };

  // --- Guardado definitivo en PostgreSQL ---
  const handleConfirmar = async (estadoOcDestino) => {
    const error = validateForm();
    if (error) {
      alert(error);
      return;
    }

    setSaving(true);
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
        estado_oc: estadoOcDestino, // "BORRADOR" o "CONFIRMADA"
        observaciones,
        terminos_condiciones: terminosCondiciones,
        archivo_original: archivoUrl,
        json_original_ollama: ollamaData,
        condicion_pago: condicionPago,
        condicion_entrega: condicionEntrega,
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

      if (!res.ok) {
        const errPayload = await res.json().catch(() => ({}));
        throw new Error(errPayload.error || "Error al registrar la orden de compra.");
      }

      const created = await res.json();
      onSuccess?.(created);
      onClose();
    } catch (err) {
      console.error(err);
      alert(`Error al guardar: ${err.message}`);
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
      {/* HEADER PRINCIPAL */}
      <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-t-2xl">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-indigo-400 bg-indigo-500/10 p-2 rounded-lg text-2xl">
            psychology
          </span>
          <div>
            <h1 className="text-xl font-bold">Crear OC desde Cotización Proveedor</h1>
            <p className="text-slate-400 text-xs mt-0.5">
              Extraiga información automáticamente usando Ollama AI y edite los detalles del borrador.
            </p>
          </div>
        </div>
      </div>

      <div className="max-h-[78vh] overflow-y-auto p-8 bg-slate-50/50">
        {/* FASE 1: UPLOAD DE ARCHIVO */}
        {!ollamaData && (
          <div className="max-w-2xl mx-auto py-8">
            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 bg-white text-center hover:border-indigo-500 transition-colors flex flex-col items-center justify-center gap-4">
              <span className="material-symbols-outlined text-5xl text-slate-400">
                cloud_upload
              </span>
              <div>
                <h3 className="font-semibold text-slate-800">Seleccione la cotización</h3>
                <p className="text-slate-400 text-xs mt-1">
                  Formatos soportados: PDF digital, Excel (.xlsx, .xls), CSV e Imágenes (OCR preparado).
                </p>
              </div>
              <input
                type="file"
                id="quoteFile"
                className="hidden"
                accept=".pdf,.xlsx,.xls,.csv,image/*"
                onChange={(e) => setFile(e.target.files[0])}
              />
              <label
                htmlFor="quoteFile"
                className="px-6 py-2.5 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 transition-colors cursor-pointer text-sm"
              >
                Buscar archivo
              </label>

              {file && (
                <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 px-4 py-2 rounded-lg text-indigo-800 text-sm mt-2">
                  <span className="material-symbols-outlined text-lg">description</span>
                  <span className="font-medium">{file.name}</span>
                  <span className="text-xs text-indigo-500">
                    ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
              )}
            </div>

            {errorMsg && (
              <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
                <span className="material-symbols-outlined text-lg">error</span>
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="mt-8 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={handleContinuarManualmente}
                className="text-slate-600 hover:text-slate-900 font-semibold text-sm hover:underline"
              >
                Continuar sin analizar (Manual)
              </button>

              <button
                type="button"
                onClick={handleAnalizar}
                disabled={analyzing || !file}
                className="px-8 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold rounded-lg shadow-lg hover:from-violet-700 hover:to-indigo-700 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {analyzing ? (
                  <>
                    <span className="animate-spin material-symbols-outlined text-xl">sync</span>
                    <span>Analizando con Ollama...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-xl font-bold">psychology</span>
                    <span>Analizar cotización</span>
                  </>
                )}
              </button>
            </div>

            {analyzing && (
              <div className="mt-8 p-6 bg-white border border-slate-200 rounded-2xl flex flex-col items-center gap-3">
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden relative">
                  <div className="absolute top-0 bottom-0 left-0 bg-indigo-600 animate-pulse w-2/3 rounded-full"></div>
                </div>
                <p className="text-slate-500 text-xs italic">{statusText}</p>
              </div>
            )}
          </div>
        )}

        {/* FASE 2: BORRADOR DE ORDEN DE COMPRA DETECTADO / EDITABLE */}
        {ollamaData && (
          <div className="flex flex-col gap-8">
            {/* Tarjeta de Advertencias / Confianza de Ollama */}
            {ollamaData.confianza && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm flex flex-col gap-2">
                <div className="flex items-center gap-2 font-semibold text-amber-800">
                  <span className="material-symbols-outlined">warning</span>
                  <span>Notas de Confianza y Advertencias del Análisis (Ollama)</span>
                </div>
                {ollamaData.confianza.advertencias && ollamaData.confianza.advertencias.length > 0 ? (
                  <ul className="list-disc list-inside pl-2 text-xs flex flex-col gap-1 text-amber-700">
                    {ollamaData.confianza.advertencias.map((adv, idx) => (
                      <li key={idx}>{adv}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-amber-700">Ollama no reportó ninguna discrepancia de cálculo en el documento.</p>
                )}
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

                  {ollamaData.proveedor?.nombre && (
                    <div className="p-3 bg-slate-50 rounded-lg text-slate-600 text-xs flex flex-col gap-1.5">
                      <p className="font-bold text-[#1e3a8a]">Datos detectados en cotización:</p>
                      <p><span className="font-semibold">Nombre:</span> {ollamaData.proveedor.nombre}</p>
                      {ollamaData.proveedor.rut && <p><span className="font-semibold">RUT/Tributario:</span> {ollamaData.proveedor.rut}</p>}
                      {ollamaData.proveedor.direccion && <p><span className="font-semibold">Dirección:</span> {ollamaData.proveedor.direccion}</p>}
                      {ollamaData.proveedor.email && <p><span className="font-semibold">Email:</span> {ollamaData.proveedor.email}</p>}
                    </div>
                  )}
                </div>

                {/* 2. Imputación / Destino */}
                <div className="p-6 rounded-2xl bg-white border border-slate-200 flex flex-col gap-4">
                  <div className="flex items-center gap-2 text-[#1e3a8a] font-bold border-b border-slate-100 pb-3">
                    <span className="material-symbols-outlined">location_on</span>
                    <span>2. Destino e Imputación</span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700">Destino Principal *</label>
                    <select
                      className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:border-[#1e3a8a] text-xs"
                      value={destino}
                      onChange={(e) => setDestino(e.target.value)}
                      required
                    >
                      <option value="PROYECTO">PROYECTO</option>
                      <option value="ADMINISTRACION">ADMINISTRACION</option>
                      <option value="TALLER">TALLER</option>
                    </select>
                  </div>

                  {destino === "PROYECTO" ? (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-700">Proyecto *</label>
                      <select
                        className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:border-[#1e3a8a] text-xs"
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
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-700">Centro de Costo *</label>
                      <select
                        className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:border-[#1e3a8a] text-xs"
                        value={centroCosto}
                        onChange={(e) => setCentroCosto(e.target.value)}
                        required={destino !== "PROYECTO"}
                      >
                        <option value="">Seleccione centro</option>
                        <option value="PMC">PMC</option>
                        <option value="PUQ">PUQ</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* PANEL DERECHO: DATOS DE COTIZACIÓN E ÍTEMS */}
              <div className="lg:col-span-2 flex flex-col gap-6">
                {/* 3. Datos Documento Proveedor */}
                <div className="p-6 rounded-2xl bg-white border border-slate-200 flex flex-col gap-4">
                  <div className="flex items-center gap-2 text-[#1e3a8a] font-bold border-b border-slate-100 pb-3">
                    <span className="material-symbols-outlined">receipt_long</span>
                    <span>3. Datos de la Cotización del Proveedor</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-700">Referencia / Folio Cotización</label>
                      <input
                        type="text"
                        className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-900"
                        value={folio}
                        onChange={(e) => setFolio(e.target.value)}
                        placeholder="Ej: COT-1002"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-700">Fecha Cotización *</label>
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

                {/* 4. Vinculación con Cotización Interna (Opcional) */}
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
                          className="text-xs text-red-600 font-bold"
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
                            {itemsCotizacionInterna.map((it, idx) => (
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
                        <p className="text-xs text-slate-500">No hay costeos de compra pendientes en esta cotización.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* TABLA DE DETALLE DE ITEMS */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200 flex flex-col gap-4">
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
                  No hay ítems en la orden de compra. Agregue manual o importe desde cotización interna.
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
            <div className="p-6 rounded-2xl bg-[#1e3a8a]/5 border-2 border-[#1e3a8a]/10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="text-center md:text-left">
                <span className="text-xs font-bold text-[#1e3a8a] uppercase tracking-wider block">
                  Resumen de Montos
                </span>
                <p className="text-slate-500 text-xs mt-1">
                  Los valores se actualizan en tiempo real basándose en los ítems anteriores.
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

            {/* SECCIÓN MÁS OPCIONES (Observaciones / Términos) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

            {/* BOTONES DE ACCIONES FINALES */}
            <div className="pt-6 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
                <button
                  type="button"
                  onClick={() => setOllamaData(null)}
                  className="px-5 py-2.5 rounded-lg border border-slate-200 text-slate-600 font-semibold hover:bg-slate-100 text-xs transition-colors"
                >
                  Reprocesar Documento
                </button>
                {archivoNombre && (
                  <span className="text-[10px] text-slate-400 font-semibold truncate max-w-40">
                    Archivo: {archivoNombre}
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
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
          </div>
        )}
      </div>
    </ModalBase>
  );
}
