"use client";

import { useMemo, useState } from "react";
import { createClient } from "../../lib/supabase-browser";
import { navigateToSection } from "../../lib/luma-navigation";
import ImportMappingWizard from "./ImportMappingWizard";
import CreatorAttributionCenter from "./CreatorAttributionCenter";
declare global { interface Window { XLSX?: any; } }
type Props = { workspaceId: string };const NEUTRAL_DATE = "2000-01-01";
function delimiterScore(line:string,delimiter:string){let quoted=false,count=0;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(quoted&&line[i+1]==='"')i++;else quoted=!quoted}else if(ch===delimiter&&!quoted)count++}return count}
function detectDelimiter(text:string){const lines=text.replace(/^\uFEFF/,"").split(/\r?\n/).filter(Boolean).slice(0,5);const candidates=[",",";","\t"];let best=",",score=-1;for(const delimiter of candidates){const current=lines.reduce((sum,line)=>sum+delimiterScore(line,delimiter),0);if(current>score){score=current;best=delimiter}}return best}
function parseCsv(text: string) {
 const delimiter=detectDelimiter(text);const rows:string[][]=[];let row:string[]=[];let cell="";let quoted=false;const source=text.replace(/^\uFEFF/,"");
 for(let i=0;i<source.length;i++){const ch=source[i];if(ch==='"'){if(quoted&&source[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(ch===delimiter&&!quoted){row.push(cell);cell=""}else if((ch==="\n"||ch==="\r")&&!quoted){if(ch==="\r"&&source[i+1]==="\n")i++;row.push(cell);if(row.some(x=>x!==""))rows.push(row);row=[];cell=""}else cell+=ch}
 row.push(cell);if(row.some(x=>x!==""))rows.push(row);
 const headers=(rows.shift()||[]).map((x,i)=>x.trim()||`Column ${i+1}`);
 return rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??""])));
}
async function loadXlsx() {if (window.XLSX) return window.XLSX;await new Promise<void>((resolve, reject) => { const s = document.createElement("script"); s.src = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js"; s.async = true; s.onload = () => resolve(); s.onerror = () => reject(new Error("parser")); document.head.appendChild(s); });return window.XLSX;}
async function fileHash(buffer: ArrayBuffer) { const hash = await crypto.subtle.digest("SHA-256", buffer); return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join(""); }
function normalizeHeader(value:any){return String(value||"").trim().toLowerCase().replace(/[^a-z0-9]+/g,"")}
function detectPlatformFromRows(rows:any[],fallback:string){
 const headers=Object.keys(rows?.[0]||{}).map(normalizeHeader);const has=(...terms:string[])=>terms.some(term=>headers.some(header=>header.includes(normalizeHeader(term))));
 if(has("GMV dari kreator","GMV Afiliasi","Pesanan teratribusi","Pesanan produk afiliasi","Perkiraan komisi","Produk terjual","GMV dari LIVE kreator","GMV LIVE afiliasi","GMV dari video afiliasi","Video jualan afiliasi","Product ID","LIVE streams","Refunded GMV","Refunded items sold"))return "TikTok";
 if(has("Omzet Penjualan","Estimasi Komisi","ID Affiliates","Nama Affiliate","Affiliate ID","Affiliate Name","Affiliate Username","Sales(Rp)","Item Sold","Est.Commission(Rp)","Total Buyers","Kode Item","Nama Item","Item id","Item Name","Price(Rp)","Produk Terjual"))return "Shopee";
 return fallback;
}
const MONTHS:Record<string,number>={januari:1,january:1,februari:2,february:2,maret:3,march:3,april:4,mei:5,may:5,juni:6,june:6,juli:7,july:7,agustus:8,august:8,september:9,oktober:10,october:10,november:11,desember:12,december:12};
function inferPeriodFromFilename(filename:string){
 const base=filename.replace(/\.[^.]+$/,"").toLowerCase();
 const monthName=Object.keys(MONTHS).find(name=>new RegExp(`(?:^|[^a-z])${name}(?:[^a-z]|$)`,"i").test(base));
 const yearMatch=base.match(/(?:20)\d{2}/);
 if(monthName&&yearMatch){
   const year=Number(yearMatch[0]),month=MONTHS[monthName];
   const dayPattern=new RegExp(`(?:^|\\D)(\\d{1,2})\\s*${monthName}`,"i");const dayMatch=base.match(dayPattern);
   if(dayMatch){const day=Math.min(new Date(Date.UTC(year,month,0)).getUTCDate(),Math.max(1,Number(dayMatch[1])));const d=`${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;return{start:d,end:d,label:`${day} ${monthName} ${year}`}}
   const last=new Date(Date.UTC(year,month,0)).getUTCDate();return{start:`${year}-${String(month).padStart(2,"0")}-01`,end:`${year}-${String(month).padStart(2,"0")}-${String(last).padStart(2,"0")}`,label:`${monthName} ${year}`}
 }
 return null;
}
export default function UploadCenter({ workspaceId }: Props) {
 const supabase=createClient();const [dataType,setDataType]=useState("performance");const [platform,setPlatform]=useState("TikTok");const [startDate,setStartDate]=useState("");const [endDate,setEndDate]=useState("");const [storeName,setStoreName]=useState("");const [storeId,setStoreId]=useState("");const [file,setFile]=useState<File|null>(null);const [force,setForce]=useState(false);const [busy,setBusy]=useState(false);const [status,setStatus]=useState("");const [result,setResult]=useState<any>(null);const [mappingOverrides,setMappingOverrides]=useState<Record<string,string>>({});const [mappingReady,setMappingReady]=useState(false);const accept=useMemo(()=>".csv,.xlsx,.xls",[]);
 const periodless=dataType==="products"||dataType==="product_hpp";
 const platformless=dataType==="product_hpp";
 const uploadInfo:Record<string,{title:string;destination:string;mapping:string[]}>={
   performance:{title:"Affiliate Performance",destination:"Dashboard → Ranking Creator, Store Filter & Customer 360",mapping:platform==="Shopee"?["Store Name / Nama Toko (opsional; bisa diisi manual di form)","Affiliate ID","Affiliate Name","Affiliate Username","Sales(Rp)","Item Sold","Orders","Clicks","Est.Commission(Rp)","Total Buyers","New Buyers"]:["Store Name / Nama Toko (opsional; bisa diisi manual di form)","Creator name","GMV dari kreator","Pesanan teratribusi","Produk yang terjual dari kreator","Perkiraan komisi","Siaran LIVE","Video","Sampel","CTR","Impresi","Tayangan video"]},
   product_performance:{title:"Product Performance",destination:"Dashboard → Product Ranking, Store Filter & Master Data → Product Master",mapping:platform==="Shopee"?["Store Name / Nama Toko (opsional; bisa diisi manual di form)","Item id / Kode Item","Item Name / Nama Item","Price(Rp) / Harga(Rp)","Sales(Rp) / Omzet Penjualan(Rp)","Item Sold / Produk Terjual","Orders / Pesanan","Clicks","Est.Commission(Rp) / Estimasi Komisi(Rp)","ROI","Total Buyers / Total Pembeli","New Buyers / Pembeli Baru"]:["Store Name / Nama Toko (opsional; bisa diisi manual di form)","Product ID / Kode Produk","Product name / Nama Produk","GMV / Omzet Penjualan","Items sold","Est. commission","Samples","Sales creator","LIVE streams","Videos","Refunded GMV","Refunded items sold","Est. flat fee"]},
   creators:{title:"Master Creator",destination:"Master Data → Listings → Master Creator",mapping:["Creator Name / Nama Affiliate","Username / Username Affiliate","Platform","Affiliate ID / ID Affiliates","Phone / No HP / WhatsApp","Address / Alamat","Payment Type","Ratecard","Profile URL","Status","Notes"]},
   products:{title:"Master SKU / Produk",destination:"Master Data → Product Master",mapping:["SKU / Kode SKU (wajib sama lintas platform)","Product Code / Kode Produk / Product ID / Item ID","Product Name / Nama Produk","Variant / Variation / Variasi (opsional)","Variant Slot 1-15 (opsional)","Category / Kategori","Selling Price / Harga Jual","Cost Price / HPP","Point per Unit / Point","Status"]},
   creator_samples:{title:"Creator Samples",destination:"Master Data → Creator Samples",mapping:["Creator ID / creator_id","Creator Name / creator_name","Platform","SKU","Product Name","Sample Status","Sent Date","Return Date","Qty","Product Value","Tracking","Notes"]},
   product_hpp:{title:"Product HPP",destination:"Master Data → Product Master",mapping:["SKU / Kode SKU (wajib sama dengan Master SKU / Produk)","Product Name / Nama Produk","HPP / Cost Price / Harga Modal","Selling Price / Harga Jual (opsional)","Period / Periode (opsional)","Variasi 1 ... Variasi 15 (opsional; hanya kolom terisi yang disimpan)","Notes / Catatan"]}
 };
 const currentInfo=uploadInfo[dataType]||uploadInfo.performance;
 function downloadTemplate(){
   let headers:string[]=[];
   let example:string[]=[];
   let name="template-upload.csv";
   if(dataType==="products"){
     headers=["SKU","Product Code","Product Name","Variant","Variant Slot","Category","Selling Price","Cost Price","Point per Unit","Status"];
     example=["SKU-001",platform==="Shopee"?"SHOPEE-ITEM-001":"TIKTOK-PRODUCT-001","Nama Produk","Varian Contoh","1","Kategori","150000","90000","0","Active"];
     name=`template-master-sku-${platform.toLowerCase()}.csv`;
   }else if(dataType==="product_hpp"){
     headers=["SKU","Product Name","HPP","Selling Price","Period",...Array.from({length:15},(_,i)=>`Variasi ${i+1}`),"Notes"];
     example=["SKU-001","Nama Produk","90000","150000","MASTER","Merah","Biru",...Array.from({length:13},()=>""),"Contoh: hanya 2 variasi terisi, sistem menyimpan 2 variasi"];
     name="template-product-hpp-15-variasi.csv";
   }else return;
   const esc=(value:string)=>`"${String(value??"").replace(/"/g,'""')}"`;
   const csv=[headers.map(esc).join(","),example.map(esc).join(",")].join("\r\n");
   const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
   const url=URL.createObjectURL(blob);
   const a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
 }

 async function parseFile(selected:File){const buffer=await selected.arrayBuffer();const ext=selected.name.split(".").pop()?.toLowerCase();if(ext==="csv"){let text=new TextDecoder("utf-8").decode(buffer);if(text.includes("\uFFFD"))text=new TextDecoder("windows-1252").decode(buffer);return{rows:parseCsv(text),buffer}}const XLSX=await loadXlsx();const wb=XLSX.read(buffer,{type:"array",cellDates:true});const first=wb.Sheets[wb.SheetNames[0]];const rows=XLSX.utils.sheet_to_json(first,{defval:"",raw:true,dateNF:"yyyy-mm-dd"});return{rows,buffer}}
 async function submit(){if(!file)return setStatus("Pilih file terlebih dahulu.");if(!mappingReady)return setStatus("Periksa dan lengkapi Mapping Wizard sebelum import.");
 const taskId=`upload-${Date.now()}`;
 window.dispatchEvent(new CustomEvent("lumaway-background-task",{detail:{id:taskId,title:"Import Data",detail:file.name,status:"running",progress:5}}));if(!periodless&&startDate&&endDate&&startDate>endDate)return setStatus("Start Date tidak boleh melewati End Date.");setBusy(true);setResult(null);try{setStatus("Membaca dan menormalisasi file...");
 window.dispatchEvent(new CustomEvent("lumaway-background-task",{detail:{id:taskId,title:"Import Data",detail:"Membaca dan memvalidasi file",status:"running",progress:12}}));
 const parsed=await parseFile(file);if(!parsed.rows.length)return setStatus("File tidak memiliki data.");const detectedPlatform=(dataType==="performance"||dataType==="product_performance")?detectPlatformFromRows(parsed.rows,platform):platform;if(detectedPlatform!==platform)setPlatform(detectedPlatform);const inferred=periodless?null:inferPeriodFromFilename(file.name);const effectiveStart=periodless?"":(startDate||inferred?.start||NEUTRAL_DATE);const effectiveEnd=periodless?"":(endDate||(startDate?startDate:inferred?.end||NEUTRAL_DATE));const hash=await fileHash(parsed.buffer);const importId=`IMP-${crypto.randomUUID().replace(/-/g,"").slice(0,8).toUpperCase()}`;const batchSize=1000;const totalBatches=Math.ceil(parsed.rows.length/batchSize);let last:any=null;for(let i=0;i<totalBatches;i++){setStatus(`Import ${i+1}/${totalBatches} · ${parsed.rows.length.toLocaleString("id-ID")} row · ${detectedPlatform}${inferred&&!startDate?` · periode otomatis ${inferred.label}`:""}`);window.dispatchEvent(new CustomEvent("lumaway-background-task",{detail:{id:taskId,title:"Import Data",detail:`Memproses batch ${i+1} dari ${totalBatches}`,status:"running",progress:Math.round(18+((i+1)/totalBatches)*72)}}));
 const rows=parsed.rows.slice(i*batchSize,(i+1)*batchSize);const r=await fetch("/api/import",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({workspace_id:workspaceId,data_type:dataType,platform:detectedPlatform,store_name:storeName.trim()||null,store_id:storeId.trim()||null,start_date:effectiveStart,end_date:effectiveEnd,filename:file.name,file_hash:hash,force_reimport:force,import_id:importId,batch_index:i,total_batches:totalBatches,mapping_overrides:mappingOverrides,rows})});last=await r.json();if(!r.ok||!last.ok){setResult(last);throw new Error(last?.error||"Import gagal.")}}setResult(last);const persisted=Number(last?.persisted_rows||0);const q=last?.quality;const qualitySuffix=q?` · ${Number(q.active_rows||0).toLocaleString("id-ID")} row aktif · Qty ${Number(q.total_qty||0).toLocaleString("id-ID")} · Orders ${Number(q.total_orders||0).toLocaleString("id-ID")} · GMV Rp ${Number(q.total_gmv||0).toLocaleString("id-ID")} · Commission Rp ${Number(q.total_commission||0).toLocaleString("id-ID")}`:"";setStatus(last?.warning?`Import selesai dengan peringatan · ${persisted.toLocaleString("id-ID")} row tersimpan. ${last.warning}`:(persisted>0?`Import selesai · ${persisted.toLocaleString("id-ID")} row tersimpan · ${last?.detected_platform||detectedPlatform}${inferred&&!startDate?` · ${inferred.label}`:""}${qualitySuffix}`:`Import selesai · ${last?.import_id||importId}`));window.dispatchEvent(new CustomEvent("lumaway-database-updated",{detail:{import_id:last?.import_id||importId,rows:persisted,platform:last?.detected_platform||detectedPlatform}}));window.dispatchEvent(new CustomEvent("lumaway-background-task",{detail:{id:taskId,title:"Import Data",detail:`${persisted.toLocaleString("id-ID")} row tersimpan`,status:"success",progress:100}}));
 await supabase.rpc("luma_notify_self",{p_workspace_id:workspaceId,p_title:"Upload berhasil",p_message:`${file.name} berhasil diimport ke ${dataType}. ${persisted?persisted.toLocaleString("id-ID")+" row tersimpan.":""}`,p_kind:"upload_success",p_action_url:"#database"});}catch(error:any){
 const message=error?.message||"Import gagal.";
 window.dispatchEvent(new CustomEvent("lumaway-background-task",{detail:{id:taskId,title:"Import Data",detail:message,status:"error"}}));
  setStatus(error?.message||"Import gagal. Cek format file dan pesan di bawah, lalu coba lagi.")
 }finally{setBusy(false)}}
 const isError=["error","wajib","tidak boleh","tidak memiliki","pilih file","gagal","belum dikenali"].some(word=>status.toLowerCase().includes(word));
 return <section id="upload" className="legacy-page-anchor">
  <div className="page-head"><div><div className="eyebrow">DATA & UPLOAD</div><h1>Upload Center</h1><p className="muted">Upload sekarang melalui alur Upload → Mapping → Preview → Import agar perubahan format marketplace tidak langsung membuat data dashboard tidak terbaca.</p></div><button type="button" className="secondary" onClick={()=>navigateToSection("data-health")}>Data Health</button></div>
  <div className="card">
   <div className="section-head"><div><h3>Pilih Jenis Upload</h3><p className="muted">Affiliate Performance dan Product Performance adalah data analitik. Master Data digunakan untuk pengelolaan data operasional.</p></div></div>
   <div style={{marginBottom:16}}><b style={{display:"block",fontSize:11,marginBottom:8}}>AFFILIATE DATA</b><div className="button-row">
    <button type="button" className={dataType==="performance"?"primary":"secondary"} onClick={()=>{setDataType("performance");setFile(null);setStatus("");setResult(null);setMappingOverrides({});setMappingReady(false)}}>Affiliate Performance</button>
    <button type="button" className={dataType==="product_performance"?"primary":"secondary"} onClick={()=>{setDataType("product_performance");setFile(null);setStatus("");setResult(null);setMappingOverrides({});setMappingReady(false)}}>Product Performance</button>
   </div></div>
   <div><b style={{display:"block",fontSize:11,marginBottom:8}}>MASTER DATA</b><div className="button-row">
    <button type="button" className={dataType==="creators"?"primary":"secondary"} onClick={()=>{setDataType("creators");setFile(null);setStatus("");setResult(null);setMappingOverrides({});setMappingReady(false)}}>Master Creator</button>
    <button type="button" className={dataType==="products"?"primary":"secondary"} onClick={()=>{setDataType("products");if(platform!=="Shopee"&&platform!=="TikTok")setPlatform("Shopee");setStartDate("");setEndDate("");setFile(null);setStatus("");setResult(null);setMappingOverrides({});setMappingReady(false)}}>Master SKU / Produk</button>
    <button type="button" className={dataType==="product_hpp"?"primary":"secondary"} onClick={()=>{setDataType("product_hpp");setStartDate("");setEndDate("");setFile(null);setStatus("");setResult(null);setMappingOverrides({});setMappingReady(false)}}>Product HPP</button>
    <button type="button" className={dataType==="creator_samples"?"primary":"secondary"} onClick={()=>{setDataType("creator_samples");setFile(null);setStatus("");setResult(null);setMappingOverrides({});setMappingReady(false)}}>Creator Samples</button>
   </div></div>
  </div>
  <div className="card">
   <div className="section-head"><div><h3>{currentInfo.title}</h3><p className="muted">Tujuan data: <b>{currentInfo.destination}</b></p></div><div className="button-row">{(dataType==="products"||dataType==="product_hpp")&&<button type="button" className="secondary" onClick={downloadTemplate}>Download Template</button>}<button type="button" className="secondary" onClick={()=>navigateToSection("tutorial")}>Tutorial Upload</button></div></div>
   {(!platformless||!periodless)&&<div className="upload-period-grid">
    {!platformless&&<label>Platform<select value={platform} onChange={e=>setPlatform(e.target.value)}>{dataType==="products"?<><option>Shopee</option><option>TikTok</option></>:<><option>TikTok</option><option>Shopee</option><option>Instagram</option><option>Other</option></>}</select></label>}
    {!periodless&&<><label>Start Date <span className="field-note">Opsional · dd/mm/yyyy</span><input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/></label><label>End Date <span className="field-note">Opsional · dd/mm/yyyy</span><input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)}/></label>{(dataType==="performance"||dataType==="product_performance")&&<><label>Nama Toko <span className="field-note">Opsional · otomatis jika ada di file</span><input value={storeName} onChange={e=>setStoreName(e.target.value)} placeholder="Contoh: Toko Utama"/></label><label>Store ID <span className="field-note">Opsional</span><input value={storeId} onChange={e=>setStoreId(e.target.value)} placeholder="ID toko marketplace"/></label></>}</>}
   </div>}
   {periodless&&<div className="owner-inline-note">{dataType==="products"?<><b>Master SKU / Produk:</b> pilih platform Shopee atau TikTok. SKU adalah kode induk yang sama lintas platform, sedangkan Product Code/Item ID boleh berbeda dan boleh lebih dari satu per SKU.</>:<><b>Product HPP:</b> tidak menggunakan platform maupun Start Date / End Date. SKU harus sama dengan Master SKU / Produk. Tersedia 15 kolom variasi; hanya variasi yang terisi yang akan dibuat.</>}</div>}
   <div className="owner-inline-note"><b>Multi-store:</b> satu file boleh berisi banyak toko jika tersedia kolom Store/Shop/Nama Toko. Jika file marketplace Anda hanya berisi satu toko tanpa kolom toko, isi Nama Toko di atas. Upload toko berikutnya tidak akan menghapus data toko sebelumnya pada periode yang sama.</div><label>File CSV/XLSX<input key={dataType} type="file" accept={accept} onChange={e=>{setFile(e.target.files?.[0]||null);setMappingOverrides({});setMappingReady(false);setStatus("");setResult(null)}}/></label><ImportMappingWizard file={file} dataType={dataType} platform={platform} workspaceId={workspaceId} onChange={value=>{setMappingOverrides(value.mapping);setMappingReady(value.valid);if((dataType==="performance"||dataType==="product_performance")&&value.detectedPlatform&&value.detectedPlatform!==platform)setPlatform(value.detectedPlatform)}}/>
   <label className="inline-check"><input type="checkbox" checked={force} onChange={e=>setForce(e.target.checked)}/>Re-import file yang sama untuk mengganti hasil import sebelumnya</label>
    <div className="button-row"><button className="primary" onClick={submit} disabled={busy||!file||!mappingReady} title={!file?"Pilih file dulu":!mappingReady?"Lengkapi mapping dulu":"Mulai import"}>{busy?"Mengimpor...":!file?"Pilih File":!mappingReady?"Lengkapi Mapping":"Import Data"}</button><button type="button" className="secondary" onClick={()=>navigateToSection("data-health")} title="Cek hasil validasi di Data Health">Periksa Data Health</button></div>
   {status&&<div className={"flash "+(isError?"error":"success")+" upload-status"}>{status}</div>}
   {result?.stats&&<div className="kpis import-kpis">{Object.entries(result.stats).map(([k,v])=><div className="kpi" key={k}><small>{k}</small><b>{Number(v||0).toLocaleString("id-ID")}</b></div>)}</div>}{result?.quality&&<div className="kpis import-kpis">
    <div className="kpi"><small>Rows Tersimpan</small><b>{Number(result.quality.total_rows||0).toLocaleString("id-ID")}</b></div>
    <div className="kpi"><small>Rows Aktif</small><b>{Number(result.quality.active_rows||0).toLocaleString("id-ID")}</b></div>
    <div className="kpi"><small>Qty</small><b>{Number(result.quality.total_qty||0).toLocaleString("id-ID")}</b></div>
    <div className="kpi"><small>Orders</small><b>{Number(result.quality.total_orders||0).toLocaleString("id-ID")}</b></div>
    <div className="kpi"><small>GMV</small><b>Rp {Number(result.quality.total_gmv||0).toLocaleString("id-ID")}</b></div>
    <div className="kpi"><small>Commission</small><b>Rp {Number(result.quality.total_commission||0).toLocaleString("id-ID")}</b></div>
   </div>}
   {result?.warning&&<div className="owner-inline-note"><b>Peringatan validasi:</b> {result.warning}</div>}
   {result?.mapping&&<div className="import-mapping-audit"><strong>Mapping file terdeteksi</strong><div>{Object.entries(result.mapping).map(([field,header])=><span key={field}><b>{field}</b> → {String(header)}</span>)}</div></div>}
   {result?.headers&&!result?.mapping&&<div className="import-mapping-audit error-audit"><strong>Header file yang terbaca</strong><p>{result.headers.join(" · ")}</p></div>}
  </div>
  {dataType!=="creators"&&<div className="card">
   <div className="section-head"><div><h3>Mapping yang digunakan · {currentInfo.title}</h3><p className="muted">Format berikut dikenali otomatis oleh importer. Header dapat memakai pasangan nama yang ditulis dengan tanda “/”.</p></div><button type="button" className="secondary" onClick={()=>navigateToSection("tutorial")}>Lihat Tutorial</button></div>
   <ul className="legacy-list">{currentInfo.mapping.map((item,index)=><li key={item}><b>{index+1}.</b> {item}</li>)}</ul>
   {dataType==="product_performance"&&<div className="owner-inline-note"><b>Disclaimer:</b> Product ID = Kode Produk/Kode Item. GMV = Sales(Rp)/Omzet Penjualan. Product Performance hanya masuk Product Ranking dan tidak masuk Ranking Creator.</div>}
   {dataType==="product_hpp"&&<div className="owner-inline-note">Jika HPP belum diupload, HPP tetap dapat diisi atau diedit manual melalui <b>Master Data → Product Master</b>. Kolom Period/Periode pada file bersifat opsional.</div>}
   {dataType==="creators"&&<div className="owner-inline-note">Master Creator akan tersedia pada <b>Master Data → Listings</b> sebagai referensi creator untuk pengelolaan listing.</div>}
   {dataType==="creator_samples"&&<div className="owner-inline-note">Creator Samples akan langsung tersedia pada <b>Master Data → Creator Samples</b>.</div>}
  </div>}
  <CreatorAttributionCenter workspaceId={workspaceId}/>
 </section>
}
