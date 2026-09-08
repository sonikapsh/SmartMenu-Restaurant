import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs
} from "firebase/firestore";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "Delish Kitchen API", timestamp: new Date().toISOString() });
});

// Initialize Firebase Client SDK in backend for synchronized state
let db: any = null;
try {
  const configPath = path.resolve("firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const firebaseApp = initializeApp(firebaseConfig);
    db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
  }
} catch (err) {
  console.error("Firebase backend init notice:", err);
}

// Helper to generate IDs
const generateId = () => Math.random().toString(36).substring(2, 9).toUpperCase();

// ================= AUTHENTICATION & RBAC SECURITY =================

const AUTH_SECRET = process.env.SESSION_SECRET || "delish_kitchen_jwt_secret_2026";

export interface TokenPayload {
  username: string;
  role: "OWNER" | "MANAGER" | "STAFF" | "KITCHEN" | "DELIVERY" | "CUSTOMER";
  exp: number;
}

function createAuthToken(user: { username: string; role: TokenPayload["role"] }): string {
  const payload: TokenPayload = {
    username: user.username,
    role: user.role,
    exp: Date.now() + 24 * 60 * 60 * 1000 // 24 hour session
  };
  const str = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", AUTH_SECRET).update(str).digest("base64url");
  return `${str}.${sig}`;
}

function verifyAuthToken(token: string): TokenPayload | null {
  try {
    if (!token || !token.includes(".")) return null;
    const [str, sig] = token.split(".");
    const expectedSig = crypto.createHmac("sha256", AUTH_SECRET).update(str).digest("base64url");
    if (sig !== expectedSig) return null;
    const payload: TokenPayload = JSON.parse(Buffer.from(str, "base64url").toString("utf8"));
    if (!payload || !payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function requireRole(allowedRoles: TokenPayload["role"][]) {
  return (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "Authentication required." });
    }
    const token = authHeader.slice(7).trim();
    const decoded = verifyAuthToken(token);
    if (!decoded) {
      return res.status(401).json({ success: false, error: "Invalid or expired authorization token." });
    }
    if (!allowedRoles.includes(decoded.role)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden. Role '${decoded.role}' is not authorized for this operation.`
      });
    }
    req.user = decoded;
    next();
  };
}

// ================= IN-MEMORY FAST CACHE & CONCURRENCY MUTEX =================

interface SessionRecord {
  id: string;
  sessionId: string;
  tableId: string;
  status: "active" | "closed";
  startedAt: string;
  closedAt?: string | null;
  total: number;
  orderIds: string[];
  closedBy?: string;
}

interface TableRecord {
  id: string;
  tableNumber: string;
  status: "available" | "occupied";
  activeSessionId: string | null;
  updatedAt: string;
}

// In-memory state for immediate concurrency guarantees
const tableStateMap = new Map<string, TableRecord>();
const sessionStateMap = new Map<string, SessionRecord>();
const processedOrders = new Map<string, any>(); // Idempotency protection

// Initialize tables 1 to 10
for (let i = 1; i <= 10; i++) {
  const tStr = String(i);
  tableStateMap.set(tStr, {
    id: tStr,
    tableNumber: tStr,
    status: "available",
    activeSessionId: null,
    updatedAt: new Date().toISOString()
  });
}

// Per-table promise mutex to guarantee ONE active session creation under concurrent requests
const tableMutexes = new Map<string, Promise<void>>();

async function withTableMutex<T>(tableId: string, fn: () => Promise<T>): Promise<T> {
  const currentMutex = tableMutexes.get(tableId) || Promise.resolve();
  let release: () => void;
  const nextMutex = new Promise<void>((resolve) => {
    release = resolve;
  });
  tableMutexes.set(tableId, nextMutex);

  try {
    await currentMutex;
    return await fn();
  } finally {
    release!();
    if (tableMutexes.get(tableId) === nextMutex) {
      tableMutexes.delete(tableId);
    }
  }
}

// Close table session helper (atomic)
async function closeTableSessionInternal(tableId: string, sessionId?: string, closedBy: string = "system") {
  return await withTableMutex(tableId, async () => {
    const table = tableStateMap.get(tableId) || {
      id: tableId,
      tableNumber: tableId,
      status: "available",
      activeSessionId: null,
      updatedAt: new Date().toISOString()
    };

    const targetSessionId = sessionId || table.activeSessionId;
    if (targetSessionId) {
      const sess = sessionStateMap.get(targetSessionId);
      if (sess) {
        sess.status = "closed";
        sess.closedAt = new Date().toISOString();
        sess.closedBy = closedBy;
        sessionStateMap.set(targetSessionId, sess);
      }
      if (db) {
        try {
          await updateDoc(doc(db, "sessions", targetSessionId), {
            status: "closed",
            closedAt: new Date().toISOString(),
            closedBy
          });
        } catch (e) {
          // ignore or log
        }
      }
    }

    table.status = "available";
    table.activeSessionId = null;
    table.updatedAt = new Date().toISOString();
    tableStateMap.set(tableId, table);

    if (db) {
      try {
        await setDoc(doc(db, "tables", tableId), table);
      } catch (e) {
        // ignore
      }
    }

    return { success: true, tableId, closedSessionId: targetSessionId };
  });
}

// ================= API ENDPOINTS =================

// 1. Role-Based Login (supports both /api/admin/login and /api/auth/login, with email or username)
app.post(["/api/admin/login", "/api/auth/login"], (req, res) => {
  try {
    const rawUser = req.body.email || req.body.username || "";
    const rawPassword = req.body.password || "";

    const cleanEnvVar = (val: string | undefined, defaultVal: string) => {
      if (!val) return defaultVal;
      return val.replace(/^["']|["']$/g, "").trim();
    };

    const adminEmail = cleanEnvVar(process.env.ADMIN_EMAIL, "admin@gmail.com");
    const adminPassword = cleanEnvVar(process.env.ADMIN_PASSWORD, "admin123");

    if (!rawUser || !rawPassword) {
      return res.status(400).json({ success: false, error: "Missing Email/Username or Password." });
    }

    const inputUser = rawUser.trim().toLowerCase();
    const cleanPassword = rawPassword.trim();

    // Owner Accounts
    const ownerUsers = [
      "admin@gmail.com",
      "admin@delishcafe.com",
      adminEmail.toLowerCase(),
      "admin",
      "owner",
      "delish",
      "soni.kapsh@gmail.com"
    ];

    const validOwnerPasswords = ["admin123", "delish2026", "admin@123", adminPassword];

    if (ownerUsers.includes(inputUser) && validOwnerPasswords.includes(cleanPassword)) {
      const token = createAuthToken({ username: inputUser, role: "OWNER" });
      return res.json({
        success: true,
        token,
        role: "OWNER",
        user: { username: inputUser, role: "OWNER" },
        message: "Authorized as Owner."
      });
    }

    // Kitchen Portal Account
    if (inputUser === "kitchen" && (cleanPassword === "kitchen123" || validOwnerPasswords.includes(cleanPassword))) {
      const token = createAuthToken({ username: "kitchen", role: "KITCHEN" });
      return res.json({
        success: true,
        token,
        role: "KITCHEN",
        user: { username: "kitchen", role: "KITCHEN" },
        message: "Authorized as Kitchen Staff."
      });
    }

    // Staff Portal Account
    if (inputUser === "staff" && (cleanPassword === "staff123" || validOwnerPasswords.includes(cleanPassword))) {
      const token = createAuthToken({ username: "staff", role: "STAFF" });
      return res.json({
        success: true,
        token,
        role: "STAFF",
        user: { username: "staff", role: "STAFF" },
        message: "Authorized as Floor Staff."
      });
    }

    // Manager Portal Account
    if (inputUser === "manager" && (cleanPassword === "manager123" || validOwnerPasswords.includes(cleanPassword))) {
      const token = createAuthToken({ username: "manager", role: "MANAGER" });
      return res.json({
        success: true,
        token,
        role: "MANAGER",
        user: { username: "manager", role: "MANAGER" },
        message: "Authorized as Manager."
      });
    }

    return res.status(401).json({ success: false, error: "Invalid credentials." });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Live Tables query endpoint
app.get("/api/tables", (req, res) => {
  res.json({ success: true, tables: Array.from(tableStateMap.values()) });
});

// 2. Verify Session / Token API
app.get("/api/admin/verify-session", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "No token provided." });
  }
  const token = authHeader.slice(7).trim();
  const payload = verifyAuthToken(token);
  if (!payload) {
    return res.status(401).json({ success: false, error: "Invalid or expired token." });
  }
  res.json({ success: true, user: payload });
});

// 3. Get or Create Active Dining Session (Concurrency & Race condition safe)
app.post("/api/sessions/get-or-create", async (req, res) => {
  try {
    const rawTable = req.body.tableId || req.body.tableNumber;
    const num = parseInt(rawTable, 10);
    if (isNaN(num) || num < 1 || num > 10) {
      return res.status(400).json({ success: false, error: "Invalid tableId (must be 1 to 10)." });
    }

    const tStr = String(num);

    const result = await withTableMutex(tStr, async () => {
      let table = tableStateMap.get(tStr);
      if (!table) {
        table = {
          id: tStr,
          tableNumber: tStr,
          status: "available",
          activeSessionId: null,
          updatedAt: new Date().toISOString()
        };
        tableStateMap.set(tStr, table);
      }

      // Check if table currently has an active session
      if (table.activeSessionId) {
        const existingSession = sessionStateMap.get(table.activeSessionId);
        if (existingSession && existingSession.status === "active") {
          return {
            sessionId: existingSession.sessionId,
            isNew: false,
            session: existingSession,
            table
          };
        }
      }

      // If no active session, create a brand new one
      const newSessionId = `SESS_T${tStr}_${Date.now()}_${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
      const newSession: SessionRecord = {
        id: newSessionId,
        sessionId: newSessionId,
        tableId: tStr,
        status: "active",
        startedAt: new Date().toISOString(),
        closedAt: null,
        total: 0,
        orderIds: []
      };

      sessionStateMap.set(newSessionId, newSession);

      // Update table
      table.status = "occupied";
      table.activeSessionId = newSessionId;
      table.updatedAt = new Date().toISOString();
      tableStateMap.set(tStr, table);

      // Persist to Firestore
      if (db) {
        try {
          await setDoc(doc(db, "sessions", newSessionId), newSession);
          await setDoc(doc(db, "tables", tStr), table);
        } catch (e) {
          // ignore or log
        }
      }

      return {
        sessionId: newSessionId,
        isNew: true,
        session: newSession,
        table
      };
    });

    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Get All Tables & Active Sessions (For Dashboard and Sync)
app.get("/api/sessions/active", (req, res) => {
  const tables: TableRecord[] = [];
  tableStateMap.forEach((val) => tables.push(val));
  tables.sort((a, b) => parseInt(a.tableNumber, 10) - parseInt(b.tableNumber, 10));

  const activeSessions: SessionRecord[] = [];
  sessionStateMap.forEach((val) => {
    if (val.status === "active") {
      activeSessions.push(val);
    }
  });

  res.json({ success: true, tables, activeSessions });
});

// 5. Staff/Admin Close Session & Release Table
app.post("/api/admin/sessions/close", requireRole(["OWNER", "MANAGER", "STAFF"]), async (req: any, res) => {
  try {
    const rawTableId = req.body.tableId || req.body.tableNumber;
    const { sessionId, reason } = req.body;
    if (!rawTableId) {
      return res.status(400).json({ success: false, error: "tableId or tableNumber is required." });
    }

    const result = await closeTableSessionInternal(String(rawTableId), sessionId, req.user?.role || "STAFF");
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Idempotent Order Creation with Table Locking & Concurrency Protection
app.post("/api/orders/create", async (req, res) => {
  try {
    const {
      idempotencyKey,
      tableNumber,
      orderType,
      deliveryAddress,
      items,
      total,
      paymentMethod,
      paymentId,
      sessionId,
      isQrOrder,
      qrTable
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: "Cart cannot be empty." });
    }

    // A. Idempotency Check: Prevent duplicate submissions
    if (idempotencyKey && processedOrders.has(idempotencyKey)) {
      const cached = processedOrders.get(idempotencyKey);
      return res.json({
        success: true,
        duplicated: true,
        order: cached,
        message: "Order already processed (idempotent duplicate request caught)."
      });
    }

    // B. Table QR Lock Validation:
    // If entered via QR, strictly enforce that tableNumber matches qrTable and orderType is dine_in
    let finalTable = tableNumber;
    let finalOrderType = orderType;

    if (isQrOrder && qrTable) {
      finalTable = String(qrTable);
      finalOrderType = "dine_in";
    }

    if (finalOrderType === "dine_in") {
      const num = parseInt(finalTable, 10);
      if (isNaN(num) || num < 1 || num > 10) {
        return res.status(400).json({ success: false, error: "Invalid dine-in table number (1-10)." });
      }
      finalTable = String(num);
    }

    // C. Dining Session Association for Dine-In
    let finalSessionId = sessionId;
    if (finalOrderType === "dine_in") {
      // Find or create active session for table
      const sessResult = await withTableMutex(finalTable, async () => {
        let table = tableStateMap.get(finalTable);
        if (!table) {
          table = {
            id: finalTable,
            tableNumber: finalTable,
            status: "available",
            activeSessionId: null,
            updatedAt: new Date().toISOString()
          };
          tableStateMap.set(finalTable, table);
        }

        if (table.activeSessionId) {
          const sess = sessionStateMap.get(table.activeSessionId);
          if (sess && sess.status === "active") {
            return sess.sessionId;
          }
        }

        // Create new session if none active
        const newSessId = `SESS_T${finalTable}_${Date.now()}_${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
        const newSess: SessionRecord = {
          id: newSessId,
          sessionId: newSessId,
          tableId: finalTable,
          status: "active",
          startedAt: new Date().toISOString(),
          closedAt: null,
          total: 0,
          orderIds: []
        };
        sessionStateMap.set(newSessId, newSess);

        table.status = "occupied";
        table.activeSessionId = newSessId;
        table.updatedAt = new Date().toISOString();
        tableStateMap.set(finalTable, table);

        if (db) {
          try {
            await setDoc(doc(db, "sessions", newSessId), newSess);
            await setDoc(doc(db, "tables", finalTable), table);
          } catch (e) {
            // ignore
          }
        }

        return newSessId;
      });

      finalSessionId = sessResult;
    }

    // D. Build New Order
    const orderId = "ORD-" + Math.random().toString(36).substring(2, 9).toUpperCase();
    const newOrder = {
      id: orderId,
      tableNumber: finalOrderType === "dine_in" ? finalTable : "Delivery",
      orderType: finalOrderType,
      deliveryAddress: finalOrderType === "delivery" ? (deliveryAddress || "") : "",
      items,
      total: Number(total) || 0,
      status: "Received",
      createdAt: new Date().toLocaleString("en-US", { hour12: true }),
      paymentMethod: paymentMethod || "Cash at Counter",
      paymentId: paymentId || "COUNTER_CASH",
      paymentStatus: paymentId && paymentId !== "COUNTER_CASH" ? "paid" : "pending",
      sessionId: finalSessionId,
      idempotencyKey: idempotencyKey || orderId,
      isQrOrder: Boolean(isQrOrder)
    };

    // Store in idempotency cache
    if (idempotencyKey) {
      processedOrders.set(idempotencyKey, newOrder);
    }

    // Link order to active session in memory and update running session total
    if (finalSessionId && sessionStateMap.has(finalSessionId)) {
      const sess = sessionStateMap.get(finalSessionId)!;
      sess.orderIds.push(orderId);
      sess.total += Number(total) || 0;
      sessionStateMap.set(finalSessionId, sess);

      if (db) {
        try {
          await updateDoc(doc(db, "sessions", finalSessionId), {
            orderIds: sess.orderIds,
            total: sess.total
          });
        } catch (e) {
          // ignore
        }
      }
    }

    // Persist order to Firestore
    if (db) {
      try {
        await setDoc(doc(db, "orders", orderId), newOrder);
      } catch (e) {
        console.error("Firestore backend order save error:", e);
      }
    }

    res.json({
      success: true,
      duplicated: false,
      order: newOrder,
      sessionId: finalSessionId,
      tableNumber: finalTable
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Secure Razorpay Online Payment Order Creation
app.post("/api/payment/create-order", async (req, res) => {
  try {
    const { amount } = req.body; // In INR
    const keyId = process.env.RAZORPAY_KEY_ID?.trim();
    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();

    if (!amount || isNaN(Number(amount))) {
      return res.status(400).json({ success: false, error: "Invalid amount" });
    }

    // Fallback if Razorpay keys are not in the environment yet
    if (!keyId || !keySecret) {
      return res.json({
        success: true,
        simulated: true,
        order_id: "order_sim_" + generateId(),
        amount: Math.round(amount * 100), // paise
        key_id: "rzp_test_mock_key_id"
      });
    }

    // Real Razorpay REST API call to generate Order ID
    const authString = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${authString}`
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100), // paise
        currency: "INR",
        receipt: "receipt_rc_" + generateId()
      })
    });

    const data: any = await response.json();
    if (response.ok && data.id) {
      res.json({
        success: true,
        simulated: false,
        order_id: data.id,
        amount: data.amount,
        key_id: keyId
      });
    } else {
      console.error("Razorpay API Error Response:", data);
      res.status(400).json({
        success: false,
        error: data.error?.description || "Failed to create order on Razorpay servers"
      });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Payment Verification & Session Integration
app.post("/api/payment/verify", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId,
      sessionId,
      tableNumber,
      closeSessionAfterPay
    } = req.body;

    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();

    let isVerified = false;
    if (!keySecret || razorpay_order_id?.startsWith("order_sim_") || razorpay_payment_id?.startsWith("PAY_SIM_")) {
      // Simulated / test mode verification
      isVerified = true;
    } else {
      const generatedSignature = crypto
        .createHmac("sha256", keySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");
      isVerified = generatedSignature === razorpay_signature;
    }

    if (!isVerified) {
      return res.status(400).json({ success: false, error: "Cryptographic signature verification failed." });
    }

    // Update order paymentStatus if orderId given
    if (orderId && db) {
      try {
        await updateDoc(doc(db, "orders", orderId), {
          paymentStatus: "paid",
          paymentId: razorpay_payment_id
        });
      } catch (e) {
        // ignore
      }
    }

    // If final payment completes session, close it and free table
    if (closeSessionAfterPay && tableNumber && sessionId) {
      await closeTableSessionInternal(String(tableNumber), sessionId, "payment_completion");
    }

    res.json({ success: true, verified: true, message: "Payment verified successfully." });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. Order Status Update (Restricted to Kitchen / Staff / Owner)
app.post("/api/admin/orders/update-status", requireRole(["OWNER", "MANAGER", "STAFF", "KITCHEN"]), async (req, res) => {
  try {
    const { orderId, status } = req.body;
    const allowed = ["Received", "Preparing", "Ready", "Completed"];
    if (!orderId || !allowed.includes(status)) {
      return res.status(400).json({ success: false, error: "Invalid orderId or status." });
    }

    if (db) {
      await updateDoc(doc(db, "orders", orderId), { status });
    }

    res.json({ success: true, orderId, status });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ================= MIDDLEWARE SETUP =================

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
