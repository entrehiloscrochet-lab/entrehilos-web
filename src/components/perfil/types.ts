import type { LucideIcon } from "lucide-react";
import { CheckCircle2, Clock, Sparkles, Truck, XCircle } from "lucide-react";

export type Tab = "perfil" | "pedidos" | "notificaciones";
export type FiltroPedidos = "todos" | "en_curso" | "entregados" | "cancelados";
export type FiltroNotif = "todos" | "no_leidos" | "leidos";

export const WHATSAPP_BASE_URL = "https://wa.me/51902578295";

export interface PedidoItem {
  id?: string;
  nombre?: string;
  precio?: number;
  cantidad?: number;
}

export interface ProfileData {
  nombre: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  departamento?: string | null;
  provincia?: string | null;
  distrito?: string | null;
  referencia?: string | null;
  localidad?: string | null;
  rol?: string | null;
}

export interface Pedido {
  id: number;
  created_at: string;
  cliente_nombre: string;
  cliente_telefono?: string;
  direccion_envio?: string;
  items: PedidoItem[] | string;
  total: number;
  estado: string;
  fecha_entrega?: string | null;
  hora_entrega?: string | null;
  adelanto?: number | null;
  saldo_pendiente?: number | null;
  metodo_pago?: string | null;
  origen?: string | null;
  notas?: string | null;
  fotos_entrega?: string[] | string | null;
}

export interface PedidoPersonalizado {
  id: number;
  created_at: string;
  producto_nombre: string | null;
  producto_precio?: number | null;
  detalles: string;
  colores?: string | null;
  tamano: string | null;
  extras: string | null;
  estado: string;
  fecha_entrega: string | null;
  hora_entrega?: string | null;
  imagenes_url?: string[] | string | null;
}

export interface Notificacion {
  id: string | number;
  pedido_id?: number;
  tipo: string;
  titulo: string;
  mensaje: string;
  created_at: string;
  leido?: boolean;
  es_personalizado?: boolean;
}

export interface EstadoConfig {
  label: string;
  color: string;
  dotColor: string;
  icon: LucideIcon;
}

export const ESTADOS_PEDIDO: Record<string, EstadoConfig> = {
  pendiente: {
    label: "Pendiente",
    color: "text-amber-800 bg-amber-50 border-amber-200/90",
    dotColor: "bg-amber-500",
    icon: Clock,
  },
  confirmado: {
    label: "Confirmado",
    color: "text-sky-800 bg-sky-50 border-sky-200/90",
    dotColor: "bg-sky-500",
    icon: CheckCircle2,
  },
  en_produccion: {
    label: "En taller",
    color: "text-indigo-800 bg-indigo-50 border-indigo-200/90",
    dotColor: "bg-indigo-500",
    icon: Sparkles,
  },
  listo: {
    label: "Listo para entrega",
    color: "text-teal-800 bg-teal-50 border-teal-200/90",
    dotColor: "bg-teal-500",
    icon: CheckCircle2,
  },
  enviado: {
    label: "En camino",
    color: "text-purple-800 bg-purple-50 border-purple-200/90",
    dotColor: "bg-purple-500",
    icon: Truck,
  },
  entregado: {
    label: "Entregado",
    color: "text-emerald-800 bg-emerald-50 border-emerald-200/90",
    dotColor: "bg-emerald-500",
    icon: CheckCircle2,
  },
  cancelado: {
    label: "Cancelado",
    color: "text-rose-800 bg-rose-50 border-rose-200/90",
    dotColor: "bg-rose-500",
    icon: XCircle,
  },
};

export function isPedidoEnCurso(estado?: string | null): boolean {
  const est = (estado || "pendiente").toLowerCase();
  return est !== "entregado" && est !== "cancelado";
}

export function formatearFechaEntrega(fecha: string | null | undefined): string {
  if (!fecha) return "";
  const soloFecha = String(fecha).split("T")[0].split(" ")[0].trim();
  const [y, m, d] = soloFecha.split("-").map(Number);
  if (!y || !m || !d) return soloFecha;
  return new Date(y, m - 1, d).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatCurrency(amount: number | string | null | undefined): string {
  const num = Number(amount);
  const safe = Number.isFinite(num) ? num : 0;
  return `S/ ${safe.toFixed(2)}`;
}

export function parsePedidoItems(items: PedidoItem[] | string | null | undefined): PedidoItem[] {
  if (Array.isArray(items)) return items;
  if (typeof items === "string" && items.trim()) {
    try {
      const parsed = JSON.parse(items);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function parseFotoUrls(raw: string[] | string | null | undefined): string[] {
  let list: unknown[] = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) list = parsed;
    } catch {
      return [];
    }
  }
  return list
    .filter((u): u is string => typeof u === "string")
    .map((u) => u.trim())
    .filter((u) => u.startsWith("https://") || u.startsWith("http://") || u.startsWith("/"));
}
