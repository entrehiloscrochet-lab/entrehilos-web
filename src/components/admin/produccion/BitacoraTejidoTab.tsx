"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  Smartphone,
  Plus,
  Clock,
  Sparkles,
  CheckCircle2,
  Calendar,
  Zap,
  TrendingUp,
  Trash2,
  Layers,
  History,
  Heart,
  Package,
  ShoppingBag,
  Scissors,
  Check,
  AlertTriangle,
  ChevronRight,
  Search,
  Minus,
  RotateCcw,
} from "lucide-react";
import {
  BitacoraRegistro,
  ProductoProduccion,
  CampanaProduccion,
  ProduccionConfig,
  MaterialItem,
} from "@/types/produccion";

interface BitacoraTejidoTabProps {
  bitacora: BitacoraRegistro[];
  productos: ProductoProduccion[];
  materiales?: MaterialItem[];
  campanas: CampanaProduccion[];
  config?: ProduccionConfig;
  onGuardarBitacora: (registro: Partial<BitacoraRegistro>) => Promise<boolean>;
  onSumarPiezaRapida: (productoId: string, campanaId?: string | null, cantidad?: number) => Promise<boolean>;
  onEliminarBitacora: (id: string) => Promise<boolean>;
}

interface InsumoCalculadoCampana {
  materialId: string;
  nombre: string;
  categoria: string;
  presentacion: string;
  precioCompra: number;
  unidadMedida: string;
  modoUso: string;
  rendimientoPiezas: number;
  exactoRequerido: number;
  exactoConsumido: number;
  exactoFaltante: number;
  unidadesAComprar: number;
  costoEstimadoCompra: number;
  textoDetalle: string;
}

export default function BitacoraTejidoTab({
  bitacora,
  productos,
  materiales = [],
  campanas,
  config,
  onGuardarBitacora,
  onSumarPiezaRapida,
  onEliminarBitacora,
}: BitacoraTejidoTabProps) {
  // Campaña por defecto: la activa o la primera
  const campanaInicialId = useMemo(() => {
    const activa = campanas.find((c) => c.activa);
    return activa ? activa.id : campanas[0]?.id || "";
  }, [campanas]);

  const [campanaSeleccionadaId, setCampanaSeleccionadaId] = useState<string>(campanaInicialId);
  const [productoSeleccionadoId, setProductoSeleccionadoId] = useState<string>(
    productos[0]?.id || ""
  );

  const [busquedaModelo, setBusquedaModelo] = useState("");
  const [filtroCategoriaModelo, setFiltroCategoriaModelo] = useState("todas");

  // Garantizar que si se cargan productos, siempre haya uno seleccionado
  const [prevProductos, setPrevProductos] = useState(productos);
  if (productos !== prevProductos) {
    setPrevProductos(productos);
    if ((!productoSeleccionadoId || !productos.some((p) => p.id === productoSeleccionadoId)) && productos.length > 0) {
      setProductoSeleccionadoId(productos[0].id);
    }
  }

  const [piezasInput, setPiezasInput] = useState<number>(1);
  const [horasDedicadasInput, setHorasDedicadasInput] = useState<string>("1");
  const [minutosDedicadosInput, setMinutosDedicadosInput] = useState<string>("0");
  const [notasInput, setNotasInput] = useState("");
  const [fechaInput, setFechaInput] = useState(new Date().toISOString().split("T")[0]);
  const [guardando, setGuardando] = useState(false);
  const [exitoAnim, setExitoAnim] = useState(false);
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todos");

  const tarifaHora = config?.tarifa_hora || 8.0;

  const productoActivo = useMemo(() => {
    return productos.find((p) => p.id === productoSeleccionadoId) || productos[0] || null;
  }, [productos, productoSeleccionadoId]);

  // Sincronizar tiempo deseado al cambiar de modelo activo
  const [prevProductoActivoId, setPrevProductoActivoId] = useState(productoActivo?.id);
  if (productoActivo && productoActivo.id !== prevProductoActivoId) {
    setPrevProductoActivoId(productoActivo.id);
    const t = productoActivo.tiempo_produccion || 1;
    const h = Math.floor(t);
    const m = Math.round((t - h) * 60);
    setHorasDedicadasInput(String(h));
    setMinutosDedicadosInput(String(m));
  }

  const campanaActiva = useMemo(() => {
    if (!campanaSeleccionadaId) return null;
    return campanas.find((c) => c.id === campanaSeleccionadaId) || null;
  }, [campanas, campanaSeleccionadaId]);

  // Obtener conteo acumulado de piezas terminadas para un producto
  const getConteoProducto = useCallback((prodId: string) => {
    // Si hay campaña seleccionada, buscar en campanaActiva.items
    const campItem = campanaActiva?.items?.find((ci) => ci.producto_id === prodId);
    const piezasEnCampana = campItem?.cantidad_terminada ?? null;
    const metaCampana = campItem?.cantidad_meta ?? null;

    // Conteo total histórico registrado en la bitácora para este producto
    const piezasEnBitacora = bitacora
      .filter((b) => b.producto_id === prodId && (!campanaSeleccionadaId || b.campana_id === campanaSeleccionadaId))
      .reduce((sum, b) => sum + (Number(b.piezas_terminadas) || 0), 0);

    const terminadas = piezasEnCampana !== null ? Math.max(piezasEnCampana, piezasEnBitacora) : piezasEnBitacora;

    return {
      terminadas,
      meta: metaCampana,
      porcentaje: metaCampana && metaCampana > 0 ? Math.min(100, Math.round((terminadas / metaCampana) * 100)) : null,
      faltantes: metaCampana && metaCampana > 0 ? Math.max(0, metaCampana - terminadas) : null,
    };
  }, [campanaActiva, bitacora, campanaSeleccionadaId]);

  const conteoActivo = useMemo(() => {
    if (!productoActivo) return { terminadas: 0, meta: null, porcentaje: null, faltantes: null };
    return getConteoProducto(productoActivo.id);
  }, [productoActivo, getConteoProducto]);

  const categoriasModelos = useMemo(() => {
    const cats = new Set<string>();
    productos.forEach((p) => {
      if (p.categoria) cats.add(p.categoria);
    });
    return ["todas", ...Array.from(cats)];
  }, [productos]);

  const productosFiltrados = useMemo(() => {
    return productos.filter((p) => {
      const matchBusqueda =
        p.nombre.toLowerCase().includes(busquedaModelo.toLowerCase()) ||
        (p.categoria || "").toLowerCase().includes(busquedaModelo.toLowerCase());
      const matchCat =
        filtroCategoriaModelo === "todas" ||
        (p.categoria || "").toLowerCase() === filtroCategoriaModelo.toLowerCase();
      return matchBusqueda && matchCat;
    });
  }, [productos, busquedaModelo, filtroCategoriaModelo]);

  // Calculo en vivo entre lo deseado y lo que realmente fue en esta sesion
  const calculosSesion = useMemo(() => {
    const piezas = Math.max(1, piezasInput);
    const hInput = parseFloat(horasDedicadasInput) || 0;
    const mInput = parseFloat(minutosDedicadosInput) || 0;
    const horas = Math.max(0.05, Number((hInput + mInput / 60).toFixed(4)));

    const tiempoDeseado = productoActivo?.tiempo_produccion || 1;
    const tiempoRealPorPieza = Number((horas / piezas).toFixed(2));
    const velocidad = Number((piezas / Math.max(0.1, horas)).toFixed(2));

    const tiempoDeseadoMin = Math.round(tiempoDeseado * 60);
    const tiempoRealMin = Math.round(tiempoRealPorPieza * 60);

    const horasDeseadasH = Math.floor(tiempoDeseado);
    const horasDeseadasM = Math.round((tiempoDeseado - horasDeseadasH) * 60);

    const horasRealesH = Math.floor(tiempoRealPorPieza);
    const horasRealesM = Math.round((tiempoRealPorPieza - horasRealesH) * 60);

    const diferenciaHoras = Number((tiempoRealPorPieza - tiempoDeseado).toFixed(2));
    const diferenciaMin = Math.round(diferenciaHoras * 60);

    const costoManoObraDeseado = Number((tiempoDeseado * tarifaHora).toFixed(2));
    const costoManoObraReal = Number((tiempoRealPorPieza * tarifaHora).toFixed(2));
    const impactoCostoTotal = Number(((costoManoObraReal - costoManoObraDeseado) * piezas).toFixed(2));

    return {
      piezas,
      horas,
      tiempoDeseado,
      tiempoRealPorPieza,
      velocidad,
      tiempoDeseadoMin,
      tiempoRealMin,
      horasDeseadasH,
      horasDeseadasM,
      horasRealesH,
      horasRealesM,
      diferenciaHoras,
      diferenciaMin,
      costoManoObraDeseado,
      costoManoObraReal,
      impactoCostoTotal,
    };
  }, [piezasInput, horasDedicadasInput, minutosDedicadosInput, productoActivo, tarifaHora]);

  // Explosion y calculo de insumos requeridos para la campana seleccionada
  const calculosCampanaInsumos = useMemo(() => {
    if (!campanaActiva || !campanaActiva.items || campanaActiva.items.length === 0) {
      return {
        totalPiezasMeta: 0,
        totalPiezasTerminadas: 0,
        totalPiezasFaltantes: 0,
        totalHorasEstimadas: 0,
        totalHorasDedicadas: 0,
        totalInsumosDistintos: 0,
        totalOvillosAComprar: 0,
        presupuestoTotalInsumos: 0,
        listaInsumos: [] as InsumoCalculadoCampana[],
      };
    }

    let totalPiezasMeta = 0;
    let totalPiezasTerminadas = 0;
    let totalHorasEstimadas = 0;

    // Mapa de agregacion por material_id
    const insumosMap = new Map<string, {
      materialId: string;
      nombre: string;
      categoria: string;
      presentacion: string;
      precioCompra: number;
      unidadMedida: string;
      modoUso: string;
      rendimientoPiezas: number;
      exactoRequerido: number;
      exactoConsumido: number;
      exactoFaltante: number;
      unidadesPresentacion: number;
    }>();

    for (const item of campanaActiva.items) {
      const prod = productos.find((p) => p.id === item.producto_id) || item.producto;
      const meta = item.cantidad_meta || 0;
      const terminadas = item.cantidad_terminada || 0;
      const faltantes = Math.max(0, meta - terminadas);

      totalPiezasMeta += meta;
      totalPiezasTerminadas += terminadas;

      if (prod) {
        totalHorasEstimadas += (prod.tiempo_produccion || 1) * meta;

        // Recorrer los materiales de la receta del producto
        if (prod.items_receta && prod.items_receta.length > 0) {
          for (const rec of prod.items_receta) {
            const mat = materiales.find((m) => m.id === rec.material_id) || rec.material;
            const matId = rec.material_id || mat?.id || "desconocido";
            const modo = rec.modo_uso || (rec.rendimiento_piezas ? "rendimiento" : "unidades");
            const rendimiento = rec.rendimiento_piezas && rec.rendimiento_piezas > 0 ? rec.rendimiento_piezas : 1;
            const cantidadPorPieza = rec.cantidad || 1;
            const unidad = mat?.unidad_medida || "unidades";
            const presentacion = mat?.presentacion || (modo === "rendimiento" ? `Ovillo (rinde ${rendimiento} pz)` : "Unidad");
            const precioCompra = mat?.precio_compra || 0;
            const cantTotalPresentacion = mat?.cantidad_total || (modo === "rendimiento" ? 1 : 1);

            let reqMeta = 0;
            let reqTerminadas = 0;
            let reqFaltantes = 0;

            if (modo === "rendimiento") {
              // 1 ovillo rinde para X piezas => por cada pieza se usa 1 / rendimiento ovillos
              reqMeta = meta / rendimiento;
              reqTerminadas = terminadas / rendimiento;
              reqFaltantes = faltantes / rendimiento;
            } else if (unidad === "gramos") {
              // Gramos totales requeridos
              reqMeta = meta * cantidadPorPieza;
              reqTerminadas = terminadas * cantidadPorPieza;
              reqFaltantes = faltantes * cantidadPorPieza;
            } else {
              // Unidades o pares fijos
              reqMeta = meta * cantidadPorPieza;
              reqTerminadas = terminadas * cantidadPorPieza;
              reqFaltantes = faltantes * cantidadPorPieza;
            }

            if (!insumosMap.has(matId)) {
              insumosMap.set(matId, {
                materialId: matId,
                nombre: mat?.nombre || rec.material?.nombre || "Insumo artesanal",
                categoria: mat?.categoria || "Hilos",
                presentacion,
                precioCompra,
                unidadMedida: unidad,
                modoUso: modo,
                rendimientoPiezas: rendimiento,
                exactoRequerido: reqMeta,
                exactoConsumido: reqTerminadas,
                exactoFaltante: reqFaltantes,
                unidadesPresentacion: cantTotalPresentacion,
              });
            } else {
              const prev = insumosMap.get(matId)!;
              prev.exactoRequerido += reqMeta;
              prev.exactoConsumido += reqTerminadas;
              prev.exactoFaltante += reqFaltantes;
            }
          }
        }
      }
    }

    // Calcular las unidades enteras a comprar en el mercado/tienda
    let totalOvillosAComprar = 0;
    let presupuestoTotalInsumos = 0;

    const listaInsumos: InsumoCalculadoCampana[] = [];

    insumosMap.forEach((val) => {
      let unidadesAComprar = 0;
      let textoDetalle = "";

      if (val.modoUso === "rendimiento") {
        // Fraccion de ovillos necesaria -> redondear al ovillo superior entero
        unidadesAComprar = Math.ceil(val.exactoFaltante);
        textoDetalle = `${val.exactoRequerido.toFixed(1)} ovillo(s) total (${val.rendimientoPiezas} pz por ovillo)`;
        if (val.categoria === "Hilos") {
          totalOvillosAComprar += unidadesAComprar;
        }
      } else if (val.unidadMedida === "gramos") {
        const pesoPaquete = val.unidadesPresentacion > 0 ? val.unidadesPresentacion : 100;
        unidadesAComprar = Math.ceil(val.exactoFaltante / pesoPaquete);
        textoDetalle = `${Math.round(val.exactoRequerido)}g total (${Math.round(val.exactoFaltante)}g faltan)`;
        if (val.categoria === "Hilos") {
          totalOvillosAComprar += unidadesAComprar;
        }
      } else {
        // Paquetes o piezas sueltas
        if (val.unidadesPresentacion > 1) {
          unidadesAComprar = Math.ceil(val.exactoFaltante / val.unidadesPresentacion);
          textoDetalle = `${Math.round(val.exactoRequerido)} ${val.unidadMedida} (${Math.round(val.exactoFaltante)} faltan)`;
        } else {
          unidadesAComprar = Math.ceil(val.exactoFaltante);
          textoDetalle = `${Math.round(val.exactoRequerido)} ${val.unidadMedida}`;
        }
      }

      const costoEstimadoCompra = Number((unidadesAComprar * val.precioCompra).toFixed(2));
      presupuestoTotalInsumos += costoEstimadoCompra;

      listaInsumos.push({
        materialId: val.materialId,
        nombre: val.nombre,
        categoria: val.categoria,
        presentacion: val.presentacion,
        precioCompra: val.precioCompra,
        unidadMedida: val.unidadMedida,
        modoUso: val.modoUso,
        rendimientoPiezas: val.rendimientoPiezas,
        exactoRequerido: Number(val.exactoRequerido.toFixed(2)),
        exactoConsumido: Number(val.exactoConsumido.toFixed(2)),
        exactoFaltante: Number(val.exactoFaltante.toFixed(2)),
        unidadesAComprar,
        costoEstimadoCompra,
        textoDetalle,
      });
    });

    const totalPiezasFaltantes = Math.max(0, totalPiezasMeta - totalPiezasTerminadas);

    // Sumar horas ya registradas en la bitacora para esta campana
    const horasDedicadasBitacora = bitacora
      .filter((b) => b.campana_id === campanaActiva.id)
      .reduce((sum, b) => sum + (b.horas_dedicadas || 0), 0);

    return {
      totalPiezasMeta,
      totalPiezasTerminadas,
      totalPiezasFaltantes,
      totalHorasEstimadas: Number(totalHorasEstimadas.toFixed(1)),
      totalHorasDedicadas: Number(horasDedicadasBitacora.toFixed(1)),
      totalInsumosDistintos: listaInsumos.length,
      totalOvillosAComprar,
      presupuestoTotalInsumos: Number(presupuestoTotalInsumos.toFixed(2)),
      listaInsumos,
    };
  }, [campanaActiva, productos, materiales, bitacora]);

  const listaInsumosFiltrada = useMemo(() => {
    if (filtroCategoria === "todos") return calculosCampanaInsumos.listaInsumos;
    return calculosCampanaInsumos.listaInsumos.filter(
      (i) => i.categoria.toLowerCase() === filtroCategoria.toLowerCase()
    );
  }, [calculosCampanaInsumos.listaInsumos, filtroCategoria]);

  const handleSumarRapido = async (cant: number) => {
    if (!productoActivo) return;
    setGuardando(true);
    const ok = await onSumarPiezaRapida(productoActivo.id, campanaSeleccionadaId || null, cant);
    setGuardando(false);
    if (ok) {
      setExitoAnim(true);
      setTimeout(() => setExitoAnim(false), 2000);
    }
  };

  const handleRegistrarSesion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productoActivo) return;

    setGuardando(true);
    const hInput = parseFloat(horasDedicadasInput) || 0;
    const mInput = parseFloat(minutosDedicadosInput) || 0;
    const horasCalculadas = Math.max(0.05, Number((hInput + mInput / 60).toFixed(2)));

    const payload = {
      producto_id: productoActivo.id,
      campana_id: campanaSeleccionadaId || null,
      piezas_terminadas: piezasInput,
      horas_dedicadas: horasCalculadas,
      fecha: fechaInput,
      notas: notasInput.trim(),
    };

    const ok = await onGuardarBitacora(payload);
    setGuardando(false);
    if (ok) {
      setNotasInput("");
      setExitoAnim(true);
      setTimeout(() => setExitoAnim(false), 2000);
    }
  };

  return (
    <div className="space-y-5">
      {/* Barra Superior Panoramica: Selector de Campana e Informacion Global */}
      <div className="bg-white rounded-3xl border border-[#FDE8EF] p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-fredoka text-xl font-bold text-[#C04267] flex items-center gap-2">
              <Smartphone className="text-[#EE6B8D]" size={22} />
              Bitácora de Taller y Control de Materiales
            </h3>
            {campanaActiva && (
              <span className="text-[11px] font-quicksand font-bold px-2.5 py-0.5 rounded-full bg-pink-100 text-[#C04267]">
                {campanaActiva.nombre}
              </span>
            )}
          </div>
          <p className="font-quicksand text-xs sm:text-sm text-gray-500 mt-1">
            Diseñada en formato ancho para que tengas a la vista el registro diario, las horas reales y la lista exacta de ovillos a comprar.
          </p>
        </div>

        {/* Selector de Campana */}
        <div className="flex items-center gap-3">
          <div className="font-quicksand text-xs font-bold text-gray-600 shrink-0">
            Campaña activa:
          </div>
          <select
            value={campanaSeleccionadaId}
            onChange={(e) => setCampanaSeleccionadaId(e.target.value)}
            className="px-3 py-2 rounded-2xl border border-pink-200 bg-pink-50/60 font-quicksand text-xs font-bold text-[#C04267] focus:border-[#EE6B8D] focus:outline-none"
          >
            <option value="">Sin campaña (Stock libre del taller)</option>
            {campanas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} {c.activa ? "(Activa)" : ""}
              </option>
            ))}
          </select>

          {exitoAnim && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-quicksand font-bold animate-in fade-in">
              <CheckCircle2 size={15} />
              <span>Guardado</span>
            </div>
          )}
        </div>
      </div>

      {/* Grid Principal Panoramico: 2 Columnas Equilibradas (6 cols / 6 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* COLUMNA IZQUIERDA (6 de 12): Registro Diario y Comparativa de Tiempos */}
        <div className="lg:col-span-6 space-y-5">
          {/* Tarjeta de Registro Tactil */}
          <div className="bg-white rounded-3xl border-2 border-[#EE6B8D]/30 p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2.5 border-b border-pink-100">
              <span className="font-fredoka text-base font-bold text-[#C04267] flex items-center gap-2">
                <Zap size={18} className="text-[#EE6B8D]" />
                ¿Qué modelo avanzaste hoy?
              </span>
              <span className="text-[11px] font-quicksand font-bold text-[#EE6B8D] bg-pink-50 px-2 py-0.5 rounded-full border border-pink-100">
                Toque Rápido
              </span>
            </div>

            {/* Selector de Modelos con Miniatura Compacta y Filtros */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="block text-xs font-quicksand font-bold text-gray-700">
                  1. Selecciona el modelo que estás tejiendo:
                </label>
                <span className="text-[11px] font-quicksand text-gray-500">
                  {productosFiltrados.length} modelo(s) disponible(s)
                </span>
              </div>

              {/* Buscador y Filtro Rápido de Categorías */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                  <input
                    type="text"
                    value={busquedaModelo}
                    onChange={(e) => setBusquedaModelo(e.target.value)}
                    placeholder="Buscar modelo o categoría..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-gray-200 text-xs focus:border-[#EE6B8D] focus:outline-none"
                  />
                  {busquedaModelo && (
                    <button
                      type="button"
                      onClick={() => setBusquedaModelo("")}
                      className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <select
                  value={filtroCategoriaModelo}
                  onChange={(e) => setFiltroCategoriaModelo(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-gray-200 text-xs bg-white text-gray-700 focus:border-[#EE6B8D] focus:outline-none"
                >
                  {categoriasModelos.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat === "todas" ? "Todas las categorías" : cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Grid de Modelos con su Conteo Acumulado */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                {productosFiltrados.length === 0 ? (
                  <div className="sm:col-span-2 py-6 text-center text-xs text-gray-400 font-quicksand bg-gray-50 rounded-2xl border border-gray-100">
                    No se encontraron modelos con &ldquo;{busquedaModelo}&rdquo;.
                  </div>
                ) : (
                  productosFiltrados.map((p) => {
                    const isSelected = p.id === productoActivo?.id;
                    const conteo = getConteoProducto(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setProductoSeleccionadoId(p.id);
                          const tHoras = Math.floor(p.tiempo_produccion || 1);
                          const tMin = Math.round(((p.tiempo_produccion || 1) - tHoras) * 60);
                          setHorasDedicadasInput(String(tHoras));
                          setMinutosDedicadosInput(String(tMin));
                        }}
                        className={`p-2.5 rounded-2xl text-left transition-all border font-quicksand flex items-center gap-2.5 cursor-pointer ${
                          isSelected
                            ? "bg-[#C04267] text-white border-[#C04267] shadow-md ring-2 ring-pink-300"
                            : "bg-[#FDF4F7] text-gray-700 border-pink-100 hover:border-pink-300 hover:bg-white"
                        }`}
                      >
                        <div className="w-11 h-11 rounded-xl overflow-hidden bg-white shrink-0 border border-pink-200/60 flex items-center justify-center">
                          {p.imagen ? (
                            <img src={p.imagen} alt={p.nombre} className="w-full h-full object-cover" />
                          ) : (
                            <Heart size={16} className={isSelected ? "text-pink-200" : "text-[#EE6B8D]"} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-xs truncate">{p.nombre}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded-md font-bold ${
                                isSelected ? "bg-white/20 text-white" : "bg-pink-100/70 text-[#C04267]"
                              }`}
                            >
                              <Scissors size={10} className="inline mr-1" />
                              {conteo.terminadas} {conteo.meta ? `/ ${conteo.meta}` : "hechas"}
                            </span>
                            <span
                              className={`text-[10px] truncate ${
                                isSelected ? "text-pink-100" : "text-gray-400"
                              }`}
                            >
                              {p.tiempo_produccion}h
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Panel Destacado de Conteo en Vivo para el Modelo Seleccionado */}
            {productoActivo && (
              <div className="p-4 rounded-3xl bg-gradient-to-br from-pink-50 via-white to-rose-50/60 border-2 border-[#EE6B8D]/40 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-2xl overflow-hidden bg-white shrink-0 border border-pink-200 shadow-2xs flex items-center justify-center">
                      {productoActivo.imagen ? (
                        <img src={productoActivo.imagen} alt={productoActivo.nombre} className="w-full h-full object-cover" />
                      ) : (
                        <Heart size={20} className="text-[#EE6B8D]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold text-[#EE6B8D] uppercase tracking-wider">
                        {productoActivo.categoria || "Modelo Activo"}
                      </div>
                      <h4 className="font-fredoka text-base font-bold text-gray-900 truncate">
                        {productoActivo.nombre}
                      </h4>
                      <div className="text-[11px] text-gray-500">
                        Tiempo estimado: <span className="font-semibold text-gray-700">{productoActivo.tiempo_produccion}h por pieza</span>
                      </div>
                    </div>
                  </div>

                  {/* Número Gigante de Conteo Actual */}
                  <div className="text-right shrink-0 bg-white px-3.5 py-1.5 rounded-2xl border border-pink-200 shadow-2xs">
                    <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Llevas hechas</div>
                    <div className="font-fredoka text-2xl sm:text-3xl font-extrabold text-[#C04267] leading-tight">
                      {conteoActivo.terminadas}
                    </div>
                    {conteoActivo.meta ? (
                      <div className="text-[10px] text-gray-500 font-bold">
                        de {conteoActivo.meta} meta
                      </div>
                    ) : (
                      <div className="text-[10px] text-emerald-600 font-bold">
                        unidades
                      </div>
                    )}
                  </div>
                </div>

                {/* Barra de progreso de campaña si tiene meta definida */}
                {conteoActivo.meta && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-semibold text-gray-600">
                      <span>Progreso de campaña: {conteoActivo.porcentaje}%</span>
                      <span>
                        {conteoActivo.faltantes && conteoActivo.faltantes > 0
                          ? `Faltan ${conteoActivo.faltantes} unidades`
                          : "¡Meta completada!"}
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-pink-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#EE6B8D] to-[#C04267] rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, conteoActivo.porcentaje || 0)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Botones de Suma Rápida con 1 Toque */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs font-bold text-[#C04267]">
                    <span>2. ¡Suma piezas terminadas con un toque!</span>
                    <span className="text-[10px] font-normal text-gray-500">Se guarda de inmediato</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      disabled={guardando}
                      onClick={() => handleSumarRapido(1)}
                      className="sm:col-span-2 py-3 px-3 rounded-2xl bg-[#EE6B8D] hover:bg-[#C04267] text-white font-fredoka text-base sm:text-lg font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Plus size={18} className="stroke-[3]" />
                      <span>+1 Unidad Terminada</span>
                    </button>

                    <button
                      type="button"
                      disabled={guardando}
                      onClick={() => handleSumarRapido(2)}
                      className="py-2.5 rounded-2xl bg-white hover:bg-pink-50 border border-pink-200 text-[#C04267] font-fredoka text-base font-bold transition-all shadow-2xs active:scale-95 flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <span>+2</span>
                      <span className="font-quicksand text-[10px] font-semibold text-gray-500">piezas</span>
                    </button>

                    <button
                      type="button"
                      disabled={guardando}
                      onClick={() => handleSumarRapido(5)}
                      className="py-2.5 rounded-2xl bg-white hover:bg-pink-50 border border-pink-200 text-[#C04267] font-fredoka text-base font-bold transition-all shadow-2xs active:scale-95 flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <span>+5</span>
                      <span className="font-quicksand text-[10px] font-semibold text-gray-500">piezas</span>
                    </button>
                  </div>

                  {/* Botón de corrección para restar 1 si se equivocó */}
                  <div className="flex items-center justify-between pt-0.5 text-[11px] text-gray-500">
                    <span>¿Pulsaste por error? Puedes corregir el conteo:</span>
                    <button
                      type="button"
                      disabled={guardando || conteoActivo.terminadas <= 0}
                      onClick={() => handleSumarRapido(-1)}
                      className="text-gray-500 hover:text-rose-600 underline font-semibold disabled:opacity-30 cursor-pointer flex items-center gap-1"
                    >
                      <Minus size={12} />
                      <span>Restar 1 pieza</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Formulario Detallado con Horas */}
            <form
              onSubmit={handleRegistrarSesion}
              className="pt-3 border-t border-gray-100 space-y-3 font-quicksand text-xs"
            >
              <div className="font-bold text-gray-700">
                3. O registra la sesión con horas exactas dedicadas:
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-gray-500 mb-1 text-[11px]">Fecha:</label>
                  <input
                    type="date"
                    value={fechaInput}
                    onChange={(e) => setFechaInput(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border border-gray-200 text-xs focus:border-[#EE6B8D] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-gray-500 mb-1 text-[11px]">Piezas:</label>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    value={piezasInput}
                    onChange={(e) => setPiezasInput(parseInt(e.target.value) || 1)}
                    className="w-full px-2 py-2 rounded-xl border border-gray-200 text-xs font-bold text-center focus:border-[#EE6B8D] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-gray-500 mb-1 text-[11px]">Horas:</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={horasDedicadasInput}
                      onChange={(e) => setHorasDedicadasInput(e.target.value)}
                      placeholder="0"
                      className="w-full pl-2 pr-6 py-2 rounded-xl border border-gray-200 text-xs font-bold text-center focus:border-[#EE6B8D] focus:outline-none"
                    />
                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-semibold pointer-events-none">hrs</span>
                  </div>
                </div>

                <div>
                  <label className="block text-gray-500 mb-1 text-[11px]">Minutos:</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max="59"
                      value={minutosDedicadosInput}
                      onChange={(e) => setMinutosDedicadosInput(e.target.value)}
                      placeholder="0"
                      className="w-full pl-2 pr-6 py-2 rounded-xl border border-gray-200 text-xs font-bold text-center focus:border-[#EE6B8D] focus:outline-none"
                    />
                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-semibold pointer-events-none">min</span>
                  </div>
                </div>
              </div>

              {/* Comparativa Inteligente: Lo deseado vs Lo que realmente fue */}
              <div className="p-3 rounded-2xl bg-gradient-to-br from-pink-50/70 via-white to-rose-50/70 border border-pink-200/80 space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-pink-100 text-[11px]">
                  <span className="font-bold text-[#C04267] flex items-center gap-1">
                    <Sparkles size={13} className="text-[#EE6B8D]" />
                    Planeado vs Real medido
                  </span>
                  <span className="font-semibold text-gray-500 truncate max-w-[140px]">
                    {productoActivo?.nombre}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="p-2 rounded-xl bg-white border border-pink-100">
                    <div className="text-[10px] text-gray-400 uppercase font-bold">Tiempo Deseado</div>
                    <div className="text-sm font-bold text-gray-800 mt-0.5">
                      {calculosSesion.horasDeseadasH}h {calculosSesion.horasDeseadasM}m ({calculosSesion.tiempoDeseadoMin}m)
                    </div>
                    <div className="text-[10px] text-gray-500">
                      M.O.: S/ {calculosSesion.costoManoObraDeseado.toFixed(2)}
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-white border border-pink-200">
                    <div className="text-[10px] text-[#EE6B8D] uppercase font-bold">Tiempo Real</div>
                    <div className="text-sm font-bold text-[#C04267] mt-0.5">
                      {calculosSesion.horasRealesH}h {calculosSesion.horasRealesM}m ({calculosSesion.tiempoRealMin}m)
                    </div>
                    <div className="text-[10px] text-[#C04267] font-semibold">
                      M.O.: S/ {calculosSesion.costoManoObraReal.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Mensaje de Desviacion */}
                {calculosSesion.diferenciaHoras > 0.02 ? (
                  <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] space-y-0.5">
                    <div className="font-bold flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <AlertTriangle size={13} className="text-amber-600 inline" />
                        Te tomó {calculosSesion.diferenciaMin}m más por pieza
                      </span>
                      <span className="font-mono text-amber-700">{calculosSesion.velocidad} pz/h</span>
                    </div>
                    <p className="text-[10px] text-amber-800">
                      Tu mano de obra real sube S/ {(calculosSesion.diferenciaHoras * tarifaHora).toFixed(2)} por pieza.
                    </p>
                  </div>
                ) : calculosSesion.diferenciaHoras < -0.02 ? (
                  <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] space-y-0.5">
                    <div className="font-bold flex items-center justify-between">
                      <span>¡Excelente! Fuiste {Math.abs(calculosSesion.diferenciaMin)}m más rápida</span>
                      <span className="font-mono text-emerald-700">{calculosSesion.velocidad} pz/h</span>
                    </div>
                    <p className="text-[10px] text-emerald-800">
                      Ahorraste S/ {(Math.abs(calculosSesion.diferenciaHoras) * tarifaHora).toFixed(2)} por pieza. Mayor margen neto.
                    </p>
                  </div>
                ) : (
                  <div className="p-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-[11px] flex items-center justify-between">
                    <span className="font-bold">¡Ritmo exacto al tiempo planeado!</span>
                    <span className="font-mono text-blue-700">{calculosSesion.velocidad} pz/h</span>
                  </div>
                )}
              </div>

              <div>
                <input
                  type="text"
                  value={notasInput}
                  onChange={(e) => setNotasInput(e.target.value)}
                  placeholder="Notas (ej. avancé patitas, cosí ojos)..."
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:border-[#EE6B8D] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={guardando || !productoActivo}
                className="w-full py-2.5 rounded-2xl bg-gray-900 hover:bg-black text-white font-bold text-xs transition-all shadow-xs active:scale-98 cursor-pointer"
              >
                Guardar Sesión en Bitácora
              </button>
            </form>
          </div>
        </div>

        {/* COLUMNA DERECHA (6 de 12): Calculadora de Insumos para la Campana e Historial */}
        <div className="lg:col-span-6 space-y-5">
          {/* Tarjeta de Explosion de Insumos y Ovillos Requeridos */}
          <div className="bg-white rounded-3xl border border-[#FDE8EF] p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-gray-100">
              <div>
                <h4 className="font-fredoka text-base font-bold text-gray-800 flex items-center gap-2">
                  <Package size={17} className="text-[#EE6B8D]" />
                  Materiales y Ovillos Necesarios para tu Campaña
                </h4>
                <p className="font-quicksand text-[11px] text-gray-500 mt-0.5">
                  Calculado automáticamente según las recetas de todos los modelos planeados.
                </p>
              </div>

              {/* Filtro de Categoria de Insumos */}
              <div className="flex items-center gap-1 shrink-0 overflow-x-auto pb-1 sm:pb-0">
                {["todos", "Hilos", "Fornituras", "Packaging"].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFiltroCategoria(cat)}
                    className={`px-2.5 py-1 rounded-xl text-[10px] font-quicksand font-bold transition-all ${
                      filtroCategoria.toLowerCase() === cat.toLowerCase()
                        ? "bg-[#C04267] text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-pink-50 hover:text-[#C04267]"
                    }`}
                  >
                    {cat === "todos" ? "Todos" : cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Resumen Numerico Panoramico en 4 Mini-KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-2.5 rounded-2xl bg-pink-50/70 border border-pink-100 text-center">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Meta Total</div>
                <div className="font-fredoka text-base sm:text-lg font-bold text-[#C04267] mt-0.5">
                  {calculosCampanaInsumos.totalPiezasMeta} pz
                </div>
                <div className="text-[10px] font-quicksand text-gray-500">
                  {calculosCampanaInsumos.totalPiezasTerminadas} hechas • {calculosCampanaInsumos.totalPiezasFaltantes} faltan
                </div>
              </div>

              <div className="p-2.5 rounded-2xl bg-purple-50/70 border border-purple-100 text-center">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Ovillos a Comprar</div>
                <div className="font-fredoka text-base sm:text-lg font-bold text-purple-700 mt-0.5">
                  {calculosCampanaInsumos.totalOvillosAComprar} ovillos
                </div>
                <div className="text-[10px] font-quicksand text-purple-600">
                  Enteros para stock
                </div>
              </div>

              <div className="p-2.5 rounded-2xl bg-blue-50/70 border border-blue-100 text-center">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Horas Tejido</div>
                <div className="font-fredoka text-base sm:text-lg font-bold text-blue-700 mt-0.5">
                  {calculosCampanaInsumos.totalHorasDedicadas} / {calculosCampanaInsumos.totalHorasEstimadas}h
                </div>
                <div className="text-[10px] font-quicksand text-blue-600">
                  Dedicadas vs meta
                </div>
              </div>

              <div className="p-2.5 rounded-2xl bg-emerald-50/70 border border-emerald-100 text-center">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Presupuesto Insumos</div>
                <div className="font-fredoka text-base sm:text-lg font-bold text-emerald-700 mt-0.5">
                  S/ {calculosCampanaInsumos.presupuestoTotalInsumos.toFixed(2)}
                </div>
                <div className="text-[10px] font-quicksand text-emerald-600">
                  Para comprar faltante
                </div>
              </div>
            </div>

            {/* Lista Detallada de Insumos con Rendimiento y Presentacion */}
            {calculosCampanaInsumos.listaInsumos.length === 0 ? (
              <div className="py-8 text-center text-gray-400 font-quicksand text-xs bg-gray-50 rounded-2xl border border-gray-100">
                Selecciona una campaña con productos en meta para calcular los insumos y ovillos requeridos.
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {listaInsumosFiltrada.map((insumo) => (
                  <div
                    key={insumo.materialId}
                    className="p-2.5 rounded-2xl bg-gray-50/80 hover:bg-pink-50/40 border border-gray-100 hover:border-pink-200 transition-colors font-quicksand flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-800 text-xs truncate">
                          {insumo.nombre}
                        </span>
                        <span className="text-[10px] px-2 py-0.2 rounded-md bg-white border border-gray-200 text-gray-600 shrink-0 font-medium">
                          {insumo.categoria}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        {insumo.textoDetalle} • Presentación: <span className="font-medium text-gray-700">{insumo.presentacion}</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-bold text-[#C04267] text-xs">
                        Comprar: {insumo.unidadesAComprar} {insumo.categoria === "Hilos" ? "ovillo(s)" : "u."}
                      </div>
                      <div className="text-[11px] font-semibold text-gray-500">
                        S/ {insumo.costoEstimadoCompra.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tarjeta de Historial Reciente de la Bitacora */}
          <div className="bg-white rounded-3xl border border-[#FDE8EF] p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-gray-100">
              <h4 className="font-fredoka text-base font-bold text-gray-800 flex items-center gap-2">
                <History size={16} className="text-[#EE6B8D]" />
                Historial de Tejido Reciente
              </h4>
              <span className="text-xs font-quicksand font-bold text-[#C04267] bg-pink-50 px-2.5 py-0.5 rounded-full border border-pink-100">
                {bitacora.length} sesiones
              </span>
            </div>

            {bitacora.length === 0 ? (
              <div className="py-8 text-center text-gray-400 font-quicksand text-xs">
                No hay sesiones registradas en la bitácora aún.
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {bitacora.map((item) => {
                  const prod = item.producto || productos.find((p) => p.id === item.producto_id);
                  const camp = campanas.find((c) => c.id === item.campana_id);
                  const tReal = item.tiempo_real_por_pieza || Number((item.horas_dedicadas / Math.max(1, item.piezas_terminadas)).toFixed(2));
                  const tDeseado = item.tiempo_estimado_por_pieza || prod?.tiempo_produccion || tReal;
                  const dif = Number((tReal - tDeseado).toFixed(2));
                  const difMin = Math.round(dif * 60);

                  return (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-2xl bg-gray-50 border border-gray-100 font-quicksand text-xs space-y-1.5 hover:border-pink-200 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-gray-800 text-xs">{prod?.nombre || "Producto"}</div>
                          <div className="text-[10px] text-gray-500">
                            {item.fecha} {camp ? `• Feria: ${camp.nombre}` : "• Stock libre"}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (confirm("¿Deseas eliminar este registro de bitácora?")) {
                              onEliminarBitacora(item.id);
                            }
                          }}
                          className="w-6 h-6 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors"
                          title="Eliminar sesión"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-gray-200/60">
                        <span className="font-bold text-gray-700">
                          +{item.piezas_terminadas} pz en {item.horas_dedicadas}h ({tReal}h/pz)
                        </span>

                        {dif > 0.02 ? (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-md">
                            +{difMin}m vs deseado
                          </span>
                        ) : dif < -0.02 ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-md">
                            -{Math.abs(difMin)}m más rápido
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-md">
                            Exacto al deseado
                          </span>
                        )}
                      </div>

                      {item.notas && (
                        <div className="text-[10px] text-gray-500 italic">
                          &quot;{item.notas}&quot;
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
