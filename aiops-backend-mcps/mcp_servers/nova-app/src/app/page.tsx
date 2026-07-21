"use client";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import ProductCard from "@/components/ProductCard";
import { motion } from "framer-motion";
import { AlertTriangle, Tag, Clock, Grid, List } from "lucide-react";
import Link from "next/link";
import { ShoppingCart, Check, AlertCircle, ArrowRight } from "lucide-react";
import { useStore } from "@/lib/store";

export default function Home() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSlow, setIsSlow] = useState(false);
  const [error, setError] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  // Modified: Added viewMode state for grid vs list toggle - [2026-05-14 16:20 IST]
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cat = params.get("category");
    setCategory(cat);

    const slowTimer = setTimeout(() => setIsSlow(true), 2000);

    fetch("/api/products")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch products");
        return res.json();
      })
      .then((data) => {
        clearTimeout(slowTimer);
        // Modified: Filter data if category is present, otherwise show all deals - [2026-05-14 16:20 IST]
        const filtered = cat ? data.filter((p: any) => p.category === cat) : data;
        setProducts(filtered);
        setLoading(false);
      })
      .catch((err) => {
        clearTimeout(slowTimer);
        console.error(err);
        setError(true);
        setLoading(false);
      });
  }, []);

  // Inline ListItem component for list view
  const ProductListItem = ({ product }: { product: any }) => {
    const { addToCart } = useStore();
    const [isAdding, setIsAdding] = useState(false);
    const [added, setAdded] = useState(false);

    const handleAdd = async () => {
      setIsAdding(true);
      try {
        await addToCart(product);
        setAdded(true);
        setTimeout(() => setAdded(false), 2000);
      } catch (err) {
        // Handle error silently for demo
      } finally {
        setIsAdding(false);
      }
    };

    return (
      <div className="flex flex-col md:flex-row gap-6 p-4 rounded-2xl bg-card border border-border/50 hover:border-brand-orange-500/50 hover:shadow-xl hover:shadow-brand-orange-500/10 transition-all duration-300">
        <div className="w-full md:w-48 h-48 rounded-xl overflow-hidden bg-muted flex-shrink-0 relative">
          <img src={product.image} alt={product.name} className="w-full h-full object-cover transition-transform duration-500 hover:scale-105" />
          <div className="absolute top-2 right-2 bg-background/80 backdrop-blur px-2 py-1 rounded-full text-xs font-semibold text-foreground">
            ★ {product.rating}
          </div>
        </div>
        <div className="flex-1 flex flex-col justify-center">
          <div className="text-xs text-brand-pink-500 font-medium mb-1 uppercase tracking-wide">{product.category}</div>
          <h3 className="font-bold text-2xl mb-2 text-foreground">{product.name}</h3>
          <p className="text-muted-foreground mb-4 max-w-2xl">{product.description}</p>
          <div className="text-xs font-semibold text-red-500 mb-4 bg-red-50 w-fit px-2 py-1 rounded-full border border-red-100">
            Only {product.inventory} left in stock!
          </div>
        </div>
        <div className="flex flex-col items-end justify-center min-w-[150px] border-t md:border-t-0 md:border-l border-border/50 pt-4 md:pt-0 md:pl-6">
          <span className="text-3xl font-bold mb-4 text-foreground">${product.price}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAdd}
              disabled={isAdding || added}
              className={`flex items-center justify-center px-4 py-2 rounded-full transition-all duration-300 font-bold ${
                added ? 'bg-green-500/10 text-green-500' :
                'bg-brand-orange-500 text-white hover:bg-brand-orange-600 hover:shadow-md hover:shadow-brand-orange-500/20'
              }`}
            >
              {added ? <Check className="h-5 w-5 mr-2" /> : <ShoppingCart className="h-5 w-5 mr-2" />}
              {added ? 'Added' : 'Add to Cart'}
            </button>
            <Link
              href="/cart"
              className="flex items-center justify-center p-2 rounded-full bg-secondary text-secondary-foreground hover:bg-muted transition-all duration-300"
              title="Go to Cart"
            >
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Navbar />
      <main className="flex-1 flex flex-col bg-background">
        {/* Modified: Replaced layout with Deals hero - [2026-05-14 16:20 IST] */}
        <section className="relative overflow-hidden bg-gradient-to-br from-red-500 via-rose-500 to-brand-pink-500 text-white py-16">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=2000&auto=format&fit=crop')] opacity-20 mix-blend-overlay bg-cover bg-center"></div>
          <div className="container mx-auto px-4 relative z-10 text-center">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-2 px-4 py-2 mb-6 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white text-sm font-bold uppercase tracking-widest"
            >
              <Tag className="h-4 w-4" />
              Flash Sale
            </motion.div>
            <motion.h1 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-5xl md:text-7xl font-extrabold mb-6 tracking-tight drop-shadow-lg"
            >
              Epic Deals. <br className="hidden md:block"/> Limited Time.
            </motion.h1>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex items-center justify-center gap-2 text-xl font-medium bg-black/30 w-fit mx-auto px-6 py-3 rounded-2xl backdrop-blur-sm border border-white/10 shadow-2xl"
            >
              <Clock className="h-6 w-6 text-yellow-300" />
              <span>Ends in <span className="font-mono font-bold text-yellow-300">04:59:59</span></span>
            </motion.div>
          </div>
        </section>

        <section className="py-16 container mx-auto px-4 flex-1">
          <div className="flex flex-col md:flex-row items-center justify-between mb-10 gap-4">
            <h2 className="text-3xl font-bold flex items-center gap-3">
              <span className="text-red-500 text-4xl">🔥</span> 
              {category ? `${category} Offers` : "All Trending Offers"}
            </h2>
            
            {/* Modified: Added View Toggle Buttons - [2026-05-14 16:20 IST] */}
            <div className="flex items-center bg-muted rounded-lg p-1 border border-border/50">
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md flex items-center gap-2 text-sm font-medium transition-colors ${viewMode === 'grid' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Grid className="h-4 w-4" /> Grid
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md flex items-center gap-2 text-sm font-medium transition-colors ${viewMode === 'list' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <List className="h-4 w-4" /> List
              </button>
            </div>
          </div>

          {loading ? (
            <div className="w-full">
              {isSlow && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  className="mb-8 flex items-center justify-center p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl"
                >
                  <AlertTriangle className="h-5 w-5 text-yellow-500 mr-3 animate-pulse" />
                  <p className="text-yellow-600 dark:text-yellow-400 font-medium text-sm">
                    Experiencing high database latency. Still loading deals...
                  </p>
                </motion.div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div key={i} className="animate-pulse bg-muted rounded-2xl aspect-[3/4]"></div>
                ))}
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
              <h3 className="text-xl font-bold text-foreground mb-2">Service Degraded</h3>
              <p className="text-muted-foreground">Unable to load deals. Database connection timeout.</p>
            </div>
          ) : (
            <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "flex flex-col gap-6"}>
              {products.map((product: any) => (
                <div key={product.id} className="relative">
                  {/* Fake discount badge */}
                  <div className="absolute -top-4 -left-4 z-20 bg-red-500 text-white font-bold text-sm px-3 py-2 rounded-full shadow-lg transform -rotate-12 border-2 border-white">
                    -{(Math.random() * 30 + 10).toFixed(0)}%
                  </div>
                  {viewMode === 'grid' ? (
                    <ProductCard product={product} />
                  ) : (
                    <ProductListItem product={product} />
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
