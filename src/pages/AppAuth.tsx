import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, MailCheck, TriangleAlert, WifiOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { safeReturnTo } from "@/lib/safeRedirect";
import { checkRateLimit, resetRateLimit, sanitizeText, validatePasswordStrength } from "@/lib/security";
import { checkAuthMethod, methodMismatchMessage } from "@/lib/auth-helpers";
import { authLinkBase, isNativeShell, markWelcomeCompleted } from "@/lib/appEntry";
import { Back, Brand, EntryLoader, EntryShell, Primary } from "@/components/entry/EntryParts";
import auchanPhoto from "@/assets/entry/abidjan-auchan.webp";
import googleLogo from "@/assets/entry/google.svg";

/**
 * Inscription et connexion de l'application mobile.
 * Même logique que les pages web /signup et /login (mêmes règles de mot de
 * passe, mêmes protections), avec le design des écrans de bienvenue.
 */

type Mode = "signup" | "login";
type Fields = { name: string; email: string; password: string };
type Notice = { tone: "error" | "network" | "info"; text: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_HINT = "8 caractères, une majuscule, une minuscule et un chiffre.";

// La connexion Google passe par une page web que Google refuse d'ouvrir dans
// une application installée. Elle reste masquée dans l'app tant qu'un vrai
// parcours natif (navigateur système + lien de retour) n'est pas configuré.
const GOOGLE_AVAILABLE = !isNativeShell();

const isNetworkError = (message: string) => /network|failed to fetch|timeout|load failed/i.test(message);

const AppAuth = ({ mode }: { mode: Mode }) => {
  const login = mode === "login";
  useDocumentMeta({
    title: login ? "Se connecter — Mon Jeton" : "Créer un compte — Mon Jeton",
    description: "Connecte-toi à Mon Jeton pour suivre tes dépenses en FCFA.",
    path: login ? "/login" : "/signup",
    noIndex: true,
  });
  const { user, loading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnTo = safeReturnTo(params.get("returnTo"));
  const [fields, setFields] = useState<Fields>({ name: "", email: params.get("email") ?? "", password: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const base = useId();

  // Changement d'écran : on garde l'email, jamais le mot de passe.
  useEffect(() => {
    setFields((f) => ({ ...f, password: "" }));
    setErrors({});
    setNotice(null);
    setShow(false);
    window.scrollTo({ top: 0 });
  }, [mode]);

  if (loading) return <EntryLoader />;
  if (user && !busy) return <Navigate to={returnTo} replace />;

  const change = (key: keyof Fields, value: string) => {
    setFields((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    setNotice(null);
  };

  const focusFirstError = () =>
    requestAnimationFrame(() => form.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus());

  const finish = () => {
    markWelcomeCompleted();
    if (returnTo.startsWith("/rejoindre-caisse/")) {
      localStorage.setItem("post_onboarding_redirect", returnTo);
      localStorage.setItem("invite_context", "caisse");
    }
    navigate(returnTo, { replace: true });
  };

  const switchTo = (target: Mode) => {
    const q = new URLSearchParams(params);
    q.delete("email");
    if (fields.email.trim()) q.set("email", fields.email.trim());
    const query = q.toString();
    navigate(`/${target}${query ? `?${query}` : ""}`, { replace: true });
  };

  const validate = () => {
    const next: Partial<Record<keyof Fields, string>> = {};
    if (!login && !sanitizeText(fields.name).trim()) next.name = "Comment souhaites-tu qu’on t’appelle ?";
    if (!EMAIL_RE.test(fields.email.trim())) next.email = "Vérifie ton adresse email.";
    if (!fields.password) next.password = "Entre ton mot de passe.";
    else if (!login && !validatePasswordStrength(fields.password).strong) next.password = PASSWORD_HINT;
    setErrors(next);
    if (Object.keys(next).length) {
      focusFirstError();
      return false;
    }
    return true;
  };

  const googleMismatch = (message: string) =>
    GOOGLE_AVAILABLE
      ? message
      : "Ce compte utilise la connexion Google, pas encore disponible dans l’application. Utilise « Mot de passe oublié ? » pour lui ajouter un mot de passe.";

  const submitLogin = async (email: string) => {
    const rl = checkRateLimit(`login:${email}`, 5, 5 * 60 * 1000);
    if (!rl.allowed) {
      setNotice({ tone: "error", text: `Trop de tentatives. Réessaie dans ${Math.ceil(rl.retryAfterMs / 1000)} s.` });
      return;
    }
    const { error } = await signIn(email, fields.password);
    if (!error) {
      resetRateLimit(`login:${email}`);
      finish();
      return;
    }
    if (isNetworkError(error.message)) {
      setNotice({ tone: "network", text: "La connexion semble coupée. Tes informations sont toujours ici. Réessaie." });
      return;
    }
    if (/not confirmed/i.test(error.message)) {
      setNotice({ tone: "info", text: "Confirme d’abord ton adresse avec le lien reçu par email, puis reconnecte-toi." });
      return;
    }
    const info = await checkAuthMethod(email);
    const mismatch = methodMismatchMessage(info.method, "email");
    if (info.exists && mismatch) {
      setNotice({ tone: "error", text: info.method === "google" ? googleMismatch(mismatch) : mismatch });
      return;
    }
    setErrors({ password: "Email ou mot de passe incorrect." });
    focusFirstError();
  };

  const submitSignup = async (email: string) => {
    const rl = checkRateLimit("signup", 3, 10 * 60 * 1000);
    if (!rl.allowed) {
      setNotice({ tone: "error", text: "Trop de tentatives. Patiente quelques minutes et réessaie." });
      return;
    }
    const existing = await checkAuthMethod(email);
    const mismatch = methodMismatchMessage(existing.method, "email");
    if (existing.exists && mismatch) {
      setNotice({ tone: "error", text: existing.method === "google" ? googleMismatch(mismatch) : mismatch });
      return;
    }

    const name = sanitizeText(fields.name).trim().slice(0, 100);
    const { error } = await signUp(email, fields.password, name);
    if (error) {
      const m = (error.message || "").toLowerCase();
      if (m.includes("already") || m.includes("registered") || m.includes("exists")) {
        // Même email et même mot de passe : on connecte directement.
        const { error: loginError } = await signIn(email, fields.password);
        if (!loginError) {
          finish();
          return;
        }
        setErrors({ email: "Un compte existe déjà avec cet email. Connecte-toi, ou utilise « Mot de passe oublié ? »." });
        focusFirstError();
      } else if (isNetworkError(m)) {
        setNotice({ tone: "network", text: "La connexion semble coupée. Tes informations sont toujours ici. Réessaie." });
      } else if (m.includes("pwned") || m.includes("compromised") || m.includes("breach") || m.includes("weak") || m.includes("common password")) {
        setErrors({ password: "Ce mot de passe a déjà fuité sur internet. Choisis-en un plus original." });
        focusFirstError();
      } else if (m.includes("invalid email") || m.includes("valid email")) {
        setErrors({ email: "Adresse email invalide. Vérifie l’orthographe." });
        focusFirstError();
      } else if (m.includes("rate") || m.includes("too many")) {
        setNotice({ tone: "error", text: "Trop de tentatives. Patiente 5 minutes et réessaie." });
      } else {
        setNotice({ tone: "error", text: "L’inscription n’a pas abouti. Réessaie dans un instant." });
      }
      return;
    }

    // Si la confirmation par email est activée, il n'y a pas encore de session.
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      markWelcomeCompleted();
      setNotice({ tone: "info", text: `Compte créé ! Ouvre le lien envoyé à ${email} pour l’activer, puis connecte-toi.` });
      return;
    }
    finish();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !validate()) return;
    setBusy(true);
    setNotice(null);
    const email = fields.email.trim().toLowerCase();
    try {
      if (login) await submitLogin(email);
      else await submitSignup(email);
    } catch {
      setNotice({ tone: "network", text: "La connexion semble coupée. Tes informations sont toujours ici. Réessaie." });
    } finally {
      setBusy(false);
    }
  };

  const forgotPassword = async () => {
    const email = fields.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      setErrors({ email: "Entre ton email pour recevoir le lien de réinitialisation." });
      focusFirstError();
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${authLinkBase()}/reset-password`,
    });
    setBusy(false);
    setNotice(
      error
        ? { tone: isNetworkError(error.message) ? "network" : "error", text: "L’email n’a pas pu partir. Réessaie dans un instant." }
        : { tone: "info", text: `Lien envoyé à ${email}. Ouvre-le pour choisir un nouveau mot de passe.` },
    );
  };

  const google = async () => {
    const typed = fields.email.trim().toLowerCase();
    if (typed) {
      const info = await checkAuthMethod(typed);
      const mismatch = methodMismatchMessage(info.method, "google");
      if (info.exists && mismatch) {
        setNotice({ tone: "error", text: mismatch });
        return;
      }
    }
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + returnTo,
    });
    if (result.error) {
      setNotice({ tone: "error", text: "La connexion Google a échoué. Réessaie." });
      return;
    }
    if (result.redirected) return;
    finish();
  };

  const field = (key: keyof Fields, label: string, placeholder: string) => {
    const isPassword = key === "password";
    const describedBy = errors[key] ? `${base}-${key}-error` : isPassword && !login ? `${base}-hint` : undefined;
    return (
      <div className={`field ${errors[key] ? "has-error" : ""}`}>
        <label htmlFor={`${base}-${key}`}>{label}</label>
        <div className="input-wrap">
          <input
            id={`${base}-${key}`}
            name={key}
            type={isPassword ? (show ? "text" : "password") : key === "email" ? "email" : "text"}
            autoComplete={key === "name" ? "name" : key === "email" ? "email" : login ? "current-password" : "new-password"}
            autoCapitalize={key === "email" ? "none" : key === "name" ? "words" : undefined}
            spellCheck={key === "name"}
            inputMode={key === "email" ? "email" : undefined}
            value={fields[key]}
            onChange={(e) => change(key, e.target.value)}
            placeholder={placeholder}
            aria-invalid={!!errors[key]}
            aria-describedby={describedBy}
            maxLength={key === "name" ? 100 : undefined}
          />
          {isPassword && (
            <button
              type="button"
              className="reveal-password"
              aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              aria-pressed={show}
              onClick={() => setShow((v) => !v)}
            >
              {show ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          )}
        </div>
        {errors[key] && (
          <p id={`${base}-${key}-error`} className="field-error" role="alert">
            {errors[key]}
          </p>
        )}
        {isPassword && !login && !errors[key] && (
          <p className="field-hint" id={`${base}-hint`}>
            {PASSWORD_HINT}
          </p>
        )}
      </div>
    );
  };

  const NoticeIcon = notice?.tone === "network" ? WifiOff : notice?.tone === "info" ? MailCheck : TriangleAlert;

  return (
    <EntryShell screen={mode}>
      <section className={`auth page ${mode}`}>
        <div className="app-topbar">
          <Back onClick={() => navigate("/bienvenue?slide=3")} label="Revenir à la présentation" />
          <div className="topbar-right">
            <Brand compact />
          </div>
        </div>
        <div className="auth-intro">
          <div className="auth-kicker">{login ? "ON REPREND LE FIL ?" : "BIENVENUE CHEZ TOI"}</div>
          <h1>
            {login ? (
              <>
                Content de
                <br />
                te retrouver<span className="green-text">.</span>
              </>
            ) : (
              <>
                On commence<span className="green-text"> ?</span>
              </>
            )}
          </h1>
          <p>{login ? "Ton argent n’aura plus de secrets pour toi." : "Un compte à toi. Pour y voir plus clair."}</p>
        </div>
        {!login && (
          <div className="auth-human">
            <div className="human-crop">
              <img src={auchanPhoto} alt="" />
            </div>
            <div>
              <span>
                Le bon réflexe,
                <br />
                <strong>c’est de commencer.</strong>
              </span>
            </div>
            <span className="human-line" aria-hidden="true" />
          </div>
        )}
        <form ref={form} className="auth-form" onSubmit={submit} noValidate>
          {!login && field("name", "Ton nom", "Comment t’appelles-tu ?")}
          {field("email", "Ton email", "toi@exemple.com")}
          {field("password", "Mot de passe", login ? "Ton mot de passe" : "Choisis un mot de passe")}
          {login && (
            <button className="forgot-link text-button" type="button" onClick={forgotPassword} disabled={busy}>
              Mot de passe oublié ?
            </button>
          )}
          {notice && (
            <div className={`network-error notice-${notice.tone}`} role={notice.tone === "info" ? "status" : "alert"}>
              <NoticeIcon size={19} />
              <p>{notice.text}</p>
            </div>
          )}
          <Primary type="submit" busy={busy}>
            {login ? "Me connecter" : "Créer mon compte"}
            <ArrowRight size={20} />
          </Primary>
        </form>
        {GOOGLE_AVAILABLE && (
          <>
            <div className="or-divider">
              <span />
              ou
              <span />
            </div>
            <button className="google-button" type="button" onClick={google} disabled={busy}>
              <img src={googleLogo} alt="" width="20" height="20" />
              Continuer avec Google
            </button>
          </>
        )}
        {!login && (
          <p className="legal">
            En créant ton compte, tu acceptes nos{" "}
            <button type="button" onClick={() => navigate("/terms")}>
              Conditions
            </button>{" "}
            et notre{" "}
            <button type="button" onClick={() => navigate("/privacy")}>
              Politique de confidentialité
            </button>
            .
          </p>
        )}
        <p className="auth-switch">
          {login ? "Pas encore de compte ?" : "Tu as déjà un compte ?"}{" "}
          <button type="button" onClick={() => switchTo(login ? "signup" : "login")}>
            {login ? "Créer mon compte" : "Me connecter"}
          </button>
        </p>
      </section>
    </EntryShell>
  );
};

export default AppAuth;
