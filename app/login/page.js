"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.replace("/dashboard");
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{
        width: "100%",
        maxWidth: 420,
        background: "#111",
        border: "1px solid #222",
        borderRadius: 16,
        padding: 24
      }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Almallah Inventory (LIVE) (LIVE) (LIVE) (LIVE)</h1>
        <p style={{ marginTop: 8, marginBottom: 18, color: "#bbb" }}>Admin sign in</p>

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="Admin email"
            required
            style={{ padding: 12, borderRadius: 10, border: "1px solid #2a2a2a", background: "#0b0b0b", color: "white" }}
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="Password"
            required
            style={{ padding: 12, borderRadius: 10, border: "1px solid #2a2a2a", background: "#0b0b0b", color: "white" }}
          />

          {error ? (
            <div style={{ background: "#2b0b0b", border: "1px solid #5b1b1b", color: "#ffb4b4", padding: 10, borderRadius: 10, fontSize: 13 }}>
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: 12,
              borderRadius: 12,
              border: "1px solid #2a2a2a",
              background: loading ? "#1a1a1a" : "#fff",
              color: loading ? "#9a9a9a" : "#000",
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer"
            }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
