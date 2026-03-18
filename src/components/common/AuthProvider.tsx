"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
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
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        const prof = await fetchProfile(s.user.id);
        await validateDeviceSession(prof);
      }
      setIsLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        const prof = await fetchProfile(s.user.id);
        await validateDeviceSession(prof);
      } else {
        setProfile(null);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile, validateDeviceSession]);

  const signIn = async (email: string, password: string) => {
    setSessionError(null);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { error: error.message };

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
    await (supabase.from("profiles") as any)
      .update({ active_device_id: deviceId })
      .eq("id", data.user.id);

    return { error: null };
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

  const isAdmin = profile?.role === "admin";

  return (
    <AuthContext.Provider
      value={{ user, profile, session, isAdmin, isLoading, sessionError, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}
