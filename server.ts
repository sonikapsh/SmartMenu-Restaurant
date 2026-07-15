import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Helper to generate IDs
const generateId = () => Math.random().toString(36).substring(2, 9).toUpperCase();

// ================= API ENDPOINTS =================

// 1. Secure Razorpay Online Payment Order Creation
app.post("/api/payment/create-order", async (req, res) => {
  try {
    const { amount } = req.body; // In INR
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

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

// 2. Admin Email & Password Authentication
app.post("/api/admin/login", (req, res) => {
  try {
    const { email, password } = req.body;
    const adminEmail = process.env.ADMIN_EMAIL || "admin@smartmenu.com";
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Missing Email or Password" });
    }

    if (email.toLowerCase() === adminEmail.toLowerCase() && password === adminPassword) {
      res.json({ success: true, message: "Authorized admin session successfully." });
    } else {
      res.status(401).json({ success: false, error: "Invalid admin email or password." });
    }
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
