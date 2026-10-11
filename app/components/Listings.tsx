"use client";

import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {createClient} from "../../lib/supabase-browser";
import {CreatorAutocomplete,ProductAutocomplete,CreatorSearchResult,ProductSearchResult,resolveOrCreateCreator} from "./SmartAutocomplete";
import ListingFollowupInsights from "./ListingFollowupInsights";
import ListingFollowupQueue from "./ListingFollowupQueue";
import ListingFollowupCalendar from "./ListingFollowupCalendar";
import ListingQuickMessage from "./ListingQuickMessage";
import ListingContactReadiness from "./ListingContactReadiness";
import "../listing-contacts.css";

type Creator={
  id:number;creator_code:string|null;name:string|null;username:string|null;platform:string|null;
  affiliate_id:string|null;phone:string|null;payment_type:string|null;ratecard:number|null;status:string|null;
  profile_url?:string|null;avatar_url?:string|null;social_links?:Record<string,string>|null;social_profile_updated_at?:string|null;
};
type Product={id:number;sku:string;product_name:string|null;category:string|null;cost_price:number|null};
type FollowupOwner={id:string;safe_label:string;is_self:boolean};
type ChannelContact={id:number;creator_id:number;channel:string;phone:string|null;handle:string|null;url:string|null;note:string|null;is_primary:boolean};
type Listing={
  id:number;data_date:string|null;creator_id:number|null;creator_name:string|null;platform:string|null;
  product_master_id:number|null;product_name:string|null;sku:string|null;product_hpp:number|null;stage:string|null;
  payment_type:string|null;ratecard:number;posting_date:string|null;post_link:string|null;next_action:string|null;
  agreement_id:string|null;program_id:string|null;follow_up_channel:string|null;next_follow_up_at:string|null;follow_up_priority:string|null;follow_up_completed_at:string|null;follow_up_owner_user_id:string|null;notes:string|null;
};
type Activity={
  id:number;listing_id:number;creator_id:number|null;activity_date:string;activity_type:string;
  result:string|null;note:string|null;follow_up_channel:string|null;created_at:string;
};
type FormState={
  data_date:string;creator_id:string;creator_name:string;platform:string;product_master_id:string;product_hpp:string;
  stage:string;payment_type:string;ratecard:string;posting_date:string;post_link:string;next_action:string;agreement_id:string;program_id:string;follow_up_channel:string;next_follow_up_at:string;follow_up_priority:string;follow_up_owner_user_id:string;notes:string;
};

const FOLLOW_UP_CHANNELS=["WhatsApp","DM Instagram","DM TikTok","Email","Telepon","Shopee Chat","TikTok Shop Chat","Agency / PIC","Offline","Lainnya"];
const STAGES=["New Lead","Reach Out","Follow Up","Negotiation","Sample Sent","Content In Progress","Uploaded","Live","Won / Active","Lost / Inactive"];
const ACTIVITY_TYPES=["Listing dibuat","Reach Out","Follow Up","Negotiation","Kirim Sample","Sample Received","Take Video","Video Upload","Live","Deal","Rejected","No Response","Catatan"];
const ACTIVITY_STAGE:Record<string,string>={
  "Reach Out":"Reach Out","Follow Up":"Follow Up","Negotiation":"Negotiation","Kirim Sample":"Sample Sent",
  "Sample Received":"Content In Progress","Take Video":"Content In Progress","Video Upload":"Uploaded","Live":"Live",
  "Deal":"Won / Active","Rejected":"Lost / Inactive","No Response":"Follow Up",
};
const EMPTY_FORM:FormState={data_date:"",creator_id:"",creator_name:"",platform:"",product_master_id:"",product_hpp:"0",stage:"Sample Sent",payment_type:"",ratecard:"",posting_date:"",post_link:"",next_action:"",agreement_id:"",program_id:"",follow_up_channel:"",next_follow_up_at:"",follow_up_priority:"normal",follow_up_owner_user_id:"",notes:""};
const toLocalInput=(value:string|null)=>{if(!value)return"";const d=new Date(value);const off=d.getTimezoneOffset();return new Date(d.getTime()-off*60000).toISOString().slice(0,16)};
const money=(value:any)=>"Rp "+new Intl.NumberFormat("id-ID",{maximumFractionDigits:0}).format(Number(value||0));
const dateLabel=(value:string|null)=>value?new Date(value+"T00:00:00").toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}):"-";
const phoneDigits=(value:string|null|undefined)=>String(value||"").replace(/\D/g,"");
const intlPhone=(value:string|null|undefined)=>{const digits=phoneDigits(value);if(!digits)return"";return digits.startsWith("0")?"62"+digits.slice(1):digits.startsWith("8")?"62"+digits:digits};
const SOCIAL_FIELDS=[
  ["instagram","Instagram"],["tiktok","TikTok"],["facebook","Facebook"],["lemon8","Lemon8"],
  ["youtube","YouTube"],["threads","Threads"],["x","X / Twitter"],["other","Lainnya"]
] as const;
const emptySocial=()=>Object.fromEntries(SOCIAL_FIELDS.map(([key])=>[key,""])) as Record<string,string>;

function stageTone(stage:string|null){
  const value=String(stage||"New Lead").toLowerCase();
  if(value.includes("won")||value==="live"||value.includes("uploaded"))return"success";
  if(value.includes("lost"))return"danger";
  if(value.includes("sample")||value.includes("content")||value.includes("negotiation"))return"warning";
  if(value.includes("follow")||value.includes("reach"))return"info";
  return"neutral";
}

function splitPostLinks(value:string|null|undefined){
  if(!value)return[];
  const parts=String(value).split(/[\r\n]+/).flatMap(part=>String(part).split(/[\s,;]+/));
  const cleaned=parts.map(s=>s.trim()).filter(Boolean).map(s=>{
    if(/^https?:\/\//i.test(s))return s;
    if(s.includes(".")&&!s.includes(" "))return`https://${s}`;
    return s;
  });
  return[...new Set(cleaned)];
}
function normalizePostLinksInput(value:string){
  return splitPostLinks(value).join("\n");
}
function scrollToListingEditor(){
  setTimeout(()=>{try{document.querySelector(".listing-v2-editor")?.scrollIntoView({behavior:"smooth",block:"start"})}catch{}},60);
}

export default function Listings({workspaceId}:{workspaceId:string}){
  const supabase=useMemo(()=>createClient(),[]);
  const [rows,setRows]=useState<Listing[]>([]);
  const [creators,setCreators]=useState<Creator[]>([]);
  const [products,setProducts]=useState<Product[]>([]);
  const [followupOwners,setFollowupOwners]=useState<FollowupOwner[]>([]);
  const [agreements,setAgreements]=useState<{id:number;agreement_id:string|null;creator_id:number|null;document_status:string|null;program_id:string|null}[]>([]);
  const [supportPrograms,setSupportPrograms]=useState<{id:string;program_name:string;status:string}[]>([]);
  const [channelContacts,setChannelContacts]=useState<ChannelContact[]>([]);
  const [channelChoices,setChannelChoices]=useState<string[]>(FOLLOW_UP_CHANNELS);
  const [selfName,setSelfName]=useState("");
  const [masterCreators,setMasterCreators]=useState<Creator[]>([]);
  const [masterCreatorSearch,setMasterCreatorSearch]=useState("");
  const [masterCreatorPage,setMasterCreatorPage]=useState(1);
  const [masterCreatorTotal,setMasterCreatorTotal]=useState(0);
  const [resolvedContacts,setResolvedContacts]=useState<Record<string,Creator>>({});
  const resolvedByKeyRef=useRef<Set<string>>(new Set());

  const [search,setSearch]=useState("");
  const [platformFilter,setPlatformFilter]=useState("");
  const [stageFilter,setStageFilter]=useState("");
  const [channelFilter,setChannelFilter]=useState("");
  const [dateStart,setDateStart]=useState("");
  const [dateEnd,setDateEnd]=useState("");

  const [form,setForm]=useState<FormState>(EMPTY_FORM);
  const [creatorSearch,setCreatorSearch]=useState("");
  const [productSearch,setProductSearch]=useState("");
  const [manualCreatorConfirmed,setManualCreatorConfirmed]=useState(false);
  const [editingId,setEditingId]=useState<number|null>(null);
  const [showForm,setShowForm]=useState(false);

  const [selected,setSelected]=useState<Listing|null>(null);
  const [selectedCreator,setSelectedCreator]=useState<Creator|null>(null);
  const [activities,setActivities]=useState<Activity[]>([]);
  const [activityFor,setActivityFor]=useState<Listing|null>(null);
  const [activityForm,setActivityForm]=useState({activity_date:new Date().toISOString().slice(0,10),activity_type:"Follow Up",follow_up_channel:"",next_follow_up_at:"",result:"",note:""});

  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [detailLoading,setDetailLoading]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [socialOpen,setSocialOpen]=useState(false);
  const [socialSaving,setSocialSaving]=useState(false);
  const [socialForm,setSocialForm]=useState<Record<string,string>>(emptySocial());
  const [avatarInput,setAvatarInput]=useState("");
  const [contactEditingId,setContactEditingId]=useState<number|null>(null);
  const [contactFormOpen,setContactFormOpen]=useState(false);
  const [contactDraft,setContactDraft]=useState({channel:"WhatsApp",phone:"",handle:"",url:"",note:"",is_primary:true});
  const [channelContactsMissing,setChannelContactsMissing]=useState(false);

  async function loadData(){
    setLoading(true);setError("");
    const [listingResult,creatorResult,productResult,safeOwnerResult,channelContactResult,agreementsResult,programsResult]=await Promise.all([
      supabase.from("listings").select("id,data_date,creator_id,creator_name,platform,product_master_id,product_name,sku,product_hpp,stage,payment_type,ratecard,posting_date,post_link,next_action,agreement_id,program_id,follow_up_channel,next_follow_up_at,follow_up_priority,follow_up_completed_at,follow_up_owner_user_id,notes").eq("workspace_id",workspaceId).order("id",{ascending:false}),
      supabase.from("creators").select("id,creator_code,name,username,platform,affiliate_id,phone,payment_type,ratecard,status,profile_url,avatar_url,social_links,social_profile_updated_at").eq("workspace_id",workspaceId).order("name").limit(7770),
      supabase.from("product_master").select("id,sku,product_name,category,cost_price").eq("workspace_id",workspaceId).order("sku").limit(1000),
      supabase.rpc("luma_safe_workspace_assignees_v1",{p_workspace_id:workspaceId}),
      supabase.from("luma_channel_contacts").select("id,creator_id,channel,phone,handle,url,note,is_primary").eq("workspace_id",workspaceId).order("is_primary",{ascending:false}).order("channel"),
      supabase.from("agreements").select("id,agreement_id,creator_id,document_status,program_id").eq("workspace_id",workspaceId).order("id",{ascending:false}).limit(500),
      supabase.from("luma_affiliate_programs").select("id,program_name,status").eq("workspace_id",workspaceId).limit(150),
    ]);
    if(listingResult.error)setError(listingResult.error.message); else {
      const data=(listingResult.data||[]) as Listing[];
      setRows(data);
      setSelected(current=>current?data.find(x=>x.id===current.id)||data[0]||null:data[0]||null);
    }
    if(!creatorResult.error)setCreators((creatorResult.data||[]) as Creator[]);
    if(!productResult.error)setProducts((productResult.data||[]) as Product[]);
    if(!agreementsResult.error)setAgreements((agreementsResult.data||[]) as typeof agreements);
    if(!programsResult.error)setSupportPrograms((programsResult.data||[]) as typeof supportPrograms);
    if(!channelContactResult.error){setChannelContacts((channelContactResult.data||[]) as ChannelContact[]);setChannelContactsMissing(false)}else{const errCode=String(channelContactResult.error.code||"");const errMsg=String(channelContactResult.error.message||"");setChannelContactsMissing(errCode==="PGRST205"||errCode==="42P01"||/does not exist|schema cache|table .* not/i.test(errMsg))}
    if(!safeOwnerResult.error)setFollowupOwners((safeOwnerResult.data||[]).map((x:any)=>({id:String(x.user_id),safe_label:String(x.safe_label||"PIC"),is_self:Boolean(x.is_self)})));
    // Daftar kanal follow-up berasal dari database (luma_channel_contacts). Bila tabel belum ada, pakai daftar bawaan.
    if(!channelContactResult.error){
      const fromDb=(channelContactResult.data||[]).map((x:any)=>String(x.channel||"").trim()).filter(Boolean);
      setChannelChoices([...new Set([...FOLLOW_UP_CHANNELS,...fromDb])]);
    }
    try{
      const {data:{user}}=await supabase.auth.getUser();
      if(user?.id){
        const profileResult=await supabase.from("profiles").select("full_name,nickname,email").eq("id",user.id).maybeSingle();
        const metaName=String(user.user_metadata?.full_name||user.user_metadata?.name||user.user_metadata?.nickname||"").trim();
        const profileName=String(profileResult.data?.full_name||profileResult.data?.nickname||metaName||profileResult.data?.email?.split("@")[0]||"").trim();
        setSelfName(profileName);
        // PIC "diri sendiri" memakai nama profil asli, bukan label statis "Saya".
        const selfLabel=profileName&&profileName.toLowerCase()!=="saya"?profileName:null;
        if(selfLabel){
          setFollowupOwners(prev=>prev.some(x=>x.is_self)
            ?prev.map(x=>x.is_self?{...x,safe_label:selfLabel}:x)
            :[{id:String(user.id),safe_label:selfLabel,is_self:true},...prev]);
        }
      }
    }catch{}
    setLoading(false);
  }

  async function loadMasterCreators(targetPage=1,query=masterCreatorSearch){
    const params=new URLSearchParams({workspace_id:workspaceId,page:String(targetPage),page_size:"100"});
    if(query.trim())params.set("q",query.trim());
    const response=await fetch(`/api/master-data/creators?${params.toString()}`,{cache:"no-store"});
    const data=await response.json();
    if(!response.ok||!data.ok){setError(data.error||"Gagal memuat Master Creator.");return}
    setMasterCreators((data.results||[]) as Creator[]);
    setMasterCreatorTotal(Number(data.total||0));
    setMasterCreatorPage(Number(data.page||targetPage));
  }

  async function loadSelectedDetail(row:Listing|null){
    if(!row){setActivities([]);setSelectedCreator(null);return}
    setDetailLoading(true);
    const activitiesResult=await supabase.from("listing_activities")
      .select("id,listing_id,creator_id,activity_date,activity_type,follow_up_channel,result,note,created_at")
      .eq("workspace_id",workspaceId).eq("listing_id",row.id)
      .order("activity_date",{ascending:false}).order("id",{ascending:false});
    if(activitiesResult.error)setError(activitiesResult.error.message);
    else setActivities((activitiesResult.data||[]) as Activity[]);

    let creator=creators.find(x=>x.id===row.creator_id)||resolveCreatorFromIndex(row)||(row.creator_name?resolvedContacts[String(row.creator_name).trim().toLowerCase()]:undefined)||null;
    if(!creator&&row.creator_name){
      try{
        const params=new URLSearchParams({workspace_id:workspaceId,page:"1",page_size:"25",q:row.creator_name});
        const response=await fetch(`/api/master-data/creators?${params.toString()}`,{cache:"no-store"});
        const data=await response.json();
        if(response.ok&&data.ok){
          creator=(data.results||[]).find((x:Creator)=>x.id===row.creator_id)||(data.results||[])[0]||null;
        }
      }catch{}
    }
    setSelectedCreator(creator);
    setDetailLoading(false);
  }

  const contactsForCreator=useCallback((creatorId:number|null|undefined)=>
    creatorId?channelContacts.filter(contact=>contact.creator_id===creatorId):[],[channelContacts]);

  function primaryContact(creator:Creator|null|undefined, channel="WhatsApp"){
    const contact=contactsForCreator(creator?.id).find(item=>item.channel===channel&&item.is_primary)
      ||contactsForCreator(creator?.id).find(item=>item.channel===channel);
    return contact||null;
  }

  async function saveChannelContact(input:{id?:number;channel:string;phone:string;handle:string;url:string;note:string;is_primary:boolean}){
    if(!selectedCreator){setError("Hubungkan listing ke Master Creator sebelum menambah kontak.");return}
    if(!input.channel.trim()){setError("Channel kontak wajib dipilih.");return}
    setSaving(true);setError("");setMessage("");
    const now=new Date().toISOString();
    const payload={workspace_id:workspaceId,creator_id:selectedCreator.id,channel:input.channel.trim(),phone:input.phone.trim()||null,handle:input.handle.trim()||null,url:input.url.trim()||null,note:input.note.trim()||null,is_primary:input.is_primary,updated_at:now};
    if(input.is_primary){
      const clearPrimary=await supabase.from("luma_channel_contacts").update({is_primary:false,updated_at:now}).eq("workspace_id",workspaceId).eq("creator_id",selectedCreator.id).eq("channel",input.channel.trim()).neq("id",input.id||0);
      if(clearPrimary.error){setSaving(false);const errCode=String(clearPrimary.error.code||"");setError(errCode==="PGRST205"||errCode==="42P01"?"Tabel kontak channel belum tersedia di database. Minta admin menjalankan supabase/PR88_CHANNEL_CONTACTS_APPLY_READY.sql di SQL Editor, lalu coba lagi.":clearPrimary.error.message);return}
    }
    const result=input.id
      ?await supabase.from("luma_channel_contacts").update(payload).eq("id",input.id).eq("workspace_id",workspaceId).select("id,creator_id,channel,phone,handle,url,note,is_primary").single()
      :await supabase.from("luma_channel_contacts").insert({...payload,created_by:(await supabase.auth.getUser()).data.user?.id||null}).select("id,creator_id,channel,phone,handle,url,note,is_primary").single();
    if(result.error){setSaving(false);const errCode=String(result.error.code||"");setError(errCode==="PGRST205"||errCode==="42P01"?"Tabel kontak channel belum tersedia di database. Minta admin menjalankan supabase/PR88_CHANNEL_CONTACTS_APPLY_READY.sql di SQL Editor, lalu coba lagi.":result.error.message);return}
    const saved=result.data as ChannelContact;
    setChannelContacts(prev=>{
      const next=input.id?prev.map(item=>item.id===input.id?(input.is_primary?{...saved}:saved):item):[saved,...prev];
      return input.is_primary?next.map(item=>item.id===saved.id?item:item.channel===saved.channel&&item.creator_id===saved.creator_id?{...item,is_primary:false}:item):next;
    });
    setContactEditingId(null);setContactFormOpen(false);setContactDraft({channel:"WhatsApp",phone:"",handle:"",url:"",note:"",is_primary:true});
    setSaving(false);setMessage("Kontak channel tersimpan.");
  }

  async function deleteChannelContact(id:number){
    if(!window.confirm("Hapus kontak channel ini?"))return;
    const result=await supabase.from("luma_channel_contacts").delete().eq("id",id).eq("workspace_id",workspaceId);
    if(result.error){const errCode=String(result.error.code||"");setError(errCode==="PGRST205"||errCode==="42P01"?"Tabel kontak channel belum tersedia di database. Minta admin menjalankan supabase/PR88_CHANNEL_CONTACTS_APPLY_READY.sql di SQL Editor, lalu coba lagi.":result.error.message);return}
    setChannelContacts(prev=>prev.filter(item=>item.id!==id));setMessage("Kontak channel dihapus.");
  }

  useEffect(()=>{void loadData();void loadMasterCreators(1,"")},[workspaceId]);
  useEffect(()=>{void loadSelectedDetail(selected)},[selected?.id,workspaceId]);
  useEffect(()=>{if(!socialOpen&&!activityFor)return;const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape"){setSocialOpen(false);setActivityFor(null)}};window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey)},[socialOpen,activityFor]);
  useEffect(()=>{
    const refresh=()=>{void loadData();void loadMasterCreators(1,masterCreatorSearch)};
    window.addEventListener("lumaway-database-updated",refresh as EventListener);
    return()=>window.removeEventListener("lumaway-database-updated",refresh as EventListener);
  },[workspaceId,masterCreatorSearch]);

  useEffect(()=>{
    const onQuick=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail?.type==="listing")openAdd()};
    const onSelect=(event:Event)=>{
      const detail=(event as CustomEvent).detail;
      if(detail?.type==="listing"){
        const row=rows.find(item=>item.id===Number(detail.id));if(row){setSelected(row);setSearch(row.creator_name||row.product_name||String(detail.title||""))}
      }else if(detail?.type==="creator"){
        const row=rows.find(item=>item.creator_id===Number(detail.id))||rows.find(item=>String(item.creator_name||"").toLowerCase()===String(detail.title||"").toLowerCase());
        setSearch(String(detail.title||""));if(row)setSelected(row);
      }
    };
    window.addEventListener("lumaway-quick-create",onQuick as EventListener);window.addEventListener("lumaway-global-select",onSelect as EventListener);
    return()=>{window.removeEventListener("lumaway-quick-create",onQuick as EventListener);window.removeEventListener("lumaway-global-select",onSelect as EventListener)};
  },[rows]);

  function updateField(field:keyof FormState,value:string){setForm(prev=>({...prev,[field]:value}))}

  function openAdd(){
    setEditingId(null);setForm({...EMPTY_FORM,data_date:new Date().toISOString().slice(0,10)});
    setCreatorSearch("");setProductSearch("");setManualCreatorConfirmed(false);setError("");setShowForm(true);
    scrollToListingEditor();
  }

  function openEdit(row:Listing){
    setEditingId(row.id);
    setForm({
      data_date:row.data_date||"",creator_name:row.creator_name||"",creator_id:row.creator_id?.toString()||"",
      platform:row.platform||"",product_master_id:row.product_master_id?.toString()||"",product_hpp:String(row.product_hpp||0),
      stage:row.stage||"New Lead",payment_type:row.payment_type||"",ratecard:row.ratecard?.toString()||"",
      posting_date:row.posting_date||"",post_link:row.post_link||"",next_action:row.next_action||"",
      agreement_id:row.agreement_id||"",program_id:row.program_id||"",follow_up_channel:row.follow_up_channel||"",next_follow_up_at:toLocalInput(row.next_follow_up_at),follow_up_priority:row.follow_up_priority||"normal",follow_up_owner_user_id:row.follow_up_owner_user_id||"",notes:row.notes||"",
    });
    setCreatorSearch(row.creator_name||"");setProductSearch(row.sku||row.product_name||"");setManualCreatorConfirmed(!row.creator_id&&Boolean(row.creator_name));
    setError("");setShowForm(true);
    scrollToListingEditor();
  }

  async function saveListing(){
    setSaving(true);setError("");setMessage("");
    let creator=creators.find(item=>item.id===Number(form.creator_id));
    if(!creator&&(form.creator_name.trim()||creatorSearch.trim())){
      if(!form.platform.trim()){setSaving(false);return setError("Pilih platform terlebih dahulu untuk creator baru.")}
      try{
        const resolved=await resolveOrCreateCreator(workspaceId,form.creator_name.trim()||creatorSearch.trim(),form.platform);
        if(resolved){creator=resolved as Creator;setCreators(prev=>prev.some(x=>x.id===resolved.id)?prev:[resolved as Creator,...prev])}
      }catch(err){setSaving(false);return setError(err instanceof Error?err.message:"Gagal membuat creator baru.")}
    }
    const product=products.find(item=>item.id===Number(form.product_master_id));
    const editingRow=editingId===null?null:rows.find(item=>item.id===editingId);
    const payload={
      workspace_id:workspaceId,data_date:form.data_date||null,creator_id:creator?.id??(form.creator_id?Number(form.creator_id):null),
      creator_name:form.creator_name.trim()||creator?.name||creator?.username||creator?.creator_code||null,
      platform:form.platform||creator?.platform||null,product_master_id:form.product_master_id?Number(form.product_master_id):null,
      product_name:product?.product_name??editingRow?.product_name??null,sku:product?.sku??editingRow?.sku??null,product_hpp:product?.cost_price!=null?Number(product.cost_price):Number(form.product_hpp||editingRow?.product_hpp||0),
      stage:form.stage||editingRow?.stage||"Sample Sent",payment_type:form.payment_type||null,ratecard:form.ratecard?Number(form.ratecard):Number(creator?.ratecard??editingRow?.ratecard??0),
      posting_date:form.posting_date||null,post_link:normalizePostLinksInput(form.post_link)||null,next_action:form.next_action||null,agreement_id:form.agreement_id||null,program_id:form.program_id||null,follow_up_channel:form.follow_up_channel||null,next_follow_up_at:form.next_follow_up_at?new Date(form.next_follow_up_at).toISOString():null,follow_up_priority:form.follow_up_priority||"normal",follow_up_owner_user_id:form.follow_up_owner_user_id||null,follow_up_completed_at:form.next_follow_up_at?null:null,notes:form.notes||null,
    };

    if(editingId!==null){
      const result=await supabase.from("listings").update(payload).eq("id",editingId).eq("workspace_id",workspaceId);
      if(result.error){setSaving(false);return setError(result.error.message)}
    }else{
      const result=await supabase.from("listings").insert(payload).select("id").single();
      if(result.error){setSaving(false);return setError(result.error.message)}
      if(result.data?.id){
        const {data:{user}}=await supabase.auth.getUser();
        await supabase.from("listing_activities").insert({
          workspace_id:workspaceId,listing_id:result.data.id,creator_id:payload.creator_id,
          activity_date:payload.data_date||new Date().toISOString().slice(0,10),activity_type:"Listing dibuat",
          result:payload.stage,follow_up_channel:payload.follow_up_channel,note:payload.notes,created_by:user?.id||null,
        });
      }
    }
    setSaving(false);setShowForm(false);setEditingId(null);setForm(EMPTY_FORM);setCreatorSearch("");setProductSearch("");setManualCreatorConfirmed(false);
    setMessage(editingId!==null?"Listing diperbarui.":"Listing berhasil ditambahkan.");window.dispatchEvent(new Event("lumaway-database-updated"));await loadData();
  }

  async function deleteListing(id:number){
    if(!window.confirm("Hapus listing ini beserta history aktivitasnya?"))return;
    const result=await supabase.from("listings").delete().eq("id",id).eq("workspace_id",workspaceId);
    if(result.error)return setError(result.error.message);
    setMessage("Listing dihapus.");if(selected?.id===id)setSelected(null);window.dispatchEvent(new Event("lumaway-database-updated"));await loadData();
  }

  function openActivity(row:Listing,type="Follow Up"){
    setActivityFor(row);setActivityForm({activity_date:new Date().toISOString().slice(0,10),activity_type:type,follow_up_channel:row.follow_up_channel||"",next_follow_up_at:"",result:"",note:""});
  }

  // Klik WhatsApp: buka panel compose (komentar + nomor) sebelum mengirim, bukan langsung lompat.
  function openWaComposer(row:Listing){
    setSelected(row);
    setTimeout(()=>{try{document.querySelector(".listing-quick-message")?.scrollIntoView({behavior:"smooth",block:"start"})}catch{}},90);
  }

  async function saveActivity(){
    if(!activityFor)return;
    setSaving(true);setError("");
    const {data:{user}}=await supabase.auth.getUser();
    const insert=await supabase.from("listing_activities").insert({
      workspace_id:workspaceId,listing_id:activityFor.id,creator_id:activityFor.creator_id,
      activity_date:activityForm.activity_date,activity_type:activityForm.activity_type,
      follow_up_channel:activityForm.follow_up_channel||null,result:activityForm.result.trim()||null,note:activityForm.note.trim()||null,created_by:user?.id||null,
    });
    if(insert.error){setSaving(false);return setError(insert.error.message)}
    const mappedStage=ACTIVITY_STAGE[activityForm.activity_type];
    if(mappedStage){
      const terminal=["Won / Active","Lost / Inactive"].includes(mappedStage);
      const update=await supabase.from("listings").update({
        stage:mappedStage,
        next_action:activityForm.result.trim()||activityFor.next_action||null,
        follow_up_channel:activityForm.follow_up_channel||activityFor.follow_up_channel||null,
        next_follow_up_at:terminal?null:(activityForm.next_follow_up_at?new Date(activityForm.next_follow_up_at).toISOString():activityFor.next_follow_up_at||null),
        follow_up_completed_at:terminal?new Date().toISOString():(activityForm.next_follow_up_at?null:activityFor.follow_up_completed_at||null),
        updated_at:new Date().toISOString(),
      }).eq("workspace_id",workspaceId).eq("id",activityFor.id);
      if(update.error){setSaving(false);return setError(update.error.message)}
    }
    setSaving(false);setMessage("Aktivitas creator ditambahkan.");setActivityFor(null);window.dispatchEvent(new Event("lumaway-database-updated"));await loadData();
  }

  function openSocialProfile(){
    if(!selectedCreator){setError("Creator belum terhubung ke Master Creator.");return}
    const links=selectedCreator.social_links&&typeof selectedCreator.social_links==="object"?selectedCreator.social_links:{};
    setSocialForm({...emptySocial(),...links});
    setAvatarInput(selectedCreator.avatar_url||"");
    setError("");setMessage("");setSocialOpen(true);
  }

  async function saveSocialProfile(){
    if(!selectedCreator)return;
    setSocialSaving(true);setError("");setMessage("");
    try{
      const response=await fetch("/api/social-profile/resolve",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          workspace_id:workspaceId,
          creator_id:selectedCreator.id,
          links:socialForm,
          avatar_url:avatarInput.trim()||null
        })
      });
      const result=await response.json();
      if(!response.ok||!result.ok)throw new Error(result.error||"Gagal menyimpan profil sosial.");
      const updated:Creator={...selectedCreator,...result.creator};
      setSelectedCreator(updated);
      setCreators(prev=>prev.map(item=>item.id===updated.id?{...item,...updated}:item));
      setMasterCreators(prev=>prev.map(item=>item.id===updated.id?{...item,...updated}:item));
      setSocialOpen(false);
      setMessage(result.warning||"Link sosial dan foto profil creator diperbarui.");
    }catch(err:any){
      setError(err?.message||"Gagal menyimpan profil sosial.");
    }finally{setSocialSaving(false)}
  }

  const platforms=useMemo(()=>[...new Set(rows.map(x=>x.platform).filter(Boolean) as string[])].sort(),[rows]);
  const creatorIndex=useMemo(()=>{
    const map=new Map<string,Creator>();
    for(const creator of [...creators,...masterCreators]){
      const keys=[creator.id!=null?String(creator.id):"",String(creator.username||""),String(creator.name||"")];
      for(const key of keys){const normalized=key.trim().toLowerCase();if(normalized&&!map.has(normalized))map.set(normalized,creator)}
    }
    return map;
  },[creators,masterCreators]);
  const resolveCreatorFromIndex=useCallback((row:Listing):Creator|undefined=>
    (row.creator_id!=null?creatorIndex.get(String(row.creator_id)):undefined)
    ||creatorIndex.get(String(row.creator_name||"").trim().toLowerCase())
  ,[creatorIndex]);
  const resolveCreator=useCallback((row:Listing):Creator|undefined=>
    resolveCreatorFromIndex(row)
    ||(row.creator_name?resolvedContacts[String(row.creator_name).trim().toLowerCase()]:undefined)
  ,[resolveCreatorFromIndex,resolvedContacts]);
  const visibleRows=useMemo(()=>rows.filter(row=>{
    const q=search.trim().toLowerCase();
    if(platformFilter&&row.platform!==platformFilter)return false;
    if(stageFilter&&(row.stage||"New Lead")!==stageFilter)return false;
    if(channelFilter&&(row.follow_up_channel||"")!==channelFilter)return false;
    if(dateStart&&String(row.data_date||"")<dateStart)return false;
    if(dateEnd&&String(row.data_date||"")>dateEnd)return false;
    if(!q)return true;
    const rowCreator=resolveCreator(row);
    const rowContact=contactsForCreator(rowCreator?.id).find(item=>item.channel==="WhatsApp"&&item.is_primary)
      ||contactsForCreator(rowCreator?.id).find(item=>item.channel==="WhatsApp");
    const rowPhone=rowContact?.phone||rowCreator?.phone||null;
    const textMatch=[row.creator_name,row.product_name,row.sku,row.platform,row.stage,row.payment_type,row.next_action,row.follow_up_channel,rowPhone,rowCreator?.affiliate_id,rowCreator?.username].filter(Boolean).some(value=>String(value).toLowerCase().includes(q));
    if(textMatch)return true;
    // Cari berdasarkan nomor WA walau formatnya beda (spasi, +, 0 vs 62).
    const qDigits=q.replace(/\D/g,"");
    const rowPhoneDigits=phoneDigits(rowPhone);
    return qDigits.length>=3&&rowPhoneDigits.includes(qDigits);
  }),[rows,search,platformFilter,stageFilter,channelFilter,dateStart,dateEnd,resolveCreator,channelContacts]);

  // Defensive contact enrichment (PR87): lengkapi kontak creator untuk listing tanpa creator_id.
  // Bila RPC belum tersedia (migrasi belum diterapkan), error diabaikan tanpa efek samping.
  useEffect(()=>{
    const seen=new Set<string>();
    const pending=visibleRows.filter(row=>{
      if(row.creator_id!=null)return false;
      if(resolveCreatorFromIndex(row))return false;
      const name=String(row.creator_name||"").trim();
      if(!name)return false;
      const key=workspaceId+"::"+name.toLowerCase();
      if(resolvedByKeyRef.current.has(key)||seen.has(key))return false;
      seen.add(key);return true;
    }).slice(0,40);
    if(!pending.length)return;
    let cancelled=false;
    void (async()=>{
      const updates:Record<string,Creator>={};
      await Promise.all(pending.map(async row=>{
        const name=String(row.creator_name||"").trim();
        const key=workspaceId+"::"+name.toLowerCase();
        try{
          const {data,error}=await supabase.rpc("luma_resolve_listing_creator_v1",{p_workspace_id:workspaceId,p_creator_id:row.creator_id??null,p_creator_name:name});
          if(error)return;
          const found:any=Array.isArray(data)?data[0]:data;
          if(!found||found.id==null)return;
          resolvedByKeyRef.current.add(key);
          updates[name.toLowerCase()]={id:Number(found.id),creator_code:found.creator_code??null,name:found.name??null,username:found.username??null,platform:found.platform??null,affiliate_id:found.affiliate_id??null,phone:found.phone??null,payment_type:null,ratecard:null,status:null,avatar_url:found.avatar_url??null};
        }catch{}
      }));
      if(cancelled)return;
      if(Object.keys(updates).length)setResolvedContacts(prev=>({...prev,...updates}));
    })();
    return()=>{cancelled=true};
  },[visibleRows,workspaceId,supabase,resolveCreatorFromIndex]);

  // Tampilkan kontak hasil resolusi pada panel detail listing yang belum ter-link.
  useEffect(()=>{
    if(!selected||(selectedCreator&&selectedCreator.id))return;
    const name=String(selected.creator_name||"").trim().toLowerCase();
    if(name&&resolvedContacts[name])setSelectedCreator(prev=>prev??resolvedContacts[name]);
  },[resolvedContacts,selected,selectedCreator]);

  const stats=useMemo(()=>({
    total:rows.length,
    followup:rows.filter(x=>["Reach Out","Follow Up","Negotiation"].includes(x.stage||"")).length,
    sample:rows.filter(x=>String(x.stage||"").toLowerCase().includes("sample")).length,
    active:rows.filter(x=>["Uploaded","Live","Won / Active"].includes(x.stage||"")).length,
  }),[rows]);

  const masterCreatorPages=Math.max(1,Math.ceil(masterCreatorTotal/100));
  const creatorName=selectedCreator?.name||selectedCreator?.username||selected?.creator_name||"Creator";
  const initials=creatorName.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase()||"C";
  const selectedSocialLinks=Object.entries(selectedCreator?.social_links||{}).filter(([,url])=>Boolean(String(url||"").trim()));
  const picLabel=(ownerId:string|null|undefined)=>{
    if(!ownerId)return null;
    const owner=followupOwners.find(x=>x.id===ownerId);
    if(!owner)return null;
    if(owner.is_self){
      const self=String(selfName||"").trim();
      if(self&&self.toLowerCase()!=="saya")return self;
      return owner.safe_label&&owner.safe_label.toLowerCase()!=="saya"?owner.safe_label:null;
    }
    return owner.safe_label;
  };
  const waHref=(phone:string|null|undefined)=>{
    const intl=intlPhone(phone);
    return intl?"https://wa.me/"+intl:null;
  };
  const contactForRow=(row:Listing)=>{
    const creator=resolveCreator(row);const contact=primaryContact(creator);
    return {creator,phone:contact?.phone||creator?.phone||null};
  };
  const selectedContacts=contactsForCreator(selectedCreator?.id);
  function startContactEdit(contact?:ChannelContact){
    setContactEditingId(contact?.id||null);
    setContactFormOpen(true);
    setContactDraft({channel:contact?.channel||"WhatsApp",phone:contact?.phone||"",handle:contact?.handle||"",url:contact?.url||"",note:contact?.note||"",is_primary:contact?.is_primary??true});
  }

  return <section id="listings" className="legacy-page-anchor listing-v2-page">
    <header className="listing-v2-header">
      <div><span>CREATOR OPERATIONS</span><h2>Listings</h2><p>Kelola hasil listing, follow up, sample, konten, dan progres creator dalam satu workspace.</p></div>
      <button className="primary" onClick={openAdd}>+ Tambah Listing</button>
    </header>

    <div className="listing-v2-stats">
      <article><span>Total Listing</span><b>{stats.total.toLocaleString("id-ID")}</b></article>
      <article><span>Follow Up / Negotiation</span><b>{stats.followup.toLocaleString("id-ID")}</b></article>
      <article><span>Sample Sent</span><b>{stats.sample.toLocaleString("id-ID")}</b></article>
      <article><span>Uploaded / Live / Active</span><b>{stats.active.toLocaleString("id-ID")}</b></article>
    </div>

    {error&&<div className="listing-v2-alert error" role="alert">{error}</div>}
    {message&&<div className="listing-v2-alert success" role="status">{message}</div>}
    {channelContactsMissing&&<div className="listing-v2-contacts-banner" role="status"><b>Tabel kontak channel belum tersedia di database.</b>Minta admin menjalankan supabase/PR88_CHANNEL_CONTACTS_APPLY_READY.sql di SQL Editor, lalu refresh halaman ini.</div>}
    <ListingContactReadiness workspaceId={workspaceId}/>
    <ListingFollowupQueue workspaceId={workspaceId}/>
    <ListingFollowupCalendar workspaceId={workspaceId}/>
    <ListingFollowupInsights workspaceId={workspaceId} startDate={dateStart||undefined} endDate={dateEnd||undefined}/>

    {showForm&&<section className="listing-v2-editor">
      <div className="listing-v2-editor-head"><div><span>{editingId?"EDIT LISTING":"NEW LISTING"}</span><h3>{editingId?"Edit Listing":"Tambah Listing"}</h3><p>Creator baru otomatis terhubung ke Master Creator. HPP mengikuti Product Master.</p></div><button type="button" aria-label="Tutup editor listing" onClick={()=>{setShowForm(false);setEditingId(null)}}>×</button></div>
      <div className="listing-v2-form-grid">
        <label><span>Data Date</span><input type="date" value={form.data_date} onChange={e=>updateField("data_date",e.target.value)}/></label>
        <label><span>Creator</span><CreatorAutocomplete workspaceId={workspaceId} value={creatorSearch} selectedId={form.creator_id} createPlatform={form.platform}
          onTextChange={value=>{setCreatorSearch(value);setManualCreatorConfirmed(false);setForm(prev=>({...prev,creator_id:"",creator_name:value}))}}
          placeholder="Ketik username / nama creator…"
          onSelect={(creator:CreatorSearchResult)=>{const creatorName=creator.name||creator.username||creator.creator_code||"";setCreators(prev=>prev.some(x=>x.id===creator.id)?prev:[creator as Creator,...prev]);setForm(prev=>({...prev,creator_id:String(creator.id),creator_name:creatorName,platform:creator.platform||prev.platform,ratecard:String(creator.ratecard??prev.ratecard??"")}));setCreatorSearch(creatorName);setManualCreatorConfirmed(false)}}
          onCreate={value=>{setCreatorSearch(value);setManualCreatorConfirmed(true);setForm(prev=>({...prev,creator_id:"",creator_name:value}))}}/>
          {manualCreatorConfirmed&&!form.creator_id&&<small>Creator baru akan dibuat saat listing disimpan.</small>}
        </label>
        <label><span>Platform</span><select value={form.platform} onChange={e=>updateField("platform",e.target.value)}><option value="">Pilih Platform</option><option>TikTok</option><option>Shopee</option><option>Instagram</option><option>YouTube</option><option>Other</option></select></label>
        <label><span>Product / SKU</span><ProductAutocomplete workspaceId={workspaceId} value={productSearch} selectedId={form.product_master_id}
          onTextChange={value=>{setProductSearch(value);setForm(prev=>({...prev,product_master_id:"",product_hpp:"0"}))}}
          placeholder="Ketik SKU atau nama produk…"
          onSelect={(product:ProductSearchResult)=>{setProducts(prev=>prev.some(x=>x.id===product.id)?prev:[product as Product,...prev]);setForm(prev=>({...prev,product_master_id:String(product.id),product_hpp:String(product.cost_price||0)}));setProductSearch(`${product.sku}${product.product_name?` - ${product.product_name}`:""}`)}}/>
          {form.product_master_id&&<small>HPP otomatis: {money(form.product_hpp)}</small>}
        </label>
        <label><span>Stage</span><select value={form.stage} onChange={e=>updateField("stage",e.target.value)}>{STAGES.map(x=><option key={x}>{x}</option>)}</select></label>
        <label><span>Payment Type</span><input value={form.payment_type} onChange={e=>updateField("payment_type",e.target.value)} placeholder="Paid / Barter…"/></label>
        <label><span>Ratecard</span><input type="number" value={form.ratecard} onChange={e=>updateField("ratecard",e.target.value)} placeholder="0"/></label>
        <label><span>Posting Date</span><input type="date" value={form.posting_date} onChange={e=>updateField("posting_date",e.target.value)}/></label>
        <label className="wide"><span>Post Link / Link Konten <small>· bisa lebih dari 1, satu link per baris</small></span><textarea rows={3} value={form.post_link} onChange={e=>updateField("post_link",e.target.value)} placeholder={"https://tiktok.com/…\nhttps://shopee.co.id/…"} inputMode="url" autoComplete="off" spellCheck={false}/>{splitPostLinks(form.post_link).length>0&&<small>{splitPostLinks(form.post_link).length} link terdeteksi. Pisahkan dengan baris baru / koma / spasi.</small>}</label>
        <label><span>Next Action</span><input value={form.next_action} onChange={e=>updateField("next_action",e.target.value)} placeholder="Follow up / kirim brief…"/></label>
        <label><span>Follow Up Via</span><select value={form.follow_up_channel} onChange={e=>updateField("follow_up_channel",e.target.value)}><option value="">Pilih channel</option>{channelChoices.map(x=><option key={x}>{x}</option>)}</select><small>Channel utama / terakhir yang dipakai untuk komunikasi creator.</small></label>
        <label><span>Next Follow Up</span><input type="datetime-local" value={form.next_follow_up_at} onChange={e=>updateField("next_follow_up_at",e.target.value)}/><small>Jadwal tindak lanjut berikutnya.</small></label>
        <label><span>Priority</span><select value={form.follow_up_priority} onChange={e=>updateField("follow_up_priority",e.target.value)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
        <label><span>PIC Follow Up</span><select value={form.follow_up_owner_user_id} onChange={e=>updateField("follow_up_owner_user_id",e.target.value)}><option value="">Belum ditentukan</option>{followupOwners.map(x=><option key={x.id} value={x.id}>{picLabel(x.id)||x.safe_label}</option>)}</select><small>PIC menerima reminder in-app saat follow-up mendekati jatuh tempo.</small></label>
        <label><span>Agreement Creator</span><select value={form.agreement_id} onChange={e=>{
          const agreement=agreements.find(x=>x.agreement_id===e.target.value);
          setForm(p=>({...p,agreement_id:e.target.value,program_id:agreement?.program_id||p.program_id}));
        }}><option value="">Tanpa Agreement</option>{agreements.filter(x=>!form.creator_id||x.creator_id===Number(form.creator_id)).map(a=><option value={a.agreement_id||""} key={a.id}>{a.agreement_id} · {a.document_status}</option>)}</select>
        <small>Daftar berasal dari Agreement yang terhubung ke Master Creator.</small></label>
        <label><span>Program Reward / Challenge</span><select value={form.program_id} onChange={e=>updateField("program_id",e.target.value)}><option value="">Belum terhubung</option>{supportPrograms.map(p=><option key={p.id} value={p.id}>{p.program_name} · {p.status}</option>)}</select></label>
        <label className="wide"><span>Notes</span><textarea rows={3} value={form.notes} onChange={e=>updateField("notes",e.target.value)} placeholder="Catatan listing…"/></label>
      </div>
      <div className="listing-v2-editor-actions"><button className="secondary" onClick={()=>setShowForm(false)}>Batal</button><button className="primary" disabled={saving} onClick={()=>void saveListing()}>{saving?"Menyimpan…":"Simpan Listing"}</button></div>
    </section>}

    <div className="listing-v2-layout">
      <section className="listing-v2-main">
        <div className="listing-v2-section-head"><div><h3>Hasil Listing</h3><p>Aktivitas terbaru creator dan progres listing.</p></div><span aria-live="polite">{visibleRows.length.toLocaleString("id-ID")} hasil</span></div>
        <div className="listing-v2-toolbar listing-v2-toolbar-inline" role="search">
          <label className="listing-v2-search-label" htmlFor="listing-search"><span>Cari listing</span><input id="listing-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari creator, produk, SKU, platform, no WA, next action…" autoComplete="off" spellCheck={false}/></label>
          <select id="listing-platform-filter" aria-label="Filter platform" value={platformFilter} onChange={e=>setPlatformFilter(e.target.value)}><option value="">Semua Platform</option>{platforms.map(x=><option key={x}>{x}</option>)}</select>
          <select id="listing-stage-filter" aria-label="Filter stage" value={stageFilter} onChange={e=>setStageFilter(e.target.value)}><option value="">Semua Stage</option>{STAGES.map(x=><option key={x}>{x}</option>)}</select>
          <select id="listing-channel-filter" aria-label="Filter Follow Up Via" value={channelFilter} onChange={e=>setChannelFilter(e.target.value)}><option value="">Semua Follow Up Via</option>{channelChoices.map(x=><option key={x}>{x}</option>)}</select>
          <input id="listing-date-start" aria-label="Tanggal mulai" type="date" value={dateStart} onChange={e=>setDateStart(e.target.value)}/>
          <input id="listing-date-end" aria-label="Tanggal akhir" type="date" value={dateEnd} onChange={e=>setDateEnd(e.target.value)}/>
          {(search||platformFilter||stageFilter||channelFilter||dateStart||dateEnd)&&<button className="secondary" onClick={()=>{setSearch("");setPlatformFilter("");setStageFilter("");setChannelFilter("");setDateStart("");setDateEnd("")}}>Reset</button>}
        </div>
        {loading?<div className="listing-v2-empty" role="status">Memuat Listings…</div>:visibleRows.length===0?<div className="listing-v2-empty"><b>Belum ada hasil listing.</b><span>Tambahkan listing atau ubah filter pencarian.</span></div>:
        <div className="listing-v2-table-wrap"><table><thead><tr><th>Creator</th><th>Platform</th><th>Contact</th><th>No. WhatsApp</th><th>Follow Up Via</th><th>Product / SKU</th><th>Stage</th><th>Ratecard</th><th>Latest / Next</th><th>Action</th></tr></thead><tbody>
          {visibleRows.map(row=>{const rowContact=contactForRow(row);const rowCreator=rowContact.creator;const links=splitPostLinks(row.post_link);return <tr key={row.id} className={selected?.id===row.id?"selected":""} onClick={()=>setSelected(row)} tabIndex={0} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setSelected(row)}}}>
            <td><div className="listing-v2-creator-cell"><span className={rowCreator?.avatar_url?"has-photo":""}>{rowCreator?.avatar_url?<img src={rowCreator.avatar_url} alt="" width={32} height={32} loading="lazy" referrerPolicy="no-referrer"/>:String(row.creator_name||"C").slice(0,1).toUpperCase()}</span><div><b>{row.creator_name||"-"}</b><small>{dateLabel(row.data_date)}</small></div></div></td>
            <td><span className="listing-v2-platform">{row.platform||"-"}</span></td>
            <td><div className="listing-contact-mini">{rowCreator?.username?<small>@{rowCreator.username}</small>:<small>Belum ada social</small>}{rowCreator?.affiliate_id?<small>ID: {rowCreator.affiliate_id}</small>:null}</div></td>
            <td>{rowContact.phone&&waHref(rowContact.phone)?<a className="listing-wa-direct" href={waHref(rowContact.phone)||undefined} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}><span className="wa-mark">WA</span><b>{rowContact.phone}</b></a>:<small className="listing-wa-empty">Belum ada nomor</small>}</td>
            <td><div className="listing-followup-cell">{row.follow_up_channel?<span className="listing-channel-badge">{row.follow_up_channel}</span>:<small>Belum ditentukan</small>}</div></td>
            <td><b>{row.product_name||"-"}</b><small>{row.sku||"Tanpa SKU"}</small></td>
            <td><span className={"listing-v2-stage "+stageTone(row.stage)}>{row.stage||"New Lead"}</span></td>
            <td>{money(row.ratecard)}</td>
            <td><b>{row.next_action||"Belum ada next action"}</b><small>{row.posting_date?`Posting ${dateLabel(row.posting_date)}`:""}{links.length?` · ${links.length} link konten`:""}</small>{links.length>0&&<span className="listing-channel-badge">{links.length>1?`${links.length} link`:`1 link`}</span>}{row.follow_up_channel&&<span className="listing-channel-badge">{row.follow_up_channel}</span>}</td>
            <td><div className="listing-v2-actions" onClick={e=>e.stopPropagation()}>{rowContact.phone&&waHref(rowContact.phone)?<button className="wa-action" onClick={()=>openWaComposer(row)}><span className="wa-mark">WA</span>Chat WA</button>:null}<button onClick={()=>setSelected(row)}>Detail</button><button onClick={()=>openActivity(row,"Follow Up")}>+ Follow Up</button><button onClick={()=>openEdit(row)}>Edit</button><button className="danger" onClick={()=>void deleteListing(row.id)}>Hapus</button></div></td>
          </tr>})}
        </tbody></table></div>}
      </section>

      <aside className="listing-v2-detail">
        {!selected?<div className="listing-v2-empty"><b>Pilih listing</b><span>Detail creator dan timeline akan tampil di sini.</span></div>:<>
          <div className="listing-v2-profile">
            <div className={"listing-v2-avatar "+(selectedCreator?.avatar_url?"has-photo":"")}>{selectedCreator?.avatar_url?<img src={selectedCreator.avatar_url} alt={creatorName} width={44} height={44} referrerPolicy="no-referrer" onError={event=>{event.currentTarget.style.display="none"}}/>:initials}</div>
            <div><span>CUSTOMER 360</span><h3>{creatorName}</h3><p>@{selectedCreator?.username||selected.creator_name||"-"} · {selected.platform||selectedCreator?.platform||"-"}</p></div>
            <span className={"listing-v2-stage "+stageTone(selected.stage)}>{selected.stage||"New Lead"}</span>
          </div>
          <div className="listing-v2-profile-grid">
            <div><span>Affiliate ID</span><b>{selectedCreator?.affiliate_id||"-"}</b></div>
            <div><span>Ratecard</span><b>{money(selectedCreator?.ratecard??selected.ratecard)}</b></div>
            <div><span>WhatsApp</span>{waHref(primaryContact(selectedCreator)?.phone||selectedCreator?.phone)?<a className="listing-wa-direct" href={waHref(primaryContact(selectedCreator)?.phone||selectedCreator?.phone)||undefined} target="_blank" rel="noreferrer"><span className="wa-mark">WA</span><b>{primaryContact(selectedCreator)?.phone||selectedCreator?.phone}</b></a>:<b>-</b>}</div>
            <div><span>Payment</span><b>{selectedCreator?.payment_type||selected.payment_type||"-"}</b></div>
            <div><span>Follow Up Via</span><b>{selected.follow_up_channel||"-"}</b></div>
            <div><span>Next Follow Up</span><b>{selected.next_follow_up_at?new Date(selected.next_follow_up_at).toLocaleString("id-ID"):"-"}</b></div>
            <div><span>Priority</span><b>{selected.follow_up_priority||"normal"}</b></div>
            <div><span>PIC Follow Up</span><b>{picLabel(selected.follow_up_owner_user_id)||"-"}</b></div>
            <div><span>Product</span><b>{selected.product_name||"-"}</b></div>
            <div><span>SKU</span><b>{selected.sku||"-"}</b></div>
             <div><span>Agreement</span><b>{selected.agreement_id||"Belum ada"}</b></div>
             <div><span>Program Support</span><b>{supportPrograms.find(p=>p.id===selected.program_id)?.program_name||"Belum terhubung"}</b></div>
          </div>
          <section className="listing-v2-contacts">
            <div className="listing-v2-social-head"><div><span>FOLLOW-UP CONTACTS</span><h4>Kontak channel creator</h4><p>Simpan nomor WhatsApp, username Instagram, TikTok, atau channel lain untuk dipakai saat follow-up.</p></div><button type="button" className="secondary" disabled={!selectedCreator} onClick={()=>startContactEdit()}>+ Tambah Kontak</button></div>
            {!selectedCreator?<p className="listing-v2-social-empty">Creator belum terhubung ke Master Creator.</p>:selectedContacts.length===0&&!contactFormOpen?<div className="listing-v2-social-empty"><p>Belum ada kontak untuk creator ini. Tambahkan nomor WhatsApp atau username agar follow-up bisa langsung dikirim.</p><button type="button" className="primary" onClick={()=>startContactEdit()}>+ Tambah nomor WhatsApp</button></div>:<div className="listing-v2-contact-list">{selectedContacts.map(contact=><article key={contact.id}><div><b>{contact.channel}{contact.is_primary?" · Utama":""}</b><small>{contact.phone||contact.handle||contact.url||"Kontak belum diisi"}</small>{contact.note&&<small>{contact.note}</small>}</div><div className="button-row"><button type="button" onClick={()=>startContactEdit(contact)}>Edit</button><button type="button" className="danger" onClick={()=>void deleteChannelContact(contact.id)}>Hapus</button></div></article>)}</div>}
            {selectedCreator&&contactFormOpen&&<div className="listing-v2-contact-form"><label><span>Channel</span><select value={contactDraft.channel} onChange={e=>setContactDraft({...contactDraft,channel:e.target.value})}>{channelChoices.map(channel=><option key={channel}>{channel}</option>)}</select></label><label><span>No. WhatsApp / Phone</span><input type="tel" inputMode="tel" autoComplete="tel" value={contactDraft.phone} onChange={e=>setContactDraft({...contactDraft,phone:e.target.value})} placeholder="08… atau +62…"/></label><label><span>Username / Handle</span><input autoComplete="off" spellCheck={false} value={contactDraft.handle} onChange={e=>setContactDraft({...contactDraft,handle:e.target.value})} placeholder="@username…"/></label><label><span>URL</span><input type="url" value={contactDraft.url} onChange={e=>setContactDraft({...contactDraft,url:e.target.value})} placeholder="https://…"/></label><label className="wide"><span>Catatan</span><input value={contactDraft.note} onChange={e=>setContactDraft({...contactDraft,note:e.target.value})} placeholder="Keterangan kontak…"/></label><label className="listing-checkbox"><input type="checkbox" checked={contactDraft.is_primary} onChange={e=>setContactDraft({...contactDraft,is_primary:e.target.checked})}/><span>Jadikan kontak utama untuk channel ini</span></label><div className="button-row"><button type="button" className="secondary" onClick={()=>setContactFormOpen(false)}>Batal</button><button type="button" className="primary" disabled={saving} onClick={()=>void saveChannelContact({...contactDraft,id:contactEditingId||undefined})}>{saving?"Menyimpan…":"Simpan Kontak"}</button></div></div>}
          </section>
          <section className="listing-v2-social">
            <div className="listing-v2-social-head"><div><span>SOCIAL PROFILE</span><h4>Link medsos creator</h4></div><button type="button" className="secondary" disabled={!selectedCreator} onClick={openSocialProfile}>{selectedSocialLinks.length?"Edit":"Tambah"}</button></div>
            {selectedSocialLinks.length?<div className="listing-v2-social-links">{selectedSocialLinks.map(([key,url])=><a key={key} href={String(url)} target="_blank" rel="noreferrer"><span>{key==="x"?"X":key.charAt(0).toUpperCase()+key.slice(1)}</span><b>↗</b></a>)}</div>:<p className="listing-v2-social-empty">{selectedCreator?"Belum ada link sosial. Tambahkan Instagram, TikTok, Facebook, Lemon8, YouTube, atau platform lainnya.":"Hubungkan listing ke Master Creator untuk menyimpan profil sosial."}</p>}
            {selectedCreator?.social_profile_updated_at&&<small>Profil diperbarui {new Date(selectedCreator.social_profile_updated_at).toLocaleString("id-ID")}</small>}
          </section>
          <ListingQuickMessage workspaceId={workspaceId} listing={selected} creatorUsername={selectedCreator?.username||null} picName={picLabel(selected.follow_up_owner_user_id)} creatorPhone={primaryContact(selectedCreator)?.phone||selectedCreator?.phone||null}/>
          {splitPostLinks(selected.post_link).length>0&&<div className="listing-v2-social"><div className="listing-v2-social-head"><div><span>KONTEN / POST LINK</span><h4>{splitPostLinks(selected.post_link).length} link konten</h4></div></div><div className="listing-v2-social-links">{splitPostLinks(selected.post_link).map((url,i)=><a key={i} href={url} target="_blank" rel="noreferrer"><span>Link {i+1}</span><b>↗</b></a>)}</div></div>}
          <div className="listing-v2-detail-actions"><button className="primary" onClick={()=>openActivity(selected,"Follow Up")}>+ Tambah Follow Up</button><button className="secondary" onClick={()=>openEdit(selected)}>Edit Listing</button>{splitPostLinks(selected.post_link).slice(0,1).map((url,i)=><a key={i} href={url} target="_blank" rel="noreferrer">Buka Konten{splitPostLinks(selected.post_link).length>1?` (1/${splitPostLinks(selected.post_link).length})`:""}</a>)}</div>
          <div className="listing-v2-timeline-head"><div><h4>Activity Timeline</h4><p>Riwayat listing, follow up, sample, konten, dan hasil creator.</p></div></div>
          {detailLoading?<div className="listing-v2-empty small" role="status">Memuat timeline…</div>:activities.length===0?<div className="listing-v2-empty small">Belum ada aktivitas.</div>:
          <div className="listing-v2-timeline">{activities.map(activity=><article key={activity.id}><span className="dot"/><time>{dateLabel(activity.activity_date)}</time><div><b>{activity.activity_type}</b>{activity.follow_up_channel&&<span className="listing-channel-badge timeline">{activity.follow_up_channel}</span>}{activity.result&&<em>{activity.result}</em>}{activity.note&&<p>{activity.note}</p>}</div></article>)}</div>}
        </>}
      </aside>
    </div>

    <details className="listing-v2-master">
      <summary><div><h3>Master Creator</h3><p>Database creator workspace tetap tersedia untuk pencarian dan pengecekan data master.</p></div><span>{masterCreatorTotal.toLocaleString("id-ID")} creator</span></summary>
      <div className="listing-v2-master-body">
        <div className="listing-v2-master-search"><input value={masterCreatorSearch} onChange={e=>setMasterCreatorSearch(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();void loadMasterCreators(1,masterCreatorSearch)}}} placeholder="Cari username / nama creator / platform…" autoComplete="off" spellCheck={false} aria-label="Cari Master Creator"/><button className="secondary" onClick={()=>void loadMasterCreators(1,masterCreatorSearch)}>Cari</button>{masterCreatorSearch&&<button className="secondary" onClick={()=>{setMasterCreatorSearch("");void loadMasterCreators(1,"")}}>Reset</button>}</div>
        <div className="listing-v2-table-wrap"><table><thead><tr><th>Creator / Username</th><th>Platform</th><th>Affiliate ID</th><th>Social</th><th>Phone</th><th>Payment</th><th>Ratecard</th><th>Status</th></tr></thead><tbody>
          {masterCreators.map(creator=><tr key={creator.id}><td><div className="listing-master-creator"><span className={"listing-master-avatar "+(creator.avatar_url?"has-photo":"")}>{creator.avatar_url?<img src={creator.avatar_url} alt="" width={28} height={28} loading="lazy" referrerPolicy="no-referrer"/>:String(creator.name||creator.username||"C").slice(0,1).toUpperCase()}</span><div><b>{creator.name||creator.username||"-"}</b>{creator.username&&creator.username!==creator.name&&<small>@{creator.username}</small>}</div></div></td><td>{creator.platform||"-"}</td><td>{creator.affiliate_id||"-"}</td><td><span className="listing-social-count">{Object.keys(creator.social_links||{}).filter(key=>Boolean(creator.social_links?.[key])).length} link</span></td><td>{creator.phone||"-"}</td><td>{creator.payment_type||"-"}</td><td>{money(creator.ratecard)}</td><td><span className="listing-v2-stage success">{creator.status||"-"}</span></td></tr>)}
        </tbody></table></div>
        <div className="pager"><span className="pager-info">Page {masterCreatorPage} / {masterCreatorPages}</span><div className="button-row"><button className="secondary" disabled={masterCreatorPage<=1} onClick={()=>void loadMasterCreators(masterCreatorPage-1,masterCreatorSearch)}>Previous</button><button className="secondary" disabled={masterCreatorPage>=masterCreatorPages} onClick={()=>void loadMasterCreators(masterCreatorPage+1,masterCreatorSearch)}>Next</button></div></div>
      </div>
    </details>

    {socialOpen&&selectedCreator&&<div className="listing-v2-modal-backdrop" onMouseDown={()=>!socialSaving&&setSocialOpen(false)}>
      <section className="listing-v2-modal listing-social-modal" role="dialog" aria-modal="true" aria-label="Link medsos dan foto profil creator" onMouseDown={e=>e.stopPropagation()}>
        <header><div><span>CREATOR SOCIAL PROFILE</span><h3>Link Medsos & Foto Profil</h3><p>{creatorName} · Lumaway membaca foto dari metadata publik jika platform menyediakannya.</p></div><button type="button" aria-label="Tutup profil sosial" disabled={socialSaving} onClick={()=>setSocialOpen(false)}>×</button></header>
        <div className="listing-social-form">
          {SOCIAL_FIELDS.map(([key,label])=><label key={key}><span>{label}</span><input value={socialForm[key]||""} onChange={e=>setSocialForm(prev=>({...prev,[key]:e.target.value}))} placeholder={key==="other"?"https://platform-lain.com/profile…":"https://…"} inputMode="url" autoComplete="off" spellCheck={false}/></label>)}
          <label className="wide"><span>Avatar URL <small>Opsional · dipakai jika foto tidak dapat dibaca otomatis</small></span><input value={avatarInput} onChange={e=>setAvatarInput(e.target.value)} placeholder="https://…/foto.jpg" inputMode="url" autoComplete="off" spellCheck={false}/></label>
          <div className="listing-social-preview"><span className={"listing-v2-avatar "+(avatarInput||selectedCreator.avatar_url?"has-photo":"")}>{avatarInput||selectedCreator.avatar_url?<img src={avatarInput||selectedCreator.avatar_url||""} alt="" width={44} height={44} loading="lazy" referrerPolicy="no-referrer"/>:initials}</span><div><b>Auto Profile Photo</b><p>Saat disimpan, Lumaway mencoba membaca <code>og:image</code> / metadata publik dari link sosial. Jika platform memblokir akses publik, link tetap tersimpan dan Avatar URL manual dapat digunakan.</p></div></div>
        </div>
        <footer><button className="secondary" disabled={socialSaving} onClick={()=>setSocialOpen(false)}>Batal</button><button className="primary" disabled={socialSaving} onClick={()=>void saveSocialProfile()}>{socialSaving?"Membaca profil…":"Simpan & Ambil Foto"}</button></footer>
      </section>
    </div>}

    {activityFor&&<div className="listing-v2-modal-backdrop" onMouseDown={()=>!saving&&setActivityFor(null)}>
      <section className="listing-v2-modal" role="dialog" aria-modal="true" aria-label="Tambah aktivitas creator" onMouseDown={e=>e.stopPropagation()}>
        <header><div><span>CREATOR ACTIVITY</span><h3>Tambah Aktivitas</h3><p>{activityFor.creator_name||"Creator"} · {activityFor.product_name||activityFor.sku||"Listing"}</p></div><button type="button" aria-label="Tutup tambah aktivitas" onClick={()=>setActivityFor(null)}>×</button></header>
        <div className="listing-v2-activity-form">
          <label><span>Tanggal</span><input type="date" value={activityForm.activity_date} onChange={e=>setActivityForm({...activityForm,activity_date:e.target.value})}/></label>
          <label><span>Aktivitas</span><select value={activityForm.activity_type} onChange={e=>setActivityForm({...activityForm,activity_type:e.target.value})}>{ACTIVITY_TYPES.map(x=><option key={x}>{x}</option>)}</select></label>
          <label><span>Follow Up Via</span><select value={activityForm.follow_up_channel} onChange={e=>setActivityForm({...activityForm,follow_up_channel:e.target.value})}><option value="">Tidak ditentukan</option>{channelChoices.map(x=><option key={x}>{x}</option>)}</select><small>Pilih channel yang benar-benar digunakan pada aktivitas ini.</small></label>
          <label><span>Hasil / Next Action</span><input value={activityForm.result} onChange={e=>setActivityForm({...activityForm,result:e.target.value})} placeholder="Contoh: Follow up 3 hari lagi…"/></label>
          <label><span>Next Follow Up</span><input type="datetime-local" value={activityForm.next_follow_up_at} onChange={e=>setActivityForm({...activityForm,next_follow_up_at:e.target.value})}/><small>Opsional. Jadwalkan follow-up berikutnya setelah aktivitas ini.</small></label>
          <label><span>Catatan</span><textarea rows={4} value={activityForm.note} onChange={e=>setActivityForm({...activityForm,note:e.target.value})} placeholder="Catatan aktivitas…"/></label>
        </div>
        <footer><button className="secondary" onClick={()=>setActivityFor(null)}>Batal</button><button className="primary" disabled={saving} onClick={()=>void saveActivity()}>{saving?"Menyimpan…":"Simpan Aktivitas"}</button></footer>
      </section>
    </div>}
  </section>;
}
