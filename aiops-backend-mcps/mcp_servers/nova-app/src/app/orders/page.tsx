"use client";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { AlertTriangle, Package, CheckCircle, Clock } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = () => {
    fetch("/api/orders")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch orders.");
        const data = await res.json();
        setOrders(data.orders);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchOrders();
    // Poll for updates every 3 seconds so the status changes from pending to placed without reloading
    const interval = setInterval(fetchOrders, 3000);
    return () => clearInterval(interval);
  }, []);

  const hasPendingOrders = orders.some(o => o.status === 'Payment Pending');

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-8 flex items-center gap-3">
          <Package className="h-8 w-8 text-brand-blue-500" />
          Your Orders
        </h1>

        {hasPendingOrders && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-start gap-4"
          >
            <AlertTriangle className="h-6 w-6 text-yellow-500 shrink-0 mt-1" />
            <div>
              <h3 className="font-bold text-yellow-600 dark:text-yellow-400">Order Processing Delayed</h3>
              <p className="text-sm text-yellow-600/80 dark:text-yellow-400/80">
                Some of your orders are still in "Payment Pending" status. If this takes longer than a minute, please check with the support team as the processing batch job may have failed.
              </p>
            </div>
          </motion.div>
        )}

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-muted animate-pulse rounded-xl"></div>
            ))}
          </div>
        ) : error ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-red-500/10 border border-red-500/30 p-8 rounded-2xl flex flex-col items-center justify-center text-center max-w-2xl mx-auto mt-12"
          >
            <AlertTriangle className="h-16 w-16 text-red-500 mb-6" />
            <h2 className="text-2xl font-bold text-red-500 mb-4">Error loading orders</h2>
            <p className="text-lg text-muted-foreground">{error}</p>
          </motion.div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20 bg-card border border-border/50 rounded-2xl">
            <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h2 className="text-2xl font-bold text-foreground mb-2">No orders found</h2>
            <p className="text-muted-foreground mb-6">You haven't placed any orders yet.</p>
            <Link href="/" className="inline-block px-6 py-3 bg-brand-orange-500 text-white rounded-full font-medium hover:bg-brand-orange-600 transition-colors shadow-lg shadow-brand-orange-500/20">
              Continue Shopping
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.slice().reverse().map((order) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={order.id} 
                className="bg-card border border-border/50 p-6 rounded-2xl flex flex-col hover:border-brand-blue-500/30 transition-colors shadow-sm gap-4"
              >
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/50 pb-4">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">
                      Order <span className="font-mono text-foreground font-semibold">{order.id}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Placed on {new Date(order.date).toLocaleDateString()} at {new Date(order.date).toLocaleTimeString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                    <div className="text-xl font-bold text-foreground">${order.total.toFixed(2)}</div>
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${
                      order.status === 'Payment Pending' ? 'bg-yellow-500/10 text-yellow-500 animate-pulse' : 'bg-green-500/10 text-green-500'
                    }`}>
                      {order.status === 'Payment Pending' ? <Clock className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                      {order.status}
                    </div>
                  </div>
                </div>
                
                <div className="pt-2 flex flex-col gap-3">
                  <h4 className="text-sm font-semibold text-foreground">Items:</h4>
                  {order.items && order.items.map((item: any) => (
                    <div key={item.id} className="flex items-center gap-4 bg-muted/30 p-2 rounded-lg">
                      <img src={item.image} alt={item.name} className="w-12 h-12 object-cover rounded-md" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{item.name}</p>
                        <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                      </div>
                      <div className="text-sm font-bold text-foreground">${(item.price * item.quantity).toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
