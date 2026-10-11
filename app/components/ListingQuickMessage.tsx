"use client";
import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";
type Row=Record<string,any>;

const CHANNELS=["WhatsApp","DM Instagram","DM TikTok","Email","Lainnya"];
const STAGES=["","Reach Out","Follow Up","Negotiation","Sample Sent","Content In Progress","Uploaded","Live"];

function renderTemplate(body:string,ctx:Row){
 const vars:Record<string,string>={
  creator_name:String(ctx.creator_name||"Creator"),
  creator_username:String(ctx.creator_username||""),
  product_name:String(ctx.product_name||""),
  sku:String(ctx.sku||""),
  next_action:String(ctx.next_action||""),
  follow_up_date:ctx.next_follow_up_at?new Date(ctx.next_follow_up_at).toLocaleString("id-ID",{dateStyle:"medium",timeStyle:"short"}):"",
  pic_name:String(ctx.pic_name||"")
 };
 return body.replace(/\{\{([a-z_]+)\}\}/g,(_,key)=>vars[key]??"");
}

function waDigits(input?:string|null){
 let v=String(input||"").replace(/\D/g,"");
 if(v.startsWith("0"))v="62"+v.slice(1);
 if(v.startsWith("8"))v="62"+v;
 return v;
}

export default function ListingQuickMessage({workspaceId,listing,creatorUsername,picName,creatorPhone}:{workspaceId:string;listing:Row;creatorUsername?:string|null;picName?:string|null;creatorPhone?:string|null}){
 const supabase=useMemo(()=>createClient(),[]);
 const [templates,setTemplates]=useState<Row[]>([]);
 const [channel,setChannel]=useState(listing.follow_up_channel||"WhatsApp");
 const [stage,setStage]=useState(listing.stage||"Follow Up");
 const [selectedId,setSelectedId]=useState("");
 const [editing,setEditing]=useState(false);
 const [form,setForm]=useState({name:"",channel:"WhatsApp",stage:"",body:""});
 const [msg,setMsg]=useState("");
 const [aiDraft,setAiDraft]=useState("");
 const [aiBusy,setAiBusy]=useState(false);
 const [aiMode,setAiMode]=useState("");
 const [aiHistoryCount,setAiHistoryCount]=useState(0);
 const [aiNote,setAiNote]=useState(""); const [customComment,setCustomComment]=useState(""); const [phoneOverride,setPhoneOverride]=useState("");

 async function load(){
  const x=await supabase.from("luma_followup_message_templates").select("*").eq("workspace_id",workspaceId).eq("active",true).order("name");
  setTemplates(x.data||[]);
 }

 useEffect(()=>{void load()},[workspaceId]);
 useEffect(()=>{
  setChannel(listing.follow_up_channel||"WhatsApp");
  setStage(listing.stage||"Follow Up");
  setSelectedId("");
  setAiDraft("");
  setAiMode("");
  setAiHistoryCount(0);
  setAiNote(""); setCustomComment(""); setPhoneOverride("");
 },[listing.id]);

 const filtered=templates.filter(x=>(!channel||x.channel===channel)&&(!x.stage||x.stage===stage));
 const selected=templates.find(x=>String(x.id)===selectedId)||filtered[0]||null;
 const preview=selected?renderTemplate(selected.body,{...listing,creator_username:creatorUsername,pic_name:picName}):"";
 const activeBase=aiDraft||preview; const activeText=[activeBase,customComment.trim()].filter(Boolean).join("\n\n");
 const phone=waDigits((phoneOverride||"").trim()||creatorPhone);

 async function copy(){
  if(!activeText)return;
  await navigator.clipboard.writeText(activeText);
  setMsg("Pesan disalin.");
  setTimeout(()=>setMsg(""),1800);
 }

 async function generate(){
  setAiBusy(true);setMsg("");setAiNote("");
  try{
   const response=await fetch("/api/listings/followup-draft",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({workspace_id:workspaceId,listing_id:listing.id})});
   const result=await response.json().catch(()=>({}));
   if(!response.ok||!result?.ok)throw new Error(String(result?.error||"Draft follow-up belum dapat dibuat."));
   setAiDraft(String(result.draft||""));
   setAiMode(String(result.mode||""));
   setAiHistoryCount(Number(result.history_count||0));
   setAiNote(String(result.rationale||""));
   if(result.suggested_channel&&!listing.follow_up_channel)setChannel(String(result.suggested_channel));
  }catch(e:any){
   setMsg(e?.message||"Draft follow-up belum dapat dibuat.");
  }finally{
   setAiBusy(false);
  }
 }

 function openWhatsapp(){
  if(!phone){setMsg("Nomor WhatsApp creator belum tersedia.");return}
  const query=activeText?"?text="+encodeURIComponent(activeText):"";
  window.open("https://wa.me/"+phone+query,"_blank","noopener,noreferrer");
 }

 async function save(){
  if(!form.name.trim()||!form.body.trim())return setMsg("Nama dan isi template wajib diisi.");
  const {data:{user}}=await supabase.auth.getUser();
  const x=await supabase.from("luma_followup_message_templates").insert({workspace_id:workspaceId,name:form.name.trim(),channel:form.channel,stage:form.stage||null,body:form.body,created_by:user?.id||null});
  if(x.error)return setMsg(x.error.message);
  setEditing(false);
  setForm({name:"",channel:channel||"WhatsApp",stage:stage||"",body:""});
  setMsg("Template tersimpan.");
  await load();
 }

 return <section className="listing-quick-message">
  <header>
   <div><span>QUICK MESSAGE</span><h4>Follow-Up Message</h4><p>Gunakan template atau generate dari history. Pesan tidak dikirim otomatis.</p></div>
   <button onClick={()=>{setEditing(true);setForm({name:"",channel:channel||"WhatsApp",stage:stage||"",body:""})}}>+ Template</button>
  </header>

  <div className="lqm-controls">
   <select value={channel} aria-label="Channel pesan" onChange={e=>{setChannel(e.target.value);setSelectedId("")}}>{CHANNELS.map(x=><option key={x}>{x}</option>)}</select>
   <select value={stage} aria-label="Stage pesan" onChange={e=>{setStage(e.target.value);setSelectedId("")}}>{STAGES.filter(Boolean).map(x=><option key={x}>{x}</option>)}</select>
   <select value={selectedId||String(selected?.id||"")} aria-label="Pilih template pesan" onChange={e=>setSelectedId(e.target.value)}><option value="">Pilih template</option>{filtered.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
  </div>

  <div className="lqm-ai-bar">
   <div><span>AI FOLLOW UP</span><small>{aiMode==="first_contact"?"Sambutan Pertama":aiMode==="follow_up"?"Berdasarkan "+aiHistoryCount+" aktivitas sebelumnya":"Gunakan tindakan/history sebelumnya sebagai konteks"}</small></div>
   <button disabled={aiBusy} onClick={()=>void generate()}>{aiBusy?"Menyusun…":"Generate dari History"}</button>
  </div>

  {aiDraft?
   <div className="lqm-ai-draft">
    <div><span>{aiMode==="first_contact"?"SAMBUTAN PERTAMA":"FOLLOW UP HISTORY"}</span><button onClick={()=>setAiDraft("")}>Gunakan Template</button></div>
    <textarea rows={7} value={aiDraft} aria-label="Draft pesan follow-up" onChange={e=>setAiDraft(e.target.value)}/>
    {aiNote&&<small>{aiNote}</small>}
   </div>
   :selected?
   <div className="lqm-preview"><span>PREVIEW TEMPLATE</span><p>{preview}</p></div>
   :<div className="lqm-empty">Belum ada template. Anda tetap bisa memilih Generate dari History.</div>}

  <div className="lqm-extra"><label><span>TAMBAHAN KOMENTAR</span><textarea rows={2} value={customComment} onChange={e=>setCustomComment(e.target.value)} placeholder="Tambah teks / angka tambahan, mis: kode voucher, nominal, jadwal…" autoComplete="off" spellCheck={false}/><small>Komentar ini digabung otomatis ke pesan WhatsApp.</small></label><label><span>NOMOR WA LAIN (OPSIONAL)</span><input value={phoneOverride} onChange={e=>setPhoneOverride(e.target.value)} placeholder="08xx / 62xx — kosongkan untuk pakai nomor creator…" inputMode="tel" autoComplete="tel" spellCheck={false}/><small>Jika creator belum punya nomor, isi manual di sini.</small></label></div>
   <div className="lqm-actions">
   <small>{aiDraft?"Draft dapat diedit sebelum dikirim.":selected?selected.name+" · "+selected.channel+(selected.stage?" · "+selected.stage:""):"Review pesan sebelum menghubungi creator."}</small>
   <div>
    <button disabled={!activeText} onClick={()=>void copy()}>Copy Message</button>
    <button className="whatsapp" onClick={openWhatsapp}><span className="wa-mark">WA</span> Buka WhatsApp</button>
   </div>
  </div>

  {msg&&<div className="lqm-msg" role="status">{msg}</div>}

  {editing&&<div className="lqm-modal"><div>
   <header><h4>Tambah Template</h4><button type="button" aria-label="Tutup tambah template" onClick={()=>setEditing(false)}>×</button></header>
   <label>Nama<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Contoh: Follow Up Sample"/></label>
   <label>Channel<select value={form.channel} onChange={e=>setForm({...form,channel:e.target.value})}>{CHANNELS.map(x=><option key={x}>{x}</option>)}</select></label>
   <label>Stage<select value={form.stage} onChange={e=>setForm({...form,stage:e.target.value})}>{STAGES.map(x=><option key={x||"all"} value={x}>{x||"Semua Stage"}</option>)}</select></label>
   <label>Isi Pesan<textarea rows={7} value={form.body} onChange={e=>setForm({...form,body:e.target.value})} placeholder={"Halo {{creator_name}}, follow up untuk {{product_name}}…"}/><small>Variables: creator_name, creator_username, product_name, sku, next_action, follow_up_date, pic_name</small></label>
   <footer><button onClick={()=>setEditing(false)}>Batal</button><button className="primary" onClick={()=>void save()}>Simpan Template</button></footer>
  </div></div>}
 </section>
}
