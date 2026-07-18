import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "@/contexts/CartContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { AdminProvider } from "@/contexts/AdminContext";
import { PricingProvider } from "@/contexts/PricingContext";
import LandingPage from "./pages/LandingPage";
import MenuPage from "./pages/MenuPage";
import CartPage from "./pages/CartPage";
import ContactPage from "./pages/ContactPage";
import AuthPage from "./pages/AuthPage";
import ProfilePage from "./pages/ProfilePage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import AdminCustomersPage from "./pages/admin/AdminCustomersPage";
import AdminMenuPage from "./pages/admin/AdminMenuPage";
import AdminOrdersPage from "./pages/admin/AdminOrdersPage";
import AdminChatPage from "./pages/admin/AdminChatPage";
import AdminSMSPage from "./pages/admin/AdminSMSPage";
import AdminSettingsPage from "./pages/admin/AdminSettingsPage";
import AdminSalesPage from "./pages/admin/AdminSalesPage";
import AdminPricingPage from "./pages/admin/AdminPricingPage";
import AdminOrderHistoryPage from "./pages/admin/AdminOrderHistoryPage";
import OrderConfirmationPage from "./pages/OrderConfirmationPage";
import LivreurOrdersPage from "./pages/LivreurOrdersPage";
import NotFound from "./pages/NotFound";
import CutoffPreviewPage from "./pages/dev/CutoffPreviewPage";
import UnsubscribePage from "./pages/UnsubscribePage";
import { useEffect } from "react";
import { initNotificationSounds } from "@/lib/notificationSounds";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    // Unlock the Web Audio API on the first user interaction so notification
    // sounds can play later, even when triggered by realtime events.
    const unlock = () => initNotificationSounds();
    const events: (keyof DocumentEventMap)[] = ["click", "touchstart", "keydown"];
    events.forEach((e) => document.addEventListener(e, unlock, { once: false }));

    // iOS/Android suspend the AudioContext when the app goes to the background.
    // Re-resume it as soon as the app is visible/focused again so foreground
    // notification sounds keep working after returning from the background.
    const resumeOnForeground = () => {
      if (document.visibilityState === "visible") initNotificationSounds();
    };
    document.addEventListener("visibilitychange", resumeOnForeground);
    window.addEventListener("focus", resumeOnForeground);

    return () => {
      events.forEach((e) => document.removeEventListener(e, unlock));
      document.removeEventListener("visibilitychange", resumeOnForeground);
      window.removeEventListener("focus", resumeOnForeground);
    };
  }, []);


  return (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <AdminProvider>
        <PricingProvider>
        <CartProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/menu" element={<MenuPage />} />
                <Route path="/cart" element={<CartPage />} />
                <Route path="/order-confirmation" element={<OrderConfirmationPage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/livreur" element={<LivreurOrdersPage />} />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/users" element={<AdminUsersPage />} />
                <Route path="/admin/customers" element={<AdminCustomersPage />} />
                <Route path="/admin/menu" element={<AdminMenuPage />} />
                <Route path="/admin/orders" element={<AdminOrdersPage />} />
                <Route path="/admin/orders-history" element={<AdminOrderHistoryPage />} />
                <Route path="/admin/chat" element={<AdminChatPage />} />
                <Route path="/admin/sms" element={<AdminSMSPage />} />
                <Route path="/admin/settings" element={<AdminSettingsPage />} />
                <Route path="/admin/sales" element={<AdminSalesPage />} />
                <Route path="/admin/pricing" element={<AdminPricingPage />} />
                <Route path="/dev/cutoff-preview" element={<CutoffPreviewPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </CartProvider>
        </PricingProvider>
      </AdminProvider>
    </AuthProvider>
  </QueryClientProvider>
  );
};

export default App;
