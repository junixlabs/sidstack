import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import App from "./App";
import "./index.css";
import "@xterm/xterm/css/xterm.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      gcTime: 300_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  // StrictMode temporarily disabled - causes terminal PTY to be killed during init
  // TODO: Fix the effect cleanup to handle StrictMode properly
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>,
);
