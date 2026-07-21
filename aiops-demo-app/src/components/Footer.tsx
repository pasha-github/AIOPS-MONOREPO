/**
 * Footer Component
 * Renders the global footer for the application.
 */
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="w-full bg-card border-t border-border mt-auto">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-1">
            <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-brand-orange-500 to-brand-pink-500">NovaCart</span>
            <p className="mt-4 text-sm text-muted-foreground">
              Experience the next generation of online shopping. Fast, reliable, and incredibly smooth.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-foreground mb-4">Shop</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="#" className="hover:text-brand-orange-500 transition-colors">All Products</Link></li>
              <li><Link href="#" className="hover:text-brand-orange-500 transition-colors">Featured Deals</Link></li>
              <li><Link href="#" className="hover:text-brand-orange-500 transition-colors">New Arrivals</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-foreground mb-4">Support</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="#" className="hover:text-brand-orange-500 transition-colors">Help Center</Link></li>
              <li><Link href="#" className="hover:text-brand-orange-500 transition-colors">Order Status</Link></li>
              <li><Link href="#" className="hover:text-brand-orange-500 transition-colors">Returns & Refunds</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-foreground mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="#" className="hover:text-brand-orange-500 transition-colors">Privacy Policy</Link></li>
              <li><Link href="#" className="hover:text-brand-orange-500 transition-colors">Terms of Service</Link></li>
              <li><Link href="#" className="hover:text-brand-orange-500 transition-colors">Cookie Policy</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center text-xs text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} NovaCart Retail. All rights reserved.</p>
          <div className="flex gap-4 mt-4 md:mt-0">
            <Link href="#" className="hover:text-foreground transition-colors">Twitter</Link>
            <Link href="#" className="hover:text-foreground transition-colors">Instagram</Link>
            <Link href="#" className="hover:text-foreground transition-colors">LinkedIn</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
