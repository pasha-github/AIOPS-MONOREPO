/**
 * Shopping Cart Page
 * Displays items in the cart, order summary, and handles the checkout process.
 */
"use client";
import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import { useStore } from "@/lib/store";
import { Trash2, AlertTriangle, CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function CartPage() {
  const { cart, fetchCart, isCartError, removeFromCart, clearCart } = useStore();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutStatus, setCheckoutStatus] = useState<"idle" | "success" | "error">("idle");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Load cart data
  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Handle removing item with loading state
  const handleRemove = async (productId: string) => {
    setRemovingId(productId);
    try {
      await removeFromCart(productId);
    } finally {
      setRemovingId(null);
    }
  };

  // Process checkout with simulated delay
  const handleCheckout = async () => {
    setIsCheckingOut(true);
    setCheckoutStatus("idle");
    try {
      const res = await fetch("/api/checkout", { method: "POST" });
      if (!res.ok) throw new Error("Checkout failed");
      const data = await res.json();
      setOrderId(data.orderId);
      await clearCart(); // Clear cart after successful checkout
      setCheckoutStatus("success");
    } catch (error) {
      setCheckoutStatus("error");
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <>
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold mb-8 text-foreground">Shopping Cart</h1>

        {isCartError ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8 text-center max-w-2xl mx-auto"
          >
            <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-red-500 mb-2">Service Temporarily Unavailable</h2>
            <p className="text-muted-foreground mb-6">
              We're experiencing unusually high traffic right now. Please bear with us while we get things back up and running.
            </p>
          </motion.div>
        ) : checkoutStatus === "success" ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-green-500/10 border border-green-500/20 rounded-2xl p-8 text-center max-w-2xl mx-auto"
          >
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-green-500 mb-2">Order Confirmed!</h2>
            <p className="text-muted-foreground mb-6">
              Thank you for your purchase. Your order ID is <span className="font-mono text-foreground font-semibold">{orderId}</span>.
            </p>
            <Link href="/" className="inline-block px-6 py-3 bg-brand-orange-500 text-white rounded-full font-medium hover:bg-brand-orange-600 transition-colors shadow-lg shadow-brand-orange-500/20">
              Continue Shopping
            </Link>
          </motion.div>
        ) : cart.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-2xl border border-border">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">Your cart is empty</h2>
            <Link href="/" className="text-brand-orange-500 font-medium hover:underline">Browse our collection</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2 space-y-6">
              {cart.map((item) => (
                <div key={item.id} className="flex gap-6 bg-card border border-border p-4 rounded-xl items-center shadow-sm">
                  <div className="h-24 w-24 rounded-lg bg-muted overflow-hidden shrink-0">
                    <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-foreground">{item.name}</h3>
                    <p className="text-brand-orange-500 font-bold">${item.price}</p>
                    <div className="mt-2 text-sm text-muted-foreground font-medium">Qty: {item.quantity}</div>
                  </div>
                  <button 
                    onClick={() => handleRemove(item.id)}
                    disabled={removingId === item.id}
                    className="p-3 bg-muted/50 rounded-full text-muted-foreground hover:text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
                  >
                    {removingId === item.id ? <Loader2 className="h-5 w-5 animate-spin text-red-500" /> : <Trash2 className="h-5 w-5" />}
                  </button>
                </div>
              ))}
            </div>

            <div className="bg-card border border-border p-6 rounded-2xl h-fit sticky top-24 shadow-sm">
              <h2 className="text-xl font-bold mb-6 text-foreground">Order Summary</h2>
              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="font-medium text-foreground">${total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Shipping</span>
                  <span className="font-medium text-green-600">Free</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax</span>
                  <span className="font-medium text-foreground">${(total * 0.08).toFixed(2)}</span>
                </div>
                <div className="border-t border-border pt-4 flex justify-between font-bold text-xl text-foreground">
                  <span>Total</span>
                  <span className="text-brand-orange-500">${(total * 1.08).toFixed(2)}</span>
                </div>
              </div>

              {checkoutStatus === "error" && (
                <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm flex gap-2 items-start">
                  <AlertTriangle className="h-5 w-5 shrink-0" />
                  <p>Payment Gateway Timeout. The service took too long to respond.</p>
                </div>
              )}

              <button
                onClick={handleCheckout}
                disabled={isCheckingOut}
                className="w-full py-4 px-6 bg-brand-orange-500 text-white rounded-full font-bold hover:bg-brand-orange-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-brand-orange-500/20"
              >
                {isCheckingOut ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Proceed to Checkout"
                )}
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
