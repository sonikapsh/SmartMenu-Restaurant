export interface MenuItem {
  name: string;
  price: number;
  desc: string;
  img: string;
  is_vegetarian: boolean;
  popularity_score: number;
}

export interface MenuCategory {
  category: string;
  items: MenuItem[];
}

export interface CartItem {
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  tableNumber: string;
  orderType: "dine_in" | "delivery";
  deliveryAddress?: string;
  items: CartItem[];
  total: number;
  status: "Received" | "Preparing" | "Ready" | "Completed";
  createdAt: string;
  paymentMethod?: string;
  paymentId?: string;
}

export interface Reservation {
  id: string;
  date: string;
  time: string;
  table: string;
  guests: number;
  name: string;
  phone: string;
  status: "confirmed" | "cancelled";
  createdAt: string;
}
