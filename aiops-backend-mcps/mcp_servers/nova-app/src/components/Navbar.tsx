/**
 * Navbar Component
 * Renders the top navigation bar with brand logo, links, and shopping cart indicator.
 */
"use client";
import Link from 'next/link';
import { ShoppingCart, Menu } from 'lucide-react';
import { useStore } from '@/lib/store';
import { useEffect } from 'react';

export default function Navbar() {
  const { cartCount, fetchCart } = useStore();

  // Fetch the cart contents when the navbar loads
  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-brand-orange-500 to-brand-pink-500">NovaCart</span>
          </Link>
          <div className="hidden md:flex items-center space-x-6 text-sm font-medium">
            <Link href="/" className="transition-colors hover:text-brand-orange-500 text-foreground/80">Products</Link>
            <Link href="/categories" className="transition-colors hover:text-brand-orange-500 text-foreground/80">Categories</Link>
            <Link href="/orders" className="transition-colors hover:text-brand-orange-500 text-foreground/80">Orders</Link>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <Link href="/cart" className="relative p-2 text-foreground/80 hover:text-brand-orange-500 transition-colors">
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 && (
              <span className="absolute top-0 right-0 h-4 w-4 rounded-full bg-brand-orange-500 text-[10px] font-bold text-white flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </Link>

          <button className="md:hidden p-2 text-foreground/80 hover:text-brand-orange-500">
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>
    </nav>
  );
}
