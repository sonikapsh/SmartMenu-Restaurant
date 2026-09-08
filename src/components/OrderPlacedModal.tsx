import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, Receipt, Plus, UtensilsCrossed, X } from "lucide-react";

interface OrderPlacedModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  tableNumber: string;
  orderType: "dine_in" | "delivery";
  runningTotal: number;
  onOrderMore: () => void;
  onViewBill: () => void;
  onRequestBill: () => void;
}

export const OrderPlacedModal: React.FC<OrderPlacedModalProps> = ({
  isOpen,
  onClose,
  orderId,
  tableNumber,
  orderType,
  runningTotal,
  onOrderMore,
  onViewBill,
  onRequestBill,
}) => {
  if (!isOpen) return null;

  const isDineIn = orderType === "dine_in";

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#26301C]/80 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white text-[#26301C] w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#C9A84E]/30 relative text-center space-y-6"
        >
          <button
            onClick={onClose}
            className="absolute top-6 right-6 w-9 h-9 rounded-full bg-[#FAF8F3] flex items-center justify-center text-[#52633E] hover:text-[#26301C] border border-[#C9A84E]/20 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#52633E] block">
              Order Dispatched
            </span>
            <h2 className="text-2xl font-serif font-black uppercase tracking-tight text-[#26301C]">
              Order #{orderId} Placed!
            </h2>
            <p className="text-xs text-[#52633E] font-medium leading-relaxed">
              {isDineIn
                ? "Your order has been sent directly to the kitchen chefs. You can continue adding dishes to your table bill at any time!"
                : "Your delivery order has been received and is being prepared with fresh ingredients."}
            </p>
          </div>

          {isDineIn && (
            <div className="bg-[#FAF8F3] border border-[#C9A84E]/30 rounded-2xl p-4 flex items-center justify-between">
              <div className="text-left">
                <span className="text-[9px] uppercase font-bold tracking-widest text-[#52633E] block">
                  Table {tableNumber} Dining Session
                </span>
                <span className="text-xs text-[#26301C] font-semibold">Active Running Bill</span>
              </div>
              <div className="text-right">
                <span className="text-xl font-serif font-black italic text-[#3E4B2F]">
                  ₹{runningTotal}
                </span>
                <span className="text-[8px] uppercase tracking-wider block font-bold text-[#52633E]">
                  Inclusive of Taxes
                </span>
              </div>
            </div>
          )}

          <div className="space-y-2 pt-2">
            {isDineIn ? (
              <>
                <button
                  type="button"
                  onClick={onOrderMore}
                  className="w-full bg-[#3E4B2F] hover:bg-[#323E25] text-white font-bold uppercase tracking-widest text-xs py-3.5 rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 border border-[#C9A84E]/30"
                >
                  <Plus className="w-4 h-4 text-[#C9A84E]" />
                  + Order More Dishes
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={onViewBill}
                    className="bg-[#FAF8F3] hover:bg-[#F4EFE6] text-[#26301C] border border-[#C9A84E]/30 font-bold uppercase tracking-widest text-[10px] py-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Receipt className="w-3.5 h-3.5 text-[#C9A84E]" />
                    Running Bill
                  </button>

                  <button
                    type="button"
                    onClick={onRequestBill}
                    className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold uppercase tracking-widest text-[10px] py-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <UtensilsCrossed className="w-3.5 h-3.5 text-amber-700" />
                    Request Final Bill
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="w-full bg-[#3E4B2F] hover:bg-[#323E25] text-white font-bold uppercase tracking-widest text-xs py-3.5 rounded-xl transition-all cursor-pointer shadow-md border border-[#C9A84E]/30"
              >
                Track Order
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
