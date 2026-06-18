import { createBrowserRouter, Navigate, useLocation } from "react-router-dom";

import AppLayout from "../components/layout/AppLayout";

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
import { getAuth } from "../services/auth";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  if (!getAuth()) {
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
      {
        index: true,
        element: <HomePage />,
      },

      {
        path: "buscar",
        element: <SearchPage />,
      },

      {
        path: "categorias",
        element: <CategoriesPage />,
      },

      {
        path: "categorias/:slug",
        element: <CategoryPage />,
      },

      {
        path: "lojas",
        element: <StoresPage />,
      },

      {
        path: "lojas/:storeId",
        element: <StorePage />,
      },

      {
        path: "lojas/:storeId/produto/:productId",
        element: <ProductPage />,
      },

      {
        path: "carrinho",
        element: <CartPage />,
      },

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
        element: <OrdersPage />,
      },

      {
        path: "conta",
        element: <AccountPage />,
      },
      {
        path: "login",
        element: <LoginPage />
      },
      {
        path: "favoritos",
        element: <FavoritesPage />,
      },
      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
]);