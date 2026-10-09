"use client";

import React, { useState, useMemo } from "react";
import {
  X,
  ShoppingBag,
  Sparkles,
  CheckCircle2,
  Calendar,
  Layers,
  Check,
  AlertCircle,
  Tag,
  ArrowRight,
  Eye,
} from "lucide-react";
import {
  ProductoProduccion,
  CampanaProduccion,
  EventoCatalogoItem,
  PublicarProductoItem,
} from "@/types/produccion";

interface PublicarTiendaModalProps {
  isOpen: boolean;
  onClose: () => void;
  campana?: CampanaProduccion | null;
  productos: ProductoProduccion[];
  eventos?: EventoCatalogoItem[];
  onPublicarExitoso: (items: PublicarProductoItem[], catalogoSlug: string) => Promise<boolean>;
}

interface ItemSeleccionado {
  producto_id: string;
  producto_tienda_id?: string | null;
  nombre: string;
  categoria: string;
  imagen?: string;
  precio: number;
  stock: number;
  seleccionado: boolean;
}

export default function PublicarTiendaModal({
  isOpen,
  onClose,
  campana,
  productos,
  eventos = [],
  onPublicarExitoso,
}: PublicarTiendaModalProps) {
  // Inicializar productos terminados de la campana o del taller
  const [items, setItems] = useState<ItemSeleccionado[]>([]);
  const [eventoSeleccionadoSlug, setEventoSeleccionadoSlug] = useState<string>("general");
  const [publicando, setPublicando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Inicializar lista cuando se abre el modal
  React.useEffect(() => {
    if (!isOpen) {
      setMensajeExito(null);
      setErrorMsg(null);
      return;
    }

    if (campana && campana.items && campana.items.length > 0) {
      const iniciales: ItemSeleccionado[] = campana.items
        .map((ci) => {
          const prod = productos.find((p) => p.id === ci.producto_id) || ci.producto;
          if (!prod) return null;
          const cantTerminada = ci.cantidad_terminada || 0;
          return {
            producto_id: prod.id,
            producto_tienda_id: prod.producto_tienda_id,
            nombre: prod.nombre,
            categoria: prod.categoria,
            imagen: prod.imagen,
            precio: prod.precio_venta_real || prod.precio_sugerido || 0,
            stock: cantTerminada > 0 ? cantTerminada : ci.cantidad_meta || 1,
            seleccionado: cantTerminada > 0,
          };
        })
        .filter(Boolean) as ItemSeleccionado[];

      setItems(iniciales);
    } else {
      // Si no hay campana activa, mostrar todos los productos con stock sugerido 1
      const iniciales: ItemSeleccionado[] = productos.map((prod) => ({
        producto_id: prod.id,
        producto_tienda_id: prod.producto_tienda_id,
        nombre: prod.nombre,
        categoria: prod.categoria,
        imagen: prod.imagen,
        precio: prod.precio_venta_real || prod.precio_sugerido || 0,
        stock: 1,
        seleccionado: true,
      }));
      setItems(iniciales);
    }
  }, [isOpen, campana, productos]);

  const itemsSeleccionados = useMemo(() => {
    return items.filter((i) => i.seleccionado);
  }, [items]);

  const totalStockSeleccionado = useMemo(() => {
    return itemsSeleccionados.reduce((acc, i) => acc + (Number(i.stock) || 0), 0);
  }, [itemsSeleccionados]);

  const totalValorVenta = useMemo(() => {
    return itemsSeleccionados.reduce((acc, i) => acc + ((Number(i.stock) || 0) * (Number(i.precio) || 0)), 0);
  }, [itemsSeleccionados]);

  const handleToggleSeleccion = (prodId: string) => {
    setItems((prev) =>
      prev.map((i) => (i.producto_id === prodId ? { ...i, seleccionado: !i.seleccionado } : i))
    );
  };

  const handleToggleTodos = () => {
    const todosSeleccionados = items.every((i) => i.seleccionado);
    setItems((prev) => prev.map((i) => ({ ...i, seleccionado: !todosSeleccionados })));
  };

  const handleUpdateStock = (prodId: string, stock: number) => {
    setItems((prev) =>
      prev.map((i) => (i.producto_id === prodId ? { ...i, stock: Math.max(0, stock) } : i))
    );
  };

  const handleUpdatePrecio = (prodId: string, precio: number) => {
    setItems((prev) =>
      prev.map((i) => (i.producto_id === prodId ? { ...i, precio: Math.max(0, precio) } : i))
    );
  };

  const handlePublicar = async () => {
    if (itemsSeleccionados.length === 0) {
      setErrorMsg("Selecciona al menos un producto para publicar en la tienda.");
      return;
    }

    setPublicando(true);
    setErrorMsg(null);

    const payload = itemsSeleccionados.map((i) => ({
      producto_id: i.producto_id,
      producto_tienda_id: i.producto_tienda_id,
      nombre: i.nombre,
      categoria: i.categoria,
      imagen: i.imagen,
      precio: i.precio,
      stock: i.stock,
      descripcion: `Detalle artesanal hecho a mano en taller Entre Hilos (${i.categoria}). Disponible para entrega inmediata.`,
    }));

    const ok = await onPublicarExitoso(payload, eventoSeleccionadoSlug);
    setPublicando(false);

    if (ok) {
      setMensajeExito(
        `¡Listo! Se publicaron ${itemsSeleccionados.length} productos con un total de ${totalStockSeleccionado} unidades en stock en la tienda web.`
      );
      setTimeout(() => {
        onClose();
      }, 2000);
    } else {
      setErrorMsg("Hubo un error al sincronizar con el catálogo de la tienda.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-pink-100 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Cabecera del Modal */}
        <div className="px-5 sm:px-7 py-4.5 border-b border-pink-100 flex items-center justify-between bg-gradient-to-r from-pink-50/70 via-white to-pink-50/40">
          <div>
            <h3 className="font-fredoka text-lg sm:text-xl font-bold text-[#C04267] flex items-center gap-2">
              <ShoppingBag className="text-[#EE6B8D]" size={20} />
              Sumar lo Producido al Catálogo de la Tienda
            </h3>
            <p className="font-quicksand text-xs text-gray-500 mt-0.5">
              {campana
                ? `Campaña: ${campana.nombre} • Sube el stock terminado para venta online o evento`
                : "Publica las piezas tejidas directamente a la tienda online con stock real para clientes"}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-gray-100 hover:bg-pink-100 text-gray-500 hover:text-[#C04267] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Contenido en 2 Columnas Panoramicas */}
        <div className="p-5 sm:p-7 overflow-y-auto space-y-5 flex-1">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 font-quicksand text-xs flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {mensajeExito && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-quicksand text-xs flex items-center gap-2">
              <CheckCircle2 size={16} />
              <span>{mensajeExito}</span>
            </div>
          )}

          {/* Selector de Destino (Catálogo general o Evento especial) */}
          <div className="bg-[#FDF4F7] p-4 rounded-2xl border border-pink-100 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="block text-xs font-quicksand font-bold text-[#C04267]">
                  ¿En qué catálogo o evento deseas poner a la venta estos productos?
                </label>
                <p className="text-[11px] font-quicksand text-gray-500">
                  Aparecerán automáticamente en la tienda web con stock listo para comprar.
                </p>
              </div>

              <select
                value={eventoSeleccionadoSlug}
                onChange={(e) => setEventoSeleccionadoSlug(e.target.value)}
                className="px-3.5 py-2 rounded-xl border border-pink-200 bg-white font-quicksand text-xs font-bold text-gray-800 focus:border-[#EE6B8D] focus:outline-none"
              >
                <option value="general">Catálogo General (Todos los clientes)</option>
                {eventos.map((ev) => (
                  <option key={ev.slug} value={ev.slug}>
                    Evento: {ev.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tabla de Productos Terminados */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs font-quicksand">
              <span className="font-bold text-gray-700">
                Selecciona las piezas que deseas subir a la web:
              </span>
              <button
                type="button"
                onClick={handleToggleTodos}
                className="text-[#C04267] hover:underline font-bold text-[11px] cursor-pointer"
              >
                {items.every((i) => i.seleccionado) ? "Desmarcar todos" : "Marcar todos"}
              </button>
            </div>

            <div className="border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100">
              {items.length === 0 ? (
                <div className="p-8 text-center text-gray-400 font-quicksand text-xs">
                  No hay productos registrados en esta campaña aún.
                </div>
              ) : (
                items.map((item) => (
                  <div
                    key={item.producto_id}
                    className={`p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                      item.seleccionado ? "bg-white" : "bg-gray-50/60 opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={item.seleccionado}
                        onChange={() => handleToggleSeleccion(item.producto_id)}
                        className="w-4 h-4 rounded text-[#C04267] focus:ring-[#EE6B8D] border-gray-300 cursor-pointer"
                      />

                      <div className="w-11 h-11 rounded-xl bg-pink-50 border border-pink-100 overflow-hidden shrink-0 flex items-center justify-center">
                        {item.imagen ? (
                          <img src={item.imagen} alt={item.nombre} className="w-full h-full object-cover" />
                        ) : (
                          <ShoppingBag size={16} className="text-[#EE6B8D]" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="font-quicksand font-bold text-xs sm:text-sm text-gray-800 truncate">
                          {item.nombre}
                        </div>
                        <div className="text-[11px] font-quicksand text-gray-500">
                          {item.categoria}
                        </div>
                      </div>
                    </div>

                    {/* Stock y Precio de Venta */}
                    <div className="flex items-center gap-4 pl-7 sm:pl-0 shrink-0">
                      <div>
                        <label className="block text-[10px] font-quicksand font-bold text-gray-400 uppercase">
                          Stock a Subir
                        </label>
                        <div className="flex items-center gap-1 mt-0.5">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.stock}
                            disabled={!item.seleccionado}
                            onChange={(e) => handleUpdateStock(item.producto_id, parseInt(e.target.value) || 0)}
                            className="w-16 px-2 py-1 rounded-lg border border-gray-200 text-center text-xs font-bold text-gray-800 focus:border-[#EE6B8D] focus:outline-none disabled:bg-gray-100"
                          />
                          <span className="text-[11px] font-quicksand text-gray-500">pz</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-quicksand font-bold text-gray-400 uppercase">
                          Precio Venta
                        </label>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-xs font-bold text-gray-500">S/</span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.precio}
                            disabled={!item.seleccionado}
                            onChange={(e) => handleUpdatePrecio(item.producto_id, parseFloat(e.target.value) || 0)}
                            className="w-20 px-2 py-1 rounded-lg border border-gray-200 text-center text-xs font-bold text-[#C04267] focus:border-[#EE6B8D] focus:outline-none disabled:bg-gray-100"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Resumen Final de lo que se publicara */}
          <div className="grid grid-cols-3 gap-3 p-3.5 rounded-2xl bg-pink-50/50 border border-pink-100 text-center font-quicksand">
            <div>
              <div className="text-[10px] text-gray-400 uppercase font-bold">Diseños Seleccionados</div>
              <div className="font-fredoka text-base font-bold text-gray-800 mt-0.5">
                {itemsSeleccionados.length} modelos
              </div>
            </div>

            <div>
              <div className="text-[10px] text-gray-400 uppercase font-bold">Total Stock a Cargar</div>
              <div className="font-fredoka text-base font-bold text-[#C04267] mt-0.5">
                {totalStockSeleccionado} piezas
              </div>
            </div>

            <div>
              <div className="text-[10px] text-gray-400 uppercase font-bold">Valor Potencial en Tienda</div>
              <div className="font-fredoka text-base font-bold text-emerald-700 mt-0.5">
                S/ {totalValorVenta.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* Barra de Acciones */}
        <div className="px-5 sm:px-7 py-3.5 border-t border-gray-100 flex items-center justify-between bg-gray-50/80">
          <button
            type="button"
            onClick={onClose}
            disabled={publicando}
            className="px-4 py-2 rounded-xl text-gray-500 hover:text-gray-700 font-quicksand font-bold text-xs transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={publicando || itemsSeleccionados.length === 0}
            onClick={handlePublicar}
            className="px-6 py-2.5 rounded-2xl bg-[#EE6B8D] hover:bg-[#C04267] text-white font-fredoka font-bold text-xs sm:text-sm shadow-md transition-all active:scale-98 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
          >
            <ShoppingBag size={16} />
            <span>
              {publicando ? "Subiendo a la tienda..." : `Sumar ${totalStockSeleccionado} piezas al Catálogo`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
