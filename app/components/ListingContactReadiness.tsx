"use client";
import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";
type Row=Record<string,any>;

export default function ListingContactReadiness({workspaceId}:{workspaceId:string}){
 const supabase=useMemo(()=>createClient(),[]);
 const [data,setData]=useState<Row>({}),[loading,setLoading]=useState(true),[error,setError]=useState("");
 async function load(){
  setLoading(true);
  const x=await supabase.rpc("luma_listing_contact_readiness_v1",{p_workspace_id:workspaceId});
  if(x.error){
   const errCode=String((x.error as any)?.code||"");
   const errMsg=String(x.error.message||"");
   const missing=errCode==="42883"||errCode==="42P01"||errCode==="PGRST202"||errCode==="PGRST205"||/does not exist|schema cache|function .* not/i.test(errMsg);
   setError(missing?"Ringkasan kesiapan kontak belum tersedia di database. Minta admin menjalankan supabase/PR88_CHANNEL_CONTACTS_APPLY_READY.sql di SQL Editor, lalu klik Refresh.":x.error.message);
   setData({});
  }else{setError("");setData(x.data||{})}
  setLoading(false);
 }
 useEffect(()=>{void load();const fn=()=>void load();window.addEventListener("lumaway-database-updated",fn);return()=>window.removeEventListener("lumaway-database-updated",fn)},[workspaceId]);
 function open(item:Row){window.dispatchEvent(new CustomEvent("lumaway-global-select",{detail:{type:"listing",id:item.id,title:item.creator_name}}))}
 const s=data.summary||{},blocked=data.blocked||[];
 return <section className="listing-contact-readiness">
  <header><div><span>CONTACT READINESS</span><h3>Kesiapan follow-up creator</h3><p>Cek apakah WhatsApp atau social account yang dibutuhkan sudah tersedia sebelum follow-up jatuh tempo.</p></div><button onClick={()=>void load()}>Refresh</button></header>
  {error&&<div className="listing-v2-alert error" role="alert">{error}</div>}
  {loading?<div className="listing-v2-empty small" role="status">Memeriksa contact data…</div>:<>
   <div className="lcr-summary">
    <article><span>Total Listing</span><strong>{Number(s.total||0).toLocaleString("id-ID")}</strong></article>
    <article><span>WhatsApp Ready</span><strong>{Number(s.whatsapp_ready||0).toLocaleString("id-ID")}</strong></article>
    <article><span>Social Ready</span><strong>{Number(s.social_ready||0).toLocaleString("id-ID")}</strong></article>
    <article><span>Missing Contact</span><strong>{Number(s.missing_all||0).toLocaleString("id-ID")}</strong></article>
    <article className={Number(s.blocked_due_7d||0)>0?"warn":""}><span>Blocked ≤ 7 Hari</span><strong>{Number(s.blocked_due_7d||0).toLocaleString("id-ID")}</strong></article>
   </div>
   {blocked.length>0&&<div className="lcr-blocked"><div className="lcr-title"><b>Follow-up terblokir</b><small>Channel yang dipilih belum punya contact data yang sesuai.</small></div>{blocked.slice(0,12).map((x:Row)=><button key={x.id} onClick={()=>open(x)}><div><strong>{x.creator_name||"Creator"}</strong><small>{[x.follow_up_channel,x.platform,x.product_name||x.sku].filter(Boolean).join(" · ")}</small></div><span>{x.next_follow_up_at?new Date(x.next_follow_up_at).toLocaleString("id-ID"):"-"}</span></button>)}</div>}
  </>}
 </section>
}
