/**
 * Delish Cafe - Production Verification & Security Regression Test Suite
 * Validates all security boundaries, server price validations, session closures,
 * payment verification bypass prevention, reservation conflicts, and data isolation.
 */

const BASE_URL = "http://localhost:3000";

interface TestResult {
  name: string;
  category: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

async function assertTest(
  name: string,
  category: string,
  testFn: () => Promise<{ passed: boolean; details?: string }>
) {
  try {
    const res = await testFn();
    results.push({ name, category, passed: res.passed, details: res.details });
    const symbol = res.passed ? "✓ PASS" : "✗ FAIL";
    console.log(`[${symbol}] [${category}] ${name}`);
    if (!res.passed && res.details) {
      console.log(`   Reason: ${res.details}`);
    }
  } catch (err: any) {
    results.push({ name, category, passed: false, details: err.message });
    console.log(`[✗ FAIL] [${category}] ${name} - Exception: ${err.message}`);
  }
}

async function runTests() {
  console.log("\n=======================================================");
  console.log(" DELISH CAFE PRODUCTION SECURITY & QUALITY AUDIT SUITE");
  console.log("=======================================================\n");

  // 1. DATA PROTECTION & AUTHENTICATION (Phase 2A)
  await assertTest(
    "Anonymous customer cannot read today's admin orders",
    "Security & Auth",
    async () => {
      const res = await fetch(`${BASE_URL}/api/admin/orders/today`);
      const data = await res.json();
      return {
        passed: res.status === 401 && data.success === false,
        details: `Status: ${res.status}, body: ${JSON.stringify(data)}`
      };
    }
  );

  await assertTest(
    "Anonymous customer cannot access executive analytics",
    "Security & Auth",
    async () => {
      const res = await fetch(`${BASE_URL}/api/admin/analytics?timeframe=today`);
      const data = await res.json();
      return {
        passed: res.status === 401 && data.success === false,
        details: `Status: ${res.status}`
      };
    }
  );

  await assertTest(
    "Forged bearer token with invalid signature is rejected with 401/403",
    "Security & Auth",
    async () => {
      const forgedToken = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiT1dORVIiLCJ1c2VybmFtZSI6ImFkbWluIn0.forged_signature";
      const res = await fetch(`${BASE_URL}/api/admin/orders/today`, {
        headers: { Authorization: `Bearer ${forgedToken}` }
      });
      const data = await res.json();
      return {
        passed: res.status === 401 || res.status === 403,
        details: `Status: ${res.status}, body: ${JSON.stringify(data)}`
      };
    }
  );

  await assertTest(
    "Valid Cafe Owner login issues authorized Bearer token",
    "Security & Auth",
    async () => {
      const res = await fetch(`${BASE_URL}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@gmail.com", password: "admin123" })
      });
      const data = await res.json();
      return {
        passed: res.status === 200 && data.success === true && Boolean(data.token),
        details: `Token issued: ${Boolean(data.token)}`
      };
    }
  );

  // Retrieve Owner token for authorized checks
  const loginRes = await fetch(`${BASE_URL}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@gmail.com", password: "admin123" })
  });
  const loginData = await loginRes.json();
  const ownerToken = loginData.token;

  await assertTest(
    "Authenticated Owner token verifies successfully with /api/admin/verify-session",
    "Security & Auth",
    async () => {
      const res = await fetch(`${BASE_URL}/api/admin/verify-session`, {
        headers: { Authorization: `Bearer ${ownerToken}` }
      });
      const data = await res.json();
      return {
        passed: res.status === 200 && data.success === true && data.user?.role === "OWNER",
        details: `User role: ${data.user?.role}`
      };
    }
  );

  // 2. SERVER-SIDE PRICE VALIDATION (Phase 2B)
  await assertTest(
    "Reject price tampering (client sends ₹10 total instead of authoritative ₹280)",
    "Price Validation",
    async () => {
      const res = await fetch(`${BASE_URL}/api/orders/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderType: "dine_in",
          tableNumber: "1",
          items: [{ name: "Hot Coffee", quantity: 1 }],
          total: 10 // Hot Coffee is ₹40
        })
      });
      const data = await res.json();
      return {
        passed: res.status === 400 && data.error?.includes("Price tampering"),
        details: `Status: ${res.status}, error: ${data.error}`
      };
    }
  );

  await assertTest(
    "Reject nonexistent dish in order submission",
    "Price Validation",
    async () => {
      const res = await fetch(`${BASE_URL}/api/orders/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderType: "dine_in",
          tableNumber: "1",
          items: [{ name: "Fake Nonexistent Burger XYZ", quantity: 1 }]
        })
      });
      const data = await res.json();
      return {
        passed: res.status === 400 && data.error?.includes("Unrecognized dish"),
        details: `Status: ${res.status}, error: ${data.error}`
      };
    }
  );

  await assertTest(
    "Server recalculates exact total in integer paise for multiple items",
    "Price Validation",
    async () => {
      // Hot Coffee = 40, Cold Coffee = 50 -> Total = 90
      const res = await fetch(`${BASE_URL}/api/orders/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderType: "dine_in",
          tableNumber: "1",
          items: [
            { name: "Hot Coffee", quantity: 1 },
            { name: "Cold Coffee", quantity: 1 }
          ]
        })
      });
      const data = await res.json();
      return {
        passed: res.status === 200 && data.order?.total === 90,
        details: `Order total calculated: ${data.order?.total}`
      };
    }
  );

  // 3. REJECT INVALID ORDERS (Phase 2C)
  await assertTest(
    "Reject negative quantity (-2)",
    "Order Validation",
    async () => {
      const res = await fetch(`${BASE_URL}/api/orders/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderType: "dine_in",
          tableNumber: "1",
          items: [{ name: "Hot Coffee", quantity: -2 }]
        })
      });
      const data = await res.json();
      return {
        passed: res.status === 400 && data.error?.includes("quantity"),
        details: `Status: ${res.status}, error: ${data.error}`
      };
    }
  );

  await assertTest(
    "Reject non-integer float quantity (1.5)",
    "Order Validation",
    async () => {
      const res = await fetch(`${BASE_URL}/api/orders/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderType: "dine_in",
          tableNumber: "1",
          items: [{ name: "Hot Coffee", quantity: 1.5 }]
        })
      });
      const data = await res.json();
      return {
        passed: res.status === 400 && data.error?.includes("quantity"),
        details: `Status: ${res.status}, error: ${data.error}`
      };
    }
  );

  await assertTest(
    "Reject empty cart submission",
    "Order Validation",
    async () => {
      const res = await fetch(`${BASE_URL}/api/orders/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderType: "dine_in",
          tableNumber: "1",
          items: []
        })
      });
      const data = await res.json();
      return {
        passed: res.status === 400 && data.error?.includes("empty"),
        details: `Status: ${res.status}, error: ${data.error}`
      };
    }
  );

  await assertTest(
    "Reject delivery order missing delivery address",
    "Order Validation",
    async () => {
      const res = await fetch(`${BASE_URL}/api/orders/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderType: "delivery",
          customerName: "Rahul Sharma",
          customerPhone: "9876543210",
          deliveryAddress: "",
          items: [{ name: "Hot Coffee", quantity: 1 }]
        })
      });
      const data = await res.json();
      return {
        passed: res.status === 400 && data.error?.includes("delivery address"),
        details: `Status: ${res.status}, error: ${data.error}`
      };
    }
  );

  await assertTest(
    "Reject delivery order with invalid short phone number",
    "Order Validation",
    async () => {
      const res = await fetch(`${BASE_URL}/api/orders/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderType: "delivery",
          customerName: "Rahul Sharma",
          customerPhone: "123",
          deliveryAddress: "Flat 101, Galaxy Towers, Ahmedabad",
          items: [{ name: "Hot Coffee", quantity: 1 }]
        })
      });
      const data = await res.json();
      return {
        passed: res.status === 400 && data.error?.includes("mobile number"),
        details: `Status: ${res.status}, error: ${data.error}`
      };
    }
  );

  await assertTest(
    "Reject dine-in order with out-of-range table number (Table 99)",
    "Order Validation",
    async () => {
      const res = await fetch(`${BASE_URL}/api/orders/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderType: "dine_in",
          tableNumber: "99",
          items: [{ name: "Hot Coffee", quantity: 1 }]
        })
      });
      const data = await res.json();
      return {
        passed: res.status === 400 && data.error?.includes("table number"),
        details: `Status: ${res.status}, error: ${data.error}`
      };
    }
  );

  // 4. SECURE TABLE SESSION MANAGEMENT (Phase 2D)
  await assertTest(
    "Unauthenticated customer cannot call /api/sessions/close",
    "Session Security",
    async () => {
      const res = await fetch(`${BASE_URL}/api/sessions/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId: "1" })
      });
      const data = await res.json();
      return {
        passed: res.status === 401 && data.success === false,
        details: `Status: ${res.status}, error: ${data.error}`
      };
    }
  );

  await assertTest(
    "Unauthenticated request to /api/admin/sessions/close is denied",
    "Session Security",
    async () => {
      const res = await fetch(`${BASE_URL}/api/admin/sessions/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId: "1" })
      });
      const data = await res.json();
      return {
        passed: res.status === 401 && data.success === false,
        details: `Status: ${res.status}, error: ${data.error}`
      };
    }
  );

  await assertTest(
    "Authenticated Owner CAN safely close session via /api/admin/sessions/close",
    "Session Security",
    async () => {
      const res = await fetch(`${BASE_URL}/api/admin/sessions/close`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`
        },
        body: JSON.stringify({ tableId: "1" })
      });
      const data = await res.json();
      return {
        passed: res.status === 200 && data.success === true,
        details: `Status: ${res.status}`
      };
    }
  );

  // 5. PAYMENT VERIFICATION SECURITY (Phase 2E)
  await assertTest(
    "Reject forged COUNTER_ prefix bypass in /api/payment/verify",
    "Payment Security",
    async () => {
      const res = await fetch(`${BASE_URL}/api/payment/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpay_order_id: "order_test_123",
          razorpay_payment_id: "COUNTER_99999",
          orderId: "ORD_FAKE_1"
        })
      });
      const data = await res.json();
      return {
        passed: res.status === 400 && data.success === false,
        details: `Status: ${res.status}, error: ${data.error}`
      };
    }
  );

  await assertTest(
    "Reject forged COD_ prefix bypass in /api/payment/verify",
    "Payment Security",
    async () => {
      const res = await fetch(`${BASE_URL}/api/payment/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpay_order_id: "order_test_123",
          razorpay_payment_id: "COD_88888",
          orderId: "ORD_FAKE_2"
        })
      });
      const data = await res.json();
      return {
        passed: res.status === 400 && data.success === false,
        details: `Status: ${res.status}, error: ${data.error}`
      };
    }
  );

  await assertTest(
    "Reject payment verification with missing razorpay_order_id or payment_id",
    "Payment Security",
    async () => {
      const res = await fetch(`${BASE_URL}/api/payment/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const data = await res.json();
      return {
        passed: res.status === 400 && data.success === false,
        details: `Status: ${res.status}, error: ${data.error}`
      };
    }
  );

  // 6. RESERVATIONS CONFLICT & BOOKINGS (Phase 2C & edge cases)
  const randDay = Math.floor(Math.random() * 20) + 2;
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + randDay);
  const testDate = targetDate.toISOString().split("T")[0];
  const testTime = "20:00";
  const testTable = String(Math.floor(Math.random() * 5) + 4); // Tables 4..8

  await assertTest(
    "Create valid customer table reservation",
    "Reservation Flow",
    async () => {
      const res = await fetch(`${BASE_URL}/api/reservations/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Amit Patel",
          phone: "9825012345",
          guests: 2,
          date: testDate,
          time: testTime,
          table: testTable
        })
      });
      const data = await res.json();
      return {
        passed: (res.status === 200 || res.status === 201) && data.success === true,
        details: `Status: ${res.status}, id: ${data.reservation?.id}`
      };
    }
  );

  await assertTest(
    "Double booking same table, date & time returns 409 Conflict",
    "Reservation Flow",
    async () => {
      const res = await fetch(`${BASE_URL}/api/reservations/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Pooja Shah",
          phone: "9825099999",
          guests: 4,
          date: testDate,
          time: testTime,
          table: testTable
        })
      });
      const data = await res.json();
      return {
        passed: res.status === 409 && data.success === false,
        details: `Status: ${res.status}, error: ${data.error}`
      };
    }
  );

  // 8. IDEMPOTENCY & EDGE CASES
  await assertTest(
    "Reject quantity exceeding maximum limit of 50 items",
    "Edge Cases",
    async () => {
      const res = await fetch(`${BASE_URL}/api/orders/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderType: "dine_in",
          tableNumber: "1",
          items: [{ name: "Hot Coffee", quantity: 99 }]
        })
      });
      const data = await res.json();
      return {
        passed: res.status === 400 && data.error?.includes("quantity"),
        details: `Status: ${res.status}, error: ${data.error}`
      };
    }
  );

  await assertTest(
    "Reject zero quantity (0)",
    "Edge Cases",
    async () => {
      const res = await fetch(`${BASE_URL}/api/orders/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderType: "dine_in",
          tableNumber: "1",
          items: [{ name: "Hot Coffee", quantity: 0 }]
        })
      });
      const data = await res.json();
      return {
        passed: res.status === 400 && data.error?.includes("quantity"),
        details: `Status: ${res.status}, error: ${data.error}`
      };
    }
  );

  await assertTest(
    "Client unit price tampering is ignored, authoritative catalog price is enforced",
    "Price Validation",
    async () => {
      // Client supplies price: 1 for Hot Coffee (official is 40)
      const res = await fetch(`${BASE_URL}/api/orders/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderType: "dine_in",
          tableNumber: "1",
          items: [{ name: "Hot Coffee", price: 1, quantity: 2 }]
        })
      });
      const data = await res.json();
      return {
        passed: res.status === 200 && data.order?.total === 80,
        details: `Total enforced: ${data.order?.total}`
      };
    }
  );

  await assertTest(
    "Idempotent order placement catches duplicate submissions",
    "Idempotency",
    async () => {
      const idemKey = "IDEM_TEST_" + Date.now();
      const payload = {
        idempotencyKey: idemKey,
        orderType: "dine_in",
        tableNumber: "1",
        items: [{ name: "Hot Coffee", quantity: 1 }]
      };
      const res1 = await fetch(`${BASE_URL}/api/orders/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const res2 = await fetch(`${BASE_URL}/api/orders/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data2 = await res2.json();
      return {
        passed: res2.status === 200 && data2.duplicated === true,
        details: `Second request duplicated flag: ${data2.duplicated}`
      };
    }
  );

  // SUMMARY
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  console.log("\n=======================================================");
  console.log(` AUDIT RESULTS: ${passedCount} PASSED | ${failedCount} FAILED (TOTAL: ${results.length})`);
  console.log("=======================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests();
