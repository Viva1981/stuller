"use client";

import { supabase } from "./lib/supabase";
import { useEffect, useState } from "react";

export default function AuthButtons() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const login = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
    });
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div style={{ marginBottom: "20px" }}>
      {user ? (
        <>
          <div>Bejelentkezve: {user.email}</div>
          <button onClick={logout}>Logout</button>
        </>
      ) : (
        <button onClick={login}>Login Google-lel</button>
      )}
    </div>
  );
}
