import { CartItem } from './pizza';

export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';

export interface Order {
  id: string;
  user_id: string;
  restaurant: string;
  order_type: 'emporter' | 'livraison';
  items: CartItem[];
  status: OrderStatus;
  total_price: number;
  pickup_time: string | null;
  delivery_address: {
    address: string;
    coordinates: { lat: number; lng: number };
  } | null;
  notes: string | null;
  delivery_estimate: string | null;
  delivery_response: 'accepted' | 'refused' | null;
  created_at: string;
  updated_at: string;
  // Joined data from profiles
  customer_name?: string;
  customer_phone?: string;
}

export const statusLabels: Record<OrderStatus, string> = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  preparing: 'En préparation',
  ready: 'Prête',
  delivered: 'Livrée',
  cancelled: 'Annulée'
};

export const statusColors: Record<OrderStatus, string> = {
  pending: 'bg-yellow-500',
  confirmed: 'bg-blue-500',
  preparing: 'bg-orange-500',
  ready: 'bg-green-500',
  delivered: 'bg-gray-500',
  cancelled: 'bg-red-500'
};
