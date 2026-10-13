"use client";

import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";
import {CreatorAutocomplete,ProductAutocomplete,CreatorSearchResult,ProductSearchResult,resolveOrCreateCreator} from "./SmartAutocomplete";

type Creator={id:number;creator_code:string|null;name:string|null;username:string|null;platform:string|null};
type Product={id:number;sku:string;product_name:string|null;cost_price:number|null};
type ShippingRow={id:number;data_date:string|null;creator_id:number|null;creator_name:string|null;platform:string|null;store_name:string|null;store_id:string|null;product_master_id:number|null;sku:string|null;product_name:string|null;qty:number|null;product_cost:number|null;shipping_cost:number|null;courier:string|null;tracking:string|null;status:string|null;reference_no:string|null;receiver_name:string|null;receiver_phone:string|null;receiver_address:string|null;sender_name:string|null;sender_phone:string|null;sender_address:string|null;service:string|null;branch:string|null;weight:number|null;insurance_amount:number|null;cod_amount:number|null;package_contents:string|null;notes:string|null;shipped_at:string|null;delivered_at:string|null};
type Props={workspaceId:string};
type FormState={data_date:string;creator_id:string;creator_name:string;platform:string;store_name:string;store_id:string;product_master_id:string;qty:string;product_cost:string;shipping_cost:string;courier:string;tracking:string;status:string;reference_no:string;receiver_name:string;receiver_phone:string;receiver_address:string;sender_name:string;sender_phone:string;sender_address:string;service:string;branch:string;weight:string;insurance_amount:string;cod_amount:string;package_contents:string;notes:string;shipped_at:string;delivered_at:string};

const EMPTY_FORM:FormState={data_date:"",creator_id:"",creator_name:"",platform:"",store_name:"",store_id:"",product_master_id:"",qty:"1",product_cost:"0",shipping_cost:"0",courier:"",tracking:"",status:"Pending",reference_no:"",receiver_name:"",receiver_phone:"",receiver_address:"",sender_name:"",sender_phone:"",sender_address:"",service:"",branch:"",weight:"0",insurance_amount:"0",cod_amount:"0",package_contents:"",notes:"",shipped_at:"",delivered_at:""};
const STATUS_TABS=["All","Pending","Packed","Shipped","Delivery","Delivered","Returned","Cancelled"] as const;
const money=(value:any)=>"Rp "+Number(value||0).toLocaleString("id-ID");
const dateLabel=(value:string|null)=>value?new Date(value+"T00:00:00").toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}):"-";
const tone=(status:string|null)=>{const s=String(status||"pending").toLowerCase();if(["delivered","finish"].includes(s))return"success";if(["shipped","delivery"].includes(s))return"info";if(["returned","cancelled"].includes(s))return"danger";if(s==="packed")return"warning";return"neutral"};
const esc=(value:any)=>String(value??"").replace(/[&<>"']/g,(m)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"} as Record<string,string>)[m]||m);

function scrollToShippingEditor(){
 const reduceMotion=typeof window!=="undefined"&&typeof window.matchMedia==="function"&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
 setTimeout(()=>{try{document.querySelector(".shipping-v2-editor")?.scrollIntoView({behavior:reduceMotion?"auto":"smooth",block:"start"})}catch{/* noop */}},60);
}

function labelHtml(row:ShippingRow){
 const ref=row.reference_no||("LUMA-"+row.id);
 return "<!doctype html><html><head><meta charset='utf-8'><title>"+esc(ref)+"</title><style>"+
 "body{font-family:Arial,sans-serif;background:#f4f4f5;margin:0;padding:24px}.label{width:760px;max-width:100%;margin:auto;background:#fff;border:2px solid #111;color:#111}.head,.split,.two{display:grid;grid-template-columns:2fr 1fr}.cell{padding:14px;border-bottom:1px solid #111}.head .cell:first-child,.split .cell:first-child,.two .cell:first-child{border-right:1px solid #111}.brand{font-weight:800;letter-spacing:.08em}.muted{font-size:12px;color:#555}.awb{text-align:center;font-size:22px;font-weight:800;letter-spacing:.04em}.bars{height:72px;margin:10px 0;background:repeating-linear-gradient(90deg,#111 0 3px,#fff 3px 6px,#111 6px 8px,#fff 8px 11px)}.big{font-size:28px;font-weight:800}.small{font-size:12px;line-height:1.5}.foot{padding:12px;font-size:11px;border-top:1px solid #111}@media print{body{background:#fff;padding:0}.label{width:100%;border:1px solid #111}}</style></head><body><div class='label'>"+
 "<div class='head'><div class='cell'><div class='brand'>LUMAWAY SHIPPING</div><div class='muted'>Internal shipping label preview</div></div><div class='cell'><b>"+esc(row.courier||"-")+"</b><br><span class='muted'>"+esc(row.service||"-")+"</span></div></div>"+
 "<div class='split'><div class='cell'><div class='bars'></div><div class='awb'>"+esc(row.tracking||ref)+"</div></div><div class='cell small'><b>Reference</b><br>"+esc(ref)+"<br><br><b>QTY</b><br>"+esc(row.qty||0)+" pcs</div></div>"+
 "<div class='two'><div class='cell'><b>Penerima</b><br>"+esc(row.receiver_name||row.creator_name||"-")+"<br>"+esc(row.receiver_phone||"-")+"<br><span class='small'>"+esc(row.receiver_address||"-")+"</span></div><div class='cell'><b>Pengirim</b><br>"+esc(row.sender_name||"-")+"<br>"+esc(row.sender_phone||"-")+"<br><span class='small'>"+esc(row.sender_address||"-")+"</span></div></div>"+
 "<div class='cell'><b>Isi paket</b><br>"+esc(row.package_contents||row.product_name||"-")+"</div>"+
 "<div class='two'><div class='cell big'>COD: "+esc(money(row.cod_amount))+"</div><div class='cell'><b>Asuransi</b><br>"+esc(money(row.insurance_amount))+"</div></div>"+
 "<div class='cell'><b>Catatan</b><br>"+esc(row.notes||"-")+"</div><div class='foot'>Template internal Lumaway. Bukan label resmi kurir sampai AWB resmi diterbitkan.</div></div></body></html>";
}

export default function Shipping({workspaceId}:Props){
 const supabase=useMemo(()=>createClient(),[]);
 const [rows,setRows]=useState<ShippingRow[]>([]);
 const [creators,setCreators]=useState<Creator[]>([]);
 const [products,setProducts]=useState<Product[]>([]);
 const [storeOptions,setStoreOptions]=useState<{store_name:string;store_id:string|null;platform:string}[]>([]);
 const [registeringStore,setRegisteringStore]=useState(false);
 const [form,setForm]=useState<FormState>(EMPTY_FORM);
 const [creatorSearch,setCreatorSearch]=useState("");
 const [productSearch,setProductSearch]=useState("");
 const [manualCreatorConfirmed,setManualCreatorConfirmed]=useState(false);
 const [search,setSearch]=useState("");
 const [dateStart,setDateStart]=useState("");
 const [dateEnd,setDateEnd]=useState("");
 const [activeTab,setActiveTab]=useState<(typeof STATUS_TABS)[number]>("All");
 const [editingId,setEditingId]=useState<number|null>(null);
 const [showForm,setShowForm]=useState(false);
 const [preview,setPreview]=useState<ShippingRow|null>(null);
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState("");

 async function loadData(){
  if(!workspaceId)return;setLoading(true);setError("");
  const [shipRes,creatorRes,productRes,storeRes]=await Promise.all([
   supabase.from("shipping").select("id,data_date,creator_id,creator_name,platform,store_name,store_id,product_master_id,sku,product_name,qty,product_cost,shipping_cost,courier,tracking,status,reference_no,receiver_name,receiver_phone,receiver_address,sender_name,sender_phone,sender_address,service,branch,weight,insurance_amount,cod_amount,package_contents,notes,shipped_at,delivered_at").eq("workspace_id",workspaceId).order("id",{ascending:false}),
   supabase.from("creators").select("id,creator_code,name,username,platform").eq("workspace_id",workspaceId).order("name").limit(7770),
   supabase.from("product_master").select("id,sku,product_name,cost_price").eq("workspace_id",workspaceId).order("sku").limit(1000),
   supabase.rpc("luma_workspace_store_options_v1",{p_workspace_id:workspaceId}),
  ]);
  if(shipRes.error)setError(shipRes.error.message);else setRows((shipRes.data||[]) as ShippingRow[]);
  if(!creatorRes.error)setCreators((creatorRes.data||[]) as Creator[]);
  if(!productRes.error)setProducts((productRes.data||[]) as Product[]);
  if(!storeRes.error)setStoreOptions((storeRes.data||[]) as {store_name:string;store_id:string|null;platform:string}[]);
  setLoading(false);
 }
 useEffect(()=>{void loadData()},[workspaceId]);
 useEffect(()=>{
  const onQuick=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail?.type==="shipping")openAdd()};
  const onSelect=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail?.type!=="shipping")return;const row=rows.find(item=>item.id===Number(detail.id));setSearch(String(detail.title||""));if(row)setPreview(row)};
  window.addEventListener("lumaway-quick-create",onQuick as EventListener);window.addEventListener("lumaway-global-select",onSelect as EventListener);
  return()=>{window.removeEventListener("lumaway-quick-create",onQuick as EventListener);window.removeEventListener("lumaway-global-select",onSelect as EventListener)};
 },[rows]);
  useEffect(()=>{if(!preview)return;const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape")setPreview(null)};window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey)},[preview]);

 function openAdd(){setEditingId(null);setForm({...EMPTY_FORM,data_date:new Date().toISOString().slice(0,10),reference_no:"LUMA-"+Date.now().toString().slice(-8)});setCreatorSearch("");setProductSearch("");setManualCreatorConfirmed(false);setError("");setShowForm(true);scrollToShippingEditor()}
 function openEdit(row:ShippingRow){setEditingId(row.id);setForm({data_date:row.data_date||"",creator_id:row.creator_id?.toString()||"",creator_name:row.creator_name||"",platform:row.platform||"",store_name:row.store_name||"",store_id:row.store_id||"",product_master_id:row.product_master_id?.toString()||"",qty:String(row.qty||1),product_cost:String(row.product_cost||0),shipping_cost:String(row.shipping_cost||0),courier:row.courier||"",tracking:row.tracking||"",status:row.status||"Pending",reference_no:row.reference_no||"",receiver_name:row.receiver_name||row.creator_name||"",receiver_phone:row.receiver_phone||"",receiver_address:row.receiver_address||"",sender_name:row.sender_name||"",sender_phone:row.sender_phone||"",sender_address:row.sender_address||"",service:row.service||"",branch:row.branch||"",weight:String(row.weight||0),insurance_amount:String(row.insurance_amount||0),cod_amount:String(row.cod_amount||0),package_contents:row.package_contents||row.product_name||"",notes:row.notes||"",shipped_at:row.shipped_at||"",delivered_at:row.delivered_at||""});setCreatorSearch(row.creator_name||"");setProductSearch(row.sku?(row.sku+(row.product_name?" - "+row.product_name:"")):"");setManualCreatorConfirmed(!row.creator_id&&Boolean(row.creator_name));setShowForm(true);scrollToShippingEditor()}

 async function save(){
  setSaving(true);setError("");let creator=creators.find(c=>c.id===Number(form.creator_id));
  if(!creator&&(form.creator_name.trim()||creatorSearch.trim())){
   if(!form.platform.trim()){setSaving(false);setError("Pilih platform terlebih dahulu untuk creator baru.");return}
   try{const resolved=await resolveOrCreateCreator(workspaceId,form.creator_name.trim()||creatorSearch.trim(),form.platform);if(resolved){creator=resolved as Creator;setCreators(prev=>prev.some(x=>x.id===resolved.id)?prev:[resolved as Creator,...prev])}}catch(err){setSaving(false);setError(err instanceof Error?err.message:"Gagal membuat creator baru.");return}
  }
  const product=products.find(p=>p.id===Number(form.product_master_id));
  const payload={workspace_id:workspaceId,data_date:form.data_date||null,creator_id:creator?.id??(form.creator_id?Number(form.creator_id):null),creator_name:form.creator_name.trim()||creator?.name||creator?.username||creator?.creator_code||null,platform:form.platform||creator?.platform||null,store_name:form.store_name.trim()||null,store_id:form.store_id.trim()||null,product_master_id:form.product_master_id?Number(form.product_master_id):null,sku:product?.sku||null,product_name:product?.product_name||null,qty:Number(form.qty||0),product_cost:product?.cost_price!=null?Number(product.cost_price):Number(form.product_cost||0),shipping_cost:Number(form.shipping_cost||0),courier:form.courier.trim()||null,tracking:form.tracking.trim()||null,status:form.status||null,reference_no:form.reference_no.trim()||null,receiver_name:form.receiver_name.trim()||creator?.name||creator?.username||form.creator_name.trim()||null,receiver_phone:form.receiver_phone.trim()||null,receiver_address:form.receiver_address.trim()||null,sender_name:form.sender_name.trim()||null,sender_phone:form.sender_phone.trim()||null,sender_address:form.sender_address.trim()||null,service:form.service.trim()||null,branch:form.branch.trim()||null,weight:Number(form.weight||0),insurance_amount:Number(form.insurance_amount||0),cod_amount:Number(form.cod_amount||0),package_contents:form.package_contents.trim()||product?.product_name||null,notes:form.notes.trim()||null,shipped_at:form.shipped_at||null,delivered_at:form.delivered_at||null,updated_at:new Date().toISOString()};
  const result=editingId!==null?await supabase.from("shipping").update(payload).eq("id",editingId).eq("workspace_id",workspaceId):await supabase.from("shipping").insert(payload);
  setSaving(false);if(result.error){setError(result.error.message);return}setShowForm(false);setEditingId(null);await loadData();
 }

 async function registerStore(){
  if(!form.store_name.trim())return setError("Masukkan nama toko terlebih dahulu.");
  setRegisteringStore(true);setError("");
  const {data:{user}}=await supabase.auth.getUser();
  if(!user){setError("Silakan login kembali.");setRegisteringStore(false);return}
  const result=await supabase.from("luma_workspace_stores").insert({
    workspace_id:workspaceId,platform:form.platform||"Other",store_name:form.store_name.trim(),
    store_id:form.store_id.trim()||null,created_by:user.id
  });
  if(result.error)setError(result.error.code==="23505"?"Toko sudah terdaftar. Pilih dari daftar.":result.error.message);
  else await loadData();
  setRegisteringStore(false);
 }

 async function remove(id:number){if(!window.confirm("Hapus data shipping ini?"))return;const res=await supabase.from("shipping").delete().eq("id",id).eq("workspace_id",workspaceId);if(res.error)setError(res.error.message);else await loadData()}

 const visibleRows=useMemo(()=>rows.filter(row=>{
  const q=search.trim().toLowerCase(),status=String(row.status||"Pending");
  if(activeTab!=="All"&&status.toLowerCase()!==activeTab.toLowerCase())return false;
  if(dateStart&&String(row.data_date||"")<dateStart)return false;if(dateEnd&&String(row.data_date||"")>dateEnd)return false;
  if(!q)return true;
  return [row.reference_no,row.tracking,row.creator_name,row.receiver_name,row.platform,row.store_name,row.sku,row.product_name,row.courier,row.service,row.status].filter(Boolean).some(v=>String(v).toLowerCase().includes(q));
 }),[rows,search,activeTab,dateStart,dateEnd]);
 const counts=useMemo(()=>Object.fromEntries(STATUS_TABS.map(tab=>[tab,tab==="All"?rows.length:rows.filter(row=>String(row.status||"Pending").toLowerCase()===tab.toLowerCase()).length])),[rows]);
 const visibleShippingSpend=useMemo(()=>visibleRows.reduce((sum,row)=>String(row.status||"").toLowerCase()==="cancelled"?sum:sum+Number(row.shipping_cost||0)+Number(row.insurance_amount||0),0),[visibleRows]);

 function downloadTemplate(row:ShippingRow){const blob=new Blob([labelHtml(row)],{type:"text/html;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=(row.reference_no||("LUMA-"+row.id))+"-resi.html";a.click();URL.revokeObjectURL(url)}
 function printLabel(row:ShippingRow){const popup=window.open("","_blank","width=900,height=1100");if(!popup)return;popup.document.write(labelHtml(row));popup.document.close();popup.focus();setTimeout(()=>popup.print(),250)}
 function exportCsv(){const data=[["Reference","AWB","Creator","Store","Platform","Receiver","Date","Status","Courier","Service","Qty","Shipping Cost","Insurance","Shipping Spend"],...visibleRows.map(r=>[r.reference_no,r.tracking,r.creator_name,r.store_name,r.platform,r.receiver_name,r.data_date,r.status,r.courier,r.service,r.qty,r.shipping_cost,r.insurance_amount,Number(r.shipping_cost||0)+Number(r.insurance_amount||0)])];const csv=data.map(row=>row.map(v=>'"'+String(v??"").replaceAll('"','""')+'"').join(",")).join("\n");const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="lumaway-shipping.csv";a.click();URL.revokeObjectURL(url)}

 return <section id="shipping" className="legacy-page-anchor shipping-v2-page">
  <header className="shipping-v2-header"><div><span>OPERATIONS</span><h2>Shipping</h2><p>Kelola pengiriman sample, produk, dan kebutuhan campaign dari satu workspace.</p></div><div className="shipping-v2-actions"><button className="secondary" onClick={exportCsv}>Export</button><button className="primary" onClick={openAdd}>+ Tambah</button></div></header>
  <div className="shipping-v2-spend-summary"><div><span>Shipping Spend</span><strong>{money(visibleShippingSpend)}</strong><small>Shipping Cost + Insurance · tidak termasuk COD · Cancelled tidak dihitung</small></div><div><span>Visible Shipment</span><strong>{visibleRows.length.toLocaleString("id-ID")}</strong><small>Mengikuti filter aktif</small></div></div>
  <div className="shipping-v2-tabs">{STATUS_TABS.map(tab=><button key={tab} className={activeTab===tab?"active":""} onClick={()=>setActiveTab(tab)}>{tab}<span>{Number(counts[tab]||0)}</span></button>)}</div>
  <div className="shipping-v2-toolbar" role="search"><label className="shipping-v2-search-label" htmlFor="shipping-search"><span>Cari shipment</span><input id="shipping-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari resi, creator, penerima, produk, kurir…" autoComplete="off" spellCheck={false}/></label><input type="date" value={dateStart} onChange={e=>setDateStart(e.target.value)} aria-label="Tanggal mulai"/><input type="date" value={dateEnd} onChange={e=>setDateEnd(e.target.value)} aria-label="Tanggal akhir"/>{(search||dateStart||dateEnd)&&<button className="secondary" onClick={()=>{setSearch("");setDateStart("");setDateEnd("")}}>Reset</button>}</div>
  {error&&<div className="shipping-v2-alert" role="alert">{error}</div>}

  {showForm&&<section className="shipping-v2-editor">
   <div className="shipping-v2-editor-head"><div><span>{editingId?"EDIT SHIPPING":"NEW SHIPPING"}</span><h3>{editingId?"Edit Shipping":"Tambah Shipping"}</h3></div><button type="button" aria-label="Tutup editor shipping" onClick={()=>setShowForm(false)}>×</button></div>
   <div className="shipping-v2-form-grid">
    <label><span>Reference No.</span><input value={form.reference_no} onChange={e=>setForm(p=>({...p,reference_no:e.target.value}))}/></label>
    <label><span>Tanggal</span><input type="date" value={form.data_date} onChange={e=>setForm(p=>({...p,data_date:e.target.value}))}/></label>
    <label><span>Creator</span><CreatorAutocomplete workspaceId={workspaceId} value={creatorSearch} selectedId={form.creator_id} createPlatform={form.platform} placeholder="Ketik username atau nama creator" onTextChange={value=>{setCreatorSearch(value);setManualCreatorConfirmed(false);setForm(p=>({...p,creator_id:"",creator_name:value,receiver_name:p.receiver_name||value}))}} onSelect={(creator:CreatorSearchResult)=>{const name=creator.name||creator.username||creator.creator_code||"";setCreators(prev=>prev.some(x=>x.id===creator.id)?prev:[creator as Creator,...prev]);setForm(p=>({...p,creator_id:String(creator.id),creator_name:name,receiver_name:p.receiver_name||name,platform:creator.platform||p.platform}));setCreatorSearch(name);setManualCreatorConfirmed(false)}} onCreate={value=>{setCreatorSearch(value);setManualCreatorConfirmed(true);setForm(p=>({...p,creator_id:"",creator_name:value,receiver_name:p.receiver_name||value}))}}/>{manualCreatorConfirmed&&!form.creator_id&&<small>Creator baru akan dibuat saat data disimpan.</small>}</label>
    <label><span>Platform</span><select value={form.platform} onChange={e=>setForm(p=>({...p,platform:e.target.value}))}><option value="">Pilih Platform</option><option>TikTok</option><option>Shopee</option><option>Instagram</option><option>YouTube</option><option>Other</option></select></label>
    <label><span>Store / Shop</span><select value={form.store_name} onChange={e=>{const store=storeOptions.find(x=>x.store_name===e.target.value);setForm(p=>({...p,store_name:e.target.value,store_id:store?.store_id||"",platform:store?.platform==="Other"?p.platform:store?.platform||p.platform}))}}><option value="">Pilih toko dari workspace</option>{storeOptions.map(store=><option key={store.platform+"-"+store.store_name} value={store.store_name}>{store.store_name}{store.store_id?" · ID "+store.store_id:""} ({store.platform})</option>)}</select><small>Toko mengikuti Master Store workspace. Toko dari import Sales, Affiliate Performance, Creator atau Live akan muncul di sini jika memiliki nama toko.</small>
   <input value={form.store_name} onChange={e=>setForm(p=>({...p,store_name:e.target.value}))} placeholder="Nama toko baru (jika belum ada)"/>
   <input value={form.store_id} onChange={e=>setForm(p=>({...p,store_id:e.target.value}))} placeholder="Store ID / ID Toko (opsional)"/>
   <button type="button" className="secondary compact" disabled={registeringStore||!form.store_name.trim()} onClick={()=>void registerStore()}>{registeringStore?"Menyimpan...":"+ Daftarkan Toko ke Master"}</button></label>
    <label><span>Product / SKU</span><ProductAutocomplete workspaceId={workspaceId} value={productSearch} selectedId={form.product_master_id} placeholder="Ketik SKU atau nama produk" onTextChange={value=>{setProductSearch(value);setForm(p=>({...p,product_master_id:""}))}} onSelect={(product:ProductSearchResult)=>{setProducts(prev=>prev.some(x=>x.id===product.id)?prev:[product as Product,...prev]);setForm(p=>({...p,product_master_id:String(product.id),product_cost:String(product.cost_price||0),package_contents:p.package_contents||product.product_name||product.sku}));setProductSearch(product.sku+(product.product_name?" - "+product.product_name:""))}}/></label>
    <label><span>Qty</span><input type="number" min="0" value={form.qty} onChange={e=>setForm(p=>({...p,qty:e.target.value}))}/></label>
    <label><span>Status</span><select value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value}))}><option>Pending</option><option>Packed</option><option>Shipped</option><option>Delivery</option><option>Delivered</option><option>Returned</option><option>Cancelled</option></select></label>
    <label><span>Courier</span><input value={form.courier} onChange={e=>setForm(p=>({...p,courier:e.target.value}))} placeholder="JNE / J&T / ID Express"/></label>
    <label><span>Service</span><input value={form.service} onChange={e=>setForm(p=>({...p,service:e.target.value}))} placeholder="REG / NEXT DAY / Cargo"/></label>
    <label><span>Tracking / AWB</span><input value={form.tracking} onChange={e=>setForm(p=>({...p,tracking:e.target.value}))}/></label>
    <label><span>Receiver Name</span><input value={form.receiver_name} onChange={e=>setForm(p=>({...p,receiver_name:e.target.value}))}/></label>
    <label><span>Receiver Phone</span><input value={form.receiver_phone} onChange={e=>setForm(p=>({...p,receiver_phone:e.target.value}))}/></label>
    <label className="wide"><span>Receiver Address</span><textarea rows={3} value={form.receiver_address} onChange={e=>setForm(p=>({...p,receiver_address:e.target.value}))}/></label>
    <label><span>Sender Name</span><input value={form.sender_name} onChange={e=>setForm(p=>({...p,sender_name:e.target.value}))}/></label>
    <label><span>Sender Phone</span><input value={form.sender_phone} onChange={e=>setForm(p=>({...p,sender_phone:e.target.value}))}/></label>
    <label className="wide"><span>Sender Address</span><textarea rows={3} value={form.sender_address} onChange={e=>setForm(p=>({...p,sender_address:e.target.value}))}/></label>
    <label><span>Shipping Cost</span><input type="number" min="0" value={form.shipping_cost} onChange={e=>setForm(p=>({...p,shipping_cost:e.target.value}))}/></label>
    <label><span>Insurance</span><input type="number" min="0" value={form.insurance_amount} onChange={e=>setForm(p=>({...p,insurance_amount:e.target.value}))}/></label>
    <label><span>COD</span><input type="number" min="0" value={form.cod_amount} onChange={e=>setForm(p=>({...p,cod_amount:e.target.value}))}/></label>
    <label><span>Shipped At</span><input type="date" value={form.shipped_at} onChange={e=>setForm(p=>({...p,shipped_at:e.target.value}))}/></label>
    <label><span>Delivered At</span><input type="date" value={form.delivered_at} onChange={e=>setForm(p=>({...p,delivered_at:e.target.value}))}/></label>
    <label className="wide"><span>Package Contents</span><input value={form.package_contents} onChange={e=>setForm(p=>({...p,package_contents:e.target.value}))}/></label>
    <label className="wide"><span>Notes</span><textarea rows={3} value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))}/></label>
   </div>
   <div className="shipping-v2-editor-actions"><button className="secondary" onClick={()=>setShowForm(false)}>Batal</button><button className="primary" disabled={saving} onClick={()=>void save()}>{saving?"Menyimpan...":"Simpan"}</button></div>
  </section>}

  {loading?<div className="shipping-v2-empty" role="status">Memuat Shipping…</div>:visibleRows.length===0?<div className="shipping-v2-empty"><b>Belum ada pengiriman pada filter ini.</b><span>Tambah pengiriman baru atau ubah filter.</span></div>:<div className="shipping-v2-table-wrap"><table className="shipping-v2-table"><thead><tr><th>Reference / AWB</th><th>Store</th><th>Penerima</th><th>Tanggal</th><th>Status</th><th>Qty</th><th>Layanan</th><th>Biaya</th><th>Aksi</th></tr></thead><tbody>{visibleRows.map(row=><tr key={row.id} tabIndex={0} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setPreview(row)}}}><td><b>{row.reference_no||("LUMA-"+row.id)}</b><small>{row.tracking||"Belum ada AWB"}</small></td><td><b>{row.store_name||"-"}</b><small>{row.platform||"Unassigned"}</small></td><td><b>{row.receiver_name||row.creator_name||"-"}</b><small>{row.receiver_phone||row.platform||"-"}</small></td><td>{dateLabel(row.data_date)}</td><td><span className={"shipping-v2-status "+tone(row.status)}>{row.status||"Pending"}</span></td><td>{Number(row.qty||0).toLocaleString("id-ID")}</td><td><b>{row.courier||"-"}</b><small>{row.service||"-"}</small></td><td>{money(row.shipping_cost)}</td><td><div className="shipping-v2-row-actions"><button onClick={()=>setPreview(row)}>Preview</button><button onClick={()=>downloadTemplate(row)}>Download</button><button onClick={()=>openEdit(row)}>Edit</button><button className="danger" onClick={()=>void remove(row.id)}>Hapus</button></div></td></tr>)}</tbody></table></div>}

  {preview&&<div className="shipping-v2-modal-backdrop" onMouseDown={()=>setPreview(null)}><section className="shipping-v2-preview" role="dialog" aria-modal="true" aria-label="Preview template resi" onMouseDown={e=>e.stopPropagation()}>
   <header><div><span>TEMPLATE RESI</span><h3>{preview.reference_no||("LUMA-"+preview.id)}</h3><p>Preview internal Lumaway — bukan label resmi kurir sampai AWB diterbitkan.</p></div><button type="button" aria-label="Tutup preview resi" onClick={()=>setPreview(null)}>×</button></header>
   <div className="shipping-label-preview">
    <div className="slp-head"><div><b>LUMAWAY SHIPPING</b><small>Internal shipping label preview</small></div><div><b>{preview.courier||"-"}</b><small>{preview.service||"-"}</small></div></div>
    <div className="slp-main"><div><div className="slp-bars"/><strong>{preview.tracking||preview.reference_no||("LUMA-"+preview.id)}</strong></div><aside><span>QTY <b>{Number(preview.qty||0).toLocaleString("id-ID")} pcs</b></span><span>Asuransi <b>{money(preview.insurance_amount)}</b></span></aside></div>
    <div className="slp-two"><div><span>Penerima</span><b>{preview.receiver_name||preview.creator_name||"-"}</b><p>{preview.receiver_phone||"-"}<br/>{preview.receiver_address||"-"}</p></div><div><span>Pengirim</span><b>{preview.sender_name||"-"}</b><p>{preview.sender_phone||"-"}<br/>{preview.sender_address||"-"}</p></div></div>
    <div className="slp-two"><div><span>Store / Shop</span><b>{preview.store_name||"-"}</b></div><div><span>Platform</span><b>{preview.platform||"-"}</b></div></div>
    <div className="slp-two"><div><span>Isi paket</span><b>{preview.package_contents||preview.product_name||"-"}</b></div><div><span>Catatan</span><b>{preview.notes||"-"}</b></div></div>
    <div className="slp-two"><div className="slp-cod">COD: {money(preview.cod_amount)}</div><div><span>Status</span><b className={"shipping-v2-status "+tone(preview.status)}>{preview.status||"Pending"}</b></div></div>
   </div>
   <footer><button className="secondary" onClick={()=>downloadTemplate(preview)}>Download Template</button><button className="primary" onClick={()=>printLabel(preview)}>Print / Save PDF</button></footer>
  </section></div>}
 </section>
}
