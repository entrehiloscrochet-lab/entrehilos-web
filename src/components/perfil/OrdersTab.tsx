"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Calendar,
  Camera,
  Clock,
  Loader2,
  MapPin,
  Palette,
  Phone,
  RefreshCw,
  Ruler,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { useReviews } from "@/context/ReviewsContext";
import { useToast } from "@/components/Toast";
import RatingStars from "@/components/RatingStars";
import { PaymentBadge } from "@/components/admin/BrandControls";
import { OrderStepper } from "./OrderStepper";
import {
  ESTADOS_PEDIDO,
  WHATSAPP_BASE_URL,
  formatCurrency,
  formatearFechaEntrega,
  parseFotoUrls,
  parsePedidoItems,
  type FiltroPedidos,
  type Pedido,
  type PedidoItem,
  type PedidoPersonalizado,
} from "./types";

function CalificarProducto({
  item,
  nombreCliente,
}: {
  item: PedidoItem;
  nombreCliente: string;
}) {
  const { ratedByMe, submitRating, refresh } = useReviews();
  const { showToast } = useToast();
  const [estrellas, setEstrellas] = useState(0);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const yaCalificado = item?.id ? ratedByMe[item.id] : undefined;

  const handleEnviar = async () => {
    if (!item?.id || !item?.nombre) return;
    if (estrellas === 0) {
      showToast("Selecciona la cantidad de estrellas", "warning");
      return;
    }
    setEnviando(true);
    const res = await submitRating({
      producto_id: item.id,
      producto_sku: undefined,
      producto_nombre: item.nombre,
      nombre_cliente: nombreCliente || "Cliente",
      calificacion: estrellas,
      comentario: comentario.trim() || undefined,
    });
    setEnviando(false);
    if (res.ok) {
      showToast("Gracias por tu calificación. Se publicará tras revisión.", "success");
      refresh();
    } else {
      showToast(res.error || "Error al enviar la calificación", "error");
    }
  };

  if (yaCalificado) {
    return (
      <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-[#F0E2E7]">
        <RatingStars value={yaCalificado} size={15} />
        <p className="font-quicksand text-xs font-semibold text-[#C04267]">
          Ya calificaste este producto con {yaCalificado} estrella{yaCalificado !== 1 ? "s" : ""}.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-[#F0E2E7] pt-3">
      <p className="font-quicksand text-[11px] font-bold uppercase tracking-wider text-[#C04267] mb-2 flex items-center gap-1.5">
        <Star size={13} />
        Calificar producto recibido
      </p>
      <div className="flex items-center gap-3">
        <RatingStars value={estrellas} interactive size={22} onChange={setEstrellas} />
        {estrellas > 0 && (
          <span className="font-quicksand text-xs font-semibold text-gray-600 tabular-nums">
            {estrellas}/5 estrellas
          </span>
        )}
      </div>
      <textarea
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        placeholder="Comparte tu opinión sobre la confección y acabado (opcional)"
        rows={2}
        className="w-full mt-2 rounded-xl border border-[#E8D8DE] bg-white px-3.5 py-2 font-quicksand text-xs sm:text-sm outline-none focus:border-[#EE6B8D] focus:ring-3 focus:ring-[#EE6B8D]/15 resize-none"
      />
      <button
        type="button"
        onClick={handleEnviar}
        disabled={enviando}
        className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-full font-quicksand text-xs font-semibold text-white bg-[#EE6B8D] hover:bg-[#C04267] transition-colors cursor-pointer disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EE6B8D]"
      >
        {enviando ? <Loader2 size={13} className="animate-spin" /> : <Star size={13} />}
        Publicar calificación
      </button>
    </div>
  );
}

interface OrdersTabProps {
  loading: boolean;
  filtroPedidos: FiltroPedidos;
  onChangeFiltro: (f: FiltroPedidos) => void;
  pedidosAMostrar: Pedido[];
  persAMostrar: PedidoPersonalizado[];
  totalTodosPedidos: number;
  totalPedidosEnCurso: number;
  totalPedidosEntregados: number;
  totalPedidosCancelados: number;
  nombreUsuario: string;
  hasSavedPhone: boolean;
  onRefresh: () => void;
  onGoToProfile: () => void;
}

export function OrdersTab({
  loading,
  filtroPedidos,
  onChangeFiltro,
  pedidosAMostrar,
  persAMostrar,
  totalTodosPedidos,
  totalPedidosEnCurso,
  totalPedidosEntregados,
  totalPedidosCancelados,
  nombreUsuario,
  hasSavedPhone,
  onRefresh,
  onGoToProfile,
}: OrdersTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!lightboxUrl) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxUrl(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxUrl]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredPedidos = useMemo(() => {
    if (!normalizedQuery) return pedidosAMostrar;
    return pedidosAMostrar.filter((p) => {
      const idMatch = String(p.id).includes(normalizedQuery.replace("#", ""));
      const items = parsePedidoItems(p.items);
      const itemMatch = items.some((it) =>
        (it.nombre || "").toLowerCase().includes(normalizedQuery)
      );
      const dirMatch = (p.direccion_envio || "").toLowerCase().includes(normalizedQuery);
      return idMatch || itemMatch || dirMatch;
    });
  }, [pedidosAMostrar, normalizedQuery]);

  const filteredPers = useMemo(() => {
    if (!normalizedQuery) return persAMostrar;
    return persAMostrar.filter((p) => {
      const idMatch = String(p.id).includes(normalizedQuery.replace("#", ""));
      const prodMatch = (p.producto_nombre || "").toLowerCase().includes(normalizedQuery);
      const detMatch = (p.detalles || "").toLowerCase().includes(normalizedQuery);
      return idMatch || prodMatch || detMatch;
    });
  }, [persAMostrar, normalizedQuery]);

  const filterOptions: { id: FiltroPedidos; label: string; count: number }[] = [
    { id: "todos", label: "Todos", count: totalTodosPedidos },
    { id: "en_curso", label: "En curso", count: totalPedidosEnCurso },
    { id: "entregados", label: "Entregados", count: totalPedidosEntregados },
    ...(totalPedidosCancelados > 0
      ? [{ id: "cancelados" as const, label: "Cancelados", count: totalPedidosCancelados }]
      : []),
  ];

  const hasResults = filteredPedidos.length > 0 || filteredPers.length > 0;

  return (
    <div className="space-y-5">
      {/* Controles de filtro en 1 sola fila compacta + buscador */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Filtrar pedidos por estado"
          className={`grid ${
            totalPedidosCancelados > 0 ? "grid-cols-2 sm:flex" : "grid-cols-3 sm:inline-flex"
          } gap-1 bg-white border border-[#F0E2E7] p-1 rounded-2xl shadow-2xs w-full sm:w-auto`}
        >
          {filterOptions.map((opt) => {
            const active = filtroPedidos === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onChangeFiltro(opt.id)}
                className={`inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl font-quicksand text-xs font-semibold transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EE6B8D] ${
                  active
                    ? "bg-[#C04267] text-white shadow-xs"
                    : "text-gray-600 hover:text-gray-900 hover:bg-[#FCF6F8]"
                }`}
              >
                <span className="truncate">{opt.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[11px] font-bold tabular-nums ${
                    active ? "bg-white/20 text-white" : "bg-[#FAF0F4] text-[#C04267]"
                  }`}
                >
                  {opt.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {totalTodosPedidos > 0 && (
            <div className="relative flex-1 sm:w-60">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar #ID o producto..."
                aria-label="Buscar pedido por ID o producto"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E8D8DE] bg-white font-quicksand text-xs sm:text-sm text-gray-800 placeholder:text-gray-400 outline-none focus:border-[#EE6B8D] focus:ring-3 focus:ring-[#EE6B8D]/15"
              />
            </div>
          )}

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            aria-label="Actualizar pedidos"
            title="Actualizar pedidos"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-[#F0E2E7] bg-white hover:bg-[#FDF2F5] text-gray-600 hover:text-[#C04267] font-quicksand text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EE6B8D]"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-[#EE6B8D]" : ""} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>
        </div>
      </div>

      {/* Lista / Estado vacío */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-[#F0E2E7] p-14 flex flex-col items-center justify-center gap-3">
          <Loader2 size={28} className="animate-spin text-[#EE6B8D]" />
          <p className="font-quicksand text-xs text-gray-500">Cargando tus pedidos...</p>
        </div>
      ) : !hasResults ? (
        <div className="bg-white rounded-2xl border border-[#F0E2E7] p-6 sm:p-10 text-center space-y-5 shadow-[0_2px_12px_rgba(192,66,103,0.03)]">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[#FDF0F4] to-[#F9DCE6] border border-[#F3CCD9] flex items-center justify-center text-[#C04267]">
            <ShoppingBag size={28} />
          </div>

          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="font-fredoka text-lg sm:text-xl font-bold text-gray-800">
              {normalizedQuery
                ? `Sin resultados para "${searchQuery.trim()}"`
                : filtroPedidos === "en_curso"
                ? "No tienes pedidos en curso actualmente"
                : filtroPedidos === "entregados"
                ? "Aún no tienes pedidos entregados"
                : filtroPedidos === "cancelados"
                ? "No tienes pedidos cancelados"
                : "Aún no tienes compras registradas"}
            </h3>
            <p className="font-quicksand text-xs sm:text-sm text-gray-500 leading-relaxed">
              {normalizedQuery
                ? "Prueba buscando con otro número de orden o nombre de producto."
                : "Explora nuestras colecciones tejidas a mano o solicita un diseño 100% personalizado."}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-1">
            {normalizedQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-2.5 rounded-full font-quicksand text-xs sm:text-sm font-semibold text-white bg-[#C04267] hover:bg-[#A63558] transition-colors cursor-pointer"
              >
                Limpiar búsqueda
              </button>
            ) : (
              <>
                <Link
                  href="/"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full font-quicksand text-xs sm:text-sm font-semibold text-white bg-[#C04267] hover:bg-[#A63558] transition-colors shadow-xs"
                >
                  Explorar catálogo
                  <ArrowUpRight size={15} />
                </Link>
                <Link
                  href="/personalizados"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full font-quicksand text-xs sm:text-sm font-semibold text-[#C04267] bg-[#FDF2F5] hover:bg-[#FAE3EA] border border-[#F3D1DC] transition-colors"
                >
                  <Sparkles size={14} />
                  Cotizar personalizado
                </Link>
              </>
            )}
          </div>

          {totalTodosPedidos === 0 && !hasSavedPhone && (
            <div className="max-w-lg mx-auto mt-2 p-3.5 rounded-xl bg-[#FCF8FA] border border-[#EFE1E6] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-left">
              <div className="flex items-start gap-2.5">
                <Phone size={15} className="text-[#C04267] shrink-0 mt-0.5" />
                <p className="font-quicksand text-xs text-gray-600 leading-relaxed">
                  ¿Compraste por WhatsApp antes? Guarda tu número en <strong>Mi perfil</strong> para vincular esos pedidos aquí automáticamente.
                </p>
              </div>
              <button
                type="button"
                onClick={onGoToProfile}
                className="shrink-0 font-quicksand text-xs font-bold text-[#C04267] hover:underline cursor-pointer"
              >
                Completar teléfono →
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Pedidos estándar */}
          {filteredPedidos.map((p) => {
            const estKey = (p.estado || "pendiente").toLowerCase();
            const estadoConfig = ESTADOS_PEDIDO[estKey] || ESTADOS_PEDIDO.pendiente;
            const EstadoIcon = estadoConfig.icon;
            const estaEntregado = estKey === "entregado";
            const itemsPedido = parsePedidoItems(p.items);
            const fotosEntrega = parseFotoUrls(p.fotos_entrega);

            return (
              <article
                key={`pd-${p.id}`}
                className="bg-white rounded-2xl border border-[#F0E2E7] p-4 sm:p-6 shadow-[0_2px_12px_rgba(192,66,103,0.03)] space-y-4"
              >
                {/* Header Pedido */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3.5 border-b border-[#F4E9ED]">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-fredoka text-lg font-bold text-gray-900">
                        Pedido #{p.id}
                      </h3>
                      <span
                        className={`inline-flex items-center gap-1.5 font-quicksand text-xs font-semibold px-2.5 py-0.5 rounded-full border ${estadoConfig.color}`}
                      >
                        <EstadoIcon size={12} />
                        {estadoConfig.label}
                      </span>
                      {p.origen && p.origen !== "tienda" && (
                        <span className="inline-flex items-center font-quicksand text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#FAF6F8] text-gray-600 border border-[#E8D8DE] capitalize">
                          Via {p.origen}
                        </span>
                      )}
                    </div>
                    <p className="font-quicksand text-xs text-gray-500">
                      Registrado el{" "}
                      {new Date(p.created_at).toLocaleDateString("es-PE", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>

                  <div className="flex sm:flex-col items-baseline sm:items-end justify-between sm:justify-start gap-2 pt-1 sm:pt-0">
                    <span className="font-quicksand text-xs text-gray-400">Total del pedido</span>
                    <span className="font-fredoka text-xl font-bold text-[#C04267] tabular-nums">
                      {formatCurrency(p.total)}
                    </span>
                  </div>
                </div>

                {/* Stepper */}
                <OrderStepper estado={p.estado} />

                {/* Metadatos de entrega y pago */}
                {(p.direccion_envio || p.fecha_entrega || p.metodo_pago || Number(p.adelanto) > 0) && (
                  <div className="flex flex-wrap gap-2">
                    {p.direccion_envio && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FCF8FA] rounded-xl text-xs font-quicksand text-gray-700 border border-[#EFE1E6] max-w-full">
                        <MapPin size={13} className="text-[#C04267] shrink-0" />
                        <span className="break-words">{p.direccion_envio}</span>
                      </div>
                    )}
                    {p.fecha_entrega && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FCF8FA] rounded-xl text-xs font-quicksand text-gray-700 border border-[#EFE1E6]">
                        <Calendar size={13} className="text-[#C04267] shrink-0" />
                        <span>
                          Entrega: {formatearFechaEntrega(p.fecha_entrega)}
                          {p.hora_entrega ? ` · ${p.hora_entrega}` : ""}
                        </span>
                      </div>
                    )}
                    {p.metodo_pago && <PaymentBadge method={p.metodo_pago} size="xs" />}
                    {Number(p.saldo_pendiente) > 0 && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 rounded-xl text-xs font-quicksand font-semibold text-amber-800 border border-amber-200 tabular-nums">
                        Saldo pendiente: {formatCurrency(p.saldo_pendiente)}
                      </div>
                    )}
                  </div>
                )}

                {/* Fotos de entrega (cuando existan) */}
                {fotosEntrega.length > 0 && (
                  <div className="space-y-2">
                    <p className="font-quicksand text-[11px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                      <Camera size={13} className="text-[#C04267]" />
                      Evidencia de tu pedido terminado
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {fotosEntrega.map((url, idx) => (
                        <button
                          key={`${p.id}-foto-${idx}`}
                          type="button"
                          onClick={() => setLightboxUrl(url)}
                          className="group relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border border-[#E8D8DE] bg-[#FCF8FA] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EE6B8D]"
                          aria-label={`Ver foto ${idx + 1} del pedido #${p.id}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`Foto ${idx + 1} del pedido ${p.id}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Detalle de productos */}
                {itemsPedido.length > 0 && (
                  <div className="space-y-2.5 pt-1">
                    <p className="font-quicksand text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      Detalle del pedido ({itemsPedido.length} artículo
                      {itemsPedido.length > 1 ? "s" : ""})
                    </p>
                    {itemsPedido.map((item, index) => (
                      <div
                        key={item.id || `${p.id}-${index}`}
                        className="p-3.5 sm:p-4 rounded-xl bg-[#FCF8FA] border border-[#EFE1E6]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-fredoka text-sm font-bold text-gray-800 break-words">
                              {item.nombre}
                            </p>
                            <p className="font-quicksand text-xs text-gray-500 mt-0.5 tabular-nums">
                              {item.cantidad || 1} unid. × {formatCurrency(item.precio)}
                            </p>
                          </div>
                          <span className="font-fredoka text-sm font-bold text-gray-900 shrink-0 tabular-nums">
                            {formatCurrency((item.precio || 0) * (item.cantidad || 1))}
                          </span>
                        </div>

                        {estaEntregado ? (
                          <CalificarProducto item={item} nombreCliente={nombreUsuario} />
                        ) : estKey !== "cancelado" ? (
                          <div className="mt-2.5 pt-2.5 border-t border-[#EFE1E6] flex items-center gap-1.5 text-[11px] text-gray-500 font-quicksand">
                            <Clock size={12} className="text-amber-600 shrink-0" />
                            <span>Podrás calificar este producto una vez que sea entregado.</span>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}

                {/* Footer WhatsApp */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[#F4E9ED]">
                  <a
                    href={`${WHATSAPP_BASE_URL}?text=${encodeURIComponent(
                      `Hola, quisiera consultar sobre mi Pedido #${p.id}`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-quicksand text-xs font-semibold text-[#C04267] hover:underline inline-flex items-center gap-1"
                  >
                    Consultar pedido #{p.id} por WhatsApp
                    <ArrowUpRight size={13} />
                  </a>
                </div>
              </article>
            );
          })}

          {/* Pedidos Personalizados */}
          {filteredPers.map((p) => {
            const estKey = (p.estado || "pendiente").toLowerCase();
            const estadoConfig = ESTADOS_PEDIDO[estKey] || ESTADOS_PEDIDO.pendiente;
            const EstadoIcon = estadoConfig.icon;
            const refImgs = parseFotoUrls(p.imagenes_url);

            return (
              <article
                key={`pc-${p.id}`}
                className="bg-white rounded-2xl border border-[#F0E2E7] p-4 sm:p-6 shadow-[0_2px_12px_rgba(192,66,103,0.03)] space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3.5 border-b border-[#F4E9ED]">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FDF2F5] text-[#C04267] border border-[#F4CED9] font-quicksand text-[11px] font-bold">
                        <Sparkles size={11} />
                        Personalizado
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 font-quicksand text-xs font-semibold px-2.5 py-0.5 rounded-full border ${estadoConfig.color}`}
                      >
                        <EstadoIcon size={12} />
                        {estadoConfig.label}
                      </span>
                    </div>
                    <h3 className="font-fredoka text-lg font-bold text-gray-900 pt-0.5">
                      {p.producto_nombre || `Solicitud personalizada #${p.id}`}
                    </h3>
                    <p className="font-quicksand text-xs text-gray-500">
                      Solicitado el{" "}
                      {new Date(p.created_at).toLocaleDateString("es-PE", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>

                  {Number(p.producto_precio) > 0 && (
                    <div className="flex sm:flex-col items-baseline sm:items-end justify-between gap-2">
                      <span className="font-quicksand text-xs text-gray-400">Precio acordado</span>
                      <span className="font-fredoka text-xl font-bold text-[#C04267] tabular-nums">
                        {formatCurrency(p.producto_precio)}
                      </span>
                    </div>
                  )}
                </div>

                <OrderStepper estado={p.estado} isPersonalizado />

                {p.detalles && (
                  <div className="p-3.5 bg-[#FCF8FA] rounded-xl border border-[#EFE1E6]">
                    <p className="font-quicksand text-xs sm:text-sm text-gray-700 leading-relaxed">
                      <strong className="text-gray-900">Detalles de diseño:</strong> {p.detalles}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {p.tamano && (
                    <span className="font-quicksand text-xs bg-[#FAF6F8] border border-[#E8D8DE] text-gray-700 px-3 py-1 rounded-full capitalize inline-flex items-center gap-1.5">
                      <Ruler size={12} className="text-[#C04267]" /> {p.tamano}
                    </span>
                  )}
                  {p.colores && (
                    <span className="font-quicksand text-xs bg-[#FAF6F8] border border-[#E8D8DE] text-gray-700 px-3 py-1 rounded-full inline-flex items-center gap-1.5">
                      <Palette size={12} className="text-[#C04267]" /> {p.colores}
                    </span>
                  )}
                  {p.fecha_entrega && (
                    <span className="font-quicksand text-xs bg-[#FAF6F8] border border-[#E8D8DE] text-gray-700 px-3 py-1 rounded-full inline-flex items-center gap-1.5">
                      <Calendar size={12} className="text-[#C04267]" />
                      Entrega: {formatearFechaEntrega(p.fecha_entrega)}
                      {p.hora_entrega ? ` · ${p.hora_entrega}` : ""}
                    </span>
                  )}
                </div>

                {refImgs.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {refImgs.map((url, idx) => (
                      <button
                        key={`pc-${p.id}-img-${idx}`}
                        type="button"
                        onClick={() => setLightboxUrl(url)}
                        className="w-16 h-16 rounded-xl overflow-hidden border border-[#E8D8DE] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EE6B8D]"
                        aria-label={`Ver imagen de referencia ${idx + 1}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`Referencia ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}

                <div className="pt-2 border-t border-[#F4E9ED]">
                  <a
                    href={`${WHATSAPP_BASE_URL}?text=${encodeURIComponent(
                      `Hola, quisiera consultar sobre mi pedido personalizado "${
                        p.producto_nombre || `#${p.id}`
                      }"`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-quicksand text-xs font-semibold text-[#C04267] hover:underline inline-flex items-center gap-1"
                  >
                    Coordinar detalles por WhatsApp
                    <ArrowUpRight size={13} />
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Lightbox accesible para fotos de entrega / referencias */}
      {lightboxUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Vista ampliada de imagen del pedido"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <div
            className="relative max-w-2xl w-full bg-white rounded-2xl p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxUrl(null)}
              aria-label="Cerrar vista ampliada"
              className="absolute -top-3 -right-3 w-9 h-9 rounded-full bg-white text-gray-700 shadow-lg border border-gray-200 flex items-center justify-center hover:bg-[#FDF2F5] hover:text-[#C04267] cursor-pointer"
            >
              <X size={18} />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxUrl}
              alt="Foto ampliada del pedido"
              className="w-full max-h-[80dvh] object-contain rounded-xl bg-[#FCF8FA]"
            />
          </div>
        </div>
      )}
    </div>
  );
}
