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
    options: {
      redirectTo: window.location.origin,
    },
  });
};


  const logout = async () => {
    await supabase.auth.signOut();
  };

  const buttonStyle = {
    padding: "10px 16px",
    backgroundColor: "#2563eb",
    color: "white",
    borderRadius: "6px",
    border: "none",
    cursor: "pointer",
    marginTop: "10px",
  };

  return (
    <div style={{ marginBottom: "20px" }}>
      {user ? (
        <>
          <div>Bejelentkezve: {user.email}</div>
          <button style={buttonStyle} onClick={logout}>
            Logout
          </button>
        </>
      ) : (
        <button style={buttonStyle} onClick={login}>
          Login Google-lel
        </button>
      )}
    </div>
  );
}
