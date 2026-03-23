"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { supabase } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types/database";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  isAdmin: boolean;
  isLoading: boolean;
  sessionError: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  session: null,
  isAdmin: false,
  isLoading: true,
  sessionError: null,
  signIn: async () => ({ error: null }),
  signOut: async () => {},
  clearError: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

function getDeviceId(): string {
  const key = "ls_device_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const isSigningIn = useRef(false);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    setProfile(data as Profile | null);
    return data as Profile | null;
  }, []);

  // Validate device session — if another device logged in, force sign out
  const validateDeviceSession = useCallback(async (prof: Profile | null) => {
    if (!prof || (prof as any).role !== "admin") return true; // Only enforce for admins
    const deviceId = getDeviceId();
    const storedDeviceId = (prof as any).active_device_id;
    if (storedDeviceId && storedDeviceId !== deviceId) {
      // Another device has taken over
      setSessionError("Your session was ended because this account logged in on another device.");
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      setSession(null);
      return false;
    }
    return true;
  }, []);

  useEffect(() => {
    // Get initial session
    // Use getUser() instead of getSession() for security and to ensure the session is valid
    supabase.auth.getUser().then(async ({ data: { user: u } }) => {
      try {
        // We still need the session object for the context, so we'll get it from getSession (cached)
        // after getUser (verified) succeeds or fails.
        const { data: { session: s } } = await supabase.auth.getSession();
        
        setSession(s);
        setUser(u);
        if (u && !isSigningIn.current) {
          const prof = await fetchProfile(u.id);
          await validateDeviceSession(prof);
        }
      } catch (err) {
        console.error("Auth session init error:", err);
      } finally {
        setIsLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, s) => {
      try {
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user && !isSigningIn.current) {
          const prof = await fetchProfile(s.user.id);
          await validateDeviceSession(prof);
        } else if (!s?.user) {
          setProfile(null);
        }
      } catch (err) {
        console.error("Auth state change error:", err);
      } finally {
        setIsLoading(false);
      }
    });

    // Realtime subscription for profile changes (to detect if another device logged in)
    let profileChannel: any = null;
    if (user?.id) {
      profileChannel = supabase
        .channel(`profile-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${user.id}`,
          },
          (payload) => {
            const newProf = payload.new as Profile;
            validateDeviceSession(newProf);
          }
        )
        .subscribe();
    }

    return () => {
      subscription.unsubscribe();
      if (profileChannel) {
        supabase.removeChannel(profileChannel);
      }
    };
  }, [user?.id, fetchProfile, validateDeviceSession]);

  const signIn = async (email: string, password: string) => {
    setSessionError(null);
    isSigningIn.current = true;
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        isSigningIn.current = false;
        return { error: error.message };
      }

      // After successful login:
      // 1. Sign out all other sessions for this user
      try {
        await supabase.auth.signOut({ scope: "others" });
      } catch {
        // Non-critical — some Supabase versions may not support this
      }

      // 2. Write device_id to profile so other tabs/devices can detect it
      const deviceId = getDeviceId();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase.from("profiles") as any)
        .update({ active_device_id: deviceId })
        .eq("id", data.user.id);

      if (updateError) {
        console.error("Profile device_id update error:", updateError);
        // Non-critical but worth logging
      }

      // 3. IMPORTANT: Re-fetch profile to update local state and confirm login
      await fetchProfile(data.user.id);

      // Successfully updated profile, now safe to allow validation again
      // We wait 500ms to ensure all in-flight auth listeners reach the skip check
      setTimeout(() => {
        isSigningIn.current = false;
      }, 500);
      
      return { error: null };
    } catch (err: any) {
      isSigningIn.current = false;
      console.error("Sign in failed:", err);
      return { error: err.message ?? "An unexpected error occurred during sign in." };
    }
  };

  const signOut = async () => {
    // Clear device_id on explicit sign out
    if (user) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("profiles") as any)
        .update({ active_device_id: null })
        .eq("id", user.id);
    }
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
  };

  const clearError = () => {
    setSessionError(null);
  };

  const isAdmin = profile?.role === "admin";

  return (
    <AuthContext.Provider
      value={{ user, profile, session, isAdmin, isLoading, sessionError, signIn, signOut, clearError }}
    >
      {children}
    </AuthContext.Provider>
  );
}
