import { createBrowserRouter } from "react-router-dom";

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

export const router = createBrowserRouter([
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
        path: "carrinho",
        element: <CartPage />,
      },

      {
        path: "checkout",
        element: <CheckoutPage />,
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
      }
    ],
  },
]);