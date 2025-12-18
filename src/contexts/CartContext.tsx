import React, { createContext, useContext, useState, ReactNode } from 'react';
import { CartItem, Restaurant, OrderType } from '@/types/pizza';

interface DeliveryAddress {
  address: string;
  coordinates: { lat: number; lng: number };
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
  const [items, setItems] = useState<CartItem[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [orderType, setOrderTypeState] = useState<OrderType>('emporter');
  const [pickupTime, setPickupTimeState] = useState<string | null>(null);
  const [deliveryAddress, setDeliveryAddressState] = useState<DeliveryAddress | null>(null);

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
    const baseTotal = item.pizza.basePrice + item.size.price;
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
