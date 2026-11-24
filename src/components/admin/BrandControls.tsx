"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import {
  Banknote,
  Building2,
  Check,
  ChevronDown,
  Globe,
  HandCoins,
  PhoneCall,
  Store,
} from "lucide-react";

export interface BrandOption {
  id: string;
  label: string;
  subtitle: string;
  badgeClass: string;
}

export const CANALES_ORIGEN_OPTIONS: BrandOption[] = [
  {
    id: "whatsapp",
    label: "WhatsApp",
    subtitle: "Chat directo",
    badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  {
    id: "facebook",
    label: "Facebook",
    subtitle: "Messenger / Post",
    badgeClass: "bg-blue-50 text-blue-800 border-blue-200",
  },
  {
    id: "instagram",
    label: "Instagram",
    subtitle: "DM / Historias",
    badgeClass: "bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200",
  },
  {
    id: "tiktok",
    label: "TikTok",
    subtitle: "Mensajes / Live",
    badgeClass: "bg-slate-100 text-slate-900 border-slate-300",
  },
  {
    id: "telefono",
    label: "Llamada",
    subtitle: "Teléfono directo",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
  },
  {
    id: "presencial",
    label: "Presencial",
    subtitle: "Taller / Feria",
    badgeClass: "bg-rose-50 text-rose-800 border-rose-200",
  },
  {
    id: "tienda",
    label: "Tienda Web",
    subtitle: "Checkout online",
    badgeClass: "bg-pink-50 text-[#C04267] border-pink-200",
  },
  {
    id: "otro",
    label: "Otro",
    subtitle: "Canal alternativo",
    badgeClass: "bg-gray-100 text-gray-700 border-gray-200",
  },
];

export const METODOS_PAGO_OPTIONS: BrandOption[] = [
  {
    id: "yape",
    label: "Yape",
    subtitle: "Billetera BCP",
    badgeClass: "bg-purple-50 text-purple-800 border-purple-200",
  },
  {
    id: "plin",
    label: "Plin",
    subtitle: "Interbank / BBVA / Scotiabank",
    badgeClass: "bg-cyan-50 text-cyan-900 border-cyan-200",
  },
  {
    id: "tarjeta",
    label: "Tarjeta",
    subtitle: "Mastercard / Visa / POS",
    badgeClass: "bg-orange-50 text-orange-900 border-orange-200",
  },
  {
    id: "efectivo",
    label: "Efectivo",
    subtitle: "Pago en soles",
    badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  {
    id: "transferencia",
    label: "Transferencia",
    subtitle: "Cuenta bancaria",
    badgeClass: "bg-sky-50 text-sky-800 border-sky-200",
  },
  {
    id: "contra_entrega",
    label: "Contra Entrega",
    subtitle: "Al recibir el pedido",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
  },
];

export function normalizeChannelId(channel?: string | null): string {
  const clean = (channel || "tienda").toLowerCase().trim();
  if (clean === "web") return "tienda";
  if (clean === "llamada") return "telefono";
  return CANALES_ORIGEN_OPTIONS.some((c) => c.id === clean) ? clean : "otro";
}

export function normalizePaymentId(method?: string | null): string {
  const clean = (method || "yape").toLowerCase().trim().replace(/\s+/g, "_");
  if (clean === "contraentrega") return "contra_entrega";
  return METODOS_PAGO_OPTIONS.some((m) => m.id === clean) ? clean : clean || "yape";
}

function FacebookSvg({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <circle cx="12" cy="12" r="11" fill="#1877F2" />
      <path
        d="M15.12 13.5l.47-3.07h-2.94V8.44c0-.84.41-1.66 1.73-1.66h1.34V4.16S14.5 3.95 13.34 3.95c-2.43 0-4.01 1.47-4.01 4.13v2.35H6.63v3.07h2.7v7.43a10.7 10.7 0 003.32 0V13.5h2.47z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

function InstagramSvg({ size }: { size: number }) {
  const gradId = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <defs>
        <radialGradient id={gradId} cx="30%" cy="107%" r="150%">
          <stop offset="0%" stopColor="#FDF497" />
          <stop offset="10%" stopColor="#FDF497" />
          <stop offset="45%" stopColor="#FD5949" />
          <stop offset="65%" stopColor="#D6249F" />
          <stop offset="95%" stopColor="#285AEB" />
        </radialGradient>
      </defs>
      <rect x="1.5" y="1.5" width="21" height="21" rx="6" fill={`url(#${gradId})`} />
      <rect x="5.2" y="5.2" width="13.6" height="13.6" rx="4" fill="none" stroke="#FFFFFF" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3.3" fill="none" stroke="#FFFFFF" strokeWidth="1.8" />
      <circle cx="16.1" cy="7.9" r="1.05" fill="#FFFFFF" />
    </svg>
  );
}

function TikTokSvg({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <rect x="1.5" y="1.5" width="21" height="21" rx="6" fill="#0F0F12" />
      <path
        d="M15.7 9.6a4.4 4.4 0 01-2.55-.81v3.78a3.65 3.65 0 11-3.15-3.61v1.87a1.83 1.83 0 101.29 1.74V5.6h1.86a2.62 2.62 0 002.55 2.22V9.6z"
        fill="#25F4EE"
        transform="translate(-0.45 -0.35)"
      />
      <path
        d="M15.7 9.6a4.4 4.4 0 01-2.55-.81v3.78a3.65 3.65 0 11-3.15-3.61v1.87a1.83 1.83 0 101.29 1.74V5.6h1.86a2.62 2.62 0 002.55 2.22V9.6z"
        fill="#FE2C55"
        transform="translate(0.45 0.35)"
      />
      <path
        d="M15.7 9.6a4.4 4.4 0 01-2.55-.81v3.78a3.65 3.65 0 11-3.15-3.61v1.87a1.83 1.83 0 101.29 1.74V5.6h1.86a2.62 2.62 0 002.55 2.22V9.6z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

export function WhatsAppLogo({ size = 16 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/Wspicono.png"
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className="rounded-full object-contain shrink-0"
    />
  );
}

export function ChannelLogo({ channel, size = 18 }: { channel?: string | null; size?: number }) {
  const id = normalizeChannelId(channel);

  if (id === "whatsapp") return <WhatsAppLogo size={size} />;
  if (id === "facebook") return <FacebookSvg size={size} />;
  if (id === "instagram") return <InstagramSvg size={size} />;
  if (id === "tiktok") return <TikTokSvg size={size} />;

  if (id === "tienda") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/logo.png"
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="rounded-full object-cover border border-pink-200 bg-white shrink-0"
      />
    );
  }

  const iconSize = Math.max(10, Math.round(size * 0.62));
  if (id === "telefono") {
    return (
      <span
        style={{ width: size, height: size }}
        className="rounded-md bg-amber-100 text-amber-700 inline-flex items-center justify-center shrink-0"
      >
        <PhoneCall size={iconSize} />
      </span>
    );
  }
  if (id === "presencial") {
    return (
      <span
        style={{ width: size, height: size }}
        className="rounded-md bg-rose-100 text-rose-700 inline-flex items-center justify-center shrink-0"
      >
        <Store size={iconSize} />
      </span>
    );
  }

  return (
    <span
      style={{ width: size, height: size }}
      className="rounded-md bg-gray-100 text-gray-600 inline-flex items-center justify-center shrink-0"
    >
      <Globe size={iconSize} />
    </span>
  );
}

export function PaymentLogo({ method, size = 18 }: { method?: string | null; size?: number }) {
  const id = normalizePaymentId(method);

  if (id === "yape") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/yape.jpeg"
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="rounded-md object-cover shrink-0 border border-purple-200/70"
      />
    );
  }

  if (id === "plin") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/plin.png"
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="rounded-md object-contain bg-white shrink-0 border border-cyan-200/70"
      />
    );
  }

  if (id === "tarjeta") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/mastercard.webp"
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="rounded-md object-contain bg-white shrink-0 border border-gray-200 px-0.5"
      />
    );
  }

  const iconSize = Math.max(10, Math.round(size * 0.62));
  if (id === "efectivo") {
    return (
      <span
        style={{ width: size, height: size }}
        className="rounded-md bg-emerald-100 text-emerald-700 inline-flex items-center justify-center shrink-0"
      >
        <Banknote size={iconSize} />
      </span>
    );
  }

  if (id === "transferencia") {
    return (
      <span
        style={{ width: size, height: size }}
        className="rounded-md bg-sky-100 text-sky-700 inline-flex items-center justify-center shrink-0"
      >
        <Building2 size={iconSize} />
      </span>
    );
  }

  return (
    <span
      style={{ width: size, height: size }}
      className="rounded-md bg-amber-100 text-amber-700 inline-flex items-center justify-center shrink-0"
    >
      <HandCoins size={iconSize} />
    </span>
  );
}

export function ChannelBadge({
  channel,
  size = "sm",
}: {
  channel?: string | null;
  size?: "xs" | "sm";
}) {
  const id = normalizeChannelId(channel);
  const opt = CANALES_ORIGEN_OPTIONS.find((c) => c.id === id) || CANALES_ORIGEN_OPTIONS[CANALES_ORIGEN_OPTIONS.length - 1];
  const logoSize = size === "xs" ? 13 : 15;
  const pad = size === "xs" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-[11px]";

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-quicksand font-bold rounded-full border whitespace-nowrap ${pad} ${opt.badgeClass}`}
    >
      <ChannelLogo channel={id} size={logoSize} />
      <span>{opt.label}</span>
    </span>
  );
}

export function PaymentBadge({
  method,
  size = "sm",
}: {
  method?: string | null;
  size?: "xs" | "sm";
}) {
  const id = normalizePaymentId(method);
  const opt = METODOS_PAGO_OPTIONS.find((m) => m.id === id);
  const label = opt?.label || (method ? method.replace(/_/g, " ") : "Yape");
  const badgeClass = opt?.badgeClass || "bg-gray-100 text-gray-700 border-gray-200";
  const logoSize = size === "xs" ? 14 : 16;
  const pad = size === "xs" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-quicksand font-semibold rounded-full border capitalize whitespace-nowrap ${pad} ${badgeClass}`}
    >
      <PaymentLogo method={id} size={logoSize} />
      <span>{label}</span>
    </span>
  );
}

function BrandSelect({
  label,
  value,
  options,
  onChange,
  renderLogo,
  placement = "bottom",
}: {
  label?: string;
  value: string;
  options: BrandOption[];
  onChange: (value: string) => void;
  renderLogo: (id: string, size: number) => React.ReactNode;
  placement?: "bottom" | "top";
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const buttonId = useId();

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const current = options.find((o) => o.id === value) || options[0];

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label
          htmlFor={buttonId}
          className="block font-quicksand text-[11px] font-bold text-gray-600 mb-1"
        >
          {label}
        </label>
      )}

      <button
        id={buttonId}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border bg-white text-left font-quicksand transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EE6B8D]/50 ${
          open
            ? "border-[#EE6B8D] ring-3 ring-[#EE6B8D]/15"
            : "border-gray-200 hover:border-[#EE6B8D]/60"
        }`}
      >
        <span className="flex items-center gap-2.5 min-w-0">
          {renderLogo(current.id, 20)}
          <span className="min-w-0">
            <span className="block text-xs font-bold text-gray-900 truncate">{current.label}</span>
          </span>
        </span>
        <span className="flex items-center gap-1.5 shrink-0">
          <span className="hidden sm:inline text-[10px] font-medium text-gray-400">
            {current.subtitle}
          </span>
          <ChevronDown
            size={15}
            className={`text-gray-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          className={`absolute left-0 right-0 z-50 bg-white rounded-xl border border-[#F2DCE4] shadow-xl py-1 max-h-60 overflow-y-auto ${
            placement === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5"
          }`}
        >
          {options.map((opt) => {
            const isSelected = opt.id === current.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(opt.id);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 text-left transition-colors cursor-pointer ${
                  isSelected ? "bg-[#FDF2F5]" : "hover:bg-gray-50"
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  {renderLogo(opt.id, 20)}
                  <span className="min-w-0">
                    <span
                      className={`block font-quicksand text-xs font-bold truncate ${
                        isSelected ? "text-[#C04267]" : "text-gray-800"
                      }`}
                    >
                      {opt.label}
                    </span>
                    <span className="block font-quicksand text-[10px] text-gray-400 truncate">
                      {opt.subtitle}
                    </span>
                  </span>
                </span>
                {isSelected && <Check size={14} className="text-[#C04267] shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ChannelSelect({
  label,
  value,
  onChange,
  placement = "bottom",
  allowTienda = true,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placement?: "bottom" | "top";
  allowTienda?: boolean;
}) {
  const options = allowTienda
    ? CANALES_ORIGEN_OPTIONS
    : CANALES_ORIGEN_OPTIONS.filter((c) => c.id !== "tienda");
  const normalized = normalizeChannelId(value);

  return (
    <BrandSelect
      label={label}
      value={normalized}
      options={options}
      onChange={onChange}
      placement={placement}
      renderLogo={(id, size) => <ChannelLogo channel={id} size={size} />}
    />
  );
}

export function PaymentMethodSelect({
  label,
  value,
  onChange,
  placement = "bottom",
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placement?: "bottom" | "top";
}) {
  const normalized = normalizePaymentId(value);

  return (
    <BrandSelect
      label={label}
      value={normalized}
      options={METODOS_PAGO_OPTIONS}
      onChange={onChange}
      placement={placement}
      renderLogo={(id, size) => <PaymentLogo method={id} size={size} />}
    />
  );
}
