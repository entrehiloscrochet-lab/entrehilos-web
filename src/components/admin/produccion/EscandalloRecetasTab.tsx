"use client";

import React, { useState, useMemo, useRef } from "react";
import {
  Calculator,
  Plus,
  Search,
  Clock,
  Settings,
  Edit2,
  Trash2,
  Download,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Heart,
  TrendingUp,
  Info,
  Loader2,
} from "lucide-react";
import {
  ProductoProduccion,
  MaterialItem,
  ProduccionConfig,
} from "@/types/produccion";
import { exportarReporteCostos } from "./exportUtils";
import ImagePasteUploader from "./ImagePasteUploader";
import MaterialCombobox from "./MaterialCombobox";

export interface ProductoPayload {
  id?: string;
  nombre?: string;
  categoria?: string;
  tiempo_produccion?: number;
  precio_venta_real?: number;
  margen_deseado?: number;
  imagen?: string;
  notas?: string;
  items_receta?: Array<{
    id?: string;
    material_id?: string;
    cantidad?: number;
    modo_uso?: string;
    rendimiento_piezas?: number;
    costo_calculado?: number;
    monto_directo?: number;
  }>;
}

function getModoDefaultMaterial(mat?: MaterialItem): {
  esPrecio: boolean;
  modo: "rendimiento" | "unidades" | "gramos" | "precio";
} {
  if (!mat) return { esPrecio: false, modo: "unidades" };
  const esPrecio = mat.unidad_medida === "precio" || mat.unidad_medida === "soles";
  return {
    esPrecio,
    modo: esPrecio ? "precio" : "unidades",
  };
}

interface EscandalloRecetasTabProps {
  productos: ProductoProduccion[];
  materiales: MaterialItem[];
  categorias?: string[];
  config: ProduccionConfig;
  onGuardarProducto: (producto: ProductoPayload) => Promise<boolean>;
  onEliminarProducto: (id: string) => Promise<boolean>;
  onActualizarConfig: (cfg: Partial<ProduccionConfig>) => Promise<boolean>;
  onAdaptarTiempoReal?: (productoId: string) => Promise<boolean>;
}

export default function EscandalloRecetasTab({
  productos,
  materiales,
  categorias = [],
  config,
  onGuardarProducto,
  onEliminarProducto,
  onActualizarConfig,
  onAdaptarTiempoReal,
}: EscandalloRecetasTabProps) {
  const [busqueda, setBusqueda] = useState("");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [configModalAbierto, setConfigModalAbierto] = useState(false);
  const [editando, setEditando] = useState<ProductoProduccion | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Lista combinada de categorias disponibles
  const todasCategorias = useMemo(() => {
    const set = new Set<string>([
      "Amigurumis",
      "Ramos",
      "Llaveros",
      "Cajas",
      "Flores Eternas",
      "Personalizado",
      "General",
      ...categorias,
      ...productos.map((p) => p.categoria).filter(Boolean),
    ]);
    return Array.from(set).sort();
  }, [categorias, productos]);

  // Configuración de tarifa
  const [tarifaHoraInput, setTarifaHoraInput] = useState(String(config.tarifa_hora));
  const [margenDefaultInput, setMargenDefaultInput] = useState(String(config.margen_deseado_default));
  const [guardandoConfig, setGuardandoConfig] = useState(false);

  // Formulario de Producto / Diseño
  const [formNombre, setFormNombre] = useState("");
  const [formCategoria, setFormCategoria] = useState("Amigurumis");
  const [modoNuevaCategoria, setModoNuevaCategoria] = useState(false);
  const [nuevaCategoriaInput, setNuevaCategoriaInput] = useState("");
  const [formTiempoHoras, setFormTiempoHoras] = useState("1");
  const [formTiempoMinutos, setFormTiempoMinutos] = useState("0");
  const [formMargenDeseado, setFormMargenDeseado] = useState(String(config.margen_deseado_default));
  const [formPrecioReal, setFormPrecioReal] = useState("");
  const [formImagen, setFormImagen] = useState("");
  const [formNotas, setFormNotas] = useState("");
  interface FormRecetaRow {
    material_id: string;
    modo: "rendimiento" | "unidades" | "gramos" | "precio";
    rendimiento_piezas: number; // ej. 4 (1 ovillo rinde 4 piezas)
    cantidad: string; // Guardado como string para permitir escribir libremente decimales (ej: "0.5", "0.2", "0.9")
    monto_directo?: string; // Guardado como string para escribir decimales en soles (ej: "0.50", "0.20")
  }

  const [formItemsReceta, setFormItemsReceta] = useState<FormRecetaRow[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);

  // Referencias para auto-scroll al añadir un nuevo insumo
  const insumosListRef = useRef<HTMLDivElement>(null);
  const nuevoInsumoAnchorRef = useRef<HTMLDivElement>(null);

  const handleConfirmEliminar = async (prod: ProductoProduccion) => {
    if (!confirm(`¿Deseas eliminar el diseño de "${prod.nombre}"? Esta acción no se puede deshacer.`)) {
      return;
    }
    setEliminandoId(prod.id);
    try {
      const ok = await onEliminarProducto(prod.id);
      if (!ok) {
        alert(`No se pudo eliminar "${prod.nombre}". Por favor, revisa la conexión o intenta de nuevo.`);
      }
    } catch (err) {
      console.error(err);
      alert(`Error al eliminar "${prod.nombre}".`);
    } finally {
      setEliminandoId(null);
    }
  };

  const abrirModalNuevo = () => {
    setEditando(null);
    setFormNombre("");
    setFormCategoria("Amigurumis");
    setFormTiempoHoras("1");
    setFormTiempoMinutos("0");
    setFormMargenDeseado(String(config.margen_deseado_default));
    setFormPrecioReal("");
    setFormImagen("");
    setFormNotas("");
    setModoNuevaCategoria(false);
    setNuevaCategoriaInput("");
    if (materiales.length > 0) {
      const mat = materiales[0];
      const { modo } = getModoDefaultMaterial(mat);
      setFormItemsReceta([
        {
          material_id: mat.id,
          modo,
          rendimiento_piezas: 4,
          cantidad: "1",
          monto_directo: modo === "precio" ? "1" : undefined,
        },
      ]);
    } else {
      setFormItemsReceta([]);
    }
    setModalAbierto(true);
  };

  const abrirModalEditar = (prod: ProductoProduccion) => {
    setEditando(prod);
    setFormNombre(prod.nombre);
    setFormCategoria(prod.categoria);
    const t = prod.tiempo_produccion || 1;
    const h = Math.floor(t);
    const m = Math.round((t - h) * 60);
    setFormTiempoHoras(String(h));
    setFormTiempoMinutos(String(m));
    setFormMargenDeseado(String(prod.margen_deseado));
    setFormPrecioReal(String(prod.precio_venta_real));
    setFormImagen(prod.imagen || "");
    setFormNotas(prod.notas || "");
    setModoNuevaCategoria(false);
    setNuevaCategoriaInput("");
    setFormItemsReceta(
      (prod.items_receta || []).map((r) => {
        const mat = materiales.find((m) => m.id === r.material_id);
        const { esPrecio } = getModoDefaultMaterial(mat);
        const modo = esPrecio ? "precio" : "unidades";
        const montoDirecto = modo === "precio" ? String(r.monto_directo ?? r.costo_calculado ?? 1) : undefined;
        return {
          material_id: r.material_id,
          modo,
          rendimiento_piezas: 4,
          cantidad: String(r.cantidad || 1),
          monto_directo: montoDirecto,
        };
      })
    );
    setModalAbierto(true);
  };

  const agregarFilaMaterial = () => {
    if (materiales.length === 0) return;
    const yaUsados = new Set(formItemsReceta.map((it) => it.material_id));
    const mat = materiales.find((m) => !yaUsados.has(m.id)) || materiales[0];
    const { modo } = getModoDefaultMaterial(mat);
    setFormItemsReceta((prev) => [
      ...prev,
      {
        material_id: mat.id,
        modo,
        rendimiento_piezas: 4,
        cantidad: "1",
        monto_directo: modo === "precio" ? "1" : undefined,
      },
    ]);

    // Bajar en automático de inmediato al nuevo insumo agregado
    setTimeout(() => {
      if (insumosListRef.current) {
        insumosListRef.current.scrollTo({
          top: insumosListRef.current.scrollHeight,
          behavior: "smooth",
        });
      }
      nuevoInsumoAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 60);
  };

  const eliminarFilaMaterial = (index: number) => {
    setFormItemsReceta((prev) => prev.filter((_, i) => i !== index));
  };

  const actualizarFilaMaterial = (
    index: number,
    campo: keyof FormRecetaRow,
    valor: FormRecetaRow[keyof FormRecetaRow]
  ) => {
    setFormItemsReceta((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [campo]: valor } as FormRecetaRow;
      if (campo === "material_id") {
        const mat = materiales.find((m) => m.id === valor);
        if (mat) {
          const { esPrecio, modo: nuevoModo } = getModoDefaultMaterial(mat);
          copy[index].modo = nuevoModo;
          if (esPrecio) {
            if (!copy[index].monto_directo) copy[index].monto_directo = "1";
          } else {
            if (!copy[index].cantidad) copy[index].cantidad = "1";
          }
        }
      }
      return copy;
    });
  };

  // Cálculos en vivo basados en cantidad o monto directo
  const calculosModal = useMemo(() => {
    const tHoras = parseFloat(formTiempoHoras) || 0;
    const tMin = parseFloat(formTiempoMinutos) || 0;
    const tProd = Number((tHoras + tMin / 60).toFixed(4));
    const mDeseado = parseFloat(formMargenDeseado) || config.margen_deseado_default;
    const pReal = parseFloat(formPrecioReal) || 0;

    let totalMateriales = 0;
    const detallesInsumos: Array<(typeof formItemsReceta)[number] & { costoItem: number; cantidadGuardar: number }> = [];
    for (const item of formItemsReceta) {
      const mat = materiales.find((m) => m.id === item.material_id);
      let costoItem = 0;
      let cantidadGuardar = 0;

      if (!mat) {
        costoItem = 0;
      } else if (item.modo === "precio" || mat.unidad_medida === "precio" || mat.unidad_medida === "soles") {
        const monto = Math.max(0, parseFloat(String(item.monto_directo !== undefined ? item.monto_directo : item.cantidad)) || 0);
        costoItem = monto;
        cantidadGuardar = mat.precio_compra > 0 ? Number(((monto / mat.precio_compra) * mat.cantidad_total).toFixed(4)) : monto;
      } else {
        const cant = Math.max(0, parseFloat(String(item.cantidad)) || 0);
        const unitCost = mat.costo_unitario || (mat.precio_compra / Math.max(1, mat.cantidad_total));
        costoItem = Number((cant * unitCost).toFixed(4));
        cantidadGuardar = cant;
      }

      totalMateriales += costoItem;
      detallesInsumos.push({
        ...item,
        costoItem,
        cantidadGuardar,
      });
    }

    const costoMateriales = Number(totalMateriales.toFixed(2));
    const costoManoObra = Number((tProd * config.tarifa_hora).toFixed(2));
    const costoTotal = Number((costoMateriales + costoManoObra).toFixed(2));

    const divisor = 1 - mDeseado / 100;
    const precioSugerido = divisor > 0 ? Math.round(costoTotal / divisor) : costoTotal;

    const precioComparar = pReal > 0 ? pReal : precioSugerido;
    const gananciaNeta = Number((precioComparar - costoTotal).toFixed(2));
    const margenReal = precioComparar > 0 ? Number(((gananciaNeta / precioComparar) * 100).toFixed(1)) : 0;

    return {
      costoMateriales,
      costoManoObra,
      costoTotal,
      precioSugerido,
      gananciaNeta,
      margenReal,
      detallesInsumos,
    };
  }, [formTiempoHoras, formTiempoMinutos, formMargenDeseado, formPrecioReal, formItemsReceta, materiales, config.tarifa_hora]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNombre.trim()) return;

    const categoriaFinal = (modoNuevaCategoria ? nuevaCategoriaInput.trim() : formCategoria.trim()) || "General";

    const tHoras = parseFloat(formTiempoHoras) || 0;
    const tMin = parseFloat(formTiempoMinutos) || 0;
    const tProd = Number((tHoras + tMin / 60).toFixed(2)) || 0.1;

    setGuardando(true);
    const payload = {
      id: editando ? editando.id : undefined,
      nombre: formNombre.trim(),
      categoria: categoriaFinal,
      tiempo_produccion: tProd,
      precio_venta_real: parseFloat(formPrecioReal) || calculosModal.precioSugerido,
      margen_deseado: parseFloat(formMargenDeseado) || config.margen_deseado_default,
      imagen: formImagen.trim() || undefined,
      notas: formNotas.trim(),
      items_receta: calculosModal.detallesInsumos.map((r, idx) => ({
        id: `rec-${Date.now()}-${idx}`,
        material_id: r.material_id,
        cantidad: r.cantidadGuardar,
        modo_uso: r.modo,
        rendimiento_piezas: undefined,
        costo_calculado: Number(r.costoItem.toFixed(2)),
        monto_directo: r.modo === "precio" ? (parseFloat(String(r.monto_directo !== undefined ? r.monto_directo : r.cantidad)) || 0) : undefined,
      })),
    };

    const ok = await onGuardarProducto(payload);
    setGuardando(false);
    if (ok) {
      setModalAbierto(false);
    }
  };

  const handleGuardarConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardandoConfig(true);
    const ok = await onActualizarConfig({
      tarifa_hora: parseFloat(tarifaHoraInput) || config.tarifa_hora,
      margen_deseado_default: parseFloat(margenDefaultInput) || config.margen_deseado_default,
    });
    setGuardandoConfig(false);
    if (ok) setConfigModalAbierto(false);
  };

  const productosFiltrados = useMemo(() => {
    return productos.filter((p) => {
      const q = busqueda.toLowerCase();
      return (
        p.nombre.toLowerCase().includes(q) ||
        p.categoria.toLowerCase().includes(q) ||
        (p.notas || "").toLowerCase().includes(q)
      );
    });
  }, [productos, busqueda]);

  return (
    <div className="space-y-6">
      {/* Encabezado con lenguaje sencillo y amigable */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-3xl border border-[#FDE8EF] shadow-xs">
        <div>
          <h3 className="font-fredoka text-xl font-bold text-[#C04267] flex items-center gap-2">
            <Calculator className="text-[#EE6B8D]" size={22} />
            Mis Diseños y Costos
          </h3>
          <p className="font-quicksand text-xs sm:text-sm text-gray-500 mt-1">
            Calcula el costo real de tus diseños, mano de obra y fija precios con ganancia asegurada.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setConfigModalAbierto(true)}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-2xl bg-pink-50 border border-pink-200 text-[#C04267] font-quicksand text-xs font-bold hover:bg-pink-100 transition-all shadow-xs cursor-pointer"
            title="Ajustar tarifa por hora"
          >
            <Settings size={14} />
            <span>Mi Hora: S/ {config.tarifa_hora.toFixed(2)}</span>
          </button>

          <button
            type="button"
            onClick={() => exportarReporteCostos(productos, config.tarifa_hora)}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-2xl border border-[#FDE8EF] text-gray-600 hover:text-[#C04267] hover:bg-[#FDF4F7] font-quicksand text-xs font-semibold transition-all shadow-xs cursor-pointer"
            title="Exportar a Excel / CSV"
          >
            <Download size={14} />
            <span>Exportar CSV</span>
          </button>

          <button
            type="button"
            onClick={abrirModalNuevo}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#EE6B8D] text-white hover:bg-[#C04267] font-quicksand text-xs sm:text-sm font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            <Plus size={16} />
            <span>Nuevo Diseño</span>
          </button>
        </div>
      </div>

      {/* Buscador táctil */}
      <div className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar un modelo (ej. Ranita en columpio, Mini Maceta, Spiderman)..."
          className="w-full pl-11 pr-4 py-3 rounded-2xl border border-[#FDE8EF] bg-white text-xs sm:text-sm font-quicksand text-gray-700 focus:outline-none focus:border-[#EE6B8D] shadow-xs"
        />
      </div>

      {/* Grid de Productos: 1 col en celular, 2 en Tablet Vertical, 3 en Tablet Horizontal / Desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4.5">
        {productosFiltrados.length === 0 ? (
          <div className="col-span-full py-16 bg-white rounded-3xl border border-[#FDE8EF] text-center text-gray-400 font-quicksand">
            <Calculator size={40} className="mx-auto text-gray-300 mb-2" />
            No hay diseños creados todavía. Pulsa en <strong>&quot;Nuevo Diseño&quot;</strong> para crear el primero.
          </div>
        ) : (
          productosFiltrados.map((prod) => {
            const ganancia = Number((prod.precio_venta_real - prod.costo_total).toFixed(2));
            const margenReal =
              prod.precio_venta_real > 0
                ? Number(((ganancia / prod.precio_venta_real) * 100).toFixed(1))
                : 0;
            const esRentable = ganancia > 0;
            const isExpanded = expandedId === prod.id;

            return (
              <div
                key={prod.id}
                className="bg-white rounded-3xl border border-[#FDE8EF] overflow-hidden shadow-xs hover:border-[#EE6B8D]/60 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Foto del modelo artesanal o Banner decorativo */}
                  <div className="relative h-44 sm:h-48 w-full bg-pink-50/50 overflow-hidden flex items-center justify-center">
                    {prod.imagen ? (
                      <img
                        src={prod.imagen}
                        alt={prod.nombre}
                        className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-[#EE6B8D]/60 gap-1.5 p-4 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-xs border border-pink-100 text-[#EE6B8D]">
                          <Heart size={22} />
                        </div>
                        <span className="text-[11px] font-quicksand font-semibold text-gray-400">
                          Sin foto agregada
                        </span>
                      </div>
                    )}

                    {/* Badge de Categoría y Tiempo de Tejido */}
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                      <span className="px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-xs text-[#C04267] text-[11px] font-bold shadow-xs border border-pink-100">
                        {prod.categoria}
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-xs text-white text-[11px] font-bold flex items-center gap-1 shadow-xs" title="Tiempo deseado por pieza">
                        <Clock size={11} />
                        Deseado: {prod.tiempo_produccion}h
                      </span>
                    </div>
                  </div>

                  <div className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="font-fredoka text-base sm:text-lg font-bold text-gray-800 leading-snug">
                        {prod.nombre}
                      </h4>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => abrirModalEditar(prod)}
                          className="p-1.5 rounded-xl text-gray-400 hover:text-[#EE6B8D] hover:bg-pink-50 transition-colors"
                          title="Editar diseño"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          type="button"
                          disabled={eliminandoId === prod.id}
                          onClick={() => handleConfirmEliminar(prod)}
                          className="p-1.5 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                          title="Eliminar diseño"
                        >
                          {eliminandoId === prod.id ? (
                            <Loader2 size={15} className="animate-spin text-red-500" />
                          ) : (
                            <Trash2 size={15} />
                          )}
                        </button>
                      </div>
                    </div>

                    {prod.notas && (
                      <p className="font-quicksand text-xs text-gray-500 mb-3 line-clamp-2">
                        {prod.notas}
                      </p>
                    )}

                    {/* Comparativa Tiempo Deseado vs Tiempo Real de Bitácora */}
                    <div className="p-3 rounded-2xl bg-[#FDF4F7] border border-pink-100 mb-3 space-y-1.5 font-quicksand text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 font-semibold flex items-center gap-1">
                          <Clock size={12} className="text-[#EE6B8D]" />
                          Tiempo deseado:
                        </span>
                        <span className="font-bold text-gray-800">
                          {prod.tiempo_produccion}h / u ({Math.round(prod.tiempo_produccion * 60)} min)
                        </span>
                      </div>

                      {prod.tiempo_real_promedio !== undefined && prod.tiempo_real_promedio > 0 ? (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600 font-semibold">Tiempo real medido:</span>
                            <span className="font-bold text-[#C04267]">
                              {prod.tiempo_real_promedio}h / u ({Math.round(prod.tiempo_real_promedio * 60)} min)
                            </span>
                          </div>

                          <div className="pt-1.5 border-t border-pink-200/60 flex items-center justify-between">
                            <span className="text-[11px] text-gray-500">Desviación:</span>
                            {(() => {
                              const diff = prod.desviacion_tiempo || 0;
                              const diffMin = Math.round(diff * 60);
                              if (diff > 0.02) {
                                return (
                                  <span className="text-[11px] font-bold text-amber-700 bg-amber-100/90 px-2 py-0.5 rounded-full">
                                    +{diffMin} min más de lo deseado
                                  </span>
                                );
                              } else if (diff < -0.02) {
                                return (
                                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded-full">
                                    -{Math.abs(diffMin)} min más rápido
                                  </span>
                                );
                              } else {
                                return (
                                  <span className="text-[11px] font-bold text-blue-700 bg-blue-100/90 px-2 py-0.5 rounded-full">
                                    Exacto al tiempo deseado
                                  </span>
                                );
                              }
                            })()}
                          </div>

                          {/* Botón para adaptar receta a la realidad si hay desviación */}
                          {prod.desviacion_tiempo !== 0 && onAdaptarTiempoReal && (
                            <button
                              type="button"
                              onClick={() => onAdaptarTiempoReal(prod.id)}
                              className="w-full mt-1.5 py-1.5 px-2 rounded-xl bg-white border border-pink-200 text-[#C04267] hover:bg-pink-100 hover:border-pink-300 font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all shadow-2xs active:scale-98 cursor-pointer"
                              title="Ajusta el tiempo deseado del diseño al tiempo real medido en tu bitácora"
                            >
                              <Sparkles size={12} className="text-[#EE6B8D]" />
                              <span>Adaptar diseño a tiempo real ({prod.tiempo_real_promedio}h)</span>
                            </button>
                          )}
                        </>
                      ) : (
                        <div className="text-[11px] text-gray-400 italic pt-0.5">
                          Sin sesiones en bitácora aún para medir tiempo real.
                        </div>
                      )}
                    </div>

                    {/* Desglose de Costos Visual y Sencillo */}
                    <div className="grid grid-cols-2 gap-2 py-2 px-3 bg-gray-50 rounded-2xl text-center font-quicksand mb-3 border border-gray-100">
                      <div>
                        <div className="text-[10px] text-gray-500">Materiales gastados</div>
                        <div className="font-bold text-gray-800 text-xs sm:text-sm">
                          S/ {prod.costo_materiales.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-500">
                          {prod.costo_real_promedio ? "Mano de obra real" : `Tu tiempo (${prod.tiempo_produccion}h)`}
                        </div>
                        <div className="font-bold text-gray-800 text-xs sm:text-sm">
                          S/ {prod.tiempo_real_promedio ? (prod.tiempo_real_promedio * config.tarifa_hora).toFixed(2) : prod.costo_mano_obra.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* Tarjeta de Precio Real y Ganancia Limpia */}
                    <div className="space-y-2 border-t border-gray-100 pt-3 font-quicksand text-xs">
                      <div className="flex items-center justify-between text-gray-600">
                        <span>Costo total para tejerlo:</span>
                        <span className="font-bold text-gray-800">S/ {prod.costo_total.toFixed(2)}</span>
                      </div>

                      <div className="flex items-center justify-between text-[#EE6B8D]">
                        <span className="flex items-center gap-1 font-semibold">
                          <Sparkles size={12} />
                          Precio sugerido ({prod.margen_deseado}%):
                        </span>
                        <span className="font-bold text-sm">S/ {prod.precio_sugerido.toFixed(2)}</span>
                      </div>

                      <div className="flex items-center justify-between bg-pink-50 p-2.5 rounded-2xl border border-pink-100">
                        <span className="font-bold text-[#C04267]">Precio al público:</span>
                        <span className="font-fredoka text-lg font-bold text-[#C04267]">
                          S/ {prod.precio_venta_real.toFixed(2)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between px-1">
                        <span className="text-gray-500">Tu ganancia neta:</span>
                        <span
                          className={`font-bold text-xs ${
                            esRentable ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          + S/ {ganancia.toFixed(2)} ({margenReal}%)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Acordeón para ver materiales de la receta */}
                <div className="px-4 pb-4 border-t border-gray-50 pt-2">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : prod.id)}
                    className="w-full flex items-center justify-between text-xs font-quicksand font-semibold text-gray-500 hover:text-[#C04267] py-1"
                  >
                    <span className="flex items-center gap-1.5">
                      <Layers size={13} />
                      {prod.items_receta?.length || 0} insumos en esta receta
                    </span>
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {isExpanded && (
                    <div className="mt-2 space-y-1 text-xs font-quicksand bg-gray-50 p-2.5 rounded-2xl border border-gray-100 animate-in fade-in">
                      {(!prod.items_receta || prod.items_receta.length === 0) ? (
                        <div className="text-gray-400 italic">No hay insumos agregados.</div>
                      ) : (
                        prod.items_receta.map((rec) => {
                          const mat = rec.material || materiales.find((m) => m.id === rec.material_id);
                          const unitCost = mat?.costo_unitario || 0;
                          const subtotal = rec.cantidad * unitCost;
                          return (
                            <div key={rec.id} className="flex items-center justify-between text-gray-700 py-0.5">
                              <span className="truncate pr-2">
                                • {mat?.nombre || "Insumo"}: <span className="text-gray-500">{rec.cantidad} {mat?.unidad_medida || "u"}</span>
                              </span>
                              <span className="font-semibold shrink-0 text-gray-800">
                                S/ {subtotal.toFixed(2)}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Panorámico Crear / Editar Receta (Más ancho que largo, sin scroll en PC/laptop) */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/45 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white w-full max-w-5xl xl:max-w-6xl rounded-3xl p-5 sm:p-7 border border-[#FDE8EF] shadow-2xl animate-in fade-in my-3 max-h-[95vh] overflow-y-auto overflow-x-hidden">
            <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-gray-100">
              <div>
                <h4 className="font-fredoka text-lg sm:text-2xl font-bold text-[#C04267]">
                  {editando ? "Editar Diseño y Costos" : "Nuevo Diseño y Ficha de Costo"}
                </h4>
                <p className="font-quicksand text-xs text-gray-400 mt-0.5">
                  Define el modelo, sus materiales o rendimiento de ovillos y fija tu precio con ganancia real.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 text-lg leading-none transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 font-quicksand">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
                {/* COLUMNA IZQUIERDA (7/12): Datos del Producto e Insumos */}
                <div className="lg:col-span-7 space-y-4">
                  {/* Nombre y Categoría */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Nombre del Producto *
                      </label>
                      <input
                        type="text"
                        required
                        value={formNombre}
                        onChange={(e) => setFormNombre(e.target.value)}
                        placeholder="ej. Osito con chalina, Ranita"
                        className="w-full px-4 py-2.5 rounded-2xl border border-gray-200 text-xs sm:text-sm focus:border-[#EE6B8D] focus:outline-none bg-white"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-gray-700">
                          Categoría del Diseño
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setModoNuevaCategoria(!modoNuevaCategoria);
                            if (!modoNuevaCategoria) setNuevaCategoriaInput("");
                          }}
                          className="text-[11px] font-bold text-[#C04267] hover:underline cursor-pointer"
                        >
                          {modoNuevaCategoria ? "Elegir existente" : "+ Crear nueva"}
                        </button>
                      </div>

                      {modoNuevaCategoria ? (
                        <div className="space-y-1">
                          <input
                            type="text"
                            required
                            value={nuevaCategoriaInput}
                            onChange={(e) => setNuevaCategoriaInput(e.target.value)}
                            placeholder="Escribe la nueva categoría (ej. Bolsos, Tapices)..."
                            className="w-full px-4 py-2.5 rounded-2xl border-2 border-[#EE6B8D] text-xs sm:text-sm focus:border-[#C04267] focus:outline-none bg-white font-semibold text-[#C04267]"
                            autoFocus
                          />
                          <p className="text-[10px] text-gray-500">
                            Se guardará automáticamente en la base de datos.
                          </p>
                        </div>
                      ) : (
                        <select
                          value={formCategoria}
                          onChange={(e) => {
                            if (e.target.value === "__nueva__") {
                              setModoNuevaCategoria(true);
                              setNuevaCategoriaInput("");
                            } else {
                              setFormCategoria(e.target.value);
                            }
                          }}
                          className="w-full px-4 py-2.5 rounded-2xl border border-gray-200 text-xs sm:text-sm focus:border-[#EE6B8D] focus:outline-none bg-white font-medium text-gray-800"
                        >
                          {todasCategorias.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                          <option value="__nueva__">+ Crear nueva categoría...</option>
                        </select>
                      )}
                    </div>
                  </div>

                  {/* Tiempos de Tejido (Horas y Minutos) y Margen Comercial */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#FDF4F7] p-3.5 rounded-2xl border border-pink-100">
                    <div>
                      <label className="block text-xs font-bold text-[#C04267] mb-1 flex items-center justify-between">
                        <span>Tiempo de Tejido Deseado *</span>
                        <span className="text-[10px] text-gray-400 font-normal">Horas y minutos</span>
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            required
                            value={formTiempoHoras}
                            onChange={(e) => setFormTiempoHoras(e.target.value)}
                            placeholder="0"
                            className="w-full px-3 py-2 pr-8 rounded-xl border border-pink-200 bg-white text-xs sm:text-sm font-semibold focus:border-[#EE6B8D] focus:outline-none"
                          />
                          <span className="absolute right-2.5 top-2.5 text-[11px] font-bold text-gray-400 pointer-events-none">
                            hrs
                          </span>
                        </div>

                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            max="59"
                            required
                            value={formTiempoMinutos}
                            onChange={(e) => setFormTiempoMinutos(e.target.value)}
                            placeholder="0"
                            className="w-full px-3 py-2 pr-8 rounded-xl border border-pink-200 bg-white text-xs sm:text-sm font-semibold focus:border-[#EE6B8D] focus:outline-none"
                          />
                          <span className="absolute right-2.5 top-2.5 text-[11px] font-bold text-gray-400 pointer-events-none">
                            min
                          </span>
                        </div>
                      </div>
                      <div className="text-[11px] text-gray-500 mt-1 flex items-center justify-between">
                        <span>
                          Tiempo: <strong className="text-gray-700">{formTiempoHoras || "0"}h {formTiempoMinutos || "0"}m</strong>
                        </span>
                        <span>
                          Mano de obra: <strong className="text-gray-700">S/ {calculosModal.costoManoObra.toFixed(2)}</strong>
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#C04267] mb-1">
                        Margen de Ganancia Deseado (%)
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="1"
                        max="90"
                        value={formMargenDeseado}
                        onFocus={(e) => {
                          if (formMargenDeseado === String(config.margen_deseado_default || 40)) {
                            setFormMargenDeseado("");
                          } else {
                            e.target.select();
                          }
                        }}
                        onBlur={() => {
                          if (!formMargenDeseado.trim()) {
                            setFormMargenDeseado(String(config.margen_deseado_default || 40));
                          }
                        }}
                        onChange={(e) => setFormMargenDeseado(e.target.value)}
                        placeholder={String(config.margen_deseado_default || 40)}
                        className="w-full px-3.5 py-2 rounded-xl border border-pink-200 bg-white text-xs sm:text-sm font-semibold focus:border-[#EE6B8D] focus:outline-none"
                      />
                      <div className="text-[11px] text-gray-500 mt-1">
                        Ganancia comercial sobre el precio de venta (por defecto {config.margen_deseado_default}%)
                      </div>
                    </div>
                  </div>

                  {/* Aviso informativo de catálogo */}
                  <div className="text-[11px] text-gray-500 bg-pink-50/70 p-2.5 rounded-2xl border border-pink-100 flex items-center gap-2">
                    <Info size={14} className="text-[#EE6B8D] shrink-0" />
                    <span>
                      Este diseño se guardará en tu taller interno. Solo se subirá al catálogo de la tienda para venta al público cuando esté terminado y uses la opción de publicar.
                    </span>
                  </div>

                  {/* Insumos que entran en la receta */}
                  <div className="border border-pink-100 p-3.5 sm:p-4 rounded-2xl space-y-3 bg-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                          <Layers size={14} className="text-[#EE6B8D]" />
                          ¿Qué insumos lleva esta pieza?
                        </label>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          Elige si consumes 1 parte de un ovillo (ej. 1 ovillo rinde 4 piezas) o unidades directas.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={agregarFilaMaterial}
                        className="px-3 py-1.5 rounded-xl bg-pink-50 text-[#C04267] hover:bg-pink-100 text-xs font-bold flex items-center gap-1 transition-all shrink-0 cursor-pointer"
                      >
                        <Plus size={13} />
                        <span>Añadir Insumo</span>
                      </button>
                    </div>

                    {formItemsReceta.length === 0 ? (
                      <div className="text-xs text-gray-400 py-4 text-center border border-dashed border-pink-200 rounded-xl">
                        Aún no has agregado materiales a esta receta. Pulsa &quot;+ Añadir Insumo&quot;.
                      </div>
                    ) : (
                      <div
                        ref={insumosListRef}
                        className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1 scroll-smooth"
                      >
                        {formItemsReceta.map((row, idx) => {
                          const mat = materiales.find((m) => m.id === row.material_id);
                          const { esPrecio } = getModoDefaultMaterial(mat);
                          const subtotal = calculosModal.detallesInsumos[idx]?.costoItem || 0;

                          return (
                            <div key={idx} className="bg-[#FDF4F7] p-2.5 rounded-2xl border border-pink-100/80 space-y-2 text-xs">
                              <div className="flex items-center gap-2 w-full min-w-0">
                                <div className="flex-1 min-w-0">
                                  <MaterialCombobox
                                    materiales={materiales}
                                    selectedId={row.material_id}
                                    onChange={(newId) => actualizarFilaMaterial(idx, "material_id", newId)}
                                  />
                                </div>

                                <button
                                  type="button"
                                  onClick={() => eliminarFilaMaterial(idx)}
                                  className="w-8 h-8 rounded-xl bg-white border border-rose-200 text-rose-500 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 flex items-center justify-center shrink-0 cursor-pointer transition-colors shadow-2xs"
                                  title="Quitar insumo"
                                  aria-label="Quitar insumo"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>

                              {/* Control directo de consumo según la unidad de medida, permitiendo escribir cualquier decimal (0.5, 0.2, 0.9, etc.) */}
                              <div className="flex items-center justify-between gap-2 pt-1 border-t border-pink-200/50">
                                {esPrecio ? (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-gray-600 text-[11px] font-medium">Usar en dinero:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs font-bold text-[#C04267]">S/</span>
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        value={row.monto_directo !== undefined ? row.monto_directo : row.cantidad}
                                        onChange={(e) => {
                                          const val = e.target.value.replace(",", ".");
                                          if (val === "" || /^\d*\.?\d*$/.test(val)) {
                                            actualizarFilaMaterial(idx, "monto_directo", val);
                                          }
                                        }}
                                        placeholder="0.00"
                                        className="w-24 px-2.5 py-1 rounded-lg border border-pink-200 bg-white text-xs text-center font-bold text-[#C04267] focus:outline-none focus:border-[#EE6B8D]"
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-gray-600 text-[11px] font-medium">Cantidad a usar:</span>
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={row.cantidad}
                                      onChange={(e) => {
                                        const val = e.target.value.replace(",", ".");
                                        if (val === "" || /^\d*\.?\d*$/.test(val)) {
                                          actualizarFilaMaterial(idx, "cantidad", val);
                                        }
                                      }}
                                      placeholder="0"
                                      className="w-24 px-2.5 py-1 rounded-lg border border-pink-200 bg-white text-xs text-center font-bold text-[#C04267] focus:outline-none focus:border-[#EE6B8D]"
                                    />
                                    <span className="text-[11px] text-gray-600 font-semibold">
                                      {mat?.unidad_medida || "unidades"}
                                    </span>
                                  </div>
                                )}

                                <div className="text-right ml-auto">
                                  <span className="text-[10px] text-gray-400 mr-1">Costo:</span>
                                  <span className="font-bold text-[#C04267] text-sm font-fredoka">
                                    S/ {subtotal.toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        <div ref={nuevoInsumoAnchorRef} className="h-0" />
                      </div>
                    )}

                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                      <span className="text-gray-500 font-medium">Total en Materiales por pieza:</span>
                      <span className="font-bold text-[#C04267] text-sm sm:text-base font-fredoka">
                        S/ {calculosModal.costoMateriales.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* COLUMNA DERECHA (5/12): Foto, Resumen Financiero y Acciones */}
                <div className="lg:col-span-5 space-y-4">
                  {/* Foto con Ctrl+V */}
                  <div className="bg-white p-3.5 rounded-2xl border border-pink-100 shadow-2xs">
                    <ImagePasteUploader
                      imagenUrl={formImagen}
                      onImageChange={setFormImagen}
                      label="Foto (Ctrl+V para pegar o toca para subir)"
                    />
                  </div>

                  {/* Resumen Financiero Claro y Amigable Siempre Visible */}
                  <div className="bg-[#FDF4F7] p-4 rounded-2xl border border-pink-200/90 space-y-2.5 text-xs shadow-2xs">
                    <div className="flex items-center justify-between text-gray-700">
                      <span>Gasto en materiales:</span>
                      <span className="font-bold">S/ {calculosModal.costoMateriales.toFixed(2)}</span>
                    </div>

                    <div className="flex items-center justify-between text-gray-700">
                      <span>Mano de obra ({formTiempoHoras}h {formTiempoMinutos}m):</span>
                      <span className="font-bold">S/ {calculosModal.costoManoObra.toFixed(2)}</span>
                    </div>

                    <div className="flex items-center justify-between text-gray-800 pt-1 border-t border-pink-200/60 font-semibold">
                      <span>Costo Total para tejerlo:</span>
                      <span className="font-bold text-sm">S/ {calculosModal.costoTotal.toFixed(2)}</span>
                    </div>

                    <div className="flex items-center justify-between text-[#EE6B8D] font-bold">
                      <span className="flex items-center gap-1">
                        <Sparkles size={12} />
                        Precio Sugerido ({formMargenDeseado}%):
                      </span>
                      <span className="text-base font-fredoka">
                        S/ {calculosModal.precioSugerido.toFixed(2)}
                      </span>
                    </div>

                    {/* Precio de Venta Real Destacado */}
                    <div className="pt-2 border-t border-pink-200/80">
                      <div className="flex items-center justify-between gap-2">
                        <label className="font-bold text-gray-800 text-xs sm:text-sm">
                          Tu Precio de Venta:
                        </label>
                        <div className="flex items-center gap-1.5">
                          <span className="text-base font-bold text-[#C04267]">S/</span>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={formPrecioReal}
                            onChange={(e) => setFormPrecioReal(e.target.value)}
                            placeholder={String(calculosModal.precioSugerido)}
                            className="w-24 px-3 py-1.5 rounded-xl border border-pink-300 bg-white font-fredoka font-bold text-lg text-[#C04267] focus:border-[#EE6B8D] focus:outline-none text-center shadow-2xs"
                          />
                        </div>
                      </div>

                      <div className="text-right text-[11px] text-gray-600 mt-1.5">
                        Ganas limpio por pieza:{" "}
                        <strong className="text-emerald-700 text-xs font-bold">
                          + S/ {calculosModal.gananciaNeta.toFixed(2)} ({calculosModal.margenReal}%)
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Notas */}
                  <div>
                    <input
                      type="text"
                      value={formNotas}
                      onChange={(e) => setFormNotas(e.target.value)}
                      placeholder="Notas (ej. Usar aguja 2.5mm, caja con visor)..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs focus:border-[#EE6B8D] focus:outline-none bg-white"
                    />
                  </div>

                  {/* Botones de Acción */}
                  <div className="flex items-center gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => setModalAbierto(false)}
                      className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={guardando}
                      className="flex-2 py-3 rounded-2xl bg-[#EE6B8D] hover:bg-[#C04267] text-white text-xs sm:text-sm font-bold transition-all disabled:opacity-50 shadow-md active:scale-98 cursor-pointer"
                    >
                      {guardando ? "Guardando..." : editando ? "Actualizar Receta" : "Guardar Receta"}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tarifa por Hora Global */}
      {configModalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 border border-[#FDE8EF] shadow-2xl animate-in fade-in">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <h4 className="font-fredoka text-lg font-bold text-[#C04267] flex items-center gap-2">
                <Settings size={18} className="text-[#EE6B8D]" />
                ¿Cuánto vale tu hora de tejido?
              </h4>
              <button
                type="button"
                onClick={() => setConfigModalAbierto(false)}
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGuardarConfig} className="space-y-4 mt-4 font-quicksand text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Tu tarifa por hora de tejido (S/) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  value={tarifaHoraInput}
                  onChange={(e) => setTarifaHoraInput(e.target.value)}
                  placeholder="ej. 8.00"
                  className="w-full px-4 py-2.5 rounded-2xl border border-gray-200 text-sm focus:border-[#EE6B8D] focus:outline-none"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Al cambiar esto, se actualizará el costo de mano de obra de todas tus recetas automáticamente.
                </p>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Margen deseado por defecto (%) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  max="99"
                  required
                  value={margenDefaultInput}
                  onChange={(e) => setMargenDefaultInput(e.target.value)}
                  placeholder="ej. 40"
                  className="w-full px-4 py-2.5 rounded-2xl border border-gray-200 text-sm focus:border-[#EE6B8D] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setConfigModalAbierto(false)}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoConfig}
                  className="px-5 py-2 rounded-xl bg-[#EE6B8D] hover:bg-[#C04267] text-white text-xs font-bold transition-all disabled:opacity-50"
                >
                  {guardandoConfig ? "Guardando..." : "Guardar Tarifa"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
