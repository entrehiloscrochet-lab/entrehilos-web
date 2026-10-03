"use client";
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Product } from '@/lib/ventify';
import { useToast } from '@/components/Toast';

// 1. Nueva Interfaz para los Extras (CORREGIDA PARA ACEPTAR NULL)
export interface CartExtra {
  id: string;
  nombre: string;
  precio: number;
  cantidad: number;
  stock: number;
  categoriaOriginal?: string | null; // <--- AQUÍ ESTÁ LA SOLUCIÓN
}

export interface CartItem extends Product {
  quantity: number;
  extras: CartExtra[]; 
}

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, precioOverride?: number, qtyToAdd?: number) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  addExtraToItem: (productId: string, extraProduct: Product, qtyToAdd?: number) => void;
  removeExtraFromItem: (productId: string, extraId: string) => void;
  updateExtraQuantity: (productId: string, extraId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  getWhatsAppMessage: () => string; 
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isClient, setIsClient] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    setIsClient(true);
    const savedCart = localStorage.getItem('entrehilos-cart');
    if (savedCart) {
      try {
        const parsedCart = JSON.parse(savedCart);
        const safeCart = parsedCart.map((item: any) => ({
          ...item,
          extras: item.extras || []
        }));
        setItems(safeCart);
      } catch (error) {
        console.error('Error al cargar carrito:', error);
      }
    }
  }, []);

  useEffect(() => {
    if (isClient) {
      localStorage.setItem('entrehilos-cart', JSON.stringify(items));
    }
  }, [items, isClient]);

  const addToCart = (product: Product, precioOverride?: number, qtyToAdd: number = 1) => {
    const isSoldOut = product.stock === 0;

    setItems((prevItems) => {
      const existingItem = prevItems.find((item) => item.id === product.id);

      if (existingItem) {
        const nextQty = existingItem.quantity + qtyToAdd;
        if (!isSoldOut && nextQty > product.stock) {
          showToast(
            `Atención: ${product.stock} en stock inmediata y ${nextQty - product.stock} se elaborarán a pedido (1-2 sem)`,
            "info"
          );
        }
        return prevItems.map((item) =>
          item.id === product.id ? { ...item, quantity: nextQty } : item
        );
      } else {
        if (!isSoldOut && qtyToAdd > product.stock) {
          showToast(
            `Atención: ${product.stock} en stock inmediata y ${qtyToAdd - product.stock} se elaborarán a pedido (1-2 sem)`,
            "info"
          );
        }
        return [
          ...prevItems,
          {
            ...product,
            precio: precioOverride ?? product.precio,
            quantity: qtyToAdd,
            extras: [],
          },
        ];
      }
    });
  };

  const removeFromCart = (id: string) => {
    setItems((prevItems) => prevItems.filter((item) => item.id !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity < 1) return;

    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id === id) {
          const isSoldOut = item.stock === 0;
          if (!isSoldOut && quantity > item.stock && item.quantity <= item.stock) {
            showToast(
              `Atención: ${item.stock} en stock inmediata y ${quantity - item.stock} se elaborarán a pedido (1-2 sem)`,
              "info"
            );
          }
          return { ...item, quantity };
        }
        return item;
      })
    );
  };

  const addExtraToItem = (productId: string, extraProduct: Product, qtyToAdd: number = 1) => {
    setItems((prevItems) => prevItems.map(item => {
      if (item.id === productId) {
        const existingExtra = item.extras.find(e => e.id === extraProduct.id);
        
        if (existingExtra) {
          const nextQty = existingExtra.cantidad + qtyToAdd;
          const cappedQty = extraProduct.stock > 0 ? Math.min(nextQty, extraProduct.stock) : nextQty;
          if (extraProduct.stock > 0 && nextQty > extraProduct.stock) {
            showToast(`Stock límite: solo quedan ${extraProduct.stock} de ${extraProduct.nombre}`, "warning");
          }
          return {
            ...item,
            extras: item.extras.map(e => e.id === extraProduct.id ? { ...e, cantidad: cappedQty } : e)
          };
        } else {
          if (extraProduct.stock === 0) {
            showToast(`${extraProduct.nombre} está agotado por el momento`, "error");
            return item;
          }
          const cappedQty = extraProduct.stock > 0 ? Math.min(qtyToAdd, extraProduct.stock) : qtyToAdd;
          return {
            ...item,
            extras: [...item.extras, {
              id: extraProduct.id,
              nombre: extraProduct.nombre,
              precio: extraProduct.precio,
              cantidad: cappedQty,
              stock: extraProduct.stock,
              categoriaOriginal: extraProduct.categoriaOriginal
            }]
          };
        }
      }
      return item;
    }));
  };

  const removeExtraFromItem = (productId: string, extraId: string) => {
    setItems((prevItems) => prevItems.map(item => {
      if (item.id === productId) {
        return { ...item, extras: item.extras.filter(e => e.id !== extraId) };
      }
      return item;
    }));
  };

  const updateExtraQuantity = (productId: string, extraId: string, quantity: number) => {
    if (quantity < 1) {
      removeExtraFromItem(productId, extraId);
      return;
    }
    setItems((prevItems) => prevItems.map(item => {
      if (item.id === productId) {
        return {
          ...item,
          extras: item.extras.map(e => {
            if (e.id === extraId) {
              const newQuantity = Math.min(quantity, e.stock);
              if (newQuantity < quantity) {
                showToast(`Solo quedan ${e.stock} de ${e.nombre}`, "warning");
              }
              return { ...e, cantidad: newQuantity };
            }
            return e;
          })
        };
      }
      return item;
    }));
  };

  const clearCart = () => {
    setItems([]);
  };

  const totalItems = items.reduce((sum, item) => {
    const extrasCount = item.extras.reduce((eSum, extra) => eSum + extra.cantidad, 0);
    return sum + item.quantity + extrasCount;
  }, 0);

  const totalPrice = items.reduce((sum, item) => {
    const itemTotal = item.precio * item.quantity;
    const extrasTotal = item.extras.reduce((eSum, extra) => eSum + (extra.precio * extra.cantidad), 0);
    return sum + itemTotal + extrasTotal;
  }, 0);

  const getWhatsAppMessage = () => {
    let message = " *NUEVO PEDIDO - ENTRE HILOS* \n\n";
    
    items.forEach((item, index) => {
      message += `*${index + 1}. ${item.nombre}*\n`;
      message += `   - Cantidad: ${item.quantity}\n`;
      message += `   - Precio: S/ ${(item.precio * item.quantity).toFixed(2)}\n`;
      if (item.stock === 0) {
        message += `   - Disponibilidad: A PEDIDO (1-2 semanas)\n`;
      } else if (item.quantity > item.stock) {
        message += `   - Disponibilidad: ${item.stock} en stock inmediata + ${item.quantity - item.stock} a pedido (1-2 semanas)\n`;
      } else {
        message += `   - Disponibilidad: En stock inmediata\n`;
      }
      
      if (item.extras && item.extras.length > 0) {
        message += `    *Extras agregados a este producto:*\n`;
        item.extras.forEach(extra => {
          message += `      + ${extra.cantidad}x ${extra.nombre} (S/ ${(extra.precio * extra.cantidad).toFixed(2)})\n`;
        });
      }
      message += `\n`;
    });
    
    message += `━━━━━━━━━━━━━━━━━━\n`;
    message += ` *TOTAL A PAGAR: S/ ${totalPrice.toFixed(2)}*\n`;
    message += `━━━━━━━━━━━━━━━━━━\n\n`;
    message += `¡Hola! Me gustaría confirmar este pedido por favor. `;
    
    return message;
  };

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        addExtraToItem,
        removeExtraFromItem,
        updateExtraQuantity,
        clearCart,
        totalItems,
        totalPrice,
        getWhatsAppMessage,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart debe usarse dentro de un CartProvider');
  }
  return context;
}