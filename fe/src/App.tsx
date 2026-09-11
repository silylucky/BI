import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/auth-context";
import { AppErrorBoundary } from "@/components/ui/route-error-boundary";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getAppBasePath } from "@/lib/appBasePath";
import { AppRoutes } from "@/routes";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={getAppBasePath()}>
        <AppErrorBoundary>
          <TooltipProvider delayDuration={250}>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </TooltipProvider>
        </AppErrorBoundary>
        <Toaster position="top-center" richColors />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
