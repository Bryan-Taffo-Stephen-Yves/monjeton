import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Globe, ChevronDown } from "lucide-react";
import logoImg from "@/assets/logo-monjeton.webp";
import { useLandingT } from "@/hooks/useLandingT";
import { useCountry } from "@/contexts/CountryContext";
import type { Lang } from "@/lib/i18n";

const NAVBAR_OFFSET = 80;

const scrollToAnchor = (href: string) => {
  const el = document.querySelector(href) as HTMLElement | null;
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - NAVBAR_OFFSET;
  window.scrollTo({ top, behavior: "smooth" });
};

const handleAnchorClick = (
  e: React.MouseEvent<HTMLAnchorElement>,
  href: string,
  onDone?: () => void,
) => {
  if (href.startsWith("#")) {
    e.preventDefault();
    onDone?.();
    window.setTimeout(() => scrollToAnchor(href), 60);
  }
};

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeId, setActiveId] = useState<string>("hero");
  const { lt } = useLandingT();
  const { country, setLang } = useCountry();
  const lang = country.lang;
  const navigate = useNavigate();

  const navItems = [
    { label: lt.nav_home ?? "Accueil", href: "#hero", id: "hero" },
    { label: lt.nav_features, href: "#demo", id: "demo" },
    { label: lt.nav_pricing, href: "#pricing", id: "pricing" },
    { label: lt.nav_testimonials ?? "Témoignages", href: "#testimonials", id: "testimonials" },
    { label: lt.nav_contact ?? "Contact", href: "#footer", id: "footer" },
  ];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Active section tracking via IntersectionObserver
  useEffect(() => {
    const ids = navItems.map((n) => n.id);
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target.id) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <motion.nav
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed top-3 sm:top-4 left-0 right-0 z-50 px-3 sm:px-5"
    >
      <div
        className="mx-auto flex items-center justify-between gap-3 rounded-full transition-all duration-300"
        style={{
          maxWidth: "1120px",
          padding: "12px 20px",
          background: scrolled ? "rgba(20,23,28,0.85)" : "rgba(20,23,28,0.7)",
          border: "1px solid rgba(124,255,58,0.12)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow: scrolled
            ? "0 10px 30px rgba(0,0,0,0.35)"
            : "0 6px 20px rgba(0,0,0,0.25)",
        }}
      >
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
          <img
            src={logoImg}
            alt="Mon Jeton"
            className="h-8 w-auto rounded-lg flex-shrink-0"
            loading="lazy"
          />
          <span className="font-display font-black text-base sm:text-lg text-[#EAFBEA] whitespace-nowrap hidden sm:block">
            Mon Jeton
          </span>
        </Link>

        {/* Liens desktop */}
        <div className="hidden lg:flex items-center gap-1 flex-1 justify-center flex-nowrap">
          {navItems.map((item) => {
            const isActive = activeId === item.id;
            return (
              <a
                key={item.id}
                href={item.href}
                onClick={(e) => {
                  setActiveId(item.id);
                  handleAnchorClick(e, item.href);
                }}
                className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold transition-all duration-200 ${
                  isActive
                    ? "bg-[#7CFF3A] text-[#14171C] shadow-[0_0_20px_rgba(124,255,58,0.35)]"
                    : "text-[rgba(234,251,234,0.75)] hover:text-[#7CFF3A]"
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </div>

        {/* Actions desktop */}
        <div className="hidden lg:flex items-center gap-2 flex-shrink-0">
          {/* Sélecteur de langue */}
          <div ref={langRef} className="relative">
            <button
              type="button"
              onClick={() => setLangOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={langOpen}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-bold text-[#EAFBEA] border border-[rgba(124,255,58,0.18)] bg-[rgba(124,255,58,0.04)] hover:bg-[rgba(124,255,58,0.10)] transition"
            >
              <Globe className="w-4 h-4 text-[#7CFF3A]" />
              <span className="uppercase">{lang}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${langOpen ? "rotate-180" : ""}`}
              />
            </button>
            <AnimatePresence>
              {langOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                  role="menu"
                  className="absolute right-0 mt-2 min-w-[160px] rounded-2xl overflow-hidden z-50"
                  style={{
                    background: "#0d1512",
                    border: "1px solid rgba(124,255,58,0.3)",
                  }}
                >
                  {([
                    { code: "fr", label: "Français" },
                    { code: "en", label: "English" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.code}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setLang(opt.code as Lang);
                        setLangOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                        lang === opt.code
                          ? "text-[#7CFF3A] bg-[rgba(124,255,58,0.08)]"
                          : "text-[#EAFBEA] hover:bg-[rgba(124,255,58,0.06)]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            type="button"
            onClick={() => navigate("/login")}
            className="px-4 py-2 rounded-full text-sm font-semibold text-[#EAFBEA] whitespace-nowrap transition-colors hover:bg-[rgba(124,255,58,0.08)]"
          >
            {lt.nav_login}
          </button>

          <button
            type="button"
            onClick={() => navigate("/signup")}
            className="px-5 py-2 rounded-full text-sm font-bold text-white whitespace-nowrap transition-transform hover:scale-105"
            style={{
              background: "#0d1512",
              border: "1px solid rgba(124,255,58,0.35)",
              boxShadow: "0 0 20px rgba(124,255,58,0.15)",
            }}
          >
            {lt.nav_signup}
          </button>
        </div>

        {/* Hamburger (< lg) */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
          className="lg:hidden w-10 h-10 rounded-full border border-[rgba(124,255,58,0.18)] bg-[rgba(124,255,58,0.04)] flex items-center justify-center flex-shrink-0"
        >
          {menuOpen ? (
            <X className="w-5 h-5 text-[#EAFBEA]" />
          ) : (
            <Menu className="w-5 h-5 text-[#EAFBEA]" />
          )}
        </button>
      </div>

      {/* Menu mobile */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden mx-auto mt-3 rounded-3xl overflow-hidden"
            style={{
              maxWidth: "1120px",
              background: "rgba(20,23,28,0.95)",
              border: "1px solid rgba(124,255,58,0.12)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
            }}
          >
            <div className="px-4 py-4 flex flex-col gap-1.5">
              {navItems.map((item) => {
                const isActive = activeId === item.id;
                return (
                  <a
                    key={item.id}
                    href={item.href}
                    onClick={(e) => {
                      setActiveId(item.id);
                      setMenuOpen(false);
                      handleAnchorClick(e, item.href);
                    }}
                    className={`px-4 py-3 rounded-full text-sm font-bold transition-all whitespace-nowrap ${
                      isActive
                        ? "bg-[#7CFF3A] text-[#14171C]"
                        : "text-[rgba(234,251,234,0.75)] hover:text-[#7CFF3A] hover:bg-[rgba(124,255,58,0.08)]"
                    }`}
                  >
                    {item.label}
                  </a>
                );
              })}

              <div className="border-t border-[rgba(124,255,58,0.12)] pt-3 mt-2 flex flex-col gap-2">
                {/* Sélecteur de langue mobile */}
                <div className="flex items-center justify-center gap-2">
                  {([
                    { code: "fr", label: "FR" },
                    { code: "en", label: "EN" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.code}
                      type="button"
                      onClick={() => setLang(opt.code as Lang)}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-full text-sm font-bold transition ${
                        lang === opt.code
                          ? "bg-[rgba(124,255,58,0.12)] text-[#7CFF3A] border border-[rgba(124,255,58,0.35)]"
                          : "text-[#EAFBEA] border border-[rgba(124,255,58,0.18)] bg-[rgba(124,255,58,0.04)]"
                      }`}
                    >
                      <Globe className="w-4 h-4" />
                      {opt.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate("/login");
                  }}
                  className="text-center py-3 rounded-full text-sm font-bold text-[#EAFBEA] border border-[rgba(234,251,234,0.25)]"
                >
                  {lt.nav_login}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate("/signup");
                  }}
                  className="text-center py-3 rounded-full text-sm font-bold text-white"
                  style={{
                    background: "#0d1512",
                    border: "1px solid rgba(124,255,58,0.35)",
                    boxShadow: "0 0 20px rgba(124,255,58,0.15)",
                  }}
                >
                  {lt.nav_signup}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

export default Navbar;
