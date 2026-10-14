"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { createClient } from "../../lib/supabase-browser";
import LumaAffiliateCenter from "./LumaAffiliateCenter";
import PromoStudioV2 from "./PromoStudioV2";
import BillingCenter from "./BillingCenter";
import KanbanBoard from "./KanbanBoard";
import InternalExcelGrid from "./InternalExcelGrid";
import UserProfile from "./UserProfile";
const AdminDashboard=dynamic(()=>import("./AdminDashboard"),{ssr:false});
import {CreatorAutocomplete,ProductAutocomplete,CreatorSearchResult,ProductSearchResult,resolveOrCreateCreator} from "./SmartAutocomplete";
import TutorialCenter from "./TutorialCenter";
import AffiliateProgramWorkspace from "./AffiliateProgramWorkspace";
import { readNumber, sortByValue } from "../../lib/numeric";

type Row=Record<string,any>;
const fmt=(v:any)=>new Intl.NumberFormat("id-ID").format(readNumber(v));

export default function RestoredLegacyModules({workspaceId,userId,isAdmin}:{workspaceId:string;userId:string;isAdmin:boolean}){
  if(isAdmin) return <AdminDashboard workspaceId={workspaceId}/>;
  return <>
    <InternalExcelGrid workspaceId={workspaceId}/>
    <Agreements workspaceId={workspaceId}/>
    <AffiliateProgramWorkspace workspaceId={workspaceId}/>
    <LumaAffiliateCenter workspaceId={workspaceId} userId={userId}/>
    <PromoStudioV2 workspaceId={workspaceId} userId={userId}/>
    <KanbanBoard workspaceId={workspaceId} userId={userId}/>
    <TutorialCenter workspaceId={workspaceId}/>
    <BillingCenter workspaceId={workspaceId} userId={userId}/>
    <UserProfile workspaceId={workspaceId} userId={userId}/>
  </>;
}

function Table({rows,columns}:{rows:Row[];columns?:string[]}){
  const cols=useMemo(()=>(columns||(rows[0]?Object.keys(rows[0]):[])).filter(c=>c!=="workspace_id").slice(0,10),[columns,rows]);
  const [sort,setSort]=useState({key:cols[0]||"",asc:true});
  const sorted=useMemo(()=>sortByValue(rows,sort.key,sort.asc),[rows,sort]);
  if(!rows.length)return <div className="empty-state"><strong>Belum ada data.</strong></div>;
  return <div className="scroll"><table><thead><tr>{cols.map(c=><th key={c}><button className="table-sort" onClick={()=>setSort(v=>({key:c,asc:v.key===c?!v.asc:true}))}>{c.replaceAll("_"," ")}<span>{sort.key===c?(sort.asc?"↑":"↓"):"↕"}</span></button></th>)}</tr></thead><tbody>{sorted.map((r,i)=><tr key={r.id??i}>{cols.map(c=><td key={c}>{typeof r[c]==="object"?JSON.stringify(r[c]):String(r[c]??"")}</td>)}</tr>)}</tbody></table></div>
}

function Agreements({workspaceId}:{workspaceId:string}){
  const supabase=createClient();
  const empty:Row={creator_id:"",creator_name:"",platform:"TikTok",brand:"",category:"",product_master_id:"",product_name:"",product_hpp:0,deal_type:"",ratecard:"",support_type:"",support_value:"",store_name:"",store_id:"",program_id:"",start_date:"",end_date:"",document_status:"Pending",support_status:"Pending",bonus_eligible:"No",notes:"",signed_by_name:"",terms_accepted:false};
  const [rows,setRows]=useState<Row[]>([]),[stores,setStores]=useState<Row[]>([]),[supportPrograms,setSupportPrograms]=useState<Row[]>([]),[msg,setMsg]=useState("");
  const [form,setForm]=useState<Row>(empty);
  const [creatorSearch,setCreatorSearch]=useState("");
  const [productSearch,setProductSearch]=useState("");
  const [savingAgreement,setSavingAgreement]=useState(false);
  const [editingId,setEditingId]=useState<number|null>(null);

  async function load(){
    const [agreementResult,storeResult,programResult]=await Promise.all([
      supabase.from("agreements").select("*").eq("workspace_id",workspaceId).order("id",{ascending:false}).limit(300),
      supabase.rpc("luma_workspace_store_options_v1",{p_workspace_id:workspaceId}),
      supabase.from("luma_affiliate_programs").select("id,program_name,platform,status,start_date,end_date").eq("workspace_id",workspaceId).order("created_at",{ascending:false}).limit(150)
    ]);
    if(agreementResult.error)setMsg(agreementResult.error.message);else setRows((agreementResult.data||[]) as Row[]);
    if(!storeResult.error)setStores((storeResult.data||[]) as Row[]);
    if(!programResult.error)setSupportPrograms((programResult.data||[]) as Row[]);
  }
  useEffect(()=>{void load()},[workspaceId]);

  function chooseCreator(x:CreatorSearchResult){
    const label=x.name||x.username||x.creator_code||"";
    setCreatorSearch(label);
    setForm(p=>({...p,creator_id:String(x.id),creator_name:label,platform:x.platform||p.platform,ratecard:Number(x.ratecard||p.ratecard||0)}));
  }
  function chooseProduct(x:ProductSearchResult){
    setProductSearch(`${x.sku} - ${x.product_name||""}`);
    setForm(p=>({...p,product_master_id:String(x.id),product_name:x.product_name||x.sku,product_hpp:Number(x.cost_price||0)}));
  }
  function startEdit(row:Row){
    const id=Number(row.id);
    setEditingId(id);
    setForm({
      creator_id:row.creator_id?String(row.creator_id):"",
      creator_name:String(row.creator_name||""),
      platform:String(row.platform||"TikTok"),
      brand:String(row.brand||""),
      category:String(row.category||""),
      product_master_id:row.product_master_id?String(row.product_master_id):"",
      product_name:String(row.product_name||""),
      product_hpp:Number(row.product_hpp||0),
      deal_type:String(row.deal_type||""),
      ratecard:row.ratecard!==undefined&&row.ratecard!==null?String(row.ratecard):"",
      support_type:String(row.support_type||""),
      support_value:row.support_value!==undefined&&row.support_value!==null?String(row.support_value):"",
      store_name:String(row.store_name||""),
      store_id:String(row.store_id||""),
      program_id:String(row.program_id||""),
      start_date:row.start_date?String(row.start_date).slice(0,10):"",
      end_date:row.end_date?String(row.end_date).slice(0,10):"",
      document_status:String(row.document_status||"Pending"),
      support_status:String(row.support_status||"Pending"),
      bonus_eligible:String(row.bonus_eligible||"No"),
      notes:String(row.notes||""),
      signed_by_name:String(row.signed_by_name||""),
      terms_accepted:Boolean(row.terms_accepted),
    });
    setCreatorSearch(String(row.creator_name||""));
    setProductSearch(row.product_name?String(row.product_name):"");
    setMsg(`Mengedit Agreement ${row.agreement_id||`#${id}`}. Ubah data di formulir lalu klik Simpan Perubahan.`);
    try{
      document.getElementById("agreements")?.scrollIntoView({behavior:"smooth",block:"start"});
    }catch{}
  }
  function cancelEdit(){
    setEditingId(null);
    setForm({...empty});
    setCreatorSearch("");
    setProductSearch("");
    setMsg("");
  }
  async function save(){
    if(savingAgreement)return;
    const creatorId=Number(form.creator_id||0);
    if(!Number.isSafeInteger(creatorId)||creatorId<=0)
      return setMsg("Pilih creator dari hasil pencarian Master Creator, bukan hanya mengetik namanya.");
    if(!String(form.signed_by_name||"").trim())return setMsg("Nama tanda tangan wajib diisi.");
    if(!form.terms_accepted)return setMsg("Centang Term of Policy Agreement sebelum menyimpan.");
    if(form.start_date&&form.end_date&&form.end_date<form.start_date)
      return setMsg("Tanggal akhir tidak boleh sebelum tanggal mulai.");
    setSavingAgreement(true);
    setMsg("");
    const basePayload={
      ...form,workspace_id:workspaceId,
      creator_id:creatorId,creator_name:String(form.creator_name||creatorSearch).trim(),
      product_master_id:form.product_master_id?Number(form.product_master_id):null,
      program_id:form.program_id||null,
      start_date:form.start_date||null,end_date:form.end_date||null,
      store_name:form.store_name||null,store_id:form.store_id||null,
      product_hpp:Number(form.product_hpp||0),ratecard:Number(form.ratecard||0),support_value:Number(form.support_value||0),
      signed_by_name:String(form.signed_by_name).trim(),
      updated_at:new Date().toISOString()
    };
    try{
      if(editingId){
        const {data,error}=await supabase.from("agreements").update(basePayload).eq("id",editingId).eq("workspace_id",workspaceId).select("agreement_id,e_stamp_id").single();
        if(error){
          setMsg(error.code==="42501"||error.code==="PGRST301"
            ?"Akses mengubah Agreement ditolak. Pastikan akun Anda owner, admin, atau manager pada workspace aktif."
            :error.message);
        }else{
          setMsg(`Agreement ${data?.agreement_id||`#${editingId}`} berhasil diperbarui.`);
          setEditingId(null);
          await load();setForm({...empty});setCreatorSearch("");setProductSearch("");
        }
      }else{
        const insertPayload={
          ...basePayload,
          agreement_id:`AGR-${Date.now()}-${crypto.randomUUID().slice(0,8).toUpperCase()}`,
          signed_at:new Date().toISOString()
        };
        const {data,error}=await supabase.from("agreements").insert(insertPayload).select("agreement_id,e_stamp_id").single();
        if(error){
          setMsg(error.code==="42501"||error.code==="PGRST301"
            ?"Akses menyimpan Agreement ditolak. Pastikan akun Anda owner, admin, atau manager pada workspace aktif."
            :error.message);
        }else{
          setMsg("Agreement "+data.agreement_id+" tersimpan dengan Digital Seal ID "+data.e_stamp_id+". Status perlu review; bukan e-Meterai resmi.");
          await load();setForm({...empty});setCreatorSearch("");setProductSearch("");
        }
      }
    }catch(error){
      setMsg(error instanceof Error?error.message:"Gagal menyimpan Agreement.");
    }finally{setSavingAgreement(false)}
  }
  const f=(k:string,l:string,type="text")=><label>{l}<input type={type} value={form[k]||""} onChange={e=>setForm({...form,[k]:e.target.value})}/></label>;

  return <section id="agreements" className="legacy-page-anchor asp-agreements">
    <div className="eyebrow">CREATOR MANAGEMENT · DIGITAL WORKFLOW</div><h1>Agreement & Creator Support</h1><p className="asp-agreement-description">Hubungkan kontrak dengan Master Creator, toko, produk, dan program reward/challenge. Digital Seal Lumaway adalah verifikasi internal dokumen, bukan e-Meterai resmi.</p>
    <div className="card">
      {editingId&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,padding:"10px 14px",marginBottom:14,borderRadius:10,background:"#eff8ff",border:"1px solid #b2ddff",color:"#175cd3"}}>
        <span><strong>Mode Edit:</strong> Sedang mengedit Agreement <code>{rows.find(r=>r.id===editingId)?.agreement_id||`#${editingId}`}</code></span>
        <button type="button" className="secondary compact" onClick={cancelEdit}>Batal Edit</button>
      </div>}
      <div className="grid">
        <label>Creator Search<CreatorAutocomplete workspaceId={workspaceId} value={creatorSearch} selectedId={form.creator_id}
                createPlatform={form.platform} allowCreate={false} onTextChange={value=>{setCreatorSearch(value);setForm(p=>({...p,creator_id:"",creator_name:value}))}} onSelect={chooseCreator} onCreate={value=>{setCreatorSearch(value);setForm(p=>({...p,creator_id:"",creator_name:value}))}}/><small className="field-note">Pilih creator dari dropdown Master Creator. Jika belum tersedia, buat creator dahulu di Master Data.</small></label>
        {f("platform","Platform")}
        {f("brand","Brand")}
        {f("category","Category")}
        <label>Nama Toko / Store<select value={form.store_name||""} onChange={e=>{const store=stores.find(x=>x.store_name===e.target.value);setForm(prev=>({...prev,store_name:e.target.value,store_id:store?.store_id||""}))}}><option value="">Pilih toko (opsional)</option>{stores.map(x=><option key={x.platform+"-"+x.store_name} value={x.store_name}>{x.store_name}{x.store_id?" · ID "+x.store_id:""} ({x.platform})</option>)}</select><small className="field-note">Toko sama dengan daftar di Shipping & Affiliate Performance.</small></label>
        <label>Program Support / Challenge<select value={form.program_id||""} onChange={e=>setForm(prev=>({...prev,program_id:e.target.value}))}><option value="">Tidak terhubung ke program</option>{supportPrograms.filter(x=>!form.platform||x.platform===form.platform).map(x=><option key={x.id} value={x.id}>{x.program_name} · {x.status}</option>)}</select><small className="field-note">Hubungkan ke Affiliate Support, lalu creator ditambahkan sebagai peserta program dari tracker.</small></label>
        <label>Product / SKU Search<ProductAutocomplete workspaceId={workspaceId} value={productSearch} selectedId={form.product_master_id} onTextChange={value=>{setProductSearch(value);setForm(p=>({...p,product_master_id:"",product_name:"",product_hpp:0}))}} onSelect={chooseProduct}/><small className="field-note">HPP terhubung otomatis: Rp {Number(form.product_hpp||0).toLocaleString("id-ID")}</small></label>
        {f("deal_type","Deal Type")}
        {f("ratecard","Ratecard","number")}
        <label>Jenis Support<select value={form.support_type||""} onChange={e=>setForm(prev=>({...prev,support_type:e.target.value}))}><option value="">Pilih support</option><option value="reward">Reward</option><option value="challenge">Affiliate Challenge</option><option value="spark_ads">Spark Ads</option><option value="sampling">Sample Produk</option><option value="incentive">Extra Insentif</option></select></label>
        {f("support_value","Support Value","number")}
        {f("start_date","Start","date")}
        {f("end_date","End","date")}
        <label>Document Status<select value={form.document_status} onChange={e=>setForm({...form,document_status:e.target.value})}><option>Pending</option><option>Approved</option><option>Rejected</option></select></label>
        <label>Support Status<select value={form.support_status} onChange={e=>setForm({...form,support_status:e.target.value})}><option>Pending</option><option>Approved</option><option>Completed</option></select></label>
        <label>Bonus Eligible<select value={form.bonus_eligible} onChange={e=>setForm({...form,bonus_eligible:e.target.value})}><option>No</option><option>Yes</option></select></label>
        {f("signed_by_name","Nama Tanda Tangan")}
      </div>
      <label>Notes<textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
      <div className="owner-inline-note"><b>Digital Seal ID:</b> diterbitkan oleh database dengan 22 karakter unik secara global saat Agreement disimpan. PDF akan memuat nama tanda tangan sebagai watermark. Seal ini berupa identitas verifikasi internal Lumaway, bukan e-Meterai maupun tanda tangan elektronik tersertifikasi. Untuk dokumen yang memerlukan e-Meterai sah, gunakan penyedia resmi/berizin.</div>
      <label className="agreement-terms-consent">
        <input type="checkbox" checked={Boolean(form.terms_accepted)} onChange={e=>setForm(p=>({...p,terms_accepted:e.target.checked}))}/>
        <span><strong>Saya menyetujui Term of Policy Agreement (wajib).</strong>
          Saya memastikan data creator dan nilai support benar, memahami bahwa Digital Seal Lumaway hanya identitas dokumen internal (bukan e-Meterai resmi), dan persetujuan program/reward tetap mengikuti ketentuan workspace. Identitas akun serta waktu persetujuan dicatat untuk audit.</span>
      </label>
      <div className="button-row" style={{display:"flex",gap:8,alignItems:"center",marginTop:8}}>
        <button className="primary" disabled={savingAgreement||!form.terms_accepted} onClick={()=>void save()}>{savingAgreement?"Menyimpan...":(editingId?"Simpan Perubahan Agreement":"Simpan Agreement")}</button>
        {editingId&&<button type="button" className="secondary" onClick={cancelEdit}>Batal</button>}
      </div>
      {msg&&<p role="status" className="muted">{msg}</p>}
    </div>
    <div className="card"><h3>Agreement & Status Dokumen</h3>
      <div className="scroll"><table><thead><tr>{["Agreement","Creator","Platform","Product","Status","Program","Term of Policy","Digital Seal","Signed By","PDF","Edit"].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>
        {rows.map(row=><tr key={row.id} style={editingId===Number(row.id)?{background:"#f5f8ff"}:undefined}><td>{row.agreement_id||"-"}</td><td>{row.creator_name||"-"}</td><td>{row.platform||"-"}</td><td>{row.product_name||"-"}</td><td><span className={"status-pill "+(row.document_status==="Approved"?"s-paid":"")}>{row.document_status==="Approved"?"Approved":"Perlu Review"}</span></td><td>{supportPrograms.find(p=>p.id===row.program_id)?.program_name||"—"}</td><td>{row.terms_accepted?<span title={row.terms_accepted_at||""}>Disetujui · {row.terms_version||"internal"}</span>:"Belum tercatat (legacy)"}</td><td><code>{row.e_stamp_id||"-"}</code></td><td>{row.signed_by_name||"-"}</td><td>{row.e_stamp_id?<a className="secondary compact" href={`/api/agreements/${row.id}/pdf?workspace_id=${encodeURIComponent(workspaceId)}`} target="_blank" rel="noreferrer">PDF</a>:"-"}</td><td><button type="button" className="secondary compact" onClick={()=>startEdit(row)}>{editingId===Number(row.id)?"Sedang Edit":"Edit"}</button></td></tr>)}
        {!rows.length&&<tr><td colSpan={11}>Belum ada Agreement.</td></tr>}
      </tbody></table></div>
    </div>
  </section>
}

function AffiliateSupport({workspaceId}:{workspaceId:string}){
  const supabase=createClient();const [agreements,setAgreements]=useState<Row[]>([]),[samples,setSamples]=useState<Row[]>([]);
  useEffect(()=>{Promise.all([supabase.from("agreements").select("*").eq("workspace_id",workspaceId).limit(100),supabase.from("creator_samples").select("*").eq("workspace_id",workspaceId).limit(100)]).then(([a,s])=>{setAgreements((a.data||[]) as Row[]);setSamples((s.data||[]) as Row[])})},[workspaceId]);
  const eligible=agreements.filter(x=>String(x.bonus_eligible).toLowerCase()==="yes"&&String(x.document_status).toLowerCase()==="approved");
  return <section id="affiliate-support" className="legacy-page-anchor"><div className="eyebrow">CREATOR SUPPORT</div><h1>Affiliate Support Program</h1><div className="kpis"><div className="kpi"><small>Agreement</small><b>{fmt(agreements.length)}</b></div><div className="kpi"><small>Eligible Bonus</small><b>{fmt(eligible.length)}</b></div><div className="kpi"><small>Creator Samples</small><b>{fmt(samples.length)}</b></div></div><div className="card"><p>Eligibility final = Bonus Eligible <b>Yes</b> + Agreement Document <b>Approved</b>.</p><Table rows={eligible} columns={["creator_name","platform","brand","product_name","document_status","support_status","bonus_eligible"]}/></div><div className="card"><h3>Sample Snapshot</h3><Table rows={samples} columns={["creator_name","platform","sku","product_name","sample_status","sent_date","qty","product_value","tracking"]}/></div></section>
}
