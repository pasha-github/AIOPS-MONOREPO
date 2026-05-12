export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  rating: number;
  inventory: number;
}

export const products: Product[] = [
  {
    id: "p1",
    name: "NovaPhone X",
    description: "The ultimate AI-powered smartphone.",
    price: 999.99,
    image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=600&auto=format&fit=crop",
    category: "Smartphones",
    rating: 4.8,
    inventory: 50
  },
  {
    id: "p2",
    name: "NovaBook Pro",
    description: "High-performance laptop for professionals.",
    price: 1999.99,
    image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?q=80&w=600&auto=format&fit=crop",
    category: "Laptops",
    rating: 4.9,
    inventory: 20
  },
  {
    id: "p3",
    name: "Aura Pods",
    description: "Noise-cancelling wireless earbuds.",
    price: 199.99,
    image: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?q=80&w=600&auto=format&fit=crop",
    category: "Audio",
    rating: 4.5,
    inventory: 100
  },
  {
    id: "p4",
    name: "SmartWatch Nova",
    description: "Advanced health tracking on your wrist.",
    price: 299.99,
    image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=600&auto=format&fit=crop",
    category: "Accessories",
    rating: 4.7,
    inventory: 40
  },
  {
    id: "p5",
    name: "NovaHome Hub",
    description: "Control your entire smart home.",
    price: 149.99,
    image: "https://images.unsplash.com/photo-1558089687-f282ffcbc126?q=80&w=600&auto=format&fit=crop",
    category: "Smart Home",
    rating: 4.6,
    inventory: 60
  },
  {
    id: "p6",
    name: "NovaGaming Console",
    description: "Next-gen immersive gaming experience.",
    price: 499.99,
    image: "https://images.unsplash.com/photo-1486401899868-0e435ed85128?q=80&w=600&auto=format&fit=crop",
    category: "Gaming",
    rating: 4.8,
    inventory: 15
  },
  {
    id: "p7",
    name: "NovaVision VR",
    description: "Step into entirely new worlds with 4K virtual reality.",
    price: 349.99,
    image: "https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?q=80&w=600&auto=format&fit=crop",
    category: "Gaming",
    rating: 4.7,
    inventory: 8
  },
  {
    id: "p8",
    name: "Aura Soundbar",
    description: "Cinematic audio experience for your living room.",
    price: 299.99,
    image: "https://images.unsplash.com/photo-1543512214-318c7553f230?q=80&w=600&auto=format&fit=crop",
    category: "Audio",
    rating: 4.6,
    inventory: 25
  },
  {
    id: "p9",
    name: "NovaCam Pro",
    description: "Professional-grade mirrorless camera.",
    price: 1299.99,
    image: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=600&auto=format&fit=crop",
    category: "Photography",
    rating: 4.9,
    inventory: 5
  },
  {
    id: "p10",
    name: "Smart Display Max",
    description: "10-inch smart home controller with video calling.",
    price: 179.99,
    image: "/smart_display_max.png",
    category: "Smart Home",
    rating: 4.5,
    inventory: 40
  }
];
