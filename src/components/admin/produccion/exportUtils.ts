import { MaterialItem, ProductoProduccion, CampanaProduccion } from "@/types/produccion";

export function exportarCSV(nombreArchivo: string, encabezados: string[], filas: (string | number)[][]) {
  const contenido = [
    encabezados.map((h) => `"${h.replace(/"/g, '""')}"`).join(","),
    ...filas.map((fila) =>
      fila.map((val) => `"${String(val ?? "").replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\r\n");

  const blob = new Blob(["\uFEFF" + contenido], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${nombreArchivo}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportarReporteCostos(productos: ProductoProduccion[], tarifaHora: number) {
  const encabezados = [
    "Producto",
    "Categoría",
    "Tiempo (Horas)",
    "Costo Materiales (S/)",
    `Costo Mano de Obra (S/ ${tarifaHora}/h)`,
    "Costo Total (S/)",
    "Margen Deseado (%)",
    "Precio Sugerido (S/)",
    "Precio Real (S/)",
    "Ganancia Neta (S/)",
    "Margen Real (%)",
  ];

  const filas = productos.map((p) => {
    const ganancia = Number((p.precio_venta_real - p.costo_total).toFixed(2));
    const margenReal = p.precio_venta_real > 0 ? Number(((ganancia / p.precio_venta_real) * 100).toFixed(1)) : 0;
    return [
      p.nombre,
      p.categoria,
      p.tiempo_produccion,
      p.costo_materiales.toFixed(2),
      p.costo_mano_obra.toFixed(2),
      p.costo_total.toFixed(2),
      `${p.margen_deseado}%`,
      p.precio_sugerido.toFixed(2),
      p.precio_venta_real.toFixed(2),
      ganancia.toFixed(2),
      `${margenReal}%`,
    ];
  });

  exportarCSV("entre_hilos_escandallo_costos", encabezados, filas);
}

export function exportarBOMMateriales(materiales: MaterialItem[]) {
  const encabezados = [
    "Insumo / Material",
    "Categoría",
    "Presentación",
    "Precio Compra (S/)",
    "Cantidad Comprada",
    "Unidad de Medida",
    "Costo Unitario Mínimo (S/)",
    "Stock Actual",
  ];

  const filas = materiales.map((m) => [
    m.nombre,
    m.categoria,
    m.presentacion || "-",
    m.precio_compra.toFixed(2),
    m.cantidad_total,
    m.unidad_medida,
    m.costo_unitario.toFixed(4),
    m.stock_actual ?? "-",
  ]);

  exportarCSV("entre_hilos_catalogo_insumos_bom", encabezados, filas);
}

export function exportarListaEmpaqueCampana(campana: CampanaProduccion) {
  const encabezados = [
    "Campaña / Feria",
    "Producto",
    "Meta Planificada",
    "Terminadas / En Stock",
    "Faltantes",
    "% Avance",
    "Horas Restantes",
  ];

  const filas = campana.items.map((it) => {
    const faltantes = Math.max(0, it.cantidad_meta - it.cantidad_terminada);
    const avance = it.cantidad_meta > 0 ? Math.round((it.cantidad_terminada / it.cantidad_meta) * 100) : 100;
    const tProd = it.producto?.tiempo_produccion || 1;
    const horasRest = Number((faltantes * tProd).toFixed(1));
    return [
      campana.nombre,
      it.producto?.nombre || it.producto_id,
      it.cantidad_meta,
      it.cantidad_terminada,
      faltantes,
      `${avance}%`,
      horasRest,
    ];
  });

  exportarCSV(`lista_empaque_${campana.nombre.toLowerCase().replace(/\s+/g, "_")}`, encabezados, filas);
}
