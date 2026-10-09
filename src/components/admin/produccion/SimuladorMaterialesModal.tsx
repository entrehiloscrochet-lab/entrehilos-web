"use client";

import React, { useState, useMemo } from "react";
import {
  Calculator,
  Search,
  X,
  Plus,
  Minus,
  RotateCcw,
  Package,
  Clock,
  Sparkles,
  Layers,
  Heart,
  Copy,
  Check,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { ProductoProduccion, MaterialItem } from "@/types/produccion";

interface SimuladorMaterialesModalProps {
  abierto: boolean;
  onCerrar: () => void;
  productos: ProductoProduccion[];
  materiales: MaterialItem[];
}

interface InsumoDesglose {
  materialId: string;
  nombre: string;
  categoria: string;
  presentacion: string;
  precioCompra: number;
  unidadMedida: string;
  modoUso: string;
  rendimientoPiezas: number;
  consumoFisicoTotal: number;
  textoConsumo: string;
  costoTotalEstimado: number;
  unidadesAComprar: number;
  costoCompraPaquetes: number;
  disenosAportantes: Array<{
    nombre: string;
    piezas: number;
    consumo: string;
    costo: number;
  }>;
}

export default function SimuladorMaterialesModal({
  abierto,
  onCerrar,
  productos,
  materiales,
}: SimuladorMaterialesModalProps) {
  // Cantidades deseadas por cada producto ID
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [busqueda, setBusqueda] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("todas");
  const [filtroCategoriaInsumos, setFiltroCategoriaInsumos] = useState("todas");
  const [vistaMovil, setVistaMovil] = useState<"disenos" | "insumos">("disenos");
  const [copiado, setCopiado] = useState(false);

  // Categorías de productos disponibles
  const categoriasProductos = useMemo(() => {
    const set = new Set<string>();
    productos.forEach((p) => {
      if (p.categoria) set.add(p.categoria);
    });
    return ["todas", ...Array.from(set)];
  }, [productos]);

  // Modificar cantidad de un producto
  const setCantidadProducto = (id: string, valor: number) => {
    const clean = Math.max(0, Math.floor(valor) || 0);
    setCantidades((prev) => ({
      ...prev,
      [id]: clean,
    }));
  };

  const modificarCantidad = (id: string, delta: number) => {
    const actual = cantidades[id] || 0;
    setCantidadProducto(id, actual + delta);
  };

  const limpiarTodo = () => {
    setCantidades({});
  };

  const ponerUnoATodos = () => {
    const next: Record<string, number> = {};
    productos.forEach((p) => {
      next[p.id] = 1;
    });
    setCantidades(next);
  };

  // Filtrar productos
  const productosFiltrados = useMemo(() => {
    return productos.filter((p) => {
      const q = busqueda.toLowerCase().trim();
      const matchQuery = !q || p.nombre.toLowerCase().includes(q) || (p.categoria || "").toLowerCase().includes(q);
      const matchCat = categoriaFiltro === "todas" || p.categoria === categoriaFiltro;
      return matchQuery && matchCat;
    });
  }, [productos, busqueda, categoriaFiltro]);

  // Cálculo en tiempo real de insumos
  const calculos = useMemo(() => {
    let totalPiezas = 0;
    let totalModelosConCantidad = 0;
    let totalHoras = 0;

    const mapaInsumos = new Map<string, InsumoDesglose>();

    for (const prod of productos) {
      const cant = cantidades[prod.id] || 0;
      if (cant <= 0) continue;

      totalPiezas += cant;
      totalModelosConCantidad += 1;
      totalHoras += (prod.tiempo_produccion || 1) * cant;

      for (const rec of prod.items_receta || []) {
        const mat = materiales.find((m) => m.id === rec.material_id) || rec.material;
        const matId = rec.material_id || mat?.id || `temp-${rec.id || Math.random()}`;
        const nombre = mat?.nombre || rec.material?.nombre || "Insumo sin nombre";
        const categoria = mat?.categoria || "Hilos";
        const precioCompra = mat?.precio_compra || 0;
        const unidad = mat?.unidad_medida || "unidades";
        const esPrecio = rec.modo_uso === "precio" || unidad === "precio" || unidad === "soles";
        const modo = esPrecio
          ? "precio"
          : rec.modo_uso || (rec.rendimiento_piezas ? "rendimiento" : "unidades");
        const rendimiento = rec.rendimiento_piezas && rec.rendimiento_piezas > 0 ? rec.rendimiento_piezas : 4;
        const presentacion = mat?.presentacion || `${mat?.cantidad_total || 1} ${unidad}`;

        let aporteCosto = 0;
        let aporteConsumoFisico = 0;
        let textoConsumoAporte = "";

        if (modo === "precio") {
          const montoUnit = rec.monto_directo !== undefined ? rec.monto_directo : (rec.costo_calculado || 1);
          aporteCosto = cant * montoUnit;
          aporteConsumoFisico = aporteCosto;
          textoConsumoAporte = `S/ ${aporteCosto.toFixed(2)}`;
        } else if (modo === "rendimiento") {
          const fracOvillo = cant / rendimiento;
          aporteCosto = fracOvillo * precioCompra;
          aporteConsumoFisico = fracOvillo;
          textoConsumoAporte = `${fracOvillo.toFixed(2)} ov`;
        } else if (unidad === "gramos") {
          const g = cant * (rec.cantidad || 0);
          const costoG = mat?.costo_unitario || (precioCompra / (mat?.cantidad_total || 100));
          aporteCosto = g * costoG;
          aporteConsumoFisico = g;
          textoConsumoAporte = `${Math.round(g)}g`;
        } else {
          const u = cant * (rec.cantidad || 1);
          const costoU = mat?.costo_unitario || (precioCompra / (mat?.cantidad_total || 1));
          aporteCosto = u * costoU;
          aporteConsumoFisico = u;
          textoConsumoAporte = `${u} ${unidad === "pares" ? "par" : "u"}`;
        }

        if (!mapaInsumos.has(matId)) {
          mapaInsumos.set(matId, {
            materialId: matId,
            nombre,
            categoria,
            presentacion,
            precioCompra,
            unidadMedida: unidad,
            modoUso: modo,
            rendimientoPiezas: rendimiento,
            consumoFisicoTotal: aporteConsumoFisico,
            textoConsumo: "",
            costoTotalEstimado: aporteCosto,
            unidadesAComprar: 0,
            costoCompraPaquetes: 0,
            disenosAportantes: [
              {
                nombre: prod.nombre,
                piezas: cant,
                consumo: textoConsumoAporte,
                costo: aporteCosto,
              },
            ],
          });
        } else {
          const itemExistente = mapaInsumos.get(matId)!;
          itemExistente.consumoFisicoTotal += aporteConsumoFisico;
          itemExistente.costoTotalEstimado += aporteCosto;
          itemExistente.disenosAportantes.push({
            nombre: prod.nombre,
            piezas: cant,
            consumo: textoConsumoAporte,
            costo: aporteCosto,
          });
        }
      }
    }

    let gastoTotalMateriales = 0;
    const listaInsumos: InsumoDesglose[] = [];

    mapaInsumos.forEach((item) => {
      let unidadesAComprar = 0;
      let costoCompraPaquetes = item.costoTotalEstimado;
      let textoConsumo = "";

      if (item.modoUso === "precio") {
        unidadesAComprar = 1;
        textoConsumo = `S/ ${item.costoTotalEstimado.toFixed(2)} requeridos`;
        costoCompraPaquetes = item.costoTotalEstimado;
      } else if (item.modoUso === "rendimiento") {
        unidadesAComprar = Math.ceil(item.consumoFisicoTotal);
        textoConsumo = `${item.consumoFisicoTotal.toFixed(2)} ovillo(s) total (${item.rendimientoPiezas} pz/ovillo)`;
        costoCompraPaquetes = unidadesAComprar * item.precioCompra;
      } else if (item.unidadMedida === "gramos") {
        const matOriginal = materiales.find((m) => m.id === item.materialId);
        const paqueteG = matOriginal?.cantidad_total || 100;
        unidadesAComprar = Math.ceil(item.consumoFisicoTotal / paqueteG);
        textoConsumo = `${Math.round(item.consumoFisicoTotal)} gramos`;
        costoCompraPaquetes = unidadesAComprar * item.precioCompra;
      } else {
        const matOriginal = materiales.find((m) => m.id === item.materialId);
        const tamPaquete = matOriginal?.cantidad_total || 1;
        unidadesAComprar = Math.ceil(item.consumoFisicoTotal / tamPaquete);
        textoConsumo = `${Math.round(item.consumoFisicoTotal)} ${item.unidadMedida}`;
        costoCompraPaquetes = unidadesAComprar * item.precioCompra;
      }

      item.unidadesAComprar = unidadesAComprar;
      item.costoCompraPaquetes = costoCompraPaquetes;
      item.textoConsumo = textoConsumo;
      gastoTotalMateriales += item.costoTotalEstimado;
      listaInsumos.push(item);
    });

    // Ordenar por costo total descendente
    listaInsumos.sort((a, b) => b.costoTotalEstimado - a.costoTotalEstimado);

    return {
      totalPiezas,
      totalModelosConCantidad,
      totalHoras,
      gastoTotalMateriales,
      listaInsumos,
    };
  }, [cantidades, productos, materiales]);

  // Filtrar lista de insumos por categoría
  const insumosFiltrados = useMemo(() => {
    if (filtroCategoriaInsumos === "todas") return calculos.listaInsumos;
    return calculos.listaInsumos.filter((i) => i.categoria === filtroCategoriaInsumos);
  }, [calculos.listaInsumos, filtroCategoriaInsumos]);

  // Copiar resumen de compras al portapapeles
  const copiarResumen = () => {
    if (calculos.listaInsumos.length === 0) return;
    let texto = `=== REPORTE ESTIMADO DE INSUMOS (ENTRE HILOS) ===\n`;
    texto += `Total Diseños: ${calculos.totalModelosConCantidad} | Piezas a Tejer: ${calculos.totalPiezas}\n`;
    texto += `Horas estimadas: ${calculos.totalHoras.toFixed(1)}h | Presupuesto Insumos: S/ ${calculos.gastoTotalMateriales.toFixed(2)}\n\n`;
    texto += `--- DETALLE POR INSUMO ---\n`;
    calculos.listaInsumos.forEach((ins, idx) => {
      texto += `${idx + 1}. ${ins.nombre} (${ins.categoria})\n`;
      texto += `   - Consumo: ${ins.textoConsumo} | Gasto: S/ ${ins.costoTotalEstimado.toFixed(2)}\n`;
      if (ins.modoUso === "rendimiento") {
        texto += `   - Comprar: ${ins.unidadesAComprar} ovillo(s) enteros (S/ ${ins.costoCompraPaquetes.toFixed(2)})\n`;
      }
      texto += `   - Usado en: ${ins.disenosAportantes.map((d) => `${d.nombre} (${d.piezas} pz)`).join(", ")}\n\n`;
    });

    navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-xs overflow-hidden animate-in fade-in">
      {/* Modal Principal Adaptable a Tablet Horizontal, Vertical y Móvil */}
      <div className="bg-white w-full max-w-5xl h-[94vh] max-h-[94vh] rounded-3xl border border-pink-200 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 font-quicksand">
        {/* Cabecera del Modal */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-pink-100 flex items-center justify-between gap-3 bg-gradient-to-r from-pink-50/70 via-white to-pink-50/40 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#EE6B8D]/15 text-[#C04267] flex items-center justify-center shrink-0">
                <Calculator size={18} />
              </div>
              <h3 className="font-fredoka text-base sm:text-lg font-bold text-gray-900 truncate">
                Simulador de Insumos por Diseños
              </h3>
            </div>
            <p className="text-[11px] text-gray-500 truncate mt-0.5 hidden sm:block">
              Indica la cantidad deseada a confeccionar por cada modelo para ver el cálculo exacto de materiales y costos.
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={limpiarTodo}
              className="px-2.5 py-1.5 rounded-xl border border-pink-200 text-gray-600 hover:text-[#C04267] hover:bg-pink-50 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
              title="Restablecer todas las cantidades a 0"
            >
              <RotateCcw size={12} />
              <span className="hidden sm:inline">Limpiar</span>
            </button>
            <button
              type="button"
              onClick={ponerUnoATodos}
              className="px-2.5 py-1.5 rounded-xl border border-pink-200 text-gray-600 hover:text-[#C04267] hover:bg-pink-50 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
              title="Colocar 1 pieza a cada diseño"
            >
              <Plus size={12} />
              <span className="hidden sm:inline">+1 a todos</span>
            </button>
            <button
              type="button"
              onClick={onCerrar}
              className="w-8 h-8 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors cursor-pointer ml-1"
              title="Cerrar modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Selector de Pestañas en Móvil / Tablet Vertical (< lg) para Evitar Scroll Gigante */}
        <div className="lg:hidden px-3 pt-2.5 pb-2 bg-pink-50/50 border-b border-pink-100 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setVistaMovil("disenos")}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              vistaMovil === "disenos"
                ? "bg-[#C04267] text-white shadow-xs"
                : "bg-white text-gray-600 border border-pink-100 hover:bg-pink-50"
            }`}
          >
            <span>1. Diseños a Tejer</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${vistaMovil === "disenos" ? "bg-white/20 text-white" : "bg-pink-100 text-[#C04267]"}`}>
              {calculos.totalPiezas} pz
            </span>
          </button>
          <button
            type="button"
            onClick={() => setVistaMovil("insumos")}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              vistaMovil === "insumos"
                ? "bg-[#C04267] text-white shadow-xs"
                : "bg-white text-gray-600 border border-pink-100 hover:bg-pink-50"
            }`}
          >
            <span>2. Gasto por Insumo</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${vistaMovil === "insumos" ? "bg-white/20 text-white" : "bg-pink-100 text-[#C04267]"}`}>
              S/ {calculos.gastoTotalMateriales.toFixed(2)}
            </span>
          </button>
        </div>

        {/* Cuerpo del Modal: 2 Columnas Equilibradas en Desktop/Tablet Horizontal, Pestañas en Móvil */}
        <div className="flex-1 min-h-0 overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-0 lg:gap-4 p-3 sm:p-4">
          {/* PANEL IZQUIERDO: SELECCIÓN DE DISEÑOS Y CANTIDADES (col-span-5) */}
          <div
            className={`lg:col-span-5 h-full flex flex-col min-h-0 bg-gray-50/50 rounded-2xl border border-pink-100/70 p-3 overflow-hidden ${
              vistaMovil === "disenos" ? "flex" : "hidden lg:flex"
            }`}
          >
            {/* Buscador y filtro de categorías */}
            <div className="space-y-2 pb-2.5 border-b border-pink-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar diseño..."
                    className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl border border-pink-200 bg-white focus:border-[#EE6B8D] focus:outline-none"
                  />
                  {busqueda && (
                    <button
                      type="button"
                      onClick={() => setBusqueda("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <select
                  value={categoriaFiltro}
                  onChange={(e) => setCategoriaFiltro(e.target.value)}
                  className="px-2 py-1.5 rounded-xl border border-pink-200 bg-white text-xs text-gray-700 focus:border-[#EE6B8D] focus:outline-none max-w-[130px] truncate"
                >
                  {categoriasProductos.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat === "todas" ? "Todas cat." : cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between text-[11px] text-gray-500 px-0.5">
                <span>{productosFiltrados.length} modelo(s) disponibles</span>
                {calculos.totalModelosConCantidad > 0 && (
                  <span className="font-bold text-[#C04267]">
                    {calculos.totalModelosConCantidad} seleccionados ({calculos.totalPiezas} piezas)
                  </span>
                )}
              </div>
            </div>

            {/* Lista Scrollable de Diseños */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pt-2 pr-1">
              {productosFiltrados.length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-400">
                  No se encontraron diseños disponibles.
                </div>
              ) : (
                productosFiltrados.map((prod) => {
                  const cant = cantidades[prod.id] || 0;
                  const activo = cant > 0;
                  const insumosCount = prod.items_receta?.length || 0;

                  return (
                    <div
                      key={prod.id}
                      className={`p-2.5 rounded-2xl border transition-all ${
                        activo
                          ? "bg-white border-[#EE6B8D] shadow-xs ring-1 ring-[#EE6B8D]/30"
                          : "bg-white/90 border-pink-100/90 hover:border-pink-200"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-pink-50/50 shrink-0 border border-pink-100 flex items-center justify-center">
                          {prod.imagen ? (
                            <img src={prod.imagen} alt={prod.nombre} className="w-full h-full object-cover" />
                          ) : (
                            <Heart size={15} className="text-[#EE6B8D]" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-xs text-gray-900 truncate">
                            {prod.nombre}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-0.5">
                            <span className="bg-pink-50 text-[#C04267] font-semibold px-1.5 py-0.2 rounded-md">
                              {prod.categoria || "General"}
                            </span>
                            <span>{insumosCount} insumo(s)</span>
                            <span>{prod.tiempo_produccion}h/pz</span>
                          </div>
                        </div>

                        {/* Control de Cantidad Rápido */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => modificarCantidad(prod.id, -1)}
                            className="w-7 h-7 rounded-lg bg-pink-50 text-gray-600 hover:bg-pink-100 hover:text-[#C04267] flex items-center justify-center cursor-pointer transition-colors active:scale-90"
                            title="Restar 1 pieza"
                          >
                            <Minus size={12} />
                          </button>

                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={cantidades[prod.id] !== undefined ? cantidades[prod.id] : 0}
                            onChange={(e) => setCantidadProducto(prod.id, parseInt(e.target.value) || 0)}
                            className={`w-12 h-7 rounded-lg text-center font-fredoka font-bold text-xs border focus:outline-none ${
                              activo
                                ? "bg-pink-50/80 border-[#EE6B8D] text-[#C04267]"
                                : "bg-white border-gray-200 text-gray-700"
                            }`}
                          />

                          <button
                            type="button"
                            onClick={() => modificarCantidad(prod.id, 1)}
                            className="w-7 h-7 rounded-lg bg-pink-50 text-gray-600 hover:bg-pink-100 hover:text-[#C04267] flex items-center justify-center cursor-pointer transition-colors active:scale-90"
                            title="Sumar 1 pieza"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Botones de incremento rápido */}
                      <div className="flex items-center justify-end gap-1 mt-1.5 pt-1.5 border-t border-pink-50">
                        <span className="text-[9px] text-gray-400 mr-1">Rápido:</span>
                        {[2, 5, 10].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => modificarCantidad(prod.id, num)}
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 hover:bg-pink-100 text-gray-600 hover:text-[#C04267] transition-colors cursor-pointer"
                          >
                            +{num}
                          </button>
                        ))}
                        {activo && (
                          <button
                            type="button"
                            onClick={() => setCantidadProducto(prod.id, 0)}
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer ml-1"
                          >
                            Quitar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* En Móvil: Botón para saltar a ver insumos */}
            <div className="lg:hidden pt-2 border-t border-pink-100 shrink-0">
              <button
                type="button"
                onClick={() => setVistaMovil("insumos")}
                disabled={calculos.totalPiezas === 0}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#EE6B8D] to-[#C04267] text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all cursor-pointer shadow-xs"
              >
                <span>Ver cálculo de insumos ({calculos.totalPiezas} piezas)</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* PANEL DERECHO: RESULTADO DEL CÁLCULO POR INSUMO (col-span-7) */}
          <div
            className={`lg:col-span-7 h-full flex flex-col min-h-0 bg-white rounded-2xl border border-pink-100 p-3 sm:p-4 overflow-hidden ${
              vistaMovil === "insumos" ? "flex" : "hidden lg:flex"
            }`}
          >
            {/* KPI Cards Panorámicas */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pb-3 border-b border-pink-100 shrink-0">
              <div className="bg-pink-50/60 p-2.5 rounded-xl border border-pink-100">
                <div className="text-[10px] font-bold text-gray-500 uppercase">Piezas Totales</div>
                <div className="font-fredoka text-lg sm:text-xl font-bold text-[#C04267] mt-0.5">
                  {calculos.totalPiezas} <span className="text-xs font-normal text-gray-500">pz</span>
                </div>
              </div>

              <div className="bg-pink-50/60 p-2.5 rounded-xl border border-pink-100">
                <div className="text-[10px] font-bold text-gray-500 uppercase">Gasto Insumos</div>
                <div className="font-fredoka text-lg sm:text-xl font-bold text-emerald-600 mt-0.5">
                  S/ {calculos.gastoTotalMateriales.toFixed(2)}
                </div>
              </div>

              <div className="bg-pink-50/60 p-2.5 rounded-xl border border-pink-100">
                <div className="text-[10px] font-bold text-gray-500 uppercase">Horas Estimadas</div>
                <div className="font-fredoka text-lg sm:text-xl font-bold text-gray-800 mt-0.5">
                  {calculos.totalHoras.toFixed(1)} <span className="text-xs font-normal text-gray-500">h</span>
                </div>
              </div>

              <div className="bg-pink-50/60 p-2.5 rounded-xl border border-pink-100">
                <div className="text-[10px] font-bold text-gray-500 uppercase">Insumos Únicos</div>
                <div className="font-fredoka text-lg sm:text-xl font-bold text-[#C04267] mt-0.5">
                  {calculos.listaInsumos.length} <span className="text-xs font-normal text-gray-500">tipos</span>
                </div>
              </div>
            </div>

            {/* Barra de Filtro de Insumos y Botón Copiar */}
            <div className="flex items-center justify-between gap-2 py-2 shrink-0">
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                {["todas", "Hilos", "Fornituras", "Packaging", "Relleno", "Otros"].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFiltroCategoriaInsumos(cat)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold whitespace-nowrap cursor-pointer transition-colors ${
                      filtroCategoriaInsumos === cat
                        ? "bg-[#C04267] text-white"
                        : "bg-pink-50 text-gray-600 hover:bg-pink-100"
                    }`}
                  >
                    {cat === "todas" ? "Todos" : cat}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={copiarResumen}
                disabled={calculos.listaInsumos.length === 0}
                className="px-2.5 py-1 rounded-xl border border-pink-200 bg-pink-50 hover:bg-pink-100 text-[#C04267] text-[11px] font-bold flex items-center gap-1 transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
                title="Copiar lista de insumos al portapapeles"
              >
                {copiado ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                <span>{copiado ? "Copiado" : "Copiar Lista"}</span>
              </button>
            </div>

            {/* Lista Scrollable de Insumos Calculados */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
              {calculos.totalPiezas === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400 space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-pink-50 text-[#EE6B8D] flex items-center justify-center">
                    <Calculator size={24} />
                  </div>
                  <div className="font-bold text-gray-700 text-sm">Sin piezas seleccionadas</div>
                  <p className="text-xs max-w-xs text-gray-500">
                    Añade cantidades en los diseños de la columna izquierda para calcular automáticamente la lista de ovillos, materiales y presupuesto.
                  </p>
                </div>
              ) : insumosFiltrados.length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-400">
                  No hay insumos registrados para esta categoría.
                </div>
              ) : (
                insumosFiltrados.map((insumo, idx) => {
                  return (
                    <div
                      key={insumo.materialId || idx}
                      className="p-3 rounded-2xl border border-pink-100/90 bg-[#FDF4F7]/40 hover:bg-[#FDF4F7] transition-colors space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs text-gray-900 truncate">
                              {insumo.nombre}
                            </span>
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-white border border-pink-200 text-[#C04267]">
                              {insumo.categoria}
                            </span>
                            {insumo.presentacion && (
                              <span className="text-[10px] text-gray-500">
                                ({insumo.presentacion})
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] font-semibold text-gray-700 mt-0.5">
                            Consumo: <span className="text-[#C04267] font-bold">{insumo.textoConsumo}</span>
                            {insumo.modoUso === "rendimiento" && (
                              <span className="text-gray-500 font-normal ml-1">
                                (Equivale a comprar <strong>{insumo.unidadesAComprar}</strong> ovillo(s) enteros)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Costo del insumo */}
                        <div className="text-right shrink-0">
                          <div className="text-[9px] text-gray-400 uppercase font-semibold">Subtotal</div>
                          <div className="font-fredoka text-sm sm:text-base font-bold text-[#C04267]">
                            S/ {insumo.costoTotalEstimado.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      {/* Desglose de qué modelos lo utilizan */}
                      <div className="pt-1.5 border-t border-pink-100/60 flex items-center gap-1 flex-wrap text-[10px] text-gray-500">
                        <span className="font-bold text-gray-400 mr-0.5">Usado en:</span>
                        {insumo.disenosAportantes.map((d, dIdx) => (
                          <span
                            key={dIdx}
                            className="bg-white px-1.5 py-0.5 rounded-md border border-pink-100 text-gray-700 font-medium"
                          >
                            <strong>{d.nombre}</strong> ({d.piezas} pz ➔ {d.consumo})
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Pie del Panel de Resultados */}
            <div className="pt-2.5 mt-2 border-t border-pink-100 flex items-center justify-between shrink-0">
              <div className="text-[11px] text-gray-500">
                Presupuesto exacto de insumos:
              </div>
              <div className="font-fredoka text-base sm:text-lg font-bold text-[#C04267]">
                S/ {calculos.gastoTotalMateriales.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
