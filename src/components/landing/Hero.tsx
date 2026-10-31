import { useNavigate } from "react-router-dom";
import {
  Play,
  Star,
  AlertTriangle,
  ScanLine,
  Users,
  Target,
  ArrowDown,
} from "lucide-react";
import MarkerText from "./MarkerText";
import { useLandingT } from "@/hooks/useLandingT";
import type { LandingStrings } from "@/lib/landingI18n";

const LIME = "#7CFF3A";
const TEXT = "#EAFBEA";
const BG = "#04060A";

const scrollToId = (id: string, fallback?: string) => {
  const el =
    document.getElementById(id) ||
    (fallback ? document.getElementById(fallback) : null);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - 80;
  window.scrollTo({ top, behavior: "smooth" });
};

/* ---------- Phone screen (HTML rebuild) ---------- */
const PhoneScreen = ({ lt }: { lt: LandingStrings }) => {
  const bars = [40, 65, 30, 80, 55, 95, 45];
  return (
    <div
      className="w-full h-full flex flex-col gap-3 p-4"
      style={{
        background:
          "linear-gradient(180deg, #06100A 0%, #04070A 60%, #05080B 100%)",
        color: TEXT,
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between pt-6">
        <div>
          <div className="text-[10px] text-white/50">{lt.phone_hello}</div>
          <div className="text-sm font-bold">Bryan</div>
        </div>
        <div
          className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full"
          style={{
            background: "rgba(124,255,58,0.14)",
            color: LIME,
            border: "1px solid rgba(124,255,58,0.25)",
          }}
        >
          <ArrowDown size={10} /> {lt.phone_vs_month}
        </div>
      </div>

      {/* Hero card */}
      <div
        className="rounded-2xl p-3"
        style={{
          background:
            "linear-gradient(160deg, rgba(124,255,58,0.18) 0%, rgba(124,255,58,0.04) 100%)",
          border: "1px solid rgba(124,255,58,0.28)",
        }}
      >
        <div className="text-[10px] text-white/60">{lt.phone_expenses_july}</div>
        <div className="text-lg font-extrabold mt-0.5" style={{ color: TEXT }}>
          128 500 <span className="text-[10px] text-white/50">FCFA</span>
        </div>
        <div className="flex items-end gap-1 h-10 mt-2">
          {bars.map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm"
              style={{
                height: `${h}%`,
                background: i === 5 ? LIME : "rgba(234,251,234,0.18)",
              }}
            />
          ))}
        </div>
      </div>

      {/* Mini cards */}
      <div className="grid grid-cols-2 gap-2">
        <div
          className="rounded-xl p-2"
          style={{
            background: "rgba(124,255,58,0.08)",
            border: "1px solid rgba(124,255,58,0.18)",
          }}
        >
          <div className="text-[9px] text-white/50">{lt.phone_income}</div>
          <div className="text-xs font-bold" style={{ color: LIME }}>
            210 000
          </div>
        </div>
        <div
          className="rounded-xl p-2"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div className="text-[9px] text-white/50">{lt.phone_expenses}</div>
          <div className="text-xs font-bold">128 500</div>
        </div>
      </div>

      {/* Transactions */}
      <div className="flex flex-col gap-1.5 mt-1">
        <div
          className="flex items-center justify-between rounded-lg px-2.5 py-1.5"
          style={{ background: "rgba(255,255,255,0.03)" }}
        >
          <span className="text-[10px] text-white/70">{lt.phone_freelance}</span>
          <span className="text-[10px] font-bold" style={{ color: LIME }}>
            +50 000
          </span>
        </div>
        <div
          className="flex items-center justify-between rounded-lg px-2.5 py-1.5"
          style={{ background: "rgba(255,255,255,0.03)" }}
        >
          <span className="text-[10px] text-white/70">{lt.phone_restaurant}</span>
          <span className="text-[10px] font-bold text-red-400">-8 500</span>
        </div>
      </div>
    </div>
  );
};

/* ---------- Phone frame ---------- */
const Phone = ({ lt }: { lt: LandingStrings }) => (
  <div
    className="relative mx-auto hero-float-slow"
    style={{
      width: "min(280px, 72vw)",
      aspectRatio: "9 / 19",
      borderRadius: 46,
      padding: 8,
      background:
        "linear-gradient(160deg, #3a3d42 0%, #17191c 40%, #2a2d31 70%, #101215 100%)",
      boxShadow:
        "0 40px 80px -20px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06), inset 0 0 0 1px rgba(255,255,255,0.05)",
    }}
  >
    <div
      className="relative w-full h-full overflow-hidden"
      style={{ borderRadius: 38, background: BG }}
    >
      {/* Dynamic Island */}
      <div
        className="absolute left-1/2 -translate-x-1/2 z-10"
        style={{
          top: 10,
          width: 90,
          height: 26,
          borderRadius: 20,
          background: "#000",
        }}
      />
      <PhoneScreen lt={lt} />
    </div>
  </div>
);

/* ---------- Floating card ---------- */
interface FloatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  progress?: number;
  rotate: number;
  delay: number;
  className: string;
  hideOnMobile?: boolean;
}
const FloatCard = ({
  icon,
  label,
  value,
  sub,
  progress,
  rotate,
  delay,
  className,
  hideOnMobile,
}: FloatCardProps) => (
  <div
    className={`absolute hero-float ${className} ${hideOnMobile ? "hidden md:block" : ""}`}
    style={{
      ["--rot" as string]: `${rotate}deg`,
      animationDelay: `${delay}s`,
      background: "rgba(13,21,18,0.92)",
      border: "1px solid rgba(124,255,58,0.16)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      borderRadius: 16,
      padding: "10px 12px",
      minWidth: 148,
      boxShadow: "0 10px 30px -10px rgba(0,0,0,0.6)",
      color: TEXT,
    }}
  >
    <div className="flex items-center gap-2 mb-1">
      <div className="shrink-0">{icon}</div>
      <div className="text-[10px] text-white/55 leading-tight">{label}</div>
    </div>
    <div className="text-xs font-bold leading-tight">{value}</div>
    {sub && <div className="text-[10px] text-white/50 mt-0.5">{sub}</div>}
    {typeof progress === "number" && (
      <div className="mt-1.5 h-1 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${progress}%`, background: LIME }}
        />
      </div>
    )}
  </div>
);

/* ---------- Hero ---------- */
const Hero = () => {
  const navigate = useNavigate();
  const { lt } = useLandingT();

  return (
    <section
      id="hero"
      className="relative overflow-hidden"
      style={{ background: "linear-gradient(180deg, #14171C 0%, #101318 100%)", color: TEXT }}
    >
      {/* Ambient lime glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, rgba(124,255,58,0.18), transparent 70%)",
          filter: "blur(20px)",
        }}
      />

      <div className="relative container mx-auto px-4 pt-20 pb-24 md:pt-28 md:pb-32">
        <div className="grid grid-cols-1 md:grid-cols-[1.05fr_0.95fr] gap-10 md:gap-8 items-center">
          {/* LEFT — Text */}
          <div className="relative z-10">
            <h1
              className="font-display uppercase font-extrabold"
              style={{
                fontSize: "clamp(40px, 8.5vw, 74px)",
                lineHeight: 0.95,
                letterSpacing: "-0.02em",
              }}
            >
              <span className="block">{lt.hero_line1}</span>
              <span className="block mt-1">
                <MarkerText variant="lime">{lt.hero_word_expenses}</MarkerText>
              </span>
              <span
                className="block mt-1"
                style={{
                  color: "transparent",
                  WebkitTextStroke: "2px rgba(234,251,234,0.5)",
                }}
              >
                {lt.hero_word_income}
              </span>
              <span className="block mt-1">
                <MarkerText variant="dark">{lt.hero_word_savings}</MarkerText>
              </span>
            </h1>

            <p
              className="mt-6 max-w-xl text-base md:text-lg"
              style={{ color: "rgba(234,251,234,0.7)" }}
            >
              {lt.hero_subtitle}
            </p>

            {/* Buttons */}
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={() => navigate("/signup")}
                className="font-display font-bold px-6 py-3 rounded-xl transition-transform hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: LIME, color: "#04060A" }}
              >
                {lt.hero_cta_signup}
              </button>
              <button
                onClick={() => navigate("/login")}
                className="font-display font-bold px-6 py-3 rounded-xl transition-colors hover:bg-white/10"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  color: TEXT,
                  border: "1px solid rgba(234,251,234,0.35)",
                }}
              >
                {lt.nav_login}
              </button>
              <button
                onClick={() => scrollToId("pricing")}
                className="font-display font-bold px-6 py-3 rounded-xl transition-colors"
                style={{
                  background: "#0d1512",
                  color: LIME,
                  border: `1px solid ${LIME}`,
                }}
              >
                {lt.hero_cta_pro}
              </button>
              <button
                onClick={() => scrollToId("demo", "features")}
                className="font-display font-semibold px-5 py-3 rounded-xl flex items-center gap-2 transition-colors hover:bg-white/5"
                style={{ color: TEXT }}
              >
                <Play size={16} /> {lt.hero_cta_demo}
              </button>
            </div>

            {/* Trust line */}
            <div className="mt-6 flex items-center gap-2">
              <div className="flex">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star
                    key={i}
                    size={14}
                    color="#F5B301"
                    fill="#F5B301"
                    strokeWidth={0}
                  />
                ))}
              </div>
              <span className="text-xs" style={{ color: "rgba(234,251,234,0.65)" }}>
                {lt.hero_trust}
              </span>
            </div>
          </div>

          {/* RIGHT — Phone stage */}
          <div
            className="relative mx-auto w-full"
            style={{ minHeight: 500 }}
          >
            <Phone lt={lt} />

            {/* Floating cards */}
            <FloatCard
              hideOnMobile
              icon={<AlertTriangle size={16} color="#FF5A5A" />}
              label={lt.fc_alert}
              value="-32 000 F"
              sub={lt.fc_alert_sub}
              rotate={-5}
              delay={0.1}
              className="top-4 -left-2 md:-left-6"
            />
            <FloatCard
              icon={<ScanLine size={16} color={LIME} />}
              label={lt.fc_scan}
              value={lt.fc_scan_val}
              rotate={6}
              delay={0.35}
              className="top-8 -right-2 md:-right-4"
            />
            <FloatCard
              icon={<Users size={16} color={LIME} />}
              label={lt.fc_tontine}
              value={lt.fc_tontine_val}
              progress={70}
              rotate={-4}
              delay={0.6}
              className="bottom-6 -left-2 md:-left-8"
            />
            <FloatCard
              icon={<Target size={16} color="#F5B301" />}
              label={lt.fc_budget}
              value={lt.fc_budget_val}
              rotate={5}
              delay={0.85}
              className="bottom-10 -right-2 md:-right-6"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
