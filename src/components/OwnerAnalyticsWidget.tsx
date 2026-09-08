import React, { useState, useEffect } from "react";
import { TrendingUp, DollarSign, CheckCircle2, ShoppingBag, RefreshCw } from "lucide-react";

interface AnalyticsData {
  grossRevenue: number;
  netRevenue: number;
  paidOrdersCount: number;
  completedOrdersCount: number;
  totalOrdersCount: number;
}

interface OwnerAnalyticsWidgetProps {
  authToken: string | null;
}

export const OwnerAnalyticsWidget: React.FC<OwnerAnalyticsWidgetProps> = ({ authToken }) => {
  const [timeframe, setTimeframe] = useState<"today" | "week" | "month">("today");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchAnalytics = async (tf: "today" | "week" | "month") => {
    if (!authToken) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/analytics?timeframe=${tf}`, {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setData(json.metrics);
      }
    } catch (e) {
      console.warn("Analytics fetch error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(timeframe);
  }, [timeframe, authToken]);

  const gross = data ? data.grossRevenue : 0;
  const net = data ? data.netRevenue : 0;
  const paidCount = data ? data.paidOrdersCount : 0;
  const compCount = data ? data.completedOrdersCount : 0;

  return (
    <div className="bg-white border border-[#C9A84E]/25 rounded-3xl p-6 sm:p-8 shadow-md shadow-[#3E4B2F]/5 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#F4EFE6] pb-5">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#C9A84E] block">
            Executive Financial Overview
          </span>
          <h3 className="text-xl font-serif font-black tracking-tight text-[#26301C]">
            Delish Cafe Revenue & Order Metrics
          </h3>
        </div>

        {/* Timeframe selector */}
        <div className="flex items-center gap-1.5 bg-[#FAF8F3] p-1.5 rounded-2xl border border-[#C9A84E]/30 self-start sm:self-auto">
          {(["today", "week", "month"] as const).map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => setTimeframe(tf)}
              className={`px-3.5 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer ${
                timeframe === tf
                  ? "bg-[#3E4B2F] text-white shadow-sm"
                  : "text-[#52633E] hover:text-[#26301C] hover:bg-white"
              }`}
            >
              {tf === "today" ? "Today" : tf === "week" ? "This Week" : "This Month"}
            </button>
          ))}

          <button
            type="button"
            onClick={() => fetchAnalytics(timeframe)}
            title="Refresh Metrics"
            className="p-1.5 text-[#52633E] hover:text-[#26301C] transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gross Revenue */}
        <div className="bg-[#FAF8F3] border border-[#C9A84E]/25 p-5 rounded-2xl relative overflow-hidden">
          <div className="flex justify-between items-center text-[10px] uppercase font-bold text-[#52633E] tracking-widest">
            <span>Gross Revenue</span>
            <DollarSign className="w-4 h-4 text-[#C9A84E]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-serif font-black italic text-[#3E4B2F]">
              ₹{gross.toLocaleString("en-IN")}
            </span>
          </div>
          <span className="text-[9px] uppercase tracking-wider text-[#52633E] block mt-1">
            Inc. 5% GST &bull; {timeframe === "today" ? "Today" : timeframe === "week" ? "Last 7 Days" : "Last 30 Days"}
          </span>
        </div>

        {/* Net Revenue */}
        <div className="bg-[#FAF8F3] border border-[#C9A84E]/25 p-5 rounded-2xl relative overflow-hidden">
          <div className="flex justify-between items-center text-[10px] uppercase font-bold text-[#52633E] tracking-widest">
            <span>Net Revenue</span>
            <TrendingUp className="w-4 h-4 text-[#3E4B2F]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-serif font-black italic text-[#26301C]">
              ₹{net.toLocaleString("en-IN")}
            </span>
          </div>
          <span className="text-[9px] uppercase tracking-wider text-[#52633E] block mt-1">
            Excl. 5% GST Tax Remittance
          </span>
        </div>

        {/* Paid Orders */}
        <div className="bg-[#FAF8F3] border border-[#C9A84E]/25 p-5 rounded-2xl relative overflow-hidden">
          <div className="flex justify-between items-center text-[10px] uppercase font-bold text-[#52633E] tracking-widest">
            <span>Settled Orders</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-serif font-black italic text-[#26301C]">
              {paidCount}
            </span>
            <span className="text-[9px] uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-1.5 py-0.5 rounded-md tracking-widest">
              Paid
            </span>
          </div>
          <span className="text-[9px] uppercase tracking-wider text-[#52633E] block mt-1">
            Settled via Razorpay / Counter
          </span>
        </div>

        {/* Completed Dishes */}
        <div className="bg-[#FAF8F3] border border-[#C9A84E]/25 p-5 rounded-2xl relative overflow-hidden">
          <div className="flex justify-between items-center text-[10px] uppercase font-bold text-[#52633E] tracking-widest">
            <span>Kitchen Completed</span>
            <ShoppingBag className="w-4 h-4 text-[#C9A84E]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-serif font-black italic text-[#26301C]">
              {compCount}
            </span>
            <span className="text-[9px] uppercase bg-blue-50 text-blue-700 border border-blue-200 font-bold px-1.5 py-0.5 rounded-md tracking-widest">
              Dispatched
            </span>
          </div>
          <span className="text-[9px] uppercase tracking-wider text-[#52633E] block mt-1">
            Fully Prepared & Served
          </span>
        </div>
      </div>
    </div>
  );
};
