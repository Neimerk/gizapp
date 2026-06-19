import { createBrowserRouter, Navigate, useLocation } from "react-router-dom";

import AppLayout from "../components/layout/AppLayout";
import { useAuthStore } from "../stores/authStore";

import HomePage from "../pages/HomePage";
import StorePage from "../pages/StorePage";
import CartPage from "../pages/CartPage";
import CheckoutPage from "../pages/CheckoutPage";
import OrdersPage from "../pages/OrdersPage";
import AccountPage from "../pages/AccountPage";
import CategoryPage from "../pages/CategoryPage";
import CategoriesPage from "../pages/CategoriesPage";
import SearchPage from "../pages/SearchPage";
import StoresPage from "../pages/StoresPage";
import LoginPage from "../pages/LoginPage";
import AdminPage from "../pages/AdminPage";
import ProductPage from "../pages/ProductPage";
import NotFoundPage from "../pages/NotFoundPage";
import FavoritesPage from "../pages/FavoritesPage";
import ComparePage from "../pages/ComparePage";
import ChatPage from "../pages/ChatPage";
import ServicesPage from "../pages/ServicesPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
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

  return <>{children}</>;
}

export const router = createBrowserRouter([
  {
    path: "/admin",
    element: <AdminPage />,
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
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
