import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, getSupabaseConfigError, isSupabaseConfigured } from "@/lib/supabase";
import { getProfile } from "@/lib/profilesService";
import { isAppRole, type AppRole } from "@/lib/roles";
import { authDebug } from "@/lib/authDebug";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  initials: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  profileError: string | null;
  hasSession: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const MISSING_PROFILE_MESSAGE =
  "Profile not found for this user. Create or repair the profile row in Supabase (Table Editor → profiles, or run the repair SQL in SUPABASE_SETUP.md).";

function initialsFrom(name: string | null, email: string): string {
  const trimmed = name?.trim();
  if (trimmed) {
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
    }
    return trimmed.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function mapProfileToUser(
  profile: { id: string; email: string; full_name: string | null; role: string },
  fallbackEmail: string
): AuthUser {
  const role = isAppRole(profile.role) ? profile.role : "Viewer";
  const email = profile.email || fallbackEmail;
  const name = profile.full_name?.trim() || email;

  return {
    id: profile.id,
    name,
    email,
    role,
    initials: initialsFrom(profile.full_name, email),
  };
}

function configErrorMessage(): string | null {
  const err = getSupabaseConfigError();
  if (err === "missing_vars") {
    return "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.";
  }
  if (err === "wrong_url_format") {
    return "VITE_SUPABASE_URL must be your project API URL (https://xxxx.supabase.co), not the dashboard URL.";
  }
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const initDoneRef = useRef(false);

  const finishLoading = useCallback(() => {
    authDebug("loading → false");
    setLoading(false);
  }, []);

  const loadUserFromSession = useCallback(async (nextSession: Session | null) => {
    if (!nextSession?.user) {
      authDebug("no session — clear user");
      setSession(null);
      setUser(null);
      setProfileError(null);
      return;
    }

    setSession(nextSession);
    const userId = nextSession.user.id;

    try {
      authDebug("load profile for session", { userId, email: nextSession.user.email });
      const profile = await getProfile(userId);
      if (!profile) {
        authDebug("profile missing");
        setUser(null);
        setProfileError(MISSING_PROFILE_MESSAGE);
        return;
      }
      setProfileError(null);
      setUser(mapProfileToUser(profile, nextSession.user.email ?? ""));
      authDebug("user ready", { role: profile.role });
    } catch (err) {
      authDebug("profile load failed", {
        message: err instanceof Error ? err.message : String(err),
      });
      setUser(null);
      setProfileError(err instanceof Error ? err.message : "Failed to load your profile.");
    }
  }, []);

  useEffect(() => {
    const configErr = configErrorMessage();
    authDebug("AuthProvider mount", {
      supabaseConfigured: isSupabaseConfigured,
      configError: configErr ?? getSupabaseConfigError(),
    });

    if (configErr) {
      setProfileError(configErr);
      setUser(null);
      setSession(null);
      finishLoading();
      return;
    }

    let mounted = true;

    const safetyTimer = window.setTimeout(() => {
      if (mounted && !initDoneRef.current) {
        authDebug("safety timeout — forcing loading false");
        initDoneRef.current = true;
        setProfileError((prev) =>
          prev ??
          "Auth initialization timed out. Check the browser console and Supabase configuration."
        );
        finishLoading();
      }
    }, 15_000);

    async function init() {
      authDebug("getSession start");
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        if (!mounted) return;

        if (error) {
          authDebug("getSession error", { message: error.message });
          setProfileError(error.message);
          setUser(null);
          setSession(null);
          return;
        }

        authDebug("getSession end", { hasSession: Boolean(initialSession) });
        await loadUserFromSession(initialSession);
      } catch (err) {
        if (!mounted) return;
        authDebug("init exception", {
          message: err instanceof Error ? err.message : String(err),
        });
        setProfileError(err instanceof Error ? err.message : "Failed to initialize auth.");
        setUser(null);
        setSession(null);
      } finally {
        if (mounted) {
          initDoneRef.current = true;
          finishLoading();
        }
        authDebug("init complete");
      }
    }

    init();

    // Defer async Supabase calls — awaiting DB/auth inside this callback deadlocks session init.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      authDebug("onAuthStateChange", { event, hasSession: Boolean(nextSession) });

      if (event === "INITIAL_SESSION") {
        return;
      }

      window.setTimeout(() => {
        if (!mounted) return;

        void (async () => {
          authDebug("auth state sync start", { event });
          setLoading(true);
          authDebug("loading → true", { reason: event });

          try {
            if (event === "SIGNED_OUT") {
              setSession(null);
              setUser(null);
              setProfileError(null);
              return;
            }
            await loadUserFromSession(nextSession);
          } finally {
            if (mounted) {
              finishLoading();
            }
            authDebug("auth state sync end", { event });
          }
        })();
      }, 0);
    });

    return () => {
      mounted = false;
      window.clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, [loadUserFromSession, finishLoading]);

  const login = async (email: string, password: string) => {
    authDebug("login start", { email });
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("invalid login credentials") || msg.includes("invalid email or password")) {
          throw new Error("Invalid email or password.");
        }
        if (msg.includes("email not confirmed")) {
          throw new Error("Please confirm your email before signing in.");
        }
        throw new Error(error.message);
      }
      await loadUserFromSession(data.session);
      if (!data.session) {
        throw new Error("Sign-in succeeded but no session was returned.");
      }
      authDebug("login end", { userId: data.session.user.id });
    } finally {
      finishLoading();
    }
  };

  const logout = async () => {
    authDebug("logout start");
    setLoading(true);
    try {
      await supabase.auth.signOut();
    } finally {
      setSession(null);
      setUser(null);
      setProfileError(null);
      finishLoading();
      authDebug("logout end");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        profileError,
        hasSession: !!session,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
