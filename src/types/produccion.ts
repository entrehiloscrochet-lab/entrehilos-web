export interface ProduccionConfig {
  id: string;
  tarifa_hora: number; // Tarifa por hora de mano de obra en S/ (ej. 8.00)
  margen_deseado_default: number; // Porcentaje de margen deseado (ej. 40%)
  limite_horas_dia_alerta: number; // Horas límite de tejido por día para alerta (ej. 4.5)
  updated_at?: string;
}

export type CategoriaMaterial = string;

export type UnidadMedida = "gramos" | "pares" | "unidades" | "metros" | "pliegos" | "conos" | "precio" | "soles";

export type TipoPresentacionMayor =
  | "ciento" // 100 unidades
  | "medio_ciento" // 50 unidades
  | "docena" // 12 unidades
  | "decena" // 10 unidades
  | "unidad" // 1 unidad
  | "ovillo_100g" // Ovillo 100g
  | "granel_kilo" // 1000 gramos
  | "personalizado";

export interface MaterialItem {
  id: string;
  nombre: string;
  categoria: CategoriaMaterial;
  presentacion?: string; // ej. "Ciento (100 u)", "Docena (12 u)", "Ovillo 100g"
  precio_compra: number; // Precio total de compra en S/
  cantidad_total: number; // Cantidad total del paquete/granel (ej. 100, 12, etc.)
  unidad_medida: UnidadMedida;
  costo_unitario: number; // Calculado: precio_compra / cantidad_total
  stock_actual?: number;
  imagen?: string;
  created_at?: string;
}

export type ModoUsoMaterial = "rendimiento" | "unidades" | "fraccion" | "cantidad" | "precio";

export interface RecetaItem {
  id: string;
  producto_id: string;
  material_id: string;
  cantidad: number; // Cantidad consumida (ej. 25 gramos, 1 par de ojos)
  modo_uso?: ModoUsoMaterial; // "rendimiento" (1 ovillo rinde X) | "unidades" | "cantidad" | "precio"
  rendimiento_piezas?: number; // Cuántas piezas salen de 1 ovillo/paquete (ej. 4)
  monto_directo?: number; // Monto directo en soles asignado
  costo_calculado?: number; // cantidad * material.costo_unitario o precio_compra / rendimiento o monto_directo
  material?: MaterialItem;
}

export interface ProductoProduccion {
  id: string;
  producto_tienda_id?: string | null;
  nombre: string;
  categoria: string; // ej. "Llaveros Impulso", "Flores Eternas", "Gift Boxes", "Amigurumis"
  tiempo_produccion: number; // En horas decimales estimado / deseado (ej. 1.25)
  tiempo_real_promedio?: number; // Promedio real calculado desde la bitácora
  desviacion_tiempo?: number; // tiempo_real_promedio - tiempo_produccion (positivo = demoró más)
  costo_real_promedio?: number; // costo con tiempo real
  precio_venta_real: number; // Precio fijado por el usuario
  margen_deseado: number; // Margen comercial deseado (ej. 40%)
  costo_materiales: number; // Suma de materiales
  costo_mano_obra: number; // tiempo_produccion * tarifa_hora
  costo_total: number; // costo_materiales + costo_mano_obra
  precio_sugerido: number; // Math.round(costo_total / (1 - margen_deseado / 100))
  notas?: string;
  imagen?: string;
  items_receta: RecetaItem[];
  created_at?: string;
}

export interface CampanaGasto {
  id: string;
  campana_id: string;
  concepto: string; // "Alquiler Stand", "Movilidad / Flete", etc.
  categoria: string;
  monto: number;
}

export interface CampanaItem {
  id: string;
  campana_id: string;
  producto_id: string;
  cantidad_meta: number;
  cantidad_terminada: number;
  producto?: ProductoProduccion;
}

export interface CampanaProduccion {
  id: string;
  nombre: string;
  descripcion?: string;
  fecha_inicio: string; // YYYY-MM-DD
  fecha_fin: string; // YYYY-MM-DD
  activa: boolean;
  items: CampanaItem[];
  gastos: CampanaGasto[];
  created_at?: string;
}

export interface BitacoraRegistro {
  id: string;
  fecha: string; // YYYY-MM-DD
  producto_id: string;
  campana_id?: string | null;
  piezas_terminadas: number;
  horas_dedicadas: number;
  velocidad_piezas_hora: number; // piezas_terminadas / horas_dedicadas
  tiempo_real_por_pieza?: number; // horas_dedicadas / piezas_terminadas
  tiempo_estimado_por_pieza?: number; // tiempo deseado fijado en receta
  diferencia_horas_pieza?: number; // tiempo_real - tiempo_estimado
  notas?: string;
  producto?: {
    id: string;
    nombre: string;
    categoria: string;
    tiempo_produccion?: number;
    imagen?: string;
  };
  created_at?: string;
}

export interface EventoCatalogoItem {
  slug: string;
  nombre: string;
  descripcion?: string;
  activo?: boolean;
}

export interface PublicarProductoItem {
  producto_id: string;
  nombre: string;
  precio: number;
  stock: number;
  categoria: string;
  imagen?: string;
  descripcion?: string;
  catalogo_slug?: string | null; // Evento o catálogo destino
}

export interface ResumenProduccionData {
  config: ProduccionConfig;
  materiales: MaterialItem[];
  productos: ProductoProduccion[];
  campanas: CampanaProduccion[];
  bitacora: BitacoraRegistro[];
  categorias?: string[];
  eventos?: EventoCatalogoItem[];
}
