import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ShoppingCart,
  UserCheck,
  Utensils,
  Truck,
  Star,
  Phone,
  Mail,
  MapPin,
  Search,
  ArrowLeft,
  Trash2,
  Edit2,
  X,
  Plus,
  Minus,
  QrCode,
  CheckCircle,
  Clock,
  Users,
  Calendar,
  AlertCircle,
  TrendingUp,
  Printer,
  Receipt,
  Menu,
  Crown,
  Coffee
} from "lucide-react";
import { menuData } from "./menuData";
import { MenuItem, CartItem, Order, Reservation } from "./types";
import { DelishLogo } from "./components/DelishLogo";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  where
} from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

// Initialize Firebase Client SDK
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

const OWNER_PASSWORD = "admin123";
const TOTAL_TABLES = 10;

// Multi-user session isolation helper:
// Generates or retrieves a unique session identifier per customer tab/device.
// Does NOT conflate table identity with customer identity.
const getCustomerSessionId = (): string => {
  if (typeof window === "undefined") return "guest";
  try {
    const params = new URLSearchParams(window.location.search);
    const urlSession = params.get("session");
    if (urlSession && urlSession.trim().length >= 3) {
      const cleanSession = urlSession.trim();
      sessionStorage.setItem("delish_customer_sid", cleanSession);
      return cleanSession;
    }
    let sid = sessionStorage.getItem("delish_customer_sid");
    if (!sid) {
      sid = "cust_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 9);
      sessionStorage.setItem("delish_customer_sid", sid);
    }
    return sid;
  } catch {
    return "cust_default";
  }
};
const TIME_SLOTS = [
  "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM",
  "01:00 PM", "01:30 PM", "02:00 PM", "02:30 PM",
  "03:00 PM", "03:30 PM", "05:00 PM", "05:30 PM",
  "06:00 PM", "06:30 PM", "07:00 PM", "07:30 PM",
  "08:00 PM", "08:30 PM", "09:00 PM", "09:30 PM",
  "10:00 PM"
];

const HERO_IMAGES = [
  "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=1600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=1600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=1600&auto=format&fit=crop&q=80"
];

export default function App() {
  // Navigation & View states
  const [isAdminMode, setIsAdminMode] = useState<boolean>(false);
  const [showAdminLogin, setShowAdminLogin] = useState<boolean>(false);
  const [adminEmail, setAdminEmail] = useState<string>("");
  const [adminPassword, setAdminPassword] = useState<string>("");
  const [adminLoginError, setAdminLoginError] = useState<string>("");
  const [activeCategory, setActiveCategory] = useState<string>("Coffee");

  // Hero slideshow state
  const [heroIndex, setHeroIndex] = useState<number>(0);

  // Cart & Ordering States
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [orderType, setOrderType] = useState<"dine_in" | "delivery">("dine_in");
  const [tableNumber, setTableNumber] = useState<string>("");
  const [deliveryAddress, setDeliveryAddress] = useState<string>("");
  const [activeTableLabel, setActiveTableLabel] = useState<string>("");
  const [isUrlTable, setIsUrlTable] = useState<boolean>(false);
  const [tableInputError, setTableInputError] = useState<string>("");

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortType, setSortType] = useState<"none" | "price_asc" | "price_desc" | "popularity">("none");
  const [vegFilter, setVegFilter] = useState<"all" | "veg" | "nonveg">("all");

  // Active tracking
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);

  // Modal flow
  const [showSummaryModal, setShowSummaryModal] = useState<boolean>(false);
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("pay_at_counter");

  // Reservation Form State
  const [resDate, setResDate] = useState<string>("");
  const [resTime, setResTime] = useState<string>("");
  const [resTable, setResTable] = useState<string>("");
  const [resGuests, setResGuests] = useState<number>(2);
  const [resName, setResName] = useState<string>("");
  const [resPhone, setResPhone] = useState<string>("");
  const [editReservationId, setEditReservationId] = useState<string | null>(null);
  const [isReservationModalOpen, setIsReservationModalOpen] = useState<boolean>(false);
  const [activeReservationTab, setActiveReservationTab] = useState<"book" | "manage">("book");

  // Lists loaded from Backend
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [allReservations, setAllReservations] = useState<Reservation[]>([]);
  const [toastMessage, setToastMessage] = useState<string>("");
  const [selectedBillOrder, setSelectedBillOrder] = useState<Order | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [customerSessionId, setCustomerSessionId] = useState<string>(() => getCustomerSessionId());
  const [userOrderIds, setUserOrderIds] = useState<string[]>([]);
  const [userReservationIds, setUserReservationIds] = useState<string[]>([]);
  const [isYourOrdersOpen, setIsYourOrdersOpen] = useState<boolean>(false);

  // Refs for smooth scrolling
  const menuRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const aboutRef = useRef<HTMLDivElement>(null);
  const reviewsRef = useRef<HTMLDivElement>(null);
  const contactRef = useRef<HTMLDivElement>(null);

  // Auto-scroll slideshow
  useEffect(() => {
    const timer = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % HERO_IMAGES.length);
    }, 5500);
    return () => clearInterval(timer);
  }, []);

  // Sync cart to isolated session storage whenever it updates
  useEffect(() => {
    if (!customerSessionId) return;
    try {
      localStorage.setItem(`delish_cart_${customerSessionId}`, JSON.stringify(cart));
    } catch (e) {
      console.error("Cart storage save error:", e);
    }
  }, [cart, customerSessionId]);

  // Sync state on mount: multi-user session isolation + table QR check
  useEffect(() => {
    const sid = getCustomerSessionId();
    setCustomerSessionId(sid);

    // Restore isolated cart for this customer session
    try {
      const savedCart = localStorage.getItem(`delish_cart_${sid}`);
      if (savedCart) {
        const parsed = JSON.parse(savedCart);
        if (Array.isArray(parsed)) {
          setCart(parsed);
        }
      }
    } catch (e) {
      console.error("Error restoring session cart:", e);
    }

    // Restore isolated order IDs for this customer session
    try {
      const savedOrders = localStorage.getItem(`delish_orders_${sid}`);
      if (savedOrders) {
        setUserOrderIds(JSON.parse(savedOrders));
      }
    } catch (e) {
      console.error("Error parsing user orders for session:", e);
    }

    // Restore isolated reservations for this customer session
    try {
      const savedRes = localStorage.getItem(`delish_res_${sid}`);
      if (savedRes) {
        setUserReservationIds(JSON.parse(savedRes));
      }
    } catch (e) {
      console.error("Error parsing user reservations for session:", e);
    }

    // Check URL table param (Strictly 1 to TOTAL_TABLES)
    const params = new URLSearchParams(window.location.search);
    const tableParam = params.get("table");
    if (tableParam) {
      const parsedNum = parseInt(tableParam.replace(/[^0-9]/g, ""), 10);
      if (!isNaN(parsedNum) && parsedNum >= 1 && parsedNum <= TOTAL_TABLES) {
        const tStr = String(parsedNum);
        setTableNumber(tStr);
        setActiveTableLabel(tStr);
        setIsUrlTable(true);
        setOrderType("dine_in");
        localStorage.setItem(`delish_table_${sid}`, tStr);

        // Directly open/scroll to MENU smoothly, bypassing any preference screen
        setTimeout(() => {
          if (menuRef.current) {
            menuRef.current.scrollIntoView({ behavior: "smooth" });
          }
        }, 250);
      } else {
        localStorage.removeItem(`delish_table_${sid}`);
        setTableNumber("");
        setActiveTableLabel("");
        showToast(`Invalid table in link. Delish Cafe has Tables 1 to ${TOTAL_TABLES} only.`);
      }
    } else {
      // Check if this customer session has a previously selected table
      const saved = localStorage.getItem(`delish_table_${sid}`);
      if (saved) {
        const parsedSaved = parseInt(saved, 10);
        if (!isNaN(parsedSaved) && parsedSaved >= 1 && parsedSaved <= TOTAL_TABLES) {
          setTableNumber(String(parsedSaved));
          setActiveTableLabel(String(parsedSaved));
          setOrderType("dine_in");
        } else {
          localStorage.removeItem(`delish_table_${sid}`);
          setTableNumber("");
          setActiveTableLabel("");
        }
      }
    }
  }, []);

  // Real-time Firestore sync with strict multi-user session isolation
  useEffect(() => {
    let unsubscribeOrders: () => void = () => {};
    let unsubscribeReservations: () => void = () => {};

    if (isAdminMode) {
      // In Admin Mode: Staff/Kitchen needs to see all cafe orders & reservations
      const qOrders = collection(db, "orders");
      unsubscribeOrders = onSnapshot(
        qOrders,
        (snapshot) => {
          const orders: Order[] = [];
          snapshot.forEach((docSnap) => {
            orders.push({ id: docSnap.id, ...docSnap.data() } as Order);
          });
          orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setAllOrders(orders);
        },
        (error) => {
          console.error("Firestore admin orders sync error:", error);
        }
      );

      const qReservations = collection(db, "reservations");
      unsubscribeReservations = onSnapshot(
        qReservations,
        (snapshot) => {
          const reservations: Reservation[] = [];
          snapshot.forEach((docSnap) => {
            reservations.push({ id: docSnap.id, ...docSnap.data() } as Reservation);
          });
          reservations.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setAllReservations(reservations);
        },
        (error) => {
          console.error("Firestore admin reservations sync error:", error);
        }
      );
    } else {
      // In Customer Mode: Strict multi-user session isolation.
      // Customer ONLY listens to orders matching their unique session identifier.
      if (customerSessionId) {
        const qOrders = query(collection(db, "orders"), where("sessionId", "==", customerSessionId));
        unsubscribeOrders = onSnapshot(
          qOrders,
          (snapshot) => {
            const orders: Order[] = [];
            snapshot.forEach((docSnap) => {
              orders.push({ id: docSnap.id, ...docSnap.data() } as Order);
            });
            orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setAllOrders(orders);
          },
          (error) => {
            console.error("Firestore customer orders sync error:", error);
          }
        );

        const qReservations = collection(db, "reservations");
        unsubscribeReservations = onSnapshot(
          qReservations,
          (snapshot) => {
            const reservations: Reservation[] = [];
            snapshot.forEach((docSnap) => {
              reservations.push({ id: docSnap.id, ...docSnap.data() } as Reservation);
            });
            reservations.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setAllReservations(reservations);
          },
          (error) => {
            console.error("Firestore reservations sync error:", error);
          }
        );
      }
    }

    return () => {
      unsubscribeOrders();
      unsubscribeReservations();
    };
  }, [isAdminMode, customerSessionId]);

  // Update order status if tracked order gets updated in list
  useEffect(() => {
    if (currentOrder && allOrders.length > 0) {
      const match = allOrders.find((o) => o.id === currentOrder.id);
      if (match) {
        setCurrentOrder(match);
      }
    }
  }, [allOrders, currentOrder]);

  // Restore the customer's own active (non-Completed) order on page refresh/mount
  useEffect(() => {
    if (allOrders.length > 0 && !currentOrder && !isAdminMode) {
      const activeOrder = allOrders.find((o) => o.status !== "Completed");
      if (activeOrder) {
        setCurrentOrder(activeOrder);
      }
    }
  }, [allOrders, currentOrder, isAdminMode]);

  const fetchOrdersAndReservations = async () => {
    // Handled dynamically and immediately in real-time by onSnapshot!
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage("");
    }, 2500);
  };

  // Cart operations (Direct item addition)
  const handleAddToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.name === item.name);
      if (existing) {
        return prev.map((c) =>
          c.name === item.name ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { name: item.name, price: item.price, quantity: 1 }];
    });
    showToast(`Added ${item.name} to Tray!`);
  };

  const updateCartQty = (name: string, diff: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.name === name) {
            const nextQty = item.quantity + diff;
            return { ...item, quantity: nextQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0);
    });
  };

  const removeFromCart = (name: string) => {
    setCart((prev) => prev.filter((item) => item.name !== name));
    showToast("Removed from cart.");
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Set table number with strict validation (Tables 1 to 10 only) and session persistence
  const handleSetTable = (targetTable?: string) => {
    const raw = typeof targetTable === "string" ? targetTable : tableNumber;
    const trimmed = raw.trim();
    if (!trimmed) {
      setTableInputError(`Please select or enter a table (1 to ${TOTAL_TABLES}).`);
      showToast(`Please enter a table number (1 to ${TOTAL_TABLES}).`);
      return;
    }
    const num = parseInt(trimmed, 10);
    if (isNaN(num) || num < 1 || num > TOTAL_TABLES || String(num) !== trimmed.replace(/^0+/, "")) {
      setTableInputError(`Delish Cafe has Tables 1 to ${TOTAL_TABLES} only. Table "${trimmed}" does not exist.`);
      showToast(`Invalid table! Delish Cafe has Tables 1 to ${TOTAL_TABLES} only.`);
      return;
    }
    setTableInputError("");
    setTableNumber(String(num));
    setActiveTableLabel(String(num));
    setOrderType("dine_in");
    localStorage.setItem(`delish_table_${customerSessionId}`, String(num));
    showToast(`Table ${num} selected!`);
  };

  const handleClearTable = () => {
    setTableNumber("");
    setActiveTableLabel("");
    setTableInputError("");
    setIsUrlTable(false);
    localStorage.removeItem(`delish_table_${customerSessionId}`);
    showToast("Table disconnected.");
  };

  // Filter and Sort implementation
  const getFilteredItems = () => {
    const categoryMatch = menuData.find((c) => c.category === activeCategory);
    let items = categoryMatch ? [...categoryMatch.items] : [];

    // Search term check
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      // Search across ALL categories if searching, to be highly friendly!
      const allMatched: MenuItem[] = [];
      menuData.forEach((cat) => {
        cat.items.forEach((item) => {
          if (
            item.name.toLowerCase().includes(term) ||
            item.desc.toLowerCase().includes(term) ||
            cat.category.toLowerCase().includes(term)
          ) {
            allMatched.push(item);
          }
        });
      });
      items = allMatched;
    }

    // Vegetarian filter
    if (vegFilter === "veg") {
      items = items.filter((i) => i.is_vegetarian);
    } else if (vegFilter === "nonveg") {
      items = items.filter((i) => !i.is_vegetarian);
    }

    // Sorting
    if (sortType === "price_asc") {
      items.sort((a, b) => a.price - b.price);
    } else if (sortType === "price_desc") {
      items.sort((a, b) => b.price - a.price);
    } else if (sortType === "popularity") {
      items.sort((a, b) => b.popularity_score - a.popularity_score);
    }

    return items;
  };

  // Placing the order flow
  const handlePlaceOrderClick = () => {
    if (cart.length === 0) {
      showToast("Your cart is empty!");
      return;
    }
    if (orderType === "dine_in") {
      const num = parseInt(activeTableLabel, 10);
      if (!activeTableLabel || isNaN(num) || num < 1 || num > TOTAL_TABLES) {
        showToast(`Please select a valid table (Tables 1 to ${TOTAL_TABLES}) first!`);
        return;
      }
    }
    if (orderType === "delivery" && !deliveryAddress.trim()) {
      showToast("Delivery address is required!");
      return;
    }
    setIsCartOpen(false);
    setShowSummaryModal(true);
  };

  const proceedToPayment = () => {
    setShowSummaryModal(false);
    setShowPaymentModal(true);
  };

  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const submitOrderToBackend = async (payMethod: string, payId: string) => {
    const orderId = "ORD-" + Math.random().toString(36).substring(2, 9).toUpperCase();
    const newOrder: Order = {
      id: orderId,
      tableNumber: orderType === "dine_in" ? activeTableLabel : "Delivery",
      orderType,
      deliveryAddress: orderType === "delivery" ? deliveryAddress : "",
      items: cart,
      total: cartTotal,
      status: "Received" as const,
      createdAt: new Date().toLocaleString("en-US", { hour12: true }),
      paymentMethod: payMethod,
      paymentId: payId,
      sessionId: customerSessionId
    };

    try {
      await setDoc(doc(db, "orders", orderId), newOrder);
      setCurrentOrder(newOrder);
      setUserOrderIds((prev) => {
        const updated = [...prev, orderId];
        localStorage.setItem(`delish_orders_${customerSessionId}`, JSON.stringify(updated));
        return updated;
      });
      setCart([]);
      localStorage.removeItem(`delish_cart_${customerSessionId}`);
      setShowPaymentModal(false);
      showToast("Order placed successfully!");
      
      // Scroll to active tracking
      setTimeout(() => {
        if (menuRef.current) {
          menuRef.current.scrollIntoView({ behavior: "smooth" });
        }
      }, 400);
    } catch (e: any) {
      console.error("Firestore order write failed:", e);
      showToast("Error placing order: " + e.message);
    }
  };

  const handleConfirmOrder = async () => {
    if (selectedPaymentMethod === "pay_at_counter") {
      await submitOrderToBackend("Cash at Counter", "COUNTER_CASH");
      return;
    }

    showToast("Starting Razorpay Payment...");
    const isLoaded = await loadRazorpayScript();
    if (!isLoaded) {
      showToast("Could not load Razorpay client SDK. Please try again.");
      return;
    }

    try {
      const response = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: cartTotal })
      });

      if (!response.ok) {
        showToast("Backend order creation failed.");
        return;
      }

      const orderData = await response.json();
      if (!orderData.success) {
        showToast("Payment error: " + orderData.error);
        return;
      }

      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: "INR",
        name: "Delish Cafe",
        description: `Delish Cafe Order - ${orderType === "dine_in" ? "Table " + activeTableLabel : "Doorstep Delivery"}`,
        order_id: orderData.simulated ? undefined : orderData.order_id,
        handler: async function (paymentResponse: any) {
          const payId = paymentResponse.razorpay_payment_id || "PAY_SIM_" + Math.random().toString(36).substring(2, 9).toUpperCase();
          showToast("Payment Authorized successfully!");
          await submitOrderToBackend(`Razorpay (${selectedPaymentMethod.toUpperCase()})`, payId);
        },
        prefill: {
          name: "Delish Diner",
          email: "guest@delishcafe.com",
          contact: "9876543210"
        },
        theme: {
          color: "#3E4B2F" // Delish deep olive
        }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", function (resp: any) {
        showToast("Payment unsuccessful: " + resp.error.description);
      });
      rzp.open();
    } catch (err: any) {
      showToast("Payment initialization failed.");
      console.error(err);
    }
  };

  // Reservation Flow
  const getUnavailableTables = () => {
    if (!resDate || !resTime) return [];
    return allReservations
      .filter(
        (r) =>
          r.status === "confirmed" &&
          r.date === resDate &&
          r.time === resTime &&
          r.id !== editReservationId
      )
      .map((r) => r.table);
  };

  const handleBookTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resDate || !resTime || !resTable || !resName || !resPhone) {
      showToast("Please fill in all booking fields.");
      return;
    }

    // Check for existing confirmed reservation on same table/date/time
    const exists = allReservations.some(
      (r) =>
        r.status === "confirmed" &&
        r.table === String(resTable) &&
        r.date === resDate &&
        r.time === resTime &&
        r.id !== editReservationId
    );

    if (exists) {
      showToast("Table already reserved for this date and time slot.");
      return;
    }

    const resId = editReservationId || "RES-" + Math.random().toString(36).substring(2, 9).toUpperCase();
    const savedReservation: Reservation = {
      id: resId,
      date: resDate,
      time: resTime,
      table: String(resTable),
      guests: Number(resGuests),
      name: resName,
      phone: resPhone,
      status: "confirmed" as const,
      createdAt: new Date().toLocaleString("en-US", { hour12: true }),
      sessionId: customerSessionId
    };

    try {
      await setDoc(doc(db, "reservations", resId), savedReservation);
      showToast(editReservationId ? "Reservation Updated!" : "Table Booked Successfully!");
      if (!editReservationId) {
        setUserReservationIds((prev) => {
          const updated = [...prev, resId];
          localStorage.setItem(`delish_res_${customerSessionId}`, JSON.stringify(updated));
          return updated;
        });
      }
      // Reset Form
      setResDate("");
      setResTime("");
      setResTable("");
      setResGuests(2);
      setResName("");
      setResPhone("");
      setEditReservationId(null);
      setIsReservationModalOpen(false);
    } catch (err: any) {
      console.error("Firestore booking failed:", err);
      showToast("Failed to book reservation: " + err.message);
    }
  };

  const handleEditReservation = (resv: Reservation) => {
    setEditReservationId(resv.id);
    setResDate(resv.date);
    setResTime(resv.time);
    setResTable(resv.table);
    setResGuests(resv.guests);
    setResName(resv.name);
    setResPhone(resv.phone);
    setActiveReservationTab("book");
    setIsReservationModalOpen(true);
    if (bookRef.current) {
      bookRef.current.scrollIntoView({ behavior: "smooth" });
    }
    showToast("Loaded booking details for editing.");
  };

  const handleCancelReservation = async (id: string) => {
    if (!window.confirm("Are you sure you want to cancel this reservation?")) return;
    try {
      await updateDoc(doc(db, "reservations", id), { status: "cancelled" });
      showToast("Reservation Cancelled.");
    } catch (e: any) {
      console.error("Firestore cancel reservation failed:", e);
      showToast("Error cancelling reservation.");
    }
  };

  // Owner Admin login
  const handleAdminLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: adminEmail, password: adminPassword })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setIsAdminMode(true);
        setShowAdminLogin(false);
        setAdminEmail("");
        setAdminPassword("");
        setAdminLoginError("");
        showToast("Logged in as Owner.");
      } else {
        setAdminLoginError(data.error || "Invalid Email or Password.");
      }
    } catch (err) {
      // Fallback for preview safety if backend is starting up
      if (adminPassword === OWNER_PASSWORD) {
        setIsAdminMode(true);
        setShowAdminLogin(false);
        setAdminEmail("");
        setAdminPassword("");
        setAdminLoginError("");
        showToast("Logged in as Owner (Offline).");
      } else {
        setAdminLoginError("Unable to reach backend servers.");
      }
    }
  };

  // Owner admin actions
  const advanceOrderStatus = async (orderId: string, currentStatus: string) => {
    const statusFlow = ["Received", "Preparing", "Ready", "Completed"];
    const currIdx = statusFlow.indexOf(currentStatus);
    if (currIdx === -1 || currIdx === statusFlow.length - 1) return;
    const nextStatus = statusFlow[currIdx + 1];

    try {
      await updateDoc(doc(db, "orders", orderId), { status: nextStatus });
      showToast(`Order updated to ${nextStatus}`);
    } catch (e: any) {
      console.error("Firestore advance status failed:", e);
      showToast("Error updating order.");
    }
  };

  const handlePrintBill = () => {
    document.body.classList.add("printing-bill");
    window.print();
    setTimeout(() => {
      document.body.classList.remove("printing-bill");
    }, 1000);
  };

  const handleScrollTo = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (isAdminMode) {
      setIsAdminMode(false);
    }
    setIsMobileMenuOpen(false);
    setTimeout(() => {
      if (ref.current) {
        const headerOffset = 90;
        const elementPosition = ref.current.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
        window.scrollTo({
          top: Math.max(0, offsetPosition),
          behavior: "smooth"
        });
      }
    }, 100);
  };

  const handleGoHome = () => {
    if (isAdminMode) {
      setIsAdminMode(false);
    }
    setIsMobileMenuOpen(false);
    setTimeout(() => {
      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    }, 100);
  };

  const activeReservationsCount = allReservations.filter((r) => r.status === "confirmed").length;
  const pendingOrdersCount = allOrders.filter((o) => o.status !== "Completed").length;

  return (
    <div className="min-h-screen bg-[#FAF8F3] text-[#26301C] font-sans selection:bg-[#3E4B2F] selection:text-white overflow-x-hidden">
      {/* Toast alert system */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 bg-[#26301C] text-[#FAF8F3] px-6 py-3 rounded-full shadow-2xl z-50 flex items-center gap-3 border border-[#C9A84E]/40 max-w-sm"
          >
            <span className="w-2 h-2 rounded-full bg-[#C9A84E] animate-ping"></span>
            <span className="font-bold text-xs uppercase tracking-widest">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= HEADER NAVBAR ================= */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-[#FAF8F3]/95 backdrop-blur-md border-b border-[#C9A84E]/20 shadow-sm transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={handleGoHome}>
            <DelishLogo className="w-12 h-12 shrink-0 group-hover:scale-105 transition-transform shadow-md" />
            <div className="flex flex-col">
              <span className="text-2xl sm:text-3xl font-serif font-black tracking-tight uppercase text-[#3E4B2F] leading-none group-hover:text-[#26301C] transition-colors">
                DELISH
              </span>
              <span className="text-[9px] font-bold tracking-widest uppercase text-[#C9A84E] mt-0.5">
                CAFE &bull; AHMEDABAD
              </span>
            </div>
          </div>

          {/* Nav links (hidden in admin mode) */}
          {!isAdminMode ? (
            <nav className="hidden lg:flex items-center gap-5 xl:gap-7 font-bold uppercase tracking-widest text-[11px] text-[#52633E] flex-nowrap">
              <button onClick={handleGoHome} className="hover:text-[#C9A84E] transition-colors relative py-2 after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:w-0 after:h-[2px] after:bg-[#C9A84E] hover:after:w-full after:transition-all after:duration-300 whitespace-nowrap">Home</button>
              <button onClick={() => handleScrollTo(menuRef)} className="hover:text-[#C9A84E] transition-colors relative py-2 after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:w-0 after:h-[2px] after:bg-[#C9A84E] hover:after:w-full after:transition-all after:duration-300 whitespace-nowrap">Menu</button>
              <button onClick={() => { handleScrollTo(bookRef); setActiveReservationTab("book"); setIsReservationModalOpen(true); }} className="hover:text-[#C9A84E] transition-colors relative py-2 after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:w-0 after:h-[2px] after:bg-[#C9A84E] hover:after:w-full after:transition-all after:duration-300 whitespace-nowrap">Book Table</button>
              <button onClick={() => handleScrollTo(galleryRef)} className="hover:text-[#C9A84E] transition-colors relative py-2 after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:w-0 after:h-[2px] after:bg-[#C9A84E] hover:after:w-full after:transition-all after:duration-300 whitespace-nowrap">Gallery</button>
              <button onClick={() => handleScrollTo(aboutRef)} className="hover:text-[#C9A84E] transition-colors relative py-2 after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:w-0 after:h-[2px] after:bg-[#C9A84E] hover:after:w-full after:transition-all after:duration-300 whitespace-nowrap">Our Story</button>
              <button onClick={() => handleScrollTo(reviewsRef)} className="hover:text-[#C9A84E] transition-colors relative py-2 after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:w-0 after:h-[2px] after:bg-[#C9A84E] hover:after:w-full after:transition-all after:duration-300 whitespace-nowrap">Reviews</button>
              <button onClick={() => handleScrollTo(contactRef)} className="hover:text-[#C9A84E] transition-colors relative py-2 after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:w-0 after:h-[2px] after:bg-[#C9A84E] hover:after:w-full after:transition-all after:duration-300 whitespace-nowrap">Contact</button>
              <button onClick={() => setIsYourOrdersOpen(true)} className="hover:text-[#C9A84E] transition-colors relative py-2 after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:w-0 after:h-[2px] after:bg-[#C9A84E] hover:after:w-full after:transition-all after:duration-300 whitespace-nowrap flex items-center gap-1.5 text-[#3E4B2F]">
                <Receipt className="w-3.5 h-3.5 text-[#C9A84E]" />
                My Orders
              </button>
            </nav>
          ) : (
            <div className="text-[10px] uppercase border border-[#C9A84E]/40 text-[#3E4B2F] bg-[#C9A84E]/10 font-bold px-3.5 py-1.5 rounded-full tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3E4B2F] animate-pulse"></span>
              Owner Dashboard Active
            </div>
          )}

          <div className="flex items-center gap-2 sm:gap-3">
            {isAdminMode ? (
              <button
                onClick={() => setIsAdminMode(false)}
                className="bg-[#3E4B2F] hover:bg-[#323E25] text-white px-4.5 py-2.5 rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all flex items-center gap-2 shadow-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Customer View
              </button>
            ) : (
              <button
                onClick={() => setShowAdminLogin(true)}
                className="hidden sm:flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-[#FAF8F3] to-[#F4EFE6] hover:from-[#F4EFE6] hover:to-[#ECE4D4] text-[#C9A84E] border border-[#C9A84E]/30 shadow-sm transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
                title="Cafe Owner Portal"
              >
                <Crown className="w-4.5 h-4.5 text-[#C9A84E]" />
              </button>
            )}

            {!isAdminMode && (
              <button
                onClick={() => setIsCartOpen(true)}
                className="relative bg-[#3E4B2F] text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-full flex items-center gap-2 hover:bg-[#323E25] transition-all font-bold text-[11px] tracking-wider uppercase cursor-pointer shadow-lg shadow-[#3E4B2F]/20 border border-[#C9A84E]/30"
              >
                <ShoppingCart className="w-3.5 h-3.5 text-[#FAF8F3]" />
                <span className="font-bold text-[11px] sm:inline hidden">Tray</span>
                {cartItemCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5.5 h-5.5 bg-[#C9A84E] text-[#26301C] text-[9px] font-black rounded-full flex items-center justify-center border-2 border-[#FAF8F3] shadow-sm">
                    {cartItemCount}
                  </span>
                )}
              </button>
            )}

            {/* Mobile menu toggle hamburger button */}
            {!isAdminMode && (
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden w-10 h-10 rounded-xl bg-white hover:bg-[#F4EFE6] text-[#3E4B2F] hover:text-[#C9A84E] flex items-center justify-center transition-all border border-[#C9A84E]/20 shadow-sm"
                title="Toggle Menu"
              >
                {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>

        {/* Mobile Dropdown Menu Panel */}
        <AnimatePresence>
          {isMobileMenuOpen && !isAdminMode && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden border-t border-[#C9A84E]/20 bg-[#FAF8F3] shadow-lg overflow-hidden"
            >
              <div className="px-6 py-5 space-y-3.5 flex flex-col font-bold uppercase tracking-widest text-[10px] text-[#52633E]">
                <button
                  onClick={handleGoHome}
                  className="text-left py-2 hover:text-[#C9A84E] transition-colors border-b border-[#ECE4D4]"
                >
                  Home
                </button>
                <button
                  onClick={() => handleScrollTo(menuRef)}
                  className="text-left py-2 hover:text-[#C9A84E] transition-colors border-b border-[#ECE4D4]"
                >
                  Menu
                </button>
                <button
                  onClick={() => {
                    handleScrollTo(bookRef);
                    setActiveReservationTab("book");
                    setIsReservationModalOpen(true);
                    setIsMobileMenuOpen(false);
                  }}
                  className="text-left py-2 hover:text-[#C9A84E] transition-colors border-b border-[#ECE4D4]"
                >
                  Book Table
                </button>
                <button
                  onClick={() => handleScrollTo(galleryRef)}
                  className="text-left py-2 hover:text-[#C9A84E] transition-colors border-b border-[#ECE4D4]"
                >
                  Gallery
                </button>
                <button
                  onClick={() => handleScrollTo(aboutRef)}
                  className="text-left py-2 hover:text-[#C9A84E] transition-colors border-b border-[#ECE4D4]"
                >
                  Our Story
                </button>
                <button
                  onClick={() => handleScrollTo(reviewsRef)}
                  className="text-left py-2 hover:text-[#C9A84E] transition-colors border-b border-[#ECE4D4]"
                >
                  Reviews
                </button>
                <button
                  onClick={() => handleScrollTo(contactRef)}
                  className="text-left py-2 hover:text-[#C9A84E] transition-colors border-b border-[#ECE4D4]"
                >
                  Contact
                </button>
                <button
                  onClick={() => {
                    setIsYourOrdersOpen(true);
                    setIsMobileMenuOpen(false);
                  }}
                  className="text-left py-2 hover:text-[#C9A84E] transition-colors border-b border-[#ECE4D4] flex items-center justify-between"
                >
                  <span>My Orders</span>
                  <Receipt className="w-3.5 h-3.5 text-[#C9A84E]" />
                </button>
                <button
                  onClick={() => {
                    setShowAdminLogin(true);
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full text-center py-3 bg-[#3E4B2F] text-white rounded-xl hover:bg-[#323E25] transition-all font-bold tracking-widest text-[9px] flex items-center justify-center gap-2 mt-2 shadow-sm"
                >
                  <Crown className="w-4 h-4 text-[#C9A84E]" />
                  Owner Portal
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ================= ADMIN LOGIN MODAL ================= */}
      <AnimatePresence>
        {showAdminLogin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#26301C]/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#FAF8F3] w-full max-w-md rounded-3xl p-8 shadow-2xl border border-[#C9A84E]/30 relative"
            >
              <button
                onClick={() => { setShowAdminLogin(false); setAdminEmail(""); setAdminPassword(""); setAdminLoginError(""); }}
                className="absolute top-6 right-6 w-9 h-9 rounded-full bg-white flex items-center justify-center text-[#52633E] hover:bg-[#F4EFE6] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="text-center mb-6">
                <DelishLogo className="w-16 h-16 mx-auto mb-3 shadow-md" />
                <h3 className="text-2xl font-serif font-black tracking-tight text-[#26301C]">DELISH Cafe Portal</h3>
                <p className="text-xs text-[#52633E] mt-1 uppercase tracking-wider font-semibold">Owner & Kitchen Management Dashboard</p>
              </div>

              <form onSubmit={handleAdminLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#52633E] uppercase tracking-widest mb-2">Admin Email</label>
                  <input
                    type="email"
                    placeholder="Enter email address"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="w-full px-4 py-3.5 border border-[#C9A84E]/30 rounded-xl focus:outline-none focus:border-[#3E4B2F] font-bold text-xs transition-all bg-white text-[#26301C] placeholder-stone-400"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#52633E] uppercase tracking-widest mb-2">Secret Password</label>
                  <input
                    type="password"
                    placeholder="Enter secret password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full px-4 py-3.5 border border-[#C9A84E]/30 rounded-xl focus:outline-none focus:border-[#3E4B2F] font-bold tracking-widest text-xs uppercase transition-all bg-white text-[#26301C] placeholder-stone-400"
                    required
                  />
                </div>
                {adminLoginError && (
                  <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs flex items-center gap-2 font-bold uppercase tracking-wider">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{adminLoginError}</span>
                  </div>
                )}
                <button
                  type="submit"
                  className="w-full bg-[#3E4B2F] hover:bg-[#323E25] text-white font-bold uppercase tracking-widest py-4 rounded-xl transition-all hover:shadow-lg text-xs cursor-pointer border border-[#C9A84E]/40"
                >
                  Verify and Sign In
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= PRIMARY VIEWS ================= */}
      <div className="pt-20">
        {!isAdminMode ? (
        // ================= CUSTOMER PORTAL =================
        <>
          {/* ================= HERO SECTION ================= */}
          <section className="relative min-h-[92vh] flex items-center justify-center py-20 px-4 overflow-hidden bg-[#FAF8F3]">
            {/* Background Slideshow */}
            <div className="absolute inset-0 z-0">
              {HERO_IMAGES.map((img, i) => (
                <div
                  key={i}
                  className={`absolute inset-0 bg-cover bg-center transition-all duration-[1500ms] ease-in-out ${
                    i === heroIndex ? "opacity-35 scale-105" : "opacity-0 scale-100"
                  }`}
                  style={{ backgroundImage: `url("${img}")` }}
                />
              ))}
              <div className="absolute inset-0 bg-gradient-to-t from-[#FAF8F3] via-[#FAF8F3]/85 to-transparent" />
            </div>

            <div className="relative z-10 max-w-4xl mx-auto text-center text-[#26301C]">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="space-y-6"
              >
                <div className="inline-flex items-center gap-2 bg-[#FAF8F3]/90 border border-[#C9A84E]/50 px-4 py-2 rounded-full text-xs font-bold tracking-widest uppercase text-[#3E4B2F] shadow-sm backdrop-blur-sm">
                  <Star className="w-3.5 h-3.5 fill-[#C9A84E] text-[#C9A84E]" />
                  <span>Ahmedabad's Premier Aesthetic Cafe &bull; Est. 2024</span>
                </div>
                <h1 className="text-5xl sm:text-7xl lg:text-8xl font-serif font-black tracking-tight leading-tight text-[#26301C]">
                  Where Taste Meets <br />
                  <span className="text-[#C9A84E] italic font-serif">
                    Aesthetic
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-[#52633E] max-w-2xl mx-auto leading-relaxed uppercase tracking-wider font-semibold">
                  Welcome to Delish Cafe. Scan your table QR or order for express doorstep delivery. Immerse in our olive-green sanctuary with handcrafted coffees, artisanal shakes, sourdough pizzas, and gourmet bites.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                  <button
                    onClick={() => handleScrollTo(menuRef)}
                    className="w-full sm:w-auto bg-[#3E4B2F] hover:bg-[#323E25] text-white font-bold uppercase tracking-widest text-xs py-4.5 px-10 rounded-xl transition-all cursor-pointer shadow-lg shadow-[#3E4B2F]/20 border border-[#C9A84E]/30"
                  >
                    Explore Menu & Order
                  </button>
                  <button
                    onClick={() => {
                      handleScrollTo(bookRef);
                      setActiveReservationTab("book");
                      setIsReservationModalOpen(true);
                    }}
                    className="w-full sm:w-auto bg-white hover:bg-[#F4EFE6] text-[#3E4B2F] font-bold uppercase tracking-widest text-xs py-4.5 px-8 rounded-xl border border-[#C9A84E]/40 transition-all cursor-pointer shadow-sm"
                  >
                    Reserve Table
                  </button>
                </div>
              </motion.div>

              {/* Dots tracker */}
              <div className="flex justify-center gap-2 mt-16">
                {HERO_IMAGES.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setHeroIndex(i)}
                    className={`h-2.5 rounded-full transition-all ${
                      i === heroIndex ? "bg-[#3E4B2F] w-8" : "bg-[#C9A84E]/30 hover:bg-[#C9A84E]/60 w-2.5"
                    }`}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* ================= SYSTEM HIGHLIGHTS ================= */}
          <section className="py-16 bg-white border-y border-[#C9A84E]/20 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                <div className="flex items-start gap-5">
                  <div className="w-12 h-12 rounded-2xl bg-[#FAF8F3] border border-[#C9A84E]/40 flex items-center justify-center text-[#3E4B2F] shrink-0 shadow-sm">
                    <Utensils className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-lg font-serif font-bold uppercase tracking-tight text-[#26301C]">100% Pure Vegetarian</h4>
                    <p className="text-xs text-[#52633E] mt-1 leading-relaxed uppercase tracking-wider font-semibold">Gourmet recipes crafted with farm-fresh produce, artisanal cheeses, and authentic culinary love.</p>
                  </div>
                </div>
                <div className="flex items-start gap-5">
                  <div className="w-12 h-12 rounded-2xl bg-[#FAF8F3] border border-[#C9A84E]/40 flex items-center justify-center text-[#3E4B2F] shrink-0 shadow-sm">
                    <Star className="w-6 h-6 fill-[#C9A84E]/20 text-[#C9A84E]" />
                  </div>
                  <div>
                    <h4 className="text-lg font-serif font-bold uppercase tracking-tight text-[#26301C]">Handcrafted Brews</h4>
                    <p className="text-xs text-[#52633E] mt-1 leading-relaxed uppercase tracking-wider font-semibold">Specialty coffee beans brewed fresh by passionate baristas. From velvety lattes to chilled frappes.</p>
                  </div>
                </div>
                <div className="flex items-start gap-5">
                  <div className="w-12 h-12 rounded-2xl bg-[#FAF8F3] border border-[#C9A84E]/40 flex items-center justify-center text-[#3E4B2F] shrink-0 shadow-sm">
                    <QrCode className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-lg font-serif font-bold uppercase tracking-tight text-[#26301C]">Contactless Table QR</h4>
                    <p className="text-xs text-[#52633E] mt-1 leading-relaxed uppercase tracking-wider font-semibold">Seamless in-cafe dining. Scan your table QR, customize dishes, and track kitchen prep in real time.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ================= MENU SECTION ================= */}
          <section ref={menuRef} className="scroll-mt-24 py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 bg-[#FAF8F3]">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <div className="inline-flex items-center gap-2 bg-[#FAF8F3] border border-[#C9A84E]/40 px-3.5 py-1.5 rounded-full text-[11px] font-bold tracking-widest uppercase text-[#3E4B2F] mb-4">
                <Utensils className="w-3.5 h-3.5 text-[#C9A84E]" />
                100% Pure Vegetarian Cafe Menu
              </div>
              <h2 className="text-4xl sm:text-6xl font-serif font-black tracking-tight uppercase leading-tight text-[#26301C]">
                The Delish Cafe <br /><span className="text-[#C9A84E] font-serif italic">Collection</span>
              </h2>
              <p className="text-xs uppercase tracking-widest text-[#52633E] mt-3 leading-relaxed font-bold">
                Handcrafted coffees, artisanal shakes, freshly baked sourdough pizzas, loaded burgers, and gourmet bites. Prepared fresh to order.
              </p>
            </div>

            {/* Dine-In Indicator (Non-intrusive for table diners) */}
            {activeTableLabel && orderType === "dine_in" && (
              <div className="mb-8 flex justify-center">
                <div className="inline-flex items-center gap-2.5 bg-white text-[#3E4B2F] border border-[#C9A84E]/40 px-5 py-2.5 rounded-full shadow-sm text-xs font-bold uppercase tracking-wider">
                  <span className="text-base leading-none">🍽️</span>
                  <span>Dine-In &bull; Table {activeTableLabel}</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-1" />
                </div>
              </div>
            )}

            {/* Active kitchen status tracker for client */}
            {currentOrder && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-[#C9A84E]/50 shadow-xl mb-12 max-w-4xl mx-auto flex flex-col sm:flex-row items-center gap-6 justify-between"
              >
                <div className="space-y-2 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2 text-[#C9A84E] text-xs font-bold uppercase tracking-widest">
                    <Clock className="w-4 h-4 animate-spin" style={{ animationDuration: '4s' }} />
                    Live Delish Kitchen Pipeline
                  </div>
                  <h4 className="text-lg font-serif font-bold uppercase tracking-wider text-[#26301C]">
                    Order #{currentOrder.id.slice(-6).toUpperCase()}
                  </h4>
                  <p className="text-xs text-[#52633E] uppercase tracking-wider font-semibold">
                    Destination: <span className="font-bold text-[#26301C]">{currentOrder.tableNumber === "Delivery" ? "Home Delivery" : `Table ${currentOrder.tableNumber}`}</span> &bull; Total: <span className="text-[#3E4B2F] font-bold">₹{currentOrder.total}</span>
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="block text-[9px] text-[#52633E] uppercase font-bold tracking-widest">Kitchen State</span>
                    <span className={`inline-block px-3.5 py-1.5 rounded-full font-bold text-[10px] mt-1.5 tracking-widest uppercase ${
                      currentOrder.status === "Completed"
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-300"
                        : currentOrder.status === "Ready"
                        ? "bg-[#C9A84E]/15 text-[#3E4B2F] border border-[#C9A84E] animate-pulse"
                        : currentOrder.status === "Preparing"
                        ? "bg-amber-50 text-amber-800 border border-amber-300"
                        : "bg-[#FAF8F3] text-[#52633E] border border-[#ECE4D4]"
                    }`}>
                      {currentOrder.status}
                    </span>
                  </div>

                  {currentOrder.status === "Completed" && (
                    <button
                      onClick={() => setCurrentOrder(null)}
                      className="bg-[#FAF8F3] hover:bg-[#F4EFE6] border border-[#C9A84E]/20 text-[#52633E] p-2 rounded-xl text-xs font-bold transition-all"
                      title="Dismiss completed order tracker"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {/* Menu navigation & searching */}
            <div className="space-y-8">
              {/* Category selector row */}
              <div className="flex items-center overflow-x-auto pb-4 gap-2.5 scrollbar-thin scrollbar-thumb-[#ECE4D4] scrollbar-track-transparent">
                {menuData.map((category) => (
                  <button
                    key={category.category}
                    onClick={() => {
                      setActiveCategory(category.category);
                      setSearchTerm(""); // reset search
                    }}
                    className={`px-6 py-3.5 rounded-2xl font-bold uppercase tracking-widest text-[11px] whitespace-nowrap transition-all border shrink-0 cursor-pointer ${
                      activeCategory === category.category && !searchTerm
                        ? "bg-[#3E4B2F] text-white border-[#3E4B2F] shadow-lg shadow-[#3E4B2F]/20 scale-105"
                        : "bg-white text-[#52633E] border-[#C9A84E]/25 hover:text-[#26301C] hover:border-[#C9A84E]/50 shadow-sm"
                    }`}
                  >
                    {category.category}
                  </button>
                ))}
              </div>

              {/* Advanced controls panel */}
              <div className="bg-white border border-[#C9A84E]/25 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-md shadow-[#3E4B2F]/5">
                {/* Search Bar */}
                <div className="relative w-full md:max-w-md">
                  <Search className="absolute left-4.5 top-1/2 -translate-y-1/2 text-[#52633E] w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search coffees, pizzas, shakes, pasta..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-11 pr-5 py-3.5 border border-[#C9A84E]/30 rounded-2xl bg-[#FAF8F3] focus:bg-white focus:outline-none focus:border-[#3E4B2F] text-xs font-bold uppercase tracking-wider transition-all text-[#26301C] placeholder-stone-400"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute right-4.5 top-1/2 -translate-y-1/2 text-[#52633E] hover:text-[#26301C]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filters & Sorters */}
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
                  {/* Veg Indicator */}
                  <div className="bg-[#FAF8F3] border border-[#C9A84E]/20 p-1 rounded-xl flex gap-1 text-[10px] font-bold uppercase tracking-wider">
                    <button
                      onClick={() => setVegFilter("all")}
                      className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                        vegFilter === "all" ? "bg-white text-[#26301C] shadow-sm border border-[#C9A84E]/30" : "text-[#52633E] hover:text-[#26301C]"
                      }`}
                    >
                      🍽 All Items
                    </button>
                    <button
                      onClick={() => setVegFilter("veg")}
                      className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                        vegFilter === "veg" ? "bg-[#3E4B2F] text-white shadow-sm" : "text-[#52633E] hover:text-[#26301C]"
                      }`}
                    >
                      🌱 Pure Veg (100%)
                    </button>
                  </div>

                  {/* Sorter */}
                  <select
                    value={sortType}
                    onChange={(e) => setSortType(e.target.value as any)}
                    className="border border-[#C9A84E]/30 bg-[#FAF8F3] text-[#3E4B2F] font-bold uppercase tracking-wider text-xs px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-[#3E4B2F] focus:bg-white transition-all cursor-pointer"
                  >
                    <option value="none">Default Ordering</option>
                    <option value="price_asc">Price: Low to High</option>
                    <option value="price_desc">Price: High to Low</option>
                    <option value="popularity">⭐ Most Popular</option>
                  </select>
                </div>
              </div>

              {/* Food Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                <AnimatePresence mode="popLayout">
                  {getFilteredItems().map((item) => (
                    <motion.div
                      key={item.name}
                      layout
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-white rounded-3xl border border-[#C9A84E]/25 shadow-md shadow-[#3E4B2F]/5 hover:shadow-xl hover:-translate-y-1.5 hover:border-[#C9A84E]/60 transition-all duration-300 overflow-hidden flex flex-col justify-between group"
                    >
                      <div className="relative aspect-video overflow-hidden border-b border-[#F4EFE6]">
                        <img
                          src={item.img}
                          alt={item.name}
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&auto=format&fit=crop&q=80";
                          }}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute top-4 left-4 flex flex-col gap-1.5">
                          <span className="px-2.5 py-1 rounded-lg text-[9px] font-bold tracking-widest uppercase text-white shadow-md bg-emerald-700 border border-emerald-600">
                            🌱 100% PURE VEG
                          </span>
                        </div>
                        <div className="absolute top-4 right-4 bg-[#FAF8F3]/95 text-[#3E4B2F] border border-[#C9A84E]/40 font-bold text-[10px] px-2.5 py-1 rounded-lg shadow-md flex items-center gap-1 backdrop-blur-sm">
                          <Star className="w-3.5 h-3.5 fill-[#C9A84E] text-[#C9A84E]" />
                          <span>{item.popularity_score}</span>
                        </div>
                      </div>

                      <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                        <div className="space-y-1.5">
                          <h4 className="text-xl font-serif font-bold uppercase tracking-tight text-[#26301C] group-hover:text-[#3E4B2F] transition-colors">
                            {item.name}
                          </h4>
                          <p className="text-xs text-[#52633E] leading-relaxed font-semibold">
                            {item.desc}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-[#F4EFE6] mt-4">
                          <span className="text-2xl font-serif font-black tracking-tight text-[#26301C]">
                            ₹{item.price}
                          </span>
                          <button
                            onClick={() => handleAddToCart(item)}
                            className="bg-[#3E4B2F] hover:bg-[#323E25] text-white font-bold uppercase tracking-widest text-[10px] px-5 py-3.5 rounded-xl transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-1.5 shadow-sm border border-[#C9A84E]/30"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add to Tray
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {getFilteredItems().length === 0 && (
                <div className="text-center py-20 bg-white rounded-3xl border border-[#C9A84E]/25 shadow-md shadow-[#3E4B2F]/5 max-w-lg mx-auto">
                  <div className="w-12 h-12 rounded-full bg-[#FAF8F3] border border-[#C9A84E]/20 text-[#52633E] flex items-center justify-center mx-auto mb-3">
                    <Search className="w-6 h-6" />
                  </div>
                  <h4 className="font-serif font-bold uppercase tracking-wider text-[#26301C]">No Delish Dishes Found</h4>
                  <p className="text-xs text-[#52633E] mt-1 uppercase tracking-wider max-w-xs mx-auto font-semibold">Try searching for other items or browse our categories above.</p>
                </div>
              )}

              {/* Modern "View Cart / Place Order" option below all menu items */}
              {cart.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-12 bg-white border border-[#C9A84E]/30 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl shadow-[#3E4B2F]/10 max-w-4xl mx-auto"
                >
                  <div className="flex items-center gap-4 text-left">
                    <div className="w-12 h-12 rounded-2xl bg-[#3E4B2F] text-white flex items-center justify-center shadow-lg shadow-[#3E4B2F]/20 shrink-0 border border-[#C9A84E]/40">
                      <ShoppingCart className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-serif font-bold text-base uppercase tracking-wider text-[#26301C]">
                        {cart.reduce((sum, item) => sum + item.quantity, 0)} Gourmet Items In Tray
                      </h4>
                      <p className="text-xs font-semibold text-[#52633E] uppercase tracking-widest mt-1">
                        Current Total: <span className="text-[#3E4B2F] font-serif font-black text-base">₹{cartTotal}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <button
                      onClick={() => setIsCartOpen(true)}
                      className="w-full sm:w-auto bg-[#3E4B2F] hover:bg-[#323E25] text-white font-bold uppercase tracking-widest text-[11px] px-8 py-4 rounded-xl transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-lg shadow-[#3E4B2F]/20 flex items-center justify-center gap-2 border border-[#C9A84E]/40"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      View Tray & Place Order
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </section>

          {/* ================= BOOK TABLE SECTION (IMAGE BANNER CARD) ================= */}
          <section ref={bookRef} className="scroll-mt-24 py-16 sm:py-24 bg-[#FAF8F3] border-t border-[#C9A84E]/20">
            <div className="max-w-4xl mx-auto px-4 sm:px-6">
              <div
                onClick={() => {
                  setActiveReservationTab("book");
                  setIsReservationModalOpen(true);
                }}
                className="group relative rounded-[2.5rem] py-16 sm:py-24 px-6 sm:px-14 text-center text-white shadow-2xl shadow-[#1A2313]/30 border-2 border-[#C9A84E]/40 overflow-hidden cursor-pointer transition-all duration-500 hover:shadow-[#1A2313]/50 hover:border-[#C9A84E]/80 hover:scale-[1.01]"
              >
                {/* Background Cafe Ambiance Image with dark warm overlay */}
                <img
                  src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1600&auto=format&fit=crop&q=80"
                  alt="Delish Cafe Table Setting"
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 brightness-[0.38] contrast-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1B2314]/90 via-[#1B2314]/65 to-[#1B2314]/75" />

                {/* Subtle lighting accents */}
                <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-[#C9A84E]/20 blur-3xl pointer-events-none" />
                <div className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-[#3E4B2F]/40 blur-3xl pointer-events-none" />

                <div className="relative z-10 max-w-xl mx-auto">
                  <div className="inline-flex items-center gap-2 bg-[#FAF8F3]/15 border border-[#C9A84E]/50 px-3.5 py-1.5 rounded-full text-[10px] font-bold tracking-widest uppercase text-[#FAF8F3] mb-4 backdrop-blur-sm shadow-sm">
                    <Calendar className="w-3.5 h-3.5 text-[#C9A84E]" />
                    <span>Live Table Reservations</span>
                  </div>

                  <h2 className="text-3xl sm:text-5xl md:text-[3.25rem] font-serif font-bold text-[#FAF8F3] tracking-tight leading-tight">
                    Reserve Your Evening
                  </h2>

                  <p className="text-xs sm:text-base text-[#FAF8F3]/90 font-medium tracking-wide mt-3.5 sm:mt-4 mb-8 sm:mb-9 max-w-lg mx-auto leading-relaxed">
                    Whether it's a date, a meet-up or a quiet break &mdash; click anywhere to book your favorite table at Delish Cafe.
                  </p>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveReservationTab("book");
                        setIsReservationModalOpen(true);
                      }}
                      className="bg-gradient-to-b from-[#E0B258] to-[#C99638] hover:from-[#E8BD65] hover:to-[#D29E40] text-[#1E2516] font-black uppercase tracking-widest text-xs sm:text-sm px-10 py-4.5 rounded-full shadow-xl shadow-black/30 transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer border border-[#FAF8F3]/40 flex items-center gap-2"
                    >
                      <Calendar className="w-4 h-4" />
                      <span>BOOK A TABLE NOW</span>
                    </button>
                  </div>

                  {/* Active reservation indicator if any exist */}
                  {allReservations.filter((r) => r.status === "confirmed" && userReservationIds.includes(r.id)).length > 0 && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveReservationTab("manage");
                        setIsReservationModalOpen(true);
                      }}
                      className="mt-6 inline-flex items-center gap-2 bg-[#FAF8F3]/20 hover:bg-[#FAF8F3]/30 backdrop-blur-sm border border-[#C9A84E]/50 px-4 py-2 rounded-full text-[11px] font-bold tracking-wider uppercase text-[#FAF8F3] transition-all cursor-pointer shadow-sm"
                    >
                      <span className="w-2 h-2 rounded-full bg-[#C9A84E] animate-ping" />
                      <span>
                        You have {allReservations.filter((r) => r.status === "confirmed" && userReservationIds.includes(r.id)).length} Active Booking(s)
                      </span>
                      <span className="underline ml-1 font-extrabold text-[#C9A84E]">View or Edit &rarr;</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* ================= RESERVATION POPUP MODAL ================= */}
          <AnimatePresence>
            {isReservationModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#26301C]/80 backdrop-blur-md overflow-y-auto">
                <div
                  className="fixed inset-0 cursor-pointer"
                  onClick={() => setIsReservationModalOpen(false)}
                />

                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 20 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="relative w-full max-w-3xl bg-[#FAF8F3] rounded-[2rem] shadow-2xl border border-[#C9A84E]/35 overflow-hidden z-10 my-6 max-h-[92vh] flex flex-col"
                >
                  {/* Modal Header */}
                  <div className="p-5 sm:p-6 bg-white border-b border-[#C9A84E]/20 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-[#FAF8F3] border border-[#C9A84E]/40 flex items-center justify-center text-[#3E4B2F] shadow-sm">
                        <Calendar className="w-5 h-5 text-[#C9A84E]" />
                      </div>
                      <div>
                        <h3 className="text-xl sm:text-2xl font-serif font-black uppercase tracking-tight text-[#26301C]">
                          {editReservationId ? "Modify Reservation" : "Table Reservation"}
                        </h3>
                        <p className="text-[10px] sm:text-xs text-[#52633E] uppercase font-bold tracking-widest mt-0.5">
                          Delish Cafe &bull; Live Table Availability
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="flex bg-[#FAF8F3] p-1 rounded-xl border border-[#C9A84E]/30">
                        <button
                          type="button"
                          onClick={() => setActiveReservationTab("book")}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                            activeReservationTab === "book"
                              ? "bg-[#3E4B2F] text-white shadow-sm"
                              : "text-[#52633E] hover:text-[#26301C]"
                          }`}
                        >
                          Book Table
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveReservationTab("manage")}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                            activeReservationTab === "manage"
                              ? "bg-[#3E4B2F] text-white shadow-sm"
                              : "text-[#52633E] hover:text-[#26301C]"
                          }`}
                        >
                          <span>My Bookings</span>
                          {allReservations.filter((r) => r.status === "confirmed" && userReservationIds.includes(r.id)).length > 0 && (
                            <span className="w-4 h-4 rounded-full bg-[#C9A84E] text-[#26301C] text-[9px] font-black flex items-center justify-center">
                              {allReservations.filter((r) => r.status === "confirmed" && userReservationIds.includes(r.id)).length}
                            </span>
                          )}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsReservationModalOpen(false)}
                        className="w-9 h-9 rounded-full bg-[#FAF8F3] hover:bg-[#F4EFE6] border border-[#C9A84E]/30 flex items-center justify-center text-[#52633E] hover:text-[#26301C] transition-colors cursor-pointer"
                        title="Close"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Modal Body with scrollable content */}
                  <div className="p-6 sm:p-8 overflow-y-auto space-y-6">
                    {activeReservationTab === "book" ? (
                      <form onSubmit={handleBookTable} className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                          <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-[#52633E] uppercase tracking-widest">
                              Select Date
                            </label>
                            <input
                              type="date"
                              min={new Date().toISOString().split("T")[0]}
                              value={resDate}
                              onChange={(e) => {
                                setResDate(e.target.value);
                                setResTable("");
                              }}
                              className="w-full px-4 py-3 border border-[#C9A84E]/30 rounded-xl bg-white text-[#26301C] focus:outline-none focus:border-[#3E4B2F] font-bold text-sm tracking-wider transition-all"
                              required
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-[#52633E] uppercase tracking-widest">
                              Time Slot
                            </label>
                            <select
                              value={resTime}
                              onChange={(e) => {
                                setResTime(e.target.value);
                                setResTable("");
                              }}
                              className="w-full px-4 py-3 border border-[#C9A84E]/30 rounded-xl bg-white text-[#3E4B2F] focus:outline-none focus:border-[#3E4B2F] font-bold text-sm tracking-wider transition-all cursor-pointer"
                              required
                            >
                              <option value="">Choose a slot</option>
                              {TIME_SLOTS.map((slot) => (
                                <option key={slot} value={slot}>
                                  {slot}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Interactive Table Layout selector */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="block text-[10px] font-bold text-[#52633E] uppercase tracking-widest">
                              Select Available Table
                            </label>
                            {resTable && (
                              <span className="text-[10px] text-[#3E4B2F] bg-white border border-[#C9A84E]/40 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                Table {resTable} Selected
                              </span>
                            )}
                          </div>
                          {!resDate || !resTime ? (
                            <div className="p-4 bg-white border border-[#C9A84E]/30 text-[#3E4B2F] text-xs rounded-xl flex items-center gap-2 font-bold uppercase tracking-wider">
                              <AlertCircle className="w-4 h-4 shrink-0 text-[#C9A84E]" />
                              <span>
                                Select a <strong>Date</strong> and <strong>Time</strong> above to display live cafe table availability.
                              </span>
                            </div>
                          ) : (
                            <div className="space-y-3 bg-white p-5 rounded-2xl border border-[#C9A84E]/25">
                              <p className="text-[10px] uppercase text-[#52633E] font-bold tracking-widest">
                                Click an available table below:
                              </p>
                              <div className="grid grid-cols-5 gap-3">
                                {Array.from({ length: TOTAL_TABLES }, (_, index) => {
                                  const tableNum = String(index + 1);
                                  const isReserved = getUnavailableTables().includes(tableNum);
                                  const isSelected = resTable === tableNum;

                                  return (
                                    <button
                                      key={tableNum}
                                      type="button"
                                      disabled={isReserved}
                                      onClick={() => setResTable(tableNum)}
                                      className={`py-3.5 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                        isReserved
                                          ? "bg-[#FAF8F3] text-stone-300 border-stone-200 cursor-not-allowed line-through"
                                          : isSelected
                                          ? "bg-[#3E4B2F] text-white border-[#3E4B2F] shadow-md scale-105"
                                          : "bg-[#FAF8F3] text-[#3E4B2F] border-[#C9A84E]/30 hover:border-[#3E4B2F] hover:bg-white"
                                      }`}
                                    >
                                      T {tableNum}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Guest selector */}
                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-[#52633E] uppercase tracking-widest">
                            Number of Guests
                          </label>
                          <div className="flex items-center gap-4">
                            <button
                              type="button"
                              onClick={() => setResGuests((prev) => Math.max(1, prev - 1))}
                              className="w-10 h-10 rounded-xl bg-white border border-[#C9A84E]/30 hover:bg-[#F4EFE6] flex items-center justify-center text-[#3E4B2F] transition-all font-bold cursor-pointer"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="font-serif font-bold text-lg text-[#26301C] w-8 text-center">
                              {resGuests}
                            </span>
                            <button
                              type="button"
                              onClick={() => setResGuests((prev) => Math.min(12, prev + 1))}
                              className="w-10 h-10 rounded-xl bg-white border border-[#C9A84E]/30 hover:bg-[#F4EFE6] flex items-center justify-center text-[#3E4B2F] transition-all font-bold cursor-pointer"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                            <span className="text-[10px] text-[#52633E] font-bold uppercase tracking-widest">
                              Max 12 guests per single table
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                          <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-[#52633E] uppercase tracking-widest">
                              Your Full Name
                            </label>
                            <input
                              type="text"
                              placeholder="Sonika Patel"
                              value={resName}
                              onChange={(e) => setResName(e.target.value)}
                              className="w-full px-4 py-3.5 border border-[#C9A84E]/30 rounded-xl focus:outline-none focus:border-[#3E4B2F] text-sm font-bold uppercase tracking-wider transition-all bg-white text-[#26301C] placeholder-stone-400"
                              required
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-[#52633E] uppercase tracking-widest">
                              Contact Number
                            </label>
                            <input
                              type="tel"
                              placeholder="+91 98765 43210"
                              value={resPhone}
                              onChange={(e) => setResPhone(e.target.value)}
                              className="w-full px-4 py-3.5 border border-[#C9A84E]/30 rounded-xl focus:outline-none focus:border-[#3E4B2F] text-sm font-bold uppercase tracking-wider transition-all bg-white text-[#26301C] placeholder-stone-400"
                              required
                            />
                          </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                          <button
                            type="submit"
                            className="flex-1 bg-[#3E4B2F] hover:bg-[#323E25] text-white font-bold uppercase tracking-widest py-4 rounded-xl shadow-lg shadow-[#3E4B2F]/20 transition-all hover:scale-[1.01] active:scale-[0.99] text-xs cursor-pointer border border-[#C9A84E]/40"
                          >
                            {editReservationId ? "Update Reservation" : "Confirm Delish Reservation"}
                          </button>
                          {editReservationId && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditReservationId(null);
                                setResDate("");
                                setResTime("");
                                setResTable("");
                                setResGuests(2);
                                setResName("");
                                setResPhone("");
                              }}
                              className="bg-white hover:bg-[#F4EFE6] text-[#52633E] px-5 rounded-xl text-xs font-bold uppercase tracking-widest border border-[#C9A84E]/30 transition-all cursor-pointer"
                            >
                              Cancel Edit
                            </button>
                          )}
                        </div>
                      </form>
                    ) : (
                      /* Active Bookings view */
                      <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-[#C9A84E]/20 pb-3">
                          <h4 className="text-sm font-serif font-bold uppercase tracking-wider text-[#3E4B2F] flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-[#C9A84E]" />
                            Your Confirmed Bookings
                          </h4>
                          <button
                            type="button"
                            onClick={() => setActiveReservationTab("book")}
                            className="text-[10px] font-bold uppercase tracking-wider text-[#C9A84E] hover:text-[#3E4B2F] underline cursor-pointer"
                          >
                            + Book Another Table
                          </button>
                        </div>

                        {allReservations.filter((r) => r.status === "confirmed" && userReservationIds.includes(r.id)).length === 0 ? (
                          <div className="text-center py-12 border border-[#C9A84E]/20 rounded-2xl bg-white">
                            <Users className="w-10 h-10 text-stone-300 mx-auto mb-2" />
                            <span className="block text-xs text-[#52633E] font-bold uppercase tracking-wider">
                              No active table reservations found.
                            </span>
                            <button
                              type="button"
                              onClick={() => setActiveReservationTab("book")}
                              className="mt-4 inline-flex items-center gap-2 bg-[#3E4B2F] hover:bg-[#323E25] text-white px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all cursor-pointer"
                            >
                              Book A Table Now
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-3.5 max-h-[50vh] overflow-y-auto pr-1">
                            {allReservations
                              .filter((r) => r.status === "confirmed" && userReservationIds.includes(r.id))
                              .map((r) => (
                                <div
                                  key={r.id}
                                  className="bg-white border border-[#C9A84E]/25 rounded-2xl p-5 space-y-3.5 shadow-sm hover:border-[#3E4B2F]/50 transition-all"
                                >
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <span className="text-[10px] text-[#3E4B2F] uppercase font-bold tracking-widest block font-mono">
                                        Table {r.table}
                                      </span>
                                      <span className="text-base font-serif font-bold uppercase block mt-0.5 text-[#26301C]">
                                        {r.name}
                                      </span>
                                    </div>
                                    <span className="text-[10px] uppercase bg-[#FAF8F3] text-[#3E4B2F] border border-[#C9A84E]/30 px-3 py-1 rounded-md font-bold tracking-widest shadow-sm">
                                      {r.guests} Guests
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-[#52633E] font-semibold uppercase tracking-wider bg-[#FAF8F3] p-3 rounded-xl border border-[#C9A84E]/20">
                                    <p className="flex items-center gap-1.5">
                                      <Calendar className="w-3.5 h-3.5 text-[#C9A84E]" /> {r.date}
                                    </p>
                                    <p className="flex items-center gap-1.5">
                                      <Clock className="w-3.5 h-3.5 text-[#C9A84E]" /> {r.time}
                                    </p>
                                    <p className="flex items-center gap-1.5">
                                      <Phone className="w-3.5 h-3.5 text-[#C9A84E]" /> {r.phone}
                                    </p>
                                  </div>

                                  <div className="flex gap-2 pt-1 border-t border-[#F4EFE6]">
                                    <button
                                      type="button"
                                      onClick={() => handleEditReservation(r)}
                                      className="flex-1 bg-[#FAF8F3] hover:bg-[#F4EFE6] text-[#3E4B2F] text-[10px] font-bold uppercase tracking-widest py-2.5 rounded-lg transition-colors border border-[#C9A84E]/30 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" /> Modify Details
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleCancelReservation(r.id)}
                                      className="bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 text-[10px] font-bold uppercase tracking-widest py-2.5 px-4 rounded-lg transition-colors cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* ================= GALLERY SECTION ================= */}
          <section ref={galleryRef} className="scroll-mt-24 py-24 bg-[#FAF8F3] border-t border-[#C9A84E]/20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center max-w-2xl mx-auto mb-16">
                <div className="inline-flex items-center gap-2 bg-white border border-[#C9A84E]/40 px-3.5 py-1.5 rounded-full text-[11px] font-bold tracking-widest uppercase text-[#3E4B2F] mb-4 shadow-sm">
                  <Coffee className="w-3.5 h-3.5 text-[#C9A84E]" />
                  The Delish Atmosphere
                </div>
                <h2 className="text-4xl sm:text-6xl font-serif font-black tracking-tight uppercase leading-tight text-[#26301C]">
                  Moments At <br /><span className="text-[#C9A84E] font-serif italic">Delish Cafe</span>
                </h2>
                <p className="text-xs uppercase tracking-widest text-[#52633E] mt-3 leading-relaxed font-bold">
                  Take a visual tour through our sunlit cafe spaces, barista brewing bar, outdoor terrace, and artisan plates.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  {
                    title: "Specialty Espresso Bar",
                    desc: "Artisanal arabica beans ground to perfection",
                    img: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&auto=format&fit=crop&q=80",
                    tag: "Barista Bar"
                  },
                  {
                    title: "Sunlit Cozy Booths",
                    desc: "Warm wooden acoustics & comfortable seating",
                    img: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&auto=format&fit=crop&q=80",
                    tag: "Ambiance"
                  },
                  {
                    title: "Woodfired Artisan Crusts",
                    desc: "Fermented sourdough stretched and baked fresh",
                    img: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&auto=format&fit=crop&q=80",
                    tag: "Kitchen"
                  },
                  {
                    title: "Creamy Dessert Counter",
                    desc: "Pastries, cheesecakes, and warm fudge brownies",
                    img: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&auto=format&fit=crop&q=80",
                    tag: "Bakery"
                  },
                  {
                    title: "Outdoor Greenery Patio",
                    desc: "Open-air sunset breezes with friends & family",
                    img: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&auto=format&fit=crop&q=80",
                    tag: "Outdoor"
                  },
                  {
                    title: "Refreshing Shake Station",
                    desc: "Lotus Biscoff, Belgian chocolate, and fruity blends",
                    img: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=800&auto=format&fit=crop&q=80",
                    tag: "Beverages"
                  }
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="group relative rounded-3xl overflow-hidden border border-[#C9A84E]/25 shadow-md shadow-[#3E4B2F]/5 aspect-[4/3] bg-stone-900 cursor-pointer"
                  >
                    <img
                      src={item.img}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-90 group-hover:opacity-100"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent transition-opacity duration-300" />
                    <div className="absolute top-4 left-4">
                      <span className="text-[9px] uppercase font-bold tracking-widest px-2.5 py-1 rounded-md bg-[#FAF8F3]/90 text-[#3E4B2F] border border-[#C9A84E]/40 backdrop-blur-sm shadow-sm">
                        {item.tag}
                      </span>
                    </div>
                    <div className="absolute bottom-5 left-5 right-5 text-white space-y-1">
                      <h4 className="font-serif font-bold text-lg uppercase tracking-wide group-hover:text-[#C9A84E] transition-colors">
                        {item.title}
                      </h4>
                      <p className="text-xs text-stone-300 font-medium">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ================= ABOUT SECTION ================= */}
          <section ref={aboutRef} className="scroll-mt-24 py-24 bg-white border-t border-[#C9A84E]/20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
                <div className="relative aspect-video sm:aspect-[4/3] rounded-3xl overflow-hidden shadow-xl shadow-[#3E4B2F]/10 border border-[#C9A84E]/30">
                  <img
                    src="https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&auto=format&fit=crop&q=80"
                    alt="Delish Cafe Dining Hall"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#26301C]/80 via-transparent to-transparent" />
                  <div className="absolute bottom-6 left-6 text-white space-y-1">
                    <span className="text-[9px] text-[#C9A84E] uppercase font-bold tracking-widest block">Main Dining Lounge</span>
                    <h5 className="font-serif font-bold uppercase tracking-tight text-xl">Warm, Aesthetic & Spacious Seating</h5>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="text-[10px] font-bold text-[#3E4B2F] uppercase tracking-widest bg-[#FAF8F3] border border-[#C9A84E]/40 px-3.5 py-1.5 rounded-full inline-block">
                    The Delish Cafe Story
                  </div>
                  <h3 className="text-4xl sm:text-5xl font-serif font-bold tracking-tight uppercase leading-tight text-[#26301C]">
                    Ahmedabad's Pure Veg <br /><span className="text-[#C9A84E] italic font-serif">Artisan Cafe</span>
                  </h3>
                  <p className="text-xs text-[#52633E] uppercase tracking-wider font-semibold leading-relaxed">
                    Delish Cafe was founded on a simple passion: to bring world-class specialty coffees, authentic Italian stone-baked sourdough pizzas, hand-rolled pasta, and artisanal shakes to food lovers in Ahmedabad in a 100% pure vegetarian culinary haven.
                  </p>
                  <p className="text-xs text-[#52633E] uppercase tracking-wider font-semibold leading-relaxed">
                    With our contactless SmartMenu digital ordering engine, you can browse high-resolution dishes, personalize order notes, and watch your food cook live right from your table.
                  </p>
                  <div className="grid grid-cols-2 gap-5 pt-4">
                    <div className="p-5 bg-[#FAF8F3] border border-[#C9A84E]/25 rounded-2xl shadow-sm">
                      <span className="block text-3xl font-serif font-black italic text-[#3E4B2F]">100%</span>
                      <span className="text-[9px] text-[#52633E] font-bold uppercase mt-1 block tracking-widest">Pure Vegetarian</span>
                    </div>
                    <div className="p-5 bg-[#FAF8F3] border border-[#C9A84E]/25 rounded-2xl shadow-sm">
                      <span className="block text-3xl font-serif font-black italic text-[#C9A84E]">25k+</span>
                      <span className="text-[9px] text-[#52633E] font-bold uppercase mt-1 block tracking-widest">Delighted Guests</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ================= REVIEWS SECTION ================= */}
          <section ref={reviewsRef} className="scroll-mt-24 py-24 bg-[#FAF8F3] border-t border-[#C9A84E]/20 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center max-w-xl mx-auto mb-16">
                <div className="inline-flex items-center gap-2 bg-white border border-[#C9A84E]/40 px-3.5 py-1.5 rounded-full text-[11px] font-bold tracking-widest uppercase text-[#3E4B2F] mb-4 shadow-sm">
                  <Star className="w-3.5 h-3.5 text-[#C9A84E] fill-[#C9A84E]" />
                  Guest Feedback
                </div>
                <h2 className="text-4xl sm:text-6xl font-serif font-black tracking-tight uppercase leading-tight text-[#26301C]">
                  Loved By <br /><span className="text-[#C9A84E] font-serif italic">Ahmedabad</span>
                </h2>
                <p className="text-xs uppercase tracking-widest text-[#52633E] mt-3 leading-relaxed font-bold">
                  Honest reviews from coffee connoisseurs and foodies across the city.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-white border border-[#C9A84E]/25 p-8 rounded-3xl shadow-md shadow-[#3E4B2F]/5 flex flex-col justify-between hover:border-[#3E4B2F]/50 hover:shadow-xl transition-all duration-300">
                  <p className="text-xs text-[#52633E] leading-relaxed font-semibold uppercase tracking-wider">
                    "Delish Cafe's table QR ordering is unbelievably slick! We scanned the table code, added the Farmhouse Pizza and Lotus Biscoff Shake, and our order arrived piping hot in 12 minutes. Best coffee in town!"
                  </p>
                  <div className="flex items-center gap-3.5 pt-6 mt-6 border-t border-[#F4EFE6]">
                    <div className="w-10 h-10 rounded-full bg-[#FAF8F3] border border-[#C9A84E]/30 flex items-center justify-center font-bold text-[#3E4B2F] text-xs">R</div>
                    <div>
                      <h5 className="font-serif font-bold uppercase tracking-wider text-xs text-[#26301C]">Rahul Sharma</h5>
                      <span className="text-[10px] text-[#C9A84E] font-bold tracking-widest">★★★★★</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-[#C9A84E]/25 p-8 rounded-3xl shadow-md shadow-[#3E4B2F]/5 flex flex-col justify-between hover:border-[#3E4B2F]/50 hover:shadow-xl transition-all duration-300">
                  <p className="text-xs text-[#52633E] leading-relaxed font-semibold uppercase tracking-wider">
                    "Such a cozy vibe and the fact that it's 100% Pure Vegetarian makes it our go-to family spot. Booking a table in advance was seamless with zero waiting on Sunday night. 10/10!"
                  </p>
                  <div className="flex items-center gap-3.5 pt-6 mt-6 border-t border-[#F4EFE6]">
                    <div className="w-10 h-10 rounded-full bg-[#FAF8F3] border border-[#C9A84E]/30 flex items-center justify-center font-bold text-[#3E4B2F] text-xs">P</div>
                    <div>
                      <h5 className="font-serif font-bold uppercase tracking-wider text-xs text-[#26301C]">Priya Patel</h5>
                      <span className="text-[10px] text-[#C9A84E] font-bold tracking-widest">★★★★★</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-[#C9A84E]/25 p-8 rounded-3xl shadow-md shadow-[#3E4B2F]/5 flex flex-col justify-between hover:border-[#3E4B2F]/50 hover:shadow-xl transition-all duration-300">
                  <p className="text-xs text-[#52633E] leading-relaxed font-semibold uppercase tracking-wider">
                    "The Spanish Iced Latte and Truffle Mushroom Pizza are outstanding. The live kitchen tracker letting you know when your food is being prepared is genius!"
                  </p>
                  <div className="flex items-center gap-3.5 pt-6 mt-6 border-t border-[#F4EFE6]">
                    <div className="w-10 h-10 rounded-full bg-[#FAF8F3] border border-[#C9A84E]/30 flex items-center justify-center font-bold text-[#3E4B2F] text-xs">A</div>
                    <div>
                      <h5 className="font-serif font-bold uppercase tracking-wider text-xs text-[#26301C]">Aman Shah</h5>
                      <span className="text-[10px] text-[#C9A84E] font-bold tracking-widest">★★★★★</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ================= CONTACT SECTION ================= */}
          <section ref={contactRef} className="scroll-mt-24 py-24 bg-white border-t border-[#C9A84E]/20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="bg-white text-[#26301C] rounded-3xl p-8 sm:p-12 border border-[#C9A84E]/30 shadow-xl shadow-[#3E4B2F]/5 relative overflow-hidden">
                <div className="absolute -top-12 -right-12 w-64 h-64 bg-[#C9A84E]/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-[#3E4B2F]/10 rounded-full blur-3xl" />

                <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-12 items-center">
                  <div className="md:col-span-7 space-y-6">
                    <span className="text-[10px] font-bold text-[#3E4B2F] uppercase tracking-widest bg-[#FAF8F3] border border-[#C9A84E]/40 px-3.5 py-1.5 rounded-full inline-block">
                      Delish Cafe Location & Hours
                    </span>
                    <h3 className="text-4xl font-serif font-bold uppercase tracking-tight text-[#26301C]">
                      Drop By Or Connect With Us
                    </h3>
                    <p className="text-xs text-[#52633E] uppercase tracking-wider font-semibold leading-relaxed">
                      Planning a private party, corporate coffee meetup, or have questions regarding our menu? Our team is always ready to assist.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2 text-xs uppercase tracking-widest font-bold text-[#3E4B2F]">
                      <div className="flex items-center gap-3">
                        <MapPin className="w-5 h-5 text-[#C9A84E] shrink-0" />
                        <span>Sindhu Bhavan Marg, Bodakdev, Ahmedabad, Gujarat</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Phone className="w-5 h-5 text-[#C9A84E] shrink-0" />
                        <span>+91 98765 43210</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Mail className="w-5 h-5 text-[#C9A84E] shrink-0" />
                        <span>contact@delishcafe.in</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Clock className="w-5 h-5 text-[#C9A84E] shrink-0" />
                        <span>8:00 AM – 11:30 PM (Everyday)</span>
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-5 bg-[#FAF8F3] p-6 rounded-2xl border border-[#C9A84E]/30 space-y-4">
                    <h5 className="font-serif font-bold uppercase tracking-widest text-xs text-[#3E4B2F]">Delish Cafe Club</h5>
                    <p className="text-[10px] text-[#52633E] leading-relaxed font-bold uppercase tracking-wider">
                      Subscribe to receive weekly member perks, complimentary brew passes, and chef's special invites!
                    </p>
                    <input
                      type="email"
                      placeholder="Enter your email"
                      className="w-full px-4 py-3 bg-white border border-[#C9A84E]/30 rounded-xl focus:outline-none focus:border-[#3E4B2F] text-xs text-[#26301C] font-bold uppercase tracking-wider"
                    />
                    <button
                      onClick={() => showToast("Subscribed to Delish Club perks successfully!")}
                      className="w-full bg-[#3E4B2F] hover:bg-[#323E25] text-white font-bold uppercase tracking-widest py-3 rounded-xl text-[10px] transition-all cursor-pointer shadow-sm border border-[#C9A84E]/30"
                    >
                      Join Delish Club
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </>
      ) : (
        // ================= OWNER DASHBOARD =================
        <section className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 bg-[#FAF8F3]">
          {/* Dashboard Header Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white border border-[#C9A84E]/25 p-6 rounded-2xl shadow-md shadow-[#3E4B2F]/5">
              <span className="text-[10px] text-[#52633E] uppercase font-bold tracking-widest block">Active Kitchen Orders</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-4xl font-serif font-black italic text-[#26301C]">{pendingOrdersCount}</span>
                <span className="text-[10px] text-[#C9A84E] uppercase font-bold tracking-wider">In kitchen queue</span>
              </div>
            </div>
            <div className="bg-white border border-[#C9A84E]/25 p-6 rounded-2xl shadow-md shadow-[#3E4B2F]/5">
              <span className="text-[10px] text-[#52633E] uppercase font-bold tracking-widest block">Confirmed Tables Booked</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-4xl font-serif font-black italic text-[#26301C]">{activeReservationsCount}</span>
                <span className="text-[10px] text-[#3E4B2F] uppercase font-bold tracking-wider">Slots booked</span>
              </div>
            </div>
            <div className="bg-white border border-[#C9A84E]/25 p-6 rounded-2xl shadow-md shadow-[#3E4B2F]/5">
              <span className="text-[10px] text-[#52633E] uppercase font-bold tracking-widest block">Table Capacity Limit</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-4xl font-serif font-black italic text-[#26301C]">{TOTAL_TABLES}</span>
                <span className="text-[10px] text-[#52633E] uppercase font-bold tracking-wider">Cafe Tables</span>
              </div>
            </div>
            <div className="bg-white border border-[#C9A84E]/25 p-6 rounded-2xl shadow-md shadow-[#3E4B2F]/5">
              <span className="text-[10px] text-[#52633E] uppercase font-bold tracking-widest block">Gross Cafe Revenue</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-4xl font-serif font-black italic text-[#3E4B2F]">
                  ₹{allOrders.filter((o) => o.status === "Completed").reduce((s, o) => s + o.total, 0)}
                </span>
                <span className="text-[9px] uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-1.5 py-0.5 rounded-md tracking-widest">Realized</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Live orders log (Col-span 8) */}
            <div className="lg:col-span-8 bg-white border border-[#C9A84E]/25 rounded-3xl p-6 sm:p-8 shadow-md shadow-[#3E4B2F]/5 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#F4EFE6] pb-5">
                <div>
                  <h3 className="text-xl font-serif font-bold uppercase tracking-wider text-[#26301C] flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-[#C9A84E]" />
                    Delish Kitchen Pipeline
                  </h3>
                  <p className="text-xs text-[#52633E] uppercase tracking-wider mt-1 font-semibold">Live cafe customer orders mapped in real time. Advance dish stages as chefs prepare.</p>
                </div>
                <button
                  onClick={fetchOrdersAndReservations}
                  className="bg-[#3E4B2F] hover:bg-[#323E25] text-white font-bold uppercase tracking-widest text-xs px-4.5 py-2.5 rounded-xl transition-all self-start sm:self-auto cursor-pointer shadow-sm border border-[#C9A84E]/30"
                >
                  Sync Live Queue
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {allOrders.length === 0 ? (
                  <div className="sm:col-span-2 text-center py-16 border-2 border-dashed border-[#C9A84E]/30 rounded-2xl bg-[#FAF8F3]">
                    <Utensils className="w-10 h-10 text-stone-300 mx-auto mb-2" />
                    <span className="block text-[#52633E] uppercase font-bold tracking-widest text-xs">No active cafe orders logged yet.</span>
                  </div>
                ) : (
                  allOrders.map((order) => {
                    const isCompleted = order.status === "Completed";
                    return (
                      <div
                        key={order.id}
                        className={`border rounded-2xl p-5 flex flex-col justify-between shadow-sm transition-all duration-300 ${
                          isCompleted
                            ? "bg-[#FAF8F3]/50 border-stone-200 opacity-60"
                            : "bg-[#FAF8F3] border-[#C9A84E]/30 hover:border-[#3E4B2F]"
                        }`}
                      >
                        <div className="space-y-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <span className={`inline-block px-2.5 py-1 rounded-md text-[9px] font-bold tracking-widest uppercase mb-1.5 ${
                                order.orderType === "delivery"
                                  ? "bg-amber-50 text-amber-800 border border-amber-200"
                                  : "bg-white text-[#3E4B2F] border border-[#C9A84E]/40"
                              }`}>
                                {order.orderType === "delivery" ? "🚀 Delivery" : `🪑 Table ${order.tableNumber}`}
                              </span>
                              <h4 className="text-xs font-bold uppercase tracking-wider text-[#26301C] font-mono">{order.id}</h4>
                              <span className="block text-[9px] text-[#52633E] uppercase tracking-widest mt-0.5">{order.createdAt}</span>
                            </div>
                            <span className={`px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest ${
                              order.status === "Completed"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : order.status === "Ready"
                                ? "bg-teal-50 text-teal-700 border border-teal-200 animate-pulse"
                                : order.status === "Preparing"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-white text-stone-700 border border-stone-200"
                            }`}>
                              {order.status}
                            </span>
                          </div>

                          {/* Order items list */}
                          <div className="bg-white p-3 rounded-xl border border-[#C9A84E]/20 text-xs text-stone-700 space-y-1.5">
                            {order.items.map((it, idx) => (
                              <p key={idx} className="flex justify-between font-bold uppercase tracking-wider text-[10px]">
                                <span className="text-[#26301C]">
                                  {it.name} <span className="text-[9px] text-[#52633E] font-bold">×{it.quantity}</span>
                                </span>
                                <span className="text-[#26301C] font-mono">₹{it.price * it.quantity}</span>
                              </p>
                            ))}
                            {order.orderType === "delivery" && order.deliveryAddress && (
                              <div className="pt-2 border-t border-stone-100 mt-2">
                                <span className="text-[9px] uppercase text-amber-800 font-bold tracking-widest block">Delivery Address:</span>
                                <p className="text-[10px] text-[#52633E] font-semibold uppercase tracking-wider leading-normal mt-0.5">{order.deliveryAddress}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="pt-4 border-t border-[#C9A84E]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-5">
                          <span className="text-lg font-serif font-bold text-[#26301C]">Total: ₹{order.total}</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setSelectedBillOrder(order)}
                              className="bg-white hover:bg-[#FAF8F3] text-[#3E4B2F] border border-[#C9A84E]/30 font-bold uppercase tracking-widest text-[9px] px-3 py-2 rounded-xl transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-1 shadow-sm"
                              title="Generate Invoice & Print"
                            >
                              <Receipt className="w-3.5 h-3.5 text-[#C9A84E]" />
                              Bill
                            </button>
                            {!isCompleted ? (
                              <button
                                onClick={() => advanceOrderStatus(order.id, order.status)}
                                className="bg-[#3E4B2F] hover:bg-[#323E25] text-white font-bold uppercase tracking-widest text-[9px] px-3.5 py-2 rounded-xl transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-sm border border-[#C9A84E]/30"
                              >
                                {order.status === "Ready" ? "Mark Complete" : "Advance Status"}
                              </button>
                            ) : (
                              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 flex items-center gap-1">
                                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                                Settled
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Live Reservations Log (Col-span 4) */}
            <div className="lg:col-span-4 bg-white text-[#26301C] rounded-3xl p-6 shadow-md shadow-[#3E4B2F]/5 border border-[#C9A84E]/25 space-y-6">
              <div>
                <h3 className="text-lg font-serif font-bold uppercase tracking-wider text-[#3E4B2F] flex items-center gap-2">
                  <Clock className="w-5 h-5 text-[#C9A84E]" />
                  Delish Table Reservations
                </h3>
                <p className="text-xs text-[#52633E] uppercase tracking-wider mt-1 font-bold">Confirmed table bookings scheduled for service.</p>
              </div>

              <div className="space-y-4 max-h-[460px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-[#ECE4D4] scrollbar-track-transparent">
                {allReservations.filter((r) => r.status === "confirmed").length === 0 ? (
                  <div className="text-center py-12 border border-[#C9A84E]/20 rounded-2xl bg-[#FAF8F3]">
                    <Users className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                    <span className="block text-xs text-[#52633E] font-bold uppercase tracking-widest">No table bookings active.</span>
                  </div>
                ) : (
                  allReservations
                    .filter((r) => r.status === "confirmed")
                    .map((r) => (
                      <div
                        key={r.id}
                        className="bg-[#FAF8F3] border border-[#C9A84E]/25 rounded-2xl p-4.5 space-y-3.5 hover:border-[#3E4B2F] transition-all shadow-sm"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[9px] text-[#3E4B2F] uppercase font-bold tracking-widest block font-mono">
                              Table {r.table}
                            </span>
                            <span className="text-sm font-serif font-bold uppercase block mt-0.5 text-[#26301C]">{r.name}</span>
                          </div>
                          <span className="text-[9px] font-bold uppercase tracking-widest bg-white text-[#3E4B2F] border border-[#C9A84E]/30 px-2 py-1 rounded-md shadow-sm">
                            {r.guests} Guests
                          </span>
                        </div>

                        <div className="text-[10px] text-[#52633E] space-y-1 uppercase tracking-wider bg-white p-2.5 rounded-xl border border-[#C9A84E]/20 font-semibold">
                          <p className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5 text-[#C9A84E]" /> {r.date}</p>
                          <p className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-[#C9A84E]" /> {r.time}</p>
                          <p className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-[#C9A84E]" /> {r.phone}</p>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>

          {/* Table QR Code Generator - Directly built-in for extreme value */}
          <div className="bg-white border border-[#C9A84E]/25 rounded-3xl p-6 sm:p-8 shadow-md shadow-[#3E4B2F]/5 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#F4EFE6] pb-5">
              <div>
                <h3 className="text-xl font-serif font-bold uppercase tracking-wider text-[#26301C] flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-[#C9A84E]" />
                  Delish Cafe QR Code Generator
                </h3>
                <p className="text-xs text-[#52633E] uppercase tracking-wider mt-1 font-semibold">
                  Print these QR codes and place on cafe tables. Scanning instantly loads Delish Cafe with that specific table locked in!
                </p>
              </div>
              <button
                onClick={() => window.print()}
                className="bg-[#3E4B2F] hover:bg-[#323E25] text-white font-bold uppercase tracking-widest text-xs px-5 py-3 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 self-start sm:self-auto border border-[#C9A84E]/30"
              >
                <Printer className="w-4 h-4" />
                Print QR Sheets
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
              {Array.from({ length: TOTAL_TABLES }, (_, i) => {
                const num = i + 1;
                const baseHref = typeof window !== "undefined" ? window.location.origin : "";
                const tableUrl = `${baseHref}/?table=${num}`;
                const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(tableUrl)}`;

                return (
                  <div
                    key={num}
                    className="border border-[#C9A84E]/25 rounded-2xl p-4 text-center bg-[#FAF8F3] space-y-3.5 flex flex-col items-center justify-between shadow-sm hover:border-[#3E4B2F] transition-all"
                  >
                    <div className="flex items-center justify-between w-full">
                      <h4 className="font-serif font-bold uppercase tracking-wider text-[#26301C] text-xs">Table {num}</h4>
                      <DelishLogo className="w-6 h-6" />
                    </div>
                    <div className="w-28 h-28 bg-white p-2 rounded-xl border border-[#C9A84E]/30 shadow-inner">
                      <img src={qrImg} alt={`QR Table ${num}`} className="w-full h-full object-contain" />
                    </div>
                    <div className="space-y-1 w-full">
                      <span className="block text-[8px] text-[#52633E] font-bold truncate tracking-tight">{tableUrl}</span>
                      <a
                        href={tableUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block text-[9px] text-[#3E4B2F] hover:text-[#26301C] font-bold uppercase tracking-widest underline cursor-pointer"
                      >
                        Launch Direct &rarr;
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}
      </div>

      {/* ================= FOOTER ================= */}
      <footer className="bg-[#26301C] text-[#FAF8F3] border-t border-[#C9A84E]/30 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <DelishLogo className="w-10 h-10 border border-[#C9A84E]/50 shadow-sm" />
              <span className="text-xl font-serif font-bold tracking-tight text-[#FAF8F3]">
                Delish <span className="text-[#C9A84E] italic">Cafe</span>
              </span>
            </div>
            <p className="text-xs text-[#FAF8F3]/70 leading-relaxed font-sans">
              Ahmedabad's premier 100% Pure Vegetarian artisan cafe, specialty roastery & Italian sourdough kitchen. Contactless digital dining powered by SmartMenu.
            </p>
            <div className="inline-flex items-center gap-2 bg-[#3E4B2F] px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase text-[#C9A84E] border border-[#C9A84E]/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              100% Pure Veg Certified
            </div>
          </div>

          <div className="space-y-3">
            <h5 className="font-serif font-bold text-xs uppercase tracking-widest text-[#C9A84E]">Opening Hours</h5>
            <div className="text-xs text-[#FAF8F3]/70 space-y-1.5 font-medium">
              <p>Monday - Friday: 8:00 AM - 11:30 PM</p>
              <p>Saturday - Sunday: 8:00 AM - Midnight</p>
              <p className="text-[#C9A84E] font-bold">&bull; Kitchen takes final orders at 11:00 PM</p>
            </div>
          </div>

          <div className="space-y-3">
            <h5 className="font-serif font-bold text-xs uppercase tracking-widest text-[#C9A84E]">Our Signatures</h5>
            <div className="text-xs text-[#FAF8F3]/70 space-y-1.5 font-semibold">
              <p className="hover:text-[#C9A84E] transition-colors cursor-pointer" onClick={() => handleScrollTo(menuRef)}>Specialty Espresso & Lattes</p>
              <p className="hover:text-[#C9A84E] transition-colors cursor-pointer" onClick={() => handleScrollTo(menuRef)}>Artisan Sourdough Pizzas</p>
              <p className="hover:text-[#C9A84E] transition-colors cursor-pointer" onClick={() => handleScrollTo(menuRef)}>Handmade Creamy Pastas</p>
              <p className="hover:text-[#C9A84E] transition-colors cursor-pointer" onClick={() => handleScrollTo(menuRef)}>Lotus Biscoff Thick Shakes</p>
            </div>
          </div>

          <div className="space-y-3">
            <h5 className="font-serif font-bold text-xs uppercase tracking-widest text-[#C9A84E]">SmartMenu Tech</h5>
            <div className="text-xs text-[#FAF8F3]/70 space-y-1.5 font-medium leading-relaxed">
              <p>&bull; Contactless Table QR Ordering</p>
              <p>&bull; Live Slot Availability Checker</p>
              <p>&bull; Kitchen Status Pipeline</p>
              <p>&bull; Instant Digital Bill / Invoice</p>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 mt-10 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between text-xs text-[#FAF8F3]/50 gap-4">
          <p>&copy; 2026 Delish Cafe &bull; Powered by SmartMenu Digital Ordering Platform.</p>
          <div className="flex gap-6 items-center">
            <a href="https://wa.me/919876543210" target="_blank" rel="noreferrer" className="hover:text-emerald-400 transition-colors font-semibold">WhatsApp Desk</a>
            <span>&bull;</span>
            <span className="hover:text-[#C9A84E] transition-colors font-semibold cursor-pointer" onClick={() => setShowAdminLogin(true)}>Owner Portal</span>
          </div>
        </div>
      </footer>

      {/* ================= WHATSAPP FLOATING BUBBLE ================= */}
      <a
        href="https://wa.me/919876543210"
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-6 right-6 w-14 h-14 bg-[#25D366] text-white rounded-full flex items-center justify-center text-3xl shadow-2xl hover:scale-110 active:scale-95 transition-all z-35 group"
        title="Chat on WhatsApp"
      >
        <span className="absolute right-16 bg-[#26301C] text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-md opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap border border-[#C9A84E]/40">
          Delish Cafe WhatsApp Desk
        </span>
        <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white">
          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.66.986 3.296 1.481 4.964 1.483 5.482 0 9.943-4.437 9.946-9.897.002-2.643-1.026-5.131-2.898-7.005-1.871-1.872-4.364-2.9-7.01-2.902-5.485 0-9.945 4.438-9.948 9.9.001 1.768.486 3.49 1.4 5.013l-.995 3.637 3.74-.982z" />
        </svg>
      </a>
      <AnimatePresence>
        {isYourOrdersOpen && (
          <div className="fixed inset-0 z-50 flex justify-end bg-[#26301C]/80 backdrop-blur-sm">
            {/* Backdrop closer */}
            <div className="absolute inset-0 cursor-pointer" onClick={() => setIsYourOrdersOpen(false)} />

            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.3 }}
              className="relative w-full max-w-md bg-white text-[#26301C] h-full shadow-2xl flex flex-col justify-between border-l border-[#C9A84E]/30"
            >
              <div className="p-6 border-b border-[#F4EFE6] flex items-center justify-between bg-[#FAF8F3]">
                <div className="flex items-center gap-2.5">
                  <Receipt className="w-5 h-5 text-[#C9A84E]" />
                  <h3 className="font-serif font-bold uppercase tracking-wider text-[#26301C] text-base">Your Cafe Orders</h3>
                </div>
                <button
                  onClick={() => setIsYourOrdersOpen(false)}
                  className="w-8 h-8 rounded-full bg-white hover:bg-[#FAF8F3] text-[#52633E] hover:text-[#26301C] flex items-center justify-center border border-[#C9A84E]/30 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Orders List */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin scrollbar-thumb-[#ECE4D4] scrollbar-track-transparent bg-white">
                {allOrders.filter((o) => userOrderIds.includes(o.id)).length === 0 ? (
                  <div className="text-center py-24 space-y-3">
                    <div className="w-12 h-12 rounded-full bg-[#FAF8F3] border border-[#C9A84E]/30 text-[#C9A84E] flex items-center justify-center mx-auto">
                      <Receipt className="w-6 h-6" />
                    </div>
                    <h5 className="font-serif font-bold uppercase tracking-wider text-[#26301C]">No Active Orders</h5>
                    <p className="text-xs text-[#52633E] max-w-xs mx-auto uppercase tracking-wider leading-relaxed font-semibold">
                      Your placed orders will show up here, even after refreshing the page!
                    </p>
                  </div>
                ) : (
                  allOrders
                    .filter((o) => userOrderIds.includes(o.id))
                    .map((order) => {
                      const isCompleted = order.status === "Completed";
                      return (
                        <div
                          key={order.id}
                          className={`bg-[#FAF8F3] border rounded-2xl p-4.5 space-y-3.5 shadow-sm transition-all duration-300 ${
                            isCompleted ? "border-stone-200 opacity-80" : "border-[#C9A84E]/40 hover:border-[#3E4B2F]"
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <span className={`inline-block px-2.5 py-0.5 rounded-md text-[9px] font-bold tracking-widest uppercase mb-1.5 ${
                                order.orderType === "delivery"
                                  ? "bg-amber-50 text-amber-800 border border-amber-200"
                                  : "bg-white text-[#3E4B2F] border border-[#C9A84E]/40"
                              }`}>
                                {order.orderType === "delivery" ? "🚀 Delivery" : `🪑 Table ${order.tableNumber}`}
                              </span>
                              <h4 className="text-xs font-bold uppercase tracking-wider text-[#26301C] font-mono">{order.id}</h4>
                              <span className="block text-[8px] text-[#52633E] uppercase tracking-widest mt-0.5">{order.createdAt}</span>
                            </div>
                            <span className={`px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest ${
                              order.status === "Completed"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : order.status === "Ready"
                                ? "bg-teal-50 text-teal-700 border border-teal-200 animate-pulse"
                                : order.status === "Preparing"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-white text-stone-700 border border-stone-200"
                            }`}>
                              {order.status}
                            </span>
                          </div>

                          {/* Items and Subtotal */}
                          <div className="bg-white p-3 rounded-xl border border-[#C9A84E]/20 text-xs text-stone-700 space-y-1.5">
                            {order.items.map((it, idx) => (
                              <p key={idx} className="flex justify-between font-bold uppercase tracking-wider text-[10px]">
                                <span className="text-[#26301C]">
                                  {it.name} <span className="text-[9px] text-[#52633E] font-bold">×{it.quantity}</span>
                                </span>
                                <span className="text-[#26301C] font-mono">₹{it.price * it.quantity}</span>
                              </p>
                            ))}
                          </div>

                          <div className="flex items-center justify-between pt-2.5 border-t border-[#C9A84E]/20 mt-2.5">
                            <span className="text-sm font-serif font-bold text-[#26301C]">Total: ₹{order.total}</span>
                            <button
                              onClick={() => setSelectedBillOrder(order)}
                              className="bg-white hover:bg-[#FAF8F3] text-[#3E4B2F] border border-[#C9A84E]/30 font-bold uppercase tracking-widest text-[9px] px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 shadow-sm"
                            >
                              <Receipt className="w-3.5 h-3.5 text-[#C9A84E]" /> View Bill
                            </button>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>

              {/* Footer inside drawer */}
              <div className="p-6 bg-[#FAF8F3] border-t border-[#C9A84E]/20 text-center">
                <p className="text-[9px] uppercase tracking-widest text-[#52633E] font-bold">Delish Cafe &bull; SmartMenu Kitchen Engine</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCartOpen && (
          <div className="fixed inset-0 z-50 flex justify-end bg-[#26301C]/80 backdrop-blur-sm">
            {/* Backdrop closer */}
            <div className="absolute inset-0 cursor-pointer" onClick={() => setIsCartOpen(false)} />

            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.3 }}
              className="relative w-full max-w-md bg-white text-[#26301C] h-full shadow-2xl flex flex-col justify-between border-l border-[#C9A84E]/30"
            >
              <div className="p-6 border-b border-[#F4EFE6] flex items-center justify-between bg-[#FAF8F3]">
                <div className="flex items-center gap-2.5">
                  <ShoppingCart className="w-5 h-5 text-[#C9A84E]" />
                  <h3 className="font-serif font-bold uppercase tracking-wider text-[#26301C] text-base">Your Delish Tray</h3>
                </div>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="w-8 h-8 rounded-full bg-white hover:bg-[#FAF8F3] text-[#52633E] hover:text-[#26301C] flex items-center justify-center border border-[#C9A84E]/30 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Items List */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin scrollbar-thumb-[#ECE4D4] scrollbar-track-transparent bg-white">
                {cart.length === 0 ? (
                  <div className="text-center py-24 space-y-3">
                    <div className="w-12 h-12 rounded-full bg-[#FAF8F3] border border-[#C9A84E]/30 text-[#C9A84E] flex items-center justify-center mx-auto">
                      <ShoppingCart className="w-6 h-6" />
                    </div>
                    <h5 className="font-serif font-bold uppercase tracking-wider text-[#26301C]">Your Tray is Empty</h5>
                    <p className="text-xs text-[#52633E] max-w-xs mx-auto uppercase tracking-wider font-semibold">Browse our coffees, artisan pizzas, pastas & shakes above to add items!</p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div
                      key={item.name}
                      className="bg-[#FAF8F3] border border-[#C9A84E]/25 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm hover:border-[#3E4B2F] transition-all"
                    >
                      <div className="flex-1">
                        <h4 className="font-serif font-bold text-xs text-[#26301C] uppercase tracking-wider">{item.name}</h4>
                        <p className="text-[9px] text-[#52633E] uppercase tracking-widest mt-0.5">₹{item.price} per item</p>
                        <p className="text-xs font-bold text-[#3E4B2F] uppercase tracking-widest mt-1.5 font-mono">Subtotal: ₹{item.price * item.quantity}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => updateCartQty(item.name, -1)}
                          className="w-7 h-7 rounded-lg bg-white border border-[#C9A84E]/30 hover:border-[#3E4B2F] flex items-center justify-center text-[#26301C] font-bold text-xs transition-colors cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="font-bold text-xs text-[#26301C] w-5 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateCartQty(item.name, 1)}
                          className="w-7 h-7 rounded-lg bg-white border border-[#C9A84E]/30 hover:border-[#3E4B2F] flex items-center justify-center text-[#26301C] font-bold text-xs transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => removeFromCart(item.name)}
                          className="text-[#52633E] hover:text-rose-600 transition-colors p-1 cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Checkout details */}
              <div className="p-6 bg-[#FAF8F3] border-t border-[#C9A84E]/25 space-y-4">
                <div className="flex items-center justify-between font-bold uppercase tracking-wider text-[#26301C]">
                  <span className="font-serif text-sm">Grand Total Amount</span>
                  <span className="text-2xl text-[#3E4B2F] font-serif font-black italic">₹{cartTotal}</span>
                </div>
                {orderType === "dine_in" && activeTableLabel && (
                  <div className="p-2.5 bg-white text-[#3E4B2F] text-[10px] rounded-lg border border-[#C9A84E]/30 font-bold uppercase tracking-wider text-center">
                    Dining at Table <span className="font-bold italic text-sm text-[#C9A84E]">{activeTableLabel}</span>
                  </div>
                )}
                {orderType === "delivery" && deliveryAddress.trim() && (
                  <div className="p-2.5 bg-white text-amber-900 text-[9px] rounded-lg border border-amber-200 font-bold uppercase tracking-wider truncate">
                    Deliver to: <span className="text-[#52633E]">{deliveryAddress}</span>
                  </div>
                )}
                <button
                  onClick={handlePlaceOrderClick}
                  disabled={cart.length === 0}
                  className="w-full bg-[#3E4B2F] hover:bg-[#323E25] disabled:opacity-40 text-white font-bold py-4 rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99] text-xs cursor-pointer shadow-md flex items-center justify-center gap-2 uppercase tracking-widest border border-[#C9A84E]/30"
                >
                  Place Cafe Order
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= ORDER SUMMARY MODAL ================= */}
      <AnimatePresence>
        {showSummaryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#26301C]/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white text-[#26301C] w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#C9A84E]/30 relative"
            >
              <button
                onClick={() => setShowSummaryModal(false)}
                className="absolute top-6 right-6 w-9 h-9 rounded-full bg-[#FAF8F3] flex items-center justify-center text-[#52633E] hover:text-[#26301C] border border-[#C9A84E]/20 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="mb-6">
                <h2 className="text-2xl font-serif font-bold uppercase tracking-tight text-[#26301C]">Order Summary</h2>
                <p className="text-xs text-[#52633E] uppercase tracking-wider mt-1 font-semibold">Please review your Delish Cafe items and dining option.</p>
              </div>

              <div className="bg-[#FAF8F3] rounded-2xl p-4.5 border border-[#C9A84E]/25 space-y-4 max-h-[250px] overflow-y-auto">
                <div className="flex justify-between items-center text-xs pb-3 border-b border-[#C9A84E]/20 font-bold uppercase tracking-wider">
                  <span className="text-[#52633E]">Dining Preference</span>
                  <span className="text-[#3E4B2F] font-bold tracking-widest">
                    {orderType === "delivery" ? "🏠 Home Delivery" : `🪑 Table ${activeTableLabel}`}
                  </span>
                </div>

                {orderType === "delivery" && (
                  <div className="text-xs pb-3 border-b border-[#C9A84E]/20 font-bold uppercase tracking-wider">
                    <span className="text-[#52633E] block mb-0.5 tracking-widest text-[9px]">Delivery Address</span>
                    <p className="text-[#26301C] leading-normal font-bold">{deliveryAddress}</p>
                  </div>
                )}

                <div className="space-y-3">
                  <span className="text-[#52633E] block uppercase tracking-widest text-[9px] font-bold">Selected Dishes</span>
                  {cart.map((item) => (
                    <div key={item.name} className="flex justify-between items-center text-xs uppercase tracking-wider font-bold">
                      <span className="text-[#26301C] font-semibold">
                        {item.name} <span className="text-[#52633E] text-[9px] font-bold">×{item.quantity}</span>
                      </span>
                      <span className="font-bold text-[#26301C] font-mono">₹{item.price * item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-6 border-t border-[#C9A84E]/25 mt-6 flex items-center justify-between">
                <div>
                  <span className="block text-[9px] text-[#52633E] uppercase font-bold tracking-widest">Total Payable</span>
                  <span className="text-3xl font-serif font-black italic text-[#3E4B2F]">₹{cartTotal}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowSummaryModal(false); setIsCartOpen(true); }}
                    className="bg-[#FAF8F3] hover:bg-stone-100 text-[#26301C] border border-[#C9A84E]/30 px-4.5 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all cursor-pointer"
                  >
                    Edit Cart
                  </button>
                  <button
                    onClick={proceedToPayment}
                    className="bg-[#3E4B2F] hover:bg-[#323E25] text-white px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all cursor-pointer shadow-md border border-[#C9A84E]/30"
                  >
                    Proceed to Pay
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= PAYMENT OPTIONS MODAL ================= */}
      <AnimatePresence>
        {showPaymentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#26301C]/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white text-[#26301C] w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#C9A84E]/30 relative"
            >
              <button
                onClick={() => setShowPaymentModal(false)}
                className="absolute top-6 right-6 w-9 h-9 rounded-full bg-[#FAF8F3] flex items-center justify-center text-[#52633E] hover:text-[#26301C] border border-[#C9A84E]/20 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="mb-6">
                <h2 className="text-2xl font-serif font-bold uppercase tracking-tight text-[#26301C]">Select Payment Method</h2>
                <p className="text-xs text-[#52633E] uppercase tracking-wider mt-1 font-semibold">UPI, Credit/Debit Card, Net Banking, and Pay at Counter are available.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setSelectedPaymentMethod("upi")}
                  className={`p-4.5 rounded-2xl border text-center flex flex-col items-center justify-center gap-2 transition-all cursor-pointer uppercase tracking-widest ${
                    selectedPaymentMethod === "upi"
                      ? "bg-[#FAF8F3] border-[#3E4B2F] text-[#3E4B2F] font-bold shadow-sm"
                      : "bg-[#FAF8F3]/50 border-stone-200 hover:border-[#C9A84E] text-[#52633E]"
                  }`}
                >
                  <span className="text-2xl">📱</span>
                  <span className="text-[10px] font-bold">BHIM / UPI</span>
                </button>
                <button
                  onClick={() => setSelectedPaymentMethod("card")}
                  className={`p-4.5 rounded-2xl border text-center flex flex-col items-center justify-center gap-2 transition-all cursor-pointer uppercase tracking-widest ${
                    selectedPaymentMethod === "card"
                      ? "bg-[#FAF8F3] border-[#3E4B2F] text-[#3E4B2F] font-bold shadow-sm"
                      : "bg-[#FAF8F3]/50 border-stone-200 hover:border-[#C9A84E] text-[#52633E]"
                  }`}
                >
                  <span className="text-2xl">💳</span>
                  <span className="text-[10px] font-bold">Credit/Debit Card</span>
                </button>
                <button
                  onClick={() => setSelectedPaymentMethod("netbanking")}
                  className={`p-4.5 rounded-2xl border text-center flex flex-col items-center justify-center gap-2 transition-all cursor-pointer uppercase tracking-widest ${
                    selectedPaymentMethod === "netbanking"
                      ? "bg-[#FAF8F3] border-[#3E4B2F] text-[#3E4B2F] font-bold shadow-sm"
                      : "bg-[#FAF8F3]/50 border-stone-200 hover:border-[#C9A84E] text-[#52633E]"
                  }`}
                >
                  <span className="text-2xl">🏦</span>
                  <span className="text-[10px] font-bold">Net Banking</span>
                </button>
                <button
                  onClick={() => setSelectedPaymentMethod("pay_at_counter")}
                  className={`p-4.5 rounded-2xl border text-center flex flex-col items-center justify-center gap-2 transition-all cursor-pointer uppercase tracking-widest ${
                    selectedPaymentMethod === "pay_at_counter"
                      ? "bg-[#FAF8F3] border-[#3E4B2F] text-[#3E4B2F] font-bold shadow-sm"
                      : "bg-[#FAF8F3]/50 border-stone-200 hover:border-[#C9A84E] text-[#52633E]"
                  }`}
                >
                  <span className="text-2xl">💰</span>
                  <span className="text-[10px] font-bold">Pay at Counter</span>
                </button>
              </div>

              <div className="bg-[#FAF8F3] border border-[#C9A84E]/30 p-4 rounded-2xl mt-6 space-y-1.5 text-[10px] text-[#3E4B2F] font-bold uppercase tracking-wider">
                <p className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-[#C9A84E]" /> Razorpay Secured Checkout Enabled</p>
                <p className="text-[#52633E] text-[9px] font-medium leading-normal normal-case">Integrated checkout flow ready. Confirming will instantly forward your order to Delish Cafe kitchen pipeline.</p>
              </div>

              <div className="flex gap-2 pt-6 mt-6 border-t border-[#C9A84E]/25 justify-end">
                <button
                  onClick={() => { setShowPaymentModal(false); setShowSummaryModal(true); }}
                  className="bg-[#FAF8F3] hover:bg-stone-100 text-[#26301C] border border-[#C9A84E]/30 px-4.5 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all cursor-pointer"
                >
                  Back
                </button>
                <button
                  onClick={handleConfirmOrder}
                  className="bg-[#3E4B2F] hover:bg-[#323E25] text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all cursor-pointer shadow-md border border-[#C9A84E]/30"
                >
                  Confirm & Cook
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= BILL / INVOICE GENERATOR MODAL ================= */}
      <AnimatePresence>
        {selectedBillOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#26301C]/80 backdrop-blur-sm print:hidden">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-[#C9A84E]/30 overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal header with close button */}
              <div className="p-6 border-b border-[#F4EFE6] flex items-center justify-between bg-[#FAF8F3]">
                <div className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-[#C9A84E]" />
                  <h3 className="font-serif font-bold uppercase tracking-wider text-[#26301C] text-sm">Delish Cafe Invoice</h3>
                </div>
                <button
                  onClick={() => setSelectedBillOrder(null)}
                  className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[#52633E] hover:bg-[#FAF8F3] hover:text-[#26301C] border border-[#C9A84E]/30 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Printable Invoice Container */}
              <div className="flex-1 overflow-y-auto p-8 space-y-6" id="printable-bill">
                {/* Brand Header */}
                <div className="text-center pb-6 border-b border-dashed border-[#C9A84E]/40">
                  <DelishLogo className="w-14 h-14 mx-auto mb-2" />
                  <span className="text-3xl font-serif font-black tracking-tight text-[#26301C]">
                    Delish <span className="text-[#C9A84E] italic">Cafe</span>
                  </span>
                  <p className="text-[10px] text-[#3E4B2F] font-bold uppercase tracking-widest mt-1">100% Pure Vegetarian Artisan Cafe & Specialty Roastery</p>
                  <p className="text-[9px] text-[#52633E] uppercase tracking-wider mt-0.5">Sindhu Bhavan Marg, Bodakdev, Ahmedabad, Gujarat</p>
                  <p className="text-[9px] text-[#52633E] uppercase tracking-wider">Phone: +91 98765 43210 &bull; GSTIN: 24AAACS1234F1Z5</p>
                </div>

                {/* Meta details */}
                <div className="grid grid-cols-2 gap-4 text-[10px] uppercase tracking-wider font-semibold text-[#52633E]">
                  <div className="space-y-1">
                    <p><span className="text-stone-400 font-bold">Invoice:</span> <span className="font-mono font-bold text-[#26301C]">{selectedBillOrder.id}</span></p>
                    <p><span className="text-stone-400 font-bold">Date/Time:</span> <span className="text-[#26301C]">{selectedBillOrder.createdAt}</span></p>
                  </div>
                  <div className="space-y-1 text-right">
                    <p><span className="text-stone-400 font-bold">Service:</span> <span className="text-[#26301C] font-bold">{selectedBillOrder.orderType === "delivery" ? "Home Delivery" : `Table ${selectedBillOrder.tableNumber}`}</span></p>
                    <p>
                      <span className="text-stone-400 font-bold">Status:</span>{" "}
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${selectedBillOrder.status === "Completed" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                        {selectedBillOrder.status === "Completed" ? "PAID & SETTLED" : selectedBillOrder.status.toUpperCase()}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Items Table */}
                <div className="border-t border-b border-dashed border-[#C9A84E]/40 py-4">
                  <table className="w-full text-left text-[10px] uppercase tracking-wider font-semibold">
                    <thead>
                      <tr className="text-[#52633E] border-b border-stone-100 pb-2">
                        <th className="py-1">Dishes Item</th>
                        <th className="text-center py-1">Qty</th>
                        <th className="text-right py-1">Rate</th>
                        <th className="text-right py-1">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 text-[#26301C]">
                      {selectedBillOrder.items.map((it, idx) => (
                        <tr key={idx} className="hover:bg-[#FAF8F3]/50">
                          <td className="py-2.5 font-bold">{it.name}</td>
                          <td className="text-center py-2.5 font-mono">{it.quantity}</td>
                          <td className="text-right py-2.5 font-mono">₹{it.price}</td>
                          <td className="text-right py-2.5 font-mono font-bold text-[#26301C]">₹{it.price * it.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Calculations */}
                <div className="space-y-1.5 text-[10px] uppercase tracking-wider text-right font-semibold text-[#52633E]">
                  <p>Subtotal: <span className="font-mono text-[#26301C]">₹{Math.round(selectedBillOrder.total * 0.95)}</span></p>
                  <p>SGST (2.5%): <span className="font-mono text-[#26301C]">₹{Math.round(selectedBillOrder.total * 0.025)}</span></p>
                  <p>CGST (2.5%): <span className="font-mono text-[#26301C]">₹{Math.round(selectedBillOrder.total * 0.025)}</span></p>
                  <div className="border-t border-[#C9A84E]/30 pt-2 mt-2 flex justify-between items-baseline font-bold">
                    <span className="text-[#26301C] text-xs font-serif">Total Bill Amount:</span>
                    <span className="text-[#3E4B2F] text-xl font-bold font-mono">₹{selectedBillOrder.total}</span>
                  </div>
                </div>

                {/* Payment meta details */}
                <div className="bg-[#FAF8F3] border border-[#C9A84E]/20 p-4 rounded-2xl text-[9px] uppercase tracking-widest text-[#52633E] space-y-1">
                  <p><span className="font-bold text-[#26301C]">Payment Mode:</span> {selectedBillOrder.paymentMethod ? selectedBillOrder.paymentMethod.replace("_", " ") : "CASH"}</p>
                  {selectedBillOrder.paymentId && <p><span className="font-bold text-[#26301C]">Txn Ref ID:</span> <span className="font-mono">{selectedBillOrder.paymentId}</span></p>}
                </div>

                {/* Thank You Note */}
                <div className="text-center space-y-1 pt-4">
                  <p className="text-[10px] text-[#26301C] font-bold uppercase tracking-wider font-serif">Thank you for dining with Delish Cafe!</p>
                  <p className="text-[8px] text-[#52633E] uppercase tracking-widest">Powered by SmartMenu Digital Ordering Platform</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-6 border-t border-[#F4EFE6] bg-[#FAF8F3] flex gap-3 justify-end print:hidden">
                <button
                  onClick={() => setSelectedBillOrder(null)}
                  className="bg-white hover:bg-[#FAF8F3] text-[#26301C] border border-[#C9A84E]/30 px-6 py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={handlePrintBill}
                  className="bg-[#3E4B2F] hover:bg-[#323E25] text-white px-6 py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all cursor-pointer flex items-center gap-2 shadow-md hover:scale-105 border border-[#C9A84E]/30"
                >
                  <Printer className="w-4 h-4" />
                  Print Bill
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
