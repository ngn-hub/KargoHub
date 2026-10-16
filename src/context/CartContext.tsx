"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { Product, ProductUnit } from "@/types";
import { ResolvedPrice } from "@/lib/services/pricingService";

export interface CartItem {
  product: Product;
  resolvedPrice: ResolvedPrice;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, resolvedPrice: ResolvedPrice, quantity?: number) => { success: boolean; message?: string };
  updateQuantity: (productId: string, quantity: number) => { success: boolean; message?: string };
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  loadOrderIntoCart: (pastItems: { product: Product; resolvedPrice: ResolvedPrice; quantity: number }[]) => void;
  totalCents: number;
  totalItemsCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addToCart = (product: Product, resolvedPrice: ResolvedPrice, quantityToAdd: number = product.moq) => {
    // Validate MOQ on initial addition
    if (quantityToAdd < product.moq) {
      return {
        success: false,
        message: `Minimum order quantity for ${product.name} is ${product.moq} ${product.unit}s.`
      };
    }

    setItems((prev) => {
      const existingIndex = prev.findIndex((i) => i.product.id === product.id);
      if (existingIndex > -1) {
        const updated = [...prev];
        const newQty = updated[existingIndex].quantity + quantityToAdd;
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: newQty,
          resolvedPrice
        };
        return updated;
      } else {
        return [...prev, { product, resolvedPrice, quantity: quantityToAdd }];
      }
    });

    return { success: true };
  };

  const updateQuantity = (productId: string, quantity: number) => {
    const item = items.find((i) => i.product.id === productId);
    if (!item) return { success: false, message: "Item not in cart." };

    if (quantity <= 0) {
      removeFromCart(productId);
      return { success: true };
    }

    // MOQ validation rule
    if (quantity < item.product.moq) {
      return {
        success: false,
        message: `Cannot reduce below Minimum Order Quantity (${item.product.moq} ${item.product.unit}s).`
      };
    }

    setItems((prev) =>
      prev.map((i) => (i.product.id === productId ? { ...i, quantity } : i))
    );

    return { success: true };
  };

  const removeFromCart = (productId: string) => {
    setItems((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const clearCart = () => {
    setItems([]);
  };

  const loadOrderIntoCart = (pastItems: { product: Product; resolvedPrice: ResolvedPrice; quantity: number }[]) => {
    setItems(
      pastItems.map((item) => ({
        product: item.product,
        resolvedPrice: item.resolvedPrice,
        quantity: Math.max(item.product.moq, item.quantity)
      }))
    );
  };

  const totalCents = items.reduce(
    (sum, item) => sum + item.resolvedPrice.unitPriceCents * item.quantity,
    0
  );

  const totalItemsCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        loadOrderIntoCart,
        totalCents,
        totalItemsCount
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
