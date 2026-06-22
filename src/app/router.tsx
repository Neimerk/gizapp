import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate, useLocation } from "react-router-dom";

import AppLayout from "../components/layout/AppLayout";
import { useAuthStore } from "../stores/authStore";

const HomePage = lazy(() => import("../pages/HomePage"));
const StorePage = lazy(() => import("../pages/StorePage"));
const CartPage = lazy(() => import("../pages/CartPage"));
const CheckoutPage = lazy(() => import("../pages/CheckoutPage"));
const OrdersPage = lazy(() => import("../pages/OrdersPage"));
const AccountPage = lazy(() => import("../pages/AccountPage"));
const CategoryPage = lazy(() => import("../pages/CategoryPage"));
const CategoriesPage = lazy(() => import("../pages/CategoriesPage"));
const SearchPage = lazy(() => import("../pages/SearchPage"));
const StoresPage = lazy(() => import("../pages/StoresPage"));
const LoginPage = lazy(() => import("../pages/LoginPage"));
const AdminPage = lazy(() => import("../pages/AdminPage"));
const ProductPage = lazy(() => import("../pages/ProductPage"));
const NotFoundPage = lazy(() => import("../pages/NotFoundPage"));
const FavoritesPage = lazy(() => import("../pages/FavoritesPage"));
const ComparePage = lazy(() => import("../pages/ComparePage"));
const ChatPage = lazy(() => import("../pages/ChatPage"));
const ServicesPage = lazy(() => import("../pages/ServicesPage"));
const CourierPage  = lazy(() => import("../pages/CourierPage"));
const SobrePage    = lazy(() => import("../pages/SobrePage"));
const PrivacyPage  = lazy(() => import("../pages/PrivacyPage"));

function PageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#16a34a] border-t-transparent" />
    </div>
  );
}

function ProtectedRoute({ children, role }: { children: React.ReactNode; role?: string }) {
  const { user, initialized } = useAuthStore();
  const location = useLocation();

  if (!initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#16a34a] border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (role && user.role !== role) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export const router = createBrowserRouter([
  {
    path: "/admin",
    element: (
      <ProtectedRoute role="Admin">
        <Suspense fallback={<PageSpinner />}>
          <AdminPage />
        </Suspense>
      </ProtectedRoute>
    ),
  },
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "buscar", element: <SearchPage /> },
      { path: "categorias", element: <CategoriesPage /> },
      { path: "categorias/:slug", element: <CategoryPage /> },
      { path: "lojas", element: <StoresPage /> },
      { path: "lojas/:storeId", element: <StorePage /> },
      { path: "lojas/:storeId/produto/:productId", element: <ProductPage /> },
      { path: "carrinho", element: <CartPage /> },
      {
        path: "checkout",
        element: (
          <ProtectedRoute>
            <CheckoutPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "pedidos",
        element: (
          <ProtectedRoute>
            <OrdersPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "conta",
        element: (
          <ProtectedRoute>
            <AccountPage />
          </ProtectedRoute>
        ),
      },
      { path: "login", element: <LoginPage /> },
      { path: "favoritos", element: <FavoritesPage /> },
      { path: "comparar", element: <ComparePage /> },
      { path: "lojas/:storeId/chat", element: <ChatPage /> },
      { path: "servicos", element: <ServicesPage /> },
      { path: "sobre",       element: <SobrePage /> },
      { path: "privacidade", element: <PrivacyPage /> },
      {
        path: "entregador",
        element: (
          <ProtectedRoute>
            <CourierPage />
          </ProtectedRoute>
        ),
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
