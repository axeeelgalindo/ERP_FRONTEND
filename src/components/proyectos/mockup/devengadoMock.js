// src/mocks/devengadoMock.js
// Mock generator coherente con tu schema Prisma (frontend-only)

function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// pick seguro (si arr está vacío, devuelve null)
function pick(rng, arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr[Math.floor(rng() * arr.length)];
}

function int(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function round0(n) {
  return Math.round(Number(n || 0));
}

function cuidLike(rng, prefix = "cm") {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const len = 25;
  let s = prefix;
  for (let i = 0; i < len; i++) s += chars[Math.floor(rng() * chars.length)];
  return s;
}

function addDays(d, days) {
  const x = new Date(d);
  x.setDate(x.getDate() + Number(days || 0));
  return x;
}

function startOfMonthUTC(y, m1to12) {
  return new Date(Date.UTC(y, m1to12 - 1, 1, 12, 0, 0));
}

function endOfMonthUTC(y, m1to12) {
  return new Date(Date.UTC(y, m1to12, 0, 12, 0, 0));
}

function daysInMonth(y, m1to12) {
  return new Date(y, m1to12, 0).getDate();
}

// =======================
// LÓGICA DEVENGADO (simple y útil)
// =======================
// - Devengado % por proyecto: promedio ponderado por costo_plan (o horas_plan) a nivel subtarea
// - Devengado $: venta_total_proyecto * devengado_pct
// - Costo real: HH (costoHH*cant + CIF) + Compras (precio_unit*cant)
// - Utilidad estimada: devengado$ - costo_real_acumulado
function calcDevengadoProyecto({
  proyecto,
  epicas,
  tareas,
  detalles,
  ventasByProyectoId,
  comprasByProyectoId,
}) {
  const dets = detalles.filter((d) => {
    const t = tareas.find((x) => x.id === d.tarea_id);
    return t?.proyecto_id === proyecto.id;
  });

  // base de ponderación: costo_plan si existe, si no horas_plan, si no 1
  let wSum = 0;
  let wProg = 0;

  for (const d of dets) {
    const w = Number(d.costo_plan ?? 0) || Number(d.horas_plan ?? 0) || 1;
    const prog = clamp(Number(d.avance ?? 0), 0, 100) / 100;
    wSum += w;
    wProg += w * prog;
  }

  const devPct = wSum > 0 ? wProg / wSum : 0;

  // ventas (base neta)
  const ventas = ventasByProyectoId.get(proyecto.id) || [];
  const ventaTotal = ventas.reduce(
    (acc, v) => acc + Number(v._totalFinal || 0),
    0,
  );

  // compras (costo real compra)
  const compras = comprasByProyectoId.get(proyecto.id) || [];
  const compraCosto = compras.reduce((acc, c) => acc + Number(c.total || 0), 0);

  // HH real (desde detalles de venta HH)
  const hhCosto = ventas.reduce((acc, v) => {
    const ds = v.detalles || [];
    for (const it of ds) acc += Number(it.costoTotal || 0);
    return acc;
  }, 0);

  const costoReal = compraCosto + hhCosto;
  const devengadoMonto = ventaTotal * devPct;
  const utilidadEstim = devengadoMonto - costoReal;

  return {
    proyecto_id: proyecto.id,
    devengado_pct: devPct,
    venta_total: ventaTotal,
    devengado_monto: devengadoMonto,
    costo_real: costoReal,
    utilidad_estimada: utilidadEstim,
  };
}

// =======================
// GENERADOR PRINCIPAL
// =======================
export function makeDevengadoMock({
  seed = 20260302,
  anio = 2026,
  mes = 3,
  nProyectos = 3,
  empresaNombre = "Blueinge SpA",
} = {}) {
  const rng = mulberry32(seed);

  const empresa = {
    id: cuidLike(rng),
    nombre: empresaNombre,
    rut: "76.123.456-7",
    correo: "contacto@blueinge.com",
    telefono: "+56 9 1234 5678",
    activa: true,
    creada_en: new Date(),
    actualizada_en: new Date(),
    eliminado: false,
    eliminado_en: null,
  };

  // Roles/Usuarios/Empleados (mínimo para que todo “respire”)
  const rolAdmin = {
    id: cuidLike(rng),
    nombre: "ADMIN",
    codigo: "ADMIN",
    activo: true,
  };
  const rolUser = {
    id: cuidLike(rng),
    nombre: "USER",
    codigo: "USER",
    activo: true,
  };

  const nombres = [
    "Axel",
    "Daniela",
    "Camila",
    "Ignacio",
    "Francisca",
    "Matías",
    "Javiera",
    "Sebastián",
  ];
  const apellidos = [
    "González",
    "Pérez",
    "Muñoz",
    "Rojas",
    "Díaz",
    "Soto",
    "Contreras",
    "Vargas",
  ];

  const usuarios = [];
  const empleados = [];

  const nEmpleados = 6;
  for (let i = 0; i < nEmpleados; i++) {
    const nom = `${pick(rng, nombres)} ${pick(rng, apellidos)}`;
    const correo = `user${i + 1}@blueinge.com`;

    const u = {
      id: cuidLike(rng),
      empresa_id: empresa.id,
      rol_id: i === 0 ? rolAdmin.id : rolUser.id,
      nombre: nom,
      correo,
      contrasena: "HASHED",
      creado_en: new Date(),
      actualizado_en: new Date(),
      eliminado: false,
      eliminado_en: null,
    };
    usuarios.push(u);

    const e = {
      id: cuidLike(rng),
      usuario_id: u.id,
      rut: `${int(rng, 10, 25)}.${int(rng, 100, 999)}.${int(rng, 100, 999)}-${int(rng, 0, 9)}`,
      cargo: pick(rng, [
        "Dev Fullstack",
        "PM",
        "QA",
        "Dev Backend",
        "Dev Frontend",
        "Diseño UX",
      ]),
      telefono: `+56 9 ${int(rng, 1000, 9999)} ${int(rng, 1000, 9999)}`,
      fecha_ingreso: addDays(new Date(), -int(rng, 60, 800)),
      sueldo_base: int(rng, 900000, 2200000),
      activo: true,
      creado_en: new Date(),
      actualizado_en: new Date(),
      eliminado: false,
      eliminado_en: null,
    };
    empleados.push(e);
  }

  // Cliente + responsable
  const cliente = {
    id: cuidLike(rng),
    empresa_id: empresa.id,
    nombre: pick(rng, [
      "AquaChile",
      "Salmones Sur",
      "Pesquera Austral",
      "Municipalidad",
      "Constructora Los Lagos",
    ]),
    rut: "76.999.888-1",
    correo: "contacto@cliente.cl",
    telefono: "+56 9 9988 7766",
    notas: "Cliente de prueba (mock)",
    logo_url: null,
    logo_public_id: null,
    creado_en: new Date(),
    actualizado_en: new Date(),
    eliminado: false,
    eliminado_en: null,
  };

  const clienteResponsable = {
    id: cuidLike(rng),
    cliente_id: cliente.id,
    nombre: pick(rng, [
      "Erika Ojeda",
      "Esteban Barría",
      "Constanza Loaiza",
      "María López",
    ]),
    correo: "responsable@cliente.cl",
    telefono: "+56 9 1111 2222",
    cargo: "Encargado/a",
    area: "Operaciones",
    es_principal: true,
    creado_en: new Date(),
    actualizado_en: new Date(),
    eliminado: false,
    eliminado_en: null,
  };

  // Catálogos
  const unidadHora = {
    id: cuidLike(rng),
    empresa_id: empresa.id,
    nombre: "Hora",
    eliminado: false,
    eliminado_en: null,
  };
  const unidadUn = {
    id: cuidLike(rng),
    empresa_id: empresa.id,
    nombre: "Unidad",
    eliminado: false,
    eliminado_en: null,
  };

  const tipoItemHH = {
    id: cuidLike(rng),
    empresa_id: empresa.id,
    nombre: "HH",
    codigo: "HH",
    porcentajeUtilidad: 0,
    unidadItemId: unidadHora.id,
    eliminado: false,
    eliminado_en: null,
  };

  const tipoItemMaterial = {
    id: cuidLike(rng),
    empresa_id: empresa.id,
    nombre: "Materiales",
    codigo: "MATERIAL",
    porcentajeUtilidad: 0,
    unidadItemId: unidadUn.id,
    eliminado: false,
    eliminado_en: null,
  };

  const tipoDiaNormal = {
    id: cuidLike(rng),
    empresa_id: empresa.id,
    nombre: "Normal",
    valor: 0,
    eliminado: false,
  };
  const tipoDiaFeriado = {
    id: cuidLike(rng),
    empresa_id: empresa.id,
    nombre: "Feriado",
    valor: 25000,
    eliminado: false,
  };
  const tipoDiaUrgencia = {
    id: cuidLike(rng),
    empresa_id: empresa.id,
    nombre: "Urgencia",
    valor: 40000,
    eliminado: false,
  };

  // CIF + HHEmpleado del periodo
  const cif = {
    id: cuidLike(rng),
    empresa_id: empresa.id,
    anio,
    mes,
    valor: int(rng, 120000, 420000),
    nota: `CIF ${mes}/${anio} (mock)`,
    creado_en: new Date(),
  };

  const hhEmpleados = [];
  const nombreMeses = [
    "",
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];
  const nombrePeriodo = `${nombreMeses[mes]} ${anio}`;
  const horasMensuales = 180;
  const horasEfectivas = 150;

  for (const emp of empleados) {
    const pagado = int(rng, 900000, 2600000);
    const feriado = round0(pagado * 0.08);
    const indemnizacion = round0(pagado * 0.06);
    const total = pagado + feriado + indemnizacion;
    const costoHH = total / horasEfectivas;

    hhEmpleados.push({
      id: cuidLike(rng),
      empresa_id: empresa.id,
      empleado_id: emp.id,
      anio,
      mes,
      nombre_periodo: nombrePeriodo,
      nombre: emp?.usuario_id
        ? usuarios.find((u) => u.id === emp.usuario_id)?.nombre
        : null,
      rut: emp.rut,
      dias_trabajados: int(rng, 18, 22),
      haberes: pagado,
      empleador: int(rng, 80000, 240000),
      pagado,
      feriado,
      indemnizacion,
      total,
      costoHH,
      horasMensuales,
      horasEfectivas,
      raw: { mock: true },
      cif_id: cif.id,
      creado_en: new Date(),
      actualizado_en: new Date(),
    });
  }

  // Proveedores + Productos
  const proveedor = {
    id: cuidLike(rng),
    empresa_id: empresa.id,
    nombre: pick(rng, [
      "PC Factory",
      "TecnoSur",
      "Distribuidora Osorno",
      "Sodimac Empresa",
    ]),
    rut: "76.555.444-3",
    correo: "ventas@proveedor.cl",
    telefono: "+56 9 3333 4444",
    notas: "Proveedor mock",
    creado_en: new Date(),
    actualizado_en: new Date(),
    eliminado: false,
    eliminado_en: null,
  };

  const productos = Array.from({ length: 6 }).map((_, i) => ({
    id: cuidLike(rng),
    empresa_id: empresa.id,
    nombre: pick(rng, [
      "Router",
      "Switch",
      "Cámara IP",
      "SSD",
      "Cable UTP",
      "UPS",
    ]),
    sku: `SKU-${i + 1}`,
    precio: int(rng, 15000, 220000),
    stock: int(rng, 0, 12),
    creado_en: new Date(),
    actualizado_en: new Date(),
    eliminado: false,
    eliminado_en: null,
  }));

  // =======================
  // Proyectos + miembros + épicas + tareas + detalles
  // =======================
  const proyectos = [];
  const proyectoMiembros = [];
  const epicas = [];
  const tareas = [];
  const tareaDetalles = [];
  const tareaHistorial = [];

  const monthStart = startOfMonthUTC(anio, mes);
  const monthEnd = endOfMonthUTC(anio, mes);
  const dim = daysInMonth(anio, mes);

  for (let p = 0; p < nProyectos; p++) {
    const proyecto = {
      id: cuidLike(rng),
      empresa_id: empresa.id,
      nombre:
        pick(rng, [
          "ERP Blueinge - Módulo Proyectos",
          "SEST 2.0 - Devengado",
          "Mooh - Alarmas",
          "Captaciones - PreSiniestro",
        ]) + ` #${p + 1}`,
      descripcion: "Proyecto mock para visualizar devengado",
      presupuesto: int(rng, 8000000, 42000000),
      estado: "activo",
      fecha_inicio_plan: addDays(monthStart, int(rng, -15, 5)),
      fecha_fin_plan: addDays(monthEnd, int(rng, 10, 45)),
      dias_plan: int(rng, dim, dim + 35),
      fecha_inicio_real: addDays(monthStart, int(rng, -10, 10)),
      fecha_fin_real: null,
      dias_reales: null,
      creada_en: new Date(),
      actualizado_en: new Date(),
      eliminado: false,
      eliminado_en: null,
    };
    proyectos.push(proyecto);

    // miembros (3-4)
    const miembros = [...empleados]
      .sort(() => rng() - 0.5)
      .slice(0, int(rng, 3, 4));
    for (const m of miembros) {
      proyectoMiembros.push({
        id: cuidLike(rng),
        proyecto_id: proyecto.id,
        empleado_id: m.id,
        rol: pick(rng, ["Owner", "Dev", "QA", "PM"]),
        creado_en: new Date(),
      });
    }

    // épicas (2-3)
    const nEp = int(rng, 2, 3);
    for (let e = 0; e < nEp; e++) {
      const epica = {
        id: cuidLike(rng),
        proyecto_id: proyecto.id,
        nombre:
          pick(rng, [
            "Planificación",
            "Implementación",
            "Integración",
            "QA/Deploy",
          ]) + ` (${e + 1})`,
        descripcion: "Épica mock",
        estado: pick(rng, [
          "pendiente",
          "en_progreso",
          "bloqueada",
          "terminada",
        ]),
        avance: int(rng, 5, 95),
        orden: e,
        fecha_inicio_plan: addDays(proyecto.fecha_inicio_plan, int(rng, 0, 10)),
        fecha_fin_plan: addDays(proyecto.fecha_inicio_plan, int(rng, 20, 45)),
        dias_plan: int(rng, 15, 40),
        fecha_inicio_real: addDays(proyecto.fecha_inicio_real, int(rng, 0, 10)),
        fecha_fin_real: null,
        dias_reales: null,
        source: "MANUAL",
        jira_key: `EPIC-${int(rng, 100, 999)}`,
        jira_estado: "In Progress",
        jira_sprint: `Sprint ${int(rng, 1, 6)}`,
        jira_issue_color: "#4F46E5",
        creado_en: new Date(),
        actualizado_en: new Date(),
        eliminado: false,
        eliminado_en: null,
      };
      epicas.push(epica);

      // tareas por épica (2-4)
      const nTa = int(rng, 2, 4);
      for (let t = 0; t < nTa; t++) {
        const responsable = pick(rng, miembros);
        const diasPlan = int(rng, 5, 18);
        const inicioPlan = addDays(
          monthStart,
          int(rng, 0, Math.max(1, dim - 10)),
        );
        const finPlan = addDays(inicioPlan, diasPlan);

        const avance = int(rng, 0, 100);
        const estado =
          avance >= 100
            ? "terminada"
            : avance >= 40
              ? "en_progreso"
              : "pendiente";

        const tarea = {
          id: cuidLike(rng),
          proyecto_id: proyecto.id,
          nombre:
            pick(rng, [
              "Implementar endpoint",
              "Armar UI",
              "Sync Jira",
              "Optimizar query",
              "Devengado dashboard",
            ]) + ` ${t + 1}`,
          descripcion: "Tarea mock",
          responsable_id: responsable?.id ?? null,
          epica_id: epica.id,
          prioridad: pick(rng, [1, 2, 3]),
          estado,
          avance,
          es_hito: rng() < 0.15,
          orden: t,
          fecha_inicio_plan: inicioPlan,
          fecha_fin_plan: finPlan,
          dias_plan: diasPlan,
          fecha_inicio_real:
            rng() < 0.7 ? addDays(inicioPlan, int(rng, -2, 5)) : null,
          fecha_fin_real:
            avance >= 100 ? addDays(finPlan, int(rng, -2, 8)) : null,
          dias_reales: avance >= 100 ? diasPlan + int(rng, -2, 6) : null,

          total_horas_plan: null,
          total_horas_reales: null,
          total_costo_plan: null,
          total_costo_real: null,

          source: "MANUAL",
          jira_key: `TASK-${int(rng, 1000, 9999)}`,
          jira_tipo: "Task",
          jira_estado: "In Progress",
          jira_sprint: `Sprint ${int(rng, 1, 6)}`,
          jira_issue_color: "#16A34A",

          parent_id: null,
          creado_en: new Date(),
          actualizado_en: new Date(),
          eliminado: false,
          eliminado_en: null,

          dias_desviacion: null,
        };
        tareas.push(tarea);

        // historial (2-3 eventos)
        const actor = pick(rng, usuarios);
        tareaHistorial.push({
          id: cuidLike(rng),
          empresa_id: empresa.id,
          proyecto_id: proyecto.id,
          tarea_id: tarea.id,
          tipo: "ESTADO",
          from_estado: "pendiente",
          to_estado: estado,
          from_avance: 0,
          to_avance: avance,
          source: "ERP",
          actor_id: actor.id,
          metadata: { mock: true },
          occurred_at: addDays(new Date(), -int(rng, 1, 30)),
        });

        // subtareas (2-5)
        const nDet = int(rng, 2, 5);
        for (let d = 0; d < nDet; d++) {
          const detResp = rng() < 0.75 ? pick(rng, miembros) : null;
          const detDias = int(rng, 2, 8);
          const detInicio = addDays(
            inicioPlan,
            int(rng, 0, Math.max(1, diasPlan - 1)),
          );
          const detFin = addDays(detInicio, detDias);

          const detAv = clamp(avance + int(rng, -25, 25), 0, 100);
          const detEstado =
            detAv >= 100
              ? "terminada"
              : detAv >= 40
                ? "en_progreso"
                : "pendiente";

          const horasPlan = int(rng, 6, 28);
          const horasReal =
            detAv > 0
              ? Math.max(0, round0(horasPlan * (detAv / 100) + int(rng, -3, 6)))
              : null;

          // valor hora “mock”: derivado de HHEmpleado del responsable (si existe)
          let valorHora = null;
          if (detResp) {
            const hh = hhEmpleados.find((x) => x.empleado_id === detResp.id);
            valorHora = hh ? Number(hh.costoHH) : null;
          }

          const costoPlan = valorHora != null ? valorHora * horasPlan : null;
          const costoReal =
            valorHora != null && horasReal != null
              ? valorHora * horasReal
              : null;

          tareaDetalles.push({
            id: cuidLike(rng),
            tarea_id: tarea.id,
            titulo:
              pick(rng, [
                "Definir DTO",
                "Armar tabla",
                "Validaciones",
                "Seed de pruebas",
                "Fix UI responsive",
              ]) + ` (${d + 1})`,
            descripcion: "Subtarea mock",
            responsable_id: detResp?.id ?? null,
            estado: detEstado,
            avance: detAv,
            fecha_inicio_plan: detInicio,
            fecha_fin_plan: detFin,
            dias_plan: detDias,
            fecha_inicio_real:
              rng() < 0.6 ? addDays(detInicio, int(rng, -1, 4)) : null,
            fecha_fin_real:
              detAv >= 100 ? addDays(detFin, int(rng, -1, 4)) : null,
            dias_reales: detAv >= 100 ? detDias + int(rng, -1, 4) : null,
            horas_plan: horasPlan,
            horas_real: horasReal,
            valor_hora: valorHora,
            costo_plan: costoPlan,
            costo_real: costoReal,
            dias_desviacion: detAv >= 100 ? int(rng, -2, 6) : null,
            source: "MANUAL",
            jira_key: `SUB-${int(rng, 10000, 99999)}`,
            jira_tipo: "Sub-task",
            jira_estado: "In Progress",
            jira_sprint: `Sprint ${int(rng, 1, 6)}`,
            jira_issue_color: "#F59E0B",
            creado_en: new Date(),
            actualizado_en: new Date(),
            eliminado: false,
            eliminado_en: null,
          });
        }
      }
    }
  }

  // =======================
  // Compras + CompraItems (asociadas a proyecto)
  // =======================
  const compras = [];
  const compraItems = [];

  for (const pr of proyectos) {
    const nCompras = int(rng, 1, 2);
    for (let i = 0; i < nCompras; i++) {
      const compraId = cuidLike(rng);
      const items = Array.from({ length: int(rng, 2, 4) }).map(() => {
        const prod = pick(rng, productos);
        const cantidad = int(rng, 1, 6);
        const precio_unit = round0(Number(prod.precio) * (0.85 + rng() * 0.35));
        return {
          id: cuidLike(rng),
          compra_id: compraId,
          producto_id: prod.id,
          proveedor_id: proveedor.id,
          item: prod.nombre,
          cantidad,
          precio_unit,
          total: cantidad * precio_unit,
          tipoItemId: tipoItemMaterial.id,
        };
      });

      const total = items.reduce((a, it) => a + Number(it.total || 0), 0);

      compras.push({
        id: compraId,
        numero: int(rng, 10, 999),
        empresa_id: empresa.id,
        proyecto_id: pr.id,
        estado: pick(rng, ["ORDEN_COMPRA", "FACTURADA", "PAGADA"]),
        total: round0(total),
        creada_en: addDays(new Date(), -int(rng, 1, 45)),
        actualizado_en: new Date(),
        eliminado: false,
        eliminado_en: null,
        proveedorId: proveedor.id,
        proveedor: { id: proveedor.id, nombre: proveedor.nombre },
      });

      compraItems.push(...items);
    }
  }

  // =======================
  // Ventas + detalleVenta (HH + COMPRA) por proyecto
  // + Cotización conectando ventas
  // =======================
  const ventas = [];
  const cotizaciones = [];
  const cotGlosas = [];
  const compraCosteos = [];

  // agrupación helper
  const comprasByProyectoId = new Map();
  for (const c of compras) {
    if (!comprasByProyectoId.has(c.proyecto_id))
      comprasByProyectoId.set(c.proyecto_id, []);
    comprasByProyectoId.get(c.proyecto_id).push(c);
  }

  const ventasByProyectoId = new Map();

  for (const pr of proyectos) {
    const ventaId = cuidLike(rng);
    const detalles = [];

    // HH lines (2-4)
    const nHH = int(rng, 2, 4);
    for (let i = 0; i < nHH; i++) {
      const emp = pick(rng, empleados);
      const hh =
        hhEmpleados.find((x) => x.empleado_id === emp.id) ||
        pick(rng, hhEmpleados);
      const cantHoras = int(rng, 6, 40);
      const alpha = int(rng, 8, 22); // %
      const alphaMult = 1 + alpha / 100;

      const costoHH = Number(hh.costoHH);
      const costoSinAlpha = costoHH * cantHoras + Number(cif.valor || 0);
      const costoTotal = costoSinAlpha * alphaMult;

      // venta igual costo (tu lógica actual: ventaTotal = costoConAlphaBase)
      const ventaTotalBruto = costoTotal;
      const descuentoItemPct = rng() < 0.25 ? int(rng, 3, 12) : 0;
      const descuentoItemMult = 1 - descuentoItemPct / 100;

      const ventaTotal = ventaTotalBruto * descuentoItemMult;

      detalles.push({
        id: cuidLike(rng),
        ventaId,
        descripcion: `HH ${usuarios.find((u) => u.id === emp.usuario_id)?.nombre || "Empleado"} (${cantHoras}h)`,
        cantidad: cantHoras,
        total: ventaTotal,
        fecha: new Date(),

        descuentoPct: descuentoItemPct,
        ventaTotalBruto,

        modo: "HH",
        tipoItemId: tipoItemHH.id,

        compraId: null,
        costoUnitario: null,
        costoTotal,

        empleadoId: emp.id,
        hhEmpleadoId: hh.id,
        costoHH,

        ventaUnitario: cantHoras > 0 ? ventaTotal / cantHoras : ventaTotal,
        ventaTotal,
        utilidad: ventaTotal - costoTotal,
        porcentajeUtilidad:
          ventaTotal > 0 ? ((ventaTotal - costoTotal) / ventaTotal) * 100 : 0,
        alpha,

        tipoDiaId: tipoDiaNormal.id,
        isFeriado: false,
        isUrgencia: false,
        isFinSemana: false,

        eliminado: false,
        eliminado_en: null,
      });
    }

    // COMPRA lines (1-3) referenciando CompraItem
    const nCP = int(rng, 1, 3);
    const comprasProyecto = comprasByProyectoId.get(pr.id) || [];
    const itemsProyecto = compraItems.filter((it) =>
      comprasProyecto.some((c) => c.id === it.compra_id),
    );

    for (let i = 0; i < nCP; i++) {
      const it = pick(rng, itemsProyecto);
      const cantidad = int(rng, 1, 4);
      const costoUnitario = Number(it.precio_unit || 0);
      const alpha = int(rng, 5, 18);
      const alphaMult = 1 + alpha / 100;

      const costoSinAlpha = costoUnitario * cantidad;
      const costoTotal = costoSinAlpha * alphaMult;

      const ventaTotalBruto = costoTotal;
      const descuentoItemPct = rng() < 0.2 ? int(rng, 2, 10) : 0;
      const ventaTotal = ventaTotalBruto * (1 - descuentoItemPct / 100);

      detalles.push({
        id: cuidLike(rng),
        ventaId,
        descripcion: `Material: ${it.item} (x${cantidad})`,
        cantidad,
        total: ventaTotal,
        fecha: new Date(),

        descuentoPct: descuentoItemPct,
        ventaTotalBruto,

        modo: "COMPRA",
        tipoItemId: tipoItemMaterial.id,

        compraId: it.id,
        costoUnitario,
        costoTotal,

        empleadoId: null,
        hhEmpleadoId: null,
        costoHH: null,

        ventaUnitario: cantidad > 0 ? ventaTotal / cantidad : ventaTotal,
        ventaTotal,
        utilidad: ventaTotal - costoTotal,
        porcentajeUtilidad:
          ventaTotal > 0 ? ((ventaTotal - costoTotal) / ventaTotal) * 100 : 0,
        alpha,

        tipoDiaId: tipoDiaNormal.id,
        isFeriado: false,
        isUrgencia: false,
        isFinSemana: false,

        eliminado: false,
        eliminado_en: null,
      });
    }

    // descuento general (0..8%)
    const descuentoGeneralPct = rng() < 0.35 ? int(rng, 2, 8) : 0;
    const multGeneral = 1 - descuentoGeneralPct / 100;

    // aplicar descuento general sobre cada línea (como tu createVenta)
    for (const d of detalles) {
      const bruto = Number(d.ventaTotalBruto || d.ventaTotal || 0);
      const neto =
        bruto * (1 - Number(d.descuentoPct || 0) / 100) * multGeneral;

      d.ventaTotal = neto;
      d.total = neto;
      d.ventaUnitario = d.cantidad > 0 ? neto / d.cantidad : neto;

      d.utilidad = neto - Number(d.costoTotal || 0);
      d.porcentajeUtilidad = neto > 0 ? (d.utilidad / neto) * 100 : 0;
    }

    const totalFinal = detalles.reduce(
      (acc, d) => acc + Number(d.ventaTotal || 0),
      0,
    );

    const venta = {
      id: ventaId,
      numero: int(rng, 100, 999),
      fecha: new Date(),
      ordenVentaId: null,
      descripcion: `Costeo ${pr.nombre}`,
      detalles,
      asignaciones_costeo: [],
      descuentoPct: descuentoGeneralPct,

      utilidadObjetivoBase: null,
      utilidadObjetivoPct: null,
      factorKAplicado: null,

      isFeriado: false,
      isUrgencia: false,

      createdAt: new Date(),
      eliminado: false,
      eliminado_en: null,

      clienteId: cliente.id,

      // campo helper para UI
      _proyecto_id: pr.id,
      _totalFinal: round0(totalFinal),
    };

    ventas.push(venta);
    if (!ventasByProyectoId.has(pr.id)) ventasByProyectoId.set(pr.id, []);
    ventasByProyectoId.get(pr.id).push(venta);

    // Cotización por proyecto conectando esa venta
    const cotId = cuidLike(rng);
    const subtotalBruto = round0(totalFinal); // tu lógica “vendedor ve subtotal”
    const iva = round0(subtotalBruto * 0.19);
    const total = subtotalBruto + iva;

    const cot = {
      id: cotId,
      numero: int(rng, 1000, 9999),
      empresa_id: empresa.id,
      proyecto_id: pr.id,
      cliente_id: cliente.id,
      cliente_responsable_id: clienteResponsable.id,
      vendedor_id: usuarios[0].id,
      asunto: `Cotización ${pr.nombre}`,
      vigencia_dias: 15,
      subtotal: subtotalBruto,
      iva,
      total,
      terminos_condiciones: "Mock: términos estándar",
      acuerdo_pago: "Mock: 50% inicio / 50% entrega",
      creada_en: new Date(),
      actualizado_en: new Date(),
      eliminado: false,
      eliminado_en: null,
      fecha_documento: new Date(),
      vencimiento_documento: addDays(new Date(), 15),
      motivo_rechazo: null,
      descuento_pct: 0,
      descuento_monto: 0,
      estado: "COTIZACION",
      ventas: [{ id: ventaId }], // connect-like
    };
    cotizaciones.push(cot);

    cotGlosas.push({
      id: cuidLike(rng),
      cotizacion_id: cotId,
      descripcion: "Servicios e implementación",
      monto: subtotalBruto,
      manual: true,
      orden: 0,
      descuento_pct: 0,
    });

    // CompraCosteo (si quieres “asignación” compra->venta)
    const comprasProyectoForCosteo = comprasByProyectoId.get(pr.id) || [];
    if (comprasProyectoForCosteo.length) {
      const cPick = pick(rng, comprasProyectoForCosteo);

      compraCosteos.push({
        id: cuidLike(rng),
        empresa_id: empresa.id,
        compra_id: cPick.id,
        venta_id: ventaId, // OJO: antes estabas dejando mal esto (ponías cPick.id)
        monto: round0(int(rng, 150000, 1200000)),
        creado_en: addDays(new Date(), -int(rng, 5, 60)),
        actualizado_en: addDays(new Date(), -int(rng, 1, 10)),
      });
    }
  }

  // =======================
  // Devengado por proyecto (listo para UI)
  // =======================
  const devengado = proyectos.map((pr) =>
    calcDevengadoProyecto({
      proyecto: pr,
      epicas,
      tareas,
      detalles: tareaDetalles,
      ventasByProyectoId,
      comprasByProyectoId,
    }),
  );

  // Totales generales
  const tot = devengado.reduce(
    (a, x) => {
      a.venta_total += Number(x.venta_total || 0);
      a.devengado_monto += Number(x.devengado_monto || 0);
      a.costo_real += Number(x.costo_real || 0);
      a.utilidad_estimada += Number(x.utilidad_estimada || 0);
      return a;
    },
    { venta_total: 0, devengado_monto: 0, costo_real: 0, utilidad_estimada: 0 },
  );

  return {
    ok: true,
    meta: { seed, anio, mes, generatedAt: new Date().toISOString() },

    // entidades principales
    empresa,
    roles: [rolAdmin, rolUser],
    usuarios,
    empleados,

    cliente,
    clienteResponsable,

    // catálogos
    unidadItems: [unidadHora, unidadUn],
    tipoItems: [tipoItemHH, tipoItemMaterial],
    tipoDias: [tipoDiaNormal, tipoDiaFeriado, tipoDiaUrgencia],

    // HH/CIF
    cif,
    hhEmpleados,

    // proyectos/tareas
    proyectos,
    proyectoMiembros,
    epicas,
    tareas,
    tareaDetalles,
    tareaHistorial,

    // compras
    proveedor,
    productos,
    compras,
    compraItems,
    compraCosteos,

    // ventas/cotizaciones
    ventas,
    cotizaciones,
    cotGlosas,

    // resumen UI devengado
    devengado: {
      periodo: { anio, mes, nombre: `${nombreMeses[mes]} ${anio}` },
      totales: {
        venta_total: round0(tot.venta_total),
        devengado_monto: round0(tot.devengado_monto),
        costo_real: round0(tot.costo_real),
        utilidad_estimada: round0(tot.utilidad_estimada),
      },
      proyectos: devengado.map((x) => ({
        ...x,
        devengado_pct: Number((x.devengado_pct * 100).toFixed(1)), // % para UI
        venta_total: round0(x.venta_total),
        devengado_monto: round0(x.devengado_monto),
        costo_real: round0(x.costo_real),
        utilidad_estimada: round0(x.utilidad_estimada),
      })),
    },
  };
}


// ✅ helper: sacar 1 proyecto + detalle desde el mock grande
export function makeDevengadoProyectoMock({
  seed = 20260302,
  anio = 2026,
  mes = 3,
  nProyectos = 4,
  proyectoId = null,
} = {}) {
  const data = makeDevengadoMock({ seed, anio, mes, nProyectos });

  const proyecto =
    (proyectoId && data.proyectos.find((p) => p.id === proyectoId)) ||
    data.proyectos[0];

  const pid = proyecto.id;

  const epicas = data.epicas.filter((e) => e.proyecto_id === pid);
  const tareas = data.tareas.filter((t) => t.proyecto_id === pid);
  const detalles = data.tareaDetalles.filter((d) => {
    const t = tareas.find((x) => x.id === d.tarea_id);
    return !!t;
  });

  const ventas = (data.ventas || []).filter((v) => v._proyecto_id === pid);
  const ventaBase = ventas.reduce((s, v) => s + Number(v._totalFinal || 0), 0);

  const compras = (data.compras || []).filter((c) => c.proyecto_id === pid);
  const compraTotal = compras.reduce((s, c) => s + Number(c.total || 0), 0);

  const compraIds = new Set(compras.map((c) => c.id));
  const compraCosteos = (data.compraCosteos || []).filter((cc) => {
    const c = data.compras.find((x) => x.id === cc.compra_id);
    return c && c.proyecto_id === pid;
  });

  const comprasAsignadas = compraCosteos.reduce(
    (s, x) => s + Number(x.monto || 0),
    0,
  );

  const hhCosto = ventas.reduce((acc, v) => {
    for (const it of v.detalles || []) acc += Number(it.costoTotal || 0);
    return acc;
  }, 0);

  // ✅ avance ponderado por subtareas (costo_plan || horas_plan || 1)
  let wSum = 0;
  let wProg = 0;
  for (const d of detalles) {
    const w = Number(d.costo_plan ?? 0) || Number(d.horas_plan ?? 0) || 1;
    const prog = clamp(Number(d.avance ?? 0), 0, 100) / 100;
    wSum += w;
    wProg += w * prog;
  }
  const avance = wSum > 0 ? wProg / wSum : 0;

  const devengadoMonto = ventaBase * avance;
  const costoReal = hhCosto + compraTotal;
  const utilidad = devengadoMonto - costoReal;

  // agrupar subtareas por tarea
  const detallesByTarea = new Map();
  for (const d of detalles) {
    if (!detallesByTarea.has(d.tarea_id)) detallesByTarea.set(d.tarea_id, []);
    detallesByTarea.get(d.tarea_id).push(d);
  }

  // armar estructura épicas -> tareas -> subtareas
  const epicasUI = epicas.map((e) => {
    const tareasEpica = tareas.filter((t) => t.epica_id === e.id);
    return {
      ...e,
      tareas: tareasEpica.map((t) => ({
        ...t,
        detalles: (detallesByTarea.get(t.id) || []).sort(
          (a, b) => String(a.titulo).localeCompare(String(b.titulo)),
        ),
      })),
    };
  });

  return {
    ok: true,
    meta: data.meta,
    proyecto,
    resumen: {
      periodo: { anio, mes },
      venta_base: round0(ventaBase),
      avance_pct: Number((avance * 100).toFixed(1)),
      devengado_monto: round0(devengadoMonto),
      costo_real: round0(costoReal),
      utilidad: round0(utilidad),

      hh_costo: round0(hhCosto),
      compras_total: round0(compraTotal),
      compras_asignadas: round0(comprasAsignadas),
    },
    epicas: epicasUI,
    compras,
    compraCosteos,
    ventas,
    // por si quieres pintar tablas
    empleados: data.empleados,
    hhEmpleados: data.hhEmpleados,
    cif: data.cif,
    cotizaciones: data.cotizaciones.filter((c) => c.proyecto_id === pid),
  };
}