import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { formatMoneySmart } from "@/lib/formatMoney";
import { supabase } from "@/integrations/supabase/client";
import { initSessionMonitor } from "@/lib/security";

const PIN_STORAGE_KEY = "track_emoney_pin";
const SALT = "monjeton_2025_salt_";

// Miroir non sensible : sert uniquement à afficher l'écran de verrouillage
// immédiatement au démarrage, avant la réponse du serveur.
const PIN_MIRROR_KEY = "monjeton_pin_enabled";

const hashPin = async (pin: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(SALT + pin);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

interface PrivacyContextType {
  isLocked: boolean;
  isDiscreetMode: boolean;
  pinEnabled: boolean;
  unlock: (pin: string) => Promise<boolean>;
  lock: () => void;
  setPin: (pin: string) => Promise<void>;
  removePin: () => Promise<void>;
  toggleDiscreetMode: () => void;
  formatAmount: (amount: number) => string;
}

const PrivacyContext = createContext<PrivacyContextType | undefined>(undefined);

export const PrivacyProvider = ({ children }: { children: ReactNode }) => {
  const [isLocked, setIsLocked] = useState(false);
  const [isDiscreetMode, setIsDiscreetMode] = useState(false);
  const [pinEnabled, setPinEnabled] = useState(false);

  useEffect(() => {
    const discreet = localStorage.getItem("track_emoney_discreet") === "true";
    setIsDiscreetMode(discreet);

    // Affichage optimiste : on verrouille tout de suite si le miroir dit
    // qu'un PIN existe, pour éviter un flash du contenu avant la réponse.
    const mirror = localStorage.getItem(PIN_MIRROR_KEY) === "true";
    const legacyHash = localStorage.getItem(PIN_STORAGE_KEY);
    if (mirror || legacyHash) {
      setPinEnabled(true);
      setIsLocked(true);
    }

    let cancelled = false;

    const sync = async () => {
      try {
        const { data, error } = await supabase.rpc("user_pin_status" as any);
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        let hasPin = Boolean(row?.has_pin);

        // Migration silencieuse : un PIN existait en local mais pas encore
        // sur le serveur. On le pousse, puis on efface la copie locale.
        if (!hasPin && legacyHash) {
          const { error: setError } = await supabase.rpc("set_user_pin" as any, {
            _pin_hash: legacyHash,
          } as any);
          if (!setError) hasPin = true;
        }
        if (hasPin && legacyHash) {
          localStorage.removeItem(PIN_STORAGE_KEY);
        }

        if (cancelled) return;
        localStorage.setItem(PIN_MIRROR_KEY, String(hasPin));
        setPinEnabled(hasPin);
        setIsLocked(hasPin);
      } catch {
        // Serveur injoignable : on conserve l'état optimiste. Si un PIN
        // existe, l'app reste verrouillée — c'est le comportement sûr.
      }
    };

    sync();
    return () => { cancelled = true; };
  }, []);

  // La signature ne change pas : les deux écrans (PinLockScreen et
  // ReceiptsPinLock) continuent de fonctionner sans modification.
  const unlock = async (pin: string): Promise<boolean> => {
    try {
      const pinHash = await hashPin(pin);
      const { data, error } = await supabase.rpc("verify_user_pin" as any, {
        _pin_hash: pinHash,
      } as any);
      if (error) return false;
      const row = Array.isArray(data) ? data[0] : data;
      if (row?.success) {
        setIsLocked(false);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const lock = () => {
    if (pinEnabled) setIsLocked(true);
  };

  // Après 30 min sans activité, on verrouille avec le code PIN (s'il existe)
  // au lieu de déconnecter : l'utilisateur reste connecté.
  useEffect(() => {
    if (!pinEnabled || isLocked) return;
    return initSessionMonitor(() => setIsLocked(true));
  }, [pinEnabled, isLocked]);

  const setPin = async (newPin: string) => {
    const pinHash = await hashPin(newPin);
    const { error } = await supabase.rpc("set_user_pin" as any, {
      _pin_hash: pinHash,
    } as any);
    if (error) throw error;
    localStorage.setItem(PIN_MIRROR_KEY, "true");
    localStorage.removeItem(PIN_STORAGE_KEY);
    setPinEnabled(true);
    setIsLocked(false);
  };

  const removePin = async () => {
    const { error } = await supabase.rpc("clear_user_pin" as any);
    if (error) throw error;
    localStorage.removeItem(PIN_MIRROR_KEY);
    localStorage.removeItem(PIN_STORAGE_KEY);
    setPinEnabled(false);
    setIsLocked(false);
  };

  const toggleDiscreetMode = () => {
    const next = !isDiscreetMode;
    setIsDiscreetMode(next);
    localStorage.setItem("track_emoney_discreet", String(next));
  };

  const formatAmount = (amount: number): string => {
    if (isDiscreetMode) return "•••••";
    return formatMoneySmart(amount);
  };

  return (
    <PrivacyContext.Provider value={{ isLocked, isDiscreetMode, pinEnabled, unlock, lock, setPin, removePin, toggleDiscreetMode, formatAmount }}>
      {children}
    </PrivacyContext.Provider>
  );
};

export const usePrivacy = () => {
  const context = useContext(PrivacyContext);
  if (!context) throw new Error("usePrivacy must be used within PrivacyProvider");
  return context;
};
