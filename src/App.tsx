import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { CountryProvider } from "@/contexts/CountryContext";
import { AppLangProvider } from "@/lib/appTranslation";
import { AutoTranslate } from "@/components/AutoTranslate";
import ErrorBoundary from "@/components/ErrorBoundary";
import JekoCheckoutDialog from "@/components/JekoCheckoutDialog";
import { lazy, Suspense } from "react";

// Landing eager for instant first paint on "/"
import Landing from "./pages/Landing";
import { isAppExperience } from "@/lib/appEntry";

// Everything that touches Supabase / auth is behind this split
const PrivateApp = lazy(() => import("./PrivateApp"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const Terms = lazy(() => import("./pages/Terms"));

const PageLoader = () => (
  <div
    className="min-h-screen flex flex-col items-center justify-center gap-5"
    style={{ background: "hsl(var(--background))" }}
  >
    <div
      className="w-[68px] h-[68px] rounded-[18px] flex items-center justify-center"
      style={{
        background: "linear-gradient(150deg, hsl(var(--primary)), hsl(var(--primary) / 0.8))",
        boxShadow: "0 0 40px hsl(var(--primary) / 0.3)",
      }}
    >
      <span
        className="text-[30px] font-extrabold tracking-[-0.04em]"
        style={{ color: "hsl(var(--primary-foreground))" }}
      >
        MJ
      </span>
    </div>
    <div className="w-[120px] h-[3px] rounded-full overflow-hidden" style={{ background: "hsl(var(--primary) / 0.16)" }}>
      <div className="h-full w-2/5 rounded-full bg-primary animate-[loaderSlide_1.1s_ease-in-out_infinite]" />
    </div>
  </div>
);

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider
    attribute="class"
    defaultTheme="dark"
    themes={["dark", "light", "cream"]}
    enableSystem={false}
    disableTransitionOnChange
  >
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <JekoCheckoutDialog />
          <AppLangProvider>
            <AutoTranslate>
              <BrowserRouter>
                <CountryProvider>
                  <Routes>
                    {/* Navigateur : landing publique. Application installée : écrans de bienvenue. */}
                    <Route path="/" element={isAppExperience() ? <Navigate to="/bienvenue" replace /> : <Landing />} />
                    <Route
                      path="/privacy"
                      element={
                        <Suspense fallback={<PageLoader />}>
                          <PrivacyPolicy />
                        </Suspense>
                      }
                    />
                    <Route
                      path="/terms"
                      element={
                        <Suspense fallback={<PageLoader />}>
                          <Terms />
                        </Suspense>
                      }
                    />
                    <Route
                      path="*"
                      element={
                        <Suspense fallback={<PageLoader />}>
                          <PrivateApp />
                        </Suspense>
                      }
                    />
                  </Routes>
                </CountryProvider>
              </BrowserRouter>
            </AutoTranslate>
          </AppLangProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </ThemeProvider>
);

export default App;
