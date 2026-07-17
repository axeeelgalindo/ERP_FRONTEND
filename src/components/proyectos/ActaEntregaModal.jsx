"use client";

import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { Printer, Plus, Trash2, Download } from "lucide-react";
import { useSession } from "next-auth/react";
import { makeHeaders } from "@/lib/api";

const steps = [
  { n: 1, label: "Emisor" },
  { n: 2, label: "Receptor" },
  { n: 3, label: "Antecedentes" },
  { n: 4, label: "Épicas" },
  { n: 5, label: "Criterios y Obs" },
  { n: 6, label: "Firmas y Cierre" },
];

function formatNombreEmpleado(nombreRaw) {
  if (!nombreRaw) return "";
  if (nombreRaw.includes(",")) {
    const parts = nombreRaw.split(",");
    const apellidos = parts[0].trim().split(/\s+/);
    const nombres = parts[1].trim().split(/\s+/);
    const primerNombre = nombres[0] || "";
    const primerApellido = apellidos[0] || "";
    return `${primerNombre} ${primerApellido}`.trim();
  }
  return nombreRaw;
}

export default function ActaEntregaModal({ open, onClose, proyecto }) {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState(1);
  const [downloading, setDownloading] = useState(false);
  const [correlativo, setCorrelativo] = useState("AE-00001");
  const [fecha, setFecha] = useState("");
  const [version, setVersion] = useState("Rev. 01");
  const [estadoActa, setEstadoActa] = useState("Para firma / Conforme");

  // 1. Datos Identificacion (Emisor)
  const [empresaRazon, setEmpresaRazon] = useState("Blue Ingeniería SpA");
  const [empresaRut, setEmpresaRut] = useState("78.115.957-3");
  const [empresaDir, setEmpresaDir] = useState("Av. San Agustín S/N, La Paloma PC #38, Puerto Montt");
  const [empresaSucursal, setEmpresaSucursal] = useState("Av. San Agustín S/N, La Paloma PC #38, Puerto Montt");
  const [empresaResp, setEmpresaResp] = useState("Alexander Contreras Marín");

  // 2. Receptor (Cliente)
  const [clienteRazon, setClienteRazon] = useState("");
  const [clienteRut, setClienteRut] = useState("");
  const [clienteDir, setClienteDir] = useState("");
  const [clienteRep, setClienteRep] = useState("");
  const [clienteRepCargo, setClienteRepCargo] = useState("");

  // 3. Antecedentes
  const [proyectoServicio, setProyectoServicio] = useState("");
  const [oc, setOc] = useState("");
  const [lugarEntrega, setLugarEntrega] = useState("");
  const [fechaHora, setFechaHora] = useState("");
  const [tipoEntrega, setTipoEntrega] = useState("Servicio");
  const [condicionEntrega, setCondicionEntrega] = useState("Parcial");
  const [medioRespaldo, setMedioRespaldo] = useState("Checklist");

  // 4. Detalle Bienes / Epicas
  const [epicasDisponibles, setEpicasDisponibles] = useState([]);
  const [selectedEpicas, setSelectedEpicas] = useState({}); // { [epicId]: boolean }
  const [epicaRows, setEpicaRows] = useState({}); // { [epicId]: { desc, cant, cot, estado, obs } }

  const [newEpicNombre, setNewEpicNombre] = useState("");
  const [newEpicDesc, setNewEpicDesc] = useState("");
  const [isCreatingEpic, setIsCreatingEpic] = useState(false);
  const [showAddEpicForm, setShowAddEpicForm] = useState(false);

  // 5. Criterios de Recepcion
  const [criterios, setCriterios] = useState([
    { id: 1, texto: "Entrega física realizada conforme al detalle anterior.", checked: true },
    { id: 2, texto: "Pruebas funcionales realizadas, cuando aplique.", checked: true },
    { id: 3, texto: "Pendientes u observaciones quedan registrados en el punto 5.", checked: true },
    { id: 4, texto: "Documentación técnica entregada o adjunta al acta.", checked: true },
    { id: 5, texto: "Receptor revisa cantidades y estado visible al momento de recepción.", checked: true },
    { id: 6, texto: "La firma implica recepción conforme, salvo observaciones indicadas.", checked: true },
  ]);

  // 6. Documentos Anexos
  const [anexos, setAnexos] = useState([
    { id: 1, texto: "Guía de despacho / factura", checked: true },
    { id: 2, texto: "Checklist de pruebas", checked: true },
    { id: 3, texto: "Manual técnico", checked: true },
    { id: 4, texto: "Planos / esquemas", checked: false },
    { id: 5, texto: "Registro fotográfico", checked: false },
    { id: 6, texto: "Otro", checked: false, valor: "" },
  ]);

  // Observaciones generales (vacío por defecto)
  const [observaciones, setObservaciones] = useState("");

  // 7. Pendientes y Firmas
  const [pendientes, setPendientes] = useState([
    { id: 1, pendiente: "Canalización y cableado – M200", responsable: "Esteban Barría", fecha: "", cierre: "" },
    { id: 2, pendiente: "Instalación tableros – M200", responsable: "Esteban Barría", fecha: "", cierre: "" },
    { id: 3, pendiente: "Conexión y operación con válvulas – M200", responsable: "Esteban Barría", fecha: "", cierre: "" },
  ]);

  // Declaración conformidad
  const [declaracion, setDeclaracion] = useState(
    "El receptor declara haber recibido los bienes, equipos, documentos o servicios descritos en esta acta. La recepción se entiende conforme, salvo las observaciones y pendientes expresamente registrados en los puntos 5 y 6."
  );

  const [firmaEmisorNombre, setFirmaEmisorNombre] = useState("Alexander Contreras Marín");
  const [firmaEmisorCargo, setFirmaEmisorCargo] = useState("Responsable entrega");
  const [firmaEmisorRut, setFirmaEmisorRut] = useState("78.115.957-3");

  const [firmaReceptorNombre, setFirmaReceptorNombre] = useState("");
  const [firmaReceptorCargo, setFirmaReceptorCargo] = useState("");
  const [firmaReceptorRut, setFirmaReceptorRut] = useState("");

  const [isActaFinalizada, setIsActaFinalizada] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  const { data: session } = useSession();
  const [empleados, setEmpleados] = useState([]);

  useEffect(() => {
    if (!open || !session) return;
    const fetchEmpleados = async () => {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL;
        const res = await fetch(`${API_URL}/usuarios`, {
          headers: makeHeaders(session),
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : (data?.data || []);
          setEmpleados(list);
        }
      } catch (err) {
        console.error("Error al cargar empleados:", err);
      }
    };
    fetchEmpleados();
  }, [open, session]);

  // Load portal and icon stylesheets
  useEffect(() => {
    setMounted(true);

    if (!document.getElementById("material-symbols-link")) {
      const link = document.createElement("link");
      link.id = "material-symbols-link";
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200";
      document.head.appendChild(link);
    }

    return () => setMounted(false);
  }, []);

  // Prefill hook when project changes
  useEffect(() => {
    if (!open || !proyecto) return;

    setStep(1);
    setIsActaFinalizada(false);
    setIsFinishing(false);

    const today = new Date().toLocaleDateString("es-CL");
    setFecha(today);
    setFechaHora(today);

    const projCode = proyecto.codigo || proyecto.code || String(proyecto.id).slice(-5).toUpperCase();
    setCorrelativo(`AE-${projCode}`);
    setProyectoServicio(proyecto.nombre || "");

    const cotis = proyecto.cotizaciones || [];
    const client = cotis[0]?.cliente || proyecto.ventas?.[0]?.cliente || null;

    if (client) {
      setClienteRazon(client.nombre || client.razonSocial || "");
      setClienteRut(client.rut || "");
      setClienteDir(client.direccion || "");
      setLugarEntrega(client.direccion || "");

      const contacts = client.responsables || [];
      const primaryContact = contacts.find(c => c.es_principal) || contacts[0];
      if (primaryContact) {
        setClienteRep(primaryContact.nombre || "");
        setClienteRepCargo(primaryContact.cargo || primaryContact.area || "");
        setFirmaReceptorNombre(primaryContact.nombre || "");
        setFirmaReceptorCargo(primaryContact.cargo || "");
        setFirmaReceptorRut("");
      } else {
        setClienteRep("Eriko Jaramillo");
        setClienteRepCargo("Jefe de Acopio");
        setFirmaReceptorNombre("Eriko Jaramillo");
        setFirmaReceptorCargo("Jefe de Acopio");
        setFirmaReceptorRut("76.113.326-8");
      }
    } else {
      setClienteRazon("ABICK S.A.");
      setClienteRut("76.113.326-8");
      setClienteDir("");
      setLugarEntrega("");
      setClienteRep("Eriko Jaramillo");
      setClienteRepCargo("Jefe de Acopio");
      setFirmaReceptorNombre("Eriko Jaramillo");
      setFirmaReceptorCargo("Jefe de Acopio");
      setFirmaReceptorRut("76.113.326-8");
    }

    const ocVal = cotis[0]?.numero ? String(cotis[0].numero) : "5102";
    setOc(ocVal);

    const epics = Array.isArray(proyecto.epicas) ? proyecto.epicas : [];
    setEpicasDisponibles(epics);

    const initialSelected = {};
    const initialRows = {};

    epics.forEach((epic, index) => {
      initialSelected[epic.id] = true;
      initialRows[epic.id] = {
        item: index + 1,
        desc: epic.nombre || "",
        cant: 1,
        cot: ocVal,
        estado: epic.estado === "pendiente" ? "Operativo" : (epic.estado || "Operativo"),
        obs: epic.descripcion || "En funcionamiento"
      };
    });

    setSelectedEpicas(initialSelected);
    setEpicaRows(initialRows);

  }, [open, proyecto]);

  // Sync representative values
  useEffect(() => {
    setFirmaReceptorNombre(clienteRep);
  }, [clienteRep]);

  useEffect(() => {
    setFirmaReceptorCargo(clienteRepCargo);
  }, [clienteRepCargo]);

  useEffect(() => {
    setFirmaReceptorRut(clienteRut);
  }, [clienteRut]);

  const handleEpicRowChange = (epicId, field, value) => {
    setEpicaRows(prev => ({
      ...prev,
      [epicId]: {
        ...prev[epicId],
        [field]: value
      }
    }));
  };

  const handleEpicToggle = (epicId) => {
    setSelectedEpicas(prev => ({
      ...prev,
      [epicId]: !prev[epicId]
    }));
  };

  const handleCreateEpic = async () => {
    if (!newEpicNombre?.trim()) {
      alert("El nombre de la épica es obligatorio.");
      return;
    }
    setIsCreatingEpic(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      const token = session?.user?.accessToken || session?.accessToken || "";
      const empresaId = session?.user?.empresaId ?? session?.user?.empresa_id ?? session?.user?.empresa?.id ?? null;

      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(empresaId ? { "x-empresa-id": String(empresaId) } : {}),
      };

      const res = await fetch(`${API_URL}/epicas/add`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          nombre: newEpicNombre.trim(),
          descripcion: newEpicDesc.trim() || null,
          proyecto_id: proyecto.id,
          destino: "PROYECTO"
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Error al crear la épica");
      }

      const responseData = await res.json();
      const newEpic = responseData?.row || responseData?.data || responseData;

      if (newEpic && newEpic.id) {
        setEpicasDisponibles(prev => [...prev, newEpic]);

        setSelectedEpicas(prev => ({
          ...prev,
          [newEpic.id]: true
        }));

        const newIndex = epicasDisponibles.length + 1;
        setEpicaRows(prev => ({
          ...prev,
          [newEpic.id]: {
            item: newIndex,
            desc: newEpic.nombre || "",
            cant: 1,
            cot: oc || "—",
            estado: "Operativo",
            obs: newEpic.descripcion || "En funcionamiento"
          }
        }));

        setNewEpicNombre("");
        setNewEpicDesc("");
        setShowAddEpicForm(false);
      }
    } catch (err) {
      console.error("Error creating epic:", err);
      alert(err.message || "Error al crear la épica.");
    } finally {
      setIsCreatingEpic(false);
    }
  };

  const addPendiente = () => {
    const nextId = pendientes.length ? Math.max(...pendientes.map(p => p.id)) + 1 : 1;
    setPendientes(prev => [
      ...prev,
      { id: nextId, pendiente: "", responsable: "", fecha: "", cierre: "" }
    ]);
  };

  const updatePendiente = (id, field, value) => {
    setPendientes(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const removePendiente = (id) => {
    setPendientes(prev => prev.filter(p => p.id !== id));
  };

  const activeEpicRows = useMemo(() => {
    const items = [];
    let idx = 1;
    epicasDisponibles.forEach(epic => {
      if (selectedEpicas[epic.id]) {
        items.push({
          item: idx++,
          ...epicaRows[epic.id]
        });
      }
    });

    const displayItems = [...items];
    while (displayItems.length < 6) {
      displayItems.push({
        item: idx++,
        desc: "",
        cant: "",
        cot: "",
        estado: "",
        obs: ""
      });
    }

    return displayItems;
  }, [epicasDisponibles, selectedEpicas, epicaRows]);

  const observationsLines = useMemo(() => {
    const lines = observaciones.split("\n");
    const displayLines = [...lines];
    while (displayLines.length < 7) {
      displayLines.push("");
    }
    return displayLines.slice(0, 7);
  }, [observaciones]);

  const printedPendientes = useMemo(() => {
    const list = [...pendientes];
    while (list.length < 4) {
      list.push({ id: Math.random(), pendiente: "", responsable: "", fecha: "", cierre: "" });
    }
    return list.slice(0, 4);
  }, [pendientes]);

  const emisorInitials = useMemo(() => {
    if (!firmaEmisorNombre) return "AM";
    return firmaEmisorNombre.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  }, [firmaEmisorNombre]);

  // Clean iframe printing trigger
  const handlePrint = () => {
    const printContent = document.getElementById("acta-print-area");
    if (!printContent) return;

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write("<html><head><title>Acta de Entrega - " + correlativo + "</title>");

    for (const styleSheet of document.styleSheets) {
      try {
        if (styleSheet.href) {
          doc.write(`<link rel="stylesheet" href="${styleSheet.href}">`);
        } else {
          const rules = Array.from(styleSheet.cssRules).map(rule => rule.cssText).join("\n");
          doc.write(`<style>${rules}</style>`);
        }
      } catch (e) { }
    }

    doc.write(`
      <style>
        @page {
          size: A4;
          margin: 0;
        }
        @media print {
          body {
            background-color: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .page-container {
            width: 210mm;
            height: 297mm;
            padding: 15mm 15mm 10mm 15mm;
            box-sizing: border-box;
            position: relative;
            page-break-after: always;
            break-after: page;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            background-color: #ffffff !important;
          }
          html, body {
            width: 210mm;
            height: 297mm;
          }
        }
        .notebook-line {
          border-bottom: 1px solid #94a3b8;
          height: 32px;
          line-height: 32px;
          font-size: 13px;
          color: #1e293b;
          font-family: inherit;
        }
        .text-blue-corporate {
          color: #0b5f89;
        }
        .bg-blue-corporate {
          background-color: #0b5f89;
        }
        .bg-blue-header {
          background-color: #134e7a;
        }
        .border-blue-corporate {
          border-color: #0b5f89;
        }
        .bg-blue-light {
          background-color: #ebf3f8;
        }
      </style>
    `);
    doc.write("</head><body class='bg-white font-sans text-gray-800'>");
    doc.write(printContent.innerHTML);
    doc.write("</body></html>");
    doc.close();

    iframe.contentWindow.focus();
    setTimeout(() => {
      iframe.contentWindow.print();
      document.body.removeChild(iframe);
    }, 800);
  };

  const generatePDFDocument = async (jsPDF, autoTable) => {
    const doc = new jsPDF({
      orientation: "p",
      unit: "mm",
      format: "a4",
    });

    let logoBase64 = "";
    try {
      const response = await fetch("/Logo_blue.png");
      if (response.ok) {
        const blob = await response.blob();
        logoBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }
    } catch (err) {
      console.error("No se pudo cargar el logo de la empresa:", err);
    }

    // PAGE 1
    if (logoBase64) {
      doc.addImage(logoBase64, "PNG", 15, 12, 40, 15, undefined, "FAST");
    } else {
      doc.setTextColor(11, 95, 137);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("Blue Ingeniería", 15, 20);
    }

    doc.setFillColor(11, 95, 137);
    doc.rect(100, 12, 95, 10, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text("Recepción conforme de bienes, servicios y documentos", 102, 18.5);

    doc.setDrawColor(226, 232, 240);
    doc.line(15, 31, 195, 31);

    doc.setTextColor(11, 95, 137);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("ACTA DE ENTREGA", 15, 42);

    doc.setFontSize(14);
    doc.text(correlativo, 168, 42);

    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text("Formato profesional para recepción formal, trazabilidad documental y cierre de entrega.", 15, 47);

    autoTable(doc, {
      startY: 51,
      margin: { left: 15, right: 15 },
      head: [["CORRELATIVO", "FECHA", "VERSIÓN", "ESTADO"]],
      body: [[correlativo, fecha, version, estadoActa]],
      theme: "grid",
      styles: { fontSize: 8, font: "helvetica", halign: "center", cellPadding: 2.5 },
      headStyles: { fillColor: [235, 243, 248], textColor: [100, 116, 139], fontStyle: "bold" },
      bodyStyles: { fontStyle: "bold", textColor: [30, 41, 59] },
      gridLineColor: [226, 232, 240]
    });

    doc.setTextColor(11, 95, 137);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("1. DATOS DE IDENTIFICACIÓN", 15, doc.lastAutoTable.finalY + 9);

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 12,
      margin: { left: 15, right: 15 },
      head: [[
        { content: "EMPRESA QUE ENTREGA", colSpan: 2, styles: { halign: "center", fillColor: [19, 78, 122], fontStyle: "bold", textColor: [255, 255, 255] } },
        { content: "RECEPTOR / CLIENTE", colSpan: 2, styles: { halign: "center", fillColor: [11, 95, 137], fontStyle: "bold", textColor: [255, 255, 255] } }
      ]],
      body: [
        ["Razón social", empresaRazon, "Razón social", clienteRazon],
        ["RUT", empresaRut, "RUT", clienteRut],
        ["Dirección", empresaDir, "Dirección", clienteDir || "—"],
        ["Sucursal operativa", empresaSucursal, "Representante", clienteRep || "—"],
        ["Responsable entrega", empresaResp, "Cargo / área", clienteRepCargo || "—"],
      ],
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 2, font: "helvetica" },
      columnStyles: {
        0: { fontStyle: "bold", fillColor: [235, 243, 248], width: 30 },
        1: { width: 60 },
        2: { fontStyle: "bold", fillColor: [235, 243, 248], width: 30 },
        3: { width: 60 },
      },
      gridLineColor: [226, 232, 240]
    });

    doc.setTextColor(11, 95, 137);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("2. ANTECEDENTES DE LA ENTREGA", 15, doc.lastAutoTable.finalY + 9);

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 12,
      margin: { left: 15, right: 15 },
      body: [
        ["Proyecto / servicio", proyectoServicio, "OC", oc || "—"],
        ["Lugar de entrega", lugarEntrega, "Fecha de entrega", fechaHora],
        ["Tipo de entrega", tipoEntrega, "Condición", condicionEntrega],
        ["Medio de respaldo", medioRespaldo, "", ""],
      ],
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 2, font: "helvetica" },
      columnStyles: {
        0: { fontStyle: "bold", fillColor: [235, 243, 248], width: 30 },
        1: { width: 60 },
        2: { fontStyle: "bold", fillColor: [235, 243, 248], width: 30 },
        3: { width: 60 },
      },
      gridLineColor: [226, 232, 240]
    });

    doc.setTextColor(11, 95, 137);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("3. DETALLE DE BIENES, EQUIPOS O DOCUMENTOS ENTREGADOS", 15, doc.lastAutoTable.finalY + 9);

    const table3Body = activeEpicRows.map(r => [
      r.item,
      r.desc,
      r.cant,
      r.cot,
      r.estado,
      r.obs
    ]);

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 12,
      margin: { left: 15, right: 15 },
      head: [["Ítem", "Descripción", "Cant.", "COT", "Estado", "Obs. breve"]],
      body: table3Body,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 2, font: "helvetica" },
      headStyles: { fillColor: [11, 95, 137], textColor: [255, 255, 255], fontStyle: "bold" },
      columnStyles: {
        0: { halign: "center", fontStyle: "bold", fillColor: [235, 243, 248], width: 12 },
        1: { width: 65 },
        2: { halign: "center", width: 12 },
        3: { halign: "center", width: 15 },
        4: { halign: "center", fontStyle: "bold", textColor: [11, 95, 137] },
        5: { width: 66 },
      },
      gridLineColor: [226, 232, 240]
    });

    doc.setTextColor(11, 95, 137);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("4. CRITERIOS DE RECEPCIÓN", 15, doc.lastAutoTable.finalY + 9);

    const criteriaY = doc.lastAutoTable.finalY + 12;
    const numRows = Math.ceil(criterios.length / 2);
    const criteriaHeight = numRows * 5.5 + 4;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(15, criteriaY, 180, criteriaHeight, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);

    criterios.forEach((c, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);

      const itemX = col === 0 ? 17 : 105;
      const textX = col === 0 ? 23 : 111;
      const itemY = criteriaY + 3.5 + row * 5.5;

      doc.text(c.checked ? "x" : " ", itemX + 1.5, itemY + 2);
      doc.rect(itemX, itemY, 3.5, 3.5);
      doc.text(c.texto, textX, itemY + 2.5);
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("Blue Ingeniería SpA | RUT 78.115.957-3", 15, 287);
    doc.text(correlativo, 180, 287);

    // PAGE 2
    doc.addPage();

    if (logoBase64) {
      doc.addImage(logoBase64, "PNG", 15, 12, 40, 15, undefined, "FAST");
    }
    doc.setFillColor(11, 95, 137);
    doc.rect(100, 12, 95, 10, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text("Recepción conforme de bienes, servicios y documentos", 102, 18.5);

    doc.setDrawColor(226, 232, 240);
    doc.line(15, 31, 195, 31);

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("Blue Ingeniería SpA | RUT 78.115.957-3", 15, 36);
    doc.setTextColor(11, 95, 137);
    doc.text(correlativo, 180, 36);

    doc.setDrawColor(11, 95, 137);
    doc.line(15, 38, 195, 38);

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("5. OBSERVACIONES GENERALES", 15, 46);

    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("Use este espacio para registrar observaciones, diferencias de cantidad, estado físico, pendientes menores o condiciones detectadas al momento de la recepción.", 15, 51);

    let obsY = 56;
    doc.setDrawColor(203, 213, 225);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(8.5);

    for (let i = 0; i < 7; i++) {
      const textLine = observationsLines[i] || "";
      if (textLine) {
        doc.text(textLine, 18, obsY + 6);
      }
      doc.line(15, obsY + 10, 195, obsY + 10);
      obsY += 10;
    }

    doc.setTextColor(11, 95, 137);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("6. PENDIENTES O ACCIONES CORRECTIVAS", 15, obsY + 9);

    const table6Body = printedPendientes.map(p => [
      p.pendiente,
      p.responsable,
      p.fecha,
      p.cierre
    ]);

    autoTable(doc, {
      startY: obsY + 12,
      margin: { left: 15, right: 15 },
      head: [["Pendiente / acción requerida", "Responsable", "Fecha compromiso", "Cierre"]],
      body: table6Body,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 2, font: "helvetica" },
      headStyles: { fillColor: [11, 95, 137], textColor: [255, 255, 255], fontStyle: "bold" },
      columnStyles: {
        0: { width: 85 },
        1: { width: 35 },
        2: { halign: "center", width: 35 },
        3: { halign: "center", width: 25 },
      },
      gridLineColor: [226, 232, 240]
    });

    doc.setTextColor(11, 95, 137);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("7. DOCUMENTOS ANEXOS", 15, doc.lastAutoTable.finalY + 9);

    const annexesY = doc.lastAutoTable.finalY + 12;
    const numAnnexRows = Math.ceil(anexos.length / 3);
    const annexHeight = numAnnexRows * 5.5 + 4;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(15, annexesY, 180, annexHeight, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);

    anexos.forEach((a, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);

      const itemX = col === 0 ? 17 : col === 1 ? 77 : 137;
      const textX = col === 0 ? 23 : col === 1 ? 83 : 143;
      const itemY = annexesY + 2.5 + row * 5.5;

      doc.text(a.checked ? "x" : " ", itemX + 1.5, itemY + 2);
      doc.rect(itemX, itemY, 3.5, 3.5);

      let displayTxt = a.texto;
      if (a.texto.toLowerCase().includes("otro")) {
        displayTxt = a.checked ? `Otro: ${a.valor || "___________"}` : "Otro: ___________";
      }
      doc.text(displayTxt, textX, itemY + 2.5);
    });

    doc.setTextColor(11, 95, 137);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("8. DECLARACIÓN DE CONFORMIDAD", 15, annexesY + 23);

    const declY = annexesY + 26;
    doc.setFillColor(235, 243, 248);
    doc.rect(15, declY, 180, 13, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(50, 50, 50);
    const splitDecl = doc.splitTextToSize(declaracion, 174);
    doc.text(splitDecl, 18, declY + 4.5);

    doc.setTextColor(11, 95, 137);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("9. FIRMAS DE CONFORMIDAD", 15, declY + 20);

    const signsY = declY + 23;
    doc.setDrawColor(203, 213, 225);
    doc.rect(15, signsY, 90, 36);
    doc.rect(105, signsY, 90, 36);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(11, 95, 137);
    doc.text("ENTREGA - BLUE INGENIERÍA", 40, signsY + 4);
    doc.setDrawColor(226, 232, 240);
    doc.line(15, signsY + 6, 105, signsY + 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text("Firma: _________________________", 20, signsY + 18);
    doc.text(`Nombre: ${firmaEmisorNombre}`, 20, signsY + 23);
    doc.text(`Cargo: ${firmaEmisorCargo}`, 20, signsY + 28);
    doc.text(`RUT: ${firmaEmisorRut}`, 20, signsY + 33);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(11, 95, 137);
    doc.text("RECIBE - CLIENTE / RECEPTOR", 130, signsY + 4);
    doc.line(105, signsY + 6, 195, signsY + 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text("Firma: _________________________", 110, signsY + 18);
    doc.text(`Nombre: ${firmaReceptorNombre}`, 110, signsY + 23);
    doc.text(`Cargo: ${firmaReceptorCargo}`, 110, signsY + 28);
    doc.text(`RUT: ${firmaReceptorRut}`, 110, signsY + 33);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("Blue Ingeniería SpA | RUT 78.115.957-3", 15, 287);
    doc.text(correlativo, 180, 287);

    return doc;
  };

  const handleDownloadPDF = async () => {
    if (downloading) return;
    try {
      setDownloading(true);
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);

      const doc = await generatePDFDocument(jsPDF, autoTable);
      doc.save(`Acta_Entrega_${correlativo}.pdf`);
    } catch (err) {
      console.error("Error al descargar PDF:", err);
    } finally {
      setDownloading(false);
    }
  };

  const executeFinalizeActa = async () => {
    if (isFinishing) return;
    setIsFinishing(true);
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);

      const doc = await generatePDFDocument(jsPDF, autoTable);
      const pdfBlob = doc.output("blob");
      const pdfFile = new File([pdfBlob], `Acta_Entrega_${correlativo}.pdf`, { type: "application/pdf" });

      const cotizacionId = proyecto?.cotizaciones?.[0]?.id || proyecto?.ventas?.[0]?.cotizacion_id;
      if (cotizacionId) {
        const fd = new FormData();
        fd.append("file", pdfFile);

        const token = session?.user?.accessToken || session?.accessToken || "";
        const empresaId = session?.user?.empresaId ?? session?.user?.empresa_id ?? session?.user?.empresa?.id ?? null;

        const headers = {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(empresaId ? { "x-empresa-id": String(empresaId) } : {}),
        };

        const API_URL = process.env.NEXT_PUBLIC_API_URL;
        const res = await fetch(`${API_URL}/cotizaciones/${cotizacionId}/upload/ae`, {
          method: "POST",
          headers,
          body: fd
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || "Error al subir el acta de entrega");
        }
      }

      setIsActaFinalizada(true);
    } catch (err) {
      console.error("Error al finalizar acta:", err);
      alert(err.message || "Ocurrió un error al finalizar el acta.");
    } finally {
      setIsFinishing(false);
    }
  };

  if (!open || !mounted) return null;

  const activeStep = steps.find(s => s.n === step);

  const modalContent = (
    <div className="fixed inset-0 bg-[#2d3135]/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-8">
      {/* Main Modal Container */}
      <div className="bg-[#ffffff] w-full max-w-6xl h-full max-h-[921px] rounded-xl overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in duration-300">

        {/* Modal Header / Stepper */}
        <div className="px-6 pt-6 pb-4 border-b border-[#c1c6d7] bg-[#ffffff]">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-xl font-semibold text-[#0059bb]">Emisión de Acta de Entrega Técnica</h1>
              <p className="text-[#414754] text-sm">Proyecto ID: {proyecto?.codigo || proyecto?.id?.slice(-6) || ""} • {proyecto?.nombre || ""}</p>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#e0e3e8] text-[#414754] transition-colors hover:cursor-pointer"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          {/* 8-Step Progress Indicator */}
          <nav className="relative flex justify-between items-center max-w-4xl mx-auto mb-2">
            <div className="absolute top-1/2 left-0 w-full h-[2px] bg-[#e0e3e8] -translate-y-1/2 z-0"></div>

            {/* Progress Bar */}
            <div
              className="absolute top-1/2 left-0 h-[2px] bg-[#0059bb] -translate-y-1/2 z-0 transition-all duration-500"
              style={{ width: `${((step - 1) / (steps.length - 1)) * 100}%` }}
            ></div>

            {/* Step Nodes */}
            {steps.map((s, idx) => {
              const isActive = step === s.n;
              const isCompleted = step > s.n;

              let iconName = "";
              if (s.n === 1) iconName = "description";
              else if (s.n === 2) iconName = "location_on";
              else if (s.n === 3) iconName = "precision_manufacturing";
              else if (s.n === 4) iconName = "groups";
              else if (s.n === 5) iconName = "rule";
              else if (s.n === 6) iconName = "draw";

              return (
                <div
                  key={s.n}
                  onClick={() => setStep(s.n)}
                  className="relative z-10 flex flex-col items-center gap-2 cursor-pointer"
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isActive
                      ? "bg-[#d8e2ff] text-[#0059bb] ring-4 ring-[#0059bb]/15 border-2 border-[#0059bb] font-bold"
                      : isCompleted
                        ? "bg-[#0059bb] text-[#ffffff] font-bold"
                        : "bg-[#e0e3e8] text-[#414754]"
                      }`}
                  >
                    {isCompleted ? (
                      <span className="material-symbols-outlined !text-[16px]">check</span>
                    ) : s.n === 6 ? (
                      <span className="font-bold">6</span>
                    ) : (
                      <span className="material-symbols-outlined !text-[16px]">{iconName}</span>
                    )}
                  </div>
                  <span className={`text-[11px] font-semibold tracking-wide ${isActive ? "text-[#0059bb] font-bold" : "text-[#414754]"}`}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Modal Body (Dynamic Step Container) */}
        <div className="flex-1 flex overflow-hidden relative bg-[#f7f9ff]" id="steps-container">

          {/* LEFT SIDE FORM: Steps 1 to 5 */}
          {step < 6 && (
            <div className="w-full max-w-4xl mx-auto p-6 flex flex-col overflow-y-auto custom-scrollbar">

              {/* STEP 1: EMISOR (GENERAL) */}
              {step === 1 && (
                <div className="flex flex-col gap-4">
                  <h3 className="text-base font-bold text-[#0059bb] uppercase tracking-wider mb-2">Paso 1: Datos de Emisión</h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-white p-4 rounded-xl border border-[#c1c6d7] shadow-sm">
                    <div>
                      <label className="block text-[11px] font-bold text-[#414754] uppercase tracking-wider mb-1">Correlativo</label>
                      <input
                        type="text"
                        value={correlativo}
                        onChange={e => setCorrelativo(e.target.value)}
                        className="w-full rounded-lg border-[#c1c6d7] p-2 bg-[#f1f4f9] focus:bg-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#414754] uppercase tracking-wider mb-1">Versión</label>
                      <input
                        type="text"
                        value={version}
                        onChange={e => setVersion(e.target.value)}
                        className="w-full rounded-lg border-[#c1c6d7] p-2 bg-[#f1f4f9] focus:bg-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#414754] uppercase tracking-wider mb-1">Estado</label>
                      <input
                        type="text"
                        value={estadoActa}
                        onChange={e => setEstadoActa(e.target.value)}
                        className="w-full rounded-lg border-[#c1c6d7] p-2 bg-[#f1f4f9] focus:bg-white text-sm"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 bg-white p-5 rounded-xl border border-[#c1c6d7] shadow-sm">
                    <div className="text-xs font-bold text-[#0059bb] border-b pb-1.5 uppercase tracking-wide">Empresa que Entrega (Emisor)</div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#414754] uppercase tracking-wider mb-1">Razón Social</label>
                      <input type="text" value={empresaRazon} onChange={e => setEmpresaRazon(e.target.value)} className="w-full rounded-lg border-[#c1c6d7] p-2 bg-[#f1f4f9] focus:bg-white text-sm" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#414754] uppercase tracking-wider mb-1">RUT</label>
                      <input type="text" value={empresaRut} onChange={e => setEmpresaRut(e.target.value)} className="w-full rounded-lg border-[#c1c6d7] p-2 bg-[#f1f4f9] focus:bg-white text-sm" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#414754] uppercase tracking-wider mb-1">Dirección</label>
                      <input type="text" value={empresaDir} onChange={e => setEmpresaDir(e.target.value)} className="w-full rounded-lg border-[#c1c6d7] p-2 bg-[#f1f4f9] focus:bg-white text-sm" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#414754] uppercase tracking-wider mb-1">Sucursal Operativa</label>
                      <input type="text" value={empresaSucursal} onChange={e => setEmpresaSucursal(e.target.value)} className="w-full rounded-lg border-[#c1c6d7] p-2 bg-[#f1f4f9] focus:bg-white text-sm" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#414754] uppercase tracking-wider mb-1">Responsable Entrega</label>
                      <select
                        value={empresaResp}
                        onChange={e => {
                          setEmpresaResp(e.target.value);
                          setFirmaEmisorNombre(e.target.value);
                        }}
                        className="w-full rounded-lg border-[#c1c6d7] p-2 bg-[#f1f4f9] focus:bg-white text-sm"
                      >
                        <option value="">Seleccione un responsable...</option>
                        {empresaResp && !new Set(empleados.map(e => formatNombreEmpleado(e.nombre))).has(empresaResp) && (
                          <option value={empresaResp}>{empresaResp}</option>
                        )}
                        {empleados.map(emp => {
                          const formatted = formatNombreEmpleado(emp.nombre);
                          return (
                            <option key={emp.id} value={formatted}>
                              {formatted} ({emp.email || emp.username})
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: RECEPTOR / CLIENTE */}
              {step === 2 && (
                <div className="flex flex-col gap-4">
                  <h3 className="text-base font-bold text-[#0059bb] uppercase tracking-wider mb-2">Paso 2: Receptor / Cliente</h3>

                  <div className="flex flex-col gap-3 bg-white p-5 rounded-xl border border-[#c1c6d7] shadow-sm">
                    <div className="text-xs font-bold text-[#0059bb] border-b pb-1.5 uppercase tracking-wide">Datos del Cliente</div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#414754] uppercase tracking-wider mb-1">Razón Social</label>
                      <input type="text" value={clienteRazon} onChange={e => setClienteRazon(e.target.value)} className="w-full rounded-lg border-[#c1c6d7] p-2 bg-[#f1f4f9] focus:bg-white text-sm" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#414754] uppercase tracking-wider mb-1">RUT</label>
                      <input type="text" value={clienteRut} onChange={e => setClienteRut(e.target.value)} className="w-full rounded-lg border-[#c1c6d7] p-2 bg-[#f1f4f9] focus:bg-white text-sm" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#414754] uppercase tracking-wider mb-1">Dirección</label>
                      <input type="text" value={clienteDir} onChange={e => setClienteDir(e.target.value)} className="w-full rounded-lg border-[#c1c6d7] p-2 bg-[#f1f4f9] focus:bg-white text-sm" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#414754] uppercase tracking-wider mb-1">Representante Autorizado</label>
                      <input type="text" value={clienteRep} onChange={e => setClienteRep(e.target.value)} className="w-full rounded-lg border-[#c1c6d7] p-2 bg-[#f1f4f9] focus:bg-white text-sm" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#414754] uppercase tracking-wider mb-1">Cargo / Área del Receptor</label>
                      <input type="text" value={clienteRepCargo} onChange={e => setClienteRepCargo(e.target.value)} className="w-full rounded-lg border-[#c1c6d7] p-2 bg-[#f1f4f9] focus:bg-white text-sm" />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: ANTECEDENTES */}
              {step === 3 && (
                <div className="flex flex-col gap-4">
                  <h3 className="text-base font-bold text-[#0059bb] uppercase tracking-wider mb-2">Paso 3: Antecedentes del Proyecto</h3>

                  <div className="flex flex-col gap-3 bg-white p-5 rounded-xl border border-[#c1c6d7] shadow-sm">
                    <div>
                      <label className="block text-[11px] font-bold text-[#414754] uppercase tracking-wider mb-1">Proyecto / Servicio</label>
                      <input type="text" value={proyectoServicio} onChange={e => setProyectoServicio(e.target.value)} className="w-full rounded-lg border-[#c1c6d7] p-2 bg-[#f1f4f9] focus:bg-white text-sm" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#414754] uppercase tracking-wider mb-1">Orden de Compra (OC)</label>
                      <input type="text" value={oc} onChange={e => setOc(e.target.value)} className="w-full rounded-lg border-[#c1c6d7] p-2 bg-[#f1f4f9] focus:bg-white text-sm" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#414754] uppercase tracking-wider mb-1">Lugar de Entrega</label>
                      <input type="text" value={lugarEntrega} onChange={e => setLugarEntrega(e.target.value)} className="w-full rounded-lg border-[#c1c6d7] p-2 bg-[#f1f4f9] focus:bg-white text-sm" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#414754] uppercase tracking-wider mb-1">Fecha de Entrega</label>
                      <input type="text" value={fechaHora} onChange={e => setFechaHora(e.target.value)} className="w-full rounded-lg border-[#c1c6d7] p-2 bg-[#f1f4f9] focus:bg-white text-sm" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#414754] uppercase tracking-wider mb-1">Tipo de Entrega</label>
                      <input type="text" value={tipoEntrega} onChange={e => setTipoEntrega(e.target.value)} className="w-full rounded-lg border-[#c1c6d7] p-2 bg-[#f1f4f9] focus:bg-white text-sm" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#414754] uppercase tracking-wider mb-1">Condición</label>
                      <input type="text" value={condicionEntrega} onChange={e => setCondicionEntrega(e.target.value)} className="w-full rounded-lg border-[#c1c6d7] p-2 bg-[#f1f4f9] focus:bg-white text-sm" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#414754] uppercase tracking-wider mb-1">Medio de Respaldo</label>
                      <input type="text" value={medioRespaldo} onChange={e => setMedioRespaldo(e.target.value)} className="w-full rounded-lg border-[#c1c6d7] p-2 bg-[#f1f4f9] focus:bg-white text-sm" />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: ÉPICAS (ITEMS) */}
              {step === 4 && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-[#0059bb] uppercase tracking-wider mb-1">Paso 4: Equipos / Épicas a Entregar</h3>
                    {!showAddEpicForm && epicasDisponibles.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowAddEpicForm(true)}
                        className="px-3 py-1.5 text-xs font-bold text-white bg-[#0059bb] hover:bg-[#0070ea] rounded-lg shadow transition-all active:scale-95 duration-100 flex items-center gap-1 hover:cursor-pointer"
                      >
                        <span className="material-symbols-outlined !text-[14px]">add</span>
                        <span>Crear Épica</span>
                      </button>
                    )}
                  </div>
                  <p className="text-[12px] text-[#414754] mb-2 leading-relaxed bg-[#f1f4f9] p-3 rounded-lg border border-[#c1c6d7]">
                    Marque cada una de las épicas del proyecto que formarán parte del acta. Complete o modifique su descripción y estado individual. Por obligación debe seleccionar al menos 1 épica.
                  </p>

                  {/* Epic Creation Form (Expandable) */}
                  {(showAddEpicForm || epicasDisponibles.length === 0) && (
                    <div className="bg-[#f1f4f9] p-4 rounded-xl border border-[#c1c6d7] flex flex-col gap-3">
                      <div className="text-xs font-bold text-[#0059bb] border-b pb-1.5 uppercase tracking-wide flex items-center gap-1">
                        <span className="material-symbols-outlined !text-[16px]">playlist_add</span>
                        <span>Crear nueva épica en el proyecto</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-[#414754] uppercase tracking-wider mb-1">Nombre de la Épica *</label>
                          <input
                            type="text"
                            value={newEpicNombre}
                            onChange={e => setNewEpicNombre(e.target.value)}
                            placeholder="Ej: Instalación Eléctrica"
                            className="w-full p-2 border rounded-lg text-xs bg-white focus:ring-1 focus:ring-[#0059bb]"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-[#414754] uppercase tracking-wider mb-1">Descripción / Notas (Opcional)</label>
                          <input
                            type="text"
                            value={newEpicDesc}
                            onChange={e => setNewEpicDesc(e.target.value)}
                            placeholder="Ej: Trabajos en sala de bombas"
                            className="w-full p-2 border rounded-lg text-xs bg-white focus:ring-1 focus:ring-[#0059bb]"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end mt-1">
                        {epicasDisponibles.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setNewEpicNombre("");
                              setNewEpicDesc("");
                              setShowAddEpicForm(false);
                            }}
                            className="px-4 py-1.5 border border-[#717786] text-[#414754] font-bold text-xs rounded-lg hover:bg-[#e0e3e8] active:scale-95 duration-100 hover:cursor-pointer"
                          >
                            Cancelar
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleCreateEpic}
                          disabled={isCreatingEpic || !newEpicNombre.trim()}
                          className="px-4 py-1.5 bg-[#0059bb] hover:bg-[#0070ea] text-white font-bold text-xs rounded-lg shadow active:scale-95 duration-100 disabled:opacity-50 hover:cursor-pointer flex items-center gap-1"
                        >
                          {isCreatingEpic ? "Creando..." : "+ Crear Épica"}
                        </button>
                      </div>
                    </div>
                  )}

                  {epicasDisponibles.length === 0 ? (
                    <div className="text-xs text-amber-600 bg-amber-50 p-4 rounded-xl border border-amber-200 text-center font-medium">
                      Este proyecto no tiene épicas registradas. Por favor, complete los datos anteriores y cree la primera épica para poder avanzar.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {epicasDisponibles.map((epic) => {
                        const isChecked = !!selectedEpicas[epic.id];
                        const rowData = epicaRows[epic.id] || {};

                        return (
                          <div key={epic.id} className={`border rounded-xl p-4 transition-all ${isChecked ? "bg-white border-[#0059bb] shadow-sm" : "bg-[#f1f4f9]/50 border-[#c1c6d7] opacity-60"}`}>
                            <div className="flex items-center gap-3 font-semibold text-sm text-slate-700">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleEpicToggle(epic.id)}
                                className="w-4 h-4 rounded text-[#0059bb] focus:ring-[#0059bb] hover:cursor-pointer"
                              />
                              <span className="flex-1 font-headline-md text-[#181c20]">{epic.nombre}</span>
                              <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${epic.estado === "pendiente" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                                {epic.estado || "pendiente"}
                              </span>
                            </div>

                            {isChecked && (
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pl-7 mt-3 pt-3 border-t border-dashed border-[#c1c6d7]">
                                <div className="md:col-span-2">
                                  <label className="block text-[10px] font-bold text-[#414754] uppercase tracking-wider mb-1">Descripción en Acta</label>
                                  <input
                                    type="text"
                                    value={rowData.desc ?? ""}
                                    onChange={e => handleEpicRowChange(epic.id, "desc", e.target.value)}
                                    className="w-full p-2 border rounded-lg text-xs bg-white focus:ring-1 focus:ring-[#0059bb]"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-[#414754] uppercase tracking-wider mb-1">Cant.</label>
                                  <input
                                    type="number"
                                    value={rowData.cant ?? 1}
                                    onChange={e => handleEpicRowChange(epic.id, "cant", parseInt(e.target.value) || 0)}
                                    className="w-full p-2 border rounded-lg text-xs text-center bg-white focus:ring-1 focus:ring-[#0059bb]"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-[#414754] uppercase tracking-wider mb-1">COT / Ref.</label>
                                  <input
                                    type="text"
                                    value={rowData.cot ?? ""}
                                    onChange={e => handleEpicRowChange(epic.id, "cot", e.target.value)}
                                    className="w-full p-2 border rounded-lg text-xs text-center bg-white focus:ring-1 focus:ring-[#0059bb]"
                                  />
                                </div>
                                <div className="md:col-span-2">
                                  <label className="block text-[10px] font-bold text-[#414754] uppercase tracking-wider mb-1">Estado Técnico</label>
                                  <select
                                    value={rowData.estado ?? "Operativo"}
                                    onChange={e => handleEpicRowChange(epic.id, "estado", e.target.value)}
                                    className="w-full p-2 border rounded-lg text-xs bg-white focus:ring-1 focus:ring-[#0059bb]"
                                  >
                                    <option value="Operativo">Operativo</option>
                                    <option value="Entregada">Entregada</option>
                                    <option value="Realizada">Realizada</option>
                                    <option value="Instalado">Instalado</option>
                                    <option value="Pendiente">Pendiente</option>
                                  </select>
                                </div>
                                <div className="md:col-span-2">
                                  <label className="block text-[10px] font-bold text-[#414754] uppercase tracking-wider mb-1">Observación Breve</label>
                                  <input
                                    type="text"
                                    value={rowData.obs ?? ""}
                                    onChange={e => handleEpicRowChange(epic.id, "obs", e.target.value)}
                                    className="w-full p-2 border rounded-lg text-xs bg-white focus:ring-1 focus:ring-[#0059bb]"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* STEP 5: CRITERIOS, ANEXOS Y OBSERVACIONES */}
              {step === 5 && (
                <div className="flex flex-col gap-4">
                  <h3 className="text-base font-bold text-[#0059bb] uppercase tracking-wider mb-2">Paso 5: Pruebas, Anexos y Observaciones</h3>

                  {/* Criterios */}
                  <div className="flex flex-col gap-3 bg-white p-5 rounded-xl border border-[#c1c6d7] shadow-sm">
                    <div className="flex items-center justify-between border-b pb-1.5 mb-1">
                      <div className="text-xs font-bold text-[#0059bb] uppercase tracking-wide">Criterios de Recepción</div>
                      <button
                        type="button"
                        onClick={() => {
                          const nextId = criterios.length ? Math.max(...criterios.map(c => c.id)) + 1 : 1;
                          setCriterios(prev => [...prev, { id: nextId, texto: "Nuevo criterio", checked: true }]);
                        }}
                        className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-200"
                      >
                        + Añadir Criterio
                      </button>
                    </div>

                    <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
                      {criterios.map((c) => (
                        <div key={c.id} className="flex items-center gap-2 bg-[#f1f4f9] p-2 rounded-lg border border-slate-200">
                          <input
                            type="checkbox"
                            checked={c.checked}
                            onChange={(e) => {
                              setCriterios(prev => prev.map(item => item.id === c.id ? { ...item, checked: e.target.checked } : item));
                            }}
                            className="w-4 h-4 rounded text-[#0059bb]"
                          />
                          <input
                            type="text"
                            value={c.texto}
                            onChange={(e) => {
                              setCriterios(prev => prev.map(item => item.id === c.id ? { ...item, texto: e.target.value } : item));
                            }}
                            className="flex-1 p-1 border rounded text-xs bg-white focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setCriterios(prev => prev.filter(item => item.id !== c.id));
                            }}
                            className="text-red-500 hover:bg-red-50 p-1 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Anexos */}
                  <div className="flex flex-col gap-3 bg-white p-5 rounded-xl border border-[#c1c6d7] shadow-sm">
                    <div className="flex items-center justify-between border-b pb-1.5 mb-1">
                      <div className="text-xs font-bold text-[#0059bb] uppercase tracking-wide">Documentos Anexos</div>
                      <button
                        type="button"
                        onClick={() => {
                          const nextId = anexos.length ? Math.max(...anexos.map(a => a.id)) + 1 : 1;
                          setAnexos(prev => [...prev, { id: nextId, texto: "Nuevo anexo", checked: true }]);
                        }}
                        className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-200"
                      >
                        + Añadir Anexo
                      </button>
                    </div>

                    <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
                      {anexos.map((a) => (
                        <div key={a.id} className="flex flex-col gap-1.5 bg-[#f1f4f9] p-2 rounded-lg border border-slate-200">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={a.checked}
                              onChange={(e) => {
                                setAnexos(prev => prev.map(item => item.id === a.id ? { ...item, checked: e.target.checked } : item));
                              }}
                              className="w-4 h-4 rounded text-[#0059bb]"
                            />
                            <input
                              type="text"
                              value={a.texto}
                              onChange={(e) => {
                                setAnexos(prev => prev.map(item => item.id === a.id ? { ...item, texto: e.target.value } : item));
                              }}
                              className="flex-1 p-1 border rounded text-xs bg-white focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setAnexos(prev => prev.filter(item => item.id !== a.id));
                              }}
                              className="text-red-500 hover:bg-red-50 p-1 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {a.texto.toLowerCase().includes("otro") && (
                            <input
                              type="text"
                              value={a.valor || ""}
                              onChange={(e) => {
                                setAnexos(prev => prev.map(item => item.id === a.id ? { ...item, valor: e.target.value } : item));
                              }}
                              placeholder="Especifica el otro anexo..."
                              className="w-full p-1 border rounded text-xs bg-white pl-6"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Observaciones */}
                  <div className="flex flex-col gap-3 bg-white p-5 rounded-xl border border-[#c1c6d7] shadow-sm">
                    <div className="text-xs font-bold text-[#0059bb] border-b pb-1.5 uppercase tracking-wide">Observaciones Generales (Sección 5)</div>
                    <textarea
                      rows={5}
                      value={observaciones}
                      onChange={e => setObservaciones(e.target.value)}
                      placeholder="Escribe cada observación en una línea nueva..."
                      className="w-full p-2.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-sky-500 font-mono"
                    />
                    <span className="text-[10px] text-gray-400">Cada salto de línea representará un renglón en la hoja impresa (máx 7 renglones).</span>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* LEFT SIDE FORM: Step 6 (Firmas y Cierre) */}
          {step === 6 && (
            <div className="w-[40%] border-r border-[#c1c6d7] bg-[#f7f9ff] p-6 flex flex-col overflow-y-auto custom-scrollbar">
              <div className="space-y-6">

                {/* 1. Estado de Validación */}
                <section>
                  <h2 className="font-semibold text-base mb-4 flex items-center gap-2 text-[#181c20]">
                    <span className="material-symbols-outlined text-[#0059bb]">verified_user</span>
                    Estado de Validación
                  </h2>
                  <div className="space-y-3">
                    <div className="bg-white p-3 rounded-lg border border-[#c1c6d7] flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-green-600">check_circle</span>
                        <span className="text-xs font-semibold text-[#181c20]">Carga de Épicas ({activeEpicRows.filter(r => r.desc).length}/6)</span>
                      </div>
                      <span className="text-[10px] font-bold bg-green-100 text-green-800 px-2 py-0.5 rounded-full">Integridad OK</span>
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-[#c1c6d7] flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-green-600">check_circle</span>
                        <span className="text-xs font-semibold text-[#181c20]">Validación de Firmas</span>
                      </div>
                      <span className="text-[10px] font-bold bg-green-100 text-green-800 px-2 py-0.5 rounded-full">Ready</span>
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-[#c1c6d7] flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-green-600">check_circle</span>
                        <span className="text-xs font-semibold text-[#181c20]">Conformidad Técnica</span>
                      </div>
                      <span className="text-[10px] font-bold bg-green-100 text-green-800 px-2 py-0.5 rounded-full">100% Score</span>
                    </div>
                  </div>
                </section>

                {/* 2. Resumen del Acta */}
                <section>
                  <h2 className="font-semibold text-base mb-4 flex items-center gap-2 text-[#181c20]">
                    <span className="material-symbols-outlined text-[#0059bb]">info</span>
                    Resumen del Acta
                  </h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#f1f4f9] p-4 rounded-xl border border-[#c1c6d7]">
                      <p className="text-[11px] text-[#414754] uppercase font-bold tracking-wider mb-1">Fecha Emisión</p>
                      <p className="font-semibold text-sm text-[#181c20]">{fecha}</p>
                    </div>
                    <div className="bg-[#f1f4f9] p-4 rounded-xl border border-[#c1c6d7]">
                      <p className="text-[11px] text-[#414754] uppercase font-bold tracking-wider mb-1">Cod. Operación</p>
                      <p className="font-semibold text-sm text-[#181c20]">{correlativo}</p>
                    </div>
                    <div className="bg-[#f1f4f9] p-4 rounded-xl col-span-2 border border-[#c1c6d7]">
                      <p className="text-[11px] text-[#414754] uppercase font-bold tracking-wider mb-1">Responsable Técnico</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-6 h-6 rounded-full bg-[#d8e2ff] text-[#0059bb] text-[10px] flex items-center justify-center font-bold">
                          {emisorInitials}
                        </div>
                        <p className="font-semibold text-sm text-[#181c20]">{firmaEmisorNombre}</p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* 3. Firmas Inputs */}
                <section className="bg-white p-4 rounded-xl border border-[#c1c6d7]">
                  <h3 className="font-bold text-xs text-[#0059bb] uppercase tracking-wider mb-3 border-b pb-1.5">Revisar Responsables de Firma</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold text-[#414754] uppercase tracking-wider mb-1">Firma Emisor (Blue)</label>
                      <input type="text" value={firmaEmisorNombre} onChange={e => setFirmaEmisorNombre(e.target.value)} className="w-full p-2 border rounded-lg text-xs" placeholder="Nombre" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#414754] uppercase tracking-wider mb-1">Firma Receptor (Cliente)</label>
                      <input type="text" value={firmaReceptorNombre} onChange={e => setFirmaReceptorNombre(e.target.value)} className="w-full p-2 border rounded-lg text-xs" placeholder="Nombre" />
                    </div>
                  </div>
                </section>

                {/* 4. Pendientes (Acciones correctivas) */}
                <section className="bg-white p-4 rounded-xl border border-[#c1c6d7]">
                  <div className="flex justify-between items-center mb-3 border-b pb-1.5">
                    <h3 className="font-bold text-xs text-[#0059bb] uppercase tracking-wider">Pendientes ({pendientes.length})</h3>
                    <button type="button" onClick={addPendiente} className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-200">
                      + Añadir
                    </button>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {pendientes.map(p => (
                      <div key={p.id} className="flex gap-1.5 items-center bg-[#f1f4f9] p-2 rounded-lg border border-slate-200 text-xs">
                        <input type="text" value={p.pendiente} onChange={e => updatePendiente(p.id, "pendiente", e.target.value)} className="flex-1 p-1 border rounded text-[11px] bg-white" placeholder="Pendiente" />
                        <input type="text" value={p.responsable} onChange={e => updatePendiente(p.id, "responsable", e.target.value)} className="w-20 p-1 border rounded text-[11px] bg-white" placeholder="Resp." />
                        <button type="button" onClick={() => removePendiente(p.id)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          )}

          {/* RIGHT SIDE: DOCUMENT PREVIEW (ONLY VISIBLE ON THE FINAL STEP 6) */}
          {step === 6 && (
            <div className="flex-1 p-8 bg-[#d7dadf] overflow-y-auto flex justify-center custom-scrollbar">

              <div id="acta-print-area" className="flex flex-col gap-6">

                {/* PAGE 1 PREVIEW */}
                <div className="document-canvas bg-white w-full min-w-[620px] max-w-[620px] h-[877px] p-8 relative flex flex-col justify-between shadow-lg text-[10px] leading-normal text-slate-800">
                  {/* Draft Watermark */}
                  {!isActaFinalizada && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-[0.025] pointer-events-none rotate-[-45deg] select-none">
                      <span className="text-8xl font-black">BORRADOR</span>
                    </div>
                  )}

                  <div className="flex flex-col gap-3">
                    {/* Header Logo & Banner */}
                    <div className="flex items-center justify-between border-b pb-3 border-slate-200">
                      <img src="/Logo_blue.png" alt="Blue Ingeniería" className="h-10 object-contain" />
                      <div className="bg-blue-corporate text-white text-[9px] px-3 py-1 font-semibold uppercase tracking-wider rounded-l">
                        Recepción conforme de bienes, servicios y documentos
                      </div>
                    </div>

                    {/* Title & Correlativo */}
                    <div className="text-center py-1 relative">
                      <h1 className="text-lg font-bold text-blue-corporate tracking-wide">ACTA DE ENTREGA</h1>
                      <span className="absolute right-0 top-1 text-base font-bold text-blue-corporate">{correlativo}</span>
                      <p className="text-[8px] text-gray-500 italic mt-0.5">
                        Formato profesional para recepción formal, trazabilidad documental y cierre de entrega.
                      </p>
                    </div>

                    {/* Metadata Table */}
                    <table className="w-full border border-slate-200 text-[8.5px] text-left border-collapse">
                      <thead>
                        <tr className="bg-blue-light text-slate-500 font-bold uppercase">
                          <th className="border border-slate-200 p-1 w-1/4">CORRELATIVO</th>
                          <th className="border border-slate-200 p-1 w-1/4">FECHA</th>
                          <th className="border border-slate-200 p-1 w-1/4">VERSIÓN</th>
                          <th className="border border-slate-200 p-1 w-1/4">ESTADO</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="font-bold text-slate-800">
                          <td className="border border-slate-200 p-1">{correlativo}</td>
                          <td className="border border-slate-200 p-1">{fecha}</td>
                          <td className="border border-slate-200 p-1">{version}</td>
                          <td className="border border-slate-200 p-1 text-blue-corporate">{estadoActa}</td>
                        </tr>
                      </tbody>
                    </table>

                    {/* 1. DATOS DE IDENTIFICACIÓN */}
                    <div className="flex flex-col gap-1">
                      <h2 className="text-[10px] font-bold text-blue-corporate uppercase tracking-wider">1. Datos de Identificación</h2>
                      <table className="w-full border border-slate-200 text-[8.5px] border-collapse">
                        <thead>
                          <tr className="text-white font-bold text-center">
                            <th colSpan="2" className="bg-blue-header border border-slate-300 p-1 uppercase">Empresa que Entrega</th>
                            <th colSpan="2" className="bg-blue-corporate border border-slate-300 p-1 uppercase">Receptor / Cliente</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="bg-blue-light font-bold p-1 border border-slate-200 w-1/6">Razón social</td>
                            <td className="p-1 border border-slate-200 w-2/6 font-medium">{empresaRazon}</td>
                            <td className="bg-blue-light font-bold p-1 border border-slate-200 w-1/6">Razón social</td>
                            <td className="p-1 border border-slate-200 w-2/6 font-medium">{clienteRazon}</td>
                          </tr>
                          <tr>
                            <td className="bg-blue-light font-bold p-1 border border-slate-200">RUT</td>
                            <td className="p-1 border border-slate-200 font-medium">{empresaRut}</td>
                            <td className="bg-blue-light font-bold p-1 border border-slate-200">RUT</td>
                            <td className="p-1 border border-slate-200 font-medium">{clienteRut}</td>
                          </tr>
                          <tr>
                            <td className="bg-blue-light font-bold p-1 border border-slate-200">Dirección</td>
                            <td className="p-1 border border-slate-200 font-medium text-[8px]">{empresaDir}</td>
                            <td className="bg-blue-light font-bold p-1 border border-slate-200">Dirección</td>
                            <td className="p-1 border border-slate-200 font-medium text-[8px]">{clienteDir || "—"}</td>
                          </tr>
                          <tr>
                            <td className="bg-blue-light font-bold p-1 border border-slate-200 text-[8px]">Sucursal op.</td>
                            <td className="p-1 border border-slate-200 font-medium text-[8px]">{empresaSucursal}</td>
                            <td className="bg-blue-light font-bold p-1 border border-slate-200">Representante</td>
                            <td className="p-1 border border-slate-200 font-medium">{clienteRep || "—"}</td>
                          </tr>
                          <tr>
                            <td className="bg-blue-light font-bold p-1 border border-slate-200 text-[8px]">Resp. entrega</td>
                            <td className="p-1 border border-slate-200 font-medium text-[8.5px]">{empresaResp}</td>
                            <td className="bg-blue-light font-bold p-1 border border-slate-200 text-[8.5px]">Cargo / área</td>
                            <td className="p-1 border border-slate-200 font-medium text-[8.5px]">{clienteRepCargo || "—"}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* 2. ANTECEDENTES */}
                    <div className="flex flex-col gap-1">
                      <h2 className="text-[10px] font-bold text-blue-corporate uppercase tracking-wider">2. Antecedentes de la Entrega</h2>
                      <table className="w-full border border-slate-200 text-[8.5px] border-collapse">
                        <tbody>
                          <tr>
                            <td className="bg-blue-light font-bold p-1 border border-slate-200 w-1/6">Proy. / Serv.</td>
                            <td className="p-1 border border-slate-200 w-2/6 font-medium">{proyectoServicio}</td>
                            <td className="bg-blue-light font-bold p-1 border border-slate-200 w-1/6">OC</td>
                            <td className="p-1 border border-slate-200 w-2/6 font-medium">{oc || "—"}</td>
                          </tr>
                          <tr>
                            <td className="bg-blue-light font-bold p-1 border border-slate-200">Lug. entrega</td>
                            <td className="p-1 border border-slate-200 font-medium text-[8px]">{lugarEntrega}</td>
                            <td className="bg-blue-light font-bold p-1 border border-slate-200">Fecha y hora</td>
                            <td className="p-1 border border-slate-200 font-medium">{fechaHora}</td>
                          </tr>
                          <tr>
                            <td className="bg-blue-light font-bold p-1 border border-slate-200">Tip. entrega</td>
                            <td className="p-1 border border-slate-200 font-medium">{tipoEntrega}</td>
                            <td className="bg-blue-light font-bold p-1 border border-slate-200">Condición</td>
                            <td className="p-1 border border-slate-200 font-medium">{condicionEntrega}</td>
                          </tr>
                          <tr>
                            <td className="bg-blue-light font-bold p-1 border border-slate-200">Med. respaldo</td>
                            <td className="p-1 border border-slate-200 font-medium">{medioRespaldo}</td>
                            <td className="bg-blue-light p-1 border border-slate-200"></td>
                            <td className="p-1 border border-slate-200"></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* 3. DETALLE BIENES */}
                    <div className="flex flex-col gap-1">
                      <h2 className="text-[10px] font-bold text-blue-corporate uppercase tracking-wider">3. Detalle de Bienes, Equipos o Documentos Entregados</h2>
                      <table className="w-full text-left text-[8px] border border-slate-200 border-collapse">
                        <thead>
                          <tr className="bg-blue-corporate text-white font-bold text-center">
                            <th className="border border-slate-300 p-1 w-8">Ítem</th>
                            <th className="border border-slate-300 p-1 text-left">Descripción</th>
                            <th className="border border-slate-300 p-1 w-10">Cant.</th>
                            <th className="border border-slate-300 p-1 w-10">COT</th>
                            <th className="border border-slate-300 p-1 w-16">Estado</th>
                            <th className="border border-slate-300 p-1 text-left">Obs. breve</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeEpicRows.map((row, idx) => (
                            <tr key={idx} className="h-6 border-b text-slate-800">
                              <td className="border border-slate-200 p-0.5 font-bold text-center bg-blue-light/20">{row.item}</td>
                              <td className="border border-slate-200 p-0.5 font-medium truncate max-w-[150px]">{row.desc}</td>
                              <td className="border border-slate-200 p-0.5 text-center">{row.cant}</td>
                              <td className="border border-slate-200 p-0.5 text-center">{row.cot}</td>
                              <td className="border border-slate-200 p-0.5 text-center font-bold text-blue-corporate bg-slate-50/50">{row.estado}</td>
                              <td className="border border-slate-200 p-0.5 text-gray-500 truncate max-w-[120px]">{row.obs}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* 4. CRITERIOS DE RECEPCIÓN */}
                    <div className="flex flex-col gap-1">
                      <h2 className="text-[10px] font-bold text-blue-corporate uppercase tracking-wider">4. Criterios de Recepción</h2>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 border border-slate-200 p-2 bg-slate-50 text-[7.5px] leading-tight text-slate-600">
                        {criterios.map(c => (
                          <div key={c.id} className="flex items-start gap-1">
                            <span className="font-mono text-xs -mt-1">{c.checked ? "☑" : "☐"}</span>
                            <span className="truncate max-w-[250px]">{c.texto}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Footer Page 1 */}
                  <div className="border-t pt-1 border-slate-200 flex justify-between items-center text-[8px] text-gray-400 font-medium">
                    <span>Blue Ingeniería SpA | RUT 78.115.957-3</span>
                    <span>{correlativo}</span>
                  </div>
                </div>

                {/* PAGE 2 PREVIEW */}
                <div className="document-canvas bg-white w-full min-w-[620px] max-w-[620px] h-[877px] p-8 relative flex flex-col justify-between shadow-lg text-[10px] leading-normal text-slate-800">
                  {/* Draft Watermark */}
                  {!isActaFinalizada && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-[0.025] pointer-events-none rotate-[-45deg] select-none">
                      <span className="text-8xl font-black">BORRADOR</span>
                    </div>
                  )}

                  <div className="flex flex-col gap-3">
                    {/* Header Logo & Banner */}
                    <div className="flex items-center justify-between border-b pb-3 border-slate-200">
                      <img src="/Logo_blue.png" alt="Blue Ingeniería" className="h-10 object-contain" />
                      <div className="bg-blue-corporate text-white text-[9px] px-3 py-1 font-semibold uppercase tracking-wider rounded-l">
                        Recepción conforme de bienes, servicios y documentos
                      </div>
                    </div>

                    {/* Correlativo Page 2 Header */}
                    <div className="flex justify-between items-center text-[8px] pb-0.5 text-slate-500 border-b border-dashed border-slate-100">
                      <span>Blue Ingeniería SpA | RUT 78.115.957-3</span>
                      <span className="font-bold text-blue-corporate">{correlativo}</span>
                    </div>

                    {/* 5. OBSERVACIONES GENERALES */}
                    <div className="flex flex-col gap-1">
                      <h2 className="text-[10px] font-bold text-blue-corporate uppercase tracking-wider">5. Observaciones Generales</h2>
                      <p className="text-[8px] text-gray-500 italic mb-0.5">
                        Use este espacio para registrar observaciones, diferencias de cantidad, estado físico, pendientes menores o condiciones detectadas al momento de la recepción.
                      </p>
                      <div className="border border-slate-200 rounded p-1 bg-slate-50/50 flex flex-col">
                        {observationsLines.map((line, idx) => (
                          <div key={idx} className="notebook-line !height-6 !line-height-6 text-[10px] px-2 truncate">
                            {line}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 6. PENDIENTES */}
                    <div className="flex flex-col gap-1">
                      <h2 className="text-[10px] font-bold text-blue-corporate uppercase tracking-wider">6. Pendientes o Acciones Correctivas</h2>
                      <table className="w-full text-left text-[8px] border border-slate-200 border-collapse">
                        <thead>
                          <tr className="bg-blue-corporate text-white font-bold text-center">
                            <th className="border border-slate-300 p-1">Pendiente / acción requerida</th>
                            <th className="border border-slate-300 p-1 w-24 text-left">Responsable</th>
                            <th className="border border-slate-300 p-1 w-24">Fecha compromiso</th>
                            <th className="border border-slate-300 p-1 w-16">Cierre</th>
                          </tr>
                        </thead>
                        <tbody>
                          {printedPendientes.map((p, idx) => (
                            <tr key={idx} className="h-6 border-b text-slate-800">
                              <td className="border border-slate-200 p-0.5 truncate max-w-[200px]">{p.pendiente}</td>
                              <td className="border border-slate-200 p-0.5 text-left truncate max-w-[100px]">{p.responsable}</td>
                              <td className="border border-slate-200 p-0.5 text-center">{p.fecha}</td>
                              <td className="border border-slate-200 p-0.5 text-center">{p.cierre}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* 7. DOCUMENTOS ANEXOS */}
                    <div className="flex flex-col gap-1">
                      <h2 className="text-[10px] font-bold text-blue-corporate uppercase tracking-wider">7. Documentos Anexos</h2>
                      <div className="grid grid-cols-3 gap-y-1 border border-slate-200 p-2 bg-slate-50 text-[7.5px] text-slate-600">
                        {anexos.map(a => (
                          <div key={a.id} className="flex items-center gap-1">
                            <span className="font-mono text-xs">{a.checked ? "☑" : "☐"}</span>
                            <span>
                              {a.texto.toLowerCase().includes("otro") ? `Otro: ${a.checked ? (a.valor || "____") : "____"}` : a.texto}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 8. DECLARACIÓN DE CONFORMIDAD */}
                    <div className="flex flex-col gap-1">
                      <h2 className="text-[10px] font-bold text-blue-corporate uppercase tracking-wider">8. Declaración de Conformidad</h2>
                      <div className="border border-slate-200 rounded p-2 bg-blue-light/20 text-[8px] leading-relaxed text-slate-600">
                        {declaracion}
                      </div>
                    </div>

                    {/* 9. FIRMAS DE CONFORMIDAD */}
                    <div className="flex flex-col gap-1">
                      <h2 className="text-[10px] font-bold text-blue-corporate uppercase tracking-wider">9. Firmas de Conformidad</h2>
                      <div className="grid grid-cols-2 border border-slate-200 text-[8px] h-24">
                        <div className="border-r border-slate-200 p-2 flex flex-col justify-between">
                          <div className="font-bold text-[8px] text-blue-corporate border-b pb-0.5 text-center uppercase tracking-wide">
                            ENTREGA - BLUE INGENIERÍA
                          </div>
                          <div className="text-center text-slate-400 italic">
                            Firma: ________________________
                          </div>
                          <div className="flex flex-col gap-0.5 text-[7.5px]">
                            <div>Nombre: <span className="font-bold">{firmaEmisorNombre}</span></div>
                            <div>Cargo: <span>{firmaEmisorCargo}</span></div>
                            <div>RUT: <span>{firmaEmisorRut}</span></div>
                          </div>
                        </div>
                        <div className="p-2 flex flex-col justify-between">
                          <div className="font-bold text-[8px] text-blue-corporate border-b pb-0.5 text-center uppercase tracking-wide">
                            RECIBE - CLIENTE / RECEPTOR
                          </div>
                          <div className="text-center text-slate-400 italic">
                            Firma: ________________________
                          </div>
                          <div className="flex flex-col gap-0.5 text-[7.5px]">
                            <div>Nombre: <span className="font-bold">{firmaReceptorNombre}</span></div>
                            <div>Cargo: <span>{firmaReceptorCargo}</span></div>
                            <div>RUT: <span>{firmaReceptorRut}</span></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer Page 2 */}
                  <div className="border-t pt-1 border-slate-200 flex justify-between items-center text-[8px] text-gray-400 font-medium">
                    <span>Blue Ingeniería SpA | RUT 78.115.957-3</span>
                    <span>{correlativo}</span>
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>

        {/* Modal Footer (Actions) */}
        <div className="px-6 py-4 bg-[#ffffff] border-t border-[#c1c6d7] flex justify-between items-center">
          <button
            type="button"
            disabled={step === 1}
            onClick={() => setStep(s => Math.max(1, s - 1))}
            className="px-6 py-2 rounded-lg border border-[#0059bb] text-[#0059bb] font-bold hover:bg-[#0059bb]/5 transition-all flex items-center gap-2 active:scale-95 duration-100 disabled:opacity-30 disabled:pointer-events-none hover:cursor-pointer"
          >
            <span className="material-symbols-outlined">arrow_back</span>
            <span>{step === 6 ? "Volver a Firmas" : "Anterior"}</span>
          </button>

          <div className="flex gap-4">
            {step === 6 && (
              <>
                <button
                  type="button"
                  onClick={handleDownloadPDF}
                  disabled={downloading}
                  className="px-6 py-2 rounded-lg border border-[#717786] text-[#414754] font-bold hover:bg-[#e0e3e8] flex items-center gap-2 active:scale-95 duration-100 hover:cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined">download</span>
                  <span>{downloading ? "Descargando..." : "Descargar PDF"}</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-6 py-2 rounded-lg border border-[#717786] text-[#414754] font-bold hover:bg-[#e0e3e8] flex items-center gap-2 active:scale-95 duration-100 hover:cursor-pointer"
                >
                  <span className="material-symbols-outlined">print</span>
                  <span>Imprimir Acta</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => {
                if (step < 6) {
                  if (step === 4) {
                    const hasSelected = Object.values(selectedEpicas).some(v => v === true);
                    if (!hasSelected) {
                      alert("Por obligación debe seleccionar al menos 1 épica para continuar con el acta.");
                      return;
                    }
                  }
                  setStep(s => s + 1);
                } else {
                  executeFinalizeActa();
                }
              }}
              disabled={isFinishing}
              className={`px-8 py-2 rounded-lg font-bold text-white shadow-md flex items-center gap-2 active:scale-95 duration-100 hover:cursor-pointer ${isActaFinalizada
                ? "bg-green-600 hover:bg-green-700"
                : "bg-[#0059bb] hover:bg-[#0070ea]"
                }`}
            >
              {isFinishing ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Procesando...</span>
                </>
              ) : isActaFinalizada ? (
                <>
                  <span className="material-symbols-outlined">check_circle</span>
                  <span>¡Acta Finalizada!</span>
                </>
              ) : step === 6 ? (
                <>
                  <span>Guardar</span>
                  <span className="material-symbols-outlined">history_edu</span>
                </>
              ) : (
                <>
                  <span>Siguiente</span>
                  <span className="material-symbols-outlined">arrow_forward</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
