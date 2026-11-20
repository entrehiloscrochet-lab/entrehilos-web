"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, ShoppingBag, MessageSquare, ClipboardList, Mail,
  Image as ImageIcon, Users, LogOut, Home, Loader2, Eye, ExternalLink,
  UserCheck, Upload, X, Check, ChevronRight, Search, Plus, Trash2, Camera,
  Star, Package, Tag, Save, Calendar, Clock, CalendarCheck, AlertCircle, CheckCircle2,
  FileText, Download, FileDown, Layers, CheckSquare, Square, Pencil, Menu,
  PanelLeft, PanelLeftClose, Calculator, Boxes, ChevronDown, Award, type LucideIcon,
} from "lucide-react";

import {
  CATALOGOS_TIENDA,
  CatalogoDef,
  EVENTOS_BASE,
  getProductActiveSlugs,
  isProductInSlug,
  getSlugBadgeInfo,
  ProductoCatalogoAssignment,
  getDefaultProductSlugs,
} from "@/lib/catalogos";
import ProductFormModal from "@/components/admin/ProductFormModal";
import AgendarPedidoModal from "@/components/admin/AgendarPedidoModal";
import AgendarPersonalizadoModal from "@/components/admin/AgendarPersonalizadoModal";
import PedidosView from "@/components/admin/PedidosView";
import ProduccionMainView from "@/components/admin/produccion/ProduccionMainView";
import AdminInstallAppModal from "@/components/admin/AdminInstallAppModal";
import type { Product } from "@/lib/ventify";

type CampanaFoto = { url: string; titulo?: string; etiqueta?: string };

type CatalogImage = {
  id: string;
  title: string;
  price: number | null;
  image: string;
  categoria: string;
};

interface SectionItem {
  pregunta?: string;
  respuesta?: string;
  titulo?: string;
  descripcion?: string;
  imagen?: string | null;
  sku?: string;
  [key: string]: unknown;
}

interface SectionItems {
  badge?: string | null;
  titulo_linea1?: string | null;
  titulo_linea2?: string | null;
  boton_primario?: string | null;
  boton_primario_logged?: string | null;
  boton_secundario?: string | null;
  estadistica?: string | null;
  etiqueta_precio?: string | null;
  valor_precio?: string | null;
  [key: string]: unknown;
}

interface AdminProduct extends Product {
  title?: string | null;
  image?: string | null;
  price?: number | null;
}

interface EventoRotondaConfig {
  evento_slug?: string;
  limite?: number;
  [key: string]: unknown;
}

interface PrecioRow {
  sku?: string;
  precio_pequeno?: number | null;
  precio_mediano?: number | null;
  precio_grande?: number | null;
}

interface AdminRow {
  id: number | string;
  clave?: string;
  imagen_url?: string | null;
  imagen_url_mobile?: string | null;
  titulo?: string | null;
  subtitulo?: string | null;
  descripcion?: string | null;
  badge?: string | null;
  precio?: number | null;
  producto_sku?: string | null;
  tipo?: string | null;
  link_url?: string | null;
  link_text?: string | null;
  sku?: string;
  precio_pequeno?: number | null;
  precio_mediano?: number | null;
  precio_grande?: number | null;
  section_key?: string | null;
  activo?: boolean | null;
  items?: SectionItems | null;
  nombre?: string;
  slug?: string;
  label?: string;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  mostrar_en_hero?: boolean | null;
  featured?: boolean | null;
  catalogo_url?: string | null;
  destacado_rotonda?: boolean | null;
  fotos_campana?: (CampanaFoto | string)[] | null;
  leido?: boolean | null;
  aprobado?: boolean | null;
  estado?: string | null;
  cliente_nombre?: string | null;
  cliente_telefono?: string | null;
  total?: number | null;
  created_at?: string | null;
  producto_nombre?: string | null;
  nombre_cliente?: string | null;
  calificacion?: number | null;
  comentario?: string | null;
  es_manual?: boolean | null;
  [key: string]: unknown;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type MainTab = "dashboard" | "catalogo" | "pedidos" | "produccion" | "clientes" | "diseno" | "eventos" | "atencion";

type SubTab = "resumen" | "pedidos" | "personalizados" | "productos" | "precios" | "heroes" | "inicio" | "eventos" | "resenas" | "mensajes" | "reclamaciones" | "usuarios" | "top_clientes" | "suscriptores" | "catalogos" | "produccion_panel";

const SUBTABS_BY_MAIN: Record<MainTab, { id: SubTab; label: string; icon: LucideIcon; desc: string }[]> = {
  dashboard: [
    { id: "resumen", label: "Resumen General", icon: LayoutDashboard, desc: "Métricas y accesos rápidos" },
    { id: "heroes", label: "Banners (Heroes)", icon: ImageIcon, desc: "Carrusel principal y banners de colecciones" },
    { id: "inicio", label: "Secciones de Portada", icon: Home, desc: "Textos y bloques informativos de la portada" },
    { id: "eventos", label: "Eventos Especiales", icon: CalendarCheck, desc: "Campañas y fechas especiales activas" },
    { id: "catalogos", label: "Catálogo de Portada", icon: Layers, desc: "Elegir productos y carrusel de la portada" },
  ],
  catalogo: [
    { id: "productos", label: "Visibilidad de Productos", icon: Package, desc: "Activar o desactivar productos en la web" },
    { id: "precios", label: "Precios por Tamaño", icon: Tag, desc: "Precios pequeño, mediano y grande para amigurumis" },
    { id: "catalogos", label: "Catálogo de Portada", icon: Layers, desc: "Elegir productos y carrusel de la portada" },
  ],
  pedidos: [
    { id: "pedidos", label: "Pedidos de Tienda", icon: ShoppingBag, desc: "Pedidos recibidos desde el carrito o agendados" },
    { id: "personalizados", label: "Pedidos Personalizados", icon: Mail, desc: "Encargos y cotizaciones a medida" },
  ],
  produccion: [
    { id: "produccion_panel", label: "Gestión de Producción y Costos", icon: Calculator, desc: "BOM, escandallo, recetas, campañas y punto de equilibrio" },
  ],
  clientes: [
    { id: "top_clientes", label: "Top Clientes", icon: Award, desc: "Clientes frecuentes y de mayor valor en pedidos" },
    { id: "usuarios", label: "Usuarios Registrados", icon: UserCheck, desc: "Cuentas de clientes con perfil registrado" },
    { id: "mensajes", label: "Mensajes de Contacto", icon: MessageSquare, desc: "Consultas enviadas desde el formulario" },
    { id: "reclamaciones", label: "Libro de Reclamaciones", icon: ClipboardList, desc: "Reclamos y quejas formales de clientes" },
    { id: "resenas", label: "Reseñas y Calificaciones", icon: Star, desc: "Calificaciones de clientes y testimonios" },
    { id: "suscriptores", label: "Suscriptores del Boletín", icon: Users, desc: "Correos suscritos para novedades" },
  ],
  diseno: [
    { id: "heroes", label: "Banners (Heroes)", icon: ImageIcon, desc: "Carrusel principal y banners de colecciones" },
    { id: "inicio", label: "Secciones de Portada", icon: Home, desc: "Textos y bloques informativos de la portada" },
  ],
  eventos: [
    { id: "eventos", label: "Eventos Especiales", icon: CalendarCheck, desc: "Campañas y fechas especiales activas" },
    { id: "catalogos", label: "Catálogo de Portada", icon: Layers, desc: "Elegir productos y carrusel de la portada" },
  ],
  atencion: [
    { id: "mensajes", label: "Mensajes de Contacto", icon: MessageSquare, desc: "Consultas enviadas desde el formulario" },
    { id: "reclamaciones", label: "Libro de Reclamaciones", icon: ClipboardList, desc: "Reclamos y quejas formales de clientes" },
    { id: "resenas", label: "Reseñas y Calificaciones", icon: Star, desc: "Calificaciones de clientes y testimonios" },
  ],
};

const menuGroups: { id: MainTab; label: string; icon: LucideIcon; desc: string; defaultSubTab: SubTab }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, desc: "Métricas, banners y eventos", defaultSubTab: "resumen" },
  { id: "catalogo", label: "Catálogo", icon: Package, desc: "Productos activos y precios por tamaño", defaultSubTab: "productos" },
  { id: "pedidos", label: "Pedidos", icon: ShoppingBag, desc: "Pedidos de tienda y personalizados", defaultSubTab: "pedidos" },
  { id: "produccion", label: "Producción", icon: Calculator, desc: "Costeo unitario, BOM, ferias y break-even", defaultSubTab: "produccion_panel" },
  { id: "clientes", label: "Clientes", icon: Users, desc: "Usuarios, atención, mensajes y reseñas", defaultSubTab: "usuarios" },
];

const ALL_HERO_KEYS: { clave: string; label: string }[] = [
  { clave: "home_hero_1", label: "Inicio - Slide 1 (Flyer)" },
  { clave: "home_hero_2", label: "Inicio - Slide 2 (Especial)" },
  { clave: "home_hero_3", label: "Inicio - Slide 3 (Personajes)" },
  { clave: "home_hero_4", label: "Inicio - Slide 4 (A tu medida)" },
  { clave: "evento_dia_de_la_madre", label: "Día de la Madre" },
  { clave: "evento_dia_de_la_mujer", label: "Día de la Mujer" },
  { clave: "evento_san_valentin", label: "San Valentín" },
  { clave: "evento_dia_de_la_novia", label: "Día de la Novia" },
  { clave: "evento_flores_amarillas", label: "Flores Amarillas" },
  { clave: "evento_personalizados", label: "Personalizados" },
  { clave: "evento_hotwheels", label: "HotWheels" },
];

const PRODUCT_SLIDES = ['home_hero_2', 'home_hero_3', 'home_hero_4'];

function isProductSlide(clave: string) {
  return PRODUCT_SLIDES.includes(clave);
}

function formatDate(v: string | null | undefined) {
  if (!v) return "-";
  return new Date(v).toLocaleDateString("es-PE", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatValue(key: string, value: unknown) {
  if (value === null || value === undefined) return "-";
  if (key === "created_at" || key === "updated_at") return formatDate(value as string | null | undefined);
  if (key === "leido") return value ? "Sí" : "No";
  if (key === "activo") return value ? "Activo" : "Inactivo";
  if (typeof value === "object") {
    const s = JSON.stringify(value);
    return s.length > 80 ? s.substring(0, 80) + "…" : s;
  }
  return String(value);
}

function getColumns(data: AdminRow[]): string[] {
  if (data.length === 0) return [];
  return Object.keys(data[0]).filter((k) => k !== "id");
}

// ===== Filtros de productos (mismo orden/agrupación que la web) =====

const CATALOGO_FILTERS: { key: string; label: string }[] = [
  { key: "cat-ramos", label: "Ramos" },
  { key: "cat-amigurumis", label: "Amigurumis" },
  { key: "cat-cajas", label: "Cajas" },
  { key: "cat-hotwheels", label: "HotWheels" },
  { key: "ver-todo", label: "Ver Todo" },
];

const EVENTO_FILTERS: { key: string; label: string }[] = [
  { key: "evento-flores-amarillas", label: "Flores Amarillas" },
  { key: "evento-san-valentin", label: "San Valentín" },
  { key: "evento-dia-de-la-madre", label: "Día de la Madre" },
  { key: "evento-dia-de-la-mujer", label: "Día de la Mujer" },
  { key: "evento-dia-de-la-novia", label: "Día de la Novia" },
  { key: "evento-hotwheels", label: "HotWheels (Evento)" },
  { key: "evento-personalizados", label: "Personalizados" },
];

function filterByEventSlug(products: AdminProduct[], slug: string, assignments: ProductoCatalogoAssignment[] = []): AdminProduct[] {
  return products.filter((p) => isProductInSlug(p, slug, assignments));
}

async function fetchVentifyData(): Promise<{ all: AdminProduct[]; active: AdminProduct[]; inactiveIds: string[]; assignments: ProductoCatalogoAssignment[] }> {
  try {
    const res = await fetch("/api/ventify/products", { cache: "no-store" });
    if (!res.ok) return { all: [], active: [], inactiveIds: [], assignments: [] };
    return await res.json();
  } catch {
    return { all: [], active: [], inactiveIds: [], assignments: [] };
  }
}

function filterProductos(products: AdminProduct[], filter: string, assignments: ProductoCatalogoAssignment[] = []): AdminProduct[] {
  if (filter.startsWith("evento-")) {
    const slug = filter.replace("evento-", "");
    return filterByEventSlug(products, slug, assignments);
  }

  if (filter.startsWith("cat-")) {
    const slug = filter.replace("cat-", "");
    const list = products.filter((p) => isProductInSlug(p, slug, assignments));
    return slug === "ramos" ? list.sort((a, b) => b.stock - a.stock) : list;
  }

  switch (filter) {
    case "page-personalizados":
      return products.filter((p) => isProductInSlug(p, "personalizados", assignments));
    default:
      return [...products];
  }
}

export default function AdminPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  // Inicializar leyendo URL (seccion o tab) y localStorage
  const [mainTab, setMainTab] = useState<MainTab>(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      let tabQ = urlParams.get("seccion") || urlParams.get("tab");
      if (tabQ === "diseno" || tabQ === "eventos") tabQ = "dashboard";
      if (tabQ === "atencion") tabQ = "clientes";

      const validTabs: MainTab[] = ["dashboard", "catalogo", "pedidos", "produccion", "clientes"];
      if (tabQ && validTabs.includes(tabQ as MainTab)) return tabQ as MainTab;
      try {
        let saved = localStorage.getItem("admin_active_seccion");
        if (saved === "diseno" || saved === "eventos") saved = "dashboard";
        if (saved === "atencion") saved = "clientes";
        if (saved && validTabs.includes(saved as MainTab)) return saved as MainTab;
      } catch {}
    }
    return "dashboard";
  });

  const [subTab, setSubTab] = useState<SubTab>(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      let subQ = urlParams.get("sub") || urlParams.get("subtab");
      const rawTab = urlParams.get("seccion") || urlParams.get("tab");
      if (!subQ) {
        if (rawTab === "diseno") subQ = "heroes";
        else if (rawTab === "eventos") subQ = "eventos";
        else if (rawTab === "atencion") subQ = "mensajes";
      }
      if (subQ) return subQ as SubTab;
      try {
        const saved = localStorage.getItem("admin_active_subtab");
        if (saved) return saved as SubTab;
      } catch {}
    }
    return "resumen";
  });

  // Estados para Instalación de App PWA (solo visible para admin)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [isAppInstalled, setIsAppInstalled] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        window.matchMedia("(display-mode: fullscreen)").matches ||
        window.matchMedia("(display-mode: minimal-ui)").matches ||
        Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone) ||
        document.referrer.includes("android-app://");
      if (isStandalone) return true;
      try {
        return localStorage.getItem("admin_app_installed") === "true";
      } catch {}
    }
    return false;
  });

  // Función para cambiar de sección con sincronización en URL y localStorage
  const cambiarSeccion = useCallback((newMain: MainTab, newSub?: SubTab) => {
    setMainTab(newMain);
    const group = menuGroups.find((g) => g.id === newMain);
    const targetSub = newSub || group?.defaultSubTab || ("pedidos" as SubTab);
    setSubTab(targetSub);
    setSidebarOpen(false);

    try {
      localStorage.setItem("admin_active_seccion", newMain);
      if (targetSub) localStorage.setItem("admin_active_subtab", targetSub);

      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        params.set("seccion", newMain);
        if (newMain === "produccion") {
          // Mantener o recuperar subtab de produccion
          const prodSub = localStorage.getItem("admin_produccion_subtab") || "resumen";
          params.set("sub", prodSub);
        } else if (targetSub && targetSub !== group?.defaultSubTab) {
          params.set("sub", targetSub);
        } else {
          params.delete("sub");
        }
        window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
      }
    } catch {
      // ignore
    }
  }, []);

  // Función para cambiar subpestaña horizontal con sincronización
  const cambiarSubTab = useCallback((newSub: SubTab) => {
    setSubTab(newSub);
    try {
      localStorage.setItem("admin_active_subtab", newSub);
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        params.set("seccion", mainTab);
        params.set("sub", newSub);
        window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
      }
    } catch {
      // ignore
    }
  }, [mainTab]);
  const [data, setData] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("admin_sidebar_collapsed");
      if (saved !== null) return saved === "true";
      return window.innerWidth < 1024;
    }
    return false;
  });
  const [isMobile, setIsMobile] = useState(false);
  const [tempUploading, setTempUploading] = useState(false);
  const [tempUploadingMobile, setTempUploadingMobile] = useState(false);
  const [heroDragOver, setHeroDragOver] = useState<number | null>(null);
  const [editingHero, setEditingHero] = useState<{ clave: string; label: string } | undefined>(undefined);
  const [editUrl, setEditUrl] = useState("");
  const [editUrlMobile, setEditUrlMobile] = useState("");
  const [editTitulo, setEditTitulo] = useState("");
  const [editSubtitulo, setEditSubtitulo] = useState("");
  const [editDescripcion, setEditDescripcion] = useState("");
  const [editBadge, setEditBadge] = useState("");
  const [editPrecio, setEditPrecio] = useState("");
  const [editProductoSku, setEditProductoSku] = useState("");
  const [editTipo, setEditTipo] = useState("flyer");
  const [editLinkUrl, setEditLinkUrl] = useState("");
  const [allProducts, setAllProducts] = useState<AdminProduct[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [pickingProductFor, setPickingProductFor] = useState<number | null>(null);
  const [rawProducts, setRawProducts] = useState<AdminProduct[]>([]);
  const [inactiveIds, setInactiveIds] = useState<Set<string>>(new Set());
  const [productosSearch, setProductosSearch] = useState("");
  const [productosFilter, setProductosFilter] = useState("ver-todo");
  const [allCatalogos, setAllCatalogos] = useState<CatalogoDef[]>(CATALOGOS_TIENDA);
  const [customCatalogoSlugs, setCustomCatalogoSlugs] = useState<string[]>([]);
  const [catalogoManagerOpen, setCatalogoManagerOpen] = useState(false);
  const [newCatalogoNombre, setNewCatalogoNombre] = useState("");
  const [savingCatalogo, setSavingCatalogo] = useState(false);
  const [eventos, setEventos] = useState<AdminRow[]>([]);
  const [assignments, setAssignments] = useState<ProductoCatalogoAssignment[]>([]);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProductItem, setEditingProductItem] = useState<AdminProduct | null>(null);
  const [agendarModalOpen, setAgendarModalOpen] = useState(false);
  const [personalizadoModalOpen, setPersonalizadoModalOpen] = useState(false);
  const [editingProductoCatalogos, setEditingProductoCatalogos] = useState<AdminProduct | null>(null);
  const [selectedSlugsForProducto, setSelectedSlugsForProducto] = useState<string[]>([]);
  const [savingCatalogos, setSavingCatalogos] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkTargetSlug, setBulkTargetSlug] = useState("ramos");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [openFilterDropdown, setOpenFilterDropdown] = useState<"catalogo" | "eventos" | "paginas" | null>(null);
  const filterDropdownRef = useRef<HTMLDivElement | null>(null);
  const [portadaDropdownOpen, setPortadaDropdownOpen] = useState<"filtro" | "acciones" | null>(null);
  const portadaDropdownRef = useRef<HTMLDivElement | null>(null);
  const [resenaPickerOpen, setResenaPickerOpen] = useState(false);
  const [clientesDirectory, setClientesDirectory] = useState<
    Array<{ id: string; nombre: string; telefono?: string; email?: string; direccion?: string; origen?: string }>
  >([]);
  const [resenaClientMode, setResenaClientMode] = useState<"existente" | "nuevo">("existente");
  const [resenaClientSearch, setResenaClientSearch] = useState("");
  const [resenaClientDropdownOpen, setResenaClientDropdownOpen] = useState(false);
  const [resenaClienteTelefono, setResenaClienteTelefono] = useState("");
  const [resenaClienteDireccion, setResenaClienteDireccion] = useState("");
  const [resenaGuardarCliente, setResenaGuardarCliente] = useState(true);
  const [topClientesSort, setTopClientesSort] = useState<"pedidos" | "valor" | "recientes">("pedidos");
  const [topClientesSearch, setTopClientesSearch] = useState("");
  const [expandedCardSlugs, setExpandedCardSlugs] = useState<Set<string>>(new Set());
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<
    { mode: "single"; product: AdminProduct } | { mode: "bulk"; ids: string[] } | null
  >(null);
  const [deletingProducts, setDeletingProducts] = useState(false);
  const [amiguProducts, setAmiguProducts] = useState<AdminProduct[]>([]);
  const [preciosRows, setPreciosRows] = useState<Record<string, PrecioRow>>({});
  const [preciosDraft, setPreciosDraft] = useState<Record<string, { pequeno: string; mediano: string; grande: string }>>({});
  const [preciosSaving, setPreciosSaving] = useState<string | null>(null);
  const tempFileRef = useRef<HTMLInputElement | null>(null);
  const tempFileRefMobile = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!openFilterDropdown && !portadaDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (openFilterDropdown && filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) {
        setOpenFilterDropdown(null);
      }
      if (portadaDropdownOpen && portadaDropdownRef.current && !portadaDropdownRef.current.contains(e.target as Node)) {
        setPortadaDropdownOpen(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenFilterDropdown(null);
        setPortadaDropdownOpen(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openFilterDropdown, portadaDropdownOpen]);
  const sectionImgRef = useRef<HTMLInputElement | null>(null);
  const eventoImgRef = useRef<HTMLInputElement | null>(null);
  const [eventoImgUploading, setEventoImgUploading] = useState(false);

  // Estados para Catálogo de Portada (Elegir productos y subir imágenes)
  const [portadaEventoSlug, setPortadaEventoSlug] = useState<string>("auto");
  const [portadaSelectedIds, setPortadaSelectedIds] = useState<Set<string>>(new Set());
  const [portadaCustomImages, setPortadaCustomImages] = useState<CatalogImage[]>([]);
  const [portadaSaving, setPortadaSaving] = useState(false);
  const [portadaTab, setPortadaTab] = useState<"productos" | "imagenes">("productos");
  const [portadaProductSearch, setPortadaProductSearch] = useState("");
  const [uploadingPortadaImg, setUploadingPortadaImg] = useState(false);
  const [newCatalogImgTitle, setNewCatalogImgTitle] = useState("");
  const [newCatalogImgPrice, setNewCatalogImgPrice] = useState("");
  const [newCatalogImgUrl, setNewCatalogImgUrl] = useState("");
  const [newCatalogImgCategoria, setNewCatalogImgCategoria] = useState("");
  const [portadaCategoryFilter, setPortadaCategoryFilter] = useState<string>("evento");
  const [portadaActivo, setPortadaActivo] = useState(true);
  const [portadaSectionId, setPortadaSectionId] = useState<number | null>(null);

  const [editingEvento, setEditingEvento] = useState<AdminRow | null>(null);
  const [editEventoNombre, setEditEventoNombre] = useState("");
  const [editEventoSlug, setEditEventoSlug] = useState("");
  const [editEventoDescripcion, setEditEventoDescripcion] = useState("");
  const [editEventoImagen, setEditEventoImagen] = useState("");
  const [editEventoImagenMobile, setEditEventoImagenMobile] = useState("");
  const [editEventoDiaInicio, setEditEventoDiaInicio] = useState("");
  const [editEventoMesInicio, setEditEventoMesInicio] = useState("");
  const [editEventoDiaFin, setEditEventoDiaFin] = useState("");
  const [editEventoMesFin, setEditEventoMesFin] = useState("");
  const [editEventoMostrarEnHero, setEditEventoMostrarEnHero] = useState(true);
  const [editEventoActivo, setEditEventoActivo] = useState(true);
  const [editEventoFeatured, setEditEventoFeatured] = useState(false);
  const [editEventoModoInicio, setEditEventoModoInicio] = useState<"auto" | "manual">("auto");
  const [selectedPrevEventoId, setSelectedPrevEventoId] = useState<string | number | null>(null);
  const [isNewEvento, setIsNewEvento] = useState(false);
  const eventoImgMobileRef = useRef<HTMLInputElement | null>(null);
  const [eventoImgMobileUploading, setEventoImgMobileUploading] = useState(false);
  const [editEventoFotosCampana, setEditEventoFotosCampana] = useState<(CampanaFoto | string)[]>([]);
  const [uploadingCampanaIdx, setUploadingCampanaIdx] = useState<number | null>(null);
  const [uploadingCollageEventoId, setUploadingCollageEventoId] = useState<string | number | null>(null);
  const [editEventoCatalogoUrl, setEditEventoCatalogoUrl] = useState("");
  const [editEventoDestacadoRotonda, setEditEventoDestacadoRotonda] = useState(false);
  const [uploadingCatalogo, setUploadingCatalogo] = useState(false);

  const [showResenaForm, setShowResenaForm] = useState(false);
  const [resenaSearch, setResenaSearch] = useState("");
  const [resenaProducto, setResenaProducto] = useState<AdminProduct | null>(null);
  const [resenaNombre, setResenaNombre] = useState("");
  const [resenaCalificacion, setResenaCalificacion] = useState(0);
  const [resenaComentario, setResenaComentario] = useState("");

  const [editingSection, setEditingSection] = useState<AdminRow | null>(null);
  const [sectionTitulo, setSectionTitulo] = useState("");
  const [sectionSubtitulo, setSectionSubtitulo] = useState("");
  const [sectionDescripcion, setSectionDescripcion] = useState("");
  const [sectionImagenUrl, setSectionImagenUrl] = useState("");
  const [sectionLinkUrl, setSectionLinkUrl] = useState("");
  const [sectionLinkText, setSectionLinkText] = useState("");
  const [sectionItems, setSectionItems] = useState("");

  const [persBadge, setPersBadge] = useState("");
  const [persTituloLinea1, setPersTituloLinea1] = useState("");
  const [persTituloLinea2, setPersTituloLinea2] = useState("");
  const [persBotonPrimario, setPersBotonPrimario] = useState("");
  const [persBotonPrimarioLogged, setPersBotonPrimarioLogged] = useState("");
  const [persBotonSecundario, setPersBotonSecundario] = useState("");
  const [persEstadistica, setPersEstadistica] = useState("");
  const [persEtiquetaPrecio, setPersEtiquetaPrecio] = useState("");
  const [persValorPrecio, setPersValorPrecio] = useState("");

  const selectedClave = editingHero?.clave ?? "";
  const existingHero = data.find((h) => h.clave === selectedClave);
  const isNewHero = !existingHero;

  function esUrlImagen(text: string): boolean {
    const t = text.trim();
    if (!t.startsWith("http://") && !t.startsWith("https://") && !t.startsWith("/")) return false;
    if (/\.(jpe?g|png|gif|webp|bmp|avif|svg)(\?\S*)?$/i.test(t)) return true;
    if (/^https?:\/\//.test(t)) return true;
    return false;
  }

  async function subirHeroFileTemp(file: File) {
    setTempUploading(true);
    try {
      const { getSupabaseBrowserClient } = await import("@/lib/supabase/client");
      const supabase = getSupabaseBrowserClient();
      const ext = file.name.split(".").pop() || "jpg";
      const nombre = `hero-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("heroes").upload(nombre, file, { upsert: true });
      if (error) { console.error(error); return; }
      const { data: pub } = supabase.storage.from("heroes").getPublicUrl(nombre);
      setEditUrl(pub.publicUrl);
    } catch (e) { console.error(e); }
    finally { setTempUploading(false); }
  }

  async function subirSectionImg(file: File) {
    setTempUploading(true);
    try {
      const { getSupabaseBrowserClient } = await import("@/lib/supabase/client");
      const supabase = getSupabaseBrowserClient();
      const ext = file.name.split(".").pop() || "jpg";
      const nombre = `section-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("heroes").upload(nombre, file, { upsert: true });
      if (error) { console.error(error); return; }
      const { data: pub } = supabase.storage.from("heroes").getPublicUrl(nombre);
      setSectionImagenUrl(pub.publicUrl);
    } catch (e) { console.error(e); }
    finally { setTempUploading(false); }
  }

  async function subirHeroFileTempMobile(file: File) {
    setTempUploadingMobile(true);
    try {
      const { getSupabaseBrowserClient } = await import("@/lib/supabase/client");
      const supabase = getSupabaseBrowserClient();
      const ext = file.name.split(".").pop() || "jpg";
      const nombre = `hero-mobile-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("heroes").upload(nombre, file, { upsert: true });
      if (error) { console.error(error); return; }
      const { data: pub } = supabase.storage.from("heroes").getPublicUrl(nombre);
      setEditUrlMobile(pub.publicUrl);
    } catch (e) { console.error(e); }
    finally { setTempUploadingMobile(false); }
  }

  async function subirEventoImg(file: File) {
    setEventoImgUploading(true);
    try {
      const { getSupabaseBrowserClient } = await import("@/lib/supabase/client");
      const supabase = getSupabaseBrowserClient();
      const ext = file.name.split(".").pop() || "jpg";
      const nombre = `evento-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("heroes").upload(nombre, file, { upsert: true });
      if (error) { console.error(error); return; }
      const { data: pub } = supabase.storage.from("heroes").getPublicUrl(nombre);
      setEditEventoImagen(pub.publicUrl);
    } catch (e) { console.error(e); }
    finally { setEventoImgUploading(false); }
  }

  async function subirEventoImgMobile(file: File) {
    setEventoImgMobileUploading(true);
    try {
      const { getSupabaseBrowserClient } = await import("@/lib/supabase/client");
      const supabase = getSupabaseBrowserClient();
      const ext = file.name.split(".").pop() || "jpg";
      const nombre = `evento-mobile-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("heroes").upload(nombre, file, { upsert: true });
      if (error) { console.error(error); return; }
      const { data: pub } = supabase.storage.from("heroes").getPublicUrl(nombre);
      setEditEventoImagenMobile(pub.publicUrl);
    } catch (e) { console.error(e); }
    finally { setEventoImgMobileUploading(false); }
  }

  async function subirFotoCampana(file: File, index: number) {
    setUploadingCampanaIdx(index);
    try {
      const { getSupabaseBrowserClient } = await import("@/lib/supabase/client");
      const supabase = getSupabaseBrowserClient();
      const ext = file.name.split(".").pop() || "jpg";
      const nombre = `campana-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("heroes").upload(nombre, file, { upsert: true });
      if (error) { console.error(error); return; }
      const { data: pub } = supabase.storage.from("heroes").getPublicUrl(nombre);
      setEditEventoFotosCampana((prev) => {
        const arr = [...(prev || [])];
        while (arr.length <= index) arr.push({ url: "", titulo: "", etiqueta: "" });
        const current = typeof arr[index] === "string" ? { url: arr[index] } : { ...arr[index] };
        arr[index] = { ...current, url: pub.publicUrl };
        return arr;
      });
    } catch (e) { console.error(e); }
    finally { setUploadingCampanaIdx(null); }
  }

  function updateFotoCampana(index: number, patch: Partial<CampanaFoto>) {
    setEditEventoFotosCampana((prev) => {
      const arr = [...(prev || [])];
      while (arr.length <= index) arr.push({ url: "", titulo: "", etiqueta: "" });
      const current = typeof arr[index] === "string" ? { url: arr[index] } : { ...arr[index] };
      arr[index] = { ...current, ...patch };
      return arr;
    });
  }

  function removeFotoCampana(index: number) {
    setEditEventoFotosCampana((prev) => {
      const arr = [...(prev || [])];
      if (index < arr.length) {
        arr[index] = { url: "", titulo: "", etiqueta: "" };
      }
      return arr;
    });
  }

  async function subirCollageSimultaneo(eventoId: string | number, files: File[]) {
    if (!files || files.length === 0) return;
    setUploadingCollageEventoId(eventoId);
    try {
      const { getSupabaseBrowserClient } = await import("@/lib/supabase/client");
      const supabase = getSupabaseBrowserClient();

      const uploadPromises = files.map(async (file, idx) => {
        const ext = file.name.split(".").pop() || "jpg";
        const nombre = `campana-${eventoId}-${Date.now()}-${idx}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from("heroes").upload(nombre, file, { upsert: true });
        if (error) {
          console.error("Error subiendo foto:", error);
          return null;
        }
        const { data: pub } = supabase.storage.from("heroes").getPublicUrl(nombre);
        return {
          url: pub.publicUrl,
          titulo: "Momento especial",
          etiqueta: "Campaña",
        };
      });

      const results = await Promise.all(uploadPromises);
      const validFotos = results.filter(Boolean);

      if (validFotos.length > 0) {
        const currentEvento = data.find((e) => e.id === eventoId);
        const existingFotos = Array.isArray(currentEvento?.fotos_campana) ? currentEvento.fotos_campana : [];
        const mergedFotos = [...existingFotos, ...validFotos];

        const ok = await apiPatch({
          action: "actualizar-evento",
          id: eventoId,
          fotos_campana: mergedFotos,
        });
        if (ok) {
          await fetchData();
        }
      }
    } catch (err) {
      console.error("Error en subirCollageSimultaneo:", err);
      alert("Hubo un error al subir las fotos. Intenta nuevamente.");
    } finally {
      setUploadingCollageEventoId(null);
    }
  }

  async function eliminarCollageEvento(eventoId: string | number) {
    if (!confirm("¿Eliminar las fotos de campaña de este evento?")) return;
    const ok = await apiPatch({
      action: "actualizar-evento",
      id: eventoId,
      fotos_campana: [],
    });
    if (ok) {
      await fetchData();
    }
  }

  const [uploadingCatalogoEventoId, setUploadingCatalogoEventoId] = useState<string | number | null>(null);
  const [editingCatalogoEventoId, setEditingCatalogoEventoId] = useState<string | number | null>(null);
  const [tempCatalogoUrl, setTempCatalogoUrl] = useState("");

  function getCatalogFormatBadge(url?: string | null): { label: string; color: string } {
    if (!url) return { label: "Sin catálogo", color: "bg-gray-100 text-gray-500 border-gray-200" };
    const clean = url.split("?")[0].toLowerCase();
    if (clean.endsWith(".pdf")) return { label: "PDF", color: "bg-red-50 text-red-700 border-red-200" };
    if (clean.endsWith(".ppt") || clean.endsWith(".pptx")) return { label: "PPT", color: "bg-amber-50 text-amber-800 border-amber-200" };
    if (clean.endsWith(".png") || clean.endsWith(".jpg") || clean.endsWith(".jpeg") || clean.endsWith(".webp") || clean.endsWith(".avif")) {
      return { label: "Imagen", color: "bg-blue-50 text-blue-700 border-blue-200" };
    }
    return { label: "Enlace", color: "bg-purple-50 text-purple-700 border-purple-200" };
  }

  async function subirCatalogoDirecto(eventoId: string | number, file: File) {
    if (!file) return;
    setUploadingCatalogoEventoId(eventoId);
    try {
      const { getSupabaseBrowserClient } = await import("@/lib/supabase/client");
      const supabase = getSupabaseBrowserClient();
      const ext = file.name.split(".").pop() || "pdf";
      const nombre = `catalogo-${eventoId}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("heroes").upload(nombre, file, {
        upsert: true,
        contentType: file.type || undefined,
      });
      if (error) {
        alert("Error al subir el catálogo: " + error.message);
        return;
      }
      const { data: pub } = supabase.storage.from("heroes").getPublicUrl(nombre);
      const ok = await apiPatch({
        action: "actualizar-evento",
        id: eventoId,
        catalogo_url: pub.publicUrl,
      });
      if (ok) {
        await fetchData();
      }
    } catch (err) {
      console.error("Error al subir catálogo:", err);
      alert("Hubo un error al subir el catálogo");
    } finally {
      setUploadingCatalogoEventoId(null);
    }
  }

  async function guardarCatalogoManualDirecto(eventoId: string | number, url: string) {
    const ok = await apiPatch({
      action: "actualizar-evento",
      id: eventoId,
      catalogo_url: url.trim() || null,
    });
    if (ok) {
      await fetchData();
      setEditingCatalogoEventoId(null);
      setTempCatalogoUrl("");
    }
  }

  async function eliminarCatalogoDirecto(eventoId: string | number) {
    if (!confirm("¿Quitar el archivo de catálogo de este evento?")) return;
    const ok = await apiPatch({
      action: "actualizar-evento",
      id: eventoId,
      catalogo_url: null,
    });
    if (ok) {
      await fetchData();
    }
  }

  async function toggleBotonCatalogo(eventoId: string | number, visible: boolean) {
    const ok = await apiPatch({
      action: "actualizar-evento",
      id: eventoId,
      catalogo_boton_visible: visible,
    });
    if (ok) {
      await fetchData();
    }
  }

  function openEditEvento(evento: AdminRow) {
    setIsNewEvento(false);
    setEditEventoNombre(evento.nombre || "");
    setEditEventoSlug(evento.slug || "");
    setEditEventoDescripcion(evento.descripcion || "");
    setEditEventoImagen(evento.imagen_url || "");
    setEditEventoImagenMobile(evento.imagen_url_mobile || "");

    let diaIni = "";
    let mesIni = "";
    if (evento.fecha_inicio) {
      const di = new Date(evento.fecha_inicio);
      diaIni = String(di.getDate());
      mesIni = String(di.getMonth() + 1);
    }
    setEditEventoDiaInicio(diaIni);
    setEditEventoMesInicio(mesIni);

    let diaF = "";
    let mesF = "";
    if (evento.fecha_fin) {
      const df = new Date(evento.fecha_fin);
      diaF = String(df.getDate());
      mesF = String(df.getMonth() + 1);
    }
    setEditEventoDiaFin(diaF);
    setEditEventoMesFin(mesF);

    const prec = getPrecedingEvents(evento.id, data);
    const matched = prec.find((p) => {
      const pf = new Date(p.fecha_fin as string);
      return String(pf.getDate()) === diaIni && String(pf.getMonth() + 1) === mesIni;
    });

    if (matched) {
      setEditEventoModoInicio("auto");
      setSelectedPrevEventoId(matched.id);
    } else if (!diaIni && prec.length > 0) {
      const closest = getClosestPrecedingEvent(evento.id, mesF, diaF, data);
      if (closest && closest.fecha_fin) {
        const cdf = new Date(closest.fecha_fin);
        setEditEventoDiaInicio(String(cdf.getDate()));
        setEditEventoMesInicio(String(cdf.getMonth() + 1));
        setSelectedPrevEventoId(closest.id);
        setEditEventoModoInicio("auto");
      } else {
        setEditEventoModoInicio("manual");
        setSelectedPrevEventoId(null);
      }
    } else {
      setEditEventoModoInicio(prec.length > 0 && !diaIni ? "auto" : "manual");
      setSelectedPrevEventoId(null);
    }

    setEditEventoMostrarEnHero(evento.mostrar_en_hero !== false);
    setEditEventoActivo(evento.activo !== false);
    setEditEventoFeatured(evento.featured || false);
    setEditEventoCatalogoUrl(evento.catalogo_url || "");
    setEditEventoDestacadoRotonda(evento.destacado_rotonda || false);
    const fotos = Array.isArray(evento.fotos_campana)
      ? evento.fotos_campana.map((f) => typeof f === "string" ? { url: f } : f)
      : [];
    setEditEventoFotosCampana(fotos);
    setEditingEvento(evento);
  }

  const MESES = [
    { val: "1", name: "Enero" },
    { val: "2", name: "Febrero" },
    { val: "3", name: "Marzo" },
    { val: "4", name: "Abril" },
    { val: "5", name: "Mayo" },
    { val: "6", name: "Junio" },
    { val: "7", name: "Julio" },
    { val: "8", name: "Agosto" },
    { val: "9", name: "Septiembre" },
    { val: "10", name: "Octubre" },
    { val: "11", name: "Noviembre" },
    { val: "12", name: "Diciembre" },
  ];

  function formatEventoFecha(dateStr?: string | null): string {
    if (!dateStr) return "Sin definir";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Inválida";
    return d.toLocaleDateString("es-PE", {
      day: "numeric",
      month: "short",
    });
  }

  function getPrecedingEvents(currentId: number | string | null, eventsList: AdminRow[]) {
    const currentYear = new Date().getFullYear();
    return (eventsList || [])
      .filter((e) => e.id !== currentId && e.fecha_fin)
      .sort((a, b) => {
        const aDate = new Date(a.fecha_fin as string);
        const bDate = new Date(b.fecha_fin as string);
        const aVal = new Date(currentYear, aDate.getMonth(), aDate.getDate(), 23, 59, 59).getTime();
        const bVal = new Date(currentYear, bDate.getMonth(), bDate.getDate(), 23, 59, 59).getTime();
        return aVal - bVal;
      });
  }

  function getClosestPrecedingEvent(
    currentId: number | string | null,
    targetMesFin: string | number | null,
    targetDiaFin: string | number | null,
    eventsList: AdminRow[]
  ) {
    const preceding = getPrecedingEvents(currentId, eventsList);
    if (preceding.length === 0) return null;

    const currentYear = new Date().getFullYear();

    if (targetMesFin && targetDiaFin) {
      const thisFin = new Date(currentYear, Number(targetMesFin) - 1, Number(targetDiaFin), 23, 59, 59).getTime();
      const beforeThis = preceding.filter((e) => {
        const d = new Date(e.fecha_fin as string);
        const eFin = new Date(currentYear, d.getMonth(), d.getDate(), 23, 59, 59).getTime();
        return eFin <= thisFin;
      });
      if (beforeThis.length > 0) {
        return beforeThis[beforeThis.length - 1];
      }
    }

    return preceding[preceding.length - 1];
  }

  function getEventoStatus(evento: Pick<AdminRow, "activo" | "fecha_inicio" | "fecha_fin">) {
    if (evento.activo === false) {
      return { status: "inactivo", label: "Inactivo", color: "bg-gray-100 text-gray-500 border-gray-200" };
    }
    const now = new Date();
    if (evento.fecha_inicio && new Date(evento.fecha_inicio) > now) {
      return { status: "programado", label: "Programado", color: "bg-blue-50 text-blue-700 border-blue-200" };
    }
    if (evento.fecha_fin && new Date(evento.fecha_fin) < now) {
      return { status: "finalizado", label: "Finalizado / Expirado", color: "bg-rose-50 text-rose-600 border-rose-200" };
    }
    return { status: "activo", label: "Activo ahora", color: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  }

  async function handleHeroSave() {
    const heroData = {
      imagen_url: editUrl,
      imagen_url_mobile: editUrlMobile,
      titulo: editTitulo,
      subtitulo: editSubtitulo || null,
      descripcion: editDescripcion || null,
      badge: editBadge || null,
      precio: editPrecio ? parseFloat(editPrecio) : null,
      producto_sku: editProductoSku || null,
      tipo: editTipo,
      link_url: editLinkUrl || null,
    };
    if (isNewHero) {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clave: selectedClave, ...heroData }),
      });
      if (res.ok) { fetchData(); setEditingHero(undefined); }
    } else {
      const ok = await apiPatch({ action: "actualizar-hero", id: existingHero!.id, ...heroData });
      if (ok) { fetchData(); setEditingHero(undefined); }
    }
  }

  useEffect(() => {
    (async () => {
      const { getSupabaseBrowserClient } = await import("@/lib/supabase/client");
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/"); return; }
      const { data: profile } = await supabase
        .from("profiles")
        .select("rol")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.rol !== "admin" && profile?.rol !== "super_admin") { router.push("/"); return; }
      setAuthorized(true);
    })();
  }, [router]);

  // Sincronización de URL, popstate y restauración de estado
  useEffect(() => {
    try {
      const saved = localStorage.getItem("admin_sidebar_collapsed");
      if (saved !== null) {
        setSidebarCollapsed(saved === "true");
      } else if (typeof window !== "undefined" && window.innerWidth >= 768 && window.innerWidth < 1024) {
        setSidebarCollapsed(true);
      }
    } catch {
      // ignore
    }

    // Escuchar navegación del navegador (Atrás / Adelante)
    const handlePopState = () => {
      if (typeof window === "undefined") return;
      const urlParams = new URLSearchParams(window.location.search);
      const tabQ = urlParams.get("seccion") || urlParams.get("tab");
      const subQ = urlParams.get("sub") || urlParams.get("subtab");
      const validTabs: MainTab[] = ["dashboard", "produccion", "pedidos", "catalogo", "diseno", "eventos", "atencion", "clientes"];
      if (tabQ && validTabs.includes(tabQ as MainTab)) {
        setMainTab(tabQ as MainTab);
      }
      if (subQ) {
        setSubTab(subQ as SubTab);
      }
    };

    window.addEventListener("popstate", handlePopState);

    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Asegurar que la URL siempre tenga la sección activa actual (evita salir de la sección al recargar)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const currentSeccion = params.get("seccion") || params.get("tab");
      if (!currentSeccion || currentSeccion !== mainTab) {
        params.set("seccion", mainTab);
        if (mainTab === "produccion") {
          const prodSub = localStorage.getItem("admin_produccion_subtab") || "resumen";
          params.set("sub", prodSub);
        } else if (subTab && subTab !== "pedidos" && subTab !== "produccion_panel") {
          params.set("sub", subTab);
        }
        window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
      }
    }
  }, [mainTab, subTab]);

  // Manejo de PWA (Manifest y Service Worker) exclusivo para administradores
  useEffect(() => {
    if (!authorized) return;

    // Inyectar el manifest SOLO para administradores
    let manifestLink = document.getElementById("admin-pwa-manifest") as HTMLLinkElement | null;
    if (!manifestLink) {
      manifestLink = document.createElement("link");
      manifestLink.id = "admin-pwa-manifest";
      manifestLink.rel = "manifest";
      manifestLink.href = "/manifest-admin.json";
      document.head.appendChild(manifestLink);
    }

    // Registrar service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw-admin.js").catch(() => {});
    }

    // Detectar si ya está corriendo en modo standalone o fue instalada previamente
    if (typeof window !== "undefined") {
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        window.matchMedia("(display-mode: fullscreen)").matches ||
        window.matchMedia("(display-mode: minimal-ui)").matches ||
        Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone) ||
        document.referrer.includes("android-app://") ||
        localStorage.getItem("admin_app_installed") === "true";
      if (isStandalone) {
        setIsAppInstalled(true);
        try {
          localStorage.setItem("admin_app_installed", "true");
        } catch {}
      }
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsAppInstalled(true);
      setInstallPrompt(null);
      try {
        localStorage.setItem("admin_app_installed", "true");
      } catch {}
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
      if (manifestLink && manifestLink.parentNode) {
        manifestLink.parentNode.removeChild(manifestLink);
      }
    };
  }, [authorized]);

  const handlePromptInstall = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setIsAppInstalled(true);
        setInstallModalOpen(false);
        try {
          localStorage.setItem("admin_app_installed", "true");
        } catch {}
      }
      setInstallPrompt(null);
    } else {
      setInstallModalOpen(true);
    }
  };

  const handleSetInstalled = useCallback((installed: boolean) => {
    setIsAppInstalled(installed);
    try {
      if (installed) {
        localStorage.setItem("admin_app_installed", "true");
      } else {
        localStorage.removeItem("admin_app_installed");
      }
    } catch {}
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("admin_sidebar_collapsed", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const fetchData = useCallback(async () => {
    if ((mainTab === "dashboard" && subTab === "resumen") || mainTab === "produccion") { setLoading(false); return; }
    setLoading(true);
    try {
      const apiTab = subTab === "top_clientes" ? "pedidos" : subTab;
      const res = await fetch(`/api/admin?tab=${apiTab}`);
      const json = await res.json();
      setData(Array.isArray(json) ? json : []);
    } catch (e) {
      console.error(e);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [mainTab, subTab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const loadCatalogos = useCallback(async () => {
    try {
      const res = await fetch("/api/catalogos", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.catalogos)) setAllCatalogos(data.catalogos);
        if (Array.isArray(data?.customSlugs)) setCustomCatalogoSlugs(data.customSlugs);
      }
    } catch {
      // mantener defaults
    }
  }, []);

  useEffect(() => {
    if (authorized) {
      loadCatalogos();
    }
  }, [authorized, loadCatalogos]);

  const handleCreateCatalogo = async (e: React.FormEvent) => {
    e.preventDefault();
    const label = newCatalogoNombre.trim();
    if (!label) return;
    setSavingCatalogo(true);
    try {
      const res = await fetch("/api/catalogos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data?.error || "No se pudo crear el catálogo");
        return;
      }
      if (Array.isArray(data?.catalogos)) setAllCatalogos(data.catalogos);
      if (Array.isArray(data?.customSlugs)) setCustomCatalogoSlugs(data.customSlugs);
      setNewCatalogoNombre("");
    } catch {
      alert("Error de conexión al crear el catálogo");
    } finally {
      setSavingCatalogo(false);
    }
  };

  const handleDeleteCatalogo = async (slug: string, label: string) => {
    if (!confirm(`¿Eliminar el catálogo "${label}"?`)) return;
    try {
      const res = await fetch(`/api/catalogos?slug=${encodeURIComponent(slug)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data?.error || "No se pudo eliminar el catálogo");
        return;
      }
      if (Array.isArray(data?.catalogos)) setAllCatalogos(data.catalogos);
      if (Array.isArray(data?.customSlugs)) setCustomCatalogoSlugs(data.customSlugs);
      if (productosFilter === `cat-${slug}`) {
        setProductosFilter("ver-todo");
      }
    } catch {
      alert("Error al eliminar el catálogo");
    }
  };

  useEffect(() => {
    if ((subTab === "heroes" || subTab === "resenas") && rawProducts.length === 0) {
      fetchVentifyData()
        .then((d) => {
          setAllProducts(d.all);
          setRawProducts(d.all);
          if (d.inactiveIds) setInactiveIds(new Set(d.inactiveIds));
          if (d.assignments) setAssignments(d.assignments);
        })
        .catch(() => {});
    }
    if (subTab === "resenas") {
      fetch("/api/admin?tab=clientes-directorio")
        .then((r) => (r.ok ? r.json() : []))
        .then((list) => {
          if (Array.isArray(list)) setClientesDirectory(list);
        })
        .catch(() => {});
    }
  }, [subTab, rawProducts.length]);

  useEffect(() => {
    if (subTab === "productos" || subTab === "pedidos") {
      if (rawProducts.length === 0 || inactiveIds.size === 0 || assignments.length === 0) {
        fetchVentifyData().then((d) => {
          if (rawProducts.length === 0) setRawProducts(d.all);
          if (inactiveIds.size === 0) setInactiveIds(new Set(d.inactiveIds));
          if (d.assignments) setAssignments(d.assignments);
        }).catch(() => {});
      }
      if (eventos.length === 0) {
        fetch("/api/eventos").then((r) => r.json()).then(setEventos).catch(() => {});
      }
    }
  }, [subTab, rawProducts.length, inactiveIds.size, assignments.length, eventos.length]);

  useEffect(() => {
    if (subTab === "precios") {
      if (amiguProducts.length === 0) {
        fetchVentifyData()
          .then((d) => setAmiguProducts(d.all.filter((p) => p.sku?.startsWith("Amigu-"))))
          .catch(() => {});
      }
    }
  }, [subTab, amiguProducts.length]);

  useEffect(() => {
    if (subTab !== "precios") return;
    const map: Record<string, PrecioRow> = {};
    (Array.isArray(data) ? data : []).forEach((r) => { if (r.sku) map[r.sku] = r; });
    setPreciosRows(map);
    setPreciosDraft((prev) => {
      const next = { ...prev };
      (Array.isArray(data) ? data : []).forEach((r) => {
        if (!r.sku) return;
        const current = next[r.sku] || { pequeno: "", mediano: "", grande: "" };
        next[r.sku] = {
          pequeno: current.pequeno !== "" ? current.pequeno : (r.precio_pequeno != null ? String(r.precio_pequeno) : ""),
          mediano: current.mediano !== "" ? current.mediano : (r.precio_mediano != null ? String(r.precio_mediano) : ""),
          grande: current.grande !== "" ? current.grande : (r.precio_grande != null ? String(r.precio_grande) : ""),
        };
      });
      amiguProducts.forEach((p) => {
        if (!next[p.sku]) {
          next[p.sku] = {
            pequeno: "",
            mediano: p.precio != null ? String(p.precio) : "",
            grande: "",
          };
        }
      });
      return next;
    });
  }, [subTab, data, amiguProducts.length]);

  useEffect(() => {
    if (subTab === "catalogos") {
      fetch("/api/admin?tab=inicio")
        .then((r) => r.json())
        .then((sections) => {
          if (Array.isArray(sections)) {
            const sec = sections.find((s) => s.section_key === "evento_productos_rotonda");
            if (sec) {
              setPortadaSectionId(sec.id);
              if (typeof sec.activo === "boolean") {
                setPortadaActivo(sec.activo);
              }
            }
            if (sec?.items) {
              const it = typeof sec.items === "string" ? JSON.parse(sec.items) : sec.items;
              if (it.evento_slug) setPortadaEventoSlug(it.evento_slug);
              if (Array.isArray(it.selected_product_ids)) {
                setPortadaSelectedIds(new Set(it.selected_product_ids));
              }
              if (Array.isArray(it.custom_catalog_images)) {
                setPortadaCustomImages(it.custom_catalog_images);
              }
            }
          }
        })
        .catch(() => {});

      if (rawProducts.length === 0) {
        fetchVentifyData().then((d) => {
          setRawProducts(d.all);
          setInactiveIds(new Set(d.inactiveIds));
          setAssignments(d.assignments || []);
        }).catch(() => {});
      }

      fetch("/api/eventos")
        .then((r) => r.json())
        .then((evList) => {
          if (Array.isArray(evList)) setEventos(evList);
        })
        .catch(() => {});
    }
  }, [subTab, rawProducts.length]);

  const handleSavePortadaConfig = async (
    customImgs?: CatalogImage[],
    selectedIds?: Set<string>,
    evSlug?: string,
    activoVal?: boolean
  ) => {
    setPortadaSaving(true);
    try {
      const itemsPayload = {
        evento_slug: evSlug !== undefined ? evSlug : portadaEventoSlug,
        limite: 8,
        selected_product_ids: Array.from(selectedIds !== undefined ? selectedIds : portadaSelectedIds),
        custom_catalog_images: customImgs !== undefined ? customImgs : portadaCustomImages,
      };

      const resolvedActivo = activoVal !== undefined ? activoVal : portadaActivo;

      await apiPatch({
        action: "actualizar-seccion",
        id: portadaSectionId || -98,
        section_key: "evento_productos_rotonda",
        tipo: "content",
        activo: resolvedActivo,
        items: itemsPayload,
      });

      alert(resolvedActivo ? "Configuración guardada y carrusel activo en la portada." : "Configuración guardada. El carrusel ha sido ocultado de la portada.");
    } catch (e) {
      console.error(e);
      alert("Error al guardar la configuración.");
    } finally {
      setPortadaSaving(false);
    }
  };

  const handleTogglePortadaActivo = async (newVal: boolean) => {
    setPortadaActivo(newVal);
    await handleSavePortadaConfig(undefined, undefined, undefined, newVal);
  };

  const handleSetMainEvent = async (eventoItem: AdminRow) => {
    try {
      await apiPatch({
        action: "actualizar-evento",
        id: eventoItem.id,
        featured: true,
      });
      setEventos((prev) =>
        prev.map((e) => ({
          ...e,
          featured: e.id === eventoItem.id,
        }))
      );
      alert(`"${eventoItem.nombre}" ahora es el EVENTO PRINCIPAL de la tienda.`);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUploadCustomPortadaImage = async (file: File) => {
    setUploadingPortadaImg(true);
    try {
      const { getSupabaseBrowserClient } = await import("@/lib/supabase/client");
      const supabase = getSupabaseBrowserClient();
      const ext = file.name.split(".").pop();
      const nombre = `portada-catalogo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("heroes").upload(nombre, file, { upsert: true });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("heroes").getPublicUrl(nombre);
      if (pub?.publicUrl) {
        setNewCatalogImgUrl(pub.publicUrl);
      }
    } catch (err) {
      console.error(err);
      alert("Error al subir imagen: " + ((err as Error).message || "Error desconocido"));
    } finally {
      setUploadingPortadaImg(false);
    }
  };

  const handleAddCustomCatalogItem = () => {
    if (!newCatalogImgUrl) {
      alert("Debes seleccionar y subir una imagen primero.");
      return;
    }
    const newItem = {
      id: `custom-${Date.now()}`,
      title: newCatalogImgTitle.trim() || "Producto Especial",
      price: newCatalogImgPrice.trim() ? parseFloat(newCatalogImgPrice.replace(",", ".")) : null,
      image: newCatalogImgUrl,
      categoria: newCatalogImgCategoria.trim() || "Catálogo",
    };
    const updated = [...portadaCustomImages, newItem];
    setPortadaCustomImages(updated);
    setNewCatalogImgTitle("");
    setNewCatalogImgPrice("");
    setNewCatalogImgUrl("");
    setNewCatalogImgCategoria("");
    handleSavePortadaConfig(updated);
  };

  const handleRemoveCustomCatalogItem = (index: number) => {
    const updated = portadaCustomImages.filter((_, i) => i !== index);
    setPortadaCustomImages(updated);
    handleSavePortadaConfig(updated);
  };

  const togglePortadaProductId = (id: string) => {
    setPortadaSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  async function handleGuardarPrecios(sku: string) {
    const draft = preciosDraft[sku];
    if (!draft) return;
    setPreciosSaving(sku);
    const body = {
      action: "actualizar-precios-tamanos",
      sku,
      precio_pequeno: draft.pequeno.trim() !== "" ? parseFloat(draft.pequeno) : null,
      precio_mediano: draft.mediano.trim() !== "" ? parseFloat(draft.mediano) : null,
      precio_grande: draft.grande.trim() !== "" ? parseFloat(draft.grande) : null,
    };
    const ok = await apiPatch(body);
    if (ok) setPreciosRows((prev) => ({ ...prev, [sku]: { sku, precio_pequeno: body.precio_pequeno, precio_mediano: body.precio_mediano, precio_grande: body.precio_grande } }));
    setPreciosSaving(null);
  }

  useEffect(() => {
    if (editingHero) {
      const hero = data.find((h) => h.clave === editingHero.clave);
      setEditUrl(hero?.imagen_url || "");
      setEditUrlMobile(hero?.imagen_url_mobile || "");
      setEditTitulo(hero?.titulo || editingHero.label);
      setEditSubtitulo(hero?.subtitulo || "");
      setEditDescripcion(hero?.descripcion || "");
      setEditBadge(hero?.badge || "");
      setEditPrecio(hero?.precio?.toString() || "");
      setEditProductoSku(hero?.producto_sku || "");
      setEditTipo(hero?.tipo || "flyer");
      setEditLinkUrl(hero?.link_url || "");
      setProductSearch("");
      if (isProductSlide(editingHero.clave) && allProducts.length === 0) {
        fetchVentifyData().then((d) => setAllProducts(d.active)).catch(() => {});
      }
    }
  }, [editingHero, data]);

  useEffect(() => {
    if (editingSection) {
      setSectionTitulo(editingSection.titulo || "");
      setSectionSubtitulo(editingSection.subtitulo || "");
      setSectionDescripcion(editingSection.descripcion || "");
      setSectionImagenUrl(editingSection.imagen_url || "");
      setSectionLinkUrl(editingSection.link_url || "");
      setSectionLinkText(editingSection.link_text || "");
      setSectionItems(editingSection.items ? JSON.stringify(editingSection.items, null, 2) : "");

      const items = editingSection.items || {};
      setPersBadge(items.badge || "");
      setPersTituloLinea1(items.titulo_linea1 || "");
      setPersTituloLinea2(items.titulo_linea2 || "");
      setPersBotonPrimario(items.boton_primario || "");
      setPersBotonPrimarioLogged(items.boton_primario_logged || "");
      setPersBotonSecundario(items.boton_secundario || "");
      setPersEstadistica(items.estadistica || "");
      setPersEtiquetaPrecio(items.etiqueta_precio || "");
      setPersValorPrecio(items.valor_precio || "");
    }
  }, [editingSection]);

  async function handleSectionSave() {
    if (!editingSection) return;
                    const updateData: Record<string, unknown> = {
      titulo: sectionTitulo,
      subtitulo: sectionSubtitulo || null,
      descripcion: sectionDescripcion || null,
      imagen_url: sectionImagenUrl || null,
      link_url: sectionLinkUrl || null,
      link_text: sectionLinkText || null,
    };
    if (editingSection.tipo === 'showcase' || editingSection.tipo === 'faq' || editingSection.section_key === 'campana_rotonda' || editingSection.section_key === 'evento_productos_rotonda') {
      try {
        updateData.items = typeof sectionItems === "object" ? sectionItems : JSON.parse(sectionItems);
      } catch { /* keep existing */ }
      if (editingSection.section_key === 'campana_rotonda') {
        updateData.section_key = 'campana_rotonda';
        updateData.tipo = 'content';
      }
      if (editingSection.section_key === 'evento_productos_rotonda') {
        updateData.section_key = 'evento_productos_rotonda';
        updateData.tipo = 'content';
      }
    }
    if (editingSection.tipo === 'personalizados') {
      updateData.items = {
        badge: persBadge,
        titulo_linea1: persTituloLinea1,
        titulo_linea2: persTituloLinea2,
        boton_primario: persBotonPrimario,
        boton_primario_logged: persBotonPrimarioLogged,
        boton_secundario: persBotonSecundario,
        estadistica: persEstadistica,
        etiqueta_precio: persEtiquetaPrecio,
        valor_precio: persValorPrecio,
      };
    }
    const ok = await apiPatch({ action: "actualizar-seccion", id: editingSection.id, ...updateData });
    if (ok) { fetchData(); setEditingSection(null); }
  }

  async function apiPatch(body: Record<string, unknown>) {
    const res = await fetch("/api/admin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  }

  const handleMarcarLeido = async (id: number | string) => {
    const ok = await apiPatch({ action: "marcar-leido", id });
    if (ok) setData((prev) => prev.map((item) => item.id === id ? { ...item, leido: true } : item));
  };

  const handleCambiarEstado = async (id: number | string, estado: string) => {
    const ok = await apiPatch({ action: "cambiar-estado", id, estado });
    if (ok) setData((prev) => prev.map((item) => item.id === id ? { ...item, estado } : item));
  };

  const handleActualizarPedido = (id: number | string, updates: Record<string, unknown>) => {
    setData((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
    fetchData();
  };

  const handlePersonalizadoEstado = async (id: number | string, estado: string) => {
    const ok = await apiPatch({ action: "personalizado-estado", id, estado });
    if (ok) fetchData();
  };

  const handleAprobarResena = async (id: number | string, aprobado: boolean) => {
    const ok = await apiPatch({ action: "aprobar-resena", id, aprobado });
    if (ok) setData((prev) => prev.map((item) => item.id === id ? { ...item, aprobado } : item));
  };

  const handleEliminarResena = async (id: number | string) => {
    const ok = await apiPatch({ action: "eliminar-resena", id });
    if (ok) setData((prev) => prev.filter((item) => item.id !== id));
  };

  const handleToggleProducto = async (producto: AdminProduct, activo: boolean) => {
    const ok = await apiPatch({ action: "set-producto-activo", producto_id: producto.id, activo });
    if (ok) {
      setInactiveIds((prev) => {
        const next = new Set(prev);
        if (activo) next.delete(producto.id);
        else next.add(producto.id);
        return next;
      });
    }
  };

  const handleOpenAssignModal = (producto: AdminProduct) => {
    setEditingProductoCatalogos(producto);
    const active = getProductActiveSlugs(producto, assignments);
    setSelectedSlugsForProducto(active);
  };

  const handleToggleSlugSelection = (slug: string) => {
    const normalized = slug.toLowerCase().trim();
    setSelectedSlugsForProducto((prev) =>
      prev.includes(normalized) ? prev.filter((s) => s !== normalized) : [...prev, normalized]
    );
  };

  const handleSaveProductoCatalogos = async () => {
    if (!editingProductoCatalogos) return;
    setSavingCatalogos(true);
    try {
      const defaultSlugs = getDefaultProductSlugs(editingProductoCatalogos);
      const slugs_incluidos = selectedSlugsForProducto;
      const slugs_excluidos = defaultSlugs.filter((s) => !selectedSlugsForProducto.includes(s));

      const res = await fetch("/api/admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "guardar-producto-catalogos",
          producto_id: editingProductoCatalogos.id,
          sku: editingProductoCatalogos.sku || null,
          slugs_incluidos,
          slugs_excluidos,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert("Error al guardar catálogos: " + (err.error || "Error"));
        return;
      }

      setAssignments((prev) => {
        const filtered = prev.filter(
          (a) => a.producto_id !== editingProductoCatalogos.id && (!editingProductoCatalogos.sku || a.sku !== editingProductoCatalogos.sku)
        );
        const newRows: ProductoCatalogoAssignment[] = [];
        slugs_incluidos.forEach((s) => {
          newRows.push({
            producto_id: editingProductoCatalogos.id,
            sku: editingProductoCatalogos.sku || null,
            categoria_slug: s,
            incluir: true,
          });
        });
        slugs_excluidos.forEach((s) => {
          newRows.push({
            producto_id: editingProductoCatalogos.id,
            sku: editingProductoCatalogos.sku || null,
            categoria_slug: s,
            incluir: false,
          });
        });
        return [...filtered, ...newRows];
      });

      // Actualizar inmediatamente los catalogos de este producto en el estado local de productos
      setRawProducts((prev) =>
        prev.map((p) => {
          if (p.id === editingProductoCatalogos.id || (editingProductoCatalogos.sku && p.sku === editingProductoCatalogos.sku)) {
            return { ...p, catalogos: slugs_incluidos };
          }
          return p;
        })
      );
      setAllProducts((prev) =>
        prev.map((p) => {
          if (p.id === editingProductoCatalogos.id || (editingProductoCatalogos.sku && p.sku === editingProductoCatalogos.sku)) {
            return { ...p, catalogos: slugs_incluidos };
          }
          return p;
        })
      );

      setEditingProductoCatalogos(null);
    } catch (err) {
      alert("Error al guardar: " + (err as Error).message);
    } finally {
      setSavingCatalogos(false);
    }
  };

  const toggleSelectProduct = (productId: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const toggleSelectAllVisible = (visibleProducts: AdminProduct[]) => {
    setSelectedProductIds((prev) => {
      const allSelected = visibleProducts.length > 0 && visibleProducts.every((p) => prev.has(p.id));
      if (allSelected) {
        return new Set();
      } else {
        const next = new Set(prev);
        visibleProducts.forEach((p) => next.add(p.id));
        return next;
      }
    });
  };

  const handleBulkAssign = async (operacion: "agregar" | "quitar") => {
    if (selectedProductIds.size === 0 || !bulkTargetSlug) return;
    setBulkSaving(true);
    try {
      const selectedItems = rawProducts
        .filter((p) => selectedProductIds.has(p.id))
        .map((p) => ({ producto_id: p.id, sku: p.sku || null }));

      const res = await fetch("/api/admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bulk-asignar-catalogos",
          items: selectedItems,
          slug: bulkTargetSlug,
          operacion,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert("Error en acción en lote: " + (err.error || "Error"));
        return;
      }

      const fresh = await fetchVentifyData();
      if (fresh.assignments) {
        setAssignments(fresh.assignments);
      }
      if (fresh.all && fresh.all.length > 0) {
        setRawProducts(fresh.all);
        setAllProducts(fresh.all);
      }

      setSelectedProductIds(new Set());
      setBulkModalOpen(false);
    } catch (err) {
      alert("Error: " + (err as Error).message);
    } finally {
      setBulkSaving(false);
    }
  };

  const toggleCardSlugs = (productId: string) => {
    setExpandedCardSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const handleConfirmDeleteProducts = async () => {
    if (!deleteConfirmTarget) return;
    setDeletingProducts(true);
    try {
      const idsToDelete =
        deleteConfirmTarget.mode === "single"
          ? [deleteConfirmTarget.product.id]
          : deleteConfirmTarget.ids;

      const res = await fetch("/api/admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          deleteConfirmTarget.mode === "single"
            ? {
                action: "eliminar-producto",
                id: deleteConfirmTarget.product.id,
                updates: { producto_id: deleteConfirmTarget.product.id },
              }
            : {
                action: "eliminar-productos-masivo",
                id: "bulk",
                updates: { producto_ids: idsToDelete },
              }
        ),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert("Error al eliminar: " + (err.error || "Error desconocido"));
        return;
      }

      const idSet = new Set(idsToDelete);
      setRawProducts((prev) => prev.filter((p) => !idSet.has(p.id)));
      setAllProducts((prev) => prev.filter((p) => !idSet.has(p.id)));
      setAssignments((prev) => prev.filter((a) => !idSet.has(a.producto_id)));
      setInactiveIds((prev) => {
        const next = new Set(prev);
        idsToDelete.forEach((id) => next.delete(id));
        return next;
      });
      setSelectedProductIds((prev) => {
        const next = new Set(prev);
        idsToDelete.forEach((id) => next.delete(id));
        return next;
      });
      setDeleteConfirmTarget(null);
    } catch (err) {
      alert("Error al eliminar: " + (err as Error).message);
    } finally {
      setDeletingProducts(false);
    }
  };

  const handleCrearResenaManual = async () => {
    if (!resenaProducto) {
      alert("Selecciona un producto para la reseña");
      return;
    }
    if (resenaCalificacion < 1 || resenaCalificacion > 5) {
      alert("La calificación debe estar entre 1 y 5 estrellas");
      return;
    }
    const nombreFinal = resenaNombre.trim() || "Equipo Entre Hilos";
    if (resenaClientMode === "nuevo" && resenaGuardarCliente && resenaNombre.trim()) {
      try {
        const cliRes = await fetch("/api/admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "guardar-cliente-manual",
            cliente: {
              nombre: resenaNombre.trim(),
              telefono: resenaClienteTelefono.trim() || null,
              direccion: resenaClienteDireccion.trim() || null,
            },
          }),
        });
        if (cliRes.ok) {
          const cliData = await cliRes.json().catch(() => null);
          if (cliData?.cliente) {
            setClientesDirectory((prev) => {
              const exists = prev.some(
                (c) => c.nombre.toLowerCase() === cliData.cliente.nombre.toLowerCase()
              );
              return exists ? prev : [cliData.cliente, ...prev];
            });
          }
        }
      } catch {
        // continuar con la creación de reseña
      }
    }
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resena: {
          producto_id: resenaProducto.id,
          producto_sku: resenaProducto.sku,
          producto_nombre: resenaProducto.nombre,
          nombre_cliente: nombreFinal,
          calificacion: resenaCalificacion,
          comentario: resenaComentario.trim() || null,
        },
      }),
    });
    if (res.ok) {
      setShowResenaForm(false);
      setResenaProducto(null);
      setResenaNombre("");
      setResenaClienteTelefono("");
      setResenaClienteDireccion("");
      setResenaClientSearch("");
      setResenaCalificacion(0);
      setResenaComentario("");
      setResenaSearch("");
      fetchData();
    }
  };

  async function handleSignOut() {
    const { getSupabaseBrowserClient } = await import("@/lib/supabase/client");
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  function whatsappLink(row: AdminRow) {
    const text = encodeURIComponent(
      `*Pedido #${row.id}*\nCliente: ${row.cliente_nombre || "-"}\nTel: ${row.cliente_telefono || "-"}\nTotal: S/ ${row.total || "0"}\nEstado: ${row.estado || "pendiente"}`
    );
    return `https://wa.me/51902578295?text=${text}`;
  }

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDF4F7]">
        <Loader2 size={32} className="animate-spin text-[#EE6B8D]" />
      </div>
    );
  }

  const effectiveCollapsed = sidebarCollapsed && !isMobile;

  const sidebarContent = (
    <div className="flex flex-col h-full select-none">
      {/* Cabecera del sidebar */}
      {effectiveCollapsed ? (
        <div className="py-4 px-2 flex flex-col items-center gap-3 border-b border-[#FDE8EF]">
          {/* Logo / Avatar circular */}
          <div
            className="w-10 h-10 rounded-full bg-linear-to-tr from-[#EE6B8D] to-[#C04267] text-white flex items-center justify-center font-fredoka font-bold text-xs shadow-xs ring-2 ring-pink-100 cursor-pointer"
            title="Entre Hilos Admin"
            onClick={toggleSidebar}
          >
            EH
          </div>

          {/* Botón toggle para expandir (tipo imagen de referencia) */}
          <button
            type="button"
            onClick={toggleSidebar}
            className="w-10 h-10 rounded-xl border border-[#EE6B8D]/40 bg-[#FDF4F7] text-[#EE6B8D] hover:bg-pink-100 hover:text-[#C04267] flex items-center justify-center transition-all shadow-2xs group relative"
            title="Expandir menú lateral"
            aria-label="Expandir menú lateral"
          >
            <PanelLeft size={18} strokeWidth={2} />
            <span className="hidden group-hover:block absolute left-full ml-2.5 px-2.5 py-1 bg-gray-900 text-white text-xs font-quicksand font-semibold rounded-lg whitespace-nowrap shadow-lg z-50 pointer-events-none">
              Expandir menú
            </span>
          </button>
        </div>
      ) : (
        <div className="p-4 border-b border-[#FDE8EF] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-linear-to-tr from-[#EE6B8D] to-[#C04267] text-white flex items-center justify-center font-fredoka font-bold text-sm shadow-xs ring-2 ring-pink-100 shrink-0">
              EH
            </div>
            <div>
              <h1 className="font-fredoka text-base font-bold text-[#C04267] leading-tight">Admin</h1>
              <p className="font-quicksand text-xs text-gray-400 leading-tight">Entre Hilos</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Botón para contraer (solo en pantallas desktop/tablet) */}
            <button
              type="button"
              onClick={toggleSidebar}
              className="hidden md:flex w-8 h-8 rounded-lg hover:bg-pink-50 text-gray-400 hover:text-[#EE6B8D] items-center justify-center transition-colors group relative"
              title="Contraer menú lateral"
              aria-label="Contraer menú lateral"
            >
              <PanelLeftClose size={18} strokeWidth={2} />
              <span className="hidden group-hover:block absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs font-quicksand font-semibold rounded-lg whitespace-nowrap shadow-lg z-50 pointer-events-none">
                Contraer
              </span>
            </button>

            {/* Botón cerrar en móvil */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500"
              aria-label="Cerrar menú"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Navegación */}
      <nav className={`flex-1 overflow-y-auto ${effectiveCollapsed ? "py-4 px-2 space-y-2 flex flex-col items-center" : "p-3 space-y-1"}`}>
        {menuGroups.map((item) => {
          const Icon = item.icon;
          const active = mainTab === item.id;

          if (effectiveCollapsed) {
            return (
              <button
                key={item.id}
                onClick={() => cambiarSeccion(item.id)}
                className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all relative group cursor-pointer ${
                  active
                    ? "bg-[#FDF4F7] text-[#EE6B8D] border-2 border-[#EE6B8D]/40 shadow-xs font-bold ring-2 ring-pink-100/50"
                    : "text-gray-400 hover:text-gray-700 hover:bg-gray-100/80"
                }`}
                title={item.label}
                aria-label={item.label}
              >
                <Icon size={20} strokeWidth={active ? 2.4 : 1.7} />
                <span className="hidden group-hover:block absolute left-full ml-3 px-2.5 py-1 bg-gray-900 text-white text-xs font-quicksand font-semibold rounded-lg whitespace-nowrap shadow-lg z-50 pointer-events-none">
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => cambiarSeccion(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-quicksand text-sm font-semibold transition-all text-left cursor-pointer ${
                active
                  ? "bg-[#FDF4F7] text-[#EE6B8D] shadow-xs font-bold border border-[#FDE8EF]"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
              }`}
            >
              <Icon size={18} strokeWidth={active ? 2.5 : 1.5} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Pie del sidebar */}
      {effectiveCollapsed ? (
        <div className="py-3 px-2 border-t border-[#FDE8EF] flex flex-col items-center gap-2">
          {/* Botón de Descargar App Admin */}
          {!isAppInstalled && (
            <button
              onClick={() => setInstallModalOpen(true)}
              className="w-11 h-11 rounded-xl bg-pink-50 text-[#C04267] hover:bg-[#EE6B8D] hover:text-white border border-pink-200/70 flex items-center justify-center transition-all relative group cursor-pointer"
              title="Instalar App Admin (Celular / Tablet / PC)"
              aria-label="Instalar App Admin"
            >
              <Download size={19} strokeWidth={2.2} />
              <span className="hidden group-hover:block absolute left-full ml-3 px-2.5 py-1 bg-gray-900 text-white text-xs font-quicksand font-semibold rounded-lg whitespace-nowrap shadow-lg z-50 pointer-events-none">
                Instalar App Admin
              </span>
            </button>
          )}

          <Link
            href="/"
            className="w-11 h-11 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-all relative group"
            title="Ir a inicio de la tienda"
            aria-label="Ir a inicio"
          >
            <Home size={19} strokeWidth={1.8} />
            <span className="hidden group-hover:block absolute left-full ml-3 px-2.5 py-1 bg-gray-900 text-white text-xs font-quicksand font-semibold rounded-lg whitespace-nowrap shadow-lg z-50 pointer-events-none">
              Ir a inicio
            </span>
          </Link>
          <button
            onClick={handleSignOut}
            className="w-11 h-11 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 border border-red-200/60 flex items-center justify-center transition-all relative group cursor-pointer"
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <LogOut size={19} strokeWidth={1.8} />
            <span className="hidden group-hover:block absolute left-full ml-3 px-2.5 py-1 bg-red-600 text-white text-xs font-quicksand font-semibold rounded-lg whitespace-nowrap shadow-lg z-50 pointer-events-none">
              Cerrar sesión
            </span>
          </button>
        </div>
      ) : (
        <div className="p-3 border-t border-[#FDE8EF] space-y-1.5">
          {/* Botón de Descargar App Admin */}
          {!isAppInstalled && (
            <button
              onClick={() => setInstallModalOpen(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-gradient-to-r from-pink-50 via-rose-50 to-pink-50 border border-pink-200 text-[#C04267] hover:border-[#EE6B8D] hover:shadow-xs transition-all text-left group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-white border border-pink-200/80 flex items-center justify-center text-[#EE6B8D] shrink-0 group-hover:bg-[#EE6B8D] group-hover:text-white transition-all">
                <Download size={15} strokeWidth={2.2} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-xs truncate leading-tight">Instalar App Admin</div>
                <div className="text-[10px] text-gray-500 truncate">Celular, Tablet o PC</div>
              </div>
            </button>
          )}

          <Link
            href="/"
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-quicksand text-sm font-semibold text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-all"
          >
            <Home size={18} strokeWidth={1.5} />
            <span>Ir a inicio</span>
          </Link>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-quicksand text-sm font-semibold text-red-400 hover:bg-red-50 hover:text-red-500 transition-all cursor-pointer"
          >
            <LogOut size={18} strokeWidth={1.5} />
            <span>Cerrar sesión</span>
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FDF4F7] flex flex-col md:flex-row">
      {/* Sidebar exclusivamente para pantallas medianas y grandes (Desktop / Tablet) */}
      <aside
        className={`hidden md:block sticky top-0 left-0 z-30 h-screen ${
          effectiveCollapsed ? "md:w-[72px]" : "md:w-64"
        } w-64 bg-white border-r border-[#FDE8EF] transition-all duration-300 ease-in-out shrink-0`}
      >
        {sidebarContent}
      </aside>

      {/* Header Compacto para Celular (< md) sin menú lateral */}
      <header className="md:hidden sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#FDE8EF] px-3.5 py-2.5 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#EE6B8D] to-[#C04267] text-white flex items-center justify-center font-fredoka font-bold text-xs shadow-xs shrink-0">
            EH
          </div>
          <div>
            <h1 className="font-fredoka text-sm font-bold text-[#C04267] leading-tight">
              Entre Hilos Admin
            </h1>
            <p className="font-quicksand text-[10px] text-gray-500 font-semibold leading-none capitalize">
              {menuGroups.find((m) => m.id === mainTab)?.label || "Panel"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {!isAppInstalled && (
            <button
              type="button"
              onClick={() => setInstallModalOpen(true)}
              className="text-xs font-quicksand font-bold text-[#C04267] bg-pink-50 hover:bg-pink-100 border border-pink-200/90 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl transition-all shadow-2xs cursor-pointer"
              title="Descargar APK / Instalar App en el celular"
            >
              <Download size={13} strokeWidth={2.2} className="text-[#EE6B8D]" />
              <span>Descargar APK</span>
            </button>
          )}

          <Link
            href="/"
            className="text-xs font-quicksand font-bold text-[#EE6B8D] hover:text-[#C04267] flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-pink-50 transition-colors"
          >
            <Home size={13} />
            <span className="hidden xs:inline">Tienda</span>
          </Link>
        </div>
      </header>

      {/* Contenido Principal con padding inferior extra en móvil para la barra de navegación */}
      <main className="flex-1 min-w-0 p-3 sm:p-5 lg:p-6 pb-28 md:pb-8 transition-all duration-300 overflow-x-hidden">
        {/* Subpestañas superiores adaptativas sin scroll lateral: solo el activo expande su nombre */}
        {SUBTABS_BY_MAIN[mainTab]?.length > 1 && (
          <div className="flex items-center justify-between sm:justify-start sm:flex-wrap gap-1 sm:gap-1.5 mb-4 sm:mb-5 bg-white p-1 rounded-2xl border border-[#FDE8EF] w-full shadow-xs">
            {SUBTABS_BY_MAIN[mainTab].map((st) => {
              const StIcon = st.icon;
              const isSubActive = subTab === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => cambiarSubTab(st.id)}
                  title={st.label}
                  aria-label={st.label}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-xl font-quicksand transition-all duration-200 cursor-pointer min-w-0 ${
                    isSubActive
                      ? "bg-[#EE6B8D] text-white shadow-xs font-bold px-3 sm:px-4 text-xs sm:text-sm flex-1 sm:flex-initial"
                      : "text-gray-500 hover:text-[#C04267] hover:bg-[#FDF4F7] p-2 sm:px-3 text-xs shrink-0"
                  }`}
                >
                  <StIcon size={17} strokeWidth={isSubActive ? 2.5 : 1.75} className="shrink-0" />
                  <span className={`${isSubActive ? "inline-block truncate leading-none" : "hidden sm:inline-block truncate leading-none"}`}>
                    {st.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {mainTab === "dashboard" && subTab === "resumen" && (
          <div>
            <div className="mb-6">
              <h2 className="font-fredoka text-2xl font-bold text-[#C04267]">Dashboard</h2>
              <p className="font-quicksand text-xs text-gray-500 mt-1">
                Panel de control y gestión integral de Entre Hilos
              </p>
            </div>

            {/* Banner de Descarga de App / Instalación APK (solo visible si no está instalada) */}
            {!isAppInstalled && (
              <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-pink-50 via-rose-50 to-pink-50 border border-pink-200/90 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#EE6B8D] to-[#C04267] text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Download size={22} strokeWidth={2.2} />
                  </div>
                  <div>
                    <h3 className="font-fredoka text-base font-bold text-[#C04267]">
                      Descargar App Móvil / Instalar APK de Administración
                    </h3>
                    <p className="font-quicksand text-xs text-gray-600 mt-0.5">
                      Instala la app en tu celular Android, iPhone, tablet o PC para acceso directo en pantalla completa y avisos sonoros de entregas.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setInstallModalOpen(true)}
                  className="w-full sm:w-auto px-4 py-2.5 bg-[#EE6B8D] hover:bg-[#C04267] text-white rounded-xl font-quicksand font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer shrink-0"
                >
                  <Download size={15} strokeWidth={2.2} />
                  <span>Descargar / Instalar App</span>
                </button>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {menuGroups.filter(m => m.id !== "dashboard").map((group) => {
                const Icon = group.icon;
                const subtabs = SUBTABS_BY_MAIN[group.id] || [];
                return (
                  <button
                    key={group.id}
                    onClick={() => cambiarSeccion(group.id)}
                    className="group bg-white rounded-2xl border border-[#FDE8EF] p-5 text-left hover:border-[#EE6B8D] hover:shadow-md transition-all flex flex-col justify-between cursor-pointer"
                  >
                    <div>
                      <div className="w-11 h-11 rounded-xl bg-[#FDF4F7] flex items-center justify-center text-[#EE6B8D] mb-3.5 group-hover:scale-110 group-hover:bg-[#EE6B8D] group-hover:text-white transition-all shadow-xs">
                        <Icon size={22} strokeWidth={2} />
                      </div>
                      <h3 className="font-fredoka text-base font-bold text-[#C04267] mb-1 group-hover:text-[#EE6B8D] transition-colors">
                        {group.label}
                      </h3>
                      <p className="font-quicksand text-xs text-gray-400 line-clamp-2 leading-relaxed">
                        {group.desc}
                      </p>
                    </div>
                    {subtabs.length > 1 && (
                      <div className="mt-4 pt-3 border-t border-gray-50 flex items-center gap-1.5 flex-wrap">
                        {subtabs.map((s) => (
                          <span key={s.id} className="text-[10px] font-quicksand font-semibold bg-[#FDF4F7] text-[#C04267] px-2 py-0.5 rounded-md">
                            {s.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {!((mainTab === "dashboard" && subTab === "resumen") || mainTab === "produccion") && loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-[#EE6B8D]" />
          </div>
        )}

        {(mainTab === "diseno" || mainTab === "dashboard") && subTab === "heroes" && !loading && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <h2 className="font-fredoka text-xl font-bold text-[#C04267]">Heroes</h2>
              <button onClick={() => setEditingHero(ALL_HERO_KEYS[0])}
                className="flex items-center gap-2 text-xs text-white bg-[#EE6B8D] hover:bg-[#C04267] px-4 py-2.5 rounded-lg font-quicksand font-semibold transition-colors shadow-sm self-start sm:self-auto"
              >
                <Upload size={14} />
                Agregar / Editar
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {ALL_HERO_KEYS.map((hk) => {
                const hero = data.find((h) => h.clave === hk.clave);
                const imgUrl = hero?.imagen_url;
                const prodImg = hero?.producto_sku ? allProducts.find((p) => p.sku === hero.producto_sku)?.imagen : null;
                const displayImg = imgUrl || prodImg;
                return (
                  <button key={hk.clave}
                    onClick={() => setEditingHero(hk)}
                    className={`group relative aspect-video rounded-xl overflow-hidden border-2 transition-all bg-gray-50 ${
                      hero ? "border-transparent hover:border-[#EE6B8D]" : "border-dashed border-gray-200 hover:border-[#EE6B8D]"
                    }`}
                  >
                    {displayImg ? (
                      <img src={displayImg} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon size={28} className="text-gray-200" />
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                      <p className="font-quicksand text-xs font-semibold text-white">{hk.label}</p>
                    </div>
                    {hero?.imagen_url_mobile && (
                      <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm rounded-full px-2 py-0.5 text-[9px] font-quicksand font-semibold text-gray-600 shadow-sm">
                        Móvil ✓
                      </div>
                    )}
                    {!hero && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="font-quicksand text-[10px] text-gray-300 bg-white/80 px-2 py-0.5 rounded-full">Sin imagen</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {(mainTab === "diseno" || mainTab === "dashboard") && subTab === "inicio" && !loading && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <h2 className="font-fredoka text-xl font-bold text-[#C04267]">Inicio - Secciones</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.map((section) => (
                <button key={section.id}
                  onClick={() => setEditingSection(section)}
                  className="group relative bg-white rounded-xl border-2 border-transparent hover:border-[#EE6B8D] transition-all p-5 text-left shadow-sm hover:shadow-md"
                >
                  <div className="flex items-start justify-between mb-3">
                    <span className="font-quicksand text-[10px] uppercase tracking-wider text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                      {section.section_key}
                    </span>
                    <span className="font-quicksand text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full" style={{
                      backgroundColor: section.section_key === 'evento_productos_rotonda' ? '#FDF4F7' : section.section_key === 'campana_rotonda' ? '#FCE4EC' : section.tipo === 'faq' ? '#E8F5E9' : section.tipo === 'showcase' ? '#FFF3E0' : section.tipo === 'personalizados' ? '#FCE4EC' : '#F3E5F5',
                      color: section.section_key === 'evento_productos_rotonda' ? '#EE6B8D' : section.section_key === 'campana_rotonda' ? '#C04267' : section.tipo === 'faq' ? '#2E7D32' : section.tipo === 'showcase' ? '#E65100' : section.tipo === 'personalizados' ? '#C04267' : '#7B1FA2',
                    }}>
                      {section.section_key === 'evento_productos_rotonda' ? 'Rotonda Productos' : section.section_key === 'campana_rotonda' ? 'Rotonda Momentos' : section.tipo}
                    </span>
                  </div>
                  <h3 className="font-quicksand text-sm font-bold text-gray-800 mb-1">{section.titulo || 'Sin título'}</h3>
                  {section.subtitulo && (
                    <p className="font-quicksand text-xs text-gray-500 italic">{section.subtitulo}</p>
                  )}
                  {section.descripcion && (
                    <p className="font-quicksand text-xs text-gray-400 mt-2 line-clamp-2">{section.descripcion}</p>
                  )}
                  {section.items && (
                    <p className="font-quicksand text-[10px] text-gray-400 mt-2">
                      {Array.isArray(section.items) ? section.items.length : 0} ítems
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {(mainTab === "eventos" || mainTab === "dashboard") && subTab === "eventos" && !loading && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="font-fredoka text-xl font-bold text-[#C04267]">Eventos y Campañas</h2>
                <p className="font-quicksand text-xs text-gray-500 mt-1">
                  Define fechas de inicio y término para activar automáticamente los banners en el Hero principal y la tienda.
                </p>
              </div>
              <button onClick={() => {
                setIsNewEvento(true);
                setEditEventoNombre("");
                setEditEventoSlug("");
                setEditEventoDescripcion("");
                setEditEventoImagen("");
                setEditEventoImagenMobile("");
                setEditEventoDiaFin("");
                setEditEventoMesFin("");

                const closest = getClosestPrecedingEvent(null, null, null, data);
                if (closest && closest.fecha_fin) {
                  const df = new Date(closest.fecha_fin);
                  setEditEventoDiaInicio(String(df.getDate()));
                  setEditEventoMesInicio(String(df.getMonth() + 1));
                  setSelectedPrevEventoId(closest.id);
                  setEditEventoModoInicio("auto");
                } else {
                  setEditEventoDiaInicio("");
                  setEditEventoMesInicio("");
                  setSelectedPrevEventoId(null);
                  setEditEventoModoInicio("manual");
                }

                setEditEventoMostrarEnHero(true);
                setEditEventoActivo(true);
                setEditEventoFeatured(false);
                setEditEventoCatalogoUrl("");
                setEditEventoDestacadoRotonda(false);
                setEditEventoFotosCampana([]);
                setEditingEvento({ id: null, nombre: "", slug: "", descripcion: "", imagen_url: "", imagen_url_mobile: "" } as unknown as AdminRow);
              }}
                className="flex items-center gap-2 text-xs text-white bg-[#EE6B8D] hover:bg-[#C04267] px-4 py-2.5 rounded-lg font-quicksand font-semibold transition-colors shadow-sm self-start sm:self-auto"
              >
                <Plus size={14} />
                Crear evento
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {data.map((evento) => {
                const statusInfo = getEventoStatus(evento);
                const enHero = statusInfo.status === "activo" && evento.mostrar_en_hero !== false && (evento.imagen_url || evento.imagen_url_mobile);

                return (
                  <div key={evento.id}
                    className={`group relative bg-white rounded-2xl border-2 transition-all overflow-hidden text-left shadow-sm hover:shadow-md flex flex-col justify-between ${
                      enHero
                        ? "border-[#EE6B8D] ring-2 ring-[#EE6B8D]/20"
                        : "border-gray-100 hover:border-[#EE6B8D]/50"
                    }`}
                  >
                    <div>
                      {/* Miniatura del banner y click para editar */}
                      <div
                        onClick={() => openEditEvento(evento)}
                        className="relative aspect-[21/9] bg-gray-50 border-b border-gray-100 overflow-hidden cursor-pointer"
                      >
                        {evento.imagen_url || evento.imagen_url_mobile ? (
                          <img
                            src={evento.imagen_url || evento.imagen_url_mobile || ""}
                            alt=""
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            onError={(e) => { (e.target as HTMLImageElement).src = "/logo.png"; }}
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-gray-300">
                            <ImageIcon size={28} />
                            <span className="font-quicksand text-[11px] text-gray-400 mt-1">Sin banner (click para configurar)</span>
                          </div>
                        )}

                        {/* Badges superiores sobre la imagen */}
                        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1.5 flex-wrap">
                          <span className={`font-quicksand text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border shadow-sm ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>

                          <div className="flex items-center gap-1">
                            {enHero && (
                              <span className="font-quicksand text-[10px] font-bold text-white bg-gradient-to-r from-[#EE6B8D] to-[#C04267] px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                                <Star size={10} />
                                Hero
                              </span>
                            )}
                            {evento.destacado_rotonda && (
                              <span className="font-quicksand text-[10px] font-bold text-white bg-gradient-to-r from-[#C97B4A] to-[#EE6B8D] px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                                <Star size={10} />
                                Rotonda Portada
                              </span>
                            )}
                            {evento.catalogo_url && (
                              <span className="font-quicksand text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <FileText size={10} />
                                Catálogo PDF
                              </span>
                            )}
                            {evento.featured && (
                              <span className="font-quicksand text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                Navbar
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="p-4">
                        <div
                          onClick={() => openEditEvento(evento)}
                          className="cursor-pointer"
                        >
                          <h3 className="font-quicksand text-sm font-bold text-gray-800 line-clamp-1 hover:text-[#EE6B8D] transition-colors">
                            {evento.nombre}
                          </h3>
                          {evento.slug && (
                            <p className="font-quicksand text-[11px] text-gray-400 mb-1 font-mono">/evento/{evento.slug}</p>
                          )}
                          {evento.descripcion && (
                            <p className="font-quicksand text-xs text-gray-500 mb-3 line-clamp-2">{evento.descripcion}</p>
                          )}
                        </div>

                        {/* Fechas de vigencia */}
                        <div className="bg-[#FAF7F5] rounded-xl p-2.5 space-y-1 text-[11px] font-quicksand border border-gray-100">
                          <div className="flex items-center justify-between text-gray-600">
                            <span className="flex items-center gap-1 text-gray-400">
                              <Calendar size={12} className="text-[#C04267]" />
                              Inicio:
                            </span>
                            <span className="font-semibold text-gray-700">
                              {evento.fecha_inicio ? formatEventoFecha(evento.fecha_inicio) : "Inmediato"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-gray-600">
                            <span className="flex items-center gap-1 text-gray-400">
                              <Clock size={12} className="text-[#EE6B8D]" />
                              Fin:
                            </span>
                            <span className="font-semibold text-gray-700">
                              {evento.fecha_fin ? formatEventoFecha(evento.fecha_fin) : "Permanente"}
                            </span>
                          </div>
                        </div>

                        {/* SECCIÓN DIRECTA: SUBIR COLLAGE DE FOTOS PARA LA ROTONDA DE INICIO */}
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          {Array.isArray(evento.fotos_campana) && evento.fotos_campana.length > 0 ? (
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="font-quicksand font-bold text-[11px] text-[#C04267] flex items-center gap-1">
                                  <Camera size={12} className="text-[#EE6B8D]" />
                                  Fotos de Campaña ({evento.fotos_campana.length} {evento.fotos_campana.length === 1 ? "foto" : "fotos"})
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    eliminarCollageEvento(evento.id);
                                  }}
                                  className="text-gray-400 hover:text-red-500 font-quicksand text-[10px] font-semibold transition-colors"
                                >
                                  Quitar todas
                                </button>
                              </div>

                              {/* Miniaturas de todas las fotos con scroll horizontal si son muchas */}
                              <div className="flex items-center gap-1.5 mb-2 overflow-x-auto py-1 scrollbar-thin">
                                {(evento.fotos_campana as (CampanaFoto | string)[]).map((f, idx: number) => {
                                  const src = typeof f === "string" ? f : f.url;
                                  return (
                                    <div key={idx} className="relative w-12 h-16 shrink-0 rounded-lg overflow-hidden bg-gray-100 border border-pink-100 shadow-xs">
                                      <img src={src} alt="" className="w-full h-full object-cover" />
                                    </div>
                                  );
                                })}
                              </div>

                              <label className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-pink-50 hover:bg-pink-100 text-[#C04267] font-quicksand font-bold text-[11px] cursor-pointer transition-colors border border-pink-200">
                                <input
                                  type="file"
                                  multiple
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const files = Array.from(e.target.files || []);
                                    if (files.length > 0) subirCollageSimultaneo(evento.id, files);
                                  }}
                                />
                                {uploadingCollageEventoId === evento.id ? (
                                  <Loader2 size={12} className="animate-spin text-[#EE6B8D]" />
                                ) : (
                                  <Upload size={12} />
                                )}
                                <span>Agregar más fotos</span>
                              </label>
                            </div>
                          ) : (
                            <label
                              className={`w-full flex flex-col items-center justify-center p-3 rounded-xl border-2 border-dashed transition-all cursor-pointer text-center ${
                                uploadingCollageEventoId === evento.id
                                  ? "border-[#EE6B8D] bg-pink-50"
                                  : "border-[#EE6B8D]/40 bg-[#FDF4F7]/60 hover:bg-[#FDF4F7] hover:border-[#EE6B8D]"
                              }`}
                            >
                              <input
                                type="file"
                                multiple
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const files = Array.from(e.target.files || []);
                                  if (files.length > 0) subirCollageSimultaneo(evento.id, files);
                                }}
                              />
                              {uploadingCollageEventoId === evento.id ? (
                                <div className="flex items-center gap-2 text-[#C04267] font-quicksand font-bold text-xs py-1">
                                  <Loader2 size={15} className="animate-spin text-[#EE6B8D]" />
                                  <span>Subiendo fotos a la vez...</span>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center gap-1.5 text-[#C04267] font-quicksand font-bold text-xs">
                                    <Camera size={14} className="text-[#EE6B8D]" />
                                    <span>Subir fotos de campaña</span>
                                  </div>
                                  <span className="font-quicksand text-[10px] text-gray-500 mt-0.5">
                                    Elige todas las fotos que quieras para el collage
                                  </span>
                                </>
                              )}
                            </label>
                          )}
                        </div>

                        {/* SECCIÓN DIRECTA: CATÁLOGO OFICIAL (PDF O ENLACE) */}
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-quicksand font-bold text-[11px] text-[#C04267] flex items-center gap-1.5">
                              <FileDown size={13} className="text-[#EE6B8D]" />
                              Catálogo Oficial (PDF / Enlace)
                            </span>
                            {evento.catalogo_url ? (() => {
                              const b = getCatalogFormatBadge(evento.catalogo_url);
                              return (
                                <span className={`font-quicksand text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${b.color}`}>
                                  <Check size={10} /> {b.label}
                                </span>
                              );
                            })() : (
                              <span className="font-quicksand text-[10px] font-semibold text-gray-400 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full">
                                Sin catálogo
                              </span>
                            )}
                          </div>

                          {evento.catalogo_url ? (
                            <div className="bg-[#FAF7F5] border border-pink-100/80 rounded-xl p-2.5 space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-quicksand text-[11px] text-gray-600 truncate flex-1 font-mono" title={evento.catalogo_url}>
                                  {evento.catalogo_url.split("/").pop()}
                                </span>
                                <div className="flex items-center gap-1 shrink-0">
                                  <a
                                    href={evento.catalogo_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1 text-gray-500 hover:text-[#C04267] hover:bg-white rounded-md transition-colors border border-transparent hover:border-pink-200"
                                    title="Ver o descargar catálogo"
                                  >
                                    <ExternalLink size={12} />
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingCatalogoEventoId(evento.id);
                                      setTempCatalogoUrl(evento.catalogo_url || "");
                                    }}
                                    className="px-1.5 py-0.5 text-gray-600 hover:text-[#C04267] hover:bg-white rounded-md transition-colors border border-transparent hover:border-pink-200 text-[10px] font-quicksand font-bold"
                                    title="Editar enlace manual"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => eliminarCatalogoDirecto(evento.id)}
                                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-white rounded-md transition-colors"
                                    title="Quitar catálogo"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>

                              {/* Reemplazar con nuevo archivo */}
                              <div className="flex items-center gap-1.5 pt-1 border-t border-gray-100">
                                <label className="flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded-lg bg-pink-50 hover:bg-pink-100 text-[#C04267] font-quicksand font-bold text-[10px] cursor-pointer transition-colors border border-pink-200">
                                  <input
                                    type="file"
                                    accept=".pdf,application/pdf,image/*,.ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                                    className="hidden"
                                    disabled={uploadingCatalogoEventoId === evento.id}
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) subirCatalogoDirecto(evento.id, file);
                                    }}
                                  />
                                  {uploadingCatalogoEventoId === evento.id ? (
                                    <Loader2 size={11} className="animate-spin text-[#EE6B8D]" />
                                  ) : (
                                    <Upload size={11} />
                                  )}
                                  <span>{uploadingCatalogoEventoId === evento.id ? "Subiendo..." : "Reemplazar (PDF, PPT o Imagen)"}</span>
                                </label>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {/* Subir archivo directo */}
                              <label className="w-full flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl border border-dashed border-[#EE6B8D]/50 bg-[#FDF4F7]/60 hover:bg-[#FDF4F7] text-[#C04267] font-quicksand font-bold text-xs cursor-pointer transition-all">
                                <input
                                  type="file"
                                  accept=".pdf,application/pdf,image/*,.ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                                  className="hidden"
                                  disabled={uploadingCatalogoEventoId === evento.id}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) subirCatalogoDirecto(evento.id, file);
                                  }}
                                />
                                {uploadingCatalogoEventoId === evento.id ? (
                                  <div className="flex items-center gap-1.5 text-xs py-0.5">
                                    <Loader2 size={13} className="animate-spin text-[#EE6B8D]" />
                                    <span>Subiendo archivo...</span>
                                  </div>
                                ) : (
                                  <>
                                    <Upload size={13} className="text-[#EE6B8D]" />
                                    <span>Subir Catálogo (PDF, PPT o Imagen)</span>
                                  </>
                                )}
                              </label>

                              {/* O pegar enlace */}
                              {editingCatalogoEventoId !== evento.id && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingCatalogoEventoId(evento.id);
                                    setTempCatalogoUrl("");
                                  }}
                                  className="w-full py-1 text-center font-quicksand text-[10px] text-gray-500 hover:text-[#C04267] transition-colors"
                                >
                                  o pegar enlace manual (Drive, Canva, etc.)
                                </button>
                              )}
                            </div>
                          )}

                          {/* Formulario en línea para pegar enlace manual */}
                          {editingCatalogoEventoId === evento.id && (
                            <div className="mt-2 p-2 bg-white rounded-xl border border-[#EE6B8D]/40 shadow-xs space-y-1.5 animate-in fade-in duration-150">
                              <label className="block font-quicksand text-[10px] font-bold text-gray-700">
                                Enlace público o URL del catálogo:
                              </label>
                              <input
                                type="text"
                                placeholder="https://..."
                                value={tempCatalogoUrl}
                                onChange={(e) => setTempCatalogoUrl(e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg font-quicksand text-gray-800 focus:outline-none focus:border-[#EE6B8D]"
                              />
                              <div className="flex justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingCatalogoEventoId(null);
                                    setTempCatalogoUrl("");
                                  }}
                                  className="px-2.5 py-1 text-[11px] font-quicksand font-semibold text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => guardarCatalogoManualDirecto(evento.id, tempCatalogoUrl)}
                                  className="px-3 py-1 text-[11px] font-quicksand font-bold text-white bg-[#EE6B8D] hover:bg-[#C04267] rounded-lg transition-colors shadow-xs"
                                >
                                  Guardar enlace
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="p-4 pt-0">
                      <button
                        type="button"
                        onClick={() => openEditEvento(evento)}
                        className="w-full py-2 px-3 rounded-xl border border-gray-200 hover:border-[#EE6B8D] hover:bg-[#FDF4F7]/50 text-gray-700 font-quicksand font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
                      >
                        Editar fechas y detalles
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Modal de edición de heroe */}
        {editingHero !== undefined && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            onClick={() => setEditingHero(undefined)}
          >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-fredoka text-lg font-bold text-[#C04267]">Editar heroe</h3>
                <button onClick={() => setEditingHero(undefined)}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Selector de heroe */}
              <label className="font-quicksand text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5 block">Heroe</label>
              <select
                value={selectedClave}
                onChange={(e) => {
                  const hk = ALL_HERO_KEYS.find((k) => k.clave === e.target.value);
                  if (hk) setEditingHero(hk);
                }}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg font-quicksand text-sm focus:outline-none focus:ring-2 focus:ring-[#EE6B8D] mb-4"
              >
                {ALL_HERO_KEYS.map((hk) => (
                  <option key={hk.clave} value={hk.clave}>
                    {hk.label}
                  </option>
                ))}
              </select>

              {/* Título */}
              <label className="font-quicksand text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5 block">Título</label>
              <input
                value={editTitulo}
                onChange={(e) => setEditTitulo(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg font-quicksand text-sm focus:outline-none focus:ring-2 focus:ring-[#EE6B8D] mb-4"
              />

              {isProductSlide(selectedClave) ? (
                <>
                  {/* Subtítulo (highlight) */}
                  <label className="font-quicksand text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5 block">Subtítulo (texto resaltado)</label>
                  <input
                    value={editSubtitulo}
                    onChange={(e) => setEditSubtitulo(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg font-quicksand text-sm focus:outline-none focus:ring-2 focus:ring-[#EE6B8D] mb-4"
                  />

                  {/* Badge */}
                  <label className="font-quicksand text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5 block">Badge / Etiqueta</label>
                  <input
                    value={editBadge}
                    onChange={(e) => setEditBadge(e.target.value)}
                    placeholder="Ej: Especial, Tus Personajes Favoritos, A Tu Medida"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg font-quicksand text-sm focus:outline-none focus:ring-2 focus:ring-[#EE6B8D] mb-4"
                  />

                  {/* Descripción */}
                  <label className="font-quicksand text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5 block">Descripción</label>
                  <textarea
                    value={editDescripcion}
                    onChange={(e) => setEditDescripcion(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg font-quicksand text-sm focus:outline-none focus:ring-2 focus:ring-[#EE6B8D] mb-4 resize-none"
                  />

                  {/* Precio */}
                  <label className="font-quicksand text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5 block">Precio (S/)</label>
                  <input
                    value={editPrecio}
                    onChange={(e) => setEditPrecio(e.target.value)}
                    type="number"
                    step="0.01"
                    placeholder="Ej: 80"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg font-quicksand text-sm focus:outline-none focus:ring-2 focus:ring-[#EE6B8D] mb-4"
                  />

                  {/* Link URL */}
                  <label className="font-quicksand text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5 block">Link del botón &quot;Ver Colección&quot;</label>
                  <input
                    value={editLinkUrl}
                    onChange={(e) => setEditLinkUrl(e.target.value)}
                    placeholder="Ej: /catalogo/cajas, /catalogo/amigurumis, /personalizados"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg font-quicksand text-sm focus:outline-none focus:ring-2 focus:ring-[#EE6B8D] mb-4"
                  />

                  <hr className="border-gray-100 my-5" />
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-4 bg-[#EE6B8D] rounded-full" />
                    <h4 className="font-quicksand text-sm font-bold text-gray-700">Producto a mostrar</h4>
                  </div>

                  <label className="font-quicksand text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5 block">SKU del producto</label>
                  <input
                    value={editProductoSku}
                    onChange={(e) => setEditProductoSku(e.target.value)}
                    placeholder="Ej: Amigu-001, Caja-001, Ramos-003"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg font-quicksand text-sm focus:outline-none focus:ring-2 focus:ring-[#EE6B8D] mb-3"
                  />

                  <button
                    onClick={() => setShowProductPicker(!showProductPicker)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-[#EE6B8D] rounded-lg font-quicksand text-sm font-semibold text-[#EE6B8D] hover:bg-[#FDF4F7] transition-colors mb-4"
                  >
                    <Search size={16} />
                    {showProductPicker ? "Ocultar productos" : "Buscar productos"}
                  </button>

                  {showProductPicker && (
                    <div className="mb-4 border border-gray-200 rounded-xl overflow-hidden">
                      <div className="p-3 bg-gray-50 border-b border-gray-200">
                        <input
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                          placeholder="Filtrar productos por nombre o SKU..."
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg font-quicksand text-sm focus:outline-none focus:ring-2 focus:ring-[#EE6B8D]"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-60 overflow-y-auto divide-y divide-gray-100">
                        {allProducts
                          .filter((p) =>
                            !productSearch || p.nombre?.toLowerCase().includes(productSearch.toLowerCase()) || p.sku?.toLowerCase().includes(productSearch.toLowerCase())
                          )
                          .slice(0, 50)
                          .map((p) => (
                            <button
                              key={p.id}
                              onClick={() => {
                                setEditProductoSku(p.sku);
                                if (!editPrecio) setEditPrecio(p.precio?.toString() || "");
                                setShowProductPicker(false);
                              }}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[#FDF4F7] transition-colors ${
                                editProductoSku === p.sku ? 'bg-[#FDF4F7] border-l-4 border-[#EE6B8D]' : ''
                              }`}
                            >
                              {p.imagen && (
                                <img src={p.imagen} alt="" className="w-10 h-10 rounded-lg object-cover bg-gray-100 flex-shrink-0" />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="font-quicksand text-xs font-semibold text-gray-800 truncate">{p.nombre}</p>
                                <p className="font-quicksand text-[10px] text-gray-400">{p.sku} · S/ {p.precio?.toFixed(2)}</p>
                              </div>
                              {editProductoSku === p.sku && (
                                <Check size={16} className="text-[#EE6B8D] flex-shrink-0" />
                              )}
                            </button>
                          ))}
                        {allProducts.length === 0 && (
                          <p className="p-4 text-center font-quicksand text-xs text-gray-400">Cargando productos...</p>
                        )}
                      </div>
                    </div>
                  )}

                  {editProductoSku && (
                    <div className="bg-[#FDE8EF] rounded-xl p-3 flex items-center gap-3">
                      <Check size={18} className="text-[#C04267] flex-shrink-0" />
                      <p className="font-quicksand text-xs text-gray-700">
                        Producto seleccionado: <strong>{editProductoSku}</strong>
                        {editPrecio && `. Precio: S/ ${editPrecio}`}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Link URL - only for home_hero_1 */}
                  {selectedClave === 'home_hero_1' && (
                    <>
                      <label className="font-quicksand text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5 block">Link del banner</label>
                      <input
                        value={editLinkUrl}
                        onChange={(e) => setEditLinkUrl(e.target.value)}
                        placeholder="Ej: /evento/dia-de-la-novia"
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg font-quicksand text-sm focus:outline-none focus:ring-2 focus:ring-[#EE6B8D] mb-4"
                      />
                    </>
                  )}

                  {/* URL input */}
                  <label className="font-quicksand text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5 block">URL de imagen <span className="text-gray-400 font-normal normal-case">(1200×675px recomendado)</span></label>
                  <input
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg font-quicksand text-sm focus:outline-none focus:ring-2 focus:ring-[#EE6B8D] mb-3"
                  />

                  {/* Drop zone */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setHeroDragOver(1); }}
                    onDragLeave={() => setHeroDragOver(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setHeroDragOver(null);
                      const file = e.dataTransfer.files?.[0];
                      if (file?.type.startsWith("image/")) subirHeroFileTemp(file);
                      const text = e.dataTransfer.getData("text");
                      if (text && esUrlImagen(text)) setEditUrl(text.trim());
                    }}
                    onPaste={(e) => {
                      const items = e.clipboardData?.items;
                      if (!items) return;
                      for (const item of Array.from(items)) {
                        if (item.type.startsWith("image/")) {
                          const file = item.getAsFile();
                          if (file) { e.preventDefault(); subirHeroFileTemp(file); return; }
                        }
                        if (item.type === "text/plain") {
                          const text = e.clipboardData.getData("text");
                          if (esUrlImagen(text)) { e.preventDefault(); setEditUrl(text.trim()); return; }
                        }
                      }
                    }}
                    onClick={() => tempFileRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all mb-4 ${
                      heroDragOver === 1 ? "border-[#EE6B8D] bg-[#FDF4F7]" : "border-gray-200 hover:border-[#EE6B8D] hover:bg-[#FDF4F7]/50"
                    }`}
                  >
                    <input
                      ref={tempFileRef}
                      type="file" accept="image/*" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) subirHeroFileTemp(f); }}
                    />
                    {tempUploading ? (
                      <Loader2 size={24} className="mx-auto animate-spin text-[#EE6B8D]" />
                    ) : (
                      <>
                        <Upload size={28} className="mx-auto text-[#EE6B8D] mb-2" />
                        <p className="font-quicksand text-sm font-semibold text-gray-700">Click, arrastra o pega (Ctrl+V)</p>
                        <p className="font-quicksand text-xs text-gray-400 mt-1">Reemplazará la imagen actual</p>
                      </>
                    )}
                  </div>

                  {/* Preview */}
                  {editUrl && (
                    <div className="relative aspect-video rounded-xl bg-gray-50 border border-gray-200 overflow-hidden mb-4 group">
                      <img src={editUrl} alt="" className="w-full h-full object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).src = ""; }}
                      />
                      <button onClick={() => setEditUrl("")}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-red-600"
                      >
                        <X size={14} />
                      </button>
                      <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded font-quicksand">
                        Desktop
                      </div>
                    </div>
                  )}

                  <hr className="border-gray-100 my-5" />

                  {/* Mobile image */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-4 bg-[#EE6B8D] rounded-full" />
                    <h4 className="font-quicksand text-sm font-bold text-gray-700">Imagen Móvil (vertical)</h4>
                  </div>

                  <label className="font-quicksand text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5 block">URL imagen móvil <span className="text-gray-400 font-normal normal-case">(600×900px recomendado)</span></label>
                  <input
                    value={editUrlMobile}
                    onChange={(e) => setEditUrlMobile(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg font-quicksand text-sm focus:outline-none focus:ring-2 focus:ring-[#EE6B8D] mb-3"
                  />

                  <div
                    onDragOver={(e) => { e.preventDefault(); setHeroDragOver(2); }}
                    onDragLeave={() => setHeroDragOver(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setHeroDragOver(null);
                      const file = e.dataTransfer.files?.[0];
                      if (file?.type.startsWith("image/")) subirHeroFileTempMobile(file);
                      const text = e.dataTransfer.getData("text");
                      if (text && esUrlImagen(text)) setEditUrlMobile(text.trim());
                    }}
                    onPaste={(e) => {
                      const items = e.clipboardData?.items;
                      if (!items) return;
                      for (const item of Array.from(items)) {
                        if (item.type.startsWith("image/")) {
                          const file = item.getAsFile();
                          if (file) { e.preventDefault(); subirHeroFileTempMobile(file); return; }
                        }
                        if (item.type === "text/plain") {
                          const text = e.clipboardData.getData("text");
                          if (esUrlImagen(text)) { e.preventDefault(); setEditUrlMobile(text.trim()); return; }
                        }
                      }
                    }}
                    onClick={() => tempFileRefMobile.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all mb-4 ${
                      heroDragOver === 2 ? "border-[#EE6B8D] bg-[#FDF4F7]" : "border-gray-200 hover:border-[#EE6B8D] hover:bg-[#FDF4F7]/50"
                    }`}
                  >
                    <input
                      ref={tempFileRefMobile}
                      type="file" accept="image/*" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) subirHeroFileTempMobile(f); }}
                    />
                    {tempUploadingMobile ? (
                      <Loader2 size={20} className="mx-auto animate-spin text-[#EE6B8D]" />
                    ) : (
                      <>
                        <Upload size={22} className="mx-auto text-[#EE6B8D] mb-1" />
                        <p className="font-quicksand text-xs font-semibold text-gray-700">Imagen vertical para móvil</p>
                        <p className="font-quicksand text-[11px] text-gray-400 mt-0.5">Arrastra, pega o selecciona</p>
                      </>
                    )}
                  </div>

                  {editUrlMobile && (
                    <div className="relative aspect-[3/4] max-w-[180px] rounded-xl bg-gray-50 border border-gray-200 overflow-hidden mb-4 group mx-auto">
                      <img src={editUrlMobile} alt="" className="w-full h-full object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).src = ""; }}
                      />
                      <button onClick={() => setEditUrlMobile("")}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-red-600"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button onClick={() => setEditingHero(undefined)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-lg font-quicksand text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button onClick={handleHeroSave}
                  className="flex-1 py-2.5 bg-[#EE6B8D] hover:bg-[#C04267] text-white rounded-lg font-quicksand text-sm font-semibold transition-colors"
                >
                  {isNewHero ? "Crear" : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de edición de sección de inicio */}
        {editingSection !== null && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            onClick={() => setEditingSection(null)}
          >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-fredoka text-lg font-bold text-[#C04267]">Editar sección</h3>
                <button onClick={() => setEditingSection(null)}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <label className="font-quicksand text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5 block">Título</label>
              <input value={sectionTitulo} onChange={(e) => setSectionTitulo(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg font-quicksand text-sm focus:outline-none focus:ring-2 focus:ring-[#EE6B8D] mb-4"
              />

              <label className="font-quicksand text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5 block">Subtítulo</label>
              <input value={sectionSubtitulo} onChange={(e) => setSectionSubtitulo(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg font-quicksand text-sm focus:outline-none focus:ring-2 focus:ring-[#EE6B8D] mb-4"
              />

              <label className="font-quicksand text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5 block">Descripción</label>
              <textarea value={sectionDescripcion} onChange={(e) => setSectionDescripcion(e.target.value)}
                rows={3}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg font-quicksand text-sm focus:outline-none focus:ring-2 focus:ring-[#EE6B8D] mb-4 resize-none"
              />

              <label className="font-quicksand text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5 block">Imagen de referencia <span className="text-gray-400 font-normal normal-case">(800×600px recomendado)</span></label>
              <input value={sectionImagenUrl} onChange={(e) => setSectionImagenUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg font-quicksand text-sm focus:outline-none focus:ring-2 focus:ring-[#EE6B8D] mb-3"
              />

              <div
                onDragOver={(e) => { e.preventDefault(); setHeroDragOver(3); }}
                onDragLeave={() => setHeroDragOver(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setHeroDragOver(null);
                  const file = e.dataTransfer.files?.[0];
                  if (file?.type.startsWith("image/")) subirSectionImg(file);
                  const text = e.dataTransfer.getData("text");
                  if (text && esUrlImagen(text)) setSectionImagenUrl(text.trim());
                }}
                onPaste={(e) => {
                  const items = e.clipboardData?.items;
                  if (!items) return;
                  for (const item of Array.from(items)) {
                    if (item.type.startsWith("image/")) {
                      const file = item.getAsFile();
                      if (file) { e.preventDefault(); subirSectionImg(file); return; }
                    }
                    if (item.type === "text/plain") {
                      const text = e.clipboardData.getData("text");
                      if (esUrlImagen(text)) { e.preventDefault(); setSectionImagenUrl(text.trim()); return; }
                    }
                  }
                }}
                onClick={() => sectionImgRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all mb-4 ${
                  heroDragOver === 3 ? "border-[#EE6B8D] bg-[#FDF4F7]" : "border-gray-200 hover:border-[#EE6B8D] hover:bg-[#FDF4F7]/50"
                }`}
              >
                <input
                  ref={sectionImgRef}
                  type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) subirSectionImg(f); }}
                />
                {tempUploading ? (
                  <Loader2 size={24} className="mx-auto animate-spin text-[#EE6B8D]" />
                ) : (
                  <>
                    <Upload size={24} className="mx-auto text-[#EE6B8D] mb-1" />
                    <p className="font-quicksand text-xs font-semibold text-gray-700">Click, arrastra o pega (Ctrl+V)</p>
                    <p className="font-quicksand text-[10px] text-gray-400 mt-0.5">Sube una imagen referencial</p>
                  </>
                )}
              </div>

              {sectionImagenUrl && (
                <div className="relative aspect-video rounded-xl bg-gray-50 border border-gray-200 overflow-hidden mb-4 group">
                  <img src={sectionImagenUrl} alt="" className="w-full h-full object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).src = ""; }}
                  />
                  <button onClick={() => setSectionImagenUrl("")}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-red-600"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              <label className="font-quicksand text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5 block">Link URL</label>
              <input value={sectionLinkUrl} onChange={(e) => setSectionLinkUrl(e.target.value)}
                placeholder="Ej: /catalogo/ramos"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg font-quicksand text-sm focus:outline-none focus:ring-2 focus:ring-[#EE6B8D] mb-4"
              />

              <label className="font-quicksand text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5 block">Texto del link</label>
              <input value={sectionLinkText} onChange={(e) => setSectionLinkText(e.target.value)}
                placeholder="Ej: Ver más"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg font-quicksand text-sm focus:outline-none focus:ring-2 focus:ring-[#EE6B8D] mb-4"
              />

              {editingSection.tipo === 'faq' && (
                <>
                  <hr className="border-gray-100 my-5" />
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-4 bg-[#EE6B8D] rounded-full" />
                    <h4 className="font-quicksand text-sm font-bold text-gray-700">Preguntas y Respuestas</h4>
                  </div>
                  {(() => {
                    const items: SectionItem[] = (() => { try { return JSON.parse(sectionItems); } catch { return []; } })();
                    return items.map((item, i: number) => (
                      <div key={i} className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-quicksand text-xs font-bold text-gray-500">Pregunta {i + 1}</span>
                          <button onClick={() => {
                            const updated = items.filter((_, idx: number) => idx !== i);
                            setSectionItems(JSON.stringify(updated, null, 2));
                          }}
                            className="text-red-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <input value={item.pregunta || ''} onChange={(e) => {
                          const updated = [...items];
                          updated[i] = { ...updated[i], pregunta: e.target.value };
                          setSectionItems(JSON.stringify(updated, null, 2));
                        }}
                          placeholder="Escribe la pregunta..."
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg font-quicksand text-sm focus:outline-none focus:ring-2 focus:ring-[#EE6B8D] mb-2"
                        />
                        <textarea value={item.respuesta || ''} onChange={(e) => {
                          const updated = [...items];
                          updated[i] = { ...updated[i], respuesta: e.target.value };
                          setSectionItems(JSON.stringify(updated, null, 2));
                        }}
                          placeholder="Escribe la respuesta..."
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg font-quicksand text-sm focus:outline-none focus:ring-2 focus:ring-[#EE6B8D] resize-none"
                        />
                      </div>
                    ));
                  })()}
                  <button onClick={() => {
                                const current: SectionItem[] = (() => { try { return JSON.parse(sectionItems); } catch { return []; } })();
                    current.push({ pregunta: '', respuesta: '' });
                    setSectionItems(JSON.stringify(current, null, 2));
                  }}
                    className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-[#EE6B8D] rounded-xl font-quicksand text-sm font-semibold text-[#EE6B8D] hover:bg-[#FDF4F7] transition-colors mb-4"
                  >
                    <Plus size={16} />
                    Agregar pregunta
                  </button>
                </>
              )}

              {editingSection.tipo === 'showcase' && (
                <>
                  <hr className="border-gray-100 my-5" />
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-4 bg-[#EE6B8D] rounded-full" />
                    <h4 className="font-quicksand text-sm font-bold text-gray-700">Items del Showcase</h4>
                  </div>
                  {(() => {
                    const items: SectionItem[] = (() => { try { return JSON.parse(sectionItems); } catch { return []; } })();
                    return items.map((item, i: number) => (
                      <div key={i} className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-quicksand text-xs font-bold text-gray-500">Item {i + 1}{item.sku ? ` · ${item.sku}` : ''}</span>
                          <button onClick={() => {
                            const updated = items.filter((_, idx: number) => idx !== i);
                            setSectionItems(JSON.stringify(updated, null, 2));
                          }}
                            className="text-red-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <input value={item.titulo || ''} onChange={(e) => {
                          const updated = [...items];
                          updated[i] = { ...updated[i], titulo: e.target.value };
                          setSectionItems(JSON.stringify(updated, null, 2));
                        }}
                          placeholder="Título del item"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg font-quicksand text-sm focus:outline-none focus:ring-2 focus:ring-[#EE6B8D] mb-2"
                        />
                        <textarea value={item.descripcion || ''} onChange={(e) => {
                          const updated = [...items];
                          updated[i] = { ...updated[i], descripcion: e.target.value };
                          setSectionItems(JSON.stringify(updated, null, 2));
                        }}
                          placeholder="Descripción del item"
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg font-quicksand text-sm focus:outline-none focus:ring-2 focus:ring-[#EE6B8D] mb-2 resize-none"
                        />
                        <button
                          onClick={() => {
                            if (allProducts.length === 0) fetchVentifyData().then((d) => setAllProducts(d.active)).catch(() => {});
                            setPickingProductFor(pickingProductFor === i ? null : i);
                          }}
                          className="w-full flex items-center justify-center gap-2 py-2 border-2 border-dashed border-[#EE6B8D]/50 rounded-lg font-quicksand text-xs font-semibold text-[#EE6B8D] hover:bg-[#FDF4F7] transition-colors"
                        >
                          <Search size={14} />
                          {item.sku ? `Cambiar producto (${item.sku})` : 'Seleccionar producto'}
                        </button>

                        {pickingProductFor === i && (
                          <div className="mt-2 border border-gray-200 rounded-xl overflow-hidden">
                            <div className="p-2 bg-gray-50 border-b border-gray-200">
                              <input
                                value={productSearch}
                                onChange={(e) => setProductSearch(e.target.value)}
                                placeholder="Buscar..."
                                className="w-full px-3 py-1.5 border border-gray-200 rounded-lg font-quicksand text-xs focus:outline-none focus:ring-2 focus:ring-[#EE6B8D]"
                                autoFocus
                              />
                            </div>
                            <div className="max-h-48 overflow-y-auto divide-y divide-gray-100">
                        {allProducts
                          .filter((p) =>
                            !productSearch || p.nombre?.toLowerCase().includes(productSearch.toLowerCase()) || p.sku?.toLowerCase().includes(productSearch.toLowerCase())
                          )
                          .slice(0, 50)
                          .map((p) => (
                                  <button
                                    key={p.id}
                                    onClick={() => {
                                      const updated = [...items];
                                      updated[i] = { ...updated[i], titulo: p.nombre, descripcion: p.descripcion || updated[i].descripcion, imagen: p.imagen || null, sku: p.sku };
                                      setSectionItems(JSON.stringify(updated, null, 2));
                                      setPickingProductFor(null);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#FDF4F7] transition-colors"
                                  >
                                    {p.imagen && <img src={p.imagen} alt="" className="w-8 h-8 rounded-lg object-cover bg-gray-100 flex-shrink-0" />}
                                    <div className="min-w-0 flex-1">
                                      <p className="font-quicksand text-[11px] font-semibold text-gray-800 truncate">{p.nombre}</p>
                                      <p className="font-quicksand text-[9px] text-gray-400">{p.sku}</p>
                                    </div>
                                  </button>
                                ))}
                            </div>
                          </div>
                        )}

                        {item.sku && (
                          <div className="bg-[#FDE8EF] rounded-lg px-3 py-2 flex items-center gap-2 mt-2">
                            <Check size={14} className="text-[#C04267] flex-shrink-0" />
                            <span className="font-quicksand text-[11px] text-gray-600">Producto: <strong>{item.sku}</strong></span>
                          </div>
                        )}
                      </div>
                    ));
                  })()}
                  <button
                    onClick={() => {
                      if (allProducts.length === 0) fetchVentifyData().then((d) => setAllProducts(d.active)).catch(() => {});
                      setShowProductPicker(!showProductPicker);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-[#EE6B8D] rounded-xl font-quicksand text-sm font-semibold text-[#EE6B8D] hover:bg-[#FDF4F7] transition-colors mb-4"
                  >
                    <Plus size={16} />
                    {showProductPicker ? 'Ocultar' : 'Agregar item vacío'}
                  </button>

                  {showProductPicker && (
                    <div className="mb-4 border border-gray-200 rounded-xl overflow-hidden">
                      <div className="p-3 bg-gray-50 border-b border-gray-200">
                        <input
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                          placeholder="Buscar producto..."
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg font-quicksand text-sm focus:outline-none focus:ring-2 focus:ring-[#EE6B8D]"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-60 overflow-y-auto divide-y divide-gray-100">
                        {allProducts
                          .filter((p) =>
                            !productSearch || p.nombre?.toLowerCase().includes(productSearch.toLowerCase()) || p.sku?.toLowerCase().includes(productSearch.toLowerCase())
                          )
                          .slice(0, 50)
                          .map((p) => (
                            <button
                              key={p.id}
                              onClick={() => {
                    const current: SectionItem[] = (() => { try { return JSON.parse(sectionItems); } catch { return []; } })();
                                const exists = current.some((i) => i.sku === p.sku);
                                if (!exists) {
                                  current.push({ titulo: p.nombre, descripcion: p.descripcion || 'Producto artesanal tejido a mano', imagen: p.imagen || null, sku: p.sku });
                                  setSectionItems(JSON.stringify(current, null, 2));
                                }
                                setShowProductPicker(false);
                              }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[#FDF4F7] transition-colors"
                            >
                              {p.imagen && <img src={p.imagen} alt="" className="w-10 h-10 rounded-lg object-cover bg-gray-100 flex-shrink-0" />}
                              <div className="min-w-0 flex-1">
                                <p className="font-quicksand text-xs font-semibold text-gray-800 truncate">{p.nombre}</p>
                                <p className="font-quicksand text-[10px] text-gray-400">{p.sku}</p>
                              </div>
                            </button>
                          ))}
                        {allProducts.length === 0 && (
                          <p className="p-4 text-center font-quicksand text-xs text-gray-400">Cargando productos...</p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {editingSection.section_key === 'campana_rotonda' && (
                <>
                  <hr className="border-gray-100 my-5" />
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-4 bg-[#EE6B8D] rounded-full" />
                    <h4 className="font-quicksand text-sm font-bold text-gray-700">Fotos de la Rotonda (Campañas y Clientes)</h4>
                  </div>
                  <p className="font-quicksand text-xs text-gray-500 mb-4 leading-relaxed">
                    Configura las 4 imágenes que giran en la rotonda 3D para mostrar cómo se vivió la campaña anterior o actual (fotos de clientes recibiendo pedidos, flores amarillas, entregas especiales, etc.).
                  </p>

                  {(() => {
                    const items = (() => {
                      try {
                        const parsed = JSON.parse(sectionItems);
                        return Array.isArray(parsed) && parsed.length > 0 ? parsed : [];
                      } catch {
                        return [];
                      }
                    })();

                    const slots = Array.from({ length: 4 }, (_, idx) => items[idx] || {
                      imagen: "",
                      etiqueta: `Campaña ${idx + 1}`,
                      titulo: "",
                      descripcion: "",
                    });

                    const updateSlot = (idx: number, patch: Record<string, unknown>) => {
                      const updated = [...slots];
                      updated[idx] = { ...updated[idx], ...patch };
                      setSectionItems(JSON.stringify(updated, null, 2));
                    };

                    return (
                      <div className="space-y-4">
                        {slots.map((item, i: number) => (
                          <div key={i} className="p-4 bg-gray-50 rounded-2xl border border-gray-200">
                            <div className="flex items-center justify-between mb-3">
                              <span className="font-quicksand text-xs font-bold text-[#C04267] uppercase tracking-wider flex items-center gap-1.5">
                                <ImageIcon size={13} className="text-[#EE6B8D]" />
                                Foto {i + 1} de la Rotonda
                              </span>
                              {item.imagen && (
                                <span className="font-quicksand text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
                                  Imagen cargada
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                              <div>
                                <label className="font-quicksand text-[11px] font-bold text-gray-600 block mb-1">
                                  Etiqueta de Campaña (Badge)
                                </label>
                                <input
                                  value={item.etiqueta || ""}
                                  onChange={(e) => updateSlot(i, { etiqueta: e.target.value })}
                                  placeholder="Ej: Flores Amarillas, San Valentín..."
                                  className="w-full px-3 py-1.5 border border-gray-200 rounded-lg font-quicksand text-xs focus:outline-none focus:ring-2 focus:ring-[#EE6B8D] bg-white"
                                />
                              </div>
                              <div>
                                <label className="font-quicksand text-[11px] font-bold text-gray-600 block mb-1">
                                  Título
                                </label>
                                <input
                                  value={item.titulo || ""}
                                  onChange={(e) => updateSlot(i, { titulo: e.target.value })}
                                  placeholder="Ej: Así se vivió en Pisco..."
                                  className="w-full px-3 py-1.5 border border-gray-200 rounded-lg font-quicksand text-xs focus:outline-none focus:ring-2 focus:ring-[#EE6B8D] bg-white"
                                />
                              </div>
                            </div>

                            <label className="font-quicksand text-[11px] font-bold text-gray-600 block mb-1">
                              Descripción / Comentario
                            </label>
                            <input
                              value={item.descripcion || ""}
                              onChange={(e) => updateSlot(i, { descripcion: e.target.value })}
                              placeholder="Ej: Fotos de clientes felices recibiendo sus ramos..."
                              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg font-quicksand text-xs focus:outline-none focus:ring-2 focus:ring-[#EE6B8D] bg-white mb-3"
                            />

                            <label className="font-quicksand text-[11px] font-bold text-gray-600 block mb-1">
                              URL de la Imagen o subir archivo
                            </label>
                            <div className="flex gap-2 items-center">
                              <input
                                value={item.imagen || ""}
                                onChange={(e) => updateSlot(i, { imagen: e.target.value })}
                                placeholder="https://..."
                                className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg font-quicksand text-xs focus:outline-none focus:ring-2 focus:ring-[#EE6B8D] bg-white"
                              />
                              <label className="px-3 py-1.5 bg-[#EE6B8D]/10 hover:bg-[#EE6B8D]/20 text-[#C04267] rounded-lg font-quicksand text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 flex-shrink-0">
                                <Upload size={13} />
                                <span>Subir</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    try {
                                      const { getSupabaseBrowserClient } = await import("@/lib/supabase/client");
                                      const supabase = getSupabaseBrowserClient();
                                      const ext = file.name.split(".").pop() || "jpg";
                                      const nombre = `rotonda-${Date.now()}-${i}.${ext}`;
                                      const { error } = await supabase.storage.from("heroes").upload(nombre, file, { upsert: true });
                                      if (error) { console.error(error); return; }
                                      const { data: pub } = supabase.storage.from("heroes").getPublicUrl(nombre);
                                      updateSlot(i, { imagen: pub.publicUrl });
                                    } catch (err) {
                                      console.error(err);
                                    }
                                  }}
                                />
                              </label>
                            </div>

                            {item.imagen && (
                              <div className="mt-2.5 relative aspect-video max-w-[200px] rounded-lg overflow-hidden border border-gray-200 bg-white">
                                <img src={item.imagen} alt="" className="w-full h-full object-cover" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </>
              )}

              {editingSection.section_key === 'evento_productos_rotonda' && (
                <>
                  <hr className="border-gray-100 my-5" />
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-4 bg-[#EE6B8D] rounded-full" />
                    <h4 className="font-quicksand text-sm font-bold text-gray-700">
                      Carrusel 3D de Productos de Campaña
                    </h4>
                  </div>
                  <p className="font-quicksand text-xs text-gray-500 mb-4 leading-relaxed">
                    Este carrusel se ubica justo arriba de Momentos en la portada y muestra los productos del catálogo del evento que esté transcurriendo (con vista 3D de 4 en desktop o 3 si solo hay 3 productos).
                  </p>

                  {(() => {
                    let itemsConfig: EventoRotondaConfig = { evento_slug: "auto", limite: 8 };
                    try {
                      if (sectionItems) {
                        const parsed = JSON.parse(sectionItems);
                        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                          itemsConfig = { ...itemsConfig, ...parsed };
                        }
                      }
                    } catch {}

                    const updateConfig = (patch: Partial<EventoRotondaConfig>) => {
                      const next = { ...itemsConfig, ...patch };
                      setSectionItems(JSON.stringify(next, null, 2));
                    };

                    const selectedSlug = itemsConfig.evento_slug || "auto";
                    const currentEvent = eventos.find((e) => e.activo !== false) || eventos[0];
                    const activeEventSlug = selectedSlug === "auto" ? (currentEvent?.slug || "flores-amarillas") : selectedSlug;
                    const matchedEvent = eventos.find((e) => e.slug?.toLowerCase() === activeEventSlug?.toLowerCase()) || currentEvent;

                    const eventProducts = (rawProducts || []).filter((p) => {
                      if (inactiveIds.has(p.id)) return false;
                      if (Array.isArray(p.catalogos) && p.catalogos.includes(activeEventSlug)) return true;
                      return isProductInSlug(p, activeEventSlug, assignments);
                    });

                    const displayCount = eventProducts.length;

                    return (
                      <div className="space-y-4">
                        <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-3">
                          <div>
                            <label className="font-quicksand text-xs font-bold text-gray-700 block mb-1">
                              Evento o Campaña a Mostrar
                            </label>
                            <select
                              value={selectedSlug}
                              onChange={(e) => updateConfig({ evento_slug: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-200 rounded-xl font-quicksand text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#EE6B8D] bg-white text-gray-700"
                            >
                              <option value="auto">
                                Automático: Detectar evento activo actual ({currentEvent?.nombre || "Campaña vigente"})
                              </option>
                              {eventos.map((ev) => (
                                <option key={ev.slug || ev.id} value={ev.slug || ""}>
                                  Fijar: {ev.nombre} ({ev.slug})
                                </option>
                              ))}
                            </select>
                            <p className="font-quicksand text-[11px] text-gray-400 mt-1">
                              En modo automático tomará el evento que esté activo en el calendario o marcado como destacado.
                            </p>
                          </div>

                          <div>
                            <label className="font-quicksand text-xs font-bold text-gray-700 block mb-1">
                              Límite Máximo de Productos
                            </label>
                            <select
                              value={itemsConfig.limite || 8}
                              onChange={(e) => updateConfig({ limite: Number(e.target.value) })}
                              className="w-full px-3 py-2 border border-gray-200 rounded-xl font-quicksand text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#EE6B8D] bg-white text-gray-700"
                            >
                              <option value={3}>3 productos (Modo 3D: 1 adelante y dos a los costados)</option>
                              <option value={4}>4 productos (Rotonda completa de 4)</option>
                              <option value={6}>6 productos</option>
                              <option value={8}>8 productos (Recomendado)</option>
                              <option value={12}>12 productos</option>
                            </select>
                          </div>
                        </div>

                        <div className="p-4 bg-pink-50/50 rounded-2xl border border-pink-100">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-quicksand text-xs font-bold text-[#C04267] flex items-center gap-1.5">
                              <Package size={14} className="text-[#EE6B8D]" />
                              Productos Detectados: {matchedEvent?.nombre || activeEventSlug} ({displayCount})
                            </span>
                            <span className="font-quicksand text-[11px] font-semibold text-gray-600 bg-white px-2 py-0.5 rounded-full border border-pink-100">
                              {displayCount === 3
                                ? "Modo 3D de 3 (1 adelante y 2 costados)"
                                : displayCount > 3
                                ? "Modo 3D de 4 (2 centro y 2 laterales)"
                                : `${displayCount} productos`}
                            </span>
                          </div>

                          {displayCount > 0 ? (
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 mt-3">
                              {eventProducts.slice(0, itemsConfig.limite || 8).map((p, pIdx: number) => (
                                <div key={p.id || pIdx} className="bg-white rounded-xl p-2 border border-pink-100 shadow-2xs flex flex-col items-center text-center">
                                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 mb-1.5 relative">
                                    <img src={p.imagen || "/logo.png"} alt="" className="w-full h-full object-cover" />
                                  </div>
                                  <span className="font-quicksand text-[11px] font-bold text-gray-700 line-clamp-1">
                                    {p.nombre}
                                  </span>
                                  <span className="font-quicksand text-[10px] text-[#EE6B8D] font-bold">
                                    S/ {Number(p.precio || 0).toFixed(2)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="font-quicksand text-xs text-amber-700 mt-1">
                              Aún no hay productos asignados al catálogo de este evento. Puedes asignarlos en la sección <b>Catálogo → Visibilidad de Productos</b>.
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}

              {editingSection.tipo === 'personalizados' && (
                <>
                  <hr className="border-gray-100 my-5" />
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-4 bg-[#C04267] rounded-full" />
                    <h4 className="font-quicksand text-sm font-bold text-gray-700">Hero de Personalizados</h4>
                  </div>

                  <label className="font-quicksand text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5 block">Badge</label>
                  <input value={persBadge} onChange={(e) => setPersBadge(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg font-quicksand text-sm focus:outline-none focus:ring-2 focus:ring-[#EE6B8D] mb-3"
                  />

                  <label className="font-quicksand text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5 block">Línea 1 del título</label>
                  <input value={persTituloLinea1} onChange={(e) => setPersTituloLinea1(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg font-quicksand text-sm focus:outline-none focus:ring-2 focus:ring-[#EE6B8D] mb-3"
                  />

                  <label className="font-quicksand text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5 block">Línea 2 del título (color rosa)</label>
                  <input value={persTituloLinea2} onChange={(e) => setPersTituloLinea2(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg font-quicksand text-sm focus:outline-none focus:ring-2 focus:ring-[#EE6B8D] mb-3"
                  />

                  <label className="font-quicksand text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5 block">Texto botón primario (sin sesión)</label>
                  <input value={persBotonPrimario} onChange={(e) => setPersBotonPrimario(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg font-quicksand text-sm focus:outline-none focus:ring-2 focus:ring-[#EE6B8D] mb-3"
                  />

                  <label className="font-quicksand text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5 block">Texto botón primario (con sesión)</label>
                  <input value={persBotonPrimarioLogged} onChange={(e) => setPersBotonPrimarioLogged(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg font-quicksand text-sm focus:outline-none focus:ring-2 focus:ring-[#EE6B8D] mb-3"
                  />

                  <label className="font-quicksand text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5 block">Texto botón secundario</label>
                  <input value={persBotonSecundario} onChange={(e) => setPersBotonSecundario(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg font-quicksand text-sm focus:outline-none focus:ring-2 focus:ring-[#EE6B8D] mb-3"
                  />

                  <label className="font-quicksand text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5 block">Estadística</label>
                  <input value={persEstadistica} onChange={(e) => setPersEstadistica(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg font-quicksand text-sm focus:outline-none focus:ring-2 focus:ring-[#EE6B8D] mb-3"
                  />

                  <label className="font-quicksand text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5 block">Etiqueta del precio</label>
                  <input value={persEtiquetaPrecio} onChange={(e) => setPersEtiquetaPrecio(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg font-quicksand text-sm focus:outline-none focus:ring-2 focus:ring-[#EE6B8D] mb-3"
                  />

                  <label className="font-quicksand text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5 block">Valor del precio</label>
                  <input value={persValorPrecio} onChange={(e) => setPersValorPrecio(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg font-quicksand text-sm focus:outline-none focus:ring-2 focus:ring-[#EE6B8D] mb-4"
                  />
                </>
              )}

              <div className="flex gap-3">
                <button onClick={() => setEditingSection(null)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-lg font-quicksand text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button onClick={handleSectionSave}
                  className="flex-1 py-2.5 bg-[#EE6B8D] hover:bg-[#C04267] text-white rounded-lg font-quicksand text-sm font-semibold transition-colors"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de edición de evento */}
        {editingEvento !== null && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            onClick={() => setEditingEvento(null)}
          >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-fredoka text-lg font-bold text-[#C04267]">
                  {isNewEvento ? "Crear evento" : "Editar evento"}
                </h3>
                <button onClick={() => setEditingEvento(null)}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <label className="font-quicksand text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5 block">Nombre</label>
              <input value={editEventoNombre} onChange={(e) => {
                setEditEventoNombre(e.target.value);
                if (isNewEvento) setEditEventoSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
              }}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg font-quicksand text-sm focus:outline-none focus:ring-2 focus:ring-[#EE6B8D] mb-4"
              />

              <label className="font-quicksand text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5 block">Slug (URL)</label>
              <input value={editEventoSlug} onChange={(e) => setEditEventoSlug(e.target.value)}
                placeholder="ej: mi-evento"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg font-quicksand text-sm focus:outline-none focus:ring-2 focus:ring-[#EE6B8D] mb-4"
              />
              <p className="font-quicksand text-[10px] text-gray-400 -mt-3 mb-4">Se generará como /evento/{editEventoSlug || "mi-evento"}</p>

              <label className="font-quicksand text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5 block">Descripción</label>
              <textarea value={editEventoDescripcion} onChange={(e) => setEditEventoDescripcion(e.target.value)}
                rows={3}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg font-quicksand text-sm focus:outline-none focus:ring-2 focus:ring-[#EE6B8D] mb-4 resize-none"
              />

              {/* Vigencia y Fechas del Evento (Día y Mes) */}
              {(() => {
                const precedingList = getPrecedingEvents(editingEvento?.id, data);
                const currentPrevEvent =
                  precedingList.find((p) => String(p.id) === String(selectedPrevEventoId)) ||
                  getClosestPrecedingEvent(editingEvento?.id, editEventoMesFin, editEventoDiaFin, data);

                const handleFechaFinChange = (newDia: string, newMes: string) => {
                  setEditEventoDiaFin(newDia);
                  setEditEventoMesFin(newMes);

                  if (editEventoModoInicio === "auto") {
                    const closest = getClosestPrecedingEvent(editingEvento?.id, newMes, newDia, data);
                    if (closest && closest.fecha_fin) {
                      const df = new Date(closest.fecha_fin);
                      setEditEventoDiaInicio(String(df.getDate()));
                      setEditEventoMesInicio(String(df.getMonth() + 1));
                      setSelectedPrevEventoId(closest.id);
                    }
                  }
                };

                return (
                  <div className="bg-[#FFF8FA] border border-[#EE6B8D]/25 rounded-2xl p-4 mb-5 shadow-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="text-[#C04267]" size={16} />
                      <h4 className="font-quicksand text-xs font-bold text-[#C04267] uppercase tracking-wider">
                        Vigencia del Evento (Día y Mes)
                      </h4>
                    </div>
                    <p className="font-quicksand text-xs text-gray-500 mb-3 leading-relaxed">
                      Elige solo el día y mes. El año actual ({new Date().getFullYear()}) se toma automáticamente. El evento toma como inicio el término del evento más cercano.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                      {/* Fecha de inicio */}
                      {editEventoModoInicio === "auto" && currentPrevEvent ? (
                        <div className="bg-[#FFF0F5] p-3.5 rounded-xl border border-[#EE6B8D]/30 shadow-xs flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="font-quicksand text-[11px] font-bold text-[#C04267] flex items-center gap-1">
                                <CheckCircle2 size={13} className="text-[#EE6B8D]" />
                                Fecha de inicio (Automática)
                              </label>
                              <button
                                type="button"
                                onClick={() => setEditEventoModoInicio("manual")}
                                className="font-quicksand text-[10px] font-semibold text-gray-500 hover:text-[#EE6B8D] underline"
                              >
                                Manual
                              </button>
                            </div>
                            <p className="font-quicksand text-xs font-bold text-[#C04267] mt-0.5">
                              {editEventoDiaInicio} de {MESES.find((m) => m.val === editEventoMesInicio)?.name || "Mes"}
                            </p>
                            <p className="font-quicksand text-[10px] text-gray-600 mt-1 leading-tight">
                              Toma el día de fin de <strong>&quot;{currentPrevEvent.nombre}&quot;</strong> ({formatEventoFecha(currentPrevEvent.fecha_fin)}).
                            </p>
                          </div>

                          {precedingList.length > 1 && (
                            <div className="mt-2 pt-2 border-t border-[#EE6B8D]/15">
                              <span className="font-quicksand text-[9px] text-gray-400 block mb-0.5">Cambiar evento del que inicia:</span>
                              <select
                                value={selectedPrevEventoId || currentPrevEvent.id}
                                onChange={(e) => {
                                  const selId = e.target.value;
                                  setSelectedPrevEventoId(selId);
                                  const ev = precedingList.find((p) => String(p.id) === String(selId));
                                  if (ev && ev.fecha_fin) {
                                    const df = new Date(ev.fecha_fin);
                                    setEditEventoDiaInicio(String(df.getDate()));
                                    setEditEventoMesInicio(String(df.getMonth() + 1));
                                  }
                                }}
                                className="w-full px-2 py-1 text-[11px] border border-gray-200 rounded font-quicksand bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#EE6B8D]"
                              >
                                {precedingList.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.nombre} (fin: {formatEventoFecha(p.fecha_fin)})
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-xs">
                          <div className="flex items-center justify-between mb-2">
                            <label className="font-quicksand text-[11px] font-bold text-gray-700 block">
                              Fecha de inicio
                            </label>
                            {precedingList.length > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditEventoModoInicio("auto");
                                  const closest = getClosestPrecedingEvent(editingEvento?.id, editEventoMesFin, editEventoDiaFin, data);
                                  if (closest && closest.fecha_fin) {
                                    const df = new Date(closest.fecha_fin);
                                    setEditEventoDiaInicio(String(df.getDate()));
                                    setEditEventoMesInicio(String(df.getMonth() + 1));
                                    setSelectedPrevEventoId(closest.id);
                                  }
                                }}
                                className="font-quicksand text-[10px] text-[#EE6B8D] font-semibold hover:underline"
                              >
                                Vincular a evento previo
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="font-quicksand text-[10px] text-gray-400 block mb-1">Día</span>
                              <select
                                value={editEventoDiaInicio}
                                onChange={(e) => setEditEventoDiaInicio(e.target.value)}
                                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg font-quicksand text-xs focus:outline-none focus:ring-2 focus:ring-[#EE6B8D] bg-gray-50"
                              >
                                <option value="">- Día -</option>
                                {Array.from({ length: 31 }, (_, i) => String(i + 1)).map((d) => (
                                  <option key={d} value={d}>{d}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <span className="font-quicksand text-[10px] text-gray-400 block mb-1">Mes</span>
                              <select
                                value={editEventoMesInicio}
                                onChange={(e) => setEditEventoMesInicio(e.target.value)}
                                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg font-quicksand text-xs focus:outline-none focus:ring-2 focus:ring-[#EE6B8D] bg-gray-50"
                              >
                                <option value="">- Mes -</option>
                                {MESES.map((m) => (
                                  <option key={m.val} value={m.val}>{m.name}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <span className="font-quicksand text-[10px] text-gray-400 mt-1.5 block">
                            {precedingList.length === 0 ? "Primer evento del año" : "Fecha manual"}
                          </span>
                        </div>
                      )}

                      {/* Fecha de fin */}
                      <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-xs">
                        <label className="font-quicksand text-[11px] font-bold text-gray-700 block mb-2">
                          Fecha de fin (eliminar banner)
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="font-quicksand text-[10px] text-gray-400 block mb-1">Día</span>
                            <select
                              value={editEventoDiaFin}
                              onChange={(e) => handleFechaFinChange(e.target.value, editEventoMesFin)}
                              className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg font-quicksand text-xs focus:outline-none focus:ring-2 focus:ring-[#EE6B8D] bg-gray-50"
                            >
                              <option value="">- Día -</option>
                              {Array.from({ length: 31 }, (_, i) => String(i + 1)).map((d) => (
                                <option key={d} value={d}>{d}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <span className="font-quicksand text-[10px] text-gray-400 block mb-1">Mes</span>
                            <select
                              value={editEventoMesFin}
                              onChange={(e) => handleFechaFinChange(editEventoDiaFin, e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg font-quicksand text-xs focus:outline-none focus:ring-2 focus:ring-[#EE6B8D] bg-gray-50"
                            >
                              <option value="">- Mes -</option>
                              {MESES.map((m) => (
                                <option key={m.val} value={m.val}>{m.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <span className="font-quicksand text-[10px] text-gray-400 mt-1.5 block">Vacío = Permanente</span>
                      </div>
                    </div>

                    {(editEventoDiaInicio || editEventoDiaFin) && (
                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditEventoDiaInicio("");
                            setEditEventoMesInicio("");
                            setEditEventoDiaFin("");
                            setEditEventoMesFin("");
                            setEditEventoModoInicio("manual");
                            setSelectedPrevEventoId(null);
                          }}
                          className="font-quicksand text-[10px] text-gray-400 hover:text-red-500 underline"
                        >
                          Limpiar fechas
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Banner Desktop */}
              <label className="font-quicksand text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5 block">
                Banner Principal (Hero - PC / Desktop) <span className="text-gray-400 font-normal normal-case">(1200×675px o horizontal)</span>
              </label>
              <input value={editEventoImagen} onChange={(e) => setEditEventoImagen(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg font-quicksand text-sm focus:outline-none focus:ring-2 focus:ring-[#EE6B8D] mb-3"
              />

              <div
                onDragOver={(e) => { e.preventDefault(); setHeroDragOver(4); }}
                onDragLeave={() => setHeroDragOver(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setHeroDragOver(null);
                  const file = e.dataTransfer.files?.[0];
                  if (file?.type.startsWith("image/")) subirEventoImg(file);
                  const text = e.dataTransfer.getData("text");
                  if (text && esUrlImagen(text)) setEditEventoImagen(text.trim());
                }}
                onPaste={(e) => {
                  const items = e.clipboardData?.items;
                  if (!items) return;
                  for (const item of Array.from(items)) {
                    if (item.type.startsWith("image/")) {
                      const file = item.getAsFile();
                      if (file) { e.preventDefault(); subirEventoImg(file); return; }
                    }
                    if (item.type === "text/plain") {
                      const text = e.clipboardData.getData("text");
                      if (esUrlImagen(text)) { e.preventDefault(); setEditEventoImagen(text.trim()); return; }
                    }
                  }
                }}
                onClick={() => eventoImgRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all mb-4 ${
                  heroDragOver === 4 ? "border-[#EE6B8D] bg-[#FDF4F7]" : "border-gray-200 hover:border-[#EE6B8D] hover:bg-[#FDF4F7]/50"
                }`}
              >
                <input
                  ref={eventoImgRef}
                  type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) subirEventoImg(f); }}
                />
                {eventoImgUploading ? (
                  <Loader2 size={22} className="mx-auto animate-spin text-[#EE6B8D]" />
                ) : (
                  <>
                    <Upload size={22} className="mx-auto text-[#EE6B8D] mb-1" />
                    <p className="font-quicksand text-xs font-semibold text-gray-700">Subir Banner Desktop (Click, arrastra o pega)</p>
                    <p className="font-quicksand text-[10px] text-gray-400 mt-0.5">Recomendado formato horizontal</p>
                  </>
                )}
              </div>

              {editEventoImagen && (
                <div className="relative aspect-video rounded-xl bg-gray-50 border border-gray-200 overflow-hidden mb-4 group">
                  <img src={editEventoImagen} alt="" className="w-full h-full object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).src = ""; }}
                  />
                  <button onClick={() => setEditEventoImagen("")}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-red-600"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Banner Móvil (Vertical) */}
              <label className="font-quicksand text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5 block">
                Banner Móvil (Hero - Celulares) <span className="text-gray-400 font-normal normal-case">(Opcional, vertical 800×1000px)</span>
              </label>
              <input value={editEventoImagenMobile} onChange={(e) => setEditEventoImagenMobile(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg font-quicksand text-sm focus:outline-none focus:ring-2 focus:ring-[#EE6B8D] mb-3"
              />

              <div
                onDragOver={(e) => { e.preventDefault(); setHeroDragOver(5); }}
                onDragLeave={() => setHeroDragOver(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setHeroDragOver(null);
                  const file = e.dataTransfer.files?.[0];
                  if (file?.type.startsWith("image/")) subirEventoImgMobile(file);
                  const text = e.dataTransfer.getData("text");
                  if (text && esUrlImagen(text)) setEditEventoImagenMobile(text.trim());
                }}
                onPaste={(e) => {
                  const items = e.clipboardData?.items;
                  if (!items) return;
                  for (const item of Array.from(items)) {
                    if (item.type.startsWith("image/")) {
                      const file = item.getAsFile();
                      if (file) { e.preventDefault(); subirEventoImgMobile(file); return; }
                    }
                    if (item.type === "text/plain") {
                      const text = e.clipboardData.getData("text");
                      if (esUrlImagen(text)) { e.preventDefault(); setEditEventoImagenMobile(text.trim()); return; }
                    }
                  }
                }}
                onClick={() => eventoImgMobileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all mb-4 ${
                  heroDragOver === 5 ? "border-[#EE6B8D] bg-[#FDF4F7]" : "border-gray-200 hover:border-[#EE6B8D] hover:bg-[#FDF4F7]/50"
                }`}
              >
                <input
                  ref={eventoImgMobileRef}
                  type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) subirEventoImgMobile(f); }}
                />
                {eventoImgMobileUploading ? (
                  <Loader2 size={22} className="mx-auto animate-spin text-[#EE6B8D]" />
                ) : (
                  <>
                    <Upload size={22} className="mx-auto text-[#EE6B8D] mb-1" />
                    <p className="font-quicksand text-xs font-semibold text-gray-700">Subir Banner Móvil (Click, arrastra o pega)</p>
                    <p className="font-quicksand text-[10px] text-gray-400 mt-0.5">Se verá en pantallas de celulares</p>
                  </>
                )}
              </div>

              {editEventoImagenMobile && (
                <div className="relative aspect-[3/4] max-w-[200px] mx-auto rounded-xl bg-gray-50 border border-gray-200 overflow-hidden mb-4 group">
                  <img src={editEventoImagenMobile} alt="" className="w-full h-full object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).src = ""; }}
                  />
                  <button onClick={() => setEditEventoImagenMobile("")}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-red-600"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Fotos de Campaña para la Galería Rotonda 3D */}
              <div className="border-t border-gray-100 pt-5 pb-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Camera size={16} className="text-[#EE6B8D]" />
                    <label className="font-quicksand text-xs font-bold text-gray-700 uppercase tracking-wider block">
                      Fotos de Campaña / Entregas (Rotonda de Portada)
                    </label>
                  </div>
                  {editEventoFotosCampana.length > 0 && (
                    <span className="font-quicksand text-xs font-bold text-[#C04267] bg-pink-100/70 px-2.5 py-0.5 rounded-full">
                      {editEventoFotosCampana.length} {editEventoFotosCampana.length === 1 ? "foto" : "fotos"}
                    </span>
                  )}
                </div>
                <p className="font-quicksand text-[11px] text-gray-500 mb-3 leading-relaxed">
                  Sube las fotos de clientes y entregas de esta campaña para el carrusel de inicio. Puedes seleccionar todas las que quieras a la vez.
                </p>

                {/* BOTÓN ÚNICO DE SUBIDA */}
                <label className="w-full flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed border-[#EE6B8D]/40 bg-[#FDF4F7]/60 hover:bg-[#FDF4F7] hover:border-[#EE6B8D] cursor-pointer transition-all text-center group mb-4">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length === 0) return;
                      setUploadingCampanaIdx(999);
                      try {
                        const { getSupabaseBrowserClient } = await import("@/lib/supabase/client");
                        const supabase = getSupabaseBrowserClient();
                        const uploadPromises = files.map(async (file, idx): Promise<CampanaFoto | null> => {
                          const ext = file.name.split(".").pop() || "jpg";
                          const nombre = `campana-${Date.now()}-${idx}-${Math.random().toString(36).slice(2)}.${ext}`;
                          const { error } = await supabase.storage.from("heroes").upload(nombre, file, { upsert: true });
                          if (error) return null;
                          const { data: pub } = supabase.storage.from("heroes").getPublicUrl(nombre);
                          return {
                            url: pub.publicUrl,
                            titulo: editEventoNombre || "Momento especial",
                            etiqueta: editEventoNombre || "Campaña",
                          };
                        });
                        const uploaded = (await Promise.all(uploadPromises)).filter((f): f is CampanaFoto => f !== null);
                        setEditEventoFotosCampana((prev) => [...(prev || []), ...uploaded]);
                      } catch (err) {
                        console.error(err);
                      } finally {
                        setUploadingCampanaIdx(null);
                      }
                    }}
                  />
                  {uploadingCampanaIdx === 999 ? (
                    <div className="flex items-center gap-2 text-[#C04267] font-quicksand font-bold text-xs py-1">
                      <Loader2 size={18} className="animate-spin text-[#EE6B8D]" />
                      <span>Subiendo fotos a la vez...</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 text-[#C04267] font-quicksand font-bold text-xs mb-0.5">
                        <Upload size={18} className="text-[#EE6B8D]" />
                        <span>Subir fotos de campaña (puedes seleccionar varias a la vez)</span>
                      </div>
                      <span className="font-quicksand text-[11px] text-gray-500">
                        Click para elegir las fotos desde tu dispositivo
                      </span>
                    </>
                  )}
                </label>

                {/* GALERÍA DE FOTOS SUBIDAS */}
                {editEventoFotosCampana.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5 mb-3">
                    {editEventoFotosCampana.map((foto, idx: number) => {
                      const src = typeof foto === "string" ? foto : foto?.url;
                      if (!src) return null;
                      return (
                        <div key={idx} className="relative aspect-[3/4] rounded-xl overflow-hidden border border-pink-200 bg-gray-100 group shadow-xs">
                          <img src={src} alt="" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => {
                              setEditEventoFotosCampana((prev) => prev.filter((_, i) => i !== idx));
                            }}
                            className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Eliminar foto"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Catálogo Oficial del Evento (PDF o Enlace) */}
              <div className="border-t border-gray-100 pt-5 pb-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-[#EE6B8D]" />
                    <label className="font-quicksand text-xs font-bold text-gray-700 uppercase tracking-wider block">
                      Catálogo Oficial del Evento (PDF o Enlace)
                    </label>
                  </div>
                  {editEventoCatalogoUrl && (
                    <span className="font-quicksand text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <Check size={11} /> Catálogo listo
                    </span>
                  )}
                </div>
                <p className="font-quicksand text-[11px] text-gray-500 mb-3 leading-relaxed">
                  Los clientes podrán descargar este catálogo desde el botón flotante en el inicio y en la página de este evento.
                </p>

                <div className="space-y-3">
                  {/* Botón para subir archivo directo a Supabase Storage */}
                  <label className="w-full flex items-center justify-between p-3 rounded-xl border border-dashed border-[#EE6B8D]/50 bg-[#FDF4F7]/60 hover:bg-[#FDF4F7] cursor-pointer transition-all">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#FDE8EF] text-[#C04267] flex items-center justify-center shrink-0">
                        {uploadingCatalogo ? <Loader2 size={16} className="animate-spin text-[#EE6B8D]" /> : <Upload size={16} />}
                      </div>
                      <div>
                        <p className="font-quicksand font-bold text-xs text-[#C04267]">
                          {uploadingCatalogo ? "Subiendo archivo del catálogo..." : "Subir archivo (PDF, PPT o Imagen) desde tu equipo"}
                        </p>
                        <p className="font-quicksand text-[11px] text-gray-500">
                          Formatos aceptados: PDF, PowerPoint (PPT, PPTX) e imágenes (JPG, PNG, WebP)
                        </p>
                      </div>
                    </div>
                    <input
                      type="file"
                      accept=".pdf,application/pdf,image/*,.ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                      disabled={uploadingCatalogo}
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploadingCatalogo(true);
                        try {
                          const { getSupabaseBrowserClient } = await import("@/lib/supabase/client");
                          const supabase = getSupabaseBrowserClient();
                          const ext = file.name.split(".").pop() || "pdf";
                          const nombre = `catalogo-${editEventoSlug || "evento"}-${Date.now()}.${ext}`;
                          const { error } = await supabase.storage.from("heroes").upload(nombre, file, {
                            upsert: true,
                            contentType: file.type || undefined,
                          });
                          if (error) {
                            alert("Error al subir el catálogo: " + error.message);
                            return;
                          }
                          const { data: pub } = supabase.storage.from("heroes").getPublicUrl(nombre);
                          setEditEventoCatalogoUrl(pub.publicUrl);
                        } catch (err) {
                          alert("Error inesperado al subir catálogo");
                        } finally {
                          setUploadingCatalogo(false);
                        }
                      }}
                    />
                  </label>

                  {/* Input manual para pegar enlace externo (Canva, Google Drive, etc.) */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="O pega aquí un enlace directo (ej. Google Drive, Canva, link público)"
                      value={editEventoCatalogoUrl}
                      onChange={(e) => setEditEventoCatalogoUrl(e.target.value)}
                      className="flex-1 px-3.5 py-2 text-xs border border-gray-200 rounded-lg font-quicksand text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#EE6B8D]"
                    />
                    {editEventoCatalogoUrl && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <a
                          href={editEventoCatalogoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-2 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-quicksand flex items-center gap-1 transition-colors"
                          title="Abrir enlace"
                        >
                          <ExternalLink size={12} />
                          Ver
                        </a>
                        <button
                          type="button"
                          onClick={() => setEditEventoCatalogoUrl("")}
                          className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                          title="Quitar catálogo"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Opciones adicionales */}
              <div className="space-y-2.5 border-t border-gray-100 pt-4 mb-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="evento-destacado-rotonda"
                    checked={editEventoDestacadoRotonda}
                    onChange={(e) => setEditEventoDestacadoRotonda(e.target.checked)}
                    className="w-4 h-4 accent-[#EE6B8D] rounded"
                  />
                  <label htmlFor="evento-destacado-rotonda" className="font-quicksand text-xs font-semibold text-gray-700 cursor-pointer">
                    Mostrar en carrusel de inicio &quot;Así se vivió...&quot; (Evento elegido para la rotonda de la portada)
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="evento-mostrar-hero"
                    checked={editEventoMostrarEnHero}
                    onChange={(e) => setEditEventoMostrarEnHero(e.target.checked)}
                    className="w-4 h-4 accent-[#EE6B8D] rounded"
                  />
                  <label htmlFor="evento-mostrar-hero" className="font-quicksand text-xs font-semibold text-gray-700 cursor-pointer">
                    Mostrar en el Banner Principal (Hero) de la portada mientras esté vigente
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="evento-destacado"
                    checked={editEventoFeatured}
                    onChange={(e) => setEditEventoFeatured(e.target.checked)}
                    className="w-4 h-4 accent-[#EE6B8D] rounded"
                  />
                  <label htmlFor="evento-destacado" className="font-quicksand text-xs font-semibold text-gray-700 cursor-pointer">
                    Destacar en la barra superior (Navbar)
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="evento-activo"
                    checked={editEventoActivo}
                    onChange={(e) => setEditEventoActivo(e.target.checked)}
                    className="w-4 h-4 accent-[#EE6B8D] rounded"
                  />
                  <label htmlFor="evento-activo" className="font-quicksand text-xs font-semibold text-gray-700 cursor-pointer">
                    Evento activo
                  </label>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                {!isNewEvento && (
                  <button onClick={async () => {
                    if (!confirm("¿Eliminar este evento?")) return;
                    const ok = await apiPatch({ action: "eliminar-evento", id: editingEvento.id });
                    if (ok) { fetchData(); setEditingEvento(null); }
                  }}
                    className="px-4 py-2.5 border border-red-200 rounded-lg font-quicksand text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={14} className="inline mr-1" />
                    Eliminar
                  </button>
                )}
                <div className="flex-1" />
                <button onClick={() => setEditingEvento(null)}
                  className="px-4 py-2.5 border border-gray-200 rounded-lg font-quicksand text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button onClick={async () => {
                  const currentYear = new Date().getFullYear();
                  let inicioIso: string | null = null;
                  let finIso: string | null = null;

                  if (editEventoDiaFin && editEventoMesFin) {
                    const dFin = new Date(currentYear, Number(editEventoMesFin) - 1, Number(editEventoDiaFin), 23, 59, 59);
                    finIso = dFin.toISOString();
                  }

                  if (editEventoDiaInicio && editEventoMesInicio) {
                    const hour = editEventoModoInicio === "auto" ? 23 : 0;
                    const min = editEventoModoInicio === "auto" ? 59 : 0;
                    const sec = editEventoModoInicio === "auto" ? 59 : 0;
                    const dInicio = new Date(currentYear, Number(editEventoMesInicio) - 1, Number(editEventoDiaInicio), hour, min, sec);
                    inicioIso = dInicio.toISOString();
                  }

                  if (inicioIso && finIso) {
                    if (new Date(finIso).getTime() < new Date(inicioIso).getTime()) {
                      alert("La fecha de fin no puede ser anterior a la fecha de inicio.");
                      return;
                    }
                  }

                  const fotosLimpias = (editEventoFotosCampana || [])
                    .map((f) => (typeof f === "string" ? { url: f } : f))
                    .filter((f) => Boolean(f?.url && f.url.trim()));

                  if (isNewEvento) {
                    const res = await fetch("/api/admin", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        nombre: editEventoNombre,
                        slug: editEventoSlug,
                        descripcion: editEventoDescripcion || null,
                        imagen_url: editEventoImagen || null,
                        imagen_url_mobile: editEventoImagenMobile || null,
                        fecha_inicio: inicioIso,
                        fecha_fin: finIso,
                        mostrar_en_hero: editEventoMostrarEnHero,
                        activo: editEventoActivo,
                        featured: editEventoFeatured,
                        destacado_rotonda: editEventoDestacadoRotonda,
                        catalogo_url: editEventoCatalogoUrl || null,
                        fotos_campana: fotosLimpias,
                      }),
                    });
                    if (res.ok) { fetchData(); setEditingEvento(null); }
                  } else {
    const updateData: Record<string, unknown> = {
                      nombre: editEventoNombre,
                      slug: editEventoSlug,
                      descripcion: editEventoDescripcion || null,
                      imagen_url: editEventoImagen || null,
                      imagen_url_mobile: editEventoImagenMobile || null,
                      fecha_inicio: inicioIso,
                      fecha_fin: finIso,
                      mostrar_en_hero: editEventoMostrarEnHero,
                      activo: editEventoActivo,
                      destacado_rotonda: editEventoDestacadoRotonda,
                      catalogo_url: editEventoCatalogoUrl || null,
                      fotos_campana: fotosLimpias,
                    };
                    if (editEventoFeatured) {
                      await apiPatch({ action: "destacar-evento", id: editingEvento.id, slug: editEventoSlug, nombre: editEventoNombre });
                    } else {
                      updateData.featured = false;
                    }
                    const ok = await apiPatch({ action: "actualizar-evento", id: editingEvento.id, ...updateData });
                    if (ok) { fetchData(); setEditingEvento(null); }
                  }
                }}
                  className="px-6 py-2.5 bg-[#EE6B8D] hover:bg-[#C04267] text-white rounded-lg font-quicksand text-xs font-semibold transition-colors shadow-sm"
                >
                  {isNewEvento ? "Crear evento" : "Guardar cambios"}
                </button>
              </div>
            </div>
          </div>
        )}

        {(mainTab === "catalogo" || mainTab === "eventos" || mainTab === "dashboard") && subTab === "catalogos" && !loading && (() => {
          // Eventos disponibles
          const activeFeaturedEvent = eventos.find((e) => e.featured && e.activo !== false) || eventos.find((e) => e.activo !== false) || eventos[0];
          const resolvedCurrentEventSlug = portadaEventoSlug === "auto" ? (activeFeaturedEvent?.slug || "dia-del-novio") : portadaEventoSlug;
          const currentEventObj = eventos.find((e) => e.slug === resolvedCurrentEventSlug) || activeFeaturedEvent;

          // Productos del evento
          const eventProducts = rawProducts.filter((p) => isProductInSlug(p, resolvedCurrentEventSlug, assignments));

          // Productos filtrados según categoría y búsqueda
          const filteredRawProducts = rawProducts.filter((p) => {
            // Filtro por categoría o evento
            if (portadaCategoryFilter === "evento") {
              if (!isProductInSlug(p, resolvedCurrentEventSlug, assignments)) return false;
            } else if (portadaCategoryFilter !== "todos") {
              if (!isProductInSlug(p, portadaCategoryFilter, assignments)) return false;
            }

            // Filtro por búsqueda
            if (portadaProductSearch.trim()) {
              const q = portadaProductSearch.toLowerCase();
              const name = (p.nombre || p.title || "").toLowerCase();
              const sku = (p.sku || "").toLowerCase();
              if (!name.includes(q) && !sku.includes(q)) return false;
            }

            return true;
          });

          const totalItemsCount = portadaSelectedIds.size > 0 
            ? portadaSelectedIds.size + portadaCustomImages.length 
            : eventProducts.length + portadaCustomImages.length;

          return (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-fredoka text-xl font-bold text-[#C04267] flex items-center gap-2">
                    <Layers size={22} className="text-[#EE6B8D]" />
                    Catálogo y Carrusel 3D de Portada
                  </h2>
                  <p className="font-quicksand text-xs text-gray-500 mt-1 max-w-2xl">
                    Elige los productos o sube imágenes de catálogo que se lucirán en la rotonda 3D ubicada justo arriba de &quot;Momentos&quot; en la página principal.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleSavePortadaConfig()}
                    disabled={portadaSaving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#EE6B8D] hover:bg-[#C04267] text-white rounded-xl font-quicksand font-bold text-xs shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    {portadaSaving ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Guardando...</span>
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        <span>Guardar Cambios de Portada</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Interruptor de Visibilidad en el Landing */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white rounded-2xl border border-[#FDE8EF] shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                    portadaActivo ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-400"
                  }`}>
                    <Eye size={22} />
                  </div>
                  <div>
                    <h4 className="font-quicksand text-sm font-bold text-gray-800">
                      Visibilidad del Carrusel en la Portada (Landing)
                    </h4>
                    <p className="font-quicksand text-xs text-gray-500 mt-0.5">
                      {portadaActivo
                        ? "El carrusel de productos se muestra actualmente en la página principal (arriba de Momentos)."
                        : "El carrusel está actualmente DESACTIVADO y oculto para los clientes en la portada."}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className={`font-quicksand text-xs font-bold px-3 py-1 rounded-full border ${
                    portadaActivo
                      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                      : "text-gray-500 bg-gray-100 border-gray-200"
                  }`}>
                    {portadaActivo ? "Visible en Landing" : "Oculto en Landing"}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleTogglePortadaActivo(!portadaActivo)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                      portadaActivo ? "bg-[#C04267]" : "bg-gray-300"
                    }`}
                    aria-label="Alternar visibilidad en la portada"
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        portadaActivo ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Tarjeta de Evento Principal Activo y Modo Rotonda */}
              <div className="bg-white rounded-2xl border border-[#FDE8EF] p-5 shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-[#FDF4F7] border border-[#FDE8EF] flex items-center justify-center text-[#C04267] shrink-0">
                      <Layers size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-quicksand text-[11px] font-bold uppercase tracking-wider text-[#EE6B8D] bg-[#FDF4F7] px-2.5 py-0.5 rounded-full border border-[#FDE8EF]">
                          Evento Principal de la Tienda
                        </span>
                        {currentEventObj?.featured && (
                          <span className="font-quicksand text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            Activo y Destacado
                          </span>
                        )}
                      </div>
                      <h3 className="font-fredoka text-lg font-bold text-gray-800 mt-0.5">
                        {currentEventObj?.nombre || "Evento Principal"}
                      </h3>
                      <p className="font-quicksand text-xs text-gray-500">
                        Ruta: <span className="font-mono text-gray-600">/evento/{resolvedCurrentEventSlug}</span>
                      </p>
                    </div>
                  </div>

                  {/* Selector rápido para cambiar el evento de la portada */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                    <label className="font-quicksand text-xs font-semibold text-gray-600">
                      Asignar evento a mostrar:
                    </label>
                    <select
                      value={portadaEventoSlug}
                      onChange={(e) => {
                        const newSlug = e.target.value;
                        setPortadaEventoSlug(newSlug);
                        if (newSlug !== "auto") {
                          const evTarget = eventos.find((ev) => ev.slug === newSlug);
                          if (evTarget) {
                            handleSetMainEvent(evTarget);
                          }
                        }
                      }}
                      className="px-3 py-2 text-xs font-quicksand font-bold text-gray-700 bg-[#FDF4F7] border border-[#FDE8EF] rounded-xl focus:outline-none focus:border-[#EE6B8D]"
                    >
                      <option value="auto">Automático (Evento Principal Activo)</option>
                      {eventos.map((ev) => (
                        <option key={ev.id || ev.slug} value={ev.slug || ""}>
                          {ev.nombre} {ev.featured ? "★ (Principal)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Explicación de la Lógica de 3 vs 4 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  <div className="p-3.5 bg-[#FAF7F5] rounded-xl border border-pink-100 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-pink-100 text-[#C04267] flex items-center justify-center shrink-0 mt-0.5">
                      <Layers size={16} />
                    </div>
                    <div>
                      <h4 className="font-quicksand text-xs font-bold text-gray-800">
                        Comportamiento 3D Inteligente
                      </h4>
                      <p className="font-quicksand text-[11px] text-gray-600 mt-0.5 leading-relaxed">
                        Si hay <strong>exactamente 3</strong> elementos, la rotonda presenta 1 al frente y 2 a los lados simétricamente. Si hay <strong>más de 3</strong>, se expande a 4 visibles en cuadrante rotatorio.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 bg-pink-50/60 rounded-xl border border-pink-100 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#EE6B8D] text-white flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                      {totalItemsCount}
                    </div>
                    <div>
                      <h4 className="font-quicksand text-xs font-bold text-[#C04267]">
                        Estado Actual para la Rotonda
                      </h4>
                      <p className="font-quicksand text-[11px] text-gray-700 mt-0.5">
                        {portadaSelectedIds.size > 0 ? (
                          <>
                            <strong>{portadaSelectedIds.size}</strong> productos seleccionados a mano
                            {portadaCustomImages.length > 0 && ` + ${portadaCustomImages.length} imágenes personalizadas`}.
                          </>
                        ) : (
                          <>
                            Selección automática activa: <strong>{eventProducts.length}</strong> productos del evento &quot;{currentEventObj?.nombre}&quot;
                            {portadaCustomImages.length > 0 && ` + ${portadaCustomImages.length} imágenes personalizadas`}.
                          </>
                        )}
                        {" "}
                        <span className="font-bold text-[#EE6B8D]">
                          {totalItemsCount === 3
                            ? "→ Modo Tríptico 3D activo (3 elementos)."
                            : totalItemsCount > 3
                            ? "→ Modo Cuadrante 3D activo (4 visibles en desktop)."
                            : "→ Menos de 3 elementos (se recomiendan al menos 3)."}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Selector de Pestañas: Productos vs Imágenes */}
              <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
                <button
                  type="button"
                  onClick={() => setPortadaTab("productos")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-quicksand font-bold text-xs transition-all cursor-pointer ${
                    portadaTab === "productos"
                      ? "bg-[#C04267] text-white shadow-sm"
                      : "bg-white text-gray-600 hover:bg-[#FDF4F7] hover:text-[#C04267] border border-gray-200"
                  }`}
                >
                  <Package size={15} />
                  <span>Elegir Productos del Catálogo ({portadaSelectedIds.size > 0 ? `${portadaSelectedIds.size} elegidos` : "Automático"})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPortadaTab("imagenes")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-quicksand font-bold text-xs transition-all cursor-pointer ${
                    portadaTab === "imagenes"
                      ? "bg-[#C04267] text-white shadow-sm"
                      : "bg-white text-gray-600 hover:bg-[#FDF4F7] hover:text-[#C04267] border border-gray-200"
                  }`}
                >
                  <Upload size={15} />
                  <span>Subir Imágenes Directas de Catálogo ({portadaCustomImages.length})</span>
                </button>
              </div>

              {/* PESTAÑA 1: Elegir Productos */}
              {portadaTab === "productos" && (() => {
                const portadaFilterOptions = [
                  { key: "evento", label: `Evento: ${currentEventObj?.nombre || "Principal"} (${eventProducts.length})` },
                  { key: "todos", label: `Todo el Catálogo (${rawProducts.length})` },
                  { key: "ramos", label: "Ramos" },
                  { key: "amigurumis", label: "Amigurumis" },
                  { key: "cajas", label: "Cajas" },
                  { key: "personalizados", label: "Personalizados" },
                ];
                const activePortadaFilterLabel =
                  portadaFilterOptions.find((o) => o.key === portadaCategoryFilter)?.label || "Filtrar";

                return (
                <div className="space-y-3">
                  {/* Barra compacta: Buscador + Selector de filtro + Acciones rápidas */}
                  <div ref={portadaDropdownRef} className="flex flex-col lg:flex-row lg:items-center gap-2">
                    <div className="relative flex-1 min-w-0">
                      <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Buscar producto por nombre o SKU..."
                        value={portadaProductSearch}
                        onChange={(e) => setPortadaProductSearch(e.target.value)}
                        className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm font-quicksand bg-white rounded-xl border border-[#FDE8EF] focus:outline-none focus:border-[#EE6B8D] focus:ring-2 focus:ring-[#EE6B8D]/15 shadow-2xs"
                      />
                      {portadaProductSearch && (
                        <button
                          type="button"
                          onClick={() => setPortadaProductSearch("")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                          aria-label="Limpiar búsqueda"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 lg:flex lg:items-center gap-1.5 sm:gap-2 shrink-0">
                      {/* Selector desplegable de filtro */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setPortadaDropdownOpen((prev) => (prev === "filtro" ? null : "filtro"))}
                          className={`w-full lg:w-auto flex items-center justify-between gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl border font-quicksand text-xs font-semibold transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EE6B8D]/40 ${
                            portadaDropdownOpen === "filtro"
                              ? "bg-white border-[#EE6B8D] text-gray-800 shadow-xs"
                              : "bg-[#FDF4F7] border-[#EE6B8D]/50 text-[#C04267]"
                          }`}
                        >
                          <span className="flex items-center gap-1.5 min-w-0">
                            <Tag size={13} className="text-[#EE6B8D] shrink-0" />
                            <span className="truncate">{activePortadaFilterLabel}</span>
                          </span>
                          <ChevronDown
                            size={13}
                            className={`shrink-0 text-[#C04267] transition-transform duration-150 ${
                              portadaDropdownOpen === "filtro" ? "rotate-180" : ""
                            }`}
                          />
                        </button>

                        {portadaDropdownOpen === "filtro" && (
                          <div className="absolute left-0 lg:right-0 lg:left-auto top-full mt-1.5 w-60 bg-white rounded-xl border border-[#FDE8EF] shadow-lg py-1.5 z-30">
                            {portadaFilterOptions.map((opt) => {
                              const selected = portadaCategoryFilter === opt.key;
                              return (
                                <button
                                  key={opt.key}
                                  type="button"
                                  onClick={() => {
                                    setPortadaCategoryFilter(opt.key);
                                    setPortadaDropdownOpen(null);
                                  }}
                                  className={`w-full flex items-center justify-between px-3 py-2 text-left font-quicksand text-xs transition-colors cursor-pointer ${
                                    selected
                                      ? "bg-[#FDF4F7] text-[#C04267] font-bold"
                                      : "text-gray-700 hover:bg-gray-50"
                                  }`}
                                >
                                  <span className="truncate">{opt.label}</span>
                                  {selected && <Check size={13} className="text-[#EE6B8D] shrink-0" />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Selector desplegable de selección rápida */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setPortadaDropdownOpen((prev) => (prev === "acciones" ? null : "acciones"))}
                          className={`w-full lg:w-auto flex items-center justify-between gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl border font-quicksand text-xs font-semibold transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EE6B8D]/40 ${
                            portadaDropdownOpen === "acciones"
                              ? "bg-white border-[#EE6B8D] text-gray-800 shadow-xs"
                              : "bg-white border-[#FDE8EF] text-gray-600 hover:border-[#EE6B8D]/60"
                          }`}
                        >
                          <span className="flex items-center gap-1.5 min-w-0">
                            <CheckSquare size={13} className="text-gray-400 shrink-0" />
                            <span className="truncate">Selección rápida</span>
                          </span>
                          <ChevronDown
                            size={13}
                            className={`shrink-0 text-gray-400 transition-transform duration-150 ${
                              portadaDropdownOpen === "acciones" ? "rotate-180 text-[#C04267]" : ""
                            }`}
                          />
                        </button>

                        {portadaDropdownOpen === "acciones" && (
                          <div className="absolute right-0 top-full mt-1.5 w-60 bg-white rounded-xl border border-[#FDE8EF] shadow-lg py-1.5 z-30">
                            <button
                              type="button"
                              onClick={() => {
                                const pool = filteredRawProducts.length > 0 ? filteredRawProducts : eventProducts;
                                const top4Ids = pool.slice(0, 4).map((p) => String(p.id || p.sku));
                                setPortadaSelectedIds(new Set(top4Ids));
                                setPortadaDropdownOpen(null);
                              }}
                              className="w-full px-3 py-2 text-left font-quicksand text-xs font-semibold text-[#C04267] hover:bg-[#FDF4F7] transition-colors cursor-pointer"
                            >
                              Seleccionar primeros 4 de la lista
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const pool = filteredRawProducts.length > 0 ? filteredRawProducts : eventProducts;
                                const top3Ids = pool.slice(0, 3).map((p) => String(p.id || p.sku));
                                setPortadaSelectedIds(new Set(top3Ids));
                                setPortadaDropdownOpen(null);
                              }}
                              className="w-full px-3 py-2 text-left font-quicksand text-xs font-semibold text-[#C04267] hover:bg-[#FDF4F7] transition-colors cursor-pointer"
                            >
                              Seleccionar primeros 3 (Modo Tríptico)
                            </button>
                            {portadaSelectedIds.size > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPortadaSelectedIds(new Set());
                                  setPortadaDropdownOpen(null);
                                }}
                                className="w-full px-3 py-2 text-left font-quicksand text-xs font-semibold text-gray-500 hover:bg-gray-50 border-t border-gray-100 transition-colors cursor-pointer"
                              >
                                Limpiar (Usar automático)
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Grid de productos */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {filteredRawProducts.map((prod) => {
                      const prodId = String(prod.id || prod.sku);
                      const isSelected = portadaSelectedIds.has(prodId);
                      const isFromActiveEvent = isProductInSlug(prod, resolvedCurrentEventSlug, assignments);
                      const prodNombre = prod.nombre || prod.title || "Producto";
                      const prodImagen = prod.imagen || prod.image;
                      const prodPrecio = Number(prod.precio ?? prod.price ?? 0);

                      return (
                        <div
                          key={prodId}
                          onClick={() => togglePortadaProductId(prodId)}
                          className={`cursor-pointer rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col justify-between group bg-white shadow-2xs hover:shadow-md ${
                            isSelected
                              ? "border-2 border-[#EE6B8D] ring-2 ring-[#EE6B8D]/20 shadow-md"
                              : "border-gray-200 hover:border-pink-200"
                          }`}
                        >
                          <div className="relative aspect-square bg-[#FDF4F7] overflow-hidden">
                            {prodImagen ? (
                              <img
                                src={prodImagen}
                                alt={prodNombre}
                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                onError={(e) => { (e.target as HTMLImageElement).src = "/logo.png"; }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-300">
                                <Package size={24} />
                              </div>
                            )}

                            {/* Badge de selección */}
                            <div className="absolute top-2 right-2">
                              {isSelected ? (
                                <div className="w-7 h-7 rounded-full bg-[#EE6B8D] text-white flex items-center justify-center shadow-md">
                                  <Check size={16} />
                                </div>
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-white/80 backdrop-blur-xs text-gray-400 flex items-center justify-center border border-gray-200 group-hover:border-[#EE6B8D] group-hover:text-[#EE6B8D]">
                                  <Plus size={16} />
                                </div>
                              )}
                            </div>

                            {/* Indicador de si pertenece al evento actual */}
                            {isFromActiveEvent && (
                              <div className="absolute top-2 left-2">
                                <span className="font-quicksand text-[9px] font-bold text-emerald-800 bg-emerald-100/95 px-2 py-0.5 rounded-full border border-emerald-300">
                                  {currentEventObj?.nombre?.split(" ")[0] || "Evento"}
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="p-3">
                            <h4 className="font-quicksand text-xs font-bold text-gray-800 line-clamp-2 leading-tight group-hover:text-[#C04267] transition-colors">
                              {prodNombre}
                            </h4>
                            <p className="font-quicksand text-[10px] text-gray-400 mt-0.5 truncate">
                              SKU: {prod.sku || "-"}
                            </p>
                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                              <span className="font-fredoka text-xs font-bold text-[#C04267]">
                                S/ {prodPrecio.toFixed(2)}
                              </span>
                              <span className={`font-quicksand text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isSelected ? "bg-[#FDF4F7] text-[#EE6B8D]" : "text-gray-400"
                              }`}>
                                {isSelected ? "En Portada" : "Agregar"}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                );
              })()}

              {/* PESTAÑA 2: Subir Imágenes Directas de Catálogo */}
              {portadaTab === "imagenes" && (
                <div className="space-y-6">
                  {/* Formulario para agregar una tarjeta o imagen directa */}
                  <div className="bg-white rounded-2xl border border-[#FDE8EF] p-5 shadow-sm space-y-4">
                    <div>
                      <h3 className="font-fredoka text-base font-bold text-[#C04267] flex items-center gap-2">
                        <Upload size={18} className="text-[#EE6B8D]" />
                        Agregar Tarjeta de Catálogo a la Portada
                      </h3>
                      <p className="font-quicksand text-xs text-gray-500 mt-0.5">
                        Sube una foto directamente desde tu celular o computadora, añade su título y precio, y se sumará inmediatamente al carrusel 3D.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                      {/* Subir archivo */}
                      <div className="md:col-span-1">
                        <label className="block font-quicksand text-xs font-bold text-gray-700 mb-1">
                          Foto o Imagen
                        </label>
                        <label className="w-full flex flex-col items-center justify-center gap-1.5 py-4 px-3 rounded-xl border border-dashed border-[#EE6B8D]/50 bg-[#FDF4F7]/60 hover:bg-[#FDF4F7] text-[#C04267] font-quicksand font-bold text-xs cursor-pointer transition-all">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={uploadingPortadaImg}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUploadCustomPortadaImage(file);
                            }}
                          />
                          {uploadingPortadaImg ? (
                            <div className="flex items-center gap-1.5 py-1">
                              <Loader2 size={16} className="animate-spin text-[#EE6B8D]" />
                              <span className="text-[11px]">Subiendo...</span>
                            </div>
                          ) : (
                            <>
                              <Upload size={18} className="text-[#EE6B8D]" />
                              <span className="text-[11px] text-center">
                                {newCatalogImgUrl ? "Cambiar foto" : "Seleccionar imagen"}
                              </span>
                            </>
                          )}
                        </label>
                        {newCatalogImgUrl && (
                          <div className="mt-2 flex items-center gap-2">
                            <img src={newCatalogImgUrl} alt="" className="w-10 h-10 rounded-lg object-cover border border-pink-200" />
                            <span className="font-quicksand text-[10px] text-emerald-600 font-bold truncate">Imagen lista</span>
                          </div>
                        )}
                      </div>

                      {/* Título */}
                      <div className="md:col-span-1">
                        <label className="block font-quicksand text-xs font-bold text-gray-700 mb-1">
                          Título del Producto
                        </label>
                        <input
                          type="text"
                          placeholder="Ej: Ramo Rosas Eternas"
                          value={newCatalogImgTitle}
                          onChange={(e) => setNewCatalogImgTitle(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-xs font-quicksand rounded-xl border border-gray-200 focus:outline-none focus:border-[#EE6B8D]"
                        />
                      </div>

                      {/* Precio */}
                      <div className="md:col-span-1">
                        <label className="block font-quicksand text-xs font-bold text-gray-700 mb-1">
                          Precio (S/)
                        </label>
                        <input
                          type="text"
                          placeholder="Ej: 45.00"
                          value={newCatalogImgPrice}
                          onChange={(e) => setNewCatalogImgPrice(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-xs font-quicksand rounded-xl border border-gray-200 focus:outline-none focus:border-[#EE6B8D]"
                        />
                      </div>

                      {/* Categoría / Etiqueta y Botón */}
                      <div className="md:col-span-1 flex flex-col gap-2">
                        <div>
                          <label className="block font-quicksand text-xs font-bold text-gray-700 mb-1">
                            Etiqueta
                          </label>
                          <input
                            type="text"
                            placeholder="Ej: Destacado / Ramo"
                            value={newCatalogImgCategoria}
                            onChange={(e) => setNewCatalogImgCategoria(e.target.value)}
                            className="w-full px-3.5 py-2.5 text-xs font-quicksand rounded-xl border border-gray-200 focus:outline-none focus:border-[#EE6B8D]"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleAddCustomCatalogItem}
                          className="w-full py-2.5 bg-[#EE6B8D] hover:bg-[#C04267] text-white font-quicksand font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Plus size={15} />
                          <span>Agregar a Portada</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Listado de imágenes de catálogo subidas */}
                  <div className="space-y-3">
                    <h4 className="font-fredoka text-sm font-bold text-gray-800">
                      Imágenes y Tarjetas Personalizadas ({portadaCustomImages.length})
                    </h4>

                    {portadaCustomImages.length === 0 ? (
                      <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                        <p className="font-quicksand text-xs text-gray-500">
                          Aún no has agregado imágenes personalizadas. Puedes subir fotos directas con el formulario de arriba.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {portadaCustomImages.map((item, idx: number) => (
                          <div
                            key={item.id || idx}
                            className="bg-white rounded-2xl border border-pink-100 shadow-sm overflow-hidden flex flex-col justify-between"
                          >
                            <div className="relative aspect-square bg-gray-50 overflow-hidden">
                              <img
                                src={item.image}
                                alt={item.title}
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).src = "/logo.png"; }}
                              />
                              <div className="absolute top-2 left-2">
                                <span className="font-quicksand text-[10px] font-bold text-[#C04267] bg-white/90 backdrop-blur-xs px-2.5 py-0.5 rounded-full border border-pink-100 shadow-xs">
                                  {item.categoria || "Catálogo"}
                                </span>
                              </div>
                            </div>
                            <div className="p-3">
                              <h5 className="font-quicksand text-xs font-bold text-gray-800 line-clamp-1">
                                {item.title}
                              </h5>
                              <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                                <span className="font-fredoka text-xs font-bold text-[#C04267]">
                                  {item.price != null ? `S/ ${Number(item.price).toFixed(2)}` : "Consultar"}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveCustomCatalogItem(idx)}
                                  className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                                  title="Quitar de la portada"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })()}


        {mainTab === "catalogo" && subTab === "productos" && (() => {
          // Lista de eventos combinada (base + dinámicos de Supabase)
          const allAvailableEvents = (() => {
            const map = new Map<string, string>();
            EVENTOS_BASE.forEach((e) => map.set(e.slug, e.label));
            eventos.forEach((e) => {
              if (e.slug && !map.has(e.slug)) {
                map.set(e.slug, e.nombre || e.slug);
              }
            });
            return Array.from(map.entries()).map(([slug, label]) => ({ slug, label }));
          })();

          const dynamicCatalogoFilters = [
            ...allCatalogos
              .filter((c) => c.slug !== "personalizados")
              .map((c) => ({ key: `cat-${c.slug}`, label: c.label })),
            { key: "ver-todo", label: "Ver Todo" },
          ];

          const featuredEvent = eventos.find((e) => e.featured);
          const featuredEventSlug = featuredEvent?.slug;
          const productosFiltrados = productosFilter === "evento-destacado"
            ? (featuredEventSlug ? filterByEventSlug(rawProducts, featuredEventSlug, assignments) : [])
            : filterProductos(rawProducts, productosFilter, assignments);
          const productosVisibles = productosFiltrados.filter((p) =>
            !productosSearch ||
            p.nombre?.toLowerCase().includes(productosSearch.toLowerCase()) ||
            p.sku?.toLowerCase().includes(productosSearch.toLowerCase())
          );
          const filterLabel = (() => {
            if (productosFilter === "evento-destacado" && featuredEvent) return featuredEvent.nombre;
            if (productosFilter === "ver-todo") return "todo el catálogo";
            if (productosFilter === "page-personalizados") return "Personalizados";
            const cat = dynamicCatalogoFilters.find((f) => f.key === productosFilter);
            if (cat) return cat.label;
            if (productosFilter.startsWith("evento-")) {
              const slug = productosFilter.replace("evento-", "");
              const ev = allAvailableEvents.find((e) => e.slug === slug);
              if (ev) return ev.label;
            }
            return "todo el catálogo";
          })();

          const allVisibleSelected =
            productosVisibles.length > 0 &&
            productosVisibles.every((p) => selectedProductIds.has(p.id));

          const activeCatalogo = dynamicCatalogoFilters.find((f) => f.key === productosFilter && f.key !== "ver-todo");
          const activeEvento = productosFilter.startsWith("evento-") && productosFilter !== "evento-destacado"
            ? allAvailableEvents.find((e) => `evento-${e.slug}` === productosFilter)
            : null;
          const activePaginaLabel =
            productosFilter === "page-personalizados"
              ? "Personalizados"
              : productosFilter === "evento-destacado" && featuredEvent
              ? `Destacado`
              : null;

          return (
          <div>
            {/* Cabecera compacta */}
            <div className="flex items-center justify-between gap-3 mb-3 sm:mb-4">
              <div className="min-w-0">
                <h2 className="font-fredoka text-lg sm:text-xl font-bold text-[#C04267] leading-tight">Productos</h2>
                {rawProducts.length > 0 && (
                  <p className="font-quicksand text-[11px] sm:text-xs text-gray-400 mt-0.5 truncate">
                    {productosFiltrados.length} producto{productosFiltrados.length !== 1 ? "s" : ""} en {filterLabel} · {inactiveIds.size} oculto{inactiveIds.size !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {productosVisibles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => toggleSelectAllVisible(productosVisibles)}
                    className={`lg:hidden flex items-center gap-1.5 px-2.5 py-2 rounded-xl border font-quicksand text-xs font-bold transition-all cursor-pointer ${
                      allVisibleSelected
                        ? "bg-[#FDF4F7] border-[#EE6B8D] text-[#C04267]"
                        : "bg-white border-[#FDE8EF] text-gray-600 hover:border-[#EE6B8D]/60"
                    }`}
                    title={allVisibleSelected ? "Deseleccionar visibles" : "Seleccionar todos los visibles"}
                  >
                    {allVisibleSelected ? (
                      <CheckSquare size={15} className="text-[#EE6B8D]" />
                    ) : (
                      <Square size={15} className="text-gray-400" />
                    )}
                    <span className="hidden sm:inline">{allVisibleSelected ? "Deseleccionar" : "Seleccionar"}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setEditingProductItem(null);
                    setProductModalOpen(true);
                  }}
                  className="px-3.5 py-2 bg-[#EE6B8D] hover:bg-[#C04267] text-white rounded-xl font-quicksand font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all whitespace-nowrap cursor-pointer"
                >
                  <Plus size={15} />
                  <span>Nuevo Producto</span>
                </button>
              </div>
            </div>

            {/* Barra unificada: Buscador + 3 Selectores desplegables (Catálogo, Eventos, Páginas) */}
            <div ref={filterDropdownRef} className="flex flex-col lg:flex-row lg:items-center gap-2 mb-3.5 sm:mb-4">
              {/* Buscador */}
              <div className="relative flex-1 min-w-0">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  value={productosSearch}
                  onChange={(e) => setProductosSearch(e.target.value)}
                  placeholder="Buscar por nombre o SKU..."
                  className="w-full pl-9 pr-8 py-2 bg-white border border-[#FDE8EF] rounded-xl font-quicksand text-xs sm:text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-[#EE6B8D] focus:ring-2 focus:ring-[#EE6B8D]/15 shadow-2xs transition-all"
                />
                {productosSearch && (
                  <button
                    type="button"
                    onClick={() => setProductosSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                    aria-label="Limpiar búsqueda"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* 3 Selectores desplegables compactos */}
              <div className="grid grid-cols-3 lg:flex lg:items-center gap-1.5 sm:gap-2 shrink-0">
                {/* 1. Selector Catálogo */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenFilterDropdown((prev) => (prev === "catalogo" ? null : "catalogo"))}
                    className={`w-full lg:w-auto flex items-center justify-between gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl border font-quicksand text-xs font-semibold transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EE6B8D]/40 ${
                      activeCatalogo
                        ? "bg-[#FDF4F7] border-[#EE6B8D] text-[#C04267] font-bold"
                        : openFilterDropdown === "catalogo"
                        ? "bg-white border-[#EE6B8D] text-gray-800 shadow-xs"
                        : "bg-white border-[#FDE8EF] text-gray-600 hover:border-[#EE6B8D]/60"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 min-w-0">
                      <Package size={14} className={activeCatalogo ? "text-[#EE6B8D] shrink-0" : "text-gray-400 shrink-0"} />
                      <span className="truncate">{activeCatalogo ? activeCatalogo.label : "Catálogo"}</span>
                    </span>
                    <ChevronDown
                      size={13}
                      className={`shrink-0 text-gray-400 transition-transform duration-150 ${
                        openFilterDropdown === "catalogo" ? "rotate-180 text-[#C04267]" : ""
                      }`}
                    />
                  </button>

                  {openFilterDropdown === "catalogo" && (
                    <div className="absolute left-0 lg:right-0 lg:left-auto top-full mt-1.5 w-52 bg-white rounded-xl border border-[#FDE8EF] shadow-lg py-1.5 z-30">
                      {dynamicCatalogoFilters.map((f) => {
                        const selected = productosFilter === f.key;
                        return (
                          <button
                            key={f.key}
                            type="button"
                            onClick={() => {
                              setProductosFilter(f.key);
                              setOpenFilterDropdown(null);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 text-left font-quicksand text-xs transition-colors cursor-pointer ${
                              selected
                                ? "bg-[#FDF4F7] text-[#C04267] font-bold"
                                : "text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            <span className="truncate">{f.label}</span>
                            {selected && <Check size={13} className="text-[#EE6B8D] shrink-0" />}
                          </button>
                        );
                      })}
                      <div className="border-t border-gray-100 mt-1 pt-1 px-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setOpenFilterDropdown(null);
                            setCatalogoManagerOpen(true);
                          }}
                          className="w-full flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-left font-quicksand text-xs font-bold text-[#C04267] hover:bg-[#FDF4F7] transition-colors cursor-pointer"
                        >
                          <Plus size={13} />
                          <span>Gestionar catálogos</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Selector Eventos */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenFilterDropdown((prev) => (prev === "eventos" ? null : "eventos"))}
                    className={`w-full lg:w-auto flex items-center justify-between gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl border font-quicksand text-xs font-semibold transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EE6B8D]/40 ${
                      activeEvento
                        ? "bg-[#FDF4F7] border-[#EE6B8D] text-[#C04267] font-bold"
                        : openFilterDropdown === "eventos"
                        ? "bg-white border-[#EE6B8D] text-gray-800 shadow-xs"
                        : "bg-white border-[#FDE8EF] text-gray-600 hover:border-[#EE6B8D]/60"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 min-w-0">
                      <Tag size={14} className={activeEvento ? "text-[#EE6B8D] shrink-0" : "text-gray-400 shrink-0"} />
                      <span className="truncate">{activeEvento ? activeEvento.label : "Eventos"}</span>
                    </span>
                    <ChevronDown
                      size={13}
                      className={`shrink-0 text-gray-400 transition-transform duration-150 ${
                        openFilterDropdown === "eventos" ? "rotate-180 text-[#C04267]" : ""
                      }`}
                    />
                  </button>

                  {openFilterDropdown === "eventos" && (
                    <div className="absolute left-1/2 -translate-x-1/2 lg:translate-x-0 lg:right-0 lg:left-auto top-full mt-1.5 w-52 max-h-64 overflow-y-auto bg-white rounded-xl border border-[#FDE8EF] shadow-lg py-1.5 z-30">
                      <button
                        type="button"
                        onClick={() => {
                          setProductosFilter("ver-todo");
                          setOpenFilterDropdown(null);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-left font-quicksand text-xs transition-colors cursor-pointer border-b border-gray-100 ${
                          productosFilter === "ver-todo"
                            ? "bg-[#FDF4F7] text-[#C04267] font-bold"
                            : "text-gray-500 hover:bg-gray-50"
                        }`}
                      >
                        <span>Todos los eventos</span>
                        {productosFilter === "ver-todo" && <Check size={13} className="text-[#EE6B8D]" />}
                      </button>
                      {allAvailableEvents.map((f) => {
                        const filterKey = `evento-${f.slug}`;
                        const selected = productosFilter === filterKey;
                        return (
                          <button
                            key={f.slug}
                            type="button"
                            onClick={() => {
                              setProductosFilter(filterKey);
                              setOpenFilterDropdown(null);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 text-left font-quicksand text-xs transition-colors cursor-pointer ${
                              selected
                                ? "bg-[#FDF4F7] text-[#C04267] font-bold"
                                : "text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            <span className="truncate">{f.label}</span>
                            {selected && <Check size={13} className="text-[#EE6B8D] shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 3. Selector Páginas */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenFilterDropdown((prev) => (prev === "paginas" ? null : "paginas"))}
                    className={`w-full lg:w-auto flex items-center justify-between gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl border font-quicksand text-xs font-semibold transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EE6B8D]/40 ${
                      activePaginaLabel
                        ? "bg-[#FDF4F7] border-[#EE6B8D] text-[#C04267] font-bold"
                        : openFilterDropdown === "paginas"
                        ? "bg-white border-[#EE6B8D] text-gray-800 shadow-xs"
                        : "bg-white border-[#FDE8EF] text-gray-600 hover:border-[#EE6B8D]/60"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 min-w-0">
                      <Layers size={14} className={activePaginaLabel ? "text-[#EE6B8D] shrink-0" : "text-gray-400 shrink-0"} />
                      <span className="truncate">{activePaginaLabel || "Páginas"}</span>
                    </span>
                    <ChevronDown
                      size={13}
                      className={`shrink-0 text-gray-400 transition-transform duration-150 ${
                        openFilterDropdown === "paginas" ? "rotate-180 text-[#C04267]" : ""
                      }`}
                    />
                  </button>

                  {openFilterDropdown === "paginas" && (
                    <div className="absolute right-0 top-full mt-1.5 w-56 bg-white rounded-xl border border-[#FDE8EF] shadow-lg py-1.5 z-30">
                      <button
                        type="button"
                        onClick={() => {
                          setProductosFilter("ver-todo");
                          setOpenFilterDropdown(null);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-left font-quicksand text-xs transition-colors cursor-pointer border-b border-gray-100 ${
                          productosFilter === "ver-todo"
                            ? "bg-[#FDF4F7] text-[#C04267] font-bold"
                            : "text-gray-500 hover:bg-gray-50"
                        }`}
                      >
                        <span>Todas las páginas</span>
                        {productosFilter === "ver-todo" && <Check size={13} className="text-[#EE6B8D]" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setProductosFilter("page-personalizados");
                          setOpenFilterDropdown(null);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-left font-quicksand text-xs transition-colors cursor-pointer ${
                          productosFilter === "page-personalizados"
                            ? "bg-[#FDF4F7] text-[#C04267] font-bold"
                            : "text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <span>Personalizados</span>
                        {productosFilter === "page-personalizados" && <Check size={13} className="text-[#EE6B8D]" />}
                      </button>
                      {featuredEvent && (
                        <button
                          type="button"
                          onClick={() => {
                            setProductosFilter("evento-destacado");
                            setOpenFilterDropdown(null);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 text-left font-quicksand text-xs transition-colors cursor-pointer ${
                            productosFilter === "evento-destacado"
                              ? "bg-[#FDF4F7] text-[#C04267] font-bold"
                              : "text-[#C04267] hover:bg-[#FDF4F7]/60"
                          }`}
                        >
                          <span className="flex items-center gap-1.5 truncate">
                            <Star size={12} fill="currentColor" className="shrink-0" />
                            <span className="truncate">Destacado: {featuredEvent.nombre}</span>
                          </span>
                          {productosFilter === "evento-destacado" && <Check size={13} className="text-[#EE6B8D] shrink-0" />}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Barra flotante de acciones masivas cuando hay productos seleccionados */}
            {selectedProductIds.size > 0 && (
              <div className="bg-[#FDF4F7] border border-[#EE6B8D]/50 rounded-2xl p-3 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-xs animate-in fade-in duration-200">
                <div className="flex items-center justify-between sm:justify-start gap-2.5">
                  <div className="flex items-center gap-2">
                    <span className="bg-[#EE6B8D] text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                      {selectedProductIds.size}
                    </span>
                    <span className="font-quicksand text-xs font-bold text-gray-700">
                      seleccionado{selectedProductIds.size !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedProductIds(new Set())}
                    className="sm:hidden text-gray-500 hover:text-gray-700 font-quicksand text-xs font-medium cursor-pointer"
                  >
                    Deseleccionar
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBulkModalOpen(true)}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#EE6B8D] hover:bg-[#C04267] text-white rounded-xl font-quicksand text-xs font-bold transition-colors shadow-xs cursor-pointer"
                  >
                    <Layers size={14} />
                    <span>Asignar catálogo/evento</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDeleteConfirmTarget({
                        mode: "bulk",
                        ids: Array.from(selectedProductIds),
                      })
                    }
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-quicksand text-xs font-bold transition-colors shadow-xs cursor-pointer"
                  >
                    <Trash2 size={14} />
                    <span>Eliminar ({selectedProductIds.size})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedProductIds(new Set())}
                    className="hidden sm:inline-block px-2.5 py-1.5 text-gray-500 hover:text-gray-700 font-quicksand text-xs font-medium transition-colors cursor-pointer"
                  >
                    Deseleccionar
                  </button>
                </div>
              </div>
            )}

            {rawProducts.length === 0 ? (
              <div className="flex items-center justify-center py-20 bg-white rounded-2xl border border-[#FDE8EF]">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 size={24} className="animate-spin text-[#EE6B8D]" />
                  <p className="font-quicksand text-xs text-gray-400">Cargando productos...</p>
                </div>
              </div>
            ) : (
              <>
                {/* 1. VISTA DE TARJETAS COMPACTAS PARA MÓVILES Y TABLETS VERTICALES (lg:hidden) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:hidden gap-2.5 mb-6">
                      {productosVisibles.map((p) => {
                    const isActive = !inactiveIds.has(p.id);
                    const isSelected = selectedProductIds.has(p.id);
                    const activeSlugs = getProductActiveSlugs(p, assignments);
                    const isSlugsExpanded = expandedCardSlugs.has(p.id);
                    const visibleSlugs = isSlugsExpanded ? activeSlugs : activeSlugs.slice(0, 3);
                    const hiddenSlugsCount = activeSlugs.length - visibleSlugs.length;

                    return (
                      <div
                        key={p.id}
                        className={`p-3 rounded-2xl border transition-all flex flex-col justify-between space-y-2 ${
                          isSelected
                            ? "bg-pink-50/70 border-[#EE6B8D]"
                            : isActive
                            ? "bg-white border-[#FDE8EF] shadow-2xs"
                            : "bg-gray-50/80 border-gray-200"
                        }`}
                      >
                        {/* Cabecera: Checkbox, foto, nombre y SKU */}
                        <div className="flex items-start gap-2.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectProduct(p.id)}
                            className="mt-1 rounded border-gray-300 text-[#EE6B8D] focus:ring-[#EE6B8D] cursor-pointer shrink-0"
                          />
                          {p.imagen ? (
                            <img
                              src={p.imagen}
                              alt=""
                              className="w-11 h-11 rounded-xl object-cover bg-gray-100 shrink-0"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-xl bg-pink-100 text-[#C04267] flex items-center justify-center text-xs font-bold shrink-0">
                              {p.sku?.substring(0, 3) || "EH"}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-quicksand text-xs font-bold text-gray-900 line-clamp-2 leading-tight">
                              {p.nombre}
                            </p>
                            <p className="font-quicksand text-[11px] text-gray-400 mt-0.5 truncate">
                              {p.sku} · {p.categoria}
                            </p>
                          </div>
                        </div>

                        {/* Catálogos y Eventos (máx 3 visibles por defecto para ahorrar altura) */}
                        {activeSlugs.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1">
                            {visibleSlugs.map((slug) => {
                              const badgeInfo = getSlugBadgeInfo(slug, eventos, allCatalogos);
                              return (
                                <span
                                  key={slug}
                                  className={`inline-block font-quicksand text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${badgeInfo.colorClass}`}
                                >
                                  {badgeInfo.label}
                                </span>
                              );
                            })}
                            {hiddenSlugsCount > 0 && (
                              <button
                                type="button"
                                onClick={() => toggleCardSlugs(p.id)}
                                className="font-quicksand text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-600 hover:bg-[#FDE8EF] hover:text-[#C04267] transition-colors cursor-pointer"
                              >
                                +{hiddenSlugsCount}
                              </button>
                            )}
                            {isSlugsExpanded && activeSlugs.length > 3 && (
                              <button
                                type="button"
                                onClick={() => toggleCardSlugs(p.id)}
                                className="font-quicksand text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500 hover:text-gray-700 cursor-pointer"
                              >
                                Ver menos
                              </button>
                            )}
                          </div>
                        )}

                        {/* Fila inferior: Precio, Stock, Botón Editar, Eliminar y Switch Activo */}
                        <div className="flex items-center justify-between pt-2 border-t border-gray-100 gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-fredoka text-sm font-bold text-gray-900 whitespace-nowrap">
                              S/ {p.precio?.toFixed(2)}
                            </span>
                            <span className={`inline-block font-quicksand text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
                              p.stock === 0 ? "bg-gray-100 text-gray-500" : p.stock <= 5 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
                            }`}>
                              {p.stock === 0 ? "A pedido" : `${p.stock} uds`}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingProductItem(p);
                                setProductModalOpen(true);
                              }}
                              className="w-8 h-8 rounded-lg border border-gray-200 bg-white hover:bg-[#FDF4F7] hover:border-[#EE6B8D] text-gray-500 hover:text-[#C04267] flex items-center justify-center transition-all shadow-2xs cursor-pointer"
                              title="Editar producto"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmTarget({ mode: "single", product: p })}
                              className="w-8 h-8 rounded-lg border border-gray-200 bg-white hover:bg-red-50 hover:border-red-300 text-gray-400 hover:text-red-500 flex items-center justify-center transition-all shadow-2xs cursor-pointer"
                              title="Eliminar producto"
                            >
                              <Trash2 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleProducto(p, !isActive)}
                              title={isActive ? "Ocultar de la web" : "Mostrar en la web"}
                              className={`relative inline-flex w-10 h-5.5 rounded-full transition-colors cursor-pointer ${isActive ? "bg-green-500" : "bg-gray-300"}`}
                            >
                              <span className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-transform ${isActive ? "translate-x-4.5" : ""}`} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {productosVisibles.length === 0 && (
                    <div className="col-span-full py-10 text-center font-quicksand text-xs text-gray-400 bg-white rounded-2xl border border-[#FDE8EF]">
                      {productosSearch
                        ? `No se encontraron productos con "${productosSearch}"`
                        : "No hay productos en este filtro."}
                    </div>
                  )}
                </div>

                {/* 2. TABLA COMPLETA PARA PANTALLAS GRANDES (hidden lg:block) */}
                <div className="hidden lg:block bg-white rounded-2xl border border-[#FDE8EF] shadow-sm overflow-x-auto mb-6">
                  <table className="w-full text-left text-sm min-w-full">
                    <thead>
                      <tr className="border-b border-[#FDE8EF] bg-gray-50/50">
                        <th className="px-3 py-3 w-8">
                          <button
                            type="button"
                            onClick={() => toggleSelectAllVisible(productosVisibles)}
                            className="text-gray-400 hover:text-[#EE6B8D] transition-colors cursor-pointer"
                            title={allVisibleSelected ? "Deseleccionar visibles" : "Seleccionar visibles"}
                          >
                            {allVisibleSelected ? (
                              <CheckSquare size={16} className="text-[#EE6B8D]" />
                            ) : (
                              <Square size={16} />
                            )}
                          </button>
                        </th>
                        <th className="px-3 py-3 font-quicksand text-xs text-gray-500 uppercase tracking-wider whitespace-nowrap">Producto</th>
                        <th className="hidden xl:table-cell px-3 py-3 font-quicksand text-xs text-gray-500 uppercase tracking-wider whitespace-nowrap">SKU</th>
                        <th className="hidden xl:table-cell px-3 py-3 font-quicksand text-xs text-gray-500 uppercase tracking-wider whitespace-nowrap">Categoría</th>
                        <th className="px-3 py-3 font-quicksand text-xs text-gray-500 uppercase tracking-wider whitespace-nowrap">Catálogos y Eventos</th>
                        <th className="px-3 py-3 font-quicksand text-xs text-gray-500 uppercase tracking-wider whitespace-nowrap">Precio</th>
                        <th className="px-3 py-3 font-quicksand text-xs text-gray-500 uppercase tracking-wider whitespace-nowrap">Stock</th>
                        <th className="px-3 py-3 font-quicksand text-xs text-gray-500 uppercase tracking-wider whitespace-nowrap">Estado</th>
                        <th className="px-3 py-3 font-quicksand text-xs text-gray-500 uppercase tracking-wider whitespace-nowrap text-center">Acciones</th>
                        <th className="px-3 py-3 font-quicksand text-xs text-gray-500 uppercase tracking-wider whitespace-nowrap text-right">Visible</th>
                      </tr>
                    </thead>
                    <tbody>
                  {productosVisibles.map((p) => {
                        const isActive = !inactiveIds.has(p.id);
                        const isSelected = selectedProductIds.has(p.id);
                        const activeSlugs = getProductActiveSlugs(p, assignments);
                        const isSlugsExpanded = expandedCardSlugs.has(p.id);
                        const visibleSlugs = isSlugsExpanded ? activeSlugs : activeSlugs.slice(0, 3);
                        const hiddenSlugsCount = activeSlugs.length - visibleSlugs.length;

                        return (
                          <tr
                            key={p.id}
                            className={`border-b border-gray-50 transition-colors ${
                              isSelected
                                ? "bg-pink-50/60"
                                : isActive
                                ? "hover:bg-[#FDF4F7]/50"
                                : "bg-gray-50/50 hover:bg-gray-100/60"
                            }`}
                          >
                            <td className="px-3 py-2.5">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectProduct(p.id)}
                                className="rounded border-gray-300 text-[#EE6B8D] focus:ring-[#EE6B8D] cursor-pointer"
                              />
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2.5">
                                {p.imagen && <img src={p.imagen} alt="" className="w-10 h-10 rounded-lg object-cover bg-gray-100 flex-shrink-0" />}
                                <div className="min-w-0">
                                  <p className="font-quicksand text-xs font-semibold text-gray-800 max-w-[180px] xl:max-w-[200px] truncate" title={p.nombre}>{p.nombre}</p>
                                  <p className="xl:hidden font-quicksand text-[10px] text-gray-400 truncate">
                                    {p.sku} · {p.categoria}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="hidden xl:table-cell px-3 py-2.5 font-quicksand text-[11px] text-gray-500">{p.sku}</td>
                            <td className="hidden xl:table-cell px-3 py-2.5 font-quicksand text-xs text-gray-500">{p.categoria}</td>
                            <td className="px-3 py-2.5">
                              {activeSlugs.length > 0 ? (
                                <div className="flex flex-wrap gap-1 max-w-[220px]">
                                  {visibleSlugs.map((slug) => {
                                    const badgeInfo = getSlugBadgeInfo(slug, eventos, allCatalogos);
                                    return (
                                      <span
                                        key={slug}
                                        className={`inline-block font-quicksand text-[10px] font-bold px-2 py-0.5 rounded-md border ${badgeInfo.colorClass}`}
                                      >
                                        {badgeInfo.label}
                                      </span>
                                    );
                                  })}
                                  {hiddenSlugsCount > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => toggleCardSlugs(p.id)}
                                      className="font-quicksand text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-600 hover:bg-[#FDE8EF] hover:text-[#C04267] transition-colors cursor-pointer"
                                    >
                                      +{hiddenSlugsCount}
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="font-quicksand text-[11px] text-gray-400 italic">Sin asignar</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 font-quicksand text-xs text-gray-700 whitespace-nowrap">S/ {p.precio?.toFixed(2)}</td>
                            <td className="px-3 py-2.5">
                              <span className={`font-quicksand text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap ${
                                p.stock === 0 ? "bg-gray-100 text-gray-500" : p.stock <= 5 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
                              }`}>
                                {p.stock === 0 ? "A pedido" : `${p.stock} uds`}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={`font-quicksand text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                              }`}>
                                {isActive ? "Activo" : "Oculto"}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingProductItem(p);
                                    setProductModalOpen(true);
                                  }}
                                  title="Editar producto, precio, stock y catálogos"
                                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 bg-white hover:bg-[#FDF4F7] hover:border-[#EE6B8D] text-gray-400 hover:text-[#C04267] transition-all shadow-xs cursor-pointer"
                                >
                                  <Pencil size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmTarget({ mode: "single", product: p })}
                                  title="Eliminar producto"
                                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 bg-white hover:bg-red-50 hover:border-red-300 text-gray-400 hover:text-red-500 transition-all shadow-xs cursor-pointer"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <button
                                onClick={() => handleToggleProducto(p, !isActive)}
                                title={isActive ? "Ocultar de la web" : "Mostrar en la web"}
                                className={`relative inline-flex w-11 h-6 rounded-full transition-colors cursor-pointer ${isActive ? "bg-green-400" : "bg-gray-300"}`}
                              >
                                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${isActive ? "translate-x-5" : ""}`} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {productosVisibles.length === 0 && (
                        <tr>
                          <td colSpan={10} className="px-3 py-10 text-center font-quicksand text-xs text-gray-400">
                            {productosSearch
                              ? `No se encontraron productos con "${productosSearch}"`
                              : productosFiltrados.length === 0
                                ? `No hay productos en este filtro.`
                                : "Cargando productos..."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* Modal para crear o editar productos completos */}
            <ProductFormModal
              isOpen={productModalOpen}
              onClose={() => {
                setProductModalOpen(false);
                setEditingProductItem(null);
              }}
              product={editingProductItem}
              assignments={assignments}
              eventos={eventos}
              catalogos={allCatalogos}
              inactiveIds={inactiveIds}
              onSaveSuccess={(savedProduct, activeSlugs, isActive) => {
                setRawProducts((prev) => {
                  const idx = prev.findIndex((p) => p.id === savedProduct.id);
                  if (idx >= 0) {
                    const copy = [...prev];
                    copy[idx] = { ...copy[idx], ...savedProduct, catalogos: activeSlugs };
                    return copy;
                  }
                  return [{ ...savedProduct, catalogos: activeSlugs }, ...prev];
                });
                setAllProducts((prev) => {
                  const idx = prev.findIndex((p) => p.id === savedProduct.id);
                  if (idx >= 0) {
                    const copy = [...prev];
                    copy[idx] = { ...copy[idx], ...savedProduct, catalogos: activeSlugs };
                    return copy;
                  }
                  return [{ ...savedProduct, catalogos: activeSlugs }, ...prev];
                });
                setInactiveIds((prev) => {
                  const next = new Set(prev);
                  if (isActive) next.delete(savedProduct.id);
                  else next.add(savedProduct.id);
                  return next;
                });
                setAssignments((prev) => {
                  const filtered = prev.filter((a) => a.producto_id !== savedProduct.id);
                  const newAss: ProductoCatalogoAssignment[] = activeSlugs.map((slug) => ({
                    id: Date.now() + Math.random(),
                    producto_id: savedProduct.id,
                    sku: savedProduct.sku || null,
                    categoria_slug: slug,
                    incluir: true,
                  }));
                  return [...filtered, ...newAss];
                });
              }}
            />

            {/* Modal de confirmación para eliminar producto(s) */}
            {deleteConfirmTarget && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                onClick={(e) => {
                  if (e.target === e.currentTarget && !deletingProducts) {
                    setDeleteConfirmTarget(null);
                  }
                }}
              >
                <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-gray-100 p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center shrink-0">
                      <Trash2 size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-fredoka text-base font-bold text-gray-900">
                        {deleteConfirmTarget.mode === "single"
                          ? "¿Eliminar producto?"
                          : `¿Eliminar ${deleteConfirmTarget.ids.length} productos?`}
                      </h3>
                      <p className="font-quicksand text-xs text-gray-500 mt-1 leading-relaxed">
                        {deleteConfirmTarget.mode === "single" ? (
                          <>
                            Vas a eliminar permanentemente{" "}
                            <span className="font-bold text-gray-800">
                              {deleteConfirmTarget.product.nombre}
                            </span>{" "}
                            ({deleteConfirmTarget.product.sku}).
                          </>
                        ) : (
                          <>
                            Vas a eliminar permanentemente{" "}
                            <span className="font-bold text-gray-800">
                              {deleteConfirmTarget.ids.length} productos seleccionados
                            </span>{" "}
                            del catálogo.
                          </>
                        )}{" "}
                        Esta acción no se puede deshacer.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      disabled={deletingProducts}
                      onClick={() => setDeleteConfirmTarget(null)}
                      className="px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 font-quicksand text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={deletingProducts}
                      onClick={handleConfirmDeleteProducts}
                      className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-quicksand text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {deletingProducts ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                      <span>{deletingProducts ? "Eliminando..." : "Eliminar"}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal de asignación de catálogos y eventos */}
            {editingProductoCatalogos && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                onClick={(e) => { if (e.target === e.currentTarget) setEditingProductoCatalogos(null); }}
              >
                <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-gray-100 max-h-[88vh] flex flex-col">

                  {/* Header */}
                  <div className="flex items-center justify-between px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-gray-100 shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                      {editingProductoCatalogos.imagen && (
                        <img
                          src={editingProductoCatalogos.imagen}
                          alt=""
                          className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl object-cover border border-gray-100 bg-gray-50 shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <h3 className="font-quicksand text-sm font-bold text-gray-900 truncate">
                          {editingProductoCatalogos.nombre}
                        </h3>
                        <p className="font-quicksand text-[11px] text-gray-400 font-mono">{editingProductoCatalogos.sku}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingProductoCatalogos(null)}
                      className="ml-3 shrink-0 p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Body scrollable */}
                  <div className="overflow-y-auto flex-1 px-4 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5">

                    {/* Asignaciones actuales */}
                    <div>
                      <p className="font-quicksand text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">
                        Actualmente en
                      </p>
                      {selectedSlugsForProducto.length === 0 ? (
                        <p className="font-quicksand text-xs text-gray-400 italic py-2">
                          Este producto no está asignado a ningún catálogo o evento.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {selectedSlugsForProducto.map((slug) => {
                            const badgeInfo = getSlugBadgeInfo(slug, eventos, allCatalogos);
                            return (
                              <span
                                key={slug}
                                className={`inline-flex items-center gap-1.5 font-quicksand text-xs font-bold px-3 py-1 rounded-full border ${badgeInfo.colorClass}`}
                              >
                                {badgeInfo.label}
                                <button
                                  type="button"
                                  onClick={() => handleToggleSlugSelection(slug)}
                                  className="ml-0.5 hover:opacity-70 transition-opacity"
                                  title={`Quitar de ${badgeInfo.label}`}
                                >
                                  <X size={11} />
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="border-t border-gray-100" />

                    {/* Catálogos disponibles */}
                    <div>
                      <p className="font-quicksand text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3">
                        Catálogos de tienda
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {allCatalogos.map((cat) => {
                          const isChecked = selectedSlugsForProducto.includes(cat.slug);
                          return (
                            <button
                              key={cat.slug}
                              type="button"
                              onClick={() => handleToggleSlugSelection(cat.slug)}
                              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all ${
                                isChecked
                                  ? "bg-[#FDF4F7] border-[#EE6B8D] text-gray-900"
                                  : "border-gray-200 hover:border-gray-300 text-gray-600 bg-white"
                              }`}
                            >
                              <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                isChecked ? "bg-[#EE6B8D] border-[#EE6B8D]" : "border-gray-300"
                              }`}>
                                {isChecked && <Check size={10} className="text-white" strokeWidth={3} />}
                              </span>
                              <span className="font-quicksand text-xs font-bold truncate">{cat.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Eventos disponibles */}
                    <div>
                      <p className="font-quicksand text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3">
                        Eventos y campañas
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {allAvailableEvents.map((ev) => {
                          const isChecked = selectedSlugsForProducto.includes(ev.slug);
                          return (
                            <button
                              key={ev.slug}
                              type="button"
                              onClick={() => handleToggleSlugSelection(ev.slug)}
                              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all ${
                                isChecked
                                  ? "bg-[#FDF4F7] border-[#EE6B8D] text-gray-900"
                                  : "border-gray-200 hover:border-gray-300 text-gray-600 bg-white"
                              }`}
                            >
                              <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                isChecked ? "bg-[#EE6B8D] border-[#EE6B8D]" : "border-gray-300"
                              }`}>
                                {isChecked && <Check size={10} className="text-white" strokeWidth={3} />}
                              </span>
                              <span className="font-quicksand text-xs font-bold truncate">{ev.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                  </div>

                  {/* Footer con acciones */}
                  <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-100 shrink-0 bg-gray-50/50 rounded-b-2xl">
                    <p className="font-quicksand text-[11px] text-gray-400">
                      {selectedSlugsForProducto.length} seleccionado{selectedSlugsForProducto.length !== 1 ? "s" : ""}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingProductoCatalogos(null)}
                        className="px-3.5 sm:px-4 py-2 text-xs font-quicksand font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors border border-gray-200"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={savingCatalogos}
                        onClick={handleSaveProductoCatalogos}
                        className="px-5 py-2 text-xs font-quicksand font-bold text-white bg-[#C04267] hover:bg-[#982B4D] rounded-xl transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {savingCatalogos ? (
                          <>
                            <Loader2 size={13} className="animate-spin" />
                            <span>Guardando...</span>
                          </>
                        ) : (
                          <>
                            <Save size={13} />
                            <span>Guardar cambios</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}


            {/* Modal de asignación masiva en lote */}
            {bulkModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
                <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#FDE8EF]">
                  <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-pink-50 text-[#C04267] flex items-center justify-center">
                        <Layers size={18} />
                      </div>
                      <h3 className="font-fredoka text-lg font-bold text-gray-900">
                        Asignación en Lote
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBulkModalOpen(false)}
                      className="p-1.5 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <p className="font-quicksand text-xs text-gray-600 mb-4">
                    Has seleccionado <strong>{selectedProductIds.size}</strong> productos. Elige el catálogo o evento al que deseas agregarlos o quitarlos:
                  </p>

                  <div className="mb-5">
                    <label className="block font-quicksand text-xs font-bold text-gray-700 mb-1.5">
                      Catálogo o Evento Destino:
                    </label>
                    <select
                      value={bulkTargetSlug}
                      onChange={(e) => setBulkTargetSlug(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl font-quicksand text-xs text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D]"
                    >
                      <optgroup label="Catálogos Principales">
                        {allCatalogos.map((c) => (
                          <option key={c.slug} value={c.slug}>
                            {c.label}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Eventos Especiales">
                        {allAvailableEvents.map((ev) => (
                          <option key={ev.slug} value={ev.slug}>
                            {ev.label}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>

                  <div className="flex flex-col gap-2 pt-2">
                    <button
                      type="button"
                      disabled={bulkSaving}
                      onClick={() => handleBulkAssign("agregar")}
                      className="w-full py-2.5 px-4 bg-[#EE6B8D] hover:bg-[#C04267] text-white font-quicksand text-xs font-bold rounded-xl transition-colors shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {bulkSaving ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <span>Agregar a los {selectedProductIds.size} productos</span>
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={bulkSaving}
                      onClick={() => handleBulkAssign("quitar")}
                      className="w-full py-2 px-4 border border-red-200 text-red-600 hover:bg-red-50 font-quicksand text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
                    >
                      Quitar de los {selectedProductIds.size} productos
                    </button>
                    <button
                      type="button"
                      onClick={() => setBulkModalOpen(false)}
                      className="w-full py-1.5 text-gray-400 hover:text-gray-600 font-quicksand text-xs font-semibold"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal para crear o eliminar catálogos de tienda */}
            {catalogoManagerOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
                <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#FDE8EF]">
                  <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-pink-50 text-[#C04267] flex items-center justify-center">
                        <Package size={18} />
                      </div>
                      <h3 className="font-fredoka text-lg font-bold text-gray-900">
                        Gestionar Catálogos
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCatalogoManagerOpen(false)}
                      className="p-1.5 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <form onSubmit={handleCreateCatalogo} className="flex gap-2 mb-5">
                    <input
                      type="text"
                      value={newCatalogoNombre}
                      onChange={(e) => setNewCatalogoNombre(e.target.value)}
                      placeholder="Ej. Llaveros, Accesorios..."
                      className="flex-1 px-3.5 py-2 border border-gray-200 rounded-xl font-quicksand text-xs text-gray-800 focus:outline-none focus:border-[#EE6B8D]"
                    />
                    <button
                      type="submit"
                      disabled={savingCatalogo || !newCatalogoNombre.trim()}
                      className="px-4 py-2 bg-[#EE6B8D] hover:bg-[#C04267] text-white font-quicksand text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {savingCatalogo ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                      <span>Crear</span>
                    </button>
                  </form>

                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {allCatalogos
                      .filter((c) => c.slug !== "personalizados")
                      .map((c) => {
                        const isCustom = customCatalogoSlugs.includes(c.slug);
                        return (
                          <div
                            key={c.slug}
                            className="flex items-center justify-between px-3 py-2 rounded-xl border border-gray-100 bg-gray-50/60"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`px-2 py-0.5 rounded-full text-[11px] font-quicksand font-bold border ${c.colorBadge}`}>
                                {c.label}
                              </span>
                              <span className="font-quicksand text-[11px] text-gray-400 truncate">
                                /catalogo/{c.slug}
                              </span>
                            </div>
                            {isCustom ? (
                              <button
                                type="button"
                                onClick={() => handleDeleteCatalogo(c.slug, c.label)}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Eliminar catálogo"
                              >
                                <Trash2 size={14} />
                              </button>
                            ) : (
                              <span className="font-quicksand text-[10px] text-gray-400 px-2">Base</span>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            )}
          </div>
          );
        })()}

        {mainTab === "catalogo" && subTab === "precios" && (
          <div>
            <div className="mb-6">
              <h2 className="font-fredoka text-xl font-bold text-[#C04267]">Precios por tamaño</h2>
              <p className="font-quicksand text-xs text-gray-400 mt-1">
                Precio que se mostrará en el detalle del producto según el tamaño que elija el cliente.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="font-quicksand text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#FDE8EF] text-[#C04267]">Pequeño = Costo</span>
              <span className="font-quicksand text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#FDE8EF] text-[#C04267]">Mediano = Sugerido</span>
              <span className="font-quicksand text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#FDE8EF] text-[#C04267]">Grande = Mínimo</span>
            </div>

            {amiguProducts.length === 0 ? (
              <div className="flex items-center justify-center py-20 bg-white rounded-2xl border border-[#FDE8EF]">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 size={24} className="animate-spin text-[#EE6B8D]" />
                  <p className="font-quicksand text-xs text-gray-400">Cargando productos personalizados...</p>
                </div>
              </div>
            ) : (
              <div>
                {/* 1. VISTA TARJETAS PARA CELULARES Y TABLETS VERTICALES (lg:hidden) */}
                <div className="lg:hidden space-y-3">
                  {amiguProducts.map((p) => {
                    const draft = preciosDraft[p.sku];
                    const saved = preciosRows[p.sku];
                    const hasChanges = (() => {
                      if (!saved) return false;
                      const eq = (a: unknown, b: string) => {
                        if (b.trim() === "") return a == null;
                        return Number(a) === parseFloat(b);
                      };
                      return !(
                        eq(saved.precio_pequeno, draft?.pequeno || "") &&
                        eq(saved.precio_mediano, draft?.mediano || "") &&
                        eq(saved.precio_grande, draft?.grande || "")
                      );
                    })();

                    return (
                      <div
                        key={p.id}
                        className="bg-white rounded-2xl border border-[#FDE8EF] p-4 shadow-xs space-y-3 font-quicksand"
                      >
                        <div className="flex items-start gap-3">
                          {p.imagen && (
                            <img
                              src={p.imagen}
                              alt=""
                              className="w-12 h-12 rounded-xl object-cover bg-gray-100 shrink-0 border border-pink-100"
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-gray-800 text-xs sm:text-sm line-clamp-2">
                              {p.nombre}
                            </h4>
                            <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500">
                              <span className="font-mono">{p.sku}</span>
                              <span>•</span>
                              <span>Base: S/ {p.precio?.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100">
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-1 font-semibold">
                              Pequeño (10–15cm)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={draft?.pequeno ?? ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                setPreciosDraft((prev) => {
                                  const current = prev[p.sku] || { pequeno: "", mediano: "", grande: "" };
                                  return { ...prev, [p.sku]: { ...current, pequeno: v } };
                                });
                              }}
                              placeholder="S/ —"
                              className="w-full px-2 py-1.5 border border-gray-200 rounded-xl text-xs font-bold text-center focus:outline-none focus:ring-1 focus:ring-[#EE6B8D]"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] text-gray-500 mb-1 font-semibold">
                              Mediano (16–25cm)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={draft?.mediano ?? ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                setPreciosDraft((prev) => {
                                  const current = prev[p.sku] || { pequeno: "", mediano: "", grande: "" };
                                  return { ...prev, [p.sku]: { ...current, mediano: v } };
                                });
                              }}
                              placeholder="S/ —"
                              className="w-full px-2 py-1.5 border border-gray-200 rounded-xl text-xs font-bold text-center focus:outline-none focus:ring-1 focus:ring-[#EE6B8D]"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] text-gray-500 mb-1 font-semibold">
                              Grande (26cm+)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={draft?.grande ?? ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                setPreciosDraft((prev) => {
                                  const current = prev[p.sku] || { pequeno: "", mediano: "", grande: "" };
                                  return { ...prev, [p.sku]: { ...current, grande: v } };
                                });
                              }}
                              placeholder="S/ —"
                              className="w-full px-2 py-1.5 border border-gray-200 rounded-xl text-xs font-bold text-center focus:outline-none focus:ring-1 focus:ring-[#EE6B8D]"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                          <div>
                            {saved && hasChanges && (
                              <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                                Sin guardar
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => handleGuardarPrecios(p.sku)}
                            disabled={preciosSaving === p.sku}
                            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                              preciosSaving === p.sku
                                ? "bg-gray-100 text-gray-400"
                                : "bg-[#EE6B8D] hover:bg-[#C04267] text-white shadow-xs"
                            }`}
                          >
                            {preciosSaving === p.sku ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : saved ? (
                              <Save size={13} />
                            ) : null}
                            {preciosSaving === p.sku ? "Guardando..." : saved ? "Guardado" : "Guardar precios"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 2. TABLA COMPLETA PARA PANTALLAS GRANDES (hidden lg:block) */}
                <div className="hidden lg:block bg-white rounded-2xl border border-[#FDE8EF] shadow-sm overflow-x-auto">
                  <table className="w-full text-left text-sm min-w-full">
                    <thead>
                      <tr className="border-b border-[#FDE8EF] bg-gray-50/50">
                        <th className="px-3 py-3 font-quicksand text-xs text-gray-500 uppercase tracking-wider whitespace-nowrap">Producto</th>
                        <th className="px-3 py-3 font-quicksand text-xs text-gray-500 uppercase tracking-wider whitespace-nowrap">SKU</th>
                        <th className="px-3 py-3 font-quicksand text-xs text-gray-500 uppercase tracking-wider whitespace-nowrap">Precio Ventify</th>
                        <th className="px-3 py-3 font-quicksand text-xs text-gray-500 uppercase tracking-wider whitespace-nowrap">Pequeño (10–15 cm)</th>
                        <th className="px-3 py-3 font-quicksand text-xs text-gray-500 uppercase tracking-wider whitespace-nowrap">Mediano (16–25 cm)</th>
                        <th className="px-3 py-3 font-quicksand text-xs text-gray-500 uppercase tracking-wider whitespace-nowrap">Grande (26 cm a más)</th>
                        <th className="px-3 py-3 font-quicksand text-xs text-gray-500 uppercase tracking-wider whitespace-nowrap text-right">Guardar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {amiguProducts.map((p) => {
                        const draft = preciosDraft[p.sku];
                        const saved = preciosRows[p.sku];
                        const hasChanges = (() => {
                          if (!saved) return false;
                          const eq = (a: unknown, b: string) => {
                            if (b.trim() === "") return a == null;
                            return Number(a) === parseFloat(b);
                          };
                          return !(
                            eq(saved.precio_pequeno, draft?.pequeno || "") &&
                            eq(saved.precio_mediano, draft?.mediano || "") &&
                            eq(saved.precio_grande, draft?.grande || "")
                          );
                        })();
                        return (
                          <tr key={p.id} className="border-b border-gray-50 hover:bg-[#FDF4F7]/50 transition-colors">
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-3">
                                {p.imagen && <img src={p.imagen} alt="" className="w-10 h-10 rounded-lg object-cover bg-gray-100 flex-shrink-0" />}
                                <p className="font-quicksand text-xs font-semibold text-gray-800 max-w-[200px] truncate" title={p.nombre}>{p.nombre}</p>
                              </div>
                            </td>
                            <td className="px-3 py-3 font-quicksand text-[11px] text-gray-500">{p.sku}</td>
                            <td className="px-3 py-3 font-quicksand text-xs text-gray-500 whitespace-nowrap">S/ {p.precio?.toFixed(2)}</td>
                            {(["pequeno", "mediano", "grande"] as const).map((key) => (
                              <td key={key} className="px-3 py-3">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={draft?.[key] ?? ""}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setPreciosDraft((prev) => {
                                      const current = prev[p.sku] || { pequeno: "", mediano: "", grande: "" };
                                      return { ...prev, [p.sku]: { ...current, [key]: v } };
                                    });
                                  }}
                                  placeholder="—"
                                  className="w-24 px-2.5 py-2 border border-gray-200 rounded-lg font-quicksand text-xs focus:outline-none focus:ring-2 focus:ring-[#EE6B8D]"
                                />
                              </td>
                            ))}
                            <td className="px-3 py-3 text-right">
                              <button
                                onClick={() => handleGuardarPrecios(p.sku)}
                                disabled={preciosSaving === p.sku}
                                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg font-quicksand text-xs font-semibold transition-colors ${
                                  preciosSaving === p.sku
                                    ? "bg-gray-100 text-gray-400"
                                    : "bg-[#EE6B8D] hover:bg-[#C04267] text-white shadow-sm"
                                }`}
                              >
                                {preciosSaving === p.sku ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : saved ? (
                                  <Save size={14} />
                                ) : null}
                                {preciosSaving === p.sku ? "Guardando..." : saved ? "Guardado" : "Guardar"}
                              </button>
                              {saved && hasChanges && (
                                <p className="font-quicksand text-[10px] text-amber-600 mt-1">Sin guardar</p>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {(mainTab === "atencion" || mainTab === "clientes") && subTab === "resenas" && !loading && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <h2 className="font-fredoka text-xl font-bold text-[#C04267]">Reseñas</h2>
              <button onClick={() => {
                setShowResenaForm(!showResenaForm);
                if (rawProducts.length === 0) {
                  fetchVentifyData()
                    .then((d) => {
                      setAllProducts(d.all);
                      setRawProducts(d.all);
                    })
                    .catch(() => {});
                }
              }}
                className="flex items-center gap-2 text-xs text-white bg-[#EE6B8D] hover:bg-[#C04267] px-4 py-2.5 rounded-lg font-quicksand font-semibold transition-colors shadow-sm self-start sm:self-auto"
              >
                <Plus size={14} />
                Agregar reseña manual
              </button>
            </div>

            {showResenaForm && (() => {
              const resenaPool = rawProducts.length >= allProducts.length ? rawProducts : allProducts;
              const resenaFiltered = resenaPool.filter((p) =>
                !resenaSearch ||
                p.nombre?.toLowerCase().includes(resenaSearch.toLowerCase()) ||
                p.sku?.toLowerCase().includes(resenaSearch.toLowerCase())
              );
              return (
              <div className="bg-white rounded-2xl border border-[#FDE8EF] shadow-sm p-5 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="font-quicksand text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5 block">
                      Producto ({resenaPool.length} disponibles)
                    </label>
                    <div className="relative">
                      <input
                        value={resenaSearch}
                        onFocus={() => setResenaPickerOpen(true)}
                        onChange={(e) => {
                          setResenaSearch(e.target.value);
                          setResenaPickerOpen(true);
                        }}
                        placeholder="Buscar o elegir producto por nombre o SKU..."
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg font-quicksand text-sm focus:outline-none focus:ring-2 focus:ring-[#EE6B8D] pr-16"
                      />
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        {resenaSearch && (
                          <button
                            type="button"
                            onClick={() => setResenaSearch("")}
                            className="p-1 text-gray-400 hover:text-gray-600 cursor-pointer"
                            aria-label="Limpiar búsqueda"
                          >
                            <X size={14} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setResenaPickerOpen((prev) => !prev)}
                          className="p-1 text-gray-400 hover:text-[#C04267] cursor-pointer"
                          aria-label="Mostrar lista de productos"
                        >
                          <ChevronDown size={16} className={resenaPickerOpen ? "rotate-180 transition-transform" : "transition-transform"} />
                        </button>
                      </div>
                    </div>
                    {(resenaPickerOpen || resenaSearch) && (
                      <div className="mt-2 border border-gray-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto bg-white">
                        {resenaFiltered.slice(0, 50).map((p) => (
                            <button
                              type="button"
                              key={p.id}
                              onClick={() => {
                                setResenaProducto(p);
                                setResenaSearch("");
                                setResenaPickerOpen(false);
                              }}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[#FDF4F7] transition-colors cursor-pointer ${resenaProducto?.id === p.id ? 'bg-[#FDF4F7] border-l-4 border-[#EE6B8D]' : ''}`}
                            >
                              {p.imagen && <img src={p.imagen} alt="" className="w-10 h-10 rounded-lg object-cover bg-gray-100 flex-shrink-0" />}
                              <div className="min-w-0 flex-1">
                                <p className="font-quicksand text-xs font-semibold text-gray-800 truncate">{p.nombre}</p>
                                <p className="font-quicksand text-[10px] text-gray-400">{p.sku} · S/ {p.precio?.toFixed(2)}</p>
                              </div>
                              {resenaProducto?.id === p.id && <Check size={16} className="text-[#EE6B8D] flex-shrink-0" />}
                            </button>
                          ))}
                        {resenaPool.length === 0 ? (
                          <p className="p-4 text-center font-quicksand text-xs text-gray-400">Cargando productos...</p>
                        ) : resenaFiltered.length === 0 ? (
                          <p className="p-4 text-center font-quicksand text-xs text-gray-400">No se encontraron productos con &ldquo;{resenaSearch}&rdquo;</p>
                        ) : null}
                      </div>
                    )}
                    {resenaProducto && (
                      <div className="bg-[#FDE8EF] rounded-xl p-3 flex items-center gap-3 mt-2">
                        <Check size={18} className="text-[#C04267] flex-shrink-0" />
                        <p className="font-quicksand text-xs text-gray-700">
                          Producto: <strong>{resenaProducto.nombre}</strong> · {resenaProducto.sku}
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <label className="font-quicksand text-xs font-bold text-gray-600 uppercase tracking-wider">
                        Cliente
                      </label>
                      <div className="inline-flex rounded-lg bg-gray-100 p-0.5 text-[11px] font-quicksand font-bold">
                        <button
                          type="button"
                          onClick={() => {
                            setResenaClientMode("existente");
                            setResenaClientDropdownOpen(true);
                          }}
                          className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                            resenaClientMode === "existente"
                              ? "bg-white text-[#C04267] shadow-2xs"
                              : "text-gray-500 hover:text-gray-700"
                          }`}
                        >
                          Existente ({clientesDirectory.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setResenaClientMode("nuevo");
                            setResenaClientDropdownOpen(false);
                          }}
                          className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                            resenaClientMode === "nuevo"
                              ? "bg-white text-[#C04267] shadow-2xs"
                              : "text-gray-500 hover:text-gray-700"
                          }`}
                        >
                          + Nuevo cliente
                        </button>
                      </div>
                    </div>

                    {resenaClientMode === "existente" ? (
                      <div className="space-y-2">
                        <div className="relative">
                          <input
                            value={resenaClientSearch}
                            onFocus={() => setResenaClientDropdownOpen(true)}
                            onChange={(e) => {
                              setResenaClientSearch(e.target.value);
                              setResenaClientDropdownOpen(true);
                            }}
                            placeholder={resenaNombre ? `Seleccionado: ${resenaNombre}` : "Buscar cliente registrado o de pedidos..."}
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg font-quicksand text-sm focus:outline-none focus:ring-2 focus:ring-[#EE6B8D] pr-8"
                          />
                          <button
                            type="button"
                            onClick={() => setResenaClientDropdownOpen((prev) => !prev)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#C04267] cursor-pointer"
                          >
                            <ChevronDown size={15} className={resenaClientDropdownOpen ? "rotate-180 transition-transform" : "transition-transform"} />
                          </button>
                        </div>

                        {resenaClientDropdownOpen && (
                          <div className="border border-gray-200 rounded-xl max-h-48 overflow-y-auto bg-white divide-y divide-gray-100">
                            {clientesDirectory
                              .filter((c) => {
                                const q = resenaClientSearch.toLowerCase().trim();
                                if (!q) return true;
                                return (
                                  c.nombre.toLowerCase().includes(q) ||
                                  (c.telefono || "").includes(q) ||
                                  (c.email || "").toLowerCase().includes(q)
                                );
                              })
                              .slice(0, 40)
                              .map((c) => (
                                <button
                                  type="button"
                                  key={c.id}
                                  onClick={() => {
                                    setResenaNombre(c.nombre);
                                    setResenaClientSearch("");
                                    setResenaClientDropdownOpen(false);
                                  }}
                                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-[#FDF4F7] transition-colors cursor-pointer ${
                                    resenaNombre === c.nombre ? "bg-[#FDF4F7]" : ""
                                  }`}
                                >
                                  <div className="min-w-0">
                                    <p className="font-quicksand text-xs font-bold text-gray-800 truncate">{c.nombre}</p>
                                    {(c.telefono || c.email) && (
                                      <p className="font-quicksand text-[10px] text-gray-400 truncate">
                                        {[c.telefono, c.email].filter(Boolean).join(" · ")}
                                      </p>
                                    )}
                                  </div>
                                  {c.origen && (
                                    <span className="text-[10px] font-quicksand font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 shrink-0">
                                      {c.origen}
                                    </span>
                                  )}
                                </button>
                              ))}
                            {clientesDirectory.length === 0 && (
                              <p className="p-3 text-center font-quicksand text-xs text-gray-400">
                                Aún no hay clientes guardados. Usa &ldquo;+ Nuevo cliente&rdquo;.
                              </p>
                            )}
                          </div>
                        )}

                        {resenaNombre && (
                          <div className="bg-[#FDF4F7] border border-[#FDE8EF] rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                            <span className="font-quicksand text-xs font-bold text-[#C04267] truncate">
                              Cliente: {resenaNombre}
                            </span>
                            <button
                              type="button"
                              onClick={() => setResenaNombre("")}
                              className="text-gray-400 hover:text-gray-600 cursor-pointer"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <input
                          value={resenaNombre}
                          onChange={(e) => setResenaNombre(e.target.value)}
                          placeholder="Nombre completo del cliente *"
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-lg font-quicksand text-sm focus:outline-none focus:ring-2 focus:ring-[#EE6B8D]"
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            value={resenaClienteTelefono}
                            onChange={(e) => setResenaClienteTelefono(e.target.value)}
                            placeholder="Teléfono / WhatsApp (opcional)"
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg font-quicksand text-xs focus:outline-none focus:ring-2 focus:ring-[#EE6B8D]"
                          />
                          <input
                            value={resenaClienteDireccion}
                            onChange={(e) => setResenaClienteDireccion(e.target.value)}
                            placeholder="Dirección (opcional)"
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg font-quicksand text-xs focus:outline-none focus:ring-2 focus:ring-[#EE6B8D]"
                          />
                        </div>
                        <label className="flex items-center gap-2 font-quicksand text-xs text-gray-600 cursor-pointer pt-0.5">
                          <input
                            type="checkbox"
                            checked={resenaGuardarCliente}
                            onChange={(e) => setResenaGuardarCliente(e.target.checked)}
                            className="rounded border-gray-300 text-[#EE6B8D] focus:ring-[#EE6B8D]"
                          />
                          <span>Guardar cliente para elegirlo en futuros pedidos</span>
                        </label>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="font-quicksand text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5 block">Calificación</label>
                    <div className="flex items-center gap-1 py-2">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <button key={i} onClick={() => setResenaCalificacion(i)} className="p-0.5">
                          <Star size={22} className={i <= resenaCalificacion ? "text-[#F5A623]" : "text-gray-200"} fill={i <= resenaCalificacion ? "#F5A623" : "none"} />
                        </button>
                      ))}
                      {resenaCalificacion > 0 && (
                        <span className="font-quicksand text-xs text-gray-500 ml-2">{resenaCalificacion}/5</span>
                      )}
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="font-quicksand text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5 block">Comentario (opcional)</label>
                    <textarea
                      value={resenaComentario}
                      onChange={(e) => setResenaComentario(e.target.value)}
                      rows={2}
                      placeholder="Ej: Hermoso trabajo, calidad excelente"
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg font-quicksand text-sm focus:outline-none focus:ring-2 focus:ring-[#EE6B8D] resize-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-4">
                  <button onClick={() => setShowResenaForm(false)}
                    className="px-4 py-2.5 rounded-lg font-quicksand text-xs font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button onClick={handleCrearResenaManual}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-quicksand text-xs font-semibold text-white bg-[#EE6B8D] hover:bg-[#C04267] transition-colors"
                  >
                    <Check size={14} />
                    Publicar reseña
                  </button>
                </div>
              </div>
              );
            })()}

            {data.length === 0 && (
              <div className="text-center py-16 bg-white rounded-2xl border border-[#FDE8EF]">
                <Star size={28} className="mx-auto text-gray-200 mb-2" />
                <p className="font-quicksand text-gray-400">No hay reseñas todavía.</p>
                <p className="font-quicksand text-xs text-gray-400 mt-1">
                  Cuando un cliente califique, aparecerá aquí para que la apruebes o elimines.
                </p>
              </div>
            )}

            {data.length > 0 && (
              <div>
                {/* 1. VISTA TARJETAS PARA CELULARES Y TABLETS VERTICALES (lg:hidden) */}
                <div className="lg:hidden space-y-3">
                  {data.map((row) => (
                    <div
                      key={row.id}
                      className="bg-white rounded-2xl border border-[#FDE8EF] p-4 shadow-xs space-y-3 font-quicksand"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-gray-800 text-xs sm:text-sm truncate" title={row.producto_nombre || ""}>
                            {row.producto_nombre || "Producto general"}
                          </h4>
                          {row.producto_sku && (
                            <span className="text-[10px] text-gray-400 font-mono">
                              SKU: {row.producto_sku}
                            </span>
                          )}
                        </div>
                        <span className={`shrink-0 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                          row.aprobado ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                        }`}>
                          {row.aprobado ? "Aprobada" : "Pendiente"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-gray-700">{row.nombre_cliente}</span>
                        <div className="flex items-center gap-1">
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((i) => (
                              <Star
                                key={i}
                                size={12}
                                className={i <= (row.calificacion ?? 0) ? "text-[#F5A623]" : "text-gray-200"}
                                fill={i <= (row.calificacion ?? 0) ? "#F5A623" : "none"}
                              />
                            ))}
                          </div>
                          <span className="text-gray-500 font-bold text-xs ml-1">{row.calificacion}/5</span>
                        </div>
                      </div>

                      {row.comentario && (
                        <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100 text-xs text-gray-600 italic">
                          &quot;{row.comentario}&quot;
                          {row.es_manual && (
                            <span className="not-italic ml-2 text-[10px] uppercase tracking-wider text-purple-600 bg-purple-50 px-1.5 py-0.2 rounded-md font-bold">
                              Manual
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs">
                        <span className="text-[11px] text-gray-400">{formatDate(row.created_at)}</span>
                        <div className="flex items-center gap-2">
                          {!row.aprobado && (
                            <button
                              onClick={() => handleAprobarResena(row.id, true)}
                              className="flex items-center gap-1 text-xs text-white bg-[#EE6B8D] hover:bg-[#C04267] font-bold px-3 py-1.5 rounded-xl transition-all shadow-2xs"
                            >
                              <Check size={13} /> Aprobar
                            </button>
                          )}
                          {row.aprobado && (
                            <button
                              onClick={() => handleAprobarResena(row.id, false)}
                              className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 hover:bg-amber-100 font-bold px-2.5 py-1.5 rounded-xl transition-all border border-amber-200"
                            >
                              <Eye size={13} /> Ocultar
                            </button>
                          )}
                          <button
                            onClick={() => handleEliminarResena(row.id)}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                            title="Eliminar reseña"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 2. TABLA COMPLETA PARA PANTALLAS GRANDES (hidden lg:block) */}
                <div className="hidden lg:block bg-white rounded-2xl border border-[#FDE8EF] shadow-sm overflow-x-auto">
                  <table className="w-full text-left text-sm min-w-full">
                    <thead>
                      <tr className="border-b border-[#FDE8EF] bg-gray-50/50">
                        <th className="px-3 py-3 font-quicksand text-xs text-gray-500 uppercase tracking-wider whitespace-nowrap">Producto</th>
                        <th className="px-3 py-3 font-quicksand text-xs text-gray-500 uppercase tracking-wider whitespace-nowrap">Cliente</th>
                        <th className="px-3 py-3 font-quicksand text-xs text-gray-500 uppercase tracking-wider whitespace-nowrap">Calificación</th>
                        <th className="px-3 py-3 font-quicksand text-xs text-gray-500 uppercase tracking-wider whitespace-nowrap">Comentario</th>
                        <th className="px-3 py-3 font-quicksand text-xs text-gray-500 uppercase tracking-wider whitespace-nowrap">Estado</th>
                        <th className="px-3 py-3 font-quicksand text-xs text-gray-500 uppercase tracking-wider whitespace-nowrap">Fecha</th>
                        <th className="px-3 py-3 font-quicksand text-xs text-gray-500 uppercase tracking-wider whitespace-nowrap">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.map((row) => (
                        <tr key={row.id} className="border-b border-gray-50 hover:bg-[#FDF4F7]/50 transition-colors">
                          <td className="px-3 py-3">
                            <p className="font-quicksand text-xs font-semibold text-gray-800 max-w-[220px] truncate" title={row.producto_nombre || ""}>
                              {row.producto_nombre || "—"}
                            </p>
                            <p className="font-quicksand text-[10px] text-gray-400">{row.producto_sku || ""}</p>
                          </td>
                          <td className="px-3 py-3 font-quicksand text-xs text-gray-700">{row.nombre_cliente}</td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1">
                              <div className="flex items-center gap-0.5">
                                {[1, 2, 3, 4, 5].map((i) => (
                                  <Star key={i} size={12} className={i <= (row.calificacion ?? 0) ? "text-[#F5A623]" : "text-gray-200"} fill={i <= (row.calificacion ?? 0) ? "#F5A623" : "none"} />
                                ))}
                              </div>
                              <span className="font-quicksand text-xs text-gray-500 ml-1">{row.calificacion}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3 font-quicksand text-xs text-gray-500 max-w-[260px]">
                            <p className="truncate" title={row.comentario || ""}>{row.comentario || "—"}</p>
                            {row.es_manual && (
                              <span className="text-[10px] uppercase tracking-wider text-purple-500 bg-purple-50 px-2 py-0.5 rounded-full">Manual</span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <span className={`font-quicksand text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              row.aprobado ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                            }`}>
                              {row.aprobado ? "Aprobada" : "Pendiente"}
                            </span>
                          </td>
                          <td className="px-3 py-3 font-quicksand text-xs text-gray-500 whitespace-nowrap">{formatDate(row.created_at)}</td>
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap gap-1.5">
                              {!row.aprobado && (
                                <button onClick={() => handleAprobarResena(row.id, true)}
                                  className="flex items-center gap-1 text-xs text-[#EE6B8D] hover:text-[#C04267] font-quicksand font-medium"
                                >
                                  <Check size={14} /> Aprobar
                                </button>
                              )}
                              {row.aprobado && (
                                <button onClick={() => handleAprobarResena(row.id, false)}
                                  className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-quicksand font-medium"
                                >
                                  <Eye size={14} /> Ocultar
                                </button>
                              )}
                              <button onClick={() => handleEliminarResena(row.id)}
                                className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 font-quicksand font-medium"
                              >
                                <Trash2 size={14} /> Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {mainTab === "pedidos" && subTab === "pedidos" && !loading && (
          <div>
            <PedidosView
              pedidos={data}
              loading={loading}
              onCambiarEstado={handleCambiarEstado}
              onOpenAgendarModal={() => setAgendarModalOpen(true)}
              onActualizarPedido={handleActualizarPedido}
            />
            <AgendarPedidoModal
              isOpen={agendarModalOpen}
              onClose={() => setAgendarModalOpen(false)}
              availableProducts={rawProducts}
              onSaveSuccess={() => {
                fetchData();
              }}
            />
          </div>
        )}

        {mainTab === "produccion" && (
          <div>
            <ProduccionMainView
              onSubTabChange={(subSlug) => {
                try {
                  const params = new URLSearchParams(window.location.search);
                  params.set("seccion", "produccion");
                  params.set("sub", subSlug);
                  window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
                  localStorage.setItem("admin_produccion_subtab", subSlug);
                } catch {
                  // ignore
                }
              }}
            />
          </div>
        )}

        {mainTab === "clientes" && subTab === "top_clientes" && !loading && (() => {
          const statsMap = new Map<
            string,
            {
              key: string;
              nombre: string;
              telefono: string;
              direccion: string;
              pedidosCount: number;
              totalGastado: number;
              ultimoPedido: string;
            }
          >();

          (Array.isArray(data) ? data : []).forEach((row) => {
            if (String(row.estado || "").toLowerCase() === "cancelado") return;
            const rawName = String(row.cliente_nombre || "").trim();
            if (!rawName) return;
            const key = rawName
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .toLowerCase()
              .trim();
            const totalRow = Number(row.total || 0);
            const telRow = String(row.cliente_telefono || "").trim();
            const dirRow = String(row.direccion_envio || "").trim();
            const fechaRow = String(row.created_at || "");

            const existing = statsMap.get(key);
            if (!existing) {
              statsMap.set(key, {
                key,
                nombre: rawName,
                telefono: telRow,
                direccion: dirRow && dirRow !== "Coordinar por WhatsApp" ? dirRow : "",
                pedidosCount: 1,
                totalGastado: totalRow,
                ultimoPedido: fechaRow,
              });
            } else {
              existing.pedidosCount += 1;
              existing.totalGastado += totalRow;
              if (!existing.telefono && telRow) existing.telefono = telRow;
              if (!existing.direccion && dirRow && dirRow !== "Coordinar por WhatsApp") {
                existing.direccion = dirRow;
              }
              if (fechaRow && (!existing.ultimoPedido || fechaRow > existing.ultimoPedido)) {
                existing.ultimoPedido = fechaRow;
              }
            }
          });

          const allRanked = Array.from(statsMap.values());
          const recurrentesCount = allRanked.filter((c) => c.pedidosCount >= 2).length;
          const totalIngresos = allRanked.reduce((acc, c) => acc + c.totalGastado, 0);

          const filteredRanked = allRanked
            .filter((c) => {
              const q = topClientesSearch.toLowerCase().trim();
              if (!q) return true;
              return c.nombre.toLowerCase().includes(q) || c.telefono.includes(q);
            })
            .sort((a, b) => {
              if (topClientesSort === "valor") {
                return b.totalGastado - a.totalGastado || b.pedidosCount - a.pedidosCount;
              }
              if (topClientesSort === "recientes") {
                return (b.ultimoPedido || "").localeCompare(a.ultimoPedido || "");
              }
              return b.pedidosCount - a.pedidosCount || b.totalGastado - a.totalGastado;
            });

          return (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="font-fredoka text-lg sm:text-xl font-bold text-[#C04267]">
                    Top Clientes y Frecuencia
                  </h2>
                  <p className="font-quicksand text-xs text-gray-500 mt-0.5">
                    Ranking calculado automáticamente con todos los pedidos (tienda y agendados, sin cancelados).
                  </p>
                </div>
              </div>

              {/* KPIs rápidos */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className="bg-white rounded-2xl border border-[#FDE8EF] p-3 sm:p-4 shadow-2xs">
                  <p className="font-quicksand text-[10px] sm:text-xs font-bold text-gray-400 uppercase">Clientes únicos</p>
                  <p className="font-fredoka text-lg sm:text-2xl font-bold text-gray-900 mt-0.5">{allRanked.length}</p>
                </div>
                <div className="bg-white rounded-2xl border border-[#FDE8EF] p-3 sm:p-4 shadow-2xs">
                  <p className="font-quicksand text-[10px] sm:text-xs font-bold text-gray-400 uppercase">Recurrentes (2+)</p>
                  <p className="font-fredoka text-lg sm:text-2xl font-bold text-[#C04267] mt-0.5">{recurrentesCount}</p>
                </div>
                <div className="bg-white rounded-2xl border border-[#FDE8EF] p-3 sm:p-4 shadow-2xs">
                  <p className="font-quicksand text-[10px] sm:text-xs font-bold text-gray-400 uppercase">Valor total</p>
                  <p className="font-fredoka text-lg sm:text-2xl font-bold text-emerald-600 mt-0.5">
                    S/ {totalIngresos.toFixed(0)}
                  </p>
                </div>
              </div>

              {/* Barra de búsqueda + orden */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="relative flex-1">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    value={topClientesSearch}
                    onChange={(e) => setTopClientesSearch(e.target.value)}
                    placeholder="Buscar cliente por nombre o teléfono..."
                    className="w-full pl-9 pr-8 py-2 bg-white border border-[#FDE8EF] rounded-xl font-quicksand text-xs sm:text-sm focus:outline-none focus:border-[#EE6B8D]"
                  />
                  {topClientesSearch && (
                    <button
                      type="button"
                      onClick={() => setTopClientesSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-3 sm:flex items-center gap-1.5 shrink-0">
                  {[
                    { id: "pedidos" as const, label: "Más pedidos" },
                    { id: "valor" as const, label: "Mayor valor" },
                    { id: "recientes" as const, label: "Recientes" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setTopClientesSort(opt.id)}
                      className={`px-3 py-2 rounded-xl font-quicksand text-xs font-bold border transition-all cursor-pointer whitespace-nowrap ${
                        topClientesSort === opt.id
                          ? "bg-[#EE6B8D] text-white border-[#EE6B8D] shadow-xs"
                          : "bg-white text-gray-600 border-[#FDE8EF] hover:border-[#EE6B8D]/60"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredRanked.length === 0 ? (
                <div className="bg-white rounded-2xl border border-[#FDE8EF] p-10 text-center font-quicksand text-xs text-gray-400">
                  No se encontraron clientes con pedidos registrados.
                </div>
              ) : (
                <>
                  {/* Tarjetas Móvil / Tablet (< lg) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:hidden gap-2.5">
                    {filteredRanked.map((c, idx) => {
                      const ticketProm = c.totalGastado / Math.max(1, c.pedidosCount);
                      const rawTel = c.telefono.replace(/\D/g, "");
                      const waNum = rawTel ? (rawTel.startsWith("51") ? rawTel : `51${rawTel}`) : "";
                      return (
                        <div
                          key={c.key}
                          className="bg-white rounded-2xl border border-[#FDE8EF] p-3.5 shadow-2xs space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className={`w-7 h-7 rounded-xl font-fredoka text-xs font-bold flex items-center justify-center shrink-0 ${
                                  idx === 0
                                    ? "bg-amber-100 text-amber-700 border border-amber-200"
                                    : idx === 1
                                    ? "bg-gray-100 text-gray-700 border border-gray-200"
                                    : idx === 2
                                    ? "bg-orange-100 text-orange-700 border border-orange-200"
                                    : "bg-pink-50 text-[#C04267]"
                                }`}
                              >
                                #{idx + 1}
                              </span>
                              <div className="min-w-0">
                                <p className="font-quicksand text-xs font-bold text-gray-900 truncate">{c.nombre}</p>
                                <p className="font-quicksand text-[11px] text-gray-400 truncate">
                                  {c.telefono || "Sin teléfono"}
                                </p>
                              </div>
                            </div>
                            {waNum && (
                              <a
                                href={`https://wa.me/${waNum}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1 rounded-lg bg-[#25D366]/10 text-[#25D366] font-quicksand text-[11px] font-bold shrink-0"
                              >
                                WhatsApp
                              </a>
                            )}
                          </div>

                          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100 text-center">
                            <div>
                              <span className="font-quicksand text-[10px] text-gray-400 block">Pedidos</span>
                              <span className="font-fredoka text-sm font-bold text-[#C04267]">{c.pedidosCount}</span>
                            </div>
                            <div>
                              <span className="font-quicksand text-[10px] text-gray-400 block">Total</span>
                              <span className="font-fredoka text-sm font-bold text-emerald-600">
                                S/ {c.totalGastado.toFixed(2)}
                              </span>
                            </div>
                            <div>
                              <span className="font-quicksand text-[10px] text-gray-400 block">Promedio</span>
                              <span className="font-fredoka text-sm font-bold text-gray-700">
                                S/ {ticketProm.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Tabla Desktop (hidden lg:block) */}
                  <div className="hidden lg:block bg-white rounded-2xl border border-[#FDE8EF] shadow-sm overflow-x-auto">
                    <table className="w-full text-left text-sm min-w-full">
                      <thead>
                        <tr className="border-b border-[#FDE8EF] bg-gray-50/50">
                          <th className="px-4 py-3 font-quicksand text-xs text-gray-500 uppercase tracking-wider">#</th>
                          <th className="px-4 py-3 font-quicksand text-xs text-gray-500 uppercase tracking-wider">Cliente</th>
                          <th className="px-4 py-3 font-quicksand text-xs text-gray-500 uppercase tracking-wider">Teléfono</th>
                          <th className="px-4 py-3 font-quicksand text-xs text-gray-500 uppercase tracking-wider text-center">Pedidos</th>
                          <th className="px-4 py-3 font-quicksand text-xs text-gray-500 uppercase tracking-wider text-right">Total Comprado</th>
                          <th className="px-4 py-3 font-quicksand text-xs text-gray-500 uppercase tracking-wider text-right">Ticket Promedio</th>
                          <th className="px-4 py-3 font-quicksand text-xs text-gray-500 uppercase tracking-wider text-right">Último Pedido</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRanked.map((c, idx) => {
                          const ticketProm = c.totalGastado / Math.max(1, c.pedidosCount);
                          const rawTel = c.telefono.replace(/\D/g, "");
                          const waNum = rawTel ? (rawTel.startsWith("51") ? rawTel : `51${rawTel}`) : "";
                          return (
                            <tr key={c.key} className="border-b border-gray-50 hover:bg-[#FDF4F7]/50 transition-colors">
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex items-center justify-center w-6 h-6 rounded-lg font-fredoka text-xs font-bold ${
                                    idx === 0
                                      ? "bg-amber-100 text-amber-700"
                                      : idx === 1
                                      ? "bg-gray-100 text-gray-700"
                                      : idx === 2
                                      ? "bg-orange-100 text-orange-700"
                                      : "bg-pink-50 text-[#C04267]"
                                  }`}
                                >
                                  {idx + 1}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <p className="font-quicksand text-xs font-bold text-gray-900">{c.nombre}</p>
                                {c.direccion && (
                                  <p className="font-quicksand text-[11px] text-gray-400 truncate max-w-[220px]">{c.direccion}</p>
                                )}
                              </td>
                              <td className="px-4 py-3 font-quicksand text-xs text-gray-600">
                                {waNum ? (
                                  <a
                                    href={`https://wa.me/${waNum}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[#25D366] hover:underline font-semibold"
                                  >
                                    {c.telefono}
                                  </a>
                                ) : (
                                  <span className="text-gray-400 italic">Sin tel.</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="inline-block px-2.5 py-0.5 rounded-full bg-pink-50 text-[#C04267] font-fredoka text-xs font-bold border border-pink-100">
                                  {c.pedidosCount}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right font-fredoka text-xs font-bold text-emerald-600">
                                S/ {c.totalGastado.toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-right font-quicksand text-xs text-gray-600">
                                S/ {ticketProm.toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-right font-quicksand text-xs text-gray-500 whitespace-nowrap">
                                {formatDate(c.ultimoPedido)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {mainTab !== "dashboard" && mainTab !== "produccion" && subTab !== "heroes" && subTab !== "inicio" && subTab !== "eventos" && subTab !== "catalogos" && subTab !== "resenas" && subTab !== "productos" && subTab !== "precios" && subTab !== "pedidos" && subTab !== "top_clientes" && !loading && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <h2 className="font-fredoka text-xl font-bold text-[#C04267] capitalize">
                {SUBTABS_BY_MAIN[mainTab]?.find(m => m.id === subTab)?.label || subTab}
              </h2>
              <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                <span className="font-quicksand text-xs font-semibold text-gray-500 bg-white border border-[#FDE8EF] px-3 py-1 rounded-full shadow-xs">
                  {data.length} {data.length === 1 ? "registro" : "registros"}
                </span>
                {subTab === "personalizados" && (
                  <button
                    type="button"
                    onClick={() => setPersonalizadoModalOpen(true)}
                    className="px-3.5 py-2 bg-[#EE6B8D] hover:bg-[#C04267] text-white rounded-xl font-quicksand font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <Plus size={15} />
                    <span>Nuevo Pedido Personalizado</span>
                  </button>
                )}
              </div>
            </div>

            {data.length === 0 ? (
              subTab === "personalizados" ? (
                <div className="text-center py-14 px-4 bg-white rounded-2xl border border-[#FDE8EF] shadow-xs max-w-lg mx-auto">
                  <div className="w-14 h-14 mx-auto mb-3.5 rounded-2xl bg-pink-50 text-[#EE6B8D] flex items-center justify-center">
                    <Mail size={26} />
                  </div>
                  <h3 className="font-fredoka text-lg font-bold text-[#C04267] mb-1.5">
                    No hay pedidos personalizados registrados
                  </h3>
                  <p className="font-quicksand text-xs text-gray-500 leading-relaxed mb-5 max-w-sm mx-auto">
                    Los pedidos a medida, cotizaciones o ítems personalizados registrados desde Pedidos de Tienda aparecerán aquí.
                  </p>
                  <button
                    type="button"
                    onClick={() => setPersonalizadoModalOpen(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#EE6B8D] hover:bg-[#C04267] text-white rounded-xl font-quicksand font-bold text-xs shadow-sm transition-all cursor-pointer"
                  >
                    <Plus size={16} />
                    <span>Registrar Pedido Personalizado</span>
                  </button>
                </div>
              ) : (
                <div className="text-center py-16 bg-white rounded-2xl border border-[#FDE8EF]">
                  <p className="font-quicksand text-xs text-gray-400">No hay registros en esta sección todavía.</p>
                </div>
              )
            ) : (
              <div>
            {/* 1. VISTA TARJETAS PARA CELULARES Y TABLETS VERTICALES (lg:hidden) */}
            <div className="lg:hidden space-y-3">
              {data.map((row) => {
                const cols = getColumns(data);
                return (
                  <div
                    key={row.id}
                    className="bg-white rounded-2xl border border-[#FDE8EF] p-4 shadow-xs space-y-2.5 font-quicksand text-xs"
                  >
                    <div className="space-y-2">
                      {cols.map((key) => {
                        const value = row[key];

                        if (key === "estado" && subTab === "personalizados") {
                          return (
                            <div key={key} className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100">
                              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                {key.replace(/_/g, " ")}:
                              </span>
                              <select
                                value={String(value || "pendiente")}
                                onChange={(e) => handlePersonalizadoEstado(row.id, e.target.value)}
                                className="font-quicksand text-xs px-2.5 py-1.5 rounded-xl border border-gray-200 bg-white font-semibold text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#EE6B8D]"
                              >
                                <option value="pendiente">Pendiente</option>
                                <option value="confirmado">Confirmado</option>
                                <option value="en_produccion">En producción</option>
                                <option value="listo">Listo</option>
                                <option value="entregado">Entregado</option>
                                <option value="cancelado">Cancelado</option>
                              </select>
                            </div>
                          );
                        }

                        if ((key.includes("imagen") || key.includes("image")) && value && typeof value === "string") {
                          return (
                            <div key={key} className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                {key.replace(/_/g, " ")}:
                              </span>
                              <img src={value} alt="" className="w-12 h-12 rounded-xl object-cover border border-pink-100" />
                            </div>
                          );
                        }

                        return (
                          <div key={key} className="flex items-start justify-between gap-2">
                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider shrink-0">
                              {key.replace(/_/g, " ")}:
                            </span>
                            <span className="font-semibold text-gray-800 text-right truncate max-w-[200px]" title={String(value ?? "-")}>
                              {formatValue(key, value)}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {(subTab === "mensajes" || subTab === "personalizados") && (
                      <div className="pt-2 border-t border-gray-100 flex items-center justify-end gap-2">
                        {subTab === "mensajes" && !row.leido && (
                          <button
                            onClick={() => handleMarcarLeido(row.id)}
                            className="flex items-center gap-1 text-xs text-[#EE6B8D] hover:text-[#C04267] font-bold px-3 py-1.5 rounded-xl bg-pink-50 border border-pink-200"
                          >
                            <Eye size={13} /> Marcar Leído
                          </button>
                        )}

                        {subTab === "personalizados" && (
                          <a
                            href={whatsappLink(row)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs text-white bg-[#25D366] hover:bg-[#20BA5A] font-bold px-3.5 py-1.5 rounded-xl shadow-xs"
                          >
                            <ExternalLink size={13} /> Contactar por WhatsApp
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 2. TABLA COMPLETA PARA PANTALLAS GRANDES (hidden lg:block) */}
            <div className="hidden lg:block bg-white rounded-2xl border border-[#FDE8EF] shadow-sm overflow-x-auto">
              <table className="w-full text-left text-sm min-w-full">
                <thead>
                  <tr className="border-b border-[#FDE8EF] bg-gray-50/50">
                    {getColumns(data).map((key) => (
                      <th key={key} className="px-3 py-3 font-quicksand text-xs text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        {key.replace(/_/g, " ")}
                      </th>
                    ))}
                    <th className="px-3 py-3 font-quicksand text-xs text-gray-500 uppercase tracking-wider whitespace-nowrap">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, rowIdx: number) => {
                    const cols = getColumns(data);
                    return (
                      <tr key={row.id} className="border-b border-gray-50 hover:bg-[#FDF4F7]/50 transition-colors">
                        {cols.map((key) => {
                          const value = row[key];

                          if (key === "estado" && subTab === "personalizados") {
                            return (
                              <td key={key} className="px-3 py-3">
                                <select value={String(value || "pendiente")}
                                  onChange={(e) => handlePersonalizadoEstado(row.id, e.target.value)}
                                  className="font-quicksand text-xs px-2 py-1 rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#EE6B8D]"
                                >
                                  <option value="pendiente">Pendiente</option>
                                  <option value="confirmado">Confirmado</option>
                                  <option value="en_produccion">En producción</option>
                                  <option value="listo">Listo</option>
                                  <option value="entregado">Entregado</option>
                                  <option value="cancelado">Cancelado</option>
                                </select>
                              </td>
                            );
                          }

                          if ((key.includes("imagen") || key.includes("image")) && value && typeof value === "string") {
                            return (
                              <td key={key} className="px-3 py-3">
                                <img src={value} alt="" className="w-10 h-10 rounded object-cover border" />
                              </td>
                            );
                          }

                          return (
                            <td key={key} className="px-3 py-3 font-quicksand text-xs text-gray-700 max-w-[200px] truncate" title={String(value ?? "-")}>
                              {formatValue(key, value)}
                            </td>
                          );
                        })}

                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {subTab === "mensajes" && !row.leido && (
                              <button onClick={() => handleMarcarLeido(row.id)}
                                className="flex items-center gap-1 text-xs text-[#EE6B8D] hover:text-[#C04267] font-quicksand font-medium"
                              >
                                <Eye size={14} /> Leído
                              </button>
                            )}

                            {subTab === "personalizados" && (
                              <a href={whatsappLink(row)} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-[#25D366] hover:text-[#20BA5A] font-quicksand font-medium"
                              >
                                <ExternalLink size={14} /> WhatsApp
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Barra de Navegación Inferior Fija para Celulares (APK / PWA / Web Móvil) */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#FDE8EF] px-1 py-1 shadow-lg flex items-center justify-around"
        style={{ paddingBottom: "max(0.35rem, env(safe-area-inset-bottom))" }}
        aria-label="Navegación principal inferior"
      >
        {menuGroups.map((group) => {
          const Icon = group.icon;
          const isActive = mainTab === group.id;
          return (
            <button
              key={group.id}
              type="button"
              onClick={() => cambiarSeccion(group.id)}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-0.5 rounded-xl transition-all cursor-pointer min-w-0 ${
                isActive ? "text-[#C04267]" : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <div
                className={`p-1.5 rounded-xl transition-all ${
                  isActive ? "bg-pink-100/80 text-[#C04267]" : "bg-transparent text-gray-500"
                }`}
              >
                <Icon size={19} strokeWidth={isActive ? 2.5 : 1.75} />
              </div>
              <span
                className={`text-[10px] font-quicksand font-bold tracking-tight truncate max-w-full ${
                  isActive ? "text-[#C04267]" : "text-gray-500"
                }`}
              >
                {group.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Modal para instalar la App de Administración (exclusivo para rol admin) */}
      <AdminInstallAppModal
        isOpen={installModalOpen}
        onClose={() => setInstallModalOpen(false)}
        deferredPrompt={installPrompt}
        onPromptInstall={handlePromptInstall}
        isInstalled={isAppInstalled}
        onSetInstalled={handleSetInstalled}
      />

      <AgendarPersonalizadoModal
        isOpen={personalizadoModalOpen}
        onClose={() => setPersonalizadoModalOpen(false)}
        onSaveSuccess={() => {
          fetchData();
        }}
      />
    </div>
  );
}
