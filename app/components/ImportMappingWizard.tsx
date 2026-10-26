"use client";

import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";

declare global {interface Window {XLSX?:any}}

type Row=Record<string,any>;
type Field={label:string;output:string;candidates:string[];required?:boolean};
type Props={
  file:File|null;
  dataType:string;
  platform:string;
  workspaceId:string;
  onChange:(value:{mapping:Record<string,string>;valid:boolean;detectedPlatform:string;totalRows:number;headers:string[]})=>void;
};

function norm(value:any){return String(value||"").trim().toLowerCase().replace(/[^a-z0-9]+/g,"")}
function delimiterScore(line:string,delimiter:string){let quoted=false,count=0;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(quoted&&line[i+1]==='"')i++;else quoted=!quoted}else if(ch===delimiter&&!quoted)count++}return count}
function detectDelimiter(text:string){const lines=text.replace(/^\uFEFF/,"").split(/\r?\n/).filter(Boolean).slice(0,5);const candidates=[",",";","\t"];let best=",",score=-1;for(const delimiter of candidates){const current=lines.reduce((sum,line)=>sum+delimiterScore(line,delimiter),0);if(current>score){score=current;best=delimiter}}return best}
function parseCsv(text:string){
  const delimiter=detectDelimiter(text);const rows:string[][]=[];let row:string[]=[];let cell="";let quoted=false;const source=text.replace(/^\uFEFF/,"");
  for(let i=0;i<source.length;i++){const ch=source[i];if(ch==='"'){if(quoted&&source[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(ch===delimiter&&!quoted){row.push(cell);cell=""}else if((ch==="\n"||ch==="\r")&&!quoted){if(ch==="\r"&&source[i+1]==="\n")i++;row.push(cell);if(row.some(x=>x!==""))rows.push(row);row=[];cell=""}else cell+=ch}
  row.push(cell);if(row.some(x=>x!==""))rows.push(row);
  const headers=(rows.shift()||[]).map((x,i)=>x.trim()||("Column "+(i+1)));
  return rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??""])));
}
async function loadXlsx(){if(window.XLSX)return window.XLSX;await new Promise<void>((resolve,reject)=>{const s=document.createElement("script");s.src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";s.async=true;s.onload=()=>resolve();s.onerror=()=>reject(new Error("Parser XLSX gagal dimuat."));document.head.appendChild(s)});return window.XLSX}
async function parseFile(file:File){
  const buffer=await file.arrayBuffer();const ext=(file.name.split(".").pop()||"").toLowerCase();
  if(ext==="csv"){let text=new TextDecoder("utf-8").decode(buffer);if(text.includes("\uFFFD"))text=new TextDecoder("windows-1252").decode(buffer);return parseCsv(text)}
  const XLSX=await loadXlsx();const workbook=XLSX.read(buffer,{type:"array",cellDates:true});const first=workbook.Sheets[workbook.SheetNames[0]];return XLSX.utils.sheet_to_json(first,{defval:"",raw:true,dateNF:"yyyy-mm-dd"});
}
function detectedPlatform(headers:string[],fallback:string){
  const list=headers.map(norm);const has=(terms:string[])=>terms.some(term=>list.some(header=>header.includes(norm(term))));
  if(has(["GMV dari kreator","GMV Afiliasi","Pesanan teratribusi","Pesanan produk afiliasi","Perkiraan komisi","Produk terjual","Product ID","LIVE streams","Refunded GMV"]))return"TikTok";
  if(has(["Omzet Penjualan","Estimasi Komisi","ID Affiliates","Nama Affiliate","Sales(Rp)","Item Sold","Kode Item","Nama Item"]))return"Shopee";
  return fallback||"Other";
}
function signature(headers:string[]){return headers.map(norm).filter(Boolean).sort().join("|").slice(0,1800)}
function findHeader(headers:string[],candidates:string[]){
  for(const candidate of candidates){const exact=headers.find(header=>norm(header)===norm(candidate));if(exact)return exact}
  let best="",score=0;
  for(const header of headers){const nh=norm(header);if(nh.length<3)continue;for(const candidate of candidates){const nc=norm(candidate);if(nc.length<3)continue;if(nh.includes(nc)||nc.includes(nh)){const next=Math.min(nh.length,nc.length)/Math.max(nh.length,nc.length);if(next>score){best=header;score=next}}}}
  return score>=0.58?best:"";
}

const COMMON:Record<string,Field[]>={
  performance:[
    {label:"Creator Name",output:"Creator Name",candidates:["Kreator","Nama Kreator","Creator Name","Creator name","Nama Affiliate","Nama Afiliasi","Affiliate Name","Nama Creator","Creator","Akun Kreator"]},
    {label:"Username",output:"Username",candidates:["Username Affiliate","Affiliate Username","Username","Creator Username","Username Kreator","Nama Pengguna Kreator","Handle Kreator","Handle"]},
    {label:"Affiliate ID",output:"Affiliate ID",candidates:["ID Affiliates","Affiliate ID","ID Affiliate","Creator ID","ID Kreator","Kreator ID","UID Kreator"]},
    {label:"GMV",output:"GMV",candidates:["GMV dari kreator","GMV Afiliasi","Creator GMV","Omzet Penjualan(Rp)","Omzet Penjualan","Sales(Rp)","Total GMV","GMV","Revenue"]},
    {label:"Qty / Items Sold",output:"Qty",candidates:["Produk yang terjual dari kreator","Produk terjual","Produk Terjual","Items Sold","Item Sold","Qty Paid","Qty","Quantity"]},
    {label:"Orders",output:"Orders",candidates:["Pesanan teratribusi","Pesanan produk afiliasi","Pesanan Afiliasi","Attributed Orders","Orders","Pesanan","Order Count"]},
    {label:"Commission",output:"Commission",candidates:["Perkiraan komisi","Estimasi Komisi(Rp)","Est.Commission(Rp)","Estimated Commission","Commission","Komisi"]},
    {label:"Refund GMV",output:"Refund",candidates:["Pengembalian dana","Refund","Refund Amount","Refunded GMV"]},
    {label:"Refunded Items",output:"Refunded items sold",candidates:["Produk yang dikembalikan dananya","Refunded items sold","Item Refund"]},
    {label:"Clicks",output:"Clicks",candidates:["Clicks","Klik Produk","Product Clicks","Klik"]},
    {label:"Total Buyers",output:"Total Buyers",candidates:["Total Buyers","Total Pembeli","Pembeli","Buyers","Rata-rata pembeli afiliasi"]},
    {label:"New Buyers",output:"New Buyers",candidates:["New Buyers","Pembeli Baru"]},
    {label:"LIVE GMV",output:"GMV dari LIVE kreator",candidates:["GMV dari LIVE kreator","GMV LIVE kreator","GMV LIVE afiliasi","LIVE GMV","Live GMV"]},
    {label:"Video GMV",output:"GMV dari video afiliasi",candidates:["GMV dari video afiliasi","GMV video jualan afiliasi","Video GMV"]},
    {label:"Total LIVE",output:"Siaran LIVE",candidates:["Siaran LIVE afiliasi","Siaran LIVE","Jumlah LIVE","Live Count","LIVE streams","Total LIVE"]},
    {label:"Total Video",output:"Jumlah Video",candidates:["Video jualan afiliasi","Jumlah Video","Video Count","Videos","Video"]},
    {label:"Sample Sent",output:"Sampel terkirim",candidates:["Sampel terkirim","Sample Sent","Samples Sent","Sampel"]},
    {label:"CTR",output:"CTR",candidates:["CTR","Click Through Rate"]},
    {label:"Impressions",output:"Impressions",candidates:["Impresi produk","Product Impressions","Impressions","Impresi"]},
    {label:"Video Views",output:"Tayangan video",candidates:["Tayangan video","Video Views"]},
    {label:"Store Name",output:"Store Name",candidates:["Store Name","Shop Name","Nama Toko","Toko","Seller Name","Store","Shop"]},
    {label:"Store ID",output:"Store ID",candidates:["Store ID","Shop ID","Seller ID","ID Toko"]},
  ],
  product_performance:[
    {label:"Product ID / Item ID",output:"Product ID",candidates:["Kode Item","Product ID","Item ID","Kode Produk","SKU","ID Produk"],required:true},
    {label:"Product Name",output:"Product Name",candidates:["Nama Item","Item Name","Product Name","Nama Produk","Produk"],required:true},
    {label:"Category",output:"Category",candidates:["Kategori","Category","Kategori Produk","Product Category"]},
    {label:"Price",output:"Price",candidates:["Harga(Rp)","Harga","Price(Rp)","Price","Harga Jual"]},
    {label:"GMV / Sales",output:"GMV",candidates:["Omzet Penjualan(Rp)","Omzet Penjualan","GMV","Sales(Rp)","Sales","GMV dari kreator","GMV Afiliasi"],required:true},
    {label:"Items Sold",output:"Items sold",candidates:["Produk yang terjual dari kreator","Produk terjual","Produk Terjual","Items sold","Item Sold","Qty","Quantity"]},
    {label:"Orders",output:"Orders",candidates:["Pesanan teratribusi","Pesanan produk afiliasi","Pesanan","Orders","Order Count"]},
    {label:"Clicks",output:"Clicks",candidates:["Clicks","Klik"]},
    {label:"Commission",output:"Commission",candidates:["Perkiraan komisi","Estimasi Komisi(Rp)","Est. commission","Est.Commission(Rp)","Estimated Commission","Commission"]},
    {label:"Total Buyers",output:"Total Buyers",candidates:["Total Pembeli","Total Buyers","Buyers"]},
    {label:"New Buyers",output:"New Buyers",candidates:["Pembeli Baru","New Buyers"]},
    {label:"Samples",output:"Samples",candidates:["Sampel terkirim","Samples","Sampel"]},
    {label:"Sales Creator",output:"Sales Creator",candidates:["Sales creator","Sales Creator","Creator Sales"]},
    {label:"LIVE Streams",output:"LIVE streams",candidates:["LIVE streams","Live streams","Siaran LIVE","Siaran LIVE afiliasi"]},
    {label:"Videos",output:"Videos",candidates:["Video jualan afiliasi","Videos","Video","Jumlah Video"]},
    {label:"Refunded GMV",output:"Refunded GMV",candidates:["Refunded GMV","Pengembalian dana","Refund GMV"]},
    {label:"Refunded Items",output:"Refunded items sold",candidates:["Produk yang dikembalikan dananya","Refunded items sold","Refunded Items Sold","Item Refund"]},
    {label:"Flat Fee",output:"Est. flat fee",candidates:["Est. flat fee","Estimated flat fee","Flat fee"]},
    {label:"ROI",output:"ROI",candidates:["ROI"]},
    {label:"Store Name",output:"Store Name",candidates:["Store Name","Shop Name","Nama Toko","Toko","Seller Name","Store","Shop"]},
    {label:"Store ID",output:"Store ID",candidates:["Store ID","Shop ID","Seller ID","ID Toko"]},
  ],
  creators:[
    {label:"Creator Name",output:"Creator Name",candidates:["Nama Affiliate","Creator Name","Creator","Nama Creator"]},
    {label:"Username",output:"Username",candidates:["Username Affiliate","Username","Affiliate Username"]},
    {label:"Platform",output:"Platform",candidates:["Platform"]},
    {label:"Affiliate ID",output:"Affiliate ID",candidates:["ID Affiliates","Affiliate ID"]},
    {label:"Phone / WhatsApp",output:"Phone",candidates:["Phone","No HP","WhatsApp"]},
    {label:"Address",output:"Address",candidates:["Address","Alamat"]},
    {label:"Payment Type",output:"Payment Type",candidates:["Payment/Barter","Payment Type"]},
    {label:"Ratecard",output:"Ratecard",candidates:["Ratecard"]},
    {label:"Profile URL",output:"Profile URL",candidates:["Profile URL","Social Media","Profile Link"]},
    {label:"Status",output:"Status",candidates:["Status"]},
    {label:"Notes",output:"Notes",candidates:["Notes","Note","Catatan"]},
  ],
  products:[
    {label:"SKU Induk",output:"SKU",candidates:["SKU","Kode SKU"],required:true},
    {label:"Product Code / Item ID",output:"Product Code",candidates:["Product Code","Kode Produk","Product ID","Item ID","Item id","Kode Item","ID Produk"]},
    {label:"Product Name",output:"Product Name",candidates:["Product Name","Nama Produk"]},
    {label:"Variant",output:"Variant",candidates:["Variant","Variation","Variasi","Nama Variasi","Variant Name"]},
    {label:"Variant Slot",output:"Variant Slot",candidates:["Variant Slot","Variation Slot","Slot Variasi"]},
    {label:"Category",output:"Category",candidates:["Category","Kategori"]},
    {label:"Selling Price",output:"Selling Price",candidates:["Selling Price","Harga Jual"]},
    {label:"HPP / Cost Price",output:"Cost Price",candidates:["Cost Price","HPP","Harga Modal"]},
    {label:"Point per Unit",output:"Point per Unit",candidates:["Point per Unit","Point"]},
    {label:"Status",output:"Status",candidates:["Status"]},
    {label:"Notes",output:"Notes",candidates:["Notes","Note","Catatan"]},
  ],
  creator_samples:[
    {label:"Creator ID",output:"Creator ID",candidates:["creator_id","Creator ID"]},
    {label:"Creator Name",output:"Creator Name",candidates:["creator_name","Creator Name","Nama Creator"]},
    {label:"Platform",output:"Platform",candidates:["platform","Platform"]},
    {label:"SKU",output:"SKU",candidates:["sku","SKU","Kode SKU"]},
    {label:"Product Name",output:"Product Name",candidates:["product_name","Product Name","Nama Produk"]},
    {label:"Sample Status",output:"Sample Status",candidates:["sample_status","Sample Status"]},
    {label:"Sent Date",output:"Sent Date",candidates:["sent_date","Sent Date"]},
    {label:"Return Date",output:"Return Date",candidates:["return_date","Return Date"]},
    {label:"Qty",output:"Qty",candidates:["qty","Qty","Quantity"]},
    {label:"Product Value",output:"Product Value",candidates:["product_value","Product Value"]},
    {label:"Tracking",output:"Tracking",candidates:["tracking","Tracking","Resi","Nomor Resi"]},
    {label:"Notes",output:"Notes",candidates:["notes","Notes","Catatan"]},
  ],
  product_hpp:[
    {label:"SKU Induk",output:"SKU",candidates:["sku","SKU","Kode SKU"],required:true},
    {label:"Product Name",output:"Product Name",candidates:["product_name","Product Name","Nama Produk"]},
    {label:"HPP",output:"HPP",candidates:["hpp","HPP","Cost Price","Harga Modal"],required:true},
    {label:"Selling Price",output:"Selling Price",candidates:["selling_price","Selling Price","Harga Jual"]},
    {label:"Period",output:"Period",candidates:["period","Period","Periode"]},
    {label:"Notes",output:"Notes",candidates:["notes","Notes","Catatan"]},
  ],
};

function fieldsFor(dataType:string){
  const fields=[...(COMMON[dataType]||[])];
  if(dataType==="product_hpp")for(let i=1;i<=15;i++)fields.push({label:"Variasi "+i,output:"Variasi "+i,candidates:["Variasi "+i,"Variant "+i,"Variation "+i]});
  return fields;
}
function isValid(dataType:string,mapping:Record<string,string>){
  if(dataType==="performance"){
    const identity=Boolean(mapping["Creator Name"]||mapping["Username"]||mapping["Affiliate ID"]);
    const metric=Boolean(mapping["GMV"]||mapping["Qty"]||mapping["Orders"]||mapping["Commission"]);
    return identity&&metric;
  }
  if(dataType==="product_performance")return Boolean(mapping["Product ID"]&&mapping["Product Name"]&&mapping["GMV"]);
  if(dataType==="creators")return Boolean(mapping["Creator Name"]||mapping["Username"]);
  if(dataType==="products")return Boolean(mapping["SKU"]);
  if(dataType==="creator_samples")return Boolean(mapping["Creator ID"]||mapping["Creator Name"]);
  if(dataType==="product_hpp")return Boolean(mapping["SKU"]&&mapping["HPP"]);
  return true;
}
function requirementText(dataType:string){
  if(dataType==="performance")return"Minimal identitas creator + salah satu GMV / Qty / Orders / Commission.";
  if(dataType==="product_performance")return"Product ID, Product Name, dan GMV wajib terpetakan.";
  if(dataType==="creators")return"Creator Name atau Username wajib terpetakan.";
  if(dataType==="products")return"SKU Induk wajib terpetakan.";
  if(dataType==="creator_samples")return"Creator ID atau Creator Name wajib terpetakan.";
  if(dataType==="product_hpp")return"SKU Induk dan HPP wajib terpetakan.";
  return"";
}

export default function ImportMappingWizard({file,dataType,platform,workspaceId,onChange}:Props){
  const supabase=useMemo(()=>createClient(),[]);
  const fields=useMemo(()=>fieldsFor(dataType),[dataType]);
  const [rows,setRows]=useState<Row[]>([]);
  const [totalRows,setTotalRows]=useState(0);
  const [headers,setHeaders]=useState<string[]>([]);
  const [mapping,setMapping]=useState<Record<string,string>>({});
  const [detected,setDetected]=useState(platform);
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState("");
  const [saved,setSaved]=useState(false);

  useEffect(()=>{
    let alive=true;
    async function run(){
      setRows([]);setTotalRows(0);setHeaders([]);setMapping({});setMessage("");setSaved(false);
      if(!file){onChange({mapping:{},valid:false,detectedPlatform:platform,totalRows:0,headers:[]});return}
      setLoading(true);
      try{
        const parsed=await parseFile(file);
        if(!alive)return;
        if(!parsed.length){setMessage("File tidak memiliki data.");onChange({mapping:{},valid:false,detectedPlatform:platform,totalRows:0,headers:[]});return}
        const nextHeaders=Object.keys(parsed[0]||{});
        const nextDetected=(dataType==="performance"||dataType==="product_performance")?detectedPlatform(nextHeaders,platform):platform;
        const automatic=Object.fromEntries(fields.map(field=>[field.output,findHeader(nextHeaders,field.candidates)]));
        const sig=signature(nextHeaders);
        let nextMapping=automatic;let loaded=false;
        try{
          const {data:preset}=await supabase.from("import_mapping_presets").select("mapping")
            .eq("workspace_id",workspaceId).eq("data_type",dataType).eq("platform",nextDetected).eq("signature",sig).maybeSingle();
          if(preset?.mapping&&typeof preset.mapping==="object"){nextMapping={...automatic,...preset.mapping};loaded=true}
        }catch{}
        setRows(parsed.slice(0,5));setTotalRows(parsed.length);setHeaders(nextHeaders);setDetected(nextDetected);setMapping(nextMapping);
        setMessage(loaded?"Mapping workspace tersimpan ditemukan. Periksa preview sebelum import.":"Auto Map selesai. Periksa kolom yang belum sesuai.");
      }catch(error:any){
        if(!alive)return;setMessage(error?.message||"File tidak dapat dibaca.");
      }finally{if(alive)setLoading(false)}
    }
    void run();
    return()=>{alive=false};
  },[file,dataType,platform,workspaceId]);

  const valid=useMemo(()=>isValid(dataType,mapping),[dataType,mapping]);
  const mappedFields=useMemo(()=>fields.filter(field=>mapping[field.output]),[fields,mapping]);

  useEffect(()=>{
    onChange({mapping,valid,detectedPlatform:detected,totalRows,headers});
  },[mapping,valid,detected,headers,totalRows]);

  async function save(){
    if(!headers.length||!valid)return;
    const {error}=await supabase.from("import_mapping_presets").upsert({
      workspace_id:workspaceId,data_type:dataType,platform:detected,signature:signature(headers),
      name:"Mapping "+dataType+" · "+headers.length+" kolom",mapping,updated_at:new Date().toISOString()
    },{onConflict:"workspace_id,data_type,platform,signature"});
    if(error){setMessage(error.message);return}
    setSaved(true);setMessage("Mapping disimpan untuk format file ini.");
  }

  if(!file)return null;

  return <section className="import-mapping-wizard">
    <div className="import-wizard-steps">
      <div className="done"><span>01</span><b>Upload</b><i/></div>
      <div className={valid?"done":"active"}><span>02</span><b>Mapping</b><i/></div>
      <div className={valid?"active":""}><span>03</span><b>Preview</b><i/></div>
      <div><span>04</span><b>Import</b><i/></div>
    </div>

    {loading?<div className="import-preview-loading"><i/><span>Membaca header, platform, dan struktur file...</span></div>:headers.length>0&&<>
      <header className="import-wizard-summary">
        <div><span>FILE TERBACA</span><strong>{file.name}</strong><small>{totalRows.toLocaleString("id-ID")} row · {headers.length} kolom · {detected}</small></div>
        <div><b>{mappedFields.length}/{fields.length}</b><span>field terpetakan</span></div>
      </header>

      <div className="import-map-head"><div><h3>Mapping kolom</h3><p>{requirementText(dataType)}</p></div><div className="button-row"><button type="button" className="secondary" onClick={()=>setMapping(Object.fromEntries(fields.map(field=>[field.output,findHeader(headers,field.candidates)])))}>Auto Map</button><button type="button" className="secondary" disabled={!valid} onClick={()=>void save()}>{saved?"Mapping Tersimpan":"Simpan Mapping"}</button></div></div>

      <div className="import-map-grid">
        {fields.map(field=>{
          const source=mapping[field.output]||"";const sample=source?String(rows[0]?.[source]??""):"";
          return <label key={field.output} className={(field.required?"required ":"")+(source?"mapped":"unmapped")}>
            <span><b>{field.label}{field.required?" *":""}</b><small>→ {field.output}</small></span>
            <select value={source} onChange={event=>{setSaved(false);setMapping(current=>({...current,[field.output]:event.target.value}))}}>
              <option value="">Tidak dipakai</option>
              {headers.map(header=><option value={header} key={header}>{header}</option>)}
            </select>
            <em title={sample}>{sample||"—"}</em>
          </label>
        })}
      </div>

      <div className={valid?"import-validation-ok":"import-validation-alert"}><b>{valid?"Mapping siap.":"Mapping belum siap."}</b><span>{valid?"Periksa 5 row preview sebelum menekan Import Data.":requirementText(dataType)}</span></div>

      {valid&&<div className="import-preview-block">
        <div className="import-map-head"><div><h3>Preview sebelum import</h3><p>Nilai di bawah berasal dari source column yang baru Anda petakan.</p></div><span className="role-badge">5 row preview</span></div>
        <div className="import-preview-table"><table><thead><tr>{mappedFields.slice(0,9).map(field=><th key={field.output}>{field.label}</th>)}</tr></thead><tbody>
          {rows.map((row,index)=><tr key={index}>{mappedFields.slice(0,9).map(field=><td key={field.output}>{String(row[mapping[field.output]]??"")||"—"}</td>)}</tr>)}
        </tbody></table></div>
      </div>}
    </>}

    {message&&<div className="import-wizard-note">{message}</div>}
  </section>;
}
