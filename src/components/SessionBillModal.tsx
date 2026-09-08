import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Receipt, Printer, CheckCircle, CreditCard, Clock, UtensilsCrossed, AlertCircle } from "lucide-react";
import { DelishLogo } from "./DelishLogo";

interface SessionBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  tableNumber: string;
  onPaymentSuccess?: () => void;
}

export const SessionBillModal: React.FC<SessionBillModalProps> = ({
  isOpen,
  onClose,
  sessionId,
  tableNumber,
  onPaymentSuccess
}) => {
  const [billData, setBillData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [isRequesting, setIsRequesting] = useState<boolean>(false);
  const [isPaying, setIsPaying] = useState<boolean>(false);
  const [paymentSuccess, setPaymentSuccess] = useState<boolean>(false);

  const fetchBill = async () => {
    if (!sessionId) return;
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/sessions/${sessionId}/bill`);
      const data = await res.json();
      if (res.ok && data.success) {
        setBillData(data);
      } else {
        setError(data.error || "Failed to load session bill.");
      }
    } catch (err: any) {
      setError("Could not reach cafe bill server.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && sessionId) {
      setPaymentSuccess(false);
      fetchBill();
    }
  }, [isOpen, sessionId]);

  const handleRequestFinalBill = async () => {
    if (!sessionId || isRequesting) return;
    setIsRequesting(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/request-bill`, {
        method: "POST"
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBillData((prev: any) => ({
          ...prev,
          billStatus: "requested",
          session: { ...prev.session, billStatus: "requested" }
        }));
      }
    } catch (err) {
      console.error("Request bill error:", err);
    } finally {
      setIsRequesting(false);
    }
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

  const handlePayFinalBill = async () => {
    if (!billData || billData.finalAmount <= 0 || isPaying) return;
    setIsPaying(true);

    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        alert("Razorpay payment gateway could not be loaded.");
        setIsPaying(false);
        return;
      }

      // 1. Create order on backend
      const res = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: billData.finalAmount,
          sessionId
        })
      });

      const orderData = await res.json();
      if (!res.ok || !orderData.success) {
        alert(orderData.error || "Could not initialize checkout order.");
        setIsPaying(false);
        return;
      }

      // If in sandbox/simulated mode or missing keys
      if (orderData.simulated) {
        const verifyRes = await fetch("/api/payment/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            razorpay_order_id: orderData.order_id,
            razorpay_payment_id: "PAY_SIM_" + Math.random().toString(36).substring(2, 9).toUpperCase(),
            razorpay_signature: "simulated_signature",
            sessionId,
            tableNumber
          })
        });
        const verifyData = await verifyRes.json();
        if (verifyData.success) {
          setPaymentSuccess(true);
          onPaymentSuccess?.();
        }
        setIsPaying(false);
        return;
      }

      // 2. Real Razorpay Modal
      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: "INR",
        name: "Delish Pure Veg Cafe",
        description: `Final Settlement - Table ${tableNumber}`,
        order_id: orderData.order_id,
        handler: async (response: any) => {
          try {
            const verifyRes = await fetch("/api/payment/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                sessionId,
                tableNumber
              })
            });

            const verifyData = await verifyRes.json();
            if (verifyData.success) {
              setPaymentSuccess(true);
              onPaymentSuccess?.();
            } else {
              alert(verifyData.error || "Payment signature verification failed.");
            }
          } catch (e) {
            alert("Payment verification error.");
          } finally {
            setIsPaying(false);
          }
        },
        modal: {
          ondismiss: () => {
            setIsPaying(false);
          }
        },
        theme: {
          color: "#3E4B2F"
        }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      alert("Error initiating Razorpay checkout: " + err.message);
      setIsPaying(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#26301C]/80 backdrop-blur-sm print:p-0 print:bg-white">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-[#C9A84E]/30 overflow-hidden flex flex-col max-h-[90vh] print:border-none print:shadow-none print:max-h-none"
        >
          {/* Header */}
          <div className="p-6 border-b border-[#F4EFE6] flex items-center justify-between bg-[#FAF8F3] print:hidden">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-[#C9A84E]" />
              <div>
                <h3 className="font-serif font-bold uppercase tracking-wider text-[#26301C] text-sm">
                  Table {tableNumber} &bull; Dining Session Bill
                </h3>
                <span className="text-[9px] uppercase tracking-widest text-[#52633E] font-mono">
                  {sessionId}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[#52633E] hover:bg-[#FAF8F3] hover:text-[#26301C] border border-[#C9A84E]/30 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Printable Body */}
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6" id="printable-session-bill">
            {paymentSuccess ? (
              <div className="text-center py-10 space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-serif font-bold uppercase text-[#26301C]">
                  Bill Paid & Table Released!
                </h2>
                <p className="text-xs text-[#52633E] max-w-sm mx-auto">
                  Thank you for dining at Delish Cafe. Your session has been fully settled and receipt registered. We hope you enjoyed your artisanal culinary experience!
                </p>
                <div className="pt-4 flex justify-center gap-3">
                  <button
                    onClick={handlePrint}
                    className="bg-[#FAF8F3] hover:bg-[#F4EFE6] border border-[#C9A84E]/30 text-[#26301C] px-5 py-2.5 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center gap-2"
                  >
                    <Printer className="w-4 h-4 text-[#C9A84E]" />
                    Print Receipt
                  </button>
                  <button
                    onClick={onClose}
                    className="bg-[#3E4B2F] hover:bg-[#323E25] text-white px-6 py-2.5 rounded-xl font-bold uppercase tracking-widest text-xs shadow-md border border-[#C9A84E]/30"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : isLoading ? (
              <div className="text-center py-16 space-y-3">
                <Clock className="w-8 h-8 text-[#C9A84E] animate-spin mx-auto" />
                <p className="text-xs text-[#52633E] uppercase tracking-widest font-bold">
                  Aggregating Table Orders...
                </p>
              </div>
            ) : error ? (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-2">
                <AlertCircle className="w-6 h-6 text-rose-600 mx-auto" />
                <p className="text-xs text-rose-700 font-bold">{error}</p>
                <button
                  onClick={fetchBill}
                  className="px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-lg uppercase tracking-wider"
                >
                  Retry
                </button>
              </div>
            ) : (
              <>
                {/* Brand Header */}
                <div className="text-center pb-6 border-b border-dashed border-[#C9A84E]/40">
                  <DelishLogo className="w-14 h-14 mx-auto mb-2" />
                  <span className="text-3xl font-serif font-black tracking-tight text-[#26301C]">
                    Delish <span className="text-[#C9A84E] italic">Cafe</span>
                  </span>
                  <p className="text-[10px] text-[#3E4B2F] font-bold uppercase tracking-widest mt-1">
                    100% Pure Vegetarian Artisan Cafe & Specialty Roastery
                  </p>
                  <p className="text-[9px] text-[#52633E] uppercase tracking-wider mt-0.5">
                    Sindhu Bhavan Marg, Bodakdev, Ahmedabad, Gujarat
                  </p>
                  <p className="text-[9px] text-[#52633E] uppercase tracking-wider">
                    Phone: +91 98765 43210 &bull; GSTIN: 24AAACS1234F1Z5
                  </p>
                </div>

                {/* Session Meta */}
                <div className="grid grid-cols-2 gap-4 text-[10px] uppercase tracking-wider font-semibold text-[#52633E]">
                  <div className="space-y-1">
                    <p>
                      <span className="text-stone-400 font-bold">Table:</span>{" "}
                      <span className="font-bold text-[#26301C]">Table {tableNumber}</span>
                    </p>
                    <p>
                      <span className="text-stone-400 font-bold">Started:</span>{" "}
                      <span className="text-[#26301C]">
                        {billData.session?.startedAt ? new Date(billData.session.startedAt).toLocaleTimeString() : "Active"}
                      </span>
                    </p>
                  </div>
                  <div className="space-y-1 text-right">
                    <p>
                      <span className="text-stone-400 font-bold">Bill Status:</span>{" "}
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                          billData.billStatus === "paid"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : billData.billStatus === "requested"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-blue-50 text-blue-700 border border-blue-200"
                        }`}
                      >
                        {billData.billStatus === "requested" ? "FINAL BILL REQUESTED" : "RUNNING BILL"}
                      </span>
                    </p>
                    <p>
                      <span className="text-stone-400 font-bold">Orders Placed:</span>{" "}
                      <span className="text-[#26301C] font-bold">
                        {billData.orders?.length || 0} Orders
                      </span>
                    </p>
                  </div>
                </div>

                {/* Orders Breakdown */}
                <div className="space-y-4">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-[#52633E] block border-b border-[#F4EFE6] pb-1">
                    Dishes by Order Batch
                  </span>

                  {billData.orders?.length === 0 ? (
                    <div className="text-center py-6 text-stone-400 text-xs font-semibold">
                      No orders placed in this session yet.
                    </div>
                  ) : (
                    billData.orders?.map((ord: any, i: number) => (
                      <div
                        key={ord.id || i}
                        className="bg-[#FAF8F3] border border-[#C9A84E]/20 rounded-xl p-3 text-xs space-y-2"
                      >
                        <div className="flex justify-between items-center text-[10px] uppercase font-bold text-[#52633E] pb-1 border-b border-stone-200/60">
                          <span className="font-mono text-[#3E4B2F]">Batch #{i + 1} &bull; {ord.id}</span>
                          <span>{ord.createdAt}</span>
                        </div>
                        <div className="space-y-1">
                          {ord.items?.map((it: any, itIdx: number) => (
                            <div key={itIdx} className="flex justify-between items-center text-[11px]">
                              <span className="font-semibold text-[#26301C]">
                                {it.name} <span className="text-[#52633E] text-[10px]">×{it.quantity}</span>
                              </span>
                              <span className="font-mono font-bold text-[#26301C]">
                                ₹{it.price * it.quantity}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Financial Summary */}
                <div className="space-y-1.5 text-[10px] uppercase tracking-wider text-right font-semibold text-[#52633E] border-t border-dashed border-[#C9A84E]/40 pt-4">
                  <p>
                    Subtotal: <span className="font-mono text-[#26301C]">₹{Math.round(billData.subtotal * 0.95)}</span>
                  </p>
                  <p>
                    SGST (2.5% inclusive): <span className="font-mono text-[#26301C]">₹{billData.taxes?.sgst || 0}</span>
                  </p>
                  <p>
                    CGST (2.5% inclusive): <span className="font-mono text-[#26301C]">₹{billData.taxes?.cgst || 0}</span>
                  </p>
                  <div className="border-t border-[#C9A84E]/30 pt-2 mt-2 flex justify-between items-baseline font-bold">
                    <span className="text-[#26301C] text-xs font-serif">Grand Total Payable:</span>
                    <span className="text-[#3E4B2F] text-2xl font-bold font-mono">
                      ₹{billData.finalAmount}
                    </span>
                  </div>
                </div>

                {/* Notice */}
                <div className="bg-[#FAF8F3] border border-[#C9A84E]/20 p-3 rounded-xl text-[9px] uppercase tracking-widest text-[#52633E] text-center space-y-0.5">
                  <p className="font-bold text-[#26301C]">DELISH CAFE RESTAURANT BILLING</p>
                  <p>Settling this bill closes Table {tableNumber}&apos;s session and generates tax receipt.</p>
                </div>
              </>
            )}
          </div>

          {/* Action Bar (Footer) */}
          {!paymentSuccess && !isLoading && !error && billData?.finalAmount > 0 && (
            <div className="p-6 border-t border-[#F4EFE6] bg-[#FAF8F3] flex flex-wrap gap-2.5 justify-between items-center print:hidden">
              <button
                type="button"
                onClick={handlePrint}
                className="bg-white hover:bg-stone-100 text-[#26301C] border border-[#C9A84E]/30 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5 text-[#C9A84E]" />
                Print Bill
              </button>

              <div className="flex gap-2">
                {billData.billStatus !== "requested" && (
                  <button
                    type="button"
                    onClick={handleRequestFinalBill}
                    disabled={isRequesting}
                    className="bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <UtensilsCrossed className="w-3.5 h-3.5 text-amber-700" />
                    {isRequesting ? "Requesting..." : "Request Final Bill"}
                  </button>
                )}

                <button
                  type="button"
                  onClick={handlePayFinalBill}
                  disabled={isPaying}
                  className="bg-[#3E4B2F] hover:bg-[#323E25] text-white px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all cursor-pointer shadow-md flex items-center gap-2 border border-[#C9A84E]/30"
                >
                  <CreditCard className="w-3.5 h-3.5 text-[#C9A84E]" />
                  {isPaying ? "Processing..." : `Pay ₹${billData.finalAmount} (Razorpay)`}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
