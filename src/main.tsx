import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { ToastHost } from "./components/ui";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Деньги: показывать устаревшие цифры хуже, чем подождать полсекунды.
      staleTime: 0,
      refetchOnWindowFocus: true,
      retry: false,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastHost>
          <App />
        </ToastHost>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
