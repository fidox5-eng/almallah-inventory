"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function Dashboard() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  useEffect(() => {
    async function check() {
      const { data } = await supabase.auth.getSession();
      const session = data?.session;

      if (!session) {
        router.replace("/login");
        return;
      }

      setEmail(session.user.email || "");
    }

    check();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
    });

    return () => sub?.subscription?.unsubscribe();
  }, [router]);

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <div style={{ padding: 40 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <h1 style={{ margin: 0 }}>Inventory Dashboard</h1>
        <button
          onClick={logout}
          style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #2a2a2a", background: "#111", color: "#fff", cursor: "pointer" }}
        >
          Logout
        </button>
      </div>

      <p style={{ color: "#bbb" }}>Signed in as: <b>{email || "..."}</b></p>
      <p style={{ color: "#888" }}>Next: we add inventory items, IMEI/Serial, cost/sell, and profit.</p>
    </div>
  );
}
