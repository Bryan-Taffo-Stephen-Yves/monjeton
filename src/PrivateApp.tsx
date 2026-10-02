import { lazy, Suspense, type ReactNode } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { PrivacyProvider, usePrivacy } from "@/contexts/PrivacyContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminRoute from "@/components/AdminRoute";
import OnboardingGuard from "@/components/OnboardingGuard";
import PinLockScreen from "@/components/PinLockScreen";
import CurrencyRateLoader from "@/components/CurrencyRateLoader";
import ProCelebrationModal from "@/components/ProCelebrationModal";
import NotFound from "./pages/NotFound";
import { isAppExperience } from "@/lib/appEntry";

const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
// Écrans d'entrée de l'application mobile (App Store / Play Store)
const AppWelcome = lazy(() => import("./pages/AppWelcome"));
const AppAuth = lazy(() => import("./pages/AppAuth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Pricing = lazy(() => import("./pages/Pricing"));

const Transactions = lazy(() => import("./pages/Transactions"));
const NewTransaction = lazy(() => import("./pages/NewTransaction"));
const Categories = lazy(() => import("./pages/Categories"));
const Wallets = lazy(() => import("./pages/Wallets"));
const Reports = lazy(() => import("./pages/Reports"));
const Savings = lazy(() => import("./pages/Savings"));
const Debts = lazy(() => import("./pages/Debts"));
const Assistant = lazy(() => import("./pages/Assistant"));
const Settings = lazy(() => import("./pages/Settings"));
const Parametres = lazy(() => import("./pages/Parametres"));
const Admin = lazy(() => import("./pages/Admin"));
const AdminPayments = lazy(() => import("./pages/AdminPayments"));
const Budgets = lazy(() => import("./pages/Budgets"));
const Tontine = lazy(() => import("./pages/Tontine"));
const Scan = lazy(() => import("./pages/Scan"));
const WaveImport = lazy(() => import("./pages/WaveImport"));
const Install = lazy(() => import("./pages/Install"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const BRVMSimulator = lazy(() => import("./pages/BRVMSimulator"));
const Receipts = lazy(() => import("./pages/Receipts"));
const PaymentPending = lazy(() => import("./pages/PaymentPending"));
const SubscriptionManage = lazy(() => import("./pages/SubscriptionManage"));
const RejoindreCaisse = lazy(() => import("./pages/RejoindreCaisse"));
const ActivatePro = lazy(() => import("./pages/ActivatePro"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));

const PageLoader = () => (
  <div className="min-h-screen gradient-bg flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

/**
 * Enveloppe des pages privées : met à jour le titre de l'onglet
 * ("<Page> — Mon Jeton") et interdit l'indexation (robots noindex,
 * aucune canonical publique).
 */
const PrivatePage = ({ title, path, children }: { title: string; path: string; children: ReactNode }) => {
  useDocumentMeta({
    title,
    description: "Espace privé de l'application Mon Jeton. Connecte-toi pour accéder à cette page.",
    path,
    noIndex: true,
  });
  return <>{children}</>;
};

const InnerRoutes = () => {
  const { isLocked } = usePrivacy();
  const { user } = useAuth();
  if (isLocked && user) return <PinLockScreen />;

  return (
    <Suspense fallback={<PageLoader />}>
      <CurrencyRateLoader />
      <ProCelebrationModal />
      <Routes>
        <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
        <Route path="/bienvenue" element={isAppExperience() ? <AppWelcome /> : <Navigate to="/" replace />} />
        <Route path="/login" element={isAppExperience() ? <AppAuth mode="login" /> : <Login />} />
        <Route path="/signup" element={isAppExperience() ? <AppAuth mode="signup" /> : <Signup />} />
        <Route path="/pricing" element={<Pricing />} />
        {/* Ancienne page de paiement : le paiement se fait désormais dans la modale des tarifs */}
        <Route path="/subscribe" element={<Navigate to="/pricing" replace />} />
        <Route path="/install" element={<Install />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/payment-pending" element={<PaymentPending />} />
        <Route path="/onboarding" element={<PrivatePage title="Configuration — Mon Jeton" path="/onboarding"><ProtectedRoute><Onboarding /></ProtectedRoute></PrivatePage>} />
        <Route path="/dashboard" element={<PrivatePage title="Tableau de bord — Mon Jeton" path="/dashboard"><ProtectedRoute><OnboardingGuard><Dashboard /></OnboardingGuard></ProtectedRoute></PrivatePage>} />
        <Route path="/transactions" element={<PrivatePage title="Transactions — Mon Jeton" path="/transactions"><ProtectedRoute><OnboardingGuard><Transactions /></OnboardingGuard></ProtectedRoute></PrivatePage>} />
        <Route path="/transactions/new" element={<PrivatePage title="Nouvelle transaction — Mon Jeton" path="/transactions/new"><ProtectedRoute><OnboardingGuard><NewTransaction /></OnboardingGuard></ProtectedRoute></PrivatePage>} />
        <Route path="/categories" element={<PrivatePage title="Catégories — Mon Jeton" path="/categories"><ProtectedRoute><OnboardingGuard><Categories /></OnboardingGuard></ProtectedRoute></PrivatePage>} />
        <Route path="/wallets" element={<PrivatePage title="Portefeuilles — Mon Jeton" path="/wallets"><ProtectedRoute><OnboardingGuard><Wallets /></OnboardingGuard></ProtectedRoute></PrivatePage>} />
        <Route path="/reports" element={<PrivatePage title="Rapports — Mon Jeton" path="/reports"><ProtectedRoute><OnboardingGuard><Reports /></OnboardingGuard></ProtectedRoute></PrivatePage>} />
        <Route path="/savings" element={<PrivatePage title="Épargne — Mon Jeton" path="/savings"><ProtectedRoute><OnboardingGuard><Savings /></OnboardingGuard></ProtectedRoute></PrivatePage>} />
        <Route path="/debts" element={<PrivatePage title="Dettes — Mon Jeton" path="/debts"><ProtectedRoute><OnboardingGuard><Debts /></OnboardingGuard></ProtectedRoute></PrivatePage>} />
        <Route path="/assistant" element={<PrivatePage title="Assistant — Mon Jeton" path="/assistant"><ProtectedRoute><OnboardingGuard><Assistant /></OnboardingGuard></ProtectedRoute></PrivatePage>} />
        <Route path="/settings" element={<PrivatePage title="Mon espace — Mon Jeton" path="/settings"><ProtectedRoute><OnboardingGuard><Settings /></OnboardingGuard></ProtectedRoute></PrivatePage>} />
        <Route path="/parametres" element={<PrivatePage title="Paramètres — Mon Jeton" path="/parametres"><ProtectedRoute><OnboardingGuard><Parametres /></OnboardingGuard></ProtectedRoute></PrivatePage>} />
        <Route path="/settings/subscription" element={<ProtectedRoute><OnboardingGuard><SubscriptionManage /></OnboardingGuard></ProtectedRoute>} />
        <Route path="/budgets" element={<PrivatePage title="Budgets — Mon Jeton" path="/budgets"><ProtectedRoute><OnboardingGuard><Budgets /></OnboardingGuard></ProtectedRoute></PrivatePage>} />
        <Route path="/tontine" element={<PrivatePage title="Tontines — Mon Jeton" path="/tontine"><ProtectedRoute><OnboardingGuard><Tontine /></OnboardingGuard></ProtectedRoute></PrivatePage>} />
        <Route path="/scan" element={<PrivatePage title="Scan intelligent — Mon Jeton" path="/scan"><ProtectedRoute><OnboardingGuard><Scan /></OnboardingGuard></ProtectedRoute></PrivatePage>} />
        <Route path="/import-wave" element={<PrivatePage title="Importer depuis Wave — Mon Jeton" path="/import-wave"><ProtectedRoute><OnboardingGuard><WaveImport /></OnboardingGuard></ProtectedRoute></PrivatePage>} />
        <Route path="/brvm" element={<PrivatePage title="BRVM — Mon Jeton" path="/brvm"><ProtectedRoute><OnboardingGuard><BRVMSimulator /></OnboardingGuard></ProtectedRoute></PrivatePage>} />
        <Route path="/receipts" element={<PrivatePage title="Reçus — Mon Jeton" path="/receipts"><ProtectedRoute><OnboardingGuard><Receipts /></OnboardingGuard></ProtectedRoute></PrivatePage>} />
        <Route path="/rejoindre-caisse/:token" element={<RejoindreCaisse />} />
        <Route path="/activer" element={<PrivatePage title="Activer Pro — Mon Jeton" path="/activer"><ActivatePro /></PrivatePage>} />
        <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
        <Route path="/admin/paiements" element={<AdminRoute><AdminPayments /></AdminRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
};

const PrivateApp = () => (
  <AuthProvider>
    <PrivacyProvider>
      <InnerRoutes />
    </PrivacyProvider>
  </AuthProvider>
);

export default PrivateApp;
