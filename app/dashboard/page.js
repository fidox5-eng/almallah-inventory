"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

function money(n) {
  const x = Number(n || 0);
  return x.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Dashboard() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);

  const [items, setItems] = useState([]);
  const [form, setForm] = useState({
    item_type: "phone",
    item_sku: "",
    description: "",
    serial_or_imei: "",
    cost: "",
    sell: "",
    qty: 1
  });

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  async function requireSession() {
    const { data } = await supabase.auth.getSession();
    const session = data?.session;

    if (!session) {
      router.replace("/login");
      return null;
    }

    setEmail(session.user.email || "");
    setUserId(session.user.id);
    return session.user.id;
  }

  async function loadItems(uid) {
    setLoading(true);
    const { data, error } = await supabase
      .from("inventory_items")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });

    if (!error) setItems(data || []);
    setLoading(false);
  }

  useEffect(() => {
    let active = true;

    (async () => {
      const uid = await requireSession();
      if (!uid || !active) return;
      await loadItems(uid);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
    });

    return () => {
      active = false;
      sub?.subscription?.unsubscribe();
    };
  }, [router]);

  const totals = useMemo(() => {
    const totalCost = items.reduce((s, it) => s + Number(it.cost || 0) * Number(it.qty || 0), 0);
    const totalSell = items.reduce((s, it) => s + Number(it.sell || 0) * Number(it.qty || 0), 0);
    const totalProfit = totalSell - totalCost;
    return { totalCost, totalSell, totalProfit };
  }, [items]);

  async function addItem(e) {
    e.preventDefault();
    if (!userId) return;

    const payload = {
      user_id: userId,
      item_type: form.item_type,
      item_sku: form.item_sku?.trim() || null,
      description: form.description?.trim() || null,
      serial_or_imei: form.serial_or_imei?.trim() || null,
      cost: Number(form.cost || 0),
      sell: Number(form.sell || 0),
      qty: Number(form.qty || 0),
    };

    const { error } = await supabase.from("inventory_items").insert(payload);
    if (error) {
      alert(error.message);
      return;
    }

    setForm({ item_type: "phone", item_sku: "", description: "", serial_or_imei: "", cost: "", sell: "", qty: 1 });
    await loadItems(userId);
  }

  async function removeItem(id) {
    if (!confirm("Delete this item?")) return;
    const { error } = await supabase.from("inventory_items").delete().eq("id", id);
    if (error) alert(error.message);
    else await loadItems(userId);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0b0b0b", color: "#fff" }}>
      <div style={{ padding: 28, maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24 }}>Inventory Dashboard (INV1)</h1>
            <div style={{ color: "#aaa", fontSize: 13, marginTop: 6 }}>
              Signed in as: <b style={{ color: "#fff" }}>{email || "..."}</b>
            </div>
          </div>
          <button
            onClick={logout}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #2a2a2a",
              background: "#111",
              color: "#fff",
              cursor: "pointer"
            }}
          >
            Logout
          </button>
        </div>

        {/* Totals */}
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(3, minmax(0, 1fr))", marginTop: 18 }}>
          <div style={{ border: "1px solid #1f1f1f", background: "#101010", borderRadius: 16, padding: 16 }}>
            <div style={{ color: "#aaa", fontSize: 12 }}>Total Cost</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>${money(totals.totalCost)}</div>
          </div>
          <div style={{ border: "1px solid #1f1f1f", background: "#101010", borderRadius: 16, padding: 16 }}>
            <div style={{ color: "#aaa", fontSize: 12 }}>Total Selling</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>${money(totals.totalSell)}</div>
          </div>
          <div style={{ border: "1px solid #1f1f1f", background: "#101010", borderRadius: 16, padding: 16 }}>
            <div style={{ color: "#aaa", fontSize: 12 }}>Total Profit</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>${money(totals.totalProfit)}</div>
          </div>
        </div>

        {/* Add item */}
        <div style={{ marginTop: 18, border: "1px solid #1f1f1f", background: "#101010", borderRadius: 16, padding: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Add Item</h2>

          <form onSubmit={addItem} style={{ marginTop: 12, display: "grid", gap: 10, gridTemplateColumns: "repeat(12, minmax(0, 1fr))" }}>
            <div style={{ gridColumn: "span 3" }}>
              <div style={{ color: "#aaa", fontSize: 12, marginBottom: 6 }}>Type</div>
              <select
                value={form.item_type}
                onChange={(e) => setForm((f) => ({ ...f, item_type: e.target.value }))}
                style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #2a2a2a", background: "#0b0b0b", color: "#fff" }}
              >
                <option value="laptop">Laptop</option>
                <option value="phone">Phone</option>
                <option value="tablet">Tablet</option>
              </select>
            </div>

            <div style={{ gridColumn: "span 3" }}>
              <div style={{ color: "#aaa", fontSize: 12, marginBottom: 6 }}>Item ID / SKU</div>
              <input
                value={form.item_sku}
                onChange={(e) => setForm((f) => ({ ...f, item_sku: e.target.value }))}
                placeholder="ex: IP15PM-256-BLK"
                style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #2a2a2a", background: "#0b0b0b", color: "#fff" }}
              />
            </div>

            <div style={{ gridColumn: "span 4" }}>
              <div style={{ color: "#aaa", fontSize: 12, marginBottom: 6 }}>Description</div>
              <input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="ex: iPhone 15 Pro Max 256GB Black"
                style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #2a2a2a", background: "#0b0b0b", color: "#fff" }}
              />
            </div>

            <div style={{ gridColumn: "span 2" }}>
              <div style={{ color: "#aaa", fontSize: 12, marginBottom: 6 }}>Qty</div>
              <input
                value={form.qty}
                onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))}
                type="number"
                min="0"
                style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #2a2a2a", background: "#0b0b0b", color: "#fff" }}
              />
            </div>

            <div style={{ gridColumn: "span 4" }}>
              <div style={{ color: "#aaa", fontSize: 12, marginBottom: 6 }}>Serial / IMEI</div>
              <input
                value={form.serial_or_imei}
                onChange={(e) => setForm((f) => ({ ...f, serial_or_imei: e.target.value }))}
                placeholder="ex: 3567... / SN..."
                style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #2a2a2a", background: "#0b0b0b", color: "#fff" }}
              />
            </div>

            <div style={{ gridColumn: "span 2" }}>
              <div style={{ color: "#aaa", fontSize: 12, marginBottom: 6 }}>Cost</div>
              <input
                value={form.cost}
                onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #2a2a2a", background: "#0b0b0b", color: "#fff" }}
              />
            </div>

            <div style={{ gridColumn: "span 2" }}>
              <div style={{ color: "#aaa", fontSize: 12, marginBottom: 6 }}>Sell</div>
              <input
                value={form.sell}
                onChange={(e) => setForm((f) => ({ ...f, sell: e.target.value }))}
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #2a2a2a", background: "#0b0b0b", color: "#fff" }}
              />
            </div>

            <div style={{ gridColumn: "span 2", display: "flex", alignItems: "end" }}>
              <button
                type="submit"
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid #2a2a2a",
                  background: "#fff",
                  color: "#000",
                  fontWeight: 800,
                  cursor: "pointer"
                }}
              >
                Add
              </button>
            </div>
          </form>
        </div>

        {/* List */}
        <div style={{ marginTop: 18, border: "1px solid #1f1f1f", background: "#101010", borderRadius: 16, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>Items</h2>
            <button
              onClick={() => loadItems(userId)}
              style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #2a2a2a", background: "#111", color: "#fff", cursor: "pointer" }}
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div style={{ color: "#aaa", padding: 12 }}>Loading...</div>
          ) : items.length === 0 ? (
            <div style={{ color: "#aaa", padding: 12 }}>No items yet. Add your first product above.</div>
          ) : (
            <div style={{ marginTop: 12, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "#aaa", fontSize: 12 }}>
                    <th style={{ padding: 10, borderBottom: "1px solid #222" }}>Type</th>
                    <th style={{ padding: 10, borderBottom: "1px solid #222" }}>Item ID</th>
                    <th style={{ padding: 10, borderBottom: "1px solid #222" }}>Description</th>
                    <th style={{ padding: 10, borderBottom: "1px solid #222" }}>Serial/IMEI</th>
                    <th style={{ padding: 10, borderBottom: "1px solid #222" }}>Qty</th>
                    <th style={{ padding: 10, borderBottom: "1px solid #222" }}>Cost</th>
                    <th style={{ padding: 10, borderBottom: "1px solid #222" }}>Sell</th>
                    <th style={{ padding: 10, borderBottom: "1px solid #222" }}>Profit</th>
                    <th style={{ padding: 10, borderBottom: "1px solid #222" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => {
                    const profitOne = (Number(it.sell || 0) - Number(it.cost || 0));
                    const profitTotal = profitOne * Number(it.qty || 0);
                    return (
                      <tr key={it.id} style={{ borderBottom: "1px solid #161616" }}>
                        <td style={{ padding: 10 }}>{it.item_type}</td>
                        <td style={{ padding: 10 }}>{it.item_sku || "-"}</td>
                        <td style={{ padding: 10 }}>{it.description || "-"}</td>
                        <td style={{ padding: 10 }}>{it.serial_or_imei || "-"}</td>
                        <td style={{ padding: 10 }}>{it.qty}</td>
                        <td style={{ padding: 10 }}>${money(it.cost)}</td>
                        <td style={{ padding: 10 }}>${money(it.sell)}</td>
                        <td style={{ padding: 10 }}>
                          ${money(profitTotal)}{" "}
                          <span style={{ color: "#777", fontSize: 12 }}>
                            (per: ${money(profitOne)})
                          </span>
                        </td>
                        <td style={{ padding: 10 }}>
                          <button
                            onClick={() => removeItem(it.id)}
                            style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #2a2a2a", background: "#1a0f0f", color: "#fff", cursor: "pointer" }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
