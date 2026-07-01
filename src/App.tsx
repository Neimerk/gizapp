import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "./app/router";
import { initAuth } from "./stores/authStore";

export default function App() {
  useEffect(() => {
    initAuth();
  }, []);
  return <RouterProvider router={router} />;
}