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

export type UserRole = "OWNER";

export interface Order {
  id: string;
  tableNumber: string;
  orderType: "dine_in" | "delivery";
  deliveryAddress?: string;
  items: CartItem[];
  total: number;
  status: "Received" | "Preparing" | "Ready" | "Completed" | "Cancelled" | "Expired";
  createdAt: string;
  paymentMethod?: string;
  paymentId?: string;
  paymentStatus?: "unpaid" | "pending" | "paid" | "failed" | "refunded";
  sessionId?: string;
  idempotencyKey?: string;
  isQrOrder?: boolean;
}

export interface DiningSession {
  id: string;
  sessionId: string;
  tableId: string;
  tableNumber?: string;
  status: "active" | "closed";
  billStatus?: "open" | "requested" | "paid";
  paymentStatus?: "unpaid" | "pending" | "paid" | "failed";
  startedAt: string;
  startTime?: string;
  closedAt?: string | null;
  total: number;
  orderIds: string[];
  closedBy?: string;
}

export interface DiningTable {
  id: string;
  tableNumber: string;
  status: "available" | "occupied";
  activeSessionId?: string | null;
  updatedAt: string;
}

export interface Reservation {
  id: string;
  date: string;
  time: string;
  table: string;
  guests: number;
  name: string;
  phone: string;
  status: "confirmed" | "cancelled" | "seated" | "checked_in" | "no_show";
  createdAt: string;
  sessionId?: string;
}
