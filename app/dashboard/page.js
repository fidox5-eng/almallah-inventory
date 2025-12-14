"use client";

import "../styles/dashboard.css";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

function money(n){ const x=Number(n||0); return x.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}); }
function csvEscape(v){ const s=String(v??""); return /[",\n]/.test(s) ? `"${s.replaceAll('"','""')}"` : s; }

export default function Dashboard(){
  const router = useRouter();

  const [tab,setTab]=useState("inventory"); // inventory | sales | users
  const [email,setEmail]=useState("");
  const [userId,setUserId]=useState("");
  const [isAdmin,setIsAdmin]=useState(false);

  const [items,setItems]=useState([]);
  const [sales,setSales]=useState([]);
  const [profiles,setProfiles]=useState([]);

  const [loading,setLoading]=useState(true);
  const [q,setQ]=useState("");

  // add form
  const [form,setForm]=useState({ item_type:"phone", item_sku:"", description:"", serial_or_imei:"", cost:"", sell:"", qty:1 });

  // edit row
  const [editId,setEditId]=useState(null);
  const [edit,setEdit]=useState({ item_type:"phone", item_sku:"", description:"", serial_or_imei:"", cost:"0", sell:"0", qty:0 });

  // sell modal-ish
  const [sellId,setSellId]=useState(null);
  const [sellQty,setSellQty]=useState(1);
  const [sellPrice,setSellPrice]=useState("");

  async function logout(){
    await supabase.auth.signOut();
    router.replace("/login");
  }

  async function getSession(){
    const { data } = await supabase.auth.getSession();
    const session = data?.session;
    if(!session){ router.replace("/login"); return null; }
    setEmail(session.user.email||"");
    setUserId(session.user.id);
    return session.user.id;
  }

  async function loadIsAdmin(){
    const { data, error } = await supabase.rpc("is_admin");
    if(!error) setIsAdmin(!!data);
  }

  async function loadItems(){
    setLoading(true);
    const uid = userId || (await getSession());
    if(!uid) return;

    let query = supabase.from("inventory_items").select("*").order("created_at",{ascending:false});
    if(q.trim()){
      const like = `%${q.trim()}%`;
      query = query.or(`item_sku.ilike.${like},description.ilike.${like},serial_or_imei.ilike.${like}`);
    }
    const { data, error } = await query;
    if(!error) setItems(data||[]);
    setLoading(false);
  }

  async function loadSales(){
    setLoading(true);
    const { data, error } = await supabase
      .from("inventory_sales")
      .select("*, inventory_items(item_sku,description,serial_or_imei,item_type)")
      .order("sold_at",{ascending:false});
    if(!error) setSales(data||[]);
    setLoading(false);
  }

  async function loadUsers(){
    setLoading(true);
    const { data, error } = await supabase.from("profiles").select("*").order("created_at",{ascending:false});
    if(!error) setProfiles(data||[]);
    setLoading(false);
  }

  useEffect(()=>{
    let alive=true;
    (async()=>{
      const uid = await getSession();
      if(!uid || !alive) return;
      await loadIsAdmin();
      await loadItems();
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s)=>{
      if(!s) router.replace("/login");
    });

    return ()=>{ alive=false; sub?.subscription?.unsubscribe(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  useEffect(()=>{
    if(tab==="inventory") loadItems();
    if(tab==="sales") loadSales();
    if(tab==="users") loadUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[tab]);

  const totals = useMemo(()=>{
    const totalCost = items.reduce((s,it)=> s + Number(it.cost||0)*Number(it.qty||0),0);
    const totalSell = items.reduce((s,it)=> s + Number(it.sell||0)*Number(it.qty||0),0);
    return { totalCost, totalSell, totalProfit: totalSell-totalCost };
  },[items]);

  async function addItem(e){
    e.preventDefault();

    // company_id is enforced by RLS (must equal current_company_id()).
    // so we MUST insert company_id via a select? easiest: let DB fill by trigger (not set up).
    // We'll fetch company_id via rpc and include it in insert.
    const { data: companyId, error: cErr } = await supabase.rpc("current_company_id");
    if(cErr || !companyId) return alert("Company not set for this user. Add a profiles row in Supabase.");

    const payload = {
      company_id: companyId,
      created_by: userId,
      item_type: form.item_type,
      item_sku: form.item_sku.trim() || null,
      description: form.description.trim() || null,
      serial_or_imei: form.serial_or_imei.trim() || null,
      cost: Number(form.cost||0),
      sell: Number(form.sell||0),
      qty: Number(form.qty||0),
    };

    const { error } = await supabase.from("inventory_items").insert(payload);
    if(error) return alert(error.message);

    setForm({ item_type:"phone", item_sku:"", description:"", serial_or_imei:"", cost:"", sell:"", qty:1 });
    await loadItems();
  }

  function startEdit(it){
    setEditId(it.id);
    setEdit({
      item_type: it.item_type,
      item_sku: it.item_sku||"",
      description: it.description||"",
      serial_or_imei: it.serial_or_imei||"",
      cost: String(it.cost??0),
      sell: String(it.sell??0),
      qty: Number(it.qty??0)
    });
  }

  async function saveEdit(){
    const { error } = await supabase
      .from("inventory_items")
      .update({
        item_type: edit.item_type,
        item_sku: edit.item_sku.trim() || null,
        description: edit.description.trim() || null,
        serial_or_imei: edit.serial_or_imei.trim() || null,
        cost: Number(edit.cost||0),
        sell: Number(edit.sell||0),
        qty: Number(edit.qty||0),
      })
      .eq("id", editId);

    if(error) return alert(error.message);

    setEditId(null);
    await loadItems();
  }

  async function removeItem(id){
    if(!isAdmin) return alert("Only admin can delete items.");
    if(!confirm("Delete this item?")) return;
    const { error } = await supabase.from("inventory_items").delete().eq("id", id);
    if(error) alert(error.message);
    else await loadItems();
  }

  async function markSold(it){
    setSellId(it.id);
    setSellQty(1);
    setSellPrice(String(it.sell??""));
  }

  async function confirmSold(){
    const it = items.find(x=>x.id===sellId);
    if(!it) return;

    const qty = Number(sellQty||0);
    if(qty<=0) return alert("Qty must be > 0");
    if(qty>Number(it.qty||0)) return alert("Not enough quantity in stock");

    const soldPrice = Number(sellPrice||0);
    const costAtSale = Number(it.cost||0);
    const profit = (soldPrice - costAtSale) * qty;

    const { data: companyId, error: cErr } = await supabase.rpc("current_company_id");
    if(cErr || !companyId) return alert("Company not set.");

    // 1) insert sale row
    const { error: sErr } = await supabase.from("inventory_sales").insert({
      company_id: companyId,
      item_id: it.id,
      sold_qty: qty,
      sold_price: soldPrice,
      cost_at_sale: costAtSale,
      profit: profit,
    });
    if(sErr) return alert(sErr.message);

    // 2) reduce qty
    const { error: uErr } = await supabase
      .from("inventory_items")
      .update({ qty: Number(it.qty||0) - qty })
      .eq("id", it.id);
    if(uErr) return alert(uErr.message);

    setSellId(null);
    await loadItems();
  }

  function exportInventoryCSV(){
    const cols = ["type","item_id","description","serial_or_imei","qty","cost","sell","profit_total","profit_each"];
    const rows = items.map(it=>{
      const profitEach = Number(it.sell||0)-Number(it.cost||0);
      const profitTotal = profitEach*Number(it.qty||0);
      return [
        it.item_type,
        it.item_sku||"",
        it.description||"",
        it.serial_or_imei||"",
        it.qty,
        money(it.cost),
        money(it.sell),
        money(profitTotal),
        money(profitEach),
      ].map(csvEscape).join(",");
    });
    const csv = [cols.join(","), ...rows].join("\n");
    const blob = new Blob([csv],{type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href=url;
    a.download=`inventory_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportSalesCSV(){
    const cols = ["sold_at","type","item_id","description","serial_or_imei","sold_qty","sold_price","cost_at_sale","profit"];
    const rows = sales.map(s=>{
      const it = s.inventory_items || {};
      return [
        s.sold_at,
        it.item_type||"",
        it.item_sku||"",
        it.description||"",
        it.serial_or_imei||"",
        s.sold_qty,
        money(s.sold_price),
        money(s.cost_at_sale),
        money(s.profit),
      ].map(csvEscape).join(",");
    });
    const csv = [cols.join(","), ...rows].join("\n");
    const blob = new Blob([csv],{type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href=url;
    a.download=`sales_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Admin: invite staff by creating profile row (user must already exist in Auth)
  const [inviteUserId,setInviteUserId]=useState("");
  const [inviteRole,setInviteRole]=useState("staff");

  async function invite(){
    if(!isAdmin) return alert("Only admin can add staff.");
    const { data: companyId, error: cErr } = await supabase.rpc("current_company_id");
    if(cErr || !companyId) return alert("Company not set.");

    const { error } = await supabase.from("profiles").upsert({
      user_id: inviteUserId.trim(),
      company_id: companyId,
      role: inviteRole
    });

    if(error) return alert(error.message);

    setInviteUserId("");
    setInviteRole("staff");
    await loadUsers();
    alert("Staff linked to your company ✅");
  }

  return (
    <div className="container">
      <div className="header">
        <div>
          <h1 className="h1">Almallah Inventory</h1>
          <div className="muted">Signed in as: <b style={{color:"#fff"}}>{email||"..."}</b> {isAdmin ? <span className="muted">• Admin</span> : <span className="muted">• Staff</span>}</div>
        </div>
        <button className="btn" onClick={logout}>Logout</button>
      </div>

      <div className="pills">
        <button className={`pill ${tab==="inventory"?"pillActive":""}`} onClick={()=>setTab("inventory")}>Inventory</button>
        <button className={`pill ${tab==="sales"?"pillActive":""}`} onClick={()=>setTab("sales")}>Sales</button>
        <button className={`pill ${tab==="users"?"pillActive":""}`} onClick={()=>setTab("users")}>Users</button>
      </div>

      {tab==="inventory" && (
        <>
          <div className="cards">
            <div className="card"><div className="cardTitle">Total Cost</div><div className="cardValue">${money(totals.totalCost)}</div></div>
            <div className="card"><div className="cardTitle">Total Selling</div><div className="cardValue">${money(totals.totalSell)}</div></div>
            <div className="card"><div className="cardTitle">Total Profit</div><div className="cardValue">${money(totals.totalProfit)}</div></div>
          </div>

          <div className="panel">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
              <h2 className="panelTitle">Add Item</h2>
              <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                <button className="btn" onClick={exportInventoryCSV}>Export Inventory CSV</button>
              </div>
            </div>

            <form onSubmit={addItem} className="grid">
              <div className="col2">
                <select value={form.item_type} onChange={e=>setForm(f=>({...f,item_type:e.target.value}))}>
                  <option value="laptop">Laptop</option>
                  <option value="phone">Phone</option>
                  <option value="tablet">Tablet</option>
                </select>
              </div>
              <div className="col2">
                <input placeholder="Item ID / SKU" value={form.item_sku} onChange={e=>setForm(f=>({...f,item_sku:e.target.value}))}/>
              </div>
              <div className="col4">
                <input placeholder="Description" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/>
              </div>
              <div className="col2">
                <input placeholder="Serial / IMEI" value={form.serial_or_imei} onChange={e=>setForm(f=>({...f,serial_or_imei:e.target.value}))}/>
              </div>
              <div className="col2">
                <input type="number" min="0" placeholder="Qty" value={form.qty} onChange={e=>setForm(f=>({...f,qty:e.target.value}))}/>
              </div>
              <div className="col2">
                <input type="number" step="0.01" min="0" placeholder="Cost" value={form.cost} onChange={e=>setForm(f=>({...f,cost:e.target.value}))}/>
              </div>
              <div className="col2">
                <input type="number" step="0.01" min="0" placeholder="Sell" value={form.sell} onChange={e=>setForm(f=>({...f,sell:e.target.value}))}/>
              </div>
              <div className="col2">
                <button className="btn btnPrimary" type="submit">Add</button>
              </div>
            </form>
          </div>

          <div className="panel">
            <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap",alignItems:"center"}}>
              <h2 className="panelTitle">Items</h2>
              <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                <input placeholder="Search IMEI / Serial / SKU / Description" value={q} onChange={e=>setQ(e.target.value)} />
                <button className="btn" onClick={loadItems}>Search</button>
                <button className="btn" onClick={()=>{setQ(""); setTimeout(loadItems,0);}}>Clear</button>
              </div>
            </div>

            {loading ? <div className="muted" style={{padding:10}}>Loading...</div> : (
              <div className="tableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>Type</th><th>Item ID</th><th>Description</th><th>Serial/IMEI</th>
                      <th>Qty</th><th>Cost</th><th>Sell</th><th>Profit</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(it=>{
                      const profitEach = Number(it.sell||0)-Number(it.cost||0);
                      const profitTotal = profitEach*Number(it.qty||0);

                      const isEditing = editId===it.id;

                      return (
                        <tr key={it.id}>
                          <td>{isEditing ? (
                            <select value={edit.item_type} onChange={e=>setEdit(x=>({...x,item_type:e.target.value}))}>
                              <option value="laptop">Laptop</option>
                              <option value="phone">Phone</option>
                              <option value="tablet">Tablet</option>
                            </select>
                          ) : it.item_type}</td>

                          <td>{isEditing ? <input value={edit.item_sku} onChange={e=>setEdit(x=>({...x,item_sku:e.target.value}))}/> : (it.item_sku||"-")}</td>
                          <td>{isEditing ? <input value={edit.description} onChange={e=>setEdit(x=>({...x,description:e.target.value}))}/> : (it.description||"-")}</td>
                          <td>{isEditing ? <input value={edit.serial_or_imei} onChange={e=>setEdit(x=>({...x,serial_or_imei:e.target.value}))}/> : (it.serial_or_imei||"-")}</td>
                          <td>{isEditing ? <input type="number" min="0" value={edit.qty} onChange={e=>setEdit(x=>({...x,qty:e.target.value}))}/> : it.qty}</td>
                          <td>{isEditing ? <input type="number" step="0.01" min="0" value={edit.cost} onChange={e=>setEdit(x=>({...x,cost:e.target.value}))}/> : `$${money(it.cost)}`}</td>
                          <td>{isEditing ? <input type="number" step="0.01" min="0" value={edit.sell} onChange={e=>setEdit(x=>({...x,sell:e.target.value}))}/> : `$${money(it.sell)}`}</td>
                          <td>
                            ${money(profitTotal)} <small>(each ${money(profitEach)})</small>
                          </td>
                          <td className="actions" style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                            {!isEditing ? (
                              <>
                                <button className="btn" onClick={()=>startEdit(it)}>Edit</button>
                                <button className="btn" onClick={()=>markSold(it)}>Sold</button>
                                <button className="btn btnDanger" onClick={()=>removeItem(it.id)} disabled={!isAdmin} title={!isAdmin ? "Admin only" : ""}>Delete</button>
                              </>
                            ) : (
                              <>
                                <button className="btn btnPrimary" onClick={saveEdit}>Save</button>
                                <button className="btn" onClick={()=>setEditId(null)}>Cancel</button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {sellId && (
            <div className="panel">
              <h2 className="panelTitle">Mark as Sold</h2>
              <div className="grid">
                <div className="col3">
                  <input type="number" min="1" placeholder="Sold Qty" value={sellQty} onChange={e=>setSellQty(e.target.value)} />
                </div>
                <div className="col3">
                  <input type="number" step="0.01" min="0" placeholder="Sold Price (each)" value={sellPrice} onChange={e=>setSellPrice(e.target.value)} />
                </div>
                <div className="col3">
                  <button className="btn btnPrimary" onClick={confirmSold}>Confirm Sold</button>
                </div>
                <div className="col3">
                  <button className="btn" onClick={()=>setSellId(null)}>Cancel</button>
                </div>
              </div>
              <div className="muted" style={{marginTop:8}}>This will reduce stock qty and add a record into Sales history.</div>
            </div>
          )}
        </>
      )}

      {tab==="sales" && (
        <div className="panel">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
            <h2 className="panelTitle">Sales History</h2>
            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              <button className="btn" onClick={exportSalesCSV}>Export Sales CSV</button>
              <button className="btn" onClick={loadSales}>Refresh</button>
            </div>
          </div>

          {loading ? <div className="muted" style={{padding:10}}>Loading...</div> : (
            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th><th>Type</th><th>Item ID</th><th>Description</th><th>Serial/IMEI</th>
                    <th>Qty</th><th>Sold Price</th><th>Cost</th><th>Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map(s=>{
                    const it=s.inventory_items||{};
                    return (
                      <tr key={s.id}>
                        <td>{new Date(s.sold_at).toLocaleString()}</td>
                        <td>{it.item_type||"-"}</td>
                        <td>{it.item_sku||"-"}</td>
                        <td>{it.description||"-"}</td>
                        <td>{it.serial_or_imei||"-"}</td>
                        <td>{s.sold_qty}</td>
                        <td>${money(s.sold_price)}</td>
                        <td>${money(s.cost_at_sale)}</td>
                        <td>${money(s.profit)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab==="users" && (
        <div className="panel">
          <h2 className="panelTitle">Users (Staff Accounts)</h2>
          <div className="muted" style={{marginTop:8}}>
            Staff must exist in Supabase Auth first. Then admin links them to the company by user_id.
          </div>

          {!isAdmin ? (
            <div className="muted" style={{marginTop:12}}>Only admin can add staff.</div>
          ) : (
            <div className="grid" style={{marginTop:12}}>
              <div className="col6"><input placeholder="Staff user_id (from Supabase Auth Users)" value={inviteUserId} onChange={e=>setInviteUserId(e.target.value)} /></div>
              <div className="col3">
                <select value={inviteRole} onChange={e=>setInviteRole(e.target.value)}>
                  <option value="staff">staff</option>
                  <option value="admin">admin</option>
                </select>
              </div>
              <div className="col3"><button className="btn btnPrimary" onClick={invite}>Add / Link User</button></div>
            </div>
          )}

          <div className="tableWrap" style={{marginTop:12}}>
            <table>
              <thead>
                <tr><th>User ID</th><th>Role</th><th>Created</th></tr>
              </thead>
              <tbody>
                {profiles.map(p=>(
                  <tr key={p.user_id}>
                    <td style={{fontFamily:"ui-monospace, SFMono-Regular, Menlo, monospace"}}>{p.user_id}</td>
                    <td>{p.role}</td>
                    <td>{new Date(p.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="muted" style={{marginTop:12}}>
            To create staff users: Supabase → Authentication → Users → Add user.
          </div>
        </div>
      )}
    </div>
  );
}
