"use client";

import React, { useState, useMemo } from "react";
import {
  X,
  Plus,
  Minus,
  Trash2,
  Calendar,
  Clock,
  Phone,
  User,
  ShoppingBag,
  DollarSign,
  FileText,
  Loader2,
  Check,
  Search,
  MapPin,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { Product } from "@/lib/ventify";
import OrderPhotoUploader from "./OrderPhotoUploader";
import { ChannelSelect, PaymentMethodSelect } from "./BrandControls";

interface AgendarPedidoModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableProducts: Product[];
  onSaveSuccess: () => void;
}

interface ItemPedido {
  id: string;
  nombre: string;
  precio: number;
  cantidad: number;
  imagen?: string;
  esPersonalizado?: boolean;
}

function formatDateISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalize(s: string) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export default function AgendarPedidoModal({
  isOpen,
  onClose,
  availableProducts,
  onSaveSuccess,
}: AgendarPedidoModalProps) {
  const [origen, setOrigen] = useState("whatsapp");
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteTelefono, setClienteTelefono] = useState("");
  const [clienteEmail, setClienteEmail] = useState("");
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [direccionEnvio, setDireccionEnvio] = useState("");
  const [fechaEntrega, setFechaEntrega] = useState("");
  const [horaEntrega, setHoraEntrega] = useState("");
  const [metodoPago, setMetodoPago] = useState("yape");
  const [adelanto, setAdelanto] = useState("");
  const [estado, setEstado] = useState("pendiente");
  const [notas, setNotas] = useState("");
  const [showMasDetalles, setShowMasDetalles] = useState(false);

  // Lista de items del pedido
  const [items, setItems] = useState<ItemPedido[]>([]);

  // Búsqueda y catálogo de productos interno
  const [internalProducts, setInternalProducts] = useState<Product[]>(availableProducts || []);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [prodSearch, setProdSearch] = useState("");
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customNombre, setCustomNombre] = useState("");
  const [customPrecio, setCustomPrecio] = useState("");
  const [customFotos, setCustomFotos] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Directorio de clientes existentes (registrados, pedidos previos y manuales)
  const [clientesDirectory, setClientesDirectory] = useState<
    Array<{ id: string; usuario_id?: string; nombre: string; telefono?: string; email?: string; direccion?: string; origen?: string }>
  >([]);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [clientPickerSearch, setClientPickerSearch] = useState("");

  React.useEffect(() => {
    if (!isOpen) return;
    fetch("/api/admin?tab=clientes-directorio")
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => {
        if (Array.isArray(list)) setClientesDirectory(list);
      })
      .catch(() => {});
  }, [isOpen]);

  // Carga automática del catálogo si no viniera precargado
  React.useEffect(() => {
    if (availableProducts && availableProducts.length > 0) {
      setInternalProducts(availableProducts);
    } else if (isOpen) {
      setLoadingCatalog(true);
      fetch("/api/ventify/products")
        .then((r) => r.json())
        .then((data) => {
          if (data && Array.isArray(data.all)) {
            setInternalProducts(data.all);
          }
        })
        .catch((err) => console.error("Error al cargar productos en modal:", err))
        .finally(() => setLoadingCatalog(false));
    }
  }, [availableProducts, isOpen]);

  // Atajos de fecha
  const setFechaPreset = (diasAdelante: number) => {
    const d = new Date();
    d.setDate(d.getDate() + diasAdelante);
    setFechaEntrega(formatDateISO(d));
  };

  const setProximoSabado = () => {
    const d = new Date();
    const diaActual = d.getDay(); // 0 Dom, 6 Sab
    const diff = diaActual === 6 ? 7 : (6 - diaActual + 7) % 7;
    d.setDate(d.getDate() + diff);
    setFechaEntrega(formatDateISO(d));
  };

  // Filtrado de productos para el buscador instantáneo
  const filteredProducts = useMemo(() => {
    const productsToUse = internalProducts.length > 0 ? internalProducts : (availableProducts || []);
    if (!prodSearch.trim()) {
      return productsToUse.slice(0, 10); // Top 10 por defecto
    }
    const q = normalize(prodSearch);
    return productsToUse
      .filter((p) => {
        const nom = normalize(p.nombre);
        const sku = normalize(p.sku);
        const cat = normalize(p.categoria);
        return nom.includes(q) || sku.includes(q) || cat.includes(q);
      })
      .slice(0, 25);
  }, [internalProducts, availableProducts, prodSearch]);

  const totalCalculado = useMemo(() => {
    return items.reduce((acc, it) => acc + it.precio * it.cantidad, 0);
  }, [items]);

  const adelantoNum = parseFloat(adelanto) || 0;
  const saldoPendiente = Math.max(0, totalCalculado - adelantoNum);

  if (!isOpen) return null;

  // Acciones rápidas de productos
  const handleQuickAddProduct = (prod: Product) => {
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.id === prod.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], cantidad: copy[idx].cantidad + 1 };
        return copy;
      }
      return [
        ...prev,
        {
          id: prod.id,
          nombre: prod.nombre,
          precio: Number(prod.precio) || 0,
          cantidad: 1,
          imagen: prod.imagen,
        },
      ];
    });
    setProdSearch("");
  };

  const handleUpdateCantidad = (idx: number, delta: number) => {
    setItems((prev) => {
      const target = prev[idx];
      if (!target) return prev;
      const nextCant = target.cantidad + delta;
      if (nextCant <= 0) {
        return prev.filter((_, i) => i !== idx);
      }
      const copy = [...prev];
      copy[idx] = { ...copy[idx], cantidad: nextCant };
      return copy;
    });
  };

  const handleRemoveItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAddCustom = () => {
    if (!customNombre.trim()) return;
    const precioNum = parseFloat(customPrecio) || 0;
    if (precioNum <= 0) return;

    setItems((prev) => [
      ...prev,
      {
        id: `custom_${Date.now()}`,
        nombre: customNombre.trim(),
        precio: precioNum,
        cantidad: 1,
        esPersonalizado: true,
        imagen: customFotos[0] || undefined,
      },
    ]);
    setCustomNombre("");
    setCustomPrecio("");
    setCustomFotos([]);
    setShowCustomForm(false);
  };

  // Atajos de pago de 1 clic
  const handleSetAdelantoPreset = (tipo: "cero" | "mitad" | "total") => {
    if (tipo === "cero") {
      setAdelanto("0");
    } else if (tipo === "mitad") {
      setAdelanto((totalCalculado / 2).toFixed(2));
    } else if (tipo === "total") {
      setAdelanto(totalCalculado.toFixed(2));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteNombre.trim()) {
      setErrorMsg("Ingresa el nombre del cliente.");
      return;
    }
    if (items.length === 0) {
      setErrorMsg("Agrega al menos un producto al pedido.");
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      const payload = {
        action: "agendar-pedido",
        origen,
        usuario_id: usuarioId || null,
        cliente_nombre: clienteNombre.trim(),
        cliente_telefono: clienteTelefono.trim(),
        cliente_email: clienteEmail.trim() || null,
        direccion_envio: direccionEnvio.trim() || "Coordinar por WhatsApp",
        items,
        total: totalCalculado,
        adelanto: adelantoNum,
        saldo_pendiente: saldoPendiente,
        fecha_entrega: fechaEntrega && fechaEntrega.trim() ? fechaEntrega.trim().split("T")[0] : null,
        hora_entrega: horaEntrega && horaEntrega.trim() ? horaEntrega.trim() : null,
        metodo_pago: metodoPago,
        estado,
        notas: notas && notas.trim() ? notas.trim() : null,
      };

      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "No se pudo agendar el pedido");
      }

      const resData = await res.json().catch(() => ({}));

      // Si el pedido contiene items personalizados o a medida, sincronizar con pedidos_personalizados
      const customItems = items.filter((it) => it.esPersonalizado);
      if (customItems.length > 0) {
        for (const cItem of customItems) {
          try {
            await fetch("/api/submit", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: "personalizado",
                data: {
                  nombre_cliente: clienteNombre.trim(),
                  telefono: clienteTelefono.trim(),
                  email: clienteEmail.trim() || null,
                  producto_nombre: cItem.nombre,
                  producto_precio: cItem.precio || null,
                  detalles: `Pedido #${resData?.data?.id || "Agendado"} (${origen}). Cantidad: ${cItem.cantidad}${notas ? ` | Notas: ${notas.trim()}` : ""}`,
                  fecha_entrega: fechaEntrega && fechaEntrega.trim() ? fechaEntrega.trim().split("T")[0] : null,
                  hora_entrega: horaEntrega && horaEntrega.trim() ? horaEntrega.trim() : null,
                  estado: estado || "pendiente",
                },
              }),
            });
          } catch (syncErr) {
            console.warn("No se pudo sincronizar ítem personalizado:", syncErr);
          }
        }
      }

      onSaveSuccess();
      onClose();
    } catch (err) {
      console.error("Error al agendar pedido:", err);
      setErrorMsg(err instanceof Error ? err.message : "Error al procesar el pedido");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl border border-gray-100 max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header rápido */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-gray-100 bg-gradient-to-r from-pink-50/70 via-white to-pink-50/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#EE6B8D] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Calendar size={18} />
            </div>
            <div>
              <h3 className="font-fredoka text-base sm:text-lg font-bold text-gray-900 leading-tight">
                Agendar Pedido Rápido
              </h3>
              <p className="font-quicksand text-[11px] text-gray-500 leading-none mt-0.5">
                Ingreso ágil de pedidos recibidos por WhatsApp o redes sociales
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 sm:p-2 text-gray-400 hover:text-gray-700 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Mensaje de error si ocurre */}
        {errorMsg && (
          <div className="mx-4 sm:mx-6 mt-3 p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-quicksand">
            {errorMsg}
          </div>
        )}

        {/* Formulario dividido en dos columnas responsivas (en tablet/desktop) */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-3.5 sm:p-5 lg:p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 lg:gap-6 items-start">
            {/* COLUMNA IZQUIERDA: Origen, Cliente, Entrega (md:col-span-5) */}
            <div className="md:col-span-5 space-y-4">
              {/* 1. Canal de Origen */}
              <div>
                <label className="block font-quicksand text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                  Canal de Origen
                </label>
                <ChannelSelect
                  value={origen}
                  onChange={setOrigen}
                  placement="bottom"
                  allowTienda
                />
              </div>

              {/* 2. Datos del Cliente */}
              <div className="bg-gray-50/70 p-3 sm:p-3.5 rounded-xl border border-gray-200/70 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 font-quicksand">
                    <User size={14} className="text-[#EE6B8D]" />
                    <span>Datos del Cliente</span>
                  </div>
                  {clientesDirectory.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowClientPicker((prev) => !prev)}
                      className="text-[11px] font-quicksand font-bold text-[#C04267] bg-pink-50 hover:bg-pink-100 border border-pink-200 px-2 py-0.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Search size={11} />
                      <span>Elegir guardado ({clientesDirectory.length})</span>
                    </button>
                  )}
                </div>

                {showClientPicker && (
                  <div className="bg-white border border-pink-200 rounded-xl p-2 space-y-1.5 shadow-xs">
                    <input
                      type="text"
                      value={clientPickerSearch}
                      onChange={(e) => setClientPickerSearch(e.target.value)}
                      placeholder="Buscar cliente por nombre o teléfono..."
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg font-quicksand focus:outline-none focus:border-[#EE6B8D]"
                    />
                    <div className="max-h-36 overflow-y-auto divide-y divide-gray-100">
                      {clientesDirectory
                        .filter((c) => {
                          const q = normalize(clientPickerSearch);
                          if (!q) return true;
                          return (
                            normalize(c.nombre).includes(q) ||
                            (c.telefono || "").includes(q) ||
                            (c.email || "").toLowerCase().includes(q)
                          );
                        })
                        .slice(0, 30)
                        .map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setClienteNombre(c.nombre);
                              if (c.telefono) setClienteTelefono(c.telefono);
                              if (c.direccion) setDireccionEnvio(c.direccion);
                              setClienteEmail(c.email || "");
                              setUsuarioId(c.usuario_id || null);
                              setShowClientPicker(false);
                              setClientPickerSearch("");
                            }}
                            className="w-full flex items-center justify-between gap-2 px-2 py-1.5 text-left hover:bg-[#FDF4F7] rounded-lg transition-colors cursor-pointer"
                          >
                            <div className="min-w-0">
                              <p className="font-quicksand text-xs font-bold text-gray-800 truncate">{c.nombre}</p>
                              {(c.telefono || c.email || c.direccion) && (
                                <p className="font-quicksand text-[10px] text-gray-400 truncate">
                                  {[c.telefono, c.email, c.direccion].filter(Boolean).join(" · ")}
                                </p>
                              )}
                            </div>
                            {c.origen && (
                              <span className="text-[9px] font-quicksand font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 shrink-0">
                                {c.origen}
                              </span>
                            )}
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                <div>
                  <input
                    type="text"
                    required
                    placeholder="Nombre del cliente *"
                    value={clienteNombre}
                    onChange={(e) => setClienteNombre(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg font-quicksand text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D]"
                  />
                </div>

                <div>
                  <div className="relative">
                    <Phone size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="tel"
                      placeholder="Teléfono / WhatsApp (ej. 987654321)"
                      value={clienteTelefono}
                      onChange={(e) => setClienteTelefono(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg font-quicksand text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D]"
                    />
                  </div>
                </div>

                <div>
                  <div className="relative">
                    <MapPin size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Dirección o punto de entrega (opcional)"
                      value={direccionEnvio}
                      onChange={(e) => setDireccionEnvio(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg font-quicksand text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D]"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Fecha y Horario de Entrega con atajos de 1 clic */}
              <div className="bg-pink-50/40 p-3 sm:p-3.5 rounded-xl border border-pink-100 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#C04267] font-quicksand">
                    <Calendar size={14} />
                    <span>Fecha de Entrega</span>
                  </div>
                  <span className="text-[10px] text-gray-400 font-quicksand">Atajos de 1 clic:</span>
                </div>

                {/* Atajos de 1 toque */}
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => setFechaPreset(0)}
                    className="px-2 py-1 bg-white border border-pink-200 text-[#C04267] hover:bg-pink-100 rounded-md text-[11px] font-quicksand font-bold transition-colors"
                  >
                    Hoy
                  </button>
                  <button
                    type="button"
                    onClick={() => setFechaPreset(1)}
                    className="px-2 py-1 bg-white border border-pink-200 text-[#C04267] hover:bg-pink-100 rounded-md text-[11px] font-quicksand font-bold transition-colors"
                  >
                    Mañana
                  </button>
                  <button
                    type="button"
                    onClick={() => setFechaPreset(2)}
                    className="px-2 py-1 bg-white border border-pink-200 text-[#C04267] hover:bg-pink-100 rounded-md text-[11px] font-quicksand font-bold transition-colors"
                  >
                    En 2 días
                  </button>
                  <button
                    type="button"
                    onClick={() => setFechaPreset(3)}
                    className="px-2 py-1 bg-white border border-pink-200 text-[#C04267] hover:bg-pink-100 rounded-md text-[11px] font-quicksand font-bold transition-colors"
                  >
                    En 3 días
                  </button>
                  <button
                    type="button"
                    onClick={setProximoSabado}
                    className="px-2 py-1 bg-white border border-pink-200 text-[#C04267] hover:bg-pink-100 rounded-md text-[11px] font-quicksand font-bold transition-colors"
                  >
                    Sábado
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="block text-[10px] text-gray-500 font-quicksand font-semibold mb-0.5">
                      Fecha programada
                    </label>
                    <input
                      type="date"
                      value={fechaEntrega}
                      onChange={(e) => setFechaEntrega(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg font-quicksand text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 font-quicksand font-semibold mb-0.5">
                      Horario / Turno
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Mañana (10am)"
                      value={horaEntrega}
                      onChange={(e) => setHoraEntrega(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg font-quicksand text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D]"
                    />
                  </div>
                </div>
              </div>

              {/* Dedicatoria y Notas (colapsable para ahorrar espacio) */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowMasDetalles(!showMasDetalles)}
                  className="w-full px-3 py-2 text-left bg-gray-50 hover:bg-gray-100 flex items-center justify-between text-xs font-quicksand font-bold text-gray-600 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <FileText size={13} className="text-gray-400" />
                    <span>Dedicatoria para tarjeta o notas adicionales</span>
                  </div>
                  {showMasDetalles ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {showMasDetalles && (
                  <div className="p-3 bg-white space-y-2 animate-in fade-in duration-100">
                    <textarea
                      rows={2}
                      placeholder="Escribe el mensaje de la tarjeta de regalo, colores específicos pedidos, o detalles para el empaque..."
                      value={notas}
                      onChange={(e) => setNotas(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg font-quicksand text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D] resize-none"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* COLUMNA DERECHA: Buscador de productos, Lista, Cobro (md:col-span-7) */}
            <div className="md:col-span-7 space-y-4">
              {/* Sección Buscador y Selector de Productos */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-quicksand text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    Productos del Pedido *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowCustomForm(!showCustomForm)}
                    className="text-[11px] font-quicksand font-bold text-[#EE6B8D] hover:text-[#C04267] flex items-center gap-1"
                  >
                    <Plus size={13} />
                    <span>{showCustomForm ? "Cerrar personalizado" : "+ Ítem personalizado"}</span>
                  </button>
                </div>

                {/* Formulario rápido para encargo libre / personalizado */}
                {showCustomForm && (
                  <div className="p-3 bg-pink-50 rounded-xl border border-pink-200 space-y-2 animate-in fade-in duration-100">
                    <p className="font-quicksand text-xs font-bold text-[#C04267]">
                      Encargo personalizado o producto fuera de catálogo:
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        placeholder="Descripción (ej. Ramo 12 tulipanes fucsia con lazo)"
                        value={customNombre}
                        onChange={(e) => setCustomNombre(e.target.value)}
                        className="w-full sm:flex-1 px-3 py-2 text-xs border border-gray-200 rounded-lg font-quicksand text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D]"
                      />
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          placeholder="Precio S/"
                          value={customPrecio}
                          onChange={(e) => setCustomPrecio(e.target.value)}
                          className="flex-1 sm:w-28 px-3 py-2 text-xs border border-gray-200 rounded-lg font-quicksand text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D]"
                        />
                        <button
                          type="button"
                          disabled={!customNombre.trim() || !customPrecio}
                          onClick={handleAddCustom}
                          className="px-4 py-2 bg-[#EE6B8D] hover:bg-[#C04267] text-white rounded-lg font-quicksand font-bold text-xs transition-colors disabled:opacity-50 shrink-0 shadow-xs flex items-center justify-center gap-1"
                        >
                          <Plus size={13} />
                          <span>Añadir</span>
                        </button>
                      </div>
                    </div>

                    <OrderPhotoUploader
                      fotos={customFotos}
                      onChange={setCustomFotos}
                      max={1}
                      compact
                      label="Foto de referencia (opcional)"
                      hint="Adjunta, arrastra o pega (Ctrl + V) una imagen de lo que el cliente busca."
                    />
                  </div>
                )}

                {/* Buscador Instantáneo */}
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre, ramo, amigurumi, SKU..."
                    value={prodSearch}
                    onChange={(e) => setProdSearch(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 text-xs border border-gray-200 rounded-xl font-quicksand text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D]"
                  />
                  {prodSearch && (
                    <button
                      type="button"
                      onClick={() => setProdSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Lista de productos para agregar (Siempre visible para facilitar la selección) */}
                <div className="border border-gray-200 rounded-xl bg-white overflow-hidden shadow-2xs">
                  <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between text-[11px] font-quicksand font-bold text-gray-500">
                    <span>
                      {prodSearch.trim()
                        ? `Resultados para "${prodSearch}":`
                        : "Catálogo disponible (clic en '+' para agregar):"}
                    </span>
                    {loadingCatalog && (
                      <span className="flex items-center gap-1 text-[#EE6B8D]">
                        <Loader2 size={11} className="animate-spin" />
                        <span>Cargando...</span>
                      </span>
                    )}
                  </div>

                  <div className="max-h-48 overflow-y-auto divide-y divide-gray-100">
                    {loadingCatalog && filteredProducts.length === 0 ? (
                      <div className="p-4 text-center text-xs text-gray-400 font-quicksand flex items-center justify-center gap-2">
                        <Loader2 size={14} className="animate-spin text-[#EE6B8D]" />
                        <span>Cargando productos de la tienda...</span>
                      </div>
                    ) : filteredProducts.length === 0 ? (
                      <div className="p-3.5 text-center text-xs text-gray-500 font-quicksand space-y-2">
                        <p>No se encontraron productos con &quot;{prodSearch}&quot;</p>
                        <button
                          type="button"
                          onClick={() => {
                            setCustomNombre(prodSearch.trim());
                            setShowCustomForm(true);
                          }}
                          className="px-3 py-1 bg-pink-100 hover:bg-pink-200 text-[#C04267] rounded-lg font-bold text-xs inline-flex items-center gap-1 transition-colors"
                        >
                          <Plus size={12} />
                          <span>Crear &quot;{prodSearch}&quot; como ítem libre</span>
                        </button>
                      </div>
                    ) : (
                      filteredProducts.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between p-2 hover:bg-pink-50/50 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            {p.imagen ? (
                              <img
                                src={p.imagen}
                                alt=""
                                className="w-8 h-8 rounded-lg object-cover bg-gray-100 shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-pink-100 text-[#C04267] flex items-center justify-center text-[10px] font-bold shrink-0">
                                {p.sku?.substring(0, 3) || "EH"}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-quicksand text-xs font-semibold text-gray-800 truncate">
                                {p.nombre}
                              </p>
                              <p className="font-quicksand text-[10px] text-gray-400">
                                {p.sku ? `[${p.sku}] · ` : ""}S/ {Number(p.precio).toFixed(2)}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleQuickAddProduct(p)}
                            className="px-2.5 py-1 bg-[#EE6B8D] hover:bg-[#C04267] text-white text-xs font-quicksand font-bold rounded-lg flex items-center gap-1 shrink-0 transition-colors shadow-2xs"
                          >
                            <Plus size={12} />
                            <span>Agregar</span>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Lista de productos agregados al pedido */}
              <div>
                <label className="block font-quicksand text-[11px] font-bold text-gray-600 mb-1.5">
                  Productos seleccionados ({items.length})
                </label>
                {items.length === 0 ? (
                  <div className="p-4 text-center border-2 border-dashed border-gray-200 rounded-xl text-gray-400 font-quicksand text-xs">
                    Busca un producto arriba o crea uno personalizado para añadirlo a este pedido.
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 max-h-44 overflow-y-auto bg-white">
                    {items.map((it, idx) => (
                      <div
                        key={it.id || idx}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 gap-2 hover:bg-gray-50/60"
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-1 flex-1">
                          {it.imagen ? (
                            <img
                              src={it.imagen}
                              alt=""
                              className="w-9 h-9 rounded-lg object-cover bg-gray-100 shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-pink-50 text-[#C04267] flex items-center justify-center shrink-0 text-[10px] font-bold">
                              {it.esPersonalizado ? "Esp" : "Prod"}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-quicksand text-xs font-bold text-gray-800 truncate">
                              {it.nombre}
                            </p>
                            <p className="font-quicksand text-[11px] text-gray-500">
                              S/ {it.precio.toFixed(2)} c/u
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 w-full sm:w-auto pt-1.5 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                          {/* Controles de cantidad (-) num (+) */}
                          <div className="flex items-center border border-gray-200 rounded-lg bg-gray-50 overflow-hidden">
                            <button
                              type="button"
                              onClick={() => handleUpdateCantidad(idx, -1)}
                              className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
                            >
                              <Minus size={12} />
                            </button>
                            <span className="w-8 text-center font-quicksand text-xs font-bold text-gray-800">
                              {it.cantidad}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateCantidad(idx, 1)}
                              className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
                            >
                              <Plus size={12} />
                            </button>
                          </div>

                          <span className="font-quicksand text-xs font-bold text-gray-900 min-w-16 text-right">
                            S/ {(it.precio * it.cantidad).toFixed(2)}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Cobros y Pagos Inteligentes (1 clic para seña/adelanto) */}
              <div className="bg-gray-50/80 p-3 sm:p-4 rounded-xl border border-gray-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-quicksand text-xs font-bold uppercase tracking-wider text-gray-500">
                    Cálculo y Pagos
                  </span>
                  <div className="text-right">
                    <span className="text-[10px] text-gray-400 font-quicksand block leading-none">
                      Total a Cobrar
                    </span>
                    <span className="font-fredoka text-lg font-bold text-[#C04267]">
                      S/ {totalCalculado.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Atajos de Seña / Adelanto */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-quicksand font-bold text-gray-700">
                      Adelanto recibido:
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleSetAdelantoPreset("cero")}
                        className="px-2 py-0.5 bg-white border border-gray-200 rounded text-[10px] font-quicksand font-semibold text-gray-600 hover:bg-gray-100"
                      >
                        S/ 0
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetAdelantoPreset("mitad")}
                        className="px-2 py-0.5 bg-white border border-pink-200 rounded text-[10px] font-quicksand font-bold text-[#C04267] hover:bg-pink-50"
                      >
                        50% Seña
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetAdelantoPreset("total")}
                        className="px-2 py-0.5 bg-white border border-green-200 rounded text-[10px] font-quicksand font-bold text-green-700 hover:bg-green-50"
                      >
                        100% Pagado
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 font-quicksand text-xs">
                        S/
                      </span>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        placeholder="0.00"
                        value={adelanto}
                        onChange={(e) => setAdelanto(e.target.value)}
                        className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg font-quicksand font-bold text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D]"
                      />
                    </div>

                    <div
                      className={`px-3 py-1.5 rounded-lg border text-xs font-quicksand font-bold flex items-center justify-between ${
                        saldoPendiente > 0
                          ? "bg-amber-50 border-amber-200 text-amber-800"
                          : "bg-green-50 border-green-200 text-green-800"
                      }`}
                    >
                      <span className="text-[10px] uppercase">Saldo:</span>
                      <span>S/ {saldoPendiente.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Método de pago y Estado */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 items-end">
                  <PaymentMethodSelect
                    label="Método de Pago"
                    value={metodoPago}
                    onChange={setMetodoPago}
                    placement="top"
                  />

                  <div>
                    <label className="block text-[11px] font-quicksand font-bold text-gray-600 mb-1">
                      Estado Inicial
                    </label>
                    <select
                      value={estado}
                      onChange={(e) => setEstado(e.target.value)}
                      className="w-full px-3 py-2.5 text-xs border border-gray-200 rounded-xl font-quicksand font-semibold text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D] cursor-pointer"
                    >
                      <option value="pendiente">Agendado (Pendiente)</option>
                      <option value="confirmado">Confirmado</option>
                      <option value="en_produccion">En preparación (Tejiendo)</option>
                      <option value="listo">Listo para entrega</option>
                      <option value="entregado">Entregado</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>

        {/* Footer rápido */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-t border-gray-100 bg-gray-50/80 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-quicksand font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors border border-gray-200 bg-white"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSubmit}
            className="px-5 py-2 bg-[#EE6B8D] hover:bg-[#C04267] text-white rounded-xl font-quicksand font-bold text-xs flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            <span>{saving ? "Guardando..." : "Guardar Pedido Agendado"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

