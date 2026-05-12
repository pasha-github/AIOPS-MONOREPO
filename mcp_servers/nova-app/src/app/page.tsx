"use client";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import ProductCard from "@/components/ProductCard";
import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";

export default function Home() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/products")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch products");
        return res.json();
      })
      .then((data) => {
        setProducts(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError(true);
        setLoading(false);
      });
  }, []);

  return (
    <>
      <Navbar />
      <main className="flex-1 flex flex-col">
        {/* Hero Section */}
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-brand-orange-50 text-foreground py-12 border-b border-border">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-orange-100 via-white to-brand-pink-50 opacity-60"></div>
          <div className="container mx-auto px-4 relative z-10">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <motion.div 
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
                className="md:w-1/2"
              >
                <div className="inline-block px-3 py-1 mb-4 rounded-full bg-brand-orange-500/10 border border-brand-orange-500/20 text-brand-orange-600 text-xs font-semibold tracking-wide">
                  NEXT-GEN RETAIL EXPERIENCE
                </div>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 leading-tight">
                  Shop the <br/>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-orange-500 to-brand-pink-500">Future Today.</span>
                </h1>
                <p className="text-base md:text-lg text-muted-foreground max-w-md">
                  Discover premium consumer electronics and smart lifestyle products with our seamless, ultra-fast shopping experience.
                </p>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="md:w-1/2 hidden md:flex justify-end relative h-[250px] w-full"
              >
                <div className="absolute right-0 top-0 w-[80%] h-full bg-gradient-to-tr from-brand-orange-500/20 to-brand-pink-500/20 rounded-3xl blur-2xl"></div>
                <img 
                  src="https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=800&auto=format&fit=crop" 
                  alt="Premium Electronics" 
                  className="relative z-10 w-[80%] h-full object-cover rounded-2xl shadow-2xl border border-white/50"
                />
              </motion.div>
            </div>
          </div>
        </section>

        {/* Product Catalog */}
        <section className="py-16 container mx-auto px-4 flex-1">
          <div className="flex items-center justify-between mb-10">
            <h2 className="text-3xl font-bold">Featured Collection</h2>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="animate-pulse bg-muted rounded-2xl aspect-[3/4]"></div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
              <h3 className="text-xl font-bold text-foreground mb-2">Service Degraded</h3>
              <p className="text-muted-foreground">Unable to load product catalog. Database connection timeout.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {products.map((product: any) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
