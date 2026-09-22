/**
 * Utilidades para cálculo de días hábiles y feriados en Chile para el Frontend
 * Según Código del Trabajo (Art. 67 y 69):
 * - Las vacaciones anuales se contabilizan de lunes a viernes.
 * - Sábados, domingos y feriados legales NO se descuentan del saldo de vacaciones acumulado.
 */

// Algoritmo astronómico para cálculo de Domingo de Resurrección (Pascua)
function getEasterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Retorna Set con strings 'YYYY-MM-DD' de feriados en Chile para un año dado
 */
export function getFeriadosChile(year) {
  const feriados = new Set();
  const add = (m, d) => {
    const mm = String(m).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    feriados.add(`${year}-${mm}-${dd}`);
  };

  // Feriados fijos
  add(1, 1);   // Año Nuevo
  add(5, 1);   // Día del Trabajador
  add(5, 21);  // Glorias Navales
  add(6, 21);  // Día Nacional de los Pueblos Indígenas
  add(7, 16);  // Virgen del Carmen
  add(8, 15);  // Asunción de la Virgen
  add(9, 18);  // Independencia Nacional
  add(9, 19);  // Glorias del Ejército
  add(11, 1);  // Todos los Santos
  add(12, 8);  // Inmaculada Concepción
  add(12, 25); // Navidad

  // Fiestas Patrias sándwiches legales (Ley 20.215)
  const sep18Day = new Date(Date.UTC(year, 8, 18)).getUTCDay(); // 2: Martes, 3: Miércoles
  if (sep18Day === 2) add(9, 17); // Lunes 17
  if (sep18Day === 3) add(9, 20); // Viernes 20

  // Semana Santa (Viernes Santo y Sábado Santo)
  const easter = getEasterSunday(year);
  const viernesSanto = new Date(easter.getTime() - 2 * 24 * 60 * 60 * 1000);
  add(viernesSanto.getUTCMonth() + 1, viernesSanto.getUTCDate());

  // San Pedro y San Pablo (29 de Junio - Ley 19.668 traslados)
  const sanPedroDate = new Date(Date.UTC(year, 5, 29));
  const spDay = sanPedroDate.getUTCDay();
  if (spDay >= 2 && spDay <= 4) {
    const diff = spDay - 1;
    const trasladado = new Date(sanPedroDate.getTime() - diff * 24 * 60 * 60 * 1000);
    add(trasladado.getUTCMonth() + 1, trasladado.getUTCDate());
  } else {
    add(6, 29);
  }

  // Encuentro de Dos Mundos (12 de Octubre - Ley 19.668)
  const dosMundosDate = new Date(Date.UTC(year, 9, 12));
  const dmDay = dosMundosDate.getUTCDay();
  if (dmDay >= 2 && dmDay <= 4) {
    const diff = dmDay - 1;
    const trasladado = new Date(dosMundosDate.getTime() - diff * 24 * 60 * 60 * 1000);
    add(trasladado.getUTCMonth() + 1, trasladado.getUTCDate());
  } else {
    add(10, 12);
  }

  // Día de las Iglesias Evangélicas (31 de Octubre - Ley 20.299)
  const evanDate = new Date(Date.UTC(year, 9, 31));
  const evanDay = evanDate.getUTCDay();
  if (evanDay === 3) {
    add(11, 2);
  } else if (evanDay === 2) {
    add(10, 27);
  } else {
    add(10, 31);
  }

  return feriados;
}

/**
 * Verifica si una fecha específica es feriado en Chile
 */
export function isFeriadoChile(date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return false;
  const y = d.getUTCFullYear();
  const feriados = getFeriadosChile(y);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return feriados.has(`${y}-${mm}-${dd}`);
}

/**
 * Calcula días hábiles entre dos fechas para vacaciones
 * @param {string|Date} desde 'YYYY-MM-DD' o Date
 * @param {string|Date} hasta 'YYYY-MM-DD' o Date
 * @returns {{ diasHabiles: number, diasTotales: number, finesDeSemana: number, feriadosCount: number, detalleFeriados: string[] }}
 */
export function calcularDiasHabilesVacaciones(desde, hasta) {
  if (!desde || !hasta) {
    return { diasHabiles: 0, diasTotales: 0, finesDeSemana: 0, feriadosCount: 0, detalleFeriados: [] };
  }

  // Normalizar strings tipo 'YYYY-MM-DD' a UTC
  let d1, d2;
  if (typeof desde === "string" && /^\d{4}-\d{2}-\d{2}/.test(desde)) {
    const [y, m, d] = desde.slice(0, 10).split("-").map(Number);
    d1 = new Date(Date.UTC(y, m - 1, d));
  } else {
    const raw = new Date(desde);
    d1 = new Date(Date.UTC(raw.getFullYear(), raw.getMonth(), raw.getDate()));
  }

  if (typeof hasta === "string" && /^\d{4}-\d{2}-\d{2}/.test(hasta)) {
    const [y, m, d] = hasta.slice(0, 10).split("-").map(Number);
    d2 = new Date(Date.UTC(y, m - 1, d));
  } else {
    const raw = new Date(hasta);
    d2 = new Date(Date.UTC(raw.getFullYear(), raw.getMonth(), raw.getDate()));
  }

  if (isNaN(d1.getTime()) || isNaN(d2.getTime()) || d2 < d1) {
    return { diasHabiles: 0, diasTotales: 0, finesDeSemana: 0, feriadosCount: 0, detalleFeriados: [] };
  }

  const feriadosCache = {};
  const getFeriados = (y) => {
    if (!feriadosCache[y]) feriadosCache[y] = getFeriadosChile(y);
    return feriadosCache[y];
  };

  let diasHabiles = 0;
  let diasTotales = 0;
  let finesDeSemana = 0;
  let feriadosCount = 0;
  const detalleFeriados = [];

  const cur = new Date(d1.getTime());
  const end = new Date(d2.getTime());

  while (cur <= end) {
    diasTotales++;
    const dayOfWeek = cur.getUTCDay(); // 0: Dom, 6: Sab
    const y = cur.getUTCFullYear();
    const mm = String(cur.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(cur.getUTCDate()).padStart(2, "0");
    const dateStr = `${y}-${mm}-${dd}`;

    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = getFeriados(y).has(dateStr);

    if (isWeekend) {
      finesDeSemana++;
    } else if (isHoliday) {
      feriadosCount++;
      detalleFeriados.push(dateStr);
    } else {
      diasHabiles++;
    }

    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  return {
    diasHabiles,
    diasTotales,
    finesDeSemana,
    feriadosCount,
    detalleFeriados,
  };
}
