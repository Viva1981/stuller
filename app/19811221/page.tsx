"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";

export default function ProtectedPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/");
      } else {
        setAllowed(true);
      }
      setLoading(false);
    });
  }, [router]);

  if (loading) {
    return <p style={{ padding: "40px" }}>Ellenőrzés…</p>;
  }

  if (!allowed) {
    return null;
  }

  return (
    <main style={{ padding: "40px", fontSize: "24px" }}>
      Él.
    </main>
  );
}

