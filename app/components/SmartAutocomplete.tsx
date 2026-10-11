"use client";

import { useEffect, useId, useRef, useState } from "react";

export type CreatorSearchResult={
  id:number; creator_code:string|null; name:string|null; username:string|null; platform:string|null;
  affiliate_id?:string|null; phone?:string|null; payment_type?:string|null; ratecard?:number|null; status?:string|null;
};
export type ProductSearchResult={
  id:number; sku:string; product_name:string|null; category?:string|null;
  selling_price?:number|null; cost_price?:number|null; status?:string|null;
};

export async function resolveOrCreateCreator(workspaceId:string,value:string,platform?:string){
  const typed=String(value||"").trim();
  if(!typed)return null;
  const r=await fetch("/api/master-data/creators",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({workspace_id:workspaceId,creator:typed,platform:platform||null})
  });
  const d=await r.json().catch(()=>({}));
  if(!r.ok||!d.ok)throw new Error(d.error||"Gagal membuat creator baru.");
  return d.creator as CreatorSearchResult;
}

function useDebouncedSearch(endpoint:string,workspaceId:string,query:string,enabled:boolean){
  const [results,setResults]=useState<any[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const requestRef=useRef(0);
  useEffect(()=>{
    if(!enabled||!query.trim()){setResults([]);setError("");setLoading(false);return}
    const id=++requestRef.current;
    const timer=window.setTimeout(async()=>{
      setLoading(true);
      try{
        const r=await fetch(`${endpoint}?workspace_id=${encodeURIComponent(workspaceId)}&q=${encodeURIComponent(query.trim())}&limit=15`,{cache:"no-store"});
        const d=await r.json();
        if(id!==requestRef.current)return;
        setResults(r.ok&&d.ok?(d.results||[]):[]);
        setError(r.ok&&d.ok?"":String(d?.error||"Pencarian Master Creator gagal. Coba lagi."));
      }catch{if(id===requestRef.current){setResults([]);setError("Koneksi ke Master Creator terputus. Coba lagi.")}}
      finally{if(id===requestRef.current)setLoading(false)}
    },180);
    return()=>window.clearTimeout(timer);
  },[endpoint,workspaceId,query,enabled]);
  return{results,loading,error,setResults};
}

export function CreatorAutocomplete({
  workspaceId,value,selectedId,onTextChange,onSelect,onCreate,createPlatform,allowCreate=true,placeholder="Ketik username atau nama creator",disabled=false
}:{workspaceId:string;value:string;selectedId?:string|number|null;onTextChange:(value:string)=>void;onSelect:(creator:CreatorSearchResult)=>void;onCreate?:(value:string)=>void;createPlatform?:string|null;allowCreate?:boolean;placeholder?:string;disabled?:boolean}){
  const {results,loading,error,setResults}=useDebouncedSearch("/api/search/creators",workspaceId,value,!disabled&&!selectedId);
  const [creating,setCreating]=useState(false);
  const [createMessage,setCreateMessage]=useState("");
  const listId=useId();
  const typed=value.trim();
  const normalized=typed.replace(/^@+/,"").trim().toLowerCase();
  const exactMatch=results.find((creator:CreatorSearchResult)=>
    [creator.name,creator.username,creator.creator_code].some(v=>String(v||"").replace(/^@+/,"").trim().toLowerCase()===normalized)
  ) as CreatorSearchResult|undefined;

  async function commitTyped(){
    if(!typed||disabled||selectedId||creating)return;
    if(!allowCreate&&!exactMatch){setCreateMessage("Pilih nama creator dari hasil Master Creator. Untuk creator baru, tambahkan dahulu melalui Master Creator.");return}
    setCreateMessage("");
    if(exactMatch){
      onSelect(exactMatch);
      setResults([]);
      return;
    }
    setCreating(true);
    try{
      const creator=await resolveOrCreateCreator(workspaceId,typed,createPlatform||undefined);
      if(!creator)throw new Error("Creator belum dapat disimpan.");
      onSelect(creator);
      setResults([]);
      setCreateMessage("Creator baru tersimpan di Master Creator.");
    }catch(error:any){
      setCreateMessage(error?.message||"Creator baru belum dapat disimpan.");
      onCreate?.(typed);
    }finally{
      setCreating(false);
    }
  }

  return <div className="smart-autocomplete">
    <input
      disabled={disabled||creating}
      value={value}
      name="creator-search"
      aria-label="Cari creator dari Master Creator"
      role="combobox"
      aria-expanded={!disabled&&!selectedId&&Boolean(typed)}
      aria-controls={listId}
      aria-autocomplete="list"
      onChange={e=>{setCreateMessage("");onTextChange(e.target.value)}}
      onKeyDown={e=>{
        if(e.key==="Enter"&&!e.shiftKey&&!selectedId&&typed){
          e.preventDefault();
          void commitTyped();
        }
        if(e.key==="Escape"){setResults([])}
      }}
      placeholder={placeholder}
      autoComplete="off"
      spellCheck={false}
    />
    {!disabled&&!selectedId&&typed&&(loading||results.length>0||Boolean(error)||typed.length>=2)&&<div className="smart-autocomplete-menu" role="listbox" id={listId}>
      {loading&&<div className="smart-autocomplete-empty" role="status">Mencari creator dari Master Data…</div>}
      {!loading&&error&&<div className="smart-autocomplete-empty" role="alert">{error}</div>}
      {!loading&&results.map((creator:CreatorSearchResult)=>{
        const name=String(creator.name||"").trim();
        const username=String(creator.username||"").trim();
        const label=name&&username&&name.toLowerCase()!==username.toLowerCase()?name+" · @"+username:username?"@"+username:name||"-";
        return <button type="button" role="option" aria-selected="false" key={creator.id} onPointerDown={e=>{e.preventDefault();onSelect(creator);setResults([]);setCreateMessage("")}}>
          <strong>{label}</strong>
          {creator.platform&&<span>{creator.platform}</span>}
        </button>
      })}
      {!loading&&!error&&!results.length&&<div className="smart-autocomplete-empty">Creator tidak ditemukan. Periksa nama atau username.</div>}
    </div>}
    {creating&&<small className="field-note" role="status">Menyimpan creator baru…</small>}
    {!creating&&createMessage&&<small className="field-note">{createMessage}</small>}
  </div>;
}

export function ProductAutocomplete({
  workspaceId,value,selectedId,onTextChange,onSelect,placeholder="Ketik SKU produk atau nama produk",disabled=false
}:{workspaceId:string;value:string;selectedId?:string|number|null;onTextChange:(value:string)=>void;onSelect:(product:ProductSearchResult)=>void;placeholder?:string;disabled?:boolean}){
  const {results,loading,setResults}=useDebouncedSearch("/api/search/products",workspaceId,value,!disabled&&!selectedId);
  const plistId=useId();
  return <div className="smart-autocomplete">
    <input disabled={disabled} value={value} name="product-search" aria-label="Cari produk dari Product Master" role="combobox" aria-expanded={!disabled&&!selectedId&&Boolean(value.trim())} aria-controls={plistId} aria-autocomplete="list" onChange={e=>onTextChange(e.target.value)} onKeyDown={e=>{if(e.key==="Escape"){setResults([])}}} placeholder={placeholder} autoComplete="off" spellCheck={false}/>
    {!disabled&&!selectedId&&value.trim()&&<div className="smart-autocomplete-menu" role="listbox" id={plistId}>
      {loading&&<div className="smart-autocomplete-empty" role="status">Mencari produk…</div>}
      {!loading&&results.map((p:ProductSearchResult)=><button type="button" role="option" aria-selected="false" key={p.id} onMouseDown={e=>{e.preventDefault();onSelect(p);setResults([])}}>
        <strong>{p.sku}</strong>
        <span>{p.product_name||"-"} · HPP Rp {Number(p.cost_price||0).toLocaleString("id-ID")}</span>
      </button>)}
      {!loading&&!results.length&&<div className="smart-autocomplete-empty">Tidak ada produk yang cocok.</div>}
    </div>}
  </div>;
}
