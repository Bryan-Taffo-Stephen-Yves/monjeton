import { Link, useLocation } from "react-router-dom";
import { Home, Plus, PieChart, Settings, BookOpen } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useFabHidden } from "@/lib/fabVisibility";

/**
 * Barre de navigation flottante + bouton d'ajout détaché.
 *
 * - La barre ne touche plus les bords : elle flotte au-dessus du contenu,
 *   coins arrondis, fond translucide. Le contenu respire sous elle.
 * - Le "+" est sorti de la barre : c'est un bouton rond flottant en bas
 *   à droite (FAB), au-dessus de la barre. Résultat : 4 items bien espacés
 *   dans la barre (cibles plus larges) et un "+" qui gagne en présence.
 *
 * Les hauteurs consommées par le layout (Screen.tsx, DashboardLayout.tsx)
 * ont été ajustées en conséquence, garder ces valeurs cohérentes.
 */

/**
 * Écrans qui possèdent déjà leur propre bouton flottant.
 * Sur ceux-là, le "+" global est masqué pour éviter une pile de boutons.
 */
/**
 * Écrans où le bouton "+" flottant est masqué.
 * - /dashboard et /debts ont déjà leur propre bouton d'action
 * - /assistant : le "+" recouvrait le bouton d'envoi du message
 * - /categories et /scan : il gênait les actions de la page
 */
// Le « + » ouvre la saisie d'une transaction : inutile sur la page de
// saisie elle-même, comme sur les écrans qui ont déjà leur action propre.
const HIDE_FAB_ON = ["/dashboard", "/debts", "/assistant", "/categories", "/scan", "/transactions/new"];

const navItems = [
  { icon: Home, label: "Accueil", path: "/dashboard" },
  { icon: BookOpen, label: "Transactions", path: "/transactions" },
  { icon: PieChart, label: "Rapports", path: "/reports" },
  { icon: Settings, label: "Plus", path: "/settings" },
];

const LimelightNav = () => {
  const location = useLocation();

  const isActivePath = (path: string) =>
    location.pathname === path ||
    (path !== "/dashboard" && location.pathname.startsWith(path));

  const fabHiddenByScreen = useFabHidden();
  const showFab = !HIDE_FAB_ON.includes(location.pathname) && !fabHiddenByScreen;

  return (
    <>
      {/* Bouton d'ajout — flottant, détaché de la barre.
          Masqué sur les écrans qui ont déjà le leur. */}
      {showFab && (
      <Link
        to="/transactions/new"
        aria-label="Ajouter une transaction"
        className="fixed right-5 z-50"
        style={{
          bottom:
            "calc(96px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <motion.div
          whileTap={{ scale: 0.9 }}
          className="w-14 h-14 rounded-full gradient-primary flex items-center justify-center shadow-[0_10px_28px_hsla(100,100%,61%,0.36)]"
        >
          <Plus className="w-6 h-6 text-primary-foreground" strokeWidth={2.6} />
        </motion.div>
      </Link>
      )}

      {/* Barre flottante */}
      <nav
        className="fixed left-4 right-4 z-40"
        style={{
          bottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div className="mx-auto max-w-lg flex items-center justify-between gap-1 rounded-full bg-card/85 backdrop-blur-2xl border border-border/70 px-2.5 py-2 shadow-[0_16px_42px_rgba(0,0,0,0.55)]">
          {navItems.map((item) => {
            const isActive = isActivePath(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className="relative flex-1"
                aria-label={item.label}
              >
                <motion.div
                  whileTap={{ scale: 0.9 }}
                  className={cn(
                    "flex flex-col items-center gap-1 py-1.5 rounded-full transition-colors duration-300",
                    isActive && "nav-active bg-primary/15"
                  )}
                >
                  <item.icon
                    className={cn(
                      "w-5 h-5 transition-colors duration-300",
                      isActive ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                  <span
                    className={cn(
                      "text-[9.5px] font-bold transition-colors duration-300",
                      isActive ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {item.label}
                  </span>
                </motion.div>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default LimelightNav;
