/**
 * ProductCard Component
 * Renders a single product with an add-to-cart button and animated states.
 * Handles the async addition to the cart and displays success/error feedback.
 */
"use client";
import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ShoppingCart, Check, AlertCircle, ArrowRight } from 'lucide-react';
import { useStore } from '@/lib/store';

export default function ProductCard({ product }: { product: any }) {
  const { addToCart } = useStore();
  const [isAdding, setIsAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState(false);

  // Handle adding item to the simulated cart
  const handleAdd = async () => {
    setIsAdding(true);
    setError(false);
    try {
      await addToCart(product);
      setAdded(true);
      setTimeout(() => setAdded(false), 2000); // Reset success state
    } catch (err) {
      setError(true);
      setTimeout(() => setError(false), 3000); // Reset error state
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative flex flex-col overflow-hidden rounded-2xl bg-card border border-border/50 hover:border-brand-orange-500/50 hover:shadow-xl hover:shadow-brand-orange-500/10 transition-all duration-300"
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        <img 
          src={product.image} 
          alt={product.name}
          className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute top-2 right-2 bg-background/80 backdrop-blur px-2 py-1 rounded-full text-xs font-semibold text-foreground">
          ★ {product.rating}
        </div>
      </div>
      <div className="p-5 flex flex-col flex-grow">
        <div className="text-xs text-brand-pink-500 font-medium mb-2 uppercase tracking-wide">{product.category}</div>
        <h3 className="font-semibold text-lg text-foreground mb-1 line-clamp-1">{product.name}</h3>
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{product.description}</p>
        <div className="text-xs font-semibold text-red-500 mb-4 bg-red-50 w-fit px-2 py-1 rounded-full border border-red-100">
          Only {product.inventory} left in stock!
        </div>
        <div className="mt-auto flex items-center justify-between">
          <span className="text-xl font-bold text-foreground">${product.price}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAdd}
              disabled={isAdding || added}
              className={`flex items-center justify-center p-2 rounded-full transition-all duration-300 ${
                error ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' :
                added ? 'bg-green-500/10 text-green-500' :
                'bg-brand-orange-500 text-white hover:bg-brand-orange-600 hover:shadow-md hover:shadow-brand-orange-500/20'
              }`}
              title="Add to Cart"
            >
              {error ? <AlertCircle className="h-5 w-5" /> : 
               added ? <Check className="h-5 w-5" /> : 
               isAdding ? <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> :
               <ShoppingCart className="h-5 w-5" />}
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
    </motion.div>
  );
}
