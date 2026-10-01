import { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { initSessionMonitor } from "@/lib/security";
import { authLinkBase } from "@/lib/appEntry";
import { setActiveCurrency } from "@/lib/currencyStore";
import type { CurrencyCode } from "@/lib/currency";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: any | null;
  loading: boolean;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
  updateProfileLocal: (partial: Record<string, any>) => void;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const claimedRef = useRef(false);


  const fetchProfile = async (userId: string) => {
    const [profileRes, roleRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    ]);
    if (!profileRes.error && profileRes.data) {
      setProfile(profileRes.data);
      const cur = (profileRes.data as any).currency_preference as CurrencyCode | undefined;
      if (cur === "XOF" || cur === "EUR" || cur === "USD") setActiveCurrency(cur);
    } else {
      setProfile(null);
    }
    setIsAdmin(roleRes.data === true);

    // Rattache un éventuel paiement effectué avant la création du compte.
    if (!claimedRef.current) {
      claimedRef.current = true;
      supabase.rpc("claim_pending_payment").then(({ error }) => {
        if (error) console.warn("claim_pending_payment", error.message);
      });
    }
  };


  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "PASSWORD_RECOVERY") {
          window.location.href = "/reset-password";
          return;
        }
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchProfile(session.user.id), 0);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        setLoading(false);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: { full_name: fullName },
        // Dans l'app installée, origin vaut https://localhost : lien vers le site public.
        emailRedirectTo: authLinkBase(),
      },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    return { error };
  };

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    await fetchProfile(user.id);
  }, [user]);

  const updateProfileLocal = useCallback((partial: Record<string, any>) => {
    setProfile((prev: any) => (prev ? { ...prev, ...partial } : prev));
  }, []);

  // Auto-logout on inactivity (30 min)
  useEffect(() => {
    if (!user) return;
    const cleanup = initSessionMonitor(() => {
      signOut();
    });
    return cleanup;
  }, [user, signOut]);

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, isAdmin, refreshProfile, updateProfileLocal, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
