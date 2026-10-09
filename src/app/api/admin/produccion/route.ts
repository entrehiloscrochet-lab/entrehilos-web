import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import fs from "fs";
import path from "path";
import {
  ResumenProduccionData,
  MaterialItem,
  ProductoProduccion,
  CampanaProduccion,
  BitacoraRegistro,
  ProduccionConfig,
  EventoCatalogoItem,
  RecetaItem,
} from "@/types/produccion";

const FALLBACK_FILE = path.join(process.cwd(), "src/data/produccion_fallback.json");

interface MaterialDbRow {
  id: string;
  nombre: string;
  categoria: MaterialItem["categoria"];
  presentacion?: string;
  precio_compra?: number | string | null;
  cantidad_total?: number | string | null;
  unidad_medida: MaterialItem["unidad_medida"];
  costo_unitario?: number | string | null;
  stock_actual?: number | string | null;
  created_at?: string;
}

interface RecetaDbRow {
  id: string;
  producto_id: string;
  material_id: string;
  cantidad?: number | string | null;
  costo_calculado?: number | string | null;
}

interface ProductoDbRow {
  id: string;
  producto_tienda_id?: string | null;
  nombre: string;
  categoria: string;
  tiempo_produccion?: number | string | null;
  precio_venta_real?: number | string | null;
  margen_deseado?: number | string | null;
  costo_materiales?: number | string | null;
  costo_mano_obra?: number | string | null;
  costo_total?: number | string | null;
  precio_sugerido?: number | string | null;
  notas?: string | null;
  imagen?: string | null;
  created_at?: string;
}

interface CampanaItemDbRow {
  id: string;
  campana_id: string;
  producto_id: string;
  cantidad_meta?: number | string | null;
  cantidad_terminada?: number | string | null;
}

interface CampanaGastoDbRow {
  id: string;
  campana_id: string;
  concepto: string;
  categoria: string;
  monto?: number | string | null;
}

interface CampanaDbRow {
  id: string;
  nombre: string;
  descripcion?: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  activa?: boolean | null;
  created_at?: string;
}

interface BitacoraDbRow {
  id: string;
  fecha: string;
  producto_id: string;
  campana_id?: string | null;
  piezas_terminadas?: number | string | null;
  horas_dedicadas?: number | string | null;
  velocidad_piezas_hora?: number | string | null;
  notas?: string | null;
  created_at?: string;
}

interface CategoriaDbRow {
  categoria?: string | null;
}

interface EventoDbRow {
  slug: string;
  nombre: string;
  descripcion?: string;
  activo?: boolean;
}

interface RecetaInputItem {
  id?: string;
  material_id: string;
  cantidad?: number | string | null;
}

interface CampanaItemInput {
  id?: string;
  producto_id: string;
  cantidad_meta?: number | string | null;
  cantidad_terminada?: number | string | null;
}

interface CampanaGastoInput {
  id?: string;
  concepto?: string;
  categoria?: string;
  monto?: number | string | null;
}


function readFallbackData(): ResumenProduccionData {
  try {
    if (fs.existsSync(FALLBACK_FILE)) {
      const content = fs.readFileSync(FALLBACK_FILE, "utf-8");
      return JSON.parse(content);
    }
  } catch (e) {
    console.error("Error reading produccion fallback:", e);
  }
  return {
    config: { id: "default", tarifa_hora: 8.0, margen_deseado_default: 40.0, limite_horas_dia_alerta: 4.5 },
    materiales: [],
    productos: [],
    campanas: [],
    bitacora: [],
  };
}

function saveFallbackData(data: ResumenProduccionData) {
  try {
    const existing = readFallbackData();
    const safeData: ResumenProduccionData = {
      ...data,
      productos:
        data.productos && data.productos.length > 0
          ? data.productos
          : existing.productos && existing.productos.length > 0
          ? existing.productos
          : [],
      materiales:
        data.materiales && data.materiales.length > 0
          ? data.materiales
          : existing.materiales && existing.materiales.length > 0
          ? existing.materiales
          : [],
      campanas:
        data.campanas && data.campanas.length > 0
          ? data.campanas
          : existing.campanas && existing.campanas.length > 0
          ? existing.campanas
          : [],
    };
    fs.writeFileSync(FALLBACK_FILE, JSON.stringify(safeData, null, 2), "utf-8");
  } catch (e) {
    console.error("Error saving produccion fallback:", e);
  }
}

function enrichDataWithRealTimes(data: ResumenProduccionData): ResumenProduccionData {
  const tarifaHora = data.config?.tarifa_hora || 8.0;

  // Enriquecer bitacora con métricas reales por pieza
  const bitacora: BitacoraRegistro[] = (data.bitacora || []).map((b) => {
    const prod = data.productos.find((p) => p.id === b.producto_id);
    const pTerminadas = Number(b.piezas_terminadas) || 1;
    const hDedicadas = Number(b.horas_dedicadas) || 1;
    const tiempoRealPorPieza = Number((hDedicadas / Math.max(1, pTerminadas)).toFixed(2));
    const tiempoEstimado = prod?.tiempo_produccion || 0;
    const diferencia = Number((tiempoRealPorPieza - tiempoEstimado).toFixed(2));

    return {
      ...b,
      piezas_terminadas: pTerminadas,
      horas_dedicadas: hDedicadas,
      velocidad_piezas_hora: Number((pTerminadas / Math.max(0.1, hDedicadas)).toFixed(2)),
      tiempo_real_por_pieza: tiempoRealPorPieza,
      tiempo_estimado_por_pieza: tiempoEstimado,
      diferencia_horas_pieza: diferencia,
      producto: prod
        ? {
            id: prod.id,
            nombre: prod.nombre,
            categoria: prod.categoria,
            tiempo_produccion: prod.tiempo_produccion,
            imagen: prod.imagen,
          }
        : b.producto,
    };
  });

  // Enriquecer productos con promedios reales calculados desde la bitácora
  const productos: ProductoProduccion[] = (data.productos || []).map((prod) => {
    const logs = bitacora.filter((b) => b.producto_id === prod.id);
    const totalPiezas = logs.reduce((acc, b) => acc + (Number(b.piezas_terminadas) || 0), 0);
    const totalHoras = logs.reduce((acc, b) => acc + (Number(b.horas_dedicadas) || 0), 0);

    if (totalPiezas > 0 && totalHoras > 0) {
      const tiempo_real_promedio = Number((totalHoras / totalPiezas).toFixed(2));
      const desviacion_tiempo = Number((tiempo_real_promedio - prod.tiempo_produccion).toFixed(2));
      const costo_mano_obra_real = Number((tiempo_real_promedio * tarifaHora).toFixed(2));
      const costo_real_promedio = Number((prod.costo_materiales + costo_mano_obra_real).toFixed(2));

      return {
        ...prod,
        tiempo_real_promedio,
        desviacion_tiempo,
        costo_real_promedio,
      };
    }

    return prod;
  });

  return {
    ...data,
    productos,
    bitacora,
  };
}

// Helpers para consultar Supabase con fallback seguro
async function getProduccionData(): Promise<ResumenProduccionData> {
  const fallback = readFallbackData();

  try {
    // Intentar leer de Supabase
    const [cfgRes, matRes, prodRes, recRes, campRes, itemRes, gastRes, bitRes] = await Promise.all([
      supabaseAdmin.from("produccion_config").select("*").maybeSingle(),
      supabaseAdmin.from("produccion_materiales").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("produccion_productos").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("produccion_recetas_items").select("*"),
      supabaseAdmin.from("produccion_campanas").select("*").order("fecha_inicio", { ascending: false }),
      supabaseAdmin.from("produccion_campana_items").select("*"),
      supabaseAdmin.from("produccion_campana_gastos").select("*"),
      supabaseAdmin.from("produccion_bitacora").select("*").order("fecha", { ascending: false }),
    ]);

    // Si alguna tabla falla por no existir en Supabase, usar el fallback local enriquecido
    if (
      matRes.error?.message?.includes("does not exist") ||
      prodRes.error?.message?.includes("does not exist") ||
      campRes.error?.message?.includes("does not exist")
    ) {
      return enrichDataWithRealTimes(fallback);
    }

    const config: ProduccionConfig = cfgRes.data
      ? {
          id: cfgRes.data.id || "default",
          tarifa_hora: Number(cfgRes.data.tarifa_hora) || 8.0,
          margen_deseado_default: Number(cfgRes.data.margen_deseado_default) || 40.0,
          limite_horas_dia_alerta: Number(cfgRes.data.limite_horas_dia_alerta) || 4.5,
        }
      : fallback.config;

    const materiales: MaterialItem[] = (matRes.data || []).map((m: MaterialDbRow) => ({
      id: m.id,
      nombre: m.nombre,
      categoria: m.categoria,
      presentacion: m.presentacion,
      precio_compra: Number(m.precio_compra) || 0,
      cantidad_total: Number(m.cantidad_total) || 1,
      unidad_medida: m.unidad_medida,
      costo_unitario: Number(m.costo_unitario) || 0,
      stock_actual: m.stock_actual !== null ? Number(m.stock_actual) : undefined,
      created_at: m.created_at,
    }));

    const matMap = new Map<string, MaterialItem>(materiales.map((m) => [m.id, m]));
    const recetasItems = recRes.data || [];

    const productos: ProductoProduccion[] = (prodRes.data || []).map((p: ProductoDbRow) => {
      const items = recetasItems
        .filter((r: RecetaDbRow) => r.producto_id === p.id)
        .map((r: RecetaDbRow) => ({
          id: r.id,
          producto_id: r.producto_id,
          material_id: r.material_id,
          cantidad: Number(r.cantidad) || 0,
          costo_calculado: Number(r.costo_calculado) || 0,
          material: matMap.get(r.material_id),
        }));

      return {
        id: p.id,
        producto_tienda_id: p.producto_tienda_id,
        nombre: p.nombre,
        categoria: p.categoria,
        tiempo_produccion: Number(p.tiempo_produccion) || 0,
        precio_venta_real: Number(p.precio_venta_real) || 0,
        margen_deseado: Number(p.margen_deseado) || 40,
        costo_materiales: Number(p.costo_materiales) || 0,
        costo_mano_obra: Number(p.costo_mano_obra) || 0,
        costo_total: Number(p.costo_total) || 0,
        precio_sugerido: Number(p.precio_sugerido) || 0,
        notas: p.notas || "",
        imagen: p.imagen || undefined,
        items_receta: items,
        created_at: p.created_at,
      };
    });

    // Safeguard 1: Si Supabase no tiene productos aún, cargar del fallback preservado
    if (productos.length === 0 && fallback.productos && fallback.productos.length > 0) {
      productos.push(...fallback.productos);
    }

    const prodMap = new Map<string, ProductoProduccion>(productos.map((p) => [p.id, p]));
    const campItems = itemRes.data || [];
    const campGastos = gastRes.data || [];

    const campanas: CampanaProduccion[] = (campRes.data || []).map((c: CampanaDbRow) => ({
      id: c.id,
      nombre: c.nombre,
      descripcion: c.descripcion || "",
      fecha_inicio: c.fecha_inicio,
      fecha_fin: c.fecha_fin,
      activa: Boolean(c.activa),
      items: campItems
        .filter((ci: CampanaItemDbRow) => ci.campana_id === c.id)
        .map((ci: CampanaItemDbRow) => ({
          id: ci.id,
          campana_id: ci.campana_id,
          producto_id: ci.producto_id,
          cantidad_meta: Number(ci.cantidad_meta) || 0,
          cantidad_terminada: Number(ci.cantidad_terminada) || 0,
          producto: prodMap.get(ci.producto_id),
        })),
      gastos: campGastos
        .filter((cg: CampanaGastoDbRow) => cg.campana_id === c.id)
        .map((cg: CampanaGastoDbRow) => ({
          id: cg.id,
          campana_id: cg.campana_id,
          concepto: cg.concepto,
          categoria: cg.categoria,
          monto: Number(cg.monto) || 0,
        })),
      created_at: c.created_at,
    }));

    // Safeguard 2: Si campanas en Supabase no tiene items pero fallback sí, restaurarlos
    if (campanas.length === 0 && fallback.campanas && fallback.campanas.length > 0) {
      campanas.push(...fallback.campanas);
    } else {
      campanas.forEach((c) => {
        if (c.items.length === 0) {
          const fbCamp = fallback.campanas.find((fbc) => fbc.id === c.id);
          if (fbCamp && fbCamp.items.length > 0) {
            c.items = fbCamp.items.map((it) => ({
              ...it,
              producto: prodMap.get(it.producto_id) || it.producto,
            }));
          }
        }
      });
    }

    const bitacora: BitacoraRegistro[] = (bitRes.data || []).map((b: BitacoraDbRow) => {
      const prod = prodMap.get(b.producto_id);
      return {
        id: b.id,
        fecha: b.fecha,
        producto_id: b.producto_id,
        campana_id: b.campana_id,
        piezas_terminadas: Number(b.piezas_terminadas) || 1,
        horas_dedicadas: Number(b.horas_dedicadas) || 1,
        velocidad_piezas_hora: Number(b.velocidad_piezas_hora) || 1,
        notas: b.notas || "",
        producto: prod
          ? {
              id: prod.id,
              nombre: prod.nombre,
              categoria: prod.categoria,
              tiempo_produccion: prod.tiempo_produccion,
              imagen: prod.imagen,
            }
          : undefined,
        created_at: b.created_at,
      };
    });

    // Recopilar categorias disponibles
    const categoriasSet = new Set<string>([
      "Amigurumis",
      "Ramos",
      "Llaveros",
      "Cajas",
      "Flores Eternas",
      "Personalizado",
      "General",
    ]);

    productos.forEach((p) => {
      if (p.categoria) categoriasSet.add(p.categoria.trim());
    });

    try {
      const { data: dbCats } = await supabaseAdmin.from("productos").select("categoria");
      if (Array.isArray(dbCats)) {
        dbCats.forEach((c: CategoriaDbRow) => {
          if (c.categoria) categoriasSet.add(c.categoria.trim());
        });
      }
    } catch (e) {}

    const categorias = Array.from(categoriasSet).sort();

    // Recopilar eventos disponibles para catalogos
    let eventos: EventoCatalogoItem[] = [
      { slug: "general", nombre: "Catálogo General de la Tienda" },
      { slug: "dia-de-la-madre", nombre: "Día de la Madre" },
      { slug: "san-valentin", nombre: "San Valentín" },
      { slug: "dia-de-la-novia", nombre: "Día de la Novia" },
      { slug: "flores-amarillas", nombre: "Flores Amarillas" },
      { slug: "personalizados", nombre: "Personalizados" },
    ];

    try {
      const { data: evData } = await supabaseAdmin
        .from("eventos")
        .select("slug, nombre, descripcion, activo")
        .eq("activo", true)
        .order("nombre");
      if (Array.isArray(evData) && evData.length > 0) {
        const evMap = new Map<string, EventoCatalogoItem>();
        evMap.set("general", { slug: "general", nombre: "Catálogo General de la Tienda" });
        evData.forEach((ev: EventoDbRow) => {
          evMap.set(ev.slug, {
            slug: ev.slug,
            nombre: ev.nombre,
            descripcion: ev.descripcion,
            activo: ev.activo,
          });
        });
        eventos = Array.from(evMap.values());
      }
    } catch (e) {}

    // Si Supabase devuelve arrays vacíos pero el fallback tiene datos, mezclar de forma segura
    if (materiales.length === 0 && fallback.materiales.length > 0) {
      const enrichedFallback = enrichDataWithRealTimes(fallback);
      return { ...enrichedFallback, categorias, eventos };
    }

    const enriched = enrichDataWithRealTimes({ config, materiales, productos, campanas, bitacora });
    return { ...enriched, categorias, eventos };
  } catch (e) {
    console.error("Error connecting to Supabase in produccion route, using fallback:", e);
    const enrichedFallback = enrichDataWithRealTimes(fallback);
    return {
      ...enrichedFallback,
      categorias: ["Amigurumis", "Ramos", "Llaveros", "Cajas", "Flores Eternas", "Personalizado", "General"],
      eventos: [
        { slug: "general", nombre: "Catálogo General de la Tienda" },
        { slug: "dia-de-la-madre", nombre: "Día de la Madre" },
        { slug: "san-valentin", nombre: "San Valentín" },
        { slug: "dia-de-la-novia", nombre: "Día de la Novia" },
        { slug: "flores-amarillas", nombre: "Flores Amarillas" },
        { slug: "personalizados", nombre: "Personalizados" },
      ],
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    const data = await getProduccionData();
    return NextResponse.json(data);
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as { message?: string }).message || "Error al obtener datos" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;
    const currentData = await getProduccionData();

    if (action === "actualizar-config") {
      const { tarifa_hora, margen_deseado_default, limite_horas_dia_alerta } = body;
      const newConfig: ProduccionConfig = {
        id: "default",
        tarifa_hora: Number(tarifa_hora) || currentData.config.tarifa_hora,
        margen_deseado_default: Number(margen_deseado_default) || currentData.config.margen_deseado_default,
        limite_horas_dia_alerta: Number(limite_horas_dia_alerta) || currentData.config.limite_horas_dia_alerta,
      };

      currentData.config = newConfig;

      // Recalcular productos con nueva tarifa
      currentData.productos = currentData.productos.map((prod) => {
        const costo_mano_obra = Number((prod.tiempo_produccion * newConfig.tarifa_hora).toFixed(2));
        const costo_total = Number((prod.costo_materiales + costo_mano_obra).toFixed(2));
        const divisor = 1 - (prod.margen_deseado || 40) / 100;
        const precio_sugerido = divisor > 0 ? Math.round(costo_total / divisor) : costo_total;
        return {
          ...prod,
          costo_mano_obra,
          costo_total,
          precio_sugerido,
        };
      });

      saveFallbackData(currentData);

      // Intentar actualizar en Supabase si existe
      try {
        await supabaseAdmin.from("produccion_config").upsert(newConfig);
      } catch (e) {
        // Ignorar si aún no existe
      }

      return NextResponse.json({ success: true, data: currentData });
    }

    if (action === "guardar-material") {
      const { id, nombre, categoria, presentacion, precio_compra, cantidad_total, unidad_medida, stock_actual } = body;
      const pCompra = Number(precio_compra) || 0;
      const cTotal = Number(cantidad_total) || 1;
      const costo_unitario = Number((pCompra / Math.max(0.0001, cTotal)).toFixed(4));

      const matItem: MaterialItem = {
        id: id || `mat-${Date.now()}`,
        nombre: String(nombre || "").trim(),
        categoria: categoria || "Hilos",
        presentacion: presentacion || "",
        precio_compra: pCompra,
        cantidad_total: cTotal,
        unidad_medida: unidad_medida || "unidades",
        costo_unitario,
        stock_actual: stock_actual !== undefined ? Number(stock_actual) : undefined,
        created_at: new Date().toISOString(),
      };

      const existingIdx = currentData.materiales.findIndex((m) => m.id === matItem.id);
      if (existingIdx >= 0) {
        currentData.materiales[existingIdx] = matItem;
      } else {
        currentData.materiales.unshift(matItem);
      }

      // Actualizar costos de recetas que contengan este material
      currentData.productos = currentData.productos.map((prod) => {
        let totalMat = 0;
        const newItems = prod.items_receta.map((rec) => {
          if (rec.material_id === matItem.id) {
            const costo_calc = Number((rec.cantidad * matItem.costo_unitario).toFixed(4));
            totalMat += costo_calc;
            return { ...rec, costo_calculado: costo_calc, material: matItem };
          }
          const otherMat = currentData.materiales.find((m) => m.id === rec.material_id);
          const costo_calc = otherMat ? Number((rec.cantidad * otherMat.costo_unitario).toFixed(4)) : 0;
          totalMat += costo_calc;
          return { ...rec, costo_calculado: costo_calc, material: otherMat };
        });

        const costo_materiales = Number(totalMat.toFixed(2));
        const costo_mano_obra = Number((prod.tiempo_produccion * currentData.config.tarifa_hora).toFixed(2));
        const costo_total = Number((costo_materiales + costo_mano_obra).toFixed(2));
        const divisor = 1 - (prod.margen_deseado || 40) / 100;
        const precio_sugerido = divisor > 0 ? Math.round(costo_total / divisor) : costo_total;

        return {
          ...prod,
          items_receta: newItems,
          costo_materiales,
          costo_mano_obra,
          costo_total,
          precio_sugerido,
        };
      });

      saveFallbackData(currentData);

      try {
        await supabaseAdmin.from("produccion_materiales").upsert({
          id: matItem.id,
          nombre: matItem.nombre,
          categoria: matItem.categoria,
          presentacion: matItem.presentacion,
          precio_compra: matItem.precio_compra,
          cantidad_total: matItem.cantidad_total,
          unidad_medida: matItem.unidad_medida,
          costo_unitario: matItem.costo_unitario,
          stock_actual: matItem.stock_actual,
        });
      } catch (e) {
        // Fallback activo
      }

      return NextResponse.json({ success: true, material: matItem, data: currentData });
    }

    if (action === "guardar-producto") {
      const {
        id,
        nombre,
        categoria,
        tiempo_produccion,
        precio_venta_real,
        margen_deseado,
        notas,
        imagen,
        items_receta,
        producto_tienda_id,
      } = body;

      const tProd = Number(tiempo_produccion) || 0;
      const pReal = Number(precio_venta_real) || 0;
      const mDeseado = Number(margen_deseado) || currentData.config.margen_deseado_default;

      // Calcular costo de materiales según receta
      let costo_materiales = 0;
      const processedItems: RecetaItem[] = (items_receta || []).map((item: RecetaInputItem, idx: number) => {
        const mat = currentData.materiales.find((m) => m.id === item.material_id);
        const cant = Number(item.cantidad) || 0;
        const unitCost = mat?.costo_unitario || 0;
        const itemCost = Number((cant * unitCost).toFixed(4));
        costo_materiales += itemCost;
        return {
          id: item.id || `rec-${Date.now()}-${idx}`,
          producto_id: id || `prod-${Date.now()}`,
          material_id: item.material_id,
          cantidad: cant,
          costo_calculado: itemCost,
          material: mat,
        };
      });

      const costo_mat_round = Number(costo_materiales.toFixed(2));
      const costo_mano_obra = Number((tProd * currentData.config.tarifa_hora).toFixed(2));
      const costo_total = Number((costo_mat_round + costo_mano_obra).toFixed(2));
      const divisor = 1 - mDeseado / 100;
      const precio_sugerido = divisor > 0 ? Math.round(costo_total / divisor) : costo_total;

      const prodItem: ProductoProduccion = {
        id: id || `prod-${Date.now()}`,
        producto_tienda_id: producto_tienda_id || null,
        nombre: String(nombre || "").trim(),
        categoria: categoria || "Amigurumis",
        tiempo_produccion: tProd,
        precio_venta_real: pReal,
        margen_deseado: mDeseado,
        costo_materiales: costo_mat_round,
        costo_mano_obra,
        costo_total,
        precio_sugerido,
        notas: notas || "",
        imagen: imagen ? String(imagen).trim() : undefined,
        items_receta: processedItems,
        created_at: new Date().toISOString(),
      };

      const existingIdx = currentData.productos.findIndex((p) => p.id === prodItem.id);
      if (existingIdx >= 0) {
        currentData.productos[existingIdx] = prodItem;
      } else {
        currentData.productos.unshift(prodItem);
      }

      // Actualizar referencias en campañas
      currentData.campanas = currentData.campanas.map((camp) => ({
        ...camp,
        items: camp.items.map((ci) => (ci.producto_id === prodItem.id ? { ...ci, producto: prodItem } : ci)),
      }));

      saveFallbackData(currentData);

      try {
        await supabaseAdmin.from("produccion_productos").upsert({
          id: prodItem.id,
          producto_tienda_id: prodItem.producto_tienda_id,
          nombre: prodItem.nombre,
          categoria: prodItem.categoria,
          tiempo_produccion: prodItem.tiempo_produccion,
          precio_venta_real: prodItem.precio_venta_real,
          margen_deseado: prodItem.margen_deseado,
          costo_materiales: prodItem.costo_materiales,
          costo_mano_obra: prodItem.costo_mano_obra,
          costo_total: prodItem.costo_total,
          precio_sugerido: prodItem.precio_sugerido,
          notas: prodItem.notas,
          imagen: prodItem.imagen,
        });

        // Reemplazar recetas
        await supabaseAdmin.from("produccion_recetas_items").delete().eq("producto_id", prodItem.id);
        if (processedItems.length > 0) {
          await supabaseAdmin.from("produccion_recetas_items").insert(
            processedItems.map((r) => ({
              id: r.id,
              producto_id: prodItem.id,
              material_id: r.material_id,
              cantidad: r.cantidad,
              costo_calculado: r.costo_calculado,
            }))
          );
        }
      } catch (e) {
        // Fallback activo
      }

      return NextResponse.json({ success: true, producto: prodItem, data: currentData });
    }

    if (action === "guardar-campana") {
      const { id, nombre, descripcion, fecha_inicio, fecha_fin, activa, items, gastos } = body;

      const campItem: CampanaProduccion = {
        id: id || `camp-${Date.now()}`,
        nombre: String(nombre || "").trim(),
        descripcion: descripcion || "",
        fecha_inicio: fecha_inicio || new Date().toISOString().split("T")[0],
        fecha_fin: fecha_fin || new Date().toISOString().split("T")[0],
        activa: activa !== undefined ? Boolean(activa) : true,
        items: (items || []).map((it: CampanaItemInput, idx: number) => ({
          id: it.id || `citem-${Date.now()}-${idx}`,
          campana_id: id || `camp-${Date.now()}`,
          producto_id: it.producto_id,
          cantidad_meta: Number(it.cantidad_meta) || 0,
          cantidad_terminada: Number(it.cantidad_terminada) || 0,
          producto: currentData.productos.find((p) => p.id === it.producto_id),
        })),
        gastos: (gastos || []).map((g: CampanaGastoInput, idx: number) => ({
          id: g.id || `cgasto-${Date.now()}-${idx}`,
          campana_id: id || `camp-${Date.now()}`,
          concepto: String(g.concepto || "").trim(),
          categoria: g.categoria || "Stand",
          monto: Number(g.monto) || 0,
        })),
        created_at: new Date().toISOString(),
      };

      const existingIdx = currentData.campanas.findIndex((c) => c.id === campItem.id);
      if (existingIdx >= 0) {
        currentData.campanas[existingIdx] = campItem;
      } else {
        currentData.campanas.unshift(campItem);
      }

      saveFallbackData(currentData);

      try {
        await supabaseAdmin.from("produccion_campanas").upsert({
          id: campItem.id,
          nombre: campItem.nombre,
          descripcion: campItem.descripcion,
          fecha_inicio: campItem.fecha_inicio,
          fecha_fin: campItem.fecha_fin,
          activa: campItem.activa,
        });

        await supabaseAdmin.from("produccion_campana_items").delete().eq("campana_id", campItem.id);
        if (campItem.items.length > 0) {
          await supabaseAdmin.from("produccion_campana_items").insert(
            campItem.items.map((it) => ({
              id: it.id,
              campana_id: campItem.id,
              producto_id: it.producto_id,
              cantidad_meta: it.cantidad_meta,
              cantidad_terminada: it.cantidad_terminada,
            }))
          );
        }

        await supabaseAdmin.from("produccion_campana_gastos").delete().eq("campana_id", campItem.id);
        if (campItem.gastos.length > 0) {
          await supabaseAdmin.from("produccion_campana_gastos").insert(
            campItem.gastos.map((g) => ({
              id: g.id,
              campana_id: campItem.id,
              concepto: g.concepto,
              categoria: g.categoria,
              monto: g.monto,
            }))
          );
        }
      } catch (e) {
        // Fallback activo
      }

      return NextResponse.json({ success: true, campana: campItem, data: currentData });
    }

    if (action === "guardar-bitacora") {
      const { producto_id, campana_id, piezas_terminadas, horas_dedicadas, fecha, notas } = body;
      const pTerminadas = Number(piezas_terminadas) || 1;
      const hDedicadas = Number(horas_dedicadas) || 1;
      const velocidad = Number((pTerminadas / Math.max(0.1, hDedicadas)).toFixed(2));
      const prod = currentData.productos.find((p) => p.id === producto_id);
      const tiempoEstimado = prod?.tiempo_produccion || 0;
      const tiempoReal = Number((hDedicadas / Math.max(1, pTerminadas)).toFixed(2));
      const diferencia = Number((tiempoReal - tiempoEstimado).toFixed(2));

      const logItem: BitacoraRegistro = {
        id: `bit-${Date.now()}`,
        fecha: fecha || new Date().toISOString().split("T")[0],
        producto_id,
        campana_id: campana_id || null,
        piezas_terminadas: pTerminadas,
        horas_dedicadas: hDedicadas,
        velocidad_piezas_hora: velocidad,
        tiempo_real_por_pieza: tiempoReal,
        tiempo_estimado_por_pieza: tiempoEstimado,
        diferencia_horas_pieza: diferencia,
        notas: notas || "",
        producto: prod
          ? {
              id: prod.id,
              nombre: prod.nombre,
              categoria: prod.categoria,
              tiempo_produccion: prod.tiempo_produccion,
              imagen: prod.imagen,
            }
          : undefined,
        created_at: new Date().toISOString(),
      };

      currentData.bitacora.unshift(logItem);

      // Si se vinculó a una campaña, actualizar o crear automáticamente el item de la campaña
      if (campana_id) {
        const camp = currentData.campanas.find((c) => c.id === campana_id);
        if (camp) {
          let item = camp.items.find((ci) => ci.producto_id === producto_id);
          if (item) {
            item.cantidad_terminada += pTerminadas;
          } else {
            item = {
              id: `citem-${Date.now()}`,
              campana_id: camp.id,
              producto_id,
              cantidad_meta: Math.max(10, pTerminadas),
              cantidad_terminada: pTerminadas,
              producto: prod,
            };
            camp.items.push(item);
          }
        }
      }

      saveFallbackData(currentData);

      try {
        await supabaseAdmin.from("produccion_bitacora").insert({
          id: logItem.id,
          fecha: logItem.fecha,
          producto_id: logItem.producto_id,
          campana_id: logItem.campana_id,
          piezas_terminadas: logItem.piezas_terminadas,
          horas_dedicadas: logItem.horas_dedicadas,
          velocidad_piezas_hora: logItem.velocidad_piezas_hora,
          notas: logItem.notas,
        });

        if (campana_id) {
          const camp = currentData.campanas.find((c) => c.id === campana_id);
          const item = camp?.items.find((ci) => ci.producto_id === producto_id);
          if (item) {
            await supabaseAdmin.from("produccion_campana_items").upsert({
              id: item.id,
              campana_id: item.campana_id,
              producto_id: item.producto_id,
              cantidad_meta: item.cantidad_meta,
              cantidad_terminada: item.cantidad_terminada,
            });
          }
        }
      } catch (e) {
        // Fallback activo
      }

      const updatedData = enrichDataWithRealTimes(currentData);
      return NextResponse.json({ success: true, log: logItem, data: updatedData });
    }

    if (action === "sumar-pieza-bitacora") {
      // Endpoint ultra-rápido para smartphones y tablets
      const { producto_id, campana_id, cantidad = 1 } = body;
      const cantNum = Number(cantidad) || 1;
      const prod = currentData.productos.find((p) => p.id === producto_id);
      const horasEstimadas = prod ? Number(((prod.tiempo_produccion || 1) * Math.abs(cantNum)).toFixed(2)) : Math.abs(cantNum);
      const tiempoReal = prod?.tiempo_produccion || 1;

      const logItem: BitacoraRegistro = {
        id: `bit-${Date.now()}`,
        fecha: new Date().toISOString().split("T")[0],
        producto_id,
        campana_id: campana_id || null,
        piezas_terminadas: cantNum,
        horas_dedicadas: horasEstimadas,
        velocidad_piezas_hora: prod ? Number((1 / Math.max(0.1, prod.tiempo_produccion)).toFixed(2)) : 1,
        tiempo_real_por_pieza: tiempoReal,
        tiempo_estimado_por_pieza: tiempoReal,
        diferencia_horas_pieza: 0,
        notas: cantNum > 0 ? "Registro rápido al ritmo deseado" : "Ajuste manual de conteo",
        producto: prod
          ? {
              id: prod.id,
              nombre: prod.nombre,
              categoria: prod.categoria,
              tiempo_produccion: prod.tiempo_produccion,
              imagen: prod.imagen,
            }
          : undefined,
        created_at: new Date().toISOString(),
      };

      currentData.bitacora.unshift(logItem);

      if (campana_id) {
        const camp = currentData.campanas.find((c) => c.id === campana_id);
        if (camp) {
          let item = camp.items.find((ci) => ci.producto_id === producto_id);
          if (item) {
            item.cantidad_terminada = Math.max(0, item.cantidad_terminada + cantNum);
          } else {
            item = {
              id: `citem-${Date.now()}`,
              campana_id: camp.id,
              producto_id,
              cantidad_meta: Math.max(10, Math.max(0, cantNum)),
              cantidad_terminada: Math.max(0, cantNum),
              producto: prod,
            };
            camp.items.push(item);
          }
        }
      }

      saveFallbackData(currentData);

      try {
        await supabaseAdmin.from("produccion_bitacora").insert({
          id: logItem.id,
          fecha: logItem.fecha,
          producto_id: logItem.producto_id,
          campana_id: logItem.campana_id,
          piezas_terminadas: logItem.piezas_terminadas,
          horas_dedicadas: logItem.horas_dedicadas,
          velocidad_piezas_hora: logItem.velocidad_piezas_hora,
          notas: logItem.notas,
        });

        if (campana_id) {
          const camp = currentData.campanas.find((c) => c.id === campana_id);
          const item = camp?.items.find((ci) => ci.producto_id === producto_id);
          if (item) {
            await supabaseAdmin.from("produccion_campana_items").upsert({
              id: item.id,
              campana_id: item.campana_id,
              producto_id: item.producto_id,
              cantidad_meta: item.cantidad_meta,
              cantidad_terminada: item.cantidad_terminada,
            });
          }
        }
      } catch (e) {
        // Fallback activo
      }

      const updatedData = enrichDataWithRealTimes(currentData);
      return NextResponse.json({ success: true, log: logItem, data: updatedData });
    }

    if (action === "adaptar-tiempo-real") {
      const { producto_id } = body;
      const enriched = enrichDataWithRealTimes(currentData);
      const prodEnriched = enriched.productos.find((p) => p.id === producto_id);
      if (!prodEnriched) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });

      if (prodEnriched.tiempo_real_promedio && prodEnriched.tiempo_real_promedio > 0) {
        const prod = currentData.productos.find((p) => p.id === producto_id);
        if (prod) {
          prod.tiempo_produccion = prodEnriched.tiempo_real_promedio;
          prod.costo_mano_obra = Number((prod.tiempo_produccion * currentData.config.tarifa_hora).toFixed(2));
          prod.costo_total = Number((prod.costo_materiales + prod.costo_mano_obra).toFixed(2));
          const divisor = 1 - (prod.margen_deseado || 40) / 100;
          prod.precio_sugerido = divisor > 0 ? Math.round(prod.costo_total / divisor) : prod.costo_total;

          saveFallbackData(currentData);

          try {
            await supabaseAdmin
              .from("produccion_productos")
              .update({
                tiempo_produccion: prod.tiempo_produccion,
                costo_mano_obra: prod.costo_mano_obra,
                costo_total: prod.costo_total,
                precio_sugerido: prod.precio_sugerido,
              })
              .eq("id", prod.id);
          } catch (e) {}
        }
      }

      const updatedData = enrichDataWithRealTimes(currentData);
      return NextResponse.json({ success: true, data: updatedData });
    }

    if (action === "guardar-categoria") {
      const { categoria } = body;
      const catTrim = (categoria || "").trim();
      if (!catTrim) {
        return NextResponse.json({ error: "Nombre de categoría requerido" }, { status: 400 });
      }
      return NextResponse.json({ success: true, categoria: catTrim });
    }

    if (action === "publicar-productos-tienda") {
      const { items, catalogo_slug } = body;
      if (!Array.isArray(items) || items.length === 0) {
        return NextResponse.json({ error: "No se enviaron productos para publicar" }, { status: 400 });
      }

      const { saveProduct } = await import("@/lib/productos-db");
      const resultados = [];

      for (const item of items) {
        const prodProd = currentData.productos.find((p) => p.id === item.producto_id);
        const prodTiendaId = item.producto_tienda_id || prodProd?.producto_tienda_id || undefined;
        const nombreProd = item.nombre || prodProd?.nombre || "Producto Artesanal";
        const precioProd = Number(item.precio) || prodProd?.precio_venta_real || 0;
        const stockProd = Number(item.stock) || 0;
        const catProd = item.categoria || prodProd?.categoria || "General";
        const imgProd = item.imagen || prodProd?.imagen || "";
        const descProd = item.descripcion || `Detalle artesanal confeccionado a mano en taller Entre Hilos (${catProd}).`;

        const targetCatalogos = catalogo_slug && catalogo_slug !== "general" ? [catalogo_slug] : [];

        const prodGuardado = await saveProduct({
          id: prodTiendaId,
          nombre: nombreProd,
          precio: precioProd,
          stock: stockProd,
          categoria: catProd,
          imagen: imgProd,
          descripcion: descProd,
          catalogos: targetCatalogos,
          is_active: true,
        });

        // Vincular producto_tienda_id en produccion_productos
        if (prodProd) {
          prodProd.producto_tienda_id = prodGuardado.id;
          try {
            await supabaseAdmin
              .from("produccion_productos")
              .update({ producto_tienda_id: prodGuardado.id })
              .eq("id", prodProd.id);
          } catch (e) {}
        }

        // Si hay catalogo_slug asignado, registrarlo en producto_catalogos
        if (catalogo_slug && catalogo_slug !== "general") {
          try {
            await supabaseAdmin
              .from("producto_catalogos")
              .upsert(
                {
                  producto_id: prodGuardado.id,
                  sku: prodGuardado.sku || null,
                  categoria_slug: catalogo_slug.toLowerCase().trim(),
                  incluir: true,
                },
                { onConflict: "producto_id,categoria_slug" }
              );
          } catch (e) {}
        }

        resultados.push(prodGuardado);
      }

      saveFallbackData(currentData);
      const updatedData = enrichDataWithRealTimes(currentData);
      return NextResponse.json({ success: true, publicados: resultados, data: updatedData });
    }

    return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as { message?: string }).message || "Error al procesar" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;
    const currentData = await getProduccionData();

    if (action === "actualizar-meta-campana") {
      const { campana_id, producto_id, cantidad_meta, cantidad_terminada } = body;
      const camp = currentData.campanas.find((c) => c.id === campana_id);
      if (!camp) return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });

      const item = camp.items.find((ci) => ci.producto_id === producto_id);
      if (item) {
        if (cantidad_meta !== undefined) item.cantidad_meta = Number(cantidad_meta) || 0;
        if (cantidad_terminada !== undefined) item.cantidad_terminada = Number(cantidad_terminada) || 0;
      } else {
        camp.items.push({
          id: `citem-${Date.now()}`,
          campana_id,
          producto_id,
          cantidad_meta: Number(cantidad_meta) || 0,
          cantidad_terminada: Number(cantidad_terminada) || 0,
          producto: currentData.productos.find((p) => p.id === producto_id),
        });
      }

      saveFallbackData(currentData);

      try {
        await supabaseAdmin
          .from("produccion_campana_items")
          .upsert({
            campana_id,
            producto_id,
            cantidad_meta: Number(cantidad_meta) || 0,
            cantidad_terminada: Number(cantidad_terminada) || 0,
          });
      } catch (e) {
        // Fallback activo
      }

      return NextResponse.json({ success: true, data: currentData });
    }

    if (action === "toggle-campana-activa") {
      const { id } = body;
      const camp = currentData.campanas.find((c) => c.id === id);
      if (camp) {
        camp.activa = !camp.activa;
        saveFallbackData(currentData);
        try {
          await supabaseAdmin.from("produccion_campanas").update({ activa: camp.activa }).eq("id", id);
        } catch (e) {
          // Fallback activo
        }
      }
      return NextResponse.json({ success: true, data: currentData });
    }

    return NextResponse.json({ error: "Acción PATCH no reconocida" }, { status: 400 });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as { message?: string }).message || "Error al actualizar" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get("tipo");
    const id = searchParams.get("id");

    if (!tipo || !id) {
      return NextResponse.json({ error: "Faltan parámetros 'tipo' o 'id'" }, { status: 400 });
    }

    const currentData = await getProduccionData();

    if (tipo === "material") {
      currentData.materiales = currentData.materiales.filter((m) => m.id !== id);
      // Quitar de las recetas
      currentData.productos.forEach((p) => {
        p.items_receta = p.items_receta.filter((r) => r.material_id !== id);
      });
      saveFallbackData(currentData);
      try {
        await supabaseAdmin.from("produccion_materiales").delete().eq("id", id);
      } catch (e) {}
    } else if (tipo === "producto") {
      currentData.productos = currentData.productos.filter((p) => p.id !== id);
      currentData.campanas.forEach((c) => {
        c.items = c.items.filter((ci) => ci.producto_id !== id);
      });
      currentData.bitacora = currentData.bitacora.filter((b) => b.producto_id !== id);
      saveFallbackData(currentData);
      try {
        await supabaseAdmin.from("produccion_productos").delete().eq("id", id);
      } catch (e) {}
    } else if (tipo === "campana") {
      currentData.campanas = currentData.campanas.filter((c) => c.id !== id);
      saveFallbackData(currentData);
      try {
        await supabaseAdmin.from("produccion_campanas").delete().eq("id", id);
      } catch (e) {}
    } else if (tipo === "bitacora") {
      currentData.bitacora = currentData.bitacora.filter((b) => b.id !== id);
      saveFallbackData(currentData);
      try {
        await supabaseAdmin.from("produccion_bitacora").delete().eq("id", id);
      } catch (e) {}
    } else if (tipo === "gasto") {
      currentData.campanas.forEach((c) => {
        c.gastos = c.gastos.filter((g) => g.id !== id);
      });
      saveFallbackData(currentData);
      try {
        await supabaseAdmin.from("produccion_campana_gastos").delete().eq("id", id);
      } catch (e) {}
    }

    return NextResponse.json({ success: true, data: currentData });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as { message?: string }).message || "Error al eliminar" }, { status: 500 });
  }
}
