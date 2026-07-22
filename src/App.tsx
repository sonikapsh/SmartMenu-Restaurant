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
  Crown
} from "lucide-react";
import { menuData } from "./menuData";
import { MenuItem, CartItem, Order, Reservation } from "./types";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  query
} from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

// Initialize Firebase Client SDK
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

const OWNER_PASSWORD = "admin123";
const TOTAL_TABLES = 10;
const TIME_SLOTS = [
  "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM",
  "01:00 PM", "01:30 PM", "02:00 PM", "02:30 PM",
  "03:00 PM", "03:30 PM", "05:00 PM", "05:30 PM",
  "06:00 PM", "06:30 PM", "07:00 PM", "07:30 PM",
  "08:00 PM", "08:30 PM", "09:00 PM", "09:30 PM",
  "10:00 PM"
];

const HERO_IMAGES = [
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1600&auto=format&fit=crop&q=80"
];

export default function App() {
  // Navigation & View states
  const [isAdminMode, setIsAdminMode] = useState<boolean>(false);
  const [showAdminLogin, setShowAdminLogin] = useState<boolean>(false);
  const [adminEmail, setAdminEmail] = useState<string>("");
  const [adminPassword, setAdminPassword] = useState<string>("");
  const [adminLoginError, setAdminLoginError] = useState<string>("");
  const [activeCategory, setActiveCategory] = useState<string>("Pizza");

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

  // Lists loaded from Backend
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [allReservations, setAllReservations] = useState<Reservation[]>([]);
  const [toastMessage, setToastMessage] = useState<string>("");
  const [selectedBillOrder, setSelectedBillOrder] = useState<Order | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [userOrderIds, setUserOrderIds] = useState<string[]>([]);
  const [userReservationIds, setUserReservationIds] = useState<string[]>([]);
  const [isYourOrdersOpen, setIsYourOrdersOpen] = useState<boolean>(false);

  // Refs for smooth scrolling
  const menuRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<HTMLDivElement>(null);
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

  // Sync state on mount: table URL check + load from Firestore
  useEffect(() => {
    const savedOrders = localStorage.getItem("smartMenuUserOrders");
    if (savedOrders) {
      try {
        setUserOrderIds(JSON.parse(savedOrders));
      } catch (e) {
        console.error("Error parsing user orders:", e);
      }
    }

    const savedRes = localStorage.getItem("smartMenuUserReservations");
    if (savedRes) {
      try {
        setUserReservationIds(JSON.parse(savedRes));
      } catch (e) {
        console.error("Error parsing user reservations:", e);
      }
    }

    // Check URL table param
    const params = new URLSearchParams(window.location.search);
    const tableParam = params.get("table");
    if (tableParam) {
      const parsedNum = tableParam.replace(/[^0-9]/g, "");
      if (parsedNum) {
        setTableNumber(parsedNum);
        setActiveTableLabel(parsedNum);
        setIsUrlTable(true);
        setOrderType("dine_in");
        localStorage.setItem("smartMenuTable", parsedNum);
      }
    } else {
      const saved = localStorage.getItem("smartMenuTable");
      if (saved) {
        setTableNumber(saved);
        setActiveTableLabel(saved);
      }
    }

    // Set up real-time orders listener
    const qOrders = collection(db, "orders");
    const unsubscribeOrders = onSnapshot(qOrders, (snapshot) => {
      const orders: Order[] = [];
      snapshot.forEach((docSnap) => {
        orders.push({ id: docSnap.id, ...docSnap.data() } as Order);
      });
      // Sort newest first
      orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setAllOrders(orders);
    }, (error) => {
      console.error("Firestore orders subscribe error:", error);
    });

    // Set up real-time reservations listener
    const qReservations = collection(db, "reservations");
    const unsubscribeReservations = onSnapshot(qReservations, (snapshot) => {
      const reservations: Reservation[] = [];
      snapshot.forEach((docSnap) => {
        reservations.push({ id: docSnap.id, ...docSnap.data() } as Reservation);
      });
      // Sort newest first
      reservations.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setAllReservations(reservations);
    }, (error) => {
      console.error("Firestore reservations subscribe error:", error);
    });

    return () => {
      unsubscribeOrders();
      unsubscribeReservations();
    };
  }, []);

  // Update order status if tracked order gets updated in list
  useEffect(() => {
    if (currentOrder && allOrders.length > 0) {
      const match = allOrders.find((o) => o.id === currentOrder.id);
      if (match) {
        setCurrentOrder(match);
      }
    }
  }, [allOrders, currentOrder]);

  // Restore the last active (non-Completed) order on page refresh/mount
  useEffect(() => {
    if (userOrderIds.length > 0 && allOrders.length > 0 && !currentOrder) {
      const userOrders = allOrders.filter((o) => userOrderIds.includes(o.id));
      if (userOrders.length > 0) {
        const activeOrder = userOrders.find((o) => o.status !== "Completed");
        if (activeOrder) {
          setCurrentOrder(activeOrder);
        }
      }
    }
  }, [allOrders, userOrderIds, currentOrder]);

  const fetchOrdersAndReservations = async () => {
    // Handled dynamically and immediately in real-time by onSnapshot!
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage("");
    }, 2500);
  };

  // Cart operations
  const handleAddToCart = (item: MenuItem) => {
    if (orderType === "dine_in" && !activeTableLabel) {
      showToast("Please enter or scan your Table Number first!");
      if (menuRef.current) {
        menuRef.current.scrollIntoView({ behavior: "smooth" });
      }
      return;
    }

    if (orderType === "delivery" && !deliveryAddress.trim()) {
      showToast("Please enter your delivery address first!");
      return;
    }

    setCart((prev) => {
      const existing = prev.find((c) => c.name === item.name);
      if (existing) {
        return prev.map((c) =>
          c.name === item.name ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { name: item.name, price: item.price, quantity: 1 }];
    });
    showToast(`Added ${item.name} to Cart!`);
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

  // Set table number
  const handleSetTable = () => {
    const trimmed = tableNumber.trim();
    if (!trimmed) {
      showToast("Please enter a valid table number.");
      return;
    }
    setActiveTableLabel(trimmed);
    localStorage.setItem("smartMenuTable", trimmed);
    showToast(`Table ${trimmed} selected successfully!`);
  };

  const handleClearTable = () => {
    setTableNumber("");
    setActiveTableLabel("");
    setIsUrlTable(false);
    localStorage.removeItem("smartMenuTable");
    showToast("Table cleared.");
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
    if (orderType === "dine_in" && !activeTableLabel) {
      showToast("Table number is required!");
      return;
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
    const newOrder = {
      tableNumber: orderType === "dine_in" ? activeTableLabel : "Delivery",
      orderType,
      deliveryAddress: orderType === "delivery" ? deliveryAddress : "",
      items: cart,
      total: cartTotal,
      status: "Received" as const,
      createdAt: new Date().toLocaleString("en-US", { hour12: true }),
      paymentMethod: payMethod,
      paymentId: payId
    };

    try {
      await setDoc(doc(db, "orders", orderId), newOrder);
      setCurrentOrder({ id: orderId, ...newOrder });
      setUserOrderIds((prev) => {
        const updated = [...prev, orderId];
        localStorage.setItem("smartMenuUserOrders", JSON.stringify(updated));
        return updated;
      });
      setCart([]);
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
        name: "SmartMenu Restaurant",
        description: `Order Payment for ${orderType === "dine_in" ? "Table " + activeTableLabel : "Delivery"}`,
        order_id: orderData.simulated ? undefined : orderData.order_id,
        handler: async function (paymentResponse: any) {
          const payId = paymentResponse.razorpay_payment_id || "PAY_SIM_" + Math.random().toString(36).substring(2, 9).toUpperCase();
          showToast("Payment Authorized successfully!");
          await submitOrderToBackend(`Razorpay (${selectedPaymentMethod.toUpperCase()})`, payId);
        },
        prefill: {
          name: "Guest Diner",
          email: "customer@smartmenu.com",
          contact: "9999999999"
        },
        theme: {
          color: "#ea580c" // amber-600
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
    const savedReservation = {
      date: resDate,
      time: resTime,
      table: String(resTable),
      guests: Number(resGuests),
      name: resName,
      phone: resPhone,
      status: "confirmed" as const,
      createdAt: new Date().toLocaleString("en-US", { hour12: true })
    };

    try {
      await setDoc(doc(db, "reservations", resId), savedReservation);
      showToast(editReservationId ? "Reservation Updated!" : "Table Booked Successfully!");
      if (!editReservationId) {
        setUserReservationIds((prev) => {
          const updated = [...prev, resId];
          localStorage.setItem("smartMenuUserReservations", JSON.stringify(updated));
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

  const activeReservationsCount = allReservations.filter((r) => r.status === "confirmed").length;
  const pendingOrdersCount = allOrders.filter((o) => o.status !== "Completed").length;

  return (
    <div className="min-h-screen bg-[#FFF9F0] text-[#252525] font-sans selection:bg-amber-700 selection:text-white overflow-x-hidden">
      {/* Toast alert system */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 bg-[#1E293B] text-[#FAFAFA] px-6 py-3 rounded-full shadow-2xl z-50 flex items-center gap-3 border border-slate-800 max-w-sm"
          >
            <span className="w-2 h-2 rounded-full bg-amber-700 animate-ping"></span>
            <span className="font-bold text-xs uppercase tracking-widest">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= HEADER NAVBAR ================= */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/50 shadow-sm transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center cursor-pointer" onClick={() => { setIsAdminMode(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            <span className="text-3xl font-black tracking-tighter uppercase italic text-slate-900 transition-transform hover:scale-[1.01]">
              Smart<span className="text-amber-700">Menu</span>
            </span>
          </div>

          {/* Nav links (hidden in admin mode) */}
          {!isAdminMode ? (
            <nav className="hidden md:flex items-center gap-4 lg:gap-6 xl:gap-8 font-bold uppercase tracking-widest text-[11px] text-slate-600 flex-nowrap">
              <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="hover:text-amber-700 transition-colors relative py-2 after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:w-0 after:h-[2px] after:bg-amber-700 hover:after:w-full after:transition-all after:duration-300 whitespace-nowrap">Home</button>
              <button onClick={() => handleScrollTo(menuRef)} className="hover:text-amber-700 transition-colors relative py-2 after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:w-0 after:h-[2px] after:bg-amber-700 hover:after:w-full after:transition-all after:duration-300 whitespace-nowrap">Menu</button>
              <button onClick={() => handleScrollTo(bookRef)} className="hover:text-amber-700 transition-colors relative py-2 after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:w-0 after:h-[2px] after:bg-amber-700 hover:after:w-full after:transition-all after:duration-300 whitespace-nowrap">Book Table</button>
              <button onClick={() => handleScrollTo(aboutRef)} className="hover:text-amber-700 transition-colors relative py-2 after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:w-0 after:h-[2px] after:bg-amber-700 hover:after:w-full after:transition-all after:duration-300 whitespace-nowrap">About</button>
              <button onClick={() => handleScrollTo(reviewsRef)} className="hover:text-amber-700 transition-colors relative py-2 after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:w-0 after:h-[2px] after:bg-amber-700 hover:after:w-full after:transition-all after:duration-300 whitespace-nowrap">Reviews</button>
              <button onClick={() => handleScrollTo(contactRef)} className="hover:text-amber-700 transition-colors relative py-2 after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:w-0 after:h-[2px] after:bg-amber-700 hover:after:w-full after:transition-all after:duration-300 whitespace-nowrap">Contact</button>
              <button onClick={() => setIsYourOrdersOpen(true)} className="hover:text-amber-700 transition-colors relative py-2 after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:w-0 after:h-[2px] after:bg-amber-700 hover:after:w-full after:transition-all after:duration-300 whitespace-nowrap">My Orders</button>
            </nav>
          ) : (
            <div className="text-[10px] uppercase border border-amber-700/20 text-amber-800 bg-amber-700/5 font-bold px-3.5 py-1.5 rounded-full tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-700 animate-pulse"></span>
              Owner Dashboard Active
            </div>
          )}

          <div className="flex items-center gap-2 sm:gap-3">
            {isAdminMode ? (
              <button
                onClick={() => setIsAdminMode(false)}
                className="bg-slate-900 hover:bg-slate-800 text-white px-4.5 py-2.5 rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all flex items-center gap-2 shadow-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Customer View
              </button>
            ) : (
              <button
                onClick={() => setShowAdminLogin(true)}
                className="hidden sm:flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100/40 hover:from-amber-100 hover:to-amber-200/40 text-amber-700 border border-amber-200/50 hover:border-amber-300/80 shadow-sm transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
                title="Owner Login"
              >
                <Crown className="w-4.5 h-4.5 text-amber-700 animate-pulse" />
              </button>
            )}

            {!isAdminMode && (
              <button
                onClick={() => setIsCartOpen(true)}
                className="relative bg-amber-700 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-full flex items-center gap-2 hover:bg-amber-800 transition-all font-bold text-[11px] tracking-wider uppercase cursor-pointer shadow-lg shadow-amber-700/15"
              >
                <ShoppingCart className="w-3.5 h-3.5 text-white" />
                <span className="font-bold text-[11px] sm:inline hidden">Cart</span>
                {cartItemCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5.5 h-5.5 bg-slate-950 text-white text-[9px] font-bold rounded-full flex items-center justify-center border border-white shadow-sm">
                    {cartItemCount}
                  </span>
                )}
              </button>
            )}

            {/* Mobile menu toggle hamburger button */}
            {!isAdminMode && (
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden w-10 h-10 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-amber-700 flex items-center justify-center transition-all border border-slate-200 shadow-sm"
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
              className="md:hidden border-t border-slate-100 bg-white shadow-lg overflow-hidden"
            >
              <div className="px-6 py-5 space-y-3.5 flex flex-col font-bold uppercase tracking-widest text-[10px] text-slate-600">
                <button
                  onClick={() => {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                    setIsMobileMenuOpen(false);
                  }}
                  className="text-left py-2 hover:text-amber-700 transition-colors border-b border-slate-50"
                >
                  Home
                </button>
                <button
                  onClick={() => {
                    handleScrollTo(menuRef);
                    setIsMobileMenuOpen(false);
                  }}
                  className="text-left py-2 hover:text-amber-700 transition-colors border-b border-slate-50"
                >
                  Menu
                </button>
                <button
                  onClick={() => {
                    handleScrollTo(bookRef);
                    setIsMobileMenuOpen(false);
                  }}
                  className="text-left py-2 hover:text-amber-700 transition-colors border-b border-slate-50"
                >
                  Book Table
                </button>
                <button
                  onClick={() => {
                    handleScrollTo(aboutRef);
                    setIsMobileMenuOpen(false);
                  }}
                  className="text-left py-2 hover:text-amber-700 transition-colors border-b border-slate-50"
                >
                  About
                </button>
                <button
                  onClick={() => {
                    handleScrollTo(reviewsRef);
                    setIsMobileMenuOpen(false);
                  }}
                  className="text-left py-2 hover:text-amber-700 transition-colors border-b border-slate-50"
                >
                  Reviews
                </button>
                <button
                  onClick={() => {
                    handleScrollTo(contactRef);
                    setIsMobileMenuOpen(false);
                  }}
                  className="text-left py-2 hover:text-amber-700 transition-colors border-b border-slate-50"
                >
                  Contact
                </button>
                 <button
                  onClick={() => {
                    setIsYourOrdersOpen(true);
                    setIsMobileMenuOpen(false);
                  }}
                  className="text-left py-2 hover:text-amber-700 transition-colors border-b border-slate-50"
                >
                  My Orders
                </button>
                <button
                  onClick={() => {
                    setShowAdminLogin(true);
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full text-center py-3 bg-gradient-to-r from-amber-50 to-amber-100/50 border border-amber-200/60 text-amber-900 rounded-xl hover:text-amber-800 transition-all font-bold tracking-widest text-[9px] flex items-center justify-center gap-2 mt-2 shadow-sm"
                >
                  <Crown className="w-4 h-4 text-amber-700" />
                  Owner Access
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ================= ADMIN LOGIN MODAL ================= */}
      <AnimatePresence>
        {showAdminLogin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl border border-slate-100 relative"
            >
              <button
                onClick={() => { setShowAdminLogin(false); setAdminEmail(""); setAdminPassword(""); setAdminLoginError(""); }}
                className="absolute top-6 right-6 w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-amber-50 border border-amber-100 rounded-full flex items-center justify-center mx-auto text-amber-600 mb-3">
                  <UserCheck className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold tracking-tight text-slate-900">Owner Access</h3>
                <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider">Enter email and password to access the admin dashboard.</p>
              </div>

              <form onSubmit={handleAdminLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Admin Email</label>
                  <input
                    type="email"
                    placeholder="Enter email address"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="w-full px-4 py-3.5 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-600 font-bold text-xs transition-all bg-slate-50 text-slate-950 focus:bg-white placeholder-slate-400"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Secret Password</label>
                  <input
                    type="password"
                    placeholder="Enter secret password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full px-4 py-3.5 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-600 font-bold tracking-widest text-xs uppercase transition-all bg-slate-50 text-slate-950 focus:bg-white placeholder-slate-400"
                    required
                  />
                </div>
                {adminLoginError && (
                  <div className="p-3 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl text-xs flex items-center gap-2 font-bold uppercase tracking-wider">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{adminLoginError}</span>
                  </div>
                )}
                <button
                  type="submit"
                  className="w-full bg-slate-950 hover:bg-slate-900 text-white font-bold uppercase tracking-widest py-4 rounded-xl transition-all hover:shadow-lg text-xs cursor-pointer"
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
          <section className="relative min-h-[92vh] flex items-center justify-center py-20 px-4 overflow-hidden bg-[#FAF9F6]">
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
              <div className="absolute inset-0 bg-gradient-to-t from-[#FAF9F6] via-[#FAF9F6]/85 to-transparent" />
            </div>

            <div className="relative z-10 max-w-4xl mx-auto text-center text-[#1E293B]">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="space-y-6"
              >
                <div className="inline-flex items-center gap-2 bg-amber-50/70 border border-amber-700/20 px-4 py-2 rounded-full text-xs sm:text-sm font-bold tracking-widest uppercase text-amber-800 shadow-sm">
                  <Star className="w-4 h-4 fill-amber-700 text-amber-700 animate-spin" style={{ animationDuration: '6s' }} />
                  Ahmedabad's Finest Cuisine
                </div>
                <h1 className="text-5xl sm:text-8xl font-extrabold tracking-tight uppercase leading-none text-slate-900">
                  Fresh Food Delivered <br />
                  <span className="text-amber-700">
                    With Love
                  </span>
                </h1>
                <p className="text-xs sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed uppercase tracking-wider font-semibold">
                  Experience frictionless dining! Scan your table QR code, browse our gourmet dishes, customize toppings, and pay directly. Freshness guaranteed.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                  <button
                    onClick={() => handleScrollTo(menuRef)}
                    className="w-full sm:w-auto bg-amber-700 hover:bg-amber-800 text-white font-bold uppercase tracking-widest text-xs py-4.5 px-10 rounded-xl transition-all cursor-pointer shadow-lg shadow-amber-700/15"
                  >
                    Order Now & Menu
                  </button>
                  <button
                    onClick={() => handleScrollTo(bookRef)}
                    className="w-full sm:w-auto bg-white hover:bg-slate-50 text-slate-800 font-bold uppercase tracking-widest text-xs py-4.5 px-8 rounded-xl border border-slate-200 transition-all cursor-pointer shadow-sm"
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
                    className={`w-3 h-3 rounded-full transition-all ${
                      i === heroIndex ? "bg-amber-700 w-8" : "bg-slate-200 hover:bg-slate-300"
                    }`}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* ================= SYSTEM HIGHLIGHTS ================= */}
          <section className="py-16 bg-white border-y border-slate-200/60 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                <div className="flex items-start gap-5">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50/80 border border-amber-200/60 flex items-center justify-center text-amber-700 shrink-0 shadow-sm">
                    <Utensils className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold uppercase tracking-tight text-slate-900">Fresh Gourmet Food</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed uppercase tracking-wider font-medium">Sourced daily from selected organic farms, cooked to golden crispy perfection by top chefs.</p>
                  </div>
                </div>
                <div className="flex items-start gap-5">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50/80 border border-amber-200/60 flex items-center justify-center text-amber-700 shrink-0 shadow-sm">
                    <Truck className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold uppercase tracking-tight text-slate-900">Express Delivery</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed uppercase tracking-wider font-medium">Supercharged logistics to deliver steaming hot, safe meals right to your doorstep under 30 minutes.</p>
                  </div>
                </div>
                <div className="flex items-start gap-5">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50/80 border border-amber-200/60 flex items-center justify-center text-amber-700 shrink-0 shadow-sm">
                    <Star className="w-6 h-6 fill-amber-700/10 text-amber-700" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold uppercase tracking-tight text-slate-900">5-Star Customer Rating</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed uppercase tracking-wider font-medium">Consistently voted as Ahmedabad's ultimate family diner for supreme taste and unmatched convenience.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ================= MENU SECTION ================= */}
          <section ref={menuRef} className="scroll-mt-24 py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 bg-[#FAF9F6]">
            <div className="text-center max-w-xl mx-auto mb-16">
              <h2 className="text-4xl sm:text-6xl font-extrabold tracking-tight uppercase leading-tight text-slate-900">
                Our Culinary <br /><span className="text-amber-700">Wonders</span>
              </h2>
              <p className="text-xs uppercase tracking-widest text-slate-500 mt-3 leading-relaxed font-bold">
                Choose your order type, specify your table or delivery address, filter by preferences, and add mouthwatering dishes to your cart.
              </p>
            </div>

            {/* Step 1: Dine-in vs Delivery Setup */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-md shadow-slate-100/50 mb-10 max-w-4xl mx-auto">
              <div className="flex flex-col sm:flex-row items-center gap-6 justify-between pb-6 border-b border-slate-100">
                <div className="text-center sm:text-left">
                  <h3 className="font-bold uppercase text-slate-900 text-lg tracking-wide">Order Preference</h3>
                  <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider">How would you like to receive your food today?</p>
                </div>
                <div className="bg-slate-100 p-1.5 rounded-2xl flex gap-1 w-full sm:w-auto border border-slate-200/40">
                  <button
                    onClick={() => setOrderType("dine_in")}
                    className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-xs transition-all ${
                      orderType === "dine_in"
                        ? "bg-amber-600 text-white shadow-md"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    <Utensils className="w-4 h-4" />
                    Dine In / Table QR
                  </button>
                  <button
                    onClick={() => setOrderType("delivery")}
                    className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-xs transition-all ${
                      orderType === "delivery"
                        ? "bg-amber-600 text-white shadow-md"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    <Truck className="w-4 h-4" />
                    Delivery
                  </button>
                </div>
              </div>

              <div className="pt-6">
                {orderType === "dine_in" ? (
                  <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        <QrCode className="w-4 h-4 text-amber-600" />
                        Identify Table Number
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="e.g. 3, 5, 12"
                          value={tableNumber}
                          onChange={(e) => setTableNumber(e.target.value)}
                          disabled={isUrlTable}
                          className="w-full max-w-xs px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 focus:outline-none focus:border-amber-600 text-sm font-bold uppercase tracking-wider transition-all placeholder-slate-400"
                        />
                        <button
                          onClick={handleSetTable}
                          disabled={isUrlTable}
                          className="bg-slate-950 hover:bg-slate-800 disabled:opacity-50 text-white font-bold uppercase tracking-widest px-6 py-3 rounded-xl text-xs transition-all shrink-0 cursor-pointer shadow-sm"
                        >
                          Set Table
                        </button>
                      </div>
                    </div>

                    <div className="md:border-l md:border-slate-100 md:pl-8 flex flex-col justify-center py-4">
                      {activeTableLabel ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-2.5 py-1 rounded-md tracking-widest flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              Active Ordering
                            </span>
                            {isUrlTable && (
                              <span className="text-[10px] uppercase bg-amber-50 text-amber-700 border border-amber-200 font-bold px-2 py-1 rounded-md tracking-widest">
                                QR Code Verified
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                            Logged Table: <span className="text-amber-700 text-2xl font-black italic">{activeTableLabel}</span>
                          </p>
                          <button
                            onClick={handleClearTable}
                            className="text-[10px] font-bold uppercase tracking-wider text-rose-600 hover:text-rose-700 underline text-left"
                          >
                            Change Table / Logout
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">
                          No table currently registered. Please enter a table number or scan a table QR.
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      <MapPin className="w-4 h-4 text-amber-600" />
                      Home Delivery Address
                    </div>
                    <textarea
                      placeholder="Please enter your complete street address, flat/villa number, and landmark..."
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      className="w-full px-4 py-3.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 focus:outline-none focus:border-amber-600 text-xs font-bold uppercase tracking-widest transition-all min-h-[90px] resize-y placeholder-slate-400"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Active kitchen status tracker for client */}
            {currentOrder && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-amber-600/30 shadow-xl mb-12 max-w-4xl mx-auto flex flex-col sm:flex-row items-center gap-6 justify-between"
              >
                <div className="space-y-2 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2 text-amber-600 text-xs font-bold uppercase tracking-widest">
                    <Clock className="w-4 h-4 animate-spin" style={{ animationDuration: '4s' }} />
                    Live Kitchen Status
                  </div>
                  <h4 className="text-lg font-bold uppercase tracking-wider text-slate-900">
                    Order ID: <span className="text-amber-700 font-mono text-base">{currentOrder.id}</span>
                  </h4>
                  <p className="text-xs text-slate-600 uppercase tracking-wider font-semibold">
                    Dine preference: <span className="font-bold text-slate-800">{currentOrder.tableNumber === "Delivery" ? "Delivery Order" : `Table ${currentOrder.tableNumber}`}</span> &bull; Price: <span className="text-slate-900 font-bold">₹{currentOrder.total}</span>
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="block text-[9px] text-slate-500 uppercase font-bold tracking-widest">Kitchen Status</span>
                    <span className={`inline-block px-3 py-1.5 rounded-full font-bold text-[10px] mt-1.5 tracking-widest uppercase ${
                      currentOrder.status === "Completed"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : currentOrder.status === "Ready"
                        ? "bg-teal-50 text-teal-700 border border-teal-200 animate-pulse"
                        : currentOrder.status === "Preparing"
                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                        : "bg-slate-100 text-slate-700 border border-slate-200"
                    }`}>
                      {currentOrder.status}
                    </span>
                  </div>

                  {currentOrder.status === "Completed" && (
                    <button
                      onClick={() => setCurrentOrder(null)}
                      className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 p-2 rounded-xl text-xs font-bold transition-all"
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
              <div className="flex items-center overflow-x-auto pb-4 gap-2 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                {menuData.map((category) => (
                  <button
                    key={category.category}
                    onClick={() => {
                      setActiveCategory(category.category);
                      setSearchTerm(""); // reset search
                    }}
                    className={`px-6 py-3.5 rounded-xl font-bold uppercase tracking-widest text-[11px] whitespace-nowrap transition-all border shrink-0 cursor-pointer ${
                      activeCategory === category.category && !searchTerm
                        ? "bg-amber-600 text-white border-amber-600 shadow-md scale-105"
                        : "bg-white text-slate-600 border-slate-200 hover:text-slate-900 hover:border-slate-300 shadow-sm"
                    }`}
                  >
                    {category.category}
                  </button>
                ))}
              </div>

              {/* Advanced controls panel */}
              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-md shadow-slate-100/50">
                {/* Search Bar */}
                <div className="relative w-full md:max-w-md">
                  <Search className="absolute left-4.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search dishes, ingredients or categories..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-11 pr-5 py-3.5 border border-slate-200 rounded-2xl bg-slate-50 focus:bg-white focus:outline-none focus:border-amber-600 text-xs font-bold uppercase tracking-wider transition-all text-slate-900 placeholder-slate-400"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute right-4.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filters & Sorters */}
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
                  {/* Veg Indicator */}
                  <div className="bg-slate-100 border border-slate-200/40 p-1 rounded-xl flex gap-1 text-[10px] font-bold uppercase tracking-wider">
                    <button
                      onClick={() => setVegFilter("all")}
                      className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                        vegFilter === "all" ? "bg-white text-slate-800 shadow-sm border border-slate-200/50" : "text-slate-500 hover:text-slate-900"
                      }`}
                    >
                      🍽 All
                    </button>
                    <button
                      onClick={() => setVegFilter("veg")}
                      className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                        vegFilter === "veg" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-900"
                      }`}
                    >
                      🌱 Veg
                    </button>
                    <button
                      onClick={() => setVegFilter("nonveg")}
                      className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                        vegFilter === "nonveg" ? "bg-rose-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-900"
                      }`}
                    >
                      🍗 Non Veg
                    </button>
                  </div>

                  {/* Sorter */}
                  <select
                    value={sortType}
                    onChange={(e) => setSortType(e.target.value as any)}
                    className="border border-slate-200 bg-slate-50 text-slate-700 font-bold uppercase tracking-wider text-xs px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-amber-600 focus:bg-white transition-all cursor-pointer"
                  >
                    <option value="none">Default Sort</option>
                    <option value="price_asc">💰 Price: Low to High</option>
                    <option value="price_desc">💰 Price: High to Low</option>
                    <option value="popularity">⭐ Most Popular First</option>
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
                      className="bg-white rounded-3xl border border-slate-200/60 shadow-md shadow-slate-100/50 hover:shadow-xl hover:-translate-y-1.5 hover:border-amber-600/50 transition-all duration-300 overflow-hidden flex flex-col justify-between group"
                    >
                      <div className="relative aspect-video overflow-hidden border-b border-slate-100">
                        <img
                          src={item.img}
                          alt={item.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute top-4 left-4 flex flex-col gap-1.5">
                          <span className={`px-2.5 py-1 rounded-lg text-[9px] font-bold tracking-widest uppercase text-white shadow-md ${
                            item.is_vegetarian
                              ? "bg-emerald-600 border border-emerald-500"
                              : "bg-rose-600 border border-rose-500"
                          }`}>
                            {item.is_vegetarian ? "🌱 VEG" : "🍗 NON-VEG"}
                          </span>
                        </div>
                        <div className="absolute top-4 right-4 bg-amber-100 text-amber-800 border border-amber-200/60 font-bold text-[10px] px-2.5 py-1 rounded-lg shadow-md flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 fill-amber-600 text-amber-600" />
                          <span>{item.popularity_score}</span>
                        </div>
                      </div>

                      <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                        <div className="space-y-1.5">
                          <h4 className="text-xl font-bold uppercase tracking-tight text-slate-900 group-hover:text-amber-600 transition-colors">
                            {item.name}
                          </h4>
                          <p className="text-xs text-slate-500 leading-relaxed font-medium">
                            {item.desc}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-4">
                          <span className="text-xl font-extrabold tracking-tight text-slate-900">
                            ₹{item.price}
                          </span>
                          <button
                            onClick={() => handleAddToCart(item)}
                            className="bg-slate-950 hover:bg-amber-600 hover:text-white text-white font-bold uppercase tracking-widest text-[10px] px-5 py-3.5 rounded-xl transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-1.5 shadow-sm"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add to Cart
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {getFilteredItems().length === 0 && (
                <div className="text-center py-20 bg-white rounded-3xl border border-slate-200/80 shadow-md shadow-slate-100/40 max-w-lg mx-auto">
                  <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                    <Search className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold uppercase tracking-wider text-slate-900">No Dishes Found</h4>
                  <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider max-w-xs mx-auto">Try checking your spelling or matching and toggling filters.</p>
                </div>
              )}

              {/* Modern "View Cart / Place Order" option below all menu items */}
              {cart.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-12 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl shadow-amber-900/5 max-w-4xl mx-auto"
                >
                  <div className="flex items-center gap-4 text-left">
                    <div className="w-12 h-12 rounded-2xl bg-amber-700 text-white flex items-center justify-center shadow-lg shadow-amber-700/20 shrink-0">
                      <ShoppingCart className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm uppercase tracking-wider text-slate-950">
                        {cart.reduce((sum, item) => sum + item.quantity, 0)} Items Added To Your Tray
                      </h4>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mt-1">
                        Current Order Total: <span className="text-amber-700 font-black font-mono">₹{cartTotal}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <button
                      onClick={() => setIsCartOpen(true)}
                      className="w-full sm:w-auto bg-amber-700 hover:bg-amber-800 text-white font-extrabold uppercase tracking-widest text-[11px] px-8 py-4 rounded-xl transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-lg shadow-amber-700/10 flex items-center justify-center gap-2"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      View Cart & Place Order
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </section>

          {/* ================= BOOK TABLE SECTION ================= */}
          <section ref={bookRef} className="scroll-mt-24 py-24 bg-white border-t border-slate-200/60 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center max-w-xl mx-auto mb-16">
                <h2 className="text-4xl sm:text-6xl font-extrabold tracking-tight uppercase leading-tight text-slate-900">
                  Gourmet <br /><span className="text-amber-600">Table Booking</span>
                </h2>
                <p className="text-xs uppercase tracking-widest text-slate-500 mt-3 leading-relaxed font-bold">
                  Avoid long queues! Reserve a table on specific date and hour slots. Our interactive chart checks live table availability below.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
                {/* Booking form */}
                <form onSubmit={handleBookTable} className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-md shadow-slate-100/50 lg:col-span-7 space-y-6">
                  <h3 className="text-lg font-bold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-amber-600 animate-pulse" />
                    {editReservationId ? "Edit Table Reservation" : "Request Slot Booking"}
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Date Selector</label>
                      <input
                        type="date"
                        min={new Date().toISOString().split("T")[0]}
                        value={resDate}
                        onChange={(e) => { setResDate(e.target.value); setResTable(""); }}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 focus:outline-none focus:border-amber-600 font-bold text-sm tracking-wider transition-all"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Time Slot</label>
                      <select
                        value={resTime}
                        onChange={(e) => { setResTime(e.target.value); setResTable(""); }}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 focus:outline-none focus:border-amber-600 font-bold text-sm tracking-wider transition-all cursor-pointer"
                        required
                      >
                        <option value="">Choose a slot</option>
                        {TIME_SLOTS.map((slot) => (
                          <option key={slot} value={slot}>{slot}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Interactive Table Layout selector */}
                  <div className="space-y-3">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Select Available Tables</label>
                    {(!resDate || !resTime) ? (
                      <div className="p-4 bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-xl flex items-center gap-2 font-bold uppercase tracking-wider">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>Select a <strong>Date</strong> and <strong>Time</strong> above to display available tables.</span>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-[10px] uppercase text-slate-500 font-bold tracking-widest">Click a free table below:</p>
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
                                className={`py-3.5 px-2 rounded-xl text-xs font-bold border transition-all ${
                                  isReserved
                                    ? "bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed line-through"
                                    : isSelected
                                    ? "bg-amber-600 text-white border-amber-600 shadow-md scale-105"
                                    : "bg-slate-50 text-slate-700 border-slate-200 hover:border-amber-600 hover:text-amber-700"
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
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Number of Guests</label>
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => setResGuests((prev) => Math.max(1, prev - 1))}
                        className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-700 transition-all font-bold cursor-pointer"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="font-bold text-base text-slate-900 w-8 text-center">{resGuests}</span>
                      <button
                        type="button"
                        onClick={() => setResGuests((prev) => Math.min(12, prev + 1))}
                        className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-700 transition-all font-bold cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Max 12 guests per single table</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Your Full Name</label>
                      <input
                        type="text"
                        placeholder="John Doe"
                        value={resName}
                        onChange={(e) => setResName(e.target.value)}
                        className="w-full px-4 py-3.5 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-600 text-sm font-bold uppercase tracking-wider transition-all bg-slate-50 text-slate-900 placeholder-slate-400"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Contact Number</label>
                      <input
                        type="tel"
                        placeholder="+91 9999999999"
                        value={resPhone}
                        onChange={(e) => setResPhone(e.target.value)}
                        className="w-full px-4 py-3.5 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-600 text-sm font-bold uppercase tracking-wider transition-all bg-slate-50 text-slate-900 placeholder-slate-400"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="submit"
                      className="flex-1 bg-slate-950 hover:bg-slate-900 text-white font-bold uppercase tracking-widest py-4 rounded-xl shadow-lg transition-all hover:scale-[1.01] active:scale-[0.99] text-xs cursor-pointer"
                    >
                      {editReservationId ? "Update Reservation" : "Confirm Booking"}
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
                        className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-5 rounded-xl text-xs font-bold uppercase tracking-widest border border-slate-200 transition-all"
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>
                </form>

                {/* Display active reservations matching table / number */}
                <div className="lg:col-span-5 space-y-6">
                  <div className="bg-white text-slate-800 rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-md shadow-slate-100/50">
                    <h3 className="text-base font-bold uppercase tracking-wider text-amber-600 mb-2 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-amber-600 shrink-0" />
                      Manage Active Bookings
                    </h3>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider leading-relaxed">
                      Below are confirmed reservations associated with your account. You can instantly modify times or cancel.
                    </p>

                    <div className="mt-6 space-y-4 max-h-[360px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                      {allReservations.filter((r) => r.status === "confirmed" && userReservationIds.includes(r.id)).length === 0 ? (
                        <div className="text-center py-10 border border-slate-100 rounded-2xl bg-slate-50">
                          <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          <span className="block text-xs text-slate-400 font-bold uppercase tracking-wider">No table bookings logged yet.</span>
                        </div>
                      ) : (
                        allReservations
                          .filter((r) => r.status === "confirmed" && userReservationIds.includes(r.id))
                          .map((r) => (
                            <div
                              key={r.id}
                              className="bg-slate-50 border border-slate-100 rounded-2xl p-4.5 space-y-3.5 shadow-sm hover:border-amber-600/40 transition-all"
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <span className="text-[9px] text-amber-700 uppercase font-bold tracking-widest block">
                                    Table {r.table}
                                  </span>
                                  <span className="text-sm font-bold uppercase block mt-0.5 text-slate-900">{r.name}</span>
                                </div>
                                <span className="text-[9px] uppercase bg-white text-slate-700 border border-slate-200 px-2.5 py-1 rounded-md font-bold tracking-widest shadow-sm">
                                  {r.guests} Guests
                                </span>
                              </div>

                              <div className="text-xs text-slate-600 space-y-1 font-semibold uppercase tracking-wider bg-white p-2.5 rounded-xl border border-slate-100">
                                <p className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-slate-400" /> {r.date}</p>
                                <p className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-slate-400" /> {r.time}</p>
                                <p className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-slate-400" /> {r.phone}</p>
                              </div>

                              <div className="flex gap-2 pt-1 border-t border-slate-100">
                                <button
                                  onClick={() => handleEditReservation(r)}
                                  className="flex-1 bg-white hover:bg-slate-100 text-slate-700 hover:text-amber-700 text-[10px] font-bold uppercase tracking-widest py-2 rounded-lg transition-colors border border-slate-200 flex items-center justify-center gap-1 cursor-pointer shadow-sm"
                                >
                                  <Edit2 className="w-3.5 h-3.5" /> Edit
                                </button>
                                <button
                                  onClick={() => handleCancelReservation(r.id)}
                                  className="bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 text-[10px] font-bold uppercase tracking-widest py-2 px-4 rounded-lg transition-colors cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ================= ABOUT SECTION ================= */}
          <section ref={aboutRef} className="scroll-mt-24 py-24 bg-[#FAF9F6] border-t border-slate-200/60">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
                <div className="relative aspect-video sm:aspect-[4/3] rounded-3xl overflow-hidden shadow-md shadow-slate-100/50 border border-slate-200/80">
                  <img
                    src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&auto=format&fit=crop&q=80"
                    alt="SmartMenu Dining Hall"
                    className="w-full h-full object-cover opacity-90"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-6 left-6 text-white space-y-1">
                    <span className="text-[9px] text-amber-400 uppercase font-bold tracking-widest block">Main Hall Lounge</span>
                    <h5 className="font-bold uppercase tracking-tight text-lg">Ambient & Spacious Seating</h5>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="text-[10px] font-bold text-amber-700 uppercase tracking-widest bg-amber-50 border border-amber-200 px-3.5 py-1.5 rounded-full inline-block">Our Story</div>
                  <h3 className="text-4xl sm:text-5xl font-extrabold tracking-tight uppercase leading-tight text-slate-900">Elevating Ahmedabad's Culinary Excellence</h3>
                  <p className="text-xs text-slate-600 uppercase tracking-wider font-semibold leading-relaxed">
                    SmartMenu Restaurant is at the vanguard of digital dining innovations. By pairing traditional recipes crafted by culinary veterans with frictionless QR technology, we create culinary experiences that are fast, accessible, and extraordinarily flavorful.
                  </p>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold leading-relaxed">
                    Enjoy real-time order logs, customizable pizza toppings, transparent pricing, and instant seating bookings on the go.
                  </p>
                  <div className="grid grid-cols-2 gap-5 pt-4">
                    <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-sm">
                      <span className="block text-3xl font-bold italic text-amber-600">20+</span>
                      <span className="text-[9px] text-slate-500 font-bold uppercase mt-1 block tracking-widest">Tables Equipped</span>
                    </div>
                    <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-sm">
                      <span className="block text-3xl font-bold italic text-amber-600">10k+</span>
                      <span className="text-[9px] text-slate-500 font-bold uppercase mt-1 block tracking-widest">Happy Foodies</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ================= REVIEWS SECTION ================= */}
          <section ref={reviewsRef} className="scroll-mt-24 py-24 bg-white border-t border-slate-200/60 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center max-w-xl mx-auto mb-16">
                <h2 className="text-4xl sm:text-6xl font-extrabold tracking-tight uppercase leading-tight text-slate-900">
                  Loved <br /><span className="text-amber-600">by Thousands</span>
                </h2>
                <p className="text-xs uppercase tracking-widest text-slate-500 mt-3 leading-relaxed font-bold">
                  Read honest feedback shared by our loyal community members.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-slate-50 border border-slate-200/60 p-8 rounded-3xl shadow-sm flex flex-col justify-between hover:border-amber-600/40 hover:bg-white hover:shadow-lg transition-all duration-300">
                  <p className="text-xs text-slate-600 leading-relaxed font-semibold uppercase tracking-wider">
                    "The QR ordering is so smart! We scanned the table tag, custom added toppings to our farmhouse pizza, placed order, and it was served piping hot in 12 minutes flat. 10/10!"
                  </p>
                  <div className="flex items-center gap-3.5 pt-6 mt-6 border-t border-slate-200/60">
                    <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs">R</div>
                    <div>
                      <h5 className="font-bold uppercase tracking-wider text-xs text-slate-900">Rahul Sharma</h5>
                      <span className="text-[10px] text-amber-500 font-bold tracking-widest">★★★★★</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200/60 p-8 rounded-3xl shadow-sm flex flex-col justify-between hover:border-amber-600/40 hover:bg-white hover:shadow-lg transition-all duration-300">
                  <p className="text-xs text-slate-600 leading-relaxed font-semibold uppercase tracking-wider">
                    "Beautifully clean interface! Booking a table in advance is remarkably streamlined. Love the live table indicator showing what’s available. Burgers are incredible!"
                  </p>
                  <div className="flex items-center gap-3.5 pt-6 mt-6 border-t border-slate-200/60">
                    <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs">P</div>
                    <div>
                      <h5 className="font-bold uppercase tracking-wider text-xs text-slate-900">Priya Patel</h5>
                      <span className="text-[10px] text-amber-500 font-bold tracking-widest">★★★★★</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200/60 p-8 rounded-3xl shadow-sm flex flex-col justify-between hover:border-amber-600/40 hover:bg-white hover:shadow-lg transition-all duration-300">
                  <p className="text-xs text-slate-600 leading-relaxed font-semibold uppercase tracking-wider">
                    "Fabulous chocolate brownie and combos! We ordered a Family combo which is amazing value for money. Fresh ingredients, express delivery, supreme service."
                  </p>
                  <div className="flex items-center gap-3.5 pt-6 mt-6 border-t border-slate-200/60">
                    <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs">A</div>
                    <div>
                      <h5 className="font-bold uppercase tracking-wider text-xs text-slate-900">Aman Shah</h5>
                      <span className="text-[10px] text-amber-500 font-bold tracking-widest">★★★★★</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ================= CONTACT SECTION ================= */}
          <section ref={contactRef} className="scroll-mt-24 py-24 bg-[#FAF9F6] border-t border-slate-200/60">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="bg-white text-slate-800 rounded-3xl p-8 sm:p-12 border border-slate-200/80 shadow-md shadow-slate-100/50 relative overflow-hidden">
                <div className="absolute -top-12 -right-12 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl" />
                <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-slate-500/5 rounded-full blur-3xl" />

                <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-12 items-center">
                  <div className="md:col-span-7 space-y-6">
                    <span className="text-[10px] font-bold text-amber-700 uppercase tracking-widest bg-amber-50 border border-amber-200 px-3.5 py-1.5 rounded-full inline-block">Support & Location</span>
                    <h3 className="text-4xl font-extrabold uppercase tracking-tight text-slate-900">We'd Love to Hear From You</h3>
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold leading-relaxed">
                      Questions regarding franchise, group bookings, table setups, or payment troubleshooting? Reach our support desk or step right in.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2 text-xs uppercase tracking-widest font-bold text-slate-700">
                      <div className="flex items-center gap-3">
                        <MapPin className="w-5 h-5 text-amber-600 shrink-0" />
                        <span>Ahmedabad, Gujarat</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Phone className="w-5 h-5 text-amber-600 shrink-0" />
                        <span>+91 9999999999</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Mail className="w-5 h-5 text-amber-600 shrink-0" />
                        <span>info@smartmenu.com</span>
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-5 bg-slate-50 p-6 rounded-2xl border border-slate-200/80 space-y-4">
                    <h5 className="font-bold uppercase tracking-widest text-[10px] text-amber-700">Quick Feedback</h5>
                    <p className="text-[10px] text-slate-500 leading-relaxed font-bold uppercase tracking-wider">Submit your email address to receive daily discount coupon keys!</p>
                    <input
                      type="email"
                      placeholder="Enter your email"
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-amber-600 text-xs text-slate-800 font-bold uppercase tracking-wider"
                    />
                    <button
                      onClick={() => showToast("Subscribed successfully!")}
                      className="w-full bg-slate-950 hover:bg-slate-900 text-white font-bold uppercase tracking-widest py-3 rounded-xl text-[10px] transition-all cursor-pointer shadow-sm"
                    >
                      Subscribe Now
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </>
      ) : (
        // ================= OWNER DASHBOARD =================
        <section className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 bg-[#FAF9F6]">
          {/* Dashboard Header Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-md shadow-slate-100/50">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Active Kitchen Orders</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-4xl font-extrabold italic text-slate-900">{pendingOrdersCount}</span>
                <span className="text-[10px] text-amber-700 uppercase font-bold tracking-wider">In queue</span>
              </div>
            </div>
            <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-md shadow-slate-100/50">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Confirmed Tables Booked</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-4xl font-extrabold italic text-slate-900">{activeReservationsCount}</span>
                <span className="text-[10px] text-amber-700 uppercase font-bold tracking-wider">Slots locked</span>
              </div>
            </div>
            <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-md shadow-slate-100/50">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Table Seating Limits</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-4xl font-extrabold italic text-slate-900">{TOTAL_TABLES}</span>
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Max Tables</span>
              </div>
            </div>
            <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-md shadow-slate-100/50">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Active Revenue Flow</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-4xl font-extrabold italic text-emerald-600">
                  ₹{allOrders.filter((o) => o.status === "Completed").reduce((s, o) => s + o.total, 0)}
                </span>
                <span className="text-[9px] uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-1.5 py-0.5 rounded-md tracking-widest">Realized</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Live orders log (Col-span 8) */}
            <div className="lg:col-span-8 bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-md shadow-slate-100/50 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <h3 className="text-xl font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-amber-600" />
                    Kitchen Cooking Pipeline
                  </h3>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mt-1">Live customer orders mapped. Update statuses as chef completes dishes.</p>
                </div>
                <button
                  onClick={fetchOrdersAndReservations}
                  className="bg-slate-950 hover:bg-slate-850 text-white font-bold uppercase tracking-widest text-xs px-4.5 py-2.5 rounded-xl transition-all self-start sm:self-auto cursor-pointer shadow-sm"
                >
                  Reload Live Queue
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {allOrders.length === 0 ? (
                  <div className="sm:col-span-2 text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
                    <Utensils className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <span className="block text-slate-400 uppercase font-bold tracking-widest text-xs">No active customer orders currently logged.</span>
                  </div>
                ) : (
                  allOrders.map((order) => {
                    const isCompleted = order.status === "Completed";
                    return (
                      <div
                        key={order.id}
                        className={`border rounded-2xl p-5 flex flex-col justify-between shadow-sm transition-all duration-300 ${
                          isCompleted
                            ? "bg-slate-50/50 border-slate-100 opacity-60"
                            : "bg-slate-50 border-slate-200 hover:border-amber-600"
                        }`}
                      >
                        <div className="space-y-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <span className={`inline-block px-2.5 py-1 rounded-md text-[9px] font-bold tracking-widest uppercase mb-1.5 ${
                                order.orderType === "delivery"
                                  ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                                  : "bg-amber-50 text-amber-700 border border-amber-200"
                              }`}>
                                {order.orderType === "delivery" ? "🚀 Delivery" : `🪑 Table ${order.tableNumber}`}
                              </span>
                              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 font-mono">{order.id}</h4>
                              <span className="block text-[9px] text-slate-400 uppercase tracking-widest mt-0.5">{order.createdAt}</span>
                            </div>
                            <span className={`px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest ${
                              order.status === "Completed"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : order.status === "Ready"
                                ? "bg-teal-50 text-teal-700 border border-teal-200 animate-pulse"
                                : order.status === "Preparing"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-slate-100 text-slate-700 border border-slate-200"
                            }`}>
                              {order.status}
                            </span>
                          </div>

                          {/* Order items list */}
                          <div className="bg-white p-3 rounded-xl border border-slate-100 text-xs text-slate-700 space-y-1.5">
                            {order.items.map((it, idx) => (
                              <p key={idx} className="flex justify-between font-bold uppercase tracking-wider text-[10px]">
                                <span className="text-slate-800">
                                  {it.name} <span className="text-[9px] text-slate-400 font-bold">×{it.quantity}</span>
                                </span>
                                <span className="text-slate-900">₹{it.price * it.quantity}</span>
                              </p>
                            ))}
                            {order.orderType === "delivery" && order.deliveryAddress && (
                              <div className="pt-2 border-t border-slate-100 mt-2">
                                <span className="text-[9px] uppercase text-indigo-700 font-bold tracking-widest block">Delivery Address:</span>
                                <p className="text-[10px] text-slate-600 font-semibold uppercase tracking-wider leading-normal mt-0.5">{order.deliveryAddress}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-5">
                          <span className="text-lg font-bold text-slate-950">Total: ₹{order.total}</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setSelectedBillOrder(order)}
                              className="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-bold uppercase tracking-widest text-[9px] px-3 py-2 rounded-xl transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-1 shadow-sm"
                              title="Generate Invoice & Print"
                            >
                              <Receipt className="w-3.5 h-3.5 text-amber-800" />
                              Bill
                            </button>
                            {!isCompleted ? (
                              <button
                                onClick={() => advanceOrderStatus(order.id, order.status)}
                                className="bg-slate-950 hover:bg-slate-800 text-white font-bold uppercase tracking-widest text-[9px] px-3.5 py-2 rounded-xl transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-sm"
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
            <div className="lg:col-span-4 bg-white text-slate-800 rounded-3xl p-6 shadow-md shadow-slate-100/50 border border-slate-200/80 space-y-6">
              <div>
                <h3 className="text-lg font-bold uppercase tracking-wider text-amber-600 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-600" />
                  Locked Table Bookings
                </h3>
                <p className="text-xs text-slate-500 uppercase tracking-wider mt-1 font-bold">Guests scheduled for today's dining tables.</p>
              </div>

              <div className="space-y-4 max-h-[460px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                {allReservations.filter((r) => r.status === "confirmed").length === 0 ? (
                  <div className="text-center py-12 border border-slate-100 rounded-2xl bg-slate-50">
                    <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <span className="block text-xs text-slate-400 font-bold uppercase tracking-widest">No table bookings active.</span>
                  </div>
                ) : (
                  allReservations
                    .filter((r) => r.status === "confirmed")
                    .map((r) => (
                      <div
                        key={r.id}
                        className="bg-slate-50 border border-slate-100 rounded-2xl p-4.5 space-y-3.5 hover:border-amber-600/40 transition-all shadow-sm"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[9px] text-amber-700 uppercase font-bold tracking-widest block">
                              Table {r.table}
                            </span>
                            <span className="text-sm font-bold uppercase block mt-0.5 text-slate-900">{r.name}</span>
                          </div>
                          <span className="text-[9px] font-bold uppercase tracking-widest bg-white text-slate-700 border border-slate-200 px-2 py-1 rounded-md shadow-sm">
                            {r.guests} Guests
                          </span>
                        </div>

                        <div className="text-[10px] text-slate-600 space-y-1 uppercase tracking-wider bg-white p-2.5 rounded-xl border border-slate-100">
                          <p className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5 text-slate-400" /> {r.date}</p>
                          <p className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-slate-400" /> {r.time}</p>
                          <p className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-slate-400" /> {r.phone}</p>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>

          {/* Table QR Code Generator - Directly built-in for extreme value */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-md shadow-slate-100/50 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <h3 className="text-xl font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-amber-600 animate-pulse" />
                  Table QR Code Generator
                </h3>
                <p className="text-xs text-slate-500 uppercase tracking-wider mt-1">Print these QR codes and stick them onto tables. Scanning instantly logs users into the app with that specific table.</p>
              </div>
              <button
                onClick={() => window.print()}
                className="bg-slate-950 hover:bg-slate-800 text-white font-bold uppercase tracking-widest text-xs px-5 py-3 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Printer className="w-4 h-4" />
                Print QR Sheets
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
              {Array.from({ length: 15 }, (_, i) => {
                const num = i + 1;
                // Generate the exact self referential link inside AI Studio
                const baseHref = typeof window !== "undefined" ? window.location.origin : "";
                const tableUrl = `${baseHref}/?table=${num}`;
                const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(tableUrl)}`;

                return (
                  <div
                    key={num}
                    className="border border-slate-100 rounded-2xl p-4 text-center bg-slate-50 space-y-3.5 flex flex-col items-center justify-between shadow-sm hover:border-amber-600 transition-all"
                  >
                    <h4 className="font-bold uppercase tracking-wider text-slate-900 text-xs">Table {num}</h4>
                    <div className="w-28 h-28 bg-white p-2 rounded-xl border border-slate-200 shadow-inner">
                      <img src={qrImg} alt={`QR Table ${num}`} className="w-full h-full object-contain" />
                    </div>
                    <div className="space-y-1 w-full">
                      <span className="block text-[8px] text-slate-400 font-bold truncate tracking-tight">{tableUrl}</span>
                      <a
                        href={tableUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block text-[9px] text-amber-700 hover:text-amber-800 font-bold uppercase tracking-widest underline cursor-pointer"
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
      <footer className="bg-slate-950 text-white border-t border-slate-900 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 font-bold shadow-md shadow-amber-500/20">
                <Utensils className="w-5 h-5" />
              </div>
              <span className="text-lg font-bold tracking-tight">
                Smart<span className="text-amber-400">Menu</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
               Ahmedabad's revolutionary contactless digital dining experience. Order gourmet food directly from kitchen to table in minutes.
            </p>
          </div>

          <div className="space-y-3">
            <h5 className="font-extrabold text-xs uppercase tracking-widest text-amber-400">Opening Hours</h5>
            <div className="text-xs text-slate-400 space-y-1.5 font-medium">
              <p>Monday - Friday: 11:00 AM - 10:00 PM</p>
              <p>Saturday - Sunday: 11:30 AM - 11:00 PM</p>
              <p className="text-amber-500/80">&bull; Kitchen takes final slots at 9:30 PM</p>
            </div>
          </div>

          <div className="space-y-3">
            <h5 className="font-extrabold text-xs uppercase tracking-widest text-amber-400">Our Cuisine</h5>
            <div className="text-xs text-slate-400 space-y-1.5 font-semibold">
              <p className="hover:text-amber-400 transition-colors cursor-pointer" onClick={() => handleScrollTo(menuRef)}>Gourmet Pizzas</p>
              <p className="hover:text-amber-400 transition-colors cursor-pointer" onClick={() => handleScrollTo(menuRef)}>Flame Grilled Burgers</p>
              <p className="hover:text-amber-400 transition-colors cursor-pointer" onClick={() => handleScrollTo(menuRef)}>Bechamel White Pasta</p>
              <p className="hover:text-amber-400 transition-colors cursor-pointer" onClick={() => handleScrollTo(menuRef)}>Premium Fudge Fudge Cake</p>
            </div>
          </div>

          <div className="space-y-3">
            <h5 className="font-extrabold text-xs uppercase tracking-widest text-amber-400">Tech Features</h5>
            <div className="text-xs text-slate-400 space-y-1.5 font-medium leading-relaxed">
              <p>&bull; Live Slot Table Checker</p>
              <p>&bull; QR Self-logging Routing</p>
              <p>&bull; Real-time Order Status Pipeline</p>
              <p>&bull; Multi-mode Payment Wire Ready</p>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 mt-10 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>&copy; 2026 SmartMenu Restaurant. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="https://wa.me/919999999999" target="_blank" rel="noreferrer" className="hover:text-emerald-400 transition-colors font-semibold">WhatsApp Desk</a>
            <span>&bull;</span>
            <span className="hover:text-amber-400 transition-colors font-semibold cursor-pointer" onClick={() => setShowAdminLogin(true)}>Owner Portal</span>
          </div>
        </div>
      </footer>

      {/* ================= WHATSAPP FLOATING BUBBLE ================= */}
      <a
        href="https://wa.me/919999999999"
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-6 right-6 w-14 h-14 bg-[#25D366] text-white rounded-full flex items-center justify-center text-3xl shadow-2xl hover:scale-110 active:scale-95 transition-all z-35 group"
        title="Chat on WhatsApp"
      >
        <span className="absolute right-16 bg-slate-900 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-md opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap">
          WhatsApp Support Desk
        </span>
        <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white">
          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.66.986 3.296 1.481 4.964 1.483 5.482 0 9.943-4.437 9.946-9.897.002-2.643-1.026-5.131-2.898-7.005-1.871-1.872-4.364-2.9-7.01-2.902-5.485 0-9.945 4.438-9.948 9.9.001 1.768.486 3.49 1.4 5.013l-.995 3.637 3.74-.982z" />
        </svg>
      </a>
      <AnimatePresence>
        {isYourOrdersOpen && (
          <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/80 backdrop-blur-sm">
            {/* Backdrop closer */}
            <div className="absolute inset-0 cursor-pointer" onClick={() => setIsYourOrdersOpen(false)} />

            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.3 }}
              className="relative w-full max-w-md bg-white text-slate-800 h-full shadow-2xl flex flex-col justify-between border-l border-slate-200"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-amber-600 animate-bounce" />
                  <h3 className="font-extrabold uppercase tracking-wider text-slate-900 text-base">Your Orders</h3>
                </div>
                <button
                  onClick={() => setIsYourOrdersOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Orders List */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                {allOrders.filter((o) => userOrderIds.includes(o.id)).length === 0 ? (
                  <div className="text-center py-24 space-y-3">
                    <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                      <Receipt className="w-6 h-6" />
                    </div>
                    <h5 className="font-bold uppercase tracking-wider text-slate-900">No Orders Placed Yet</h5>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto uppercase tracking-wider leading-relaxed">
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
                          className={`bg-slate-50 border rounded-2xl p-4.5 space-y-3.5 shadow-sm transition-all duration-300 ${
                            isCompleted ? "border-slate-200/60 opacity-80" : "border-amber-600/40 hover:border-amber-600"
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <span className={`inline-block px-2.5 py-0.5 rounded-md text-[9px] font-bold tracking-widest uppercase mb-1.5 ${
                                order.orderType === "delivery"
                                  ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                                  : "bg-amber-50 text-amber-700 border border-amber-200"
                              }`}>
                                {order.orderType === "delivery" ? "🚀 Delivery" : `🪑 Table ${order.tableNumber}`}
                              </span>
                              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-850 font-mono">{order.id}</h4>
                              <span className="block text-[8px] text-slate-400 uppercase tracking-widest mt-0.5">{order.createdAt}</span>
                            </div>
                            <span className={`px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest ${
                              order.status === "Completed"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : order.status === "Ready"
                                ? "bg-teal-50 text-teal-700 border border-teal-200 animate-pulse"
                                : order.status === "Preparing"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-slate-100 text-slate-700 border border-slate-200"
                            }`}>
                              {order.status}
                            </span>
                          </div>

                          {/* Items and Subtotal */}
                          <div className="bg-white p-3 rounded-xl border border-slate-100 text-xs text-slate-700 space-y-1.5">
                            {order.items.map((it, idx) => (
                              <p key={idx} className="flex justify-between font-bold uppercase tracking-wider text-[10px]">
                                <span className="text-slate-800">
                                  {it.name} <span className="text-[9px] text-slate-400 font-bold">×{it.quantity}</span>
                                </span>
                                <span className="text-slate-900">₹{it.price * it.quantity}</span>
                              </p>
                            ))}
                          </div>

                          <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 mt-2.5">
                            <span className="text-sm font-bold text-slate-950">Total: ₹{order.total}</span>
                            <button
                              onClick={() => setSelectedBillOrder(order)}
                              className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold uppercase tracking-widest text-[9px] px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 shadow-sm"
                            >
                              <Receipt className="w-3.5 h-3.5" /> View Bill
                            </button>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>

              {/* Footer inside drawer */}
              <div className="p-6 bg-slate-50 border-t border-slate-200 text-center">
                <p className="text-[9px] uppercase tracking-widest text-slate-400 font-bold">SmartMenu Digital Kitchen Integration</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCartOpen && (
          <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/80 backdrop-blur-sm">
            {/* Backdrop closer */}
            <div className="absolute inset-0 cursor-pointer" onClick={() => setIsCartOpen(false)} />

            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.3 }}
              className="relative w-full max-w-md bg-white text-slate-800 h-full shadow-2xl flex flex-col justify-between border-l border-slate-200"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-amber-600 animate-bounce" />
                  <h3 className="font-extrabold uppercase tracking-wider text-slate-900 text-base">Your Culinary Cart</h3>
                </div>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Items List */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                {cart.length === 0 ? (
                  <div className="text-center py-24 space-y-3">
                    <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                      <ShoppingCart className="w-6 h-6" />
                    </div>
                    <h5 className="font-bold uppercase tracking-wider text-slate-900">Your Cart is Empty</h5>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto uppercase tracking-wider">Browse our delicious pizzas and sides above and fill your tray!</p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div
                      key={item.name}
                      className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm hover:border-amber-600/40 transition-all"
                    >
                      <div className="flex-1">
                        <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider">{item.name}</h4>
                        <p className="text-[9px] text-slate-400 uppercase tracking-widest mt-0.5">₹{item.price} per dish</p>
                        <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mt-1.5">Subtotal: ₹{item.price * item.quantity}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => updateCartQty(item.name, -1)}
                          className="w-7 h-7 rounded-lg bg-white border border-slate-200 hover:border-amber-600 flex items-center justify-center text-slate-800 font-bold text-xs transition-colors cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="font-bold text-xs text-slate-900 w-5 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateCartQty(item.name, 1)}
                          className="w-7 h-7 rounded-lg bg-white border border-slate-200 hover:border-amber-600 flex items-center justify-center text-slate-800 font-bold text-xs transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => removeFromCart(item.name)}
                          className="text-slate-400 hover:text-rose-600 transition-colors p-1 cursor-pointer"
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
              <div className="p-6 bg-slate-50 border-t border-slate-200 space-y-4">
                <div className="flex items-center justify-between font-bold uppercase tracking-wider text-slate-900">
                  <span>Grand Total Amount</span>
                  <span className="text-2xl text-amber-700 font-bold italic">₹{cartTotal}</span>
                </div>
                {orderType === "dine_in" && activeTableLabel && (
                  <div className="p-2.5 bg-amber-50 text-amber-700 text-[10px] rounded-lg border border-amber-200 font-bold uppercase tracking-wider text-center">
                    Ordering for Table <span className="font-bold italic text-sm text-amber-600">{activeTableLabel}</span>
                  </div>
                )}
                {orderType === "delivery" && deliveryAddress.trim() && (
                  <div className="p-2.5 bg-indigo-50 text-indigo-700 text-[9px] rounded-lg border border-indigo-200 font-bold uppercase tracking-wider truncate">
                    Deliver: <span className="text-slate-600">{deliveryAddress}</span>
                  </div>
                )}
                <button
                  onClick={handlePlaceOrderClick}
                  disabled={cart.length === 0}
                  className="w-full bg-slate-950 hover:bg-slate-900 disabled:opacity-40 text-white font-bold py-4 rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99] text-xs cursor-pointer shadow-md flex items-center justify-center gap-2 uppercase tracking-widest"
                >
                  Place Kitchen Order
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= ORDER SUMMARY MODAL ================= */}
      <AnimatePresence>
        {showSummaryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white text-slate-800 w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 relative"
            >
              <button
                onClick={() => setShowSummaryModal(false)}
                className="absolute top-6 right-6 w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="mb-6">
                <h2 className="text-2xl font-extrabold uppercase tracking-tight text-slate-900">Order Summary</h2>
                <p className="text-xs text-slate-500 uppercase tracking-wider mt-1 font-semibold">Please double check your tray items and preferences.</p>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4.5 border border-slate-200/60 space-y-4 max-h-[250px] overflow-y-auto">
                <div className="flex justify-between items-center text-xs pb-3 border-b border-slate-200/60 font-bold uppercase tracking-wider">
                  <span className="text-slate-500">Order Preference</span>
                  <span className="text-amber-700 font-extrabold tracking-widest">
                    {orderType === "delivery" ? "🏠 Delivery" : `🪑 Table ${activeTableLabel}`}
                  </span>
                </div>

                {orderType === "delivery" && (
                  <div className="text-xs pb-3 border-b border-slate-200/60 font-bold uppercase tracking-wider">
                    <span className="text-slate-400 block mb-0.5 tracking-widest text-[9px]">Delivery Address</span>
                    <p className="text-slate-700 leading-normal font-bold">{deliveryAddress}</p>
                  </div>
                )}

                <div className="space-y-3">
                  <span className="text-slate-400 block uppercase tracking-widest text-[9px] font-bold">Tray Items</span>
                  {cart.map((item) => (
                    <div key={item.name} className="flex justify-between items-center text-xs uppercase tracking-wider font-bold">
                      <span className="text-slate-700 font-semibold">
                        {item.name} <span className="text-slate-400 text-[9px] font-bold">×{item.quantity}</span>
                      </span>
                      <span className="font-extrabold text-slate-900">₹{item.price * item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-6 border-t border-slate-200/60 mt-6 flex items-center justify-between">
                <div>
                  <span className="block text-[9px] text-slate-400 uppercase font-bold tracking-widest">Total Payable</span>
                  <span className="text-3xl font-extrabold italic text-amber-700">₹{cartTotal}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowSummaryModal(false); setIsCartOpen(true); }}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-4.5 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all cursor-pointer"
                  >
                    Edit Cart
                  </button>
                  <button
                    onClick={proceedToPayment}
                    className="bg-amber-600 hover:bg-amber-500 text-white px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all cursor-pointer"
                  >
                    Select Payment
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white text-slate-800 w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 relative"
            >
              <button
                onClick={() => setShowPaymentModal(false)}
                className="absolute top-6 right-6 w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="mb-6">
                <h2 className="text-2xl font-extrabold uppercase tracking-tight text-slate-900">Select Payment Method</h2>
                <p className="text-xs text-slate-500 uppercase tracking-wider mt-1 font-semibold">UPI, Credit Card, and Cash at counter are supported.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setSelectedPaymentMethod("upi")}
                  className={`p-4.5 rounded-2xl border text-center flex flex-col items-center justify-center gap-2 transition-all cursor-pointer uppercase tracking-widest ${
                    selectedPaymentMethod === "upi"
                      ? "bg-amber-50 border-amber-500 text-amber-700 font-extrabold"
                      : "bg-slate-50 border-slate-200 hover:border-amber-500/50 text-slate-600"
                  }`}
                >
                  <span className="text-2xl">📱</span>
                  <span className="text-[10px] font-bold">BHIM / UPI</span>
                </button>
                <button
                  onClick={() => setSelectedPaymentMethod("card")}
                  className={`p-4.5 rounded-2xl border text-center flex flex-col items-center justify-center gap-2 transition-all cursor-pointer uppercase tracking-widest ${
                    selectedPaymentMethod === "card"
                      ? "bg-amber-50 border-amber-500 text-amber-700 font-extrabold"
                      : "bg-slate-50 border-slate-200 hover:border-amber-500/50 text-slate-600"
                  }`}
                >
                  <span className="text-2xl">💳</span>
                  <span className="text-[10px] font-bold">Credit Card</span>
                </button>
                <button
                  onClick={() => setSelectedPaymentMethod("netbanking")}
                  className={`p-4.5 rounded-2xl border text-center flex flex-col items-center justify-center gap-2 transition-all cursor-pointer uppercase tracking-widest ${
                    selectedPaymentMethod === "netbanking"
                      ? "bg-amber-50 border-amber-500 text-amber-700 font-extrabold"
                      : "bg-slate-50 border-slate-200 hover:border-amber-500/50 text-slate-600"
                  }`}
                >
                  <span className="text-2xl">🏦</span>
                  <span className="text-[10px] font-bold">Net Banking</span>
                </button>
                <button
                  onClick={() => setSelectedPaymentMethod("pay_at_counter")}
                  className={`p-4.5 rounded-2xl border text-center flex flex-col items-center justify-center gap-2 transition-all cursor-pointer uppercase tracking-widest ${
                    selectedPaymentMethod === "pay_at_counter"
                      ? "bg-amber-50 border-amber-500 text-amber-700 font-extrabold"
                      : "bg-slate-50 border-slate-200 hover:border-amber-500/50 text-slate-600"
                  }`}
                >
                  <span className="text-2xl">💰</span>
                  <span className="text-[10px] font-bold">Pay at Counter</span>
                </button>
              </div>

              <div className="bg-amber-50/50 border border-amber-200 p-4 rounded-2xl mt-6 space-y-1.5 text-[10px] text-amber-700 font-bold uppercase tracking-wider">
                <p className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Razorpay Secured Checkout Enabled</p>
                <p className="text-slate-400 text-[9px] font-medium leading-normal normal-case">Payment processing is simulated for local preview. Confirming will instantly forward your order to chef's line.</p>
              </div>

              <div className="flex gap-2 pt-6 mt-6 border-t border-slate-200/60 justify-end">
                <button
                  onClick={() => { setShowPaymentModal(false); setShowSummaryModal(true); }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-4.5 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all cursor-pointer"
                >
                  Back
                </button>
                <button
                  onClick={handleConfirmOrder}
                  className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all cursor-pointer shadow-md"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm print:hidden">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal header with close button */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-amber-800" />
                  <h3 className="font-extrabold uppercase tracking-wider text-slate-900 text-sm">Invoice Receipt</h3>
                </div>
                <button
                  onClick={() => setSelectedBillOrder(null)}
                  className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 border border-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Printable Invoice Container */}
              <div className="flex-1 overflow-y-auto p-8 space-y-6" id="printable-bill">
                {/* Brand Header */}
                <div className="text-center pb-6 border-b border-dashed border-slate-200">
                  <span className="text-3xl font-black tracking-tighter uppercase italic text-slate-900">
                    Smart<span className="text-amber-800">Menu</span>
                  </span>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Ahmedabad's Premier Dining Experience</p>
                  <p className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">Sarkhej - Gandhinagar Hwy, Ahmedabad, Gujarat</p>
                  <p className="text-[9px] text-slate-400 uppercase tracking-wider">Phone: +91 9999999999 &bull; GSTIN: 24AAACS1234F1Z5</p>
                </div>

                {/* Meta details */}
                <div className="grid grid-cols-2 gap-4 text-[10px] uppercase tracking-wider font-semibold text-slate-600">
                  <div className="space-y-1">
                    <p><span className="text-slate-400 font-bold">Invoice:</span> <span className="font-mono font-bold text-slate-900">{selectedBillOrder.id}</span></p>
                    <p><span className="text-slate-400 font-bold">Date/Time:</span> <span className="text-slate-900">{selectedBillOrder.createdAt}</span></p>
                  </div>
                  <div className="space-y-1 text-right">
                    <p><span className="text-slate-400 font-bold">Service:</span> <span className="text-slate-900 font-bold">{selectedBillOrder.orderType === "delivery" ? "Home Delivery" : `Table ${selectedBillOrder.tableNumber}`}</span></p>
                    <p>
                      <span className="text-slate-400 font-bold">Status:</span>{" "}
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${selectedBillOrder.status === "Completed" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                        {selectedBillOrder.status === "Completed" ? "PAID & SETTLED" : selectedBillOrder.status.toUpperCase()}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Items Table */}
                <div className="border-t border-b border-dashed border-slate-200 py-4">
                  <table className="w-full text-left text-[10px] uppercase tracking-wider font-semibold">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-100 pb-2">
                        <th className="py-1">Dishes Item</th>
                        <th className="text-center py-1">Qty</th>
                        <th className="text-right py-1">Rate</th>
                        <th className="text-right py-1">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {selectedBillOrder.items.map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 font-bold">{it.name}</td>
                          <td className="text-center py-2.5 font-mono">{it.quantity}</td>
                          <td className="text-right py-2.5 font-mono">₹{it.price}</td>
                          <td className="text-right py-2.5 font-mono font-bold text-slate-900">₹{it.price * it.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Calculations */}
                <div className="space-y-1.5 text-[10px] uppercase tracking-wider text-right font-semibold text-slate-600">
                  <p>Subtotal: <span className="font-mono text-slate-900">₹{Math.round(selectedBillOrder.total * 0.95)}</span></p>
                  <p>SGST (2.5%): <span className="font-mono text-slate-900">₹{Math.round(selectedBillOrder.total * 0.025)}</span></p>
                  <p>CGST (2.5%): <span className="font-mono text-slate-900">₹{Math.round(selectedBillOrder.total * 0.025)}</span></p>
                  <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between items-baseline font-bold">
                    <span className="text-slate-900 text-xs">Total Bill Amount:</span>
                    <span className="text-slate-950 text-xl font-black font-mono">₹{selectedBillOrder.total}</span>
                  </div>
                </div>

                {/* Payment meta details */}
                <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl text-[9px] uppercase tracking-widest text-slate-500 space-y-1">
                  <p><span className="font-bold text-slate-700">Payment Mode:</span> {selectedBillOrder.paymentMethod ? selectedBillOrder.paymentMethod.replace("_", " ") : "CASH"}</p>
                  {selectedBillOrder.paymentId && <p><span className="font-bold text-slate-700">Txn Ref ID:</span> <span className="font-mono">{selectedBillOrder.paymentId}</span></p>}
                </div>

                {/* Thank You Note */}
                <div className="text-center space-y-1 pt-4">
                  <p className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">Thank you for dining with us!</p>
                  <p className="text-[8px] text-slate-400 uppercase tracking-widest">Powered by SmartMenu - Contactless Dining Solutions</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3 justify-end print:hidden">
                <button
                  onClick={() => setSelectedBillOrder(null)}
                  className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-6 py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={handlePrintBill}
                  className="bg-slate-950 hover:bg-slate-800 text-white px-6 py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all cursor-pointer flex items-center gap-2 shadow-md hover:scale-105"
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
