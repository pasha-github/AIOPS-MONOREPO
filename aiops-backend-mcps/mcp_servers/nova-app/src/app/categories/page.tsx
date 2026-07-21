"use client";
import Link from "next/link"; // Modified: Imported Link for category routing - [2026-05-14 16:15 IST]
import Navbar from "@/components/Navbar";
import { motion } from "framer-motion";
import { Smartphone, Laptop, Headphones, Home, Gamepad, Camera, Watch, BatteryCharging, Tablet } from "lucide-react";
import { useEffect, useState } from "react";

// Modified: Replaced hardcoded counts with base categories, added Tablets, removed count property - [2026-05-14 16:30 IST]
const baseCategories = [
  { name: "Smartphones", icon: Smartphone, color: "from-blue-500 to-cyan-400" },
  { name: "Laptops", icon: Laptop, color: "from-purple-500 to-indigo-400" },
  { name: "Audio", icon: Headphones, color: "from-pink-500 to-rose-400" },
  { name: "Smart Home", icon: Home, color: "from-green-500 to-emerald-400" },
  { name: "Gaming", icon: Gamepad, color: "from-brand-orange-500 to-amber-400" },
  { name: "Photography", icon: Camera, color: "from-red-500 to-orange-400" },
  { name: "Tablets", icon: Tablet, color: "from-indigo-500 to-purple-400" }, // Added Tablets since it's in DB
  { name: "Accessories", icon: BatteryCharging, color: "from-gray-600 to-gray-400" },
];

export default function CategoriesPage() {
  // Modified: Added state to store dynamic category counts - [2026-05-14 16:30 IST]
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    // Modified: Fetch products to calculate dynamic category counts - [2026-05-14 16:30 IST]
    fetch("/api/products")
      .then(res => res.json())
      .then(data => {
        const newCounts: Record<string, number> = {};
        data.forEach((p: any) => {
          newCounts[p.category] = (newCounts[p.category] || 0) + 1;
        });
        setCounts(newCounts);
      })
      .catch(console.error);
  }, []);

  return (
    <>
      <Navbar />
      <main className="flex-1 flex flex-col bg-background">
        <section className="relative py-16 overflow-hidden">
          <div className="absolute inset-0 bg-brand-orange-50/50"></div>
          <div className="container mx-auto px-4 relative z-10 text-center">
            <motion.h1 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-5xl font-bold mb-4"
            >
              Shop by <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-orange-500 to-brand-pink-500">Category</span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-lg text-muted-foreground max-w-2xl mx-auto"
            >
              Explore our wide range of premium products tailored to your lifestyle and needs.
            </motion.p>
          </div>
        </section>

        <section className="container mx-auto px-4 py-16 flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {baseCategories.map((category, index) => (
              // Modified: Wrapped category card in Link to enable filtering on home page - [2026-05-14 16:15 IST]
              <Link href={`/?category=${category.name}`} key={category.name}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                className="group relative bg-card rounded-2xl p-6 border border-border/50 hover:border-brand-orange-500/50 hover:shadow-xl hover:shadow-brand-orange-500/10 transition-all duration-300 cursor-pointer overflow-hidden"
              >
                <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${category.color} rounded-full blur-3xl opacity-10 group-hover:opacity-30 transition-opacity duration-300 transform translate-x-10 -translate-y-10`}></div>
                
                <div className="flex items-center justify-between mb-8 relative z-10">
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${category.color} text-white shadow-lg`}>
                    <category.icon className="h-6 w-6" />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground bg-muted px-3 py-1 rounded-full">
                    {/* Modified: Use dynamic count instead of hardcoded - [2026-05-14 16:30 IST] */}
                    {counts[category.name] || 0} items
                  </span>
                </div>
                
                <div className="relative z-10">
                  <h3 className="text-xl font-bold text-foreground mb-1 group-hover:text-brand-orange-500 transition-colors">
                    {category.name}
                  </h3>
                  <div className="text-sm text-brand-orange-500 font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-[-10px] group-hover:translate-x-0 duration-300">
                    Explore collection &rarr;
                  </div>
                </div>
              </motion.div>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
