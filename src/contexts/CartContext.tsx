import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { CartItem, Restaurant, OrderType } from '@/types/pizza';
import { PIZZA_CATEGORIES } from '@/lib/promo';
import { getPizzaSizePrice } from '@/lib/pricing';
import { usePricing } from '@/contexts/PricingContext';

const STORAGE_KEY = 'declic-cart-state';

function loadPersistedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as {
      items?: CartItem[];
      selectedRestaurant?: Restaurant | null;
      orderType?: OrderType;
      pickupTime?: string | null;
      deliveryAddress?: DeliveryAddress | null;
    };
  } catch {
    return null;
  }
}

export interface DeliveryAddress {
  address: string;
  coordinates: { lat: number; lng: number };
  postalCode?: string | null;
  city?: string | null;
}

interface CartContextType {
  items: CartItem[];
  selectedRestaurant: Restaurant | null;
  orderType: OrderType;
  pickupTime: string | null;
  deliveryAddress: DeliveryAddress | null;
  addItem: (item: CartItem) => void;
  removeItem: (index: number) => void;
  updateQuantity: (index: number, quantity: number) => void;
  clearCart: () => void;
  setRestaurant: (restaurant: Restaurant) => void;
  setOrderType: (type: OrderType) => void;
  setPickupTime: (time: string | null) => void;
  setDeliveryAddress: (address: DeliveryAddress | null) => void;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  usePricing();
  const persisted = loadPersistedState();
  const [items, setItems] = useState<CartItem[]>(persisted?.items ?? []);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(persisted?.selectedRestaurant ?? null);
  const [orderType, setOrderTypeState] = useState<OrderType>(persisted?.orderType ?? 'emporter');
  const [pickupTime, setPickupTimeState] = useState<string | null>(persisted?.pickupTime ?? null);
  const [deliveryAddress, setDeliveryAddressState] = useState<DeliveryAddress | null>(persisted?.deliveryAddress ?? null);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ items, selectedRestaurant, orderType, pickupTime, deliveryAddress })
      );
    } catch {
      // ignore write errors
    }
  }, [items, selectedRestaurant, orderType, pickupTime, deliveryAddress]);

  const addItem = (item: CartItem) => {
    setItems((prev) => [...prev, item]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateQuantity = (index: number, quantity: number) => {
    if (quantity <= 0) {
      removeItem(index);
      return;
    }
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, quantity } : item))
    );
  };

  const clearCart = () => {
    setItems([]);
    setPickupTimeState(null);
    setDeliveryAddressState(null);
  };

  const setRestaurant = (restaurant: Restaurant) => {
    setSelectedRestaurant(restaurant);
  };

  const setOrderType = (type: OrderType) => {
    setOrderTypeState(type);
    // Clear delivery address when switching to takeaway
    if (type === 'emporter') {
      setDeliveryAddressState(null);
    }
    // Clear pickup time when switching to delivery
    if (type === 'livraison') {
      setPickupTimeState(null);
    }
  };

  const setPickupTime = (time: string | null) => {
    setPickupTimeState(time);
  };

  const setDeliveryAddress = (address: DeliveryAddress | null) => {
    setDeliveryAddressState(address);
  };

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  const totalPrice = items.reduce((sum, item) => {
    const isPizza = PIZZA_CATEGORIES.includes(item.pizza.category);
    const baseTotal = isPizza
      ? getPizzaSizePrice(item.size.id, item.pizza.category)
      : item.pizza.basePrice + item.size.price;
    const supplementsTotal = item.supplements.reduce((s, sup) => s + sup.price, 0);
    return sum + (baseTotal + supplementsTotal) * item.quantity;
  }, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        selectedRestaurant,
        orderType,
        pickupTime,
        deliveryAddress,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        setRestaurant,
        setOrderType,
        setPickupTime,
        setDeliveryAddress,
        totalItems,
        totalPrice,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
