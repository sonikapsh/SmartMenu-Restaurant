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
// Support dynamic port in production Cloud Run (PORT=8080) and port 3000 in dev environment
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "Delish Restaurant Management API", timestamp: new Date().toISOString() });
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

// ================= AUTHENTICATION & OWNER-ONLY RBAC SECURITY =================

const AUTH_SECRET = process.env.SESSION_SECRET || "delish_kitchen_jwt_secret_2026";

export interface TokenPayload {
  username: string;
  role: "OWNER";
  exp: number;
}

function createAuthToken(user: { username: string; role: "OWNER" }): string {
  const payload: TokenPayload = {
    username: user.username,
    role: "OWNER",
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
    if (payload.role !== "OWNER") return null;
    return payload;
  } catch {
    return null;
  }
}

// Strict Owner-Only access guard
function requireOwnerRole() {
  return (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "Authentication required. Please sign in as Owner." });
    }
    const token = authHeader.slice(7).trim();
    const decoded = verifyAuthToken(token);
    if (!decoded || decoded.role !== "OWNER") {
      return res.status(403).json({
        success: false,
        error: "Forbidden. Only the authorized Owner account can access this management portal."
      });
    }
    req.user = decoded;
    next();
  };
}

// ================= IN-MEMORY FAST CACHE & CONCURRENCY MUTEX =================

export interface SessionRecord {
  id: string;
  sessionId: string;
  tableId: string;
  status: "active" | "closed";
  billStatus: "open" | "requested" | "paid";
  paymentStatus: "unpaid" | "pending" | "paid" | "failed";
  startedAt: string;
  closedAt?: string | null;
  total: number;
  orderIds: string[];
  closedBy?: string;
}

export interface TableRecord {
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
const verifiedPayments = new Set<string>(); // Idempotent payment reference keys

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
        sess.billStatus = "paid";
        sess.paymentStatus = "paid";
        sess.closedAt = new Date().toISOString();
        sess.closedBy = closedBy;
        sessionStateMap.set(targetSessionId, sess);
      }
      if (db) {
        try {
          await updateDoc(doc(db, "sessions", targetSessionId), {
            status: "closed",
            billStatus: "paid",
            paymentStatus: "paid",
            closedAt: new Date().toISOString(),
            closedBy
          });
        } catch (e) {
          // ignore
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

// 1. OWNER-ONLY LOGIN
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

    // Owner Accounts ONLY
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
        message: "Authorized as Cafe Owner."
      });
    }

    // Explicitly reject any attempt for non-owner logins
    return res.status(401).json({
      success: false,
      error: "Access denied. Only the authorized Cafe Owner account can access this portal."
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Verify Session / Token API
app.get("/api/admin/verify-session", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "No token provided." });
  }
  const token = authHeader.slice(7).trim();
  const payload = verifyAuthToken(token);
  if (!payload || payload.role !== "OWNER") {
    return res.status(401).json({ success: false, error: "Invalid or expired Owner token." });
  }
  res.json({ success: true, user: payload });
});

// Live Tables query endpoint
app.get("/api/tables", (req, res) => {
  res.json({ success: true, tables: Array.from(tableStateMap.values()) });
});

// 3. Get or Create Active Dining Session (Strict Concurrency & Second Customer Guarding)
app.post("/api/sessions/get-or-create", async (req, res) => {
  try {
    const rawTable = req.body.tableId || req.body.tableNumber;
    const existingSessionId = req.body.existingSessionId || req.body.sessionId;
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
          // If the customer already holds this session ID (e.g. reload or second order), resume it
          if (existingSessionId && existingSessionId === existingSession.sessionId) {
            return {
              success: true,
              sessionId: existingSession.sessionId,
              isNew: false,
              session: existingSession,
              table
            };
          }

          // PART 12: An unrelated customer MUST NOT take over or start Session B on an occupied table!
          return {
            success: false,
            occupied: true,
            error: `Table ${tStr} is currently occupied with an active dining party. Please speak with staff or select another available table.`,
            sessionId: existingSession.sessionId,
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
        billStatus: "open",
        paymentStatus: "unpaid",
        startedAt: new Date().toISOString(),
        closedAt: null,
        total: 0,
        orderIds: []
      };

      sessionStateMap.set(newSessionId, newSession);

      // Update table state
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
          // ignore
        }
      }

      return {
        success: true,
        sessionId: newSessionId,
        isNew: true,
        session: newSession,
        table
      };
    });

    if (!result.success && result.occupied) {
      return res.status(409).json(result);
    }

    res.json(result);
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

// 5. RESTAURANT FLOW: Idempotent Order Creation (NO immediate payment for dine-in!)
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

    // B. Table & Order Type Validation
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
      // Find or create active session for table atomically
      finalSessionId = await withTableMutex(finalTable, async () => {
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
          billStatus: "open",
          paymentStatus: "unpaid",
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
    }

    // D. Build New Order (Separated Order & Payment Status)
    const orderId = "ORD-" + Math.random().toString(36).substring(2, 9).toUpperCase();
    const orderAmount = Number(total) || 0;

    // Dine-in orders are initially UNPAID (added to running bill of session)
    const isDelivery = finalOrderType === "delivery";
    const initialPaymentStatus = isDelivery
      ? (paymentId && paymentId !== "COUNTER_CASH" ? "paid" : "pending")
      : "unpaid";

    const newOrder = {
      id: orderId,
      tableNumber: finalOrderType === "dine_in" ? finalTable : "Delivery",
      orderType: finalOrderType,
      deliveryAddress: finalOrderType === "delivery" ? (deliveryAddress || "") : "",
      items,
      total: orderAmount,
      status: "Received", // Order lifecycle: Received -> Preparing -> Ready -> Completed
      paymentStatus: initialPaymentStatus, // Payment lifecycle: unpaid -> pending -> paid
      createdAt: new Date().toLocaleString("en-US", { hour12: true }),
      createdIso: new Date().toISOString(),
      paymentMethod: isDelivery ? (paymentMethod || "Cash on Delivery") : "Dining Session Bill",
      paymentId: paymentId || "",
      sessionId: finalSessionId,
      idempotencyKey: idempotencyKey || orderId,
      isQrOrder: Boolean(isQrOrder)
    };

    // Store in idempotency cache
    if (idempotencyKey) {
      processedOrders.set(idempotencyKey, newOrder);
    }

    // Link order to active session and update running total
    let runningTotal = orderAmount;
    if (finalSessionId && sessionStateMap.has(finalSessionId)) {
      const sess = sessionStateMap.get(finalSessionId)!;
      sess.orderIds.push(orderId);
      sess.total += orderAmount;
      runningTotal = sess.total;
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
      tableNumber: finalTable,
      runningTotal
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. RUNNING BILL & FINAL BILL API
app.get("/api/sessions/:sessionId/bill", async (req, res) => {
  try {
    const { sessionId } = req.params;
    let session = sessionStateMap.get(sessionId);

    // Fallback to Firestore if not in memory
    if (!session && db) {
      try {
        const snap = await getDoc(doc(db, "sessions", sessionId));
        if (snap.exists()) {
          session = snap.data() as SessionRecord;
        }
      } catch (e) {}
    }

    if (!session) {
      return res.status(404).json({ success: false, error: "Dining session not found." });
    }

    // Gather orders in this session
    const orders: any[] = [];
    if (db) {
      try {
        const q = query(collection(db, "orders"), where("sessionId", "==", sessionId));
        const qSnap = await getDocs(q);
        qSnap.forEach((d) => {
          const ord = d.data();
          if (ord.status !== "Cancelled") {
            orders.push(ord);
          }
        });
      } catch (e) {
        // Fallback to in-memory orders
        processedOrders.forEach((o) => {
          if (o.sessionId === sessionId && o.status !== "Cancelled") {
            orders.push(o);
          }
        });
      }
    }

    // Sort chronologically
    orders.sort((a, b) => (a.createdIso || a.createdAt || "").localeCompare(b.createdIso || b.createdAt || ""));

    const subtotal = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const sgst = Math.round(subtotal * 0.025);
    const cgst = Math.round(subtotal * 0.025);
    const finalAmount = subtotal; // Inclusive menu pricing matching existing cafe standard

    res.json({
      success: true,
      session,
      orders,
      subtotal,
      taxes: {
        sgst,
        cgst,
        rate: "5% GST inclusive"
      },
      finalAmount,
      billStatus: session.billStatus || "open",
      paymentStatus: session.paymentStatus || "unpaid"
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Customer REQUEST FINAL BILL
app.post("/api/sessions/:sessionId/request-bill", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = sessionStateMap.get(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, error: "Active dining session not found." });
    }

    session.billStatus = "requested";
    sessionStateMap.set(sessionId, session);

    if (db) {
      try {
        await updateDoc(doc(db, "sessions", sessionId), { billStatus: "requested" });
      } catch (e) {}
    }

    res.json({ success: true, billStatus: "requested", session });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. RAZORPAY FINAL BILL PAYMENT INITIALIZATION
app.post("/api/payment/create-order", async (req, res) => {
  try {
    const { amount, sessionId } = req.body; // In INR
    const keyId = process.env.RAZORPAY_KEY_ID?.trim();
    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();

    let finalAmount = Number(amount);
    if (sessionId && sessionStateMap.has(sessionId)) {
      finalAmount = sessionStateMap.get(sessionId)!.total;
    }

    if (!finalAmount || isNaN(finalAmount) || finalAmount <= 0) {
      return res.status(400).json({ success: false, error: "Invalid amount or empty bill." });
    }

    // Fallback if Razorpay keys are not provided
    if (!keyId || !keySecret) {
      return res.json({
        success: true,
        simulated: true,
        order_id: "order_sim_" + generateId(),
        amount: Math.round(finalAmount * 100), // in paise
        key_id: "rzp_test_mock_key_id"
      });
    }

    // Real Razorpay REST API call
    const authString = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${authString}`
      },
      body: JSON.stringify({
        amount: Math.round(finalAmount * 100), // paise
        currency: "INR",
        receipt: "delish_bill_" + generateId()
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
      res.status(400).json({
        success: false,
        error: data.error?.description || "Failed to create order on Razorpay servers"
      });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. PAYMENT VERIFICATION & FINAL SESSION SETTLEMENT (Idempotent)
app.post("/api/payment/verify", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      sessionId,
      tableNumber,
      orderId
    } = req.body;

    const paymentKey = `${razorpay_order_id}_${razorpay_payment_id}`;
    if (verifiedPayments.has(paymentKey)) {
      return res.json({
        success: true,
        verified: true,
        alreadyProcessed: true,
        message: "Payment already verified and finalized (idempotent)."
      });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();

    let isVerified = false;
    if (!keySecret || razorpay_order_id?.startsWith("order_sim_") || razorpay_payment_id?.startsWith("PAY_SIM_")) {
      // Test mode / simulated verification
      isVerified = true;
    } else {
      const generatedSignature = crypto
        .createHmac("sha256", keySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");
      isVerified = generatedSignature === razorpay_signature;
    }

    if (!isVerified) {
      // Failed payment
      if (sessionId && sessionStateMap.has(sessionId)) {
        const sess = sessionStateMap.get(sessionId)!;
        sess.paymentStatus = "failed";
        sessionStateMap.set(sessionId, sess);
      }
      return res.status(400).json({
        success: false,
        error: "Cryptographic signature verification failed. Bill remains unpaid."
      });
    }

    verifiedPayments.add(paymentKey);

    // If payment was for a single delivery order
    if (orderId && db) {
      try {
        await updateDoc(doc(db, "orders", orderId), {
          paymentStatus: "paid",
          paymentId: razorpay_payment_id
        });
      } catch (e) {}
    }

    // FINAL BILL SETTLEMENT FOR DINING SESSION:
    // Close session, mark bill paid, mark all orders paid, release table to AVAILABLE
    if (sessionId) {
      const session = sessionStateMap.get(sessionId);
      const targetTable = tableNumber || (session ? session.tableId : null);

      if (targetTable) {
        await closeTableSessionInternal(String(targetTable), sessionId, "razorpay_final_bill");
      }

      // Mark all orders in this session as paid in Firestore
      if (db) {
        try {
          const q = query(collection(db, "orders"), where("sessionId", "==", sessionId));
          const snap = await getDocs(q);
          const updatePromises = snap.docs.map((d) =>
            updateDoc(d.ref, {
              paymentStatus: "paid",
              paymentId: razorpay_payment_id
            })
          );
          await Promise.all(updatePromises);
        } catch (e) {
          console.error("Error marking session orders paid:", e);
        }
      }
    }

    res.json({
      success: true,
      verified: true,
      message: "Final bill paid and verified successfully. Dining session settled and table released!"
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 10. OWNER: Close Session / Release Table Manually
app.post("/api/admin/sessions/close", requireOwnerRole(), async (req: any, res) => {
  try {
    const rawTableId = req.body.tableId || req.body.tableNumber;
    const { sessionId } = req.body;
    if (!rawTableId) {
      return res.status(400).json({ success: false, error: "tableId or tableNumber is required." });
    }

    const result = await closeTableSessionInternal(String(rawTableId), sessionId, "owner_manual");
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 11. OWNER: Advance Order Status (Received -> Preparing -> Ready -> Completed)
app.post("/api/admin/orders/update-status", requireOwnerRole(), async (req, res) => {
  try {
    const { orderId, status } = req.body;
    const allowed = ["Received", "Preparing", "Ready", "Completed", "Cancelled"];
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

// 12. OWNER: CANCEL RESERVATION (Actually updates backend & releases table if appropriate)
app.post("/api/admin/reservations/cancel", requireOwnerRole(), async (req, res) => {
  try {
    const { reservationId, tableNumber } = req.body;
    if (!reservationId) {
      return res.status(400).json({ success: false, error: "reservationId is required." });
    }

    if (db) {
      await updateDoc(doc(db, "reservations", reservationId), {
        status: "cancelled",
        cancelledAt: new Date().toISOString()
      });
    }

    // Check if table should be released: only if no active dining session is currently ongoing
    if (tableNumber) {
      const tStr = String(tableNumber);
      const table = tableStateMap.get(tStr);
      if (table && !table.activeSessionId) {
        table.status = "available";
        table.updatedAt = new Date().toISOString();
        tableStateMap.set(tStr, table);
        if (db) {
          try {
            await setDoc(doc(db, "tables", tStr), table);
          } catch (e) {}
        }
      }
    }

    res.json({ success: true, reservationId, status: "cancelled", message: "Reservation cancelled." });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 13. OWNER: CHECK IN / SEAT RESERVATION (Customer arrives)
app.post("/api/admin/reservations/check-in", requireOwnerRole(), async (req, res) => {
  try {
    const { reservationId, tableNumber } = req.body;
    if (!reservationId || !tableNumber) {
      return res.status(400).json({ success: false, error: "reservationId and tableNumber are required." });
    }

    const tStr = String(tableNumber);

    // Atomically seat guest and activate table session
    const sessionResult = await withTableMutex(tStr, async () => {
      let table = tableStateMap.get(tStr) || {
        id: tStr,
        tableNumber: tStr,
        status: "available",
        activeSessionId: null,
        updatedAt: new Date().toISOString()
      };

      let sessId = table.activeSessionId;
      if (!sessId || !sessionStateMap.has(sessId) || sessionStateMap.get(sessId)!.status !== "active") {
        sessId = `SESS_T${tStr}_${Date.now()}_${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
        const newSess: SessionRecord = {
          id: sessId,
          sessionId: sessId,
          tableId: tStr,
          status: "active",
          billStatus: "open",
          paymentStatus: "unpaid",
          startedAt: new Date().toISOString(),
          closedAt: null,
          total: 0,
          orderIds: []
        };
        sessionStateMap.set(sessId, newSess);
        if (db) {
          try {
            await setDoc(doc(db, "sessions", sessId), newSess);
          } catch (e) {}
        }
      }

      table.status = "occupied";
      table.activeSessionId = sessId;
      table.updatedAt = new Date().toISOString();
      tableStateMap.set(tStr, table);

      if (db) {
        try {
          await setDoc(doc(db, "tables", tStr), table);
          await updateDoc(doc(db, "reservations", reservationId), {
            status: "seated",
            sessionId: sessId,
            seatedAt: new Date().toISOString()
          });
        } catch (e) {}
      }

      return { sessionId: sessId, table };
    });

    res.json({
      success: true,
      reservationId,
      status: "seated",
      sessionId: sessionResult.sessionId,
      table: sessionResult.table
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 14. OWNER: TODAY'S OPERATIONAL ORDERS ONLY
app.get("/api/admin/orders/today", requireOwnerRole(), async (req, res) => {
  try {
    const todayStr = new Date().toLocaleDateString("en-US");
    const todayOrders: any[] = [];

    if (db) {
      try {
        const snap = await getDocs(collection(db, "orders"));
        snap.forEach((d) => {
          const ord = d.data();
          // Filter to today only and exclude Expired
          const isToday =
            ord.createdAt?.includes(todayStr) ||
            (ord.createdIso && new Date(ord.createdIso).toDateString() === new Date().toDateString());

          if (isToday && ord.status !== "Expired") {
            todayOrders.push(ord);
          }
        });
      } catch (e) {}
    }

    if (todayOrders.length === 0) {
      processedOrders.forEach((ord) => {
        if (ord.status !== "Expired") todayOrders.push(ord);
      });
    }

    // Sort newest first
    todayOrders.sort((a, b) => (b.createdIso || b.createdAt || "").localeCompare(a.createdIso || a.createdAt || ""));

    res.json({ success: true, orders: todayOrders });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 15. OWNER: INCOME ANALYTICS (TODAY / THIS WEEK / THIS MONTH)
app.get("/api/admin/analytics", requireOwnerRole(), async (req, res) => {
  try {
    const timeframe = (req.query.timeframe as string) || "today"; // "today" | "week" | "month"
    const now = new Date();

    let startTime = new Date();
    if (timeframe === "today") {
      startTime.setHours(0, 0, 0, 0);
    } else if (timeframe === "week") {
      // 7 days ago
      startTime.setDate(now.getDate() - 7);
      startTime.setHours(0, 0, 0, 0);
    } else if (timeframe === "month") {
      // 30 days ago
      startTime.setDate(now.getDate() - 30);
      startTime.setHours(0, 0, 0, 0);
    }

    const allOrdersList: any[] = [];
    if (db) {
      try {
        const snap = await getDocs(collection(db, "orders"));
        snap.forEach((d) => allOrdersList.push(d.data()));
      } catch (e) {}
    }

    if (allOrdersList.length === 0) {
      processedOrders.forEach((ord) => allOrdersList.push(ord));
    }

    // Filter within timeframe
    const filteredOrders = allOrdersList.filter((ord) => {
      if (ord.status === "Cancelled" || ord.status === "Expired") return false;
      const d = ord.createdIso ? new Date(ord.createdIso) : new Date(ord.createdAt);
      if (isNaN(d.getTime())) return true; // Include if date parsing fails
      return d >= startTime && d <= now;
    });

    // Only count successfully paid / completed revenue
    const validPaidOrders = filteredOrders.filter(
      (o) => o.paymentStatus === "paid" || o.status === "Completed"
    );

    const grossRevenue = validPaidOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const netRevenue = Math.round(grossRevenue / 1.05); // Exclude 5% GST

    const paidOrdersCount = validPaidOrders.length;
    const completedOrdersCount = filteredOrders.filter((o) => o.status === "Completed").length;

    res.json({
      success: true,
      timeframe,
      metrics: {
        grossRevenue,
        netRevenue,
        paidOrdersCount,
        completedOrdersCount,
        totalOrdersCount: filteredOrders.length
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ================= BACKGROUND SCHEDULED WORKER =================
// 1. Auto-cancel reservation No-Shows (45-min grace period)
// 2. Mark stale orders (>24h incomplete) as "Expired"
setInterval(async () => {
  if (!db) return;

  try {
    const now = new Date();

    // A. Check No-Show Reservations
    const resSnap = await getDocs(collection(db, "reservations"));
    resSnap.forEach(async (docSnap) => {
      const resData = docSnap.data();
      if (resData.status === "confirmed") {
        // Parse reservation date & time
        try {
          const resDateTimeStr = `${resData.date} ${resData.time}`;
          const resDate = new Date(resDateTimeStr);
          // If valid date and > 45 minutes elapsed past slot time
          if (!isNaN(resDate.getTime())) {
            const diffMinutes = (now.getTime() - resDate.getTime()) / (1000 * 60);
            if (diffMinutes > 45) {
              await updateDoc(docSnap.ref, {
                status: "no_show",
                cancelledReason: "Automatic no-show expiration (45 min grace period exceeded)"
              });

              // Release table if no active dining session
              const tStr = String(resData.table);
              const table = tableStateMap.get(tStr);
              if (table && !table.activeSessionId) {
                table.status = "available";
                tableStateMap.set(tStr, table);
                await setDoc(doc(db, "tables", tStr), table);
              }
            }
          }
        } catch (err) {}
      }
    });

    // B. Check Stale Orders (>24 hours old and still Received or Preparing)
    const orderSnap = await getDocs(collection(db, "orders"));
    orderSnap.forEach(async (dSnap) => {
      const ord = dSnap.data();
      if (ord.status === "Received" || ord.status === "Preparing") {
        const ordDate = ord.createdIso ? new Date(ord.createdIso) : new Date(ord.createdAt);
        if (!isNaN(ordDate.getTime())) {
          const ageHours = (now.getTime() - ordDate.getTime()) / (1000 * 60 * 60);
          if (ageHours > 24) {
            await updateDoc(dSnap.ref, { status: "Expired" });
          }
        }
      }
    });
  } catch (workerErr) {
    // Non-blocking background worker
  }
}, 60 * 1000); // Check every minute

// ================= MIDDLEWARE SETUP =================

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
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
    console.log(`Delish Cafe Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
