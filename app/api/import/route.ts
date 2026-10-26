import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerContext } from "../../../lib/server-auth";

export const runtime = "nodejs";
type Row = Record<string, any>;
const PARSER_VERSION = "universal-v13-pr47-20261026";

const clean = (v: any) => (v === null || v === undefined ? "" : String(v).trim());
type NumericKind = "money" | "count" | "percent" | "decimal";

function num(v: any, kind: NumericKind = "decimal") {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;

  let raw = clean(v).replace(/\u00a0/g, " ").trim();
  if (!raw) return 0;

  // Preserve scientific notation from exports such as 1.3E+06.
  const scientific = raw
    .replace(/Rp|IDR|USD/gi, "")
    .replace(/%/g, "")
    .replace(/\s+/g, "")
    .replace(",", ".");
  if (/^[+\-]?\d+(?:\.\d+)?[eE][+\-]?\d+$/.test(scientific)) {
    const n = Number(scientific);
    return Number.isFinite(n) ? n : 0;
  }

  const negative = /^\s*\(.*\)\s*$/.test(raw);
  let s = raw
    .replace(/[()]/g, "")
    .replace(/Rp|IDR|USD/gi, "")
    .replace(/%/g, "")
    .replace(/[\s']/g, "")
    .replace(/[^0-9,.+\-]/g, "");
  if (!s) return 0;

  const sign = s.startsWith("-") ? -1 : 1;
  s = s.replace(/^[+\-]/, "");

  if (kind === "count") {
    // Counts are whole units. Both Indonesian and English thousands separators
    // are removed: 1.300, 1,300, 12.000 -> 1300 / 1300 / 12000.
    const digits = s.replace(/[.,]/g, "");
    const n = Number(digits);
    return Number.isFinite(n) ? (negative ? -Math.abs(n) : sign * n) : 0;
  }

  const comma = s.lastIndexOf(",");
  const dot = s.lastIndexOf(".");
  const normalizeSingle = (separator: "," | ".") => {
    const parts = s.split(separator);
    if (parts.length > 2) {
      const allGroups = parts.slice(1).every((part) => part.length === 3);
      if (allGroups) return parts.join("");
      const decimal = parts.pop() || "";
      return parts.join("") + (decimal ? "." + decimal : "");
    }
    const left = parts[0] || "0";
    const right = parts[1] || "";
    if (!right) return left;

    if (kind === "money") {
      // IDR exports frequently use either 1.300 or 1,300 as thousands.
      // A final 1-2 digit group is treated as decimal cents; 3 digits is grouping.
      if (right.length === 3) {
        if (/Rp|IDR|USD/i.test(raw) || left.length <= 3) return left + right;
        return left + "." + right;
      }
      if (right.length <= 2) return left + "." + right;
      return left + right;
    }

    // Percent / generic decimal: one separator is decimal unless it is a
    // clear 3-digit thousands group with a short integer prefix.
    if (right.length === 3 && left.length <= 3) return left + right;
    return left + "." + right;
  };

  let normalized = s;
  if (comma >= 0 && dot >= 0) {
    // When both separators exist, the final separator is decimal only when
    // its suffix is 1-2 digits. Otherwise both are thousands separators.
    const last = Math.max(comma, dot);
    const suffix = s.slice(last + 1);
    if (suffix.length > 0 && suffix.length <= 2) {
      const decimalSep = comma > dot ? "," : ".";
      const groupSep = decimalSep === "," ? "." : ",";
      normalized = s.split(groupSep).join("").replace(decimalSep, ".");
    } else {
      normalized = s.replace(/[.,]/g, "");
    }
  } else if (comma >= 0) {
    normalized = normalizeSingle(",");
  } else if (dot >= 0) {
    normalized = normalizeSingle(".");
  }

  const n = Number(normalized);
  if (!Number.isFinite(n)) return 0;
  const signed = sign * n;
  return negative ? -Math.abs(signed) : signed;
}

const moneyNum = (v:any) => num(v, "money");
const countNum = (v:any) => num(v, "count");
const percentNum = (v:any) => num(v, "percent");

type MoneyStyle = "decimal-dot" | "decimal-comma" | "grouped";

function inferMoneyStyle(rows:Row[],header:string):MoneyStyle{
  if(!header)return "grouped";
  let dotDecimal=0,commaDecimal=0,grouped=0;
  for(const row of rows.slice(0,500)){
    const value=row?.[header];
    if(value===null||value===undefined||value===""||typeof value==="number")continue;
    const raw=String(value).trim();
    const hasCurrency=/Rp|IDR|USD/i.test(raw);
    const s=raw.replace(/Rp|IDR|USD/gi,"").replace(/\s+/g,"").replace(/[^0-9,.+\-]/g,"").replace(/^[+\-]/,"");
    if(!s)continue;
    const dots=(s.match(/\./g)||[]).length,commas=(s.match(/,/g)||[]).length;
    if(dots&&commas){
      const lastDot=s.lastIndexOf("."),lastComma=s.lastIndexOf(",");
      const last=Math.max(lastDot,lastComma),suffix=s.slice(last+1);
      if(suffix.length<=2){if(lastDot>lastComma)dotDecimal+=4;else commaDecimal+=4}else grouped+=3;
      continue;
    }
    const sep=dots?".":commas?",":"";
    if(!sep)continue;
    const parts=s.split(sep);
    if(parts.length>2){if(parts.slice(1).every(part=>part.length===3))grouped+=4;continue}
    const left=(parts[0]||"").replace(/^[-+]/,""),right=parts[1]||"";
    if(hasCurrency&&right.length===3){grouped+=3;continue}
    if(right.length<=2&&right.length>0){if(sep===".")dotDecimal+=2;else commaDecimal+=2;continue}
    if(right.length===3){
      // Three trailing digits are ambiguous. Treat short prefixes as a clear
      // thousands group, but do not infer a decimal convention from this case
      // alone. Decimal style requires stronger evidence (1-2 decimal digits).
      if(left.length<=3)grouped+=2;
    }
  }
  if(dotDecimal>=commaDecimal&&dotDecimal>grouped)return "decimal-dot";
  if(commaDecimal>dotDecimal&&commaDecimal>grouped)return "decimal-comma";
  return "grouped";
}

function moneyValue(v:any,style:MoneyStyle){
  if(typeof v==="number")return Number.isFinite(v)?v:0;
  const raw=clean(v);
  if(!raw)return 0;
  const hasCurrency=/Rp|IDR|USD/i.test(raw);
  let s=raw.replace(/[()]/g,"").replace(/Rp|IDR|USD/gi,"").replace(/\s+/g,"").replace(/[^0-9,.+\-]/g,"");
  const negative=/^\s*\(.*\)\s*$/.test(raw)||s.startsWith("-");
  s=s.replace(/^[+\-]/,"");
  const dots=(s.match(/\./g)||[]).length,commas=(s.match(/,/g)||[]).length;
  let normalized=s;
  if(dots&&commas){
    const lastDot=s.lastIndexOf("."),lastComma=s.lastIndexOf(",");
    const last=Math.max(lastDot,lastComma),suffix=s.slice(last+1);
    if(suffix.length>0&&suffix.length<=2){
      const decimalSep=lastDot>lastComma?".":",",groupSep=decimalSep==="."?",":".";
      normalized=s.split(groupSep).join("").replace(decimalSep,".");
    }else normalized=s.replace(/[.,]/g,"");
  }else if(dots||commas){
    const sep=dots?".":",",parts=s.split(sep);
    if(parts.length>2)normalized=parts.join("");
    else{
      const left=parts[0]||"0",right=parts[1]||"";
      if(right.length===3){
        const definitelyGrouped=hasCurrency||left.length<=3||style==="grouped";
        normalized=definitelyGrouped?left+right:left+"."+right;
      }else if(right.length>0&&right.length<=2)normalized=left+"."+right;
      else normalized=left+right;
    }
  }
  const n=Number(normalized);
  if(!Number.isFinite(n))return 0;
  return negative?-Math.abs(n):n;
}
const norm = (v: any) => clean(v).toLowerCase().replace(/[^a-z0-9]+/g, "");
function key(row: Row, candidates: string[], fuzzy = true) {
  const keys = Object.keys(row || {});
  for (const c of candidates) { const hit = keys.find((k) => norm(k) === norm(c)); if (hit) return hit; }
  if (fuzzy) for (const k of keys) { const nk = norm(k); const hit = candidates.some((c) => nk.includes(norm(c)) || norm(c).includes(nk)); if (hit) return k; }
  return "";
}
function value(row: Row, candidates: string[], fuzzy = true) { const k = key(row, candidates, fuzzy); return k ? row[k] : ""; }
function dateValue(v: any, fallback: string) { if (!v) return fallback; const d = new Date(v); return Number.isNaN(d.getTime()) ? fallback : d.toISOString().slice(0, 10); }
const creatorCode = () => `CR-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
const money=(v:any)=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(v||0));
const iso=(d:Date)=>d.toISOString().slice(0,10);

async function notifyTopCreators(admin:any,workspaceId:string,userId:string){
  const {data:latest}=await admin.from("sales").select("data_date").eq("workspace_id",workspaceId).not("data_date","is",null).order("data_date",{ascending:false}).limit(1).maybeSingle();
  if(!latest?.data_date)return;
  const end=new Date(`${latest.data_date}T00:00:00Z`);
  const weekStart=new Date(end);weekStart.setUTCDate(weekStart.getUTCDate()-6);
  const monthStart=new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth(),1));
  const periods=[
    {key:"daily",label:"Hari",start:iso(end),end:iso(end)},
    {key:"weekly",label:"7 Hari",start:iso(weekStart),end:iso(end)},
    {key:"monthly",label:"Bulan",start:iso(monthStart),end:iso(end)},
  ];
  for(const period of periods){
    const {data}=await admin.rpc("get_creator_ranking",{p_workspace_id:workspaceId,p_start_date:period.start,p_end_date:period.end,p_platform:null,p_creator_id:null,p_search:null,p_page:1,p_page_size:3});
    const top=(data||[]).slice(0,3);
    if(!top.length)continue;
    const body=top.map((x:any,i:number)=>`${i+1}. ${x.creator_name||x.username||"Creator"} · ${x.platform||"-"} · ${money(x.gmv)} · ${Number(x.orders||0).toLocaleString("id-ID")} order`).join("\n");
    await admin.from("user_notifications").insert({
      user_id:userId,workspace_id:workspaceId,
      title:`🔥 Top 3 Creator On Fire · ${period.label}`,
      message:`Periode ${period.start} s.d. ${period.end}\n${body}`,
      kind:`creator_on_fire_${period.key}`,is_read:false,action_url:"#dashboard"
    });
  }
}

function detectedPlatform(rows: Row[], requested: string) {
  const headers = Object.keys(rows[0] || {}).map(norm);
  const has = (...terms:string[]) => terms.some(term => headers.some(header => header.includes(norm(term))));
  if (has("GMV dari kreator","GMV Afiliasi","Pesanan teratribusi","Pesanan produk afiliasi","Perkiraan komisi","Produk terjual","GMV dari LIVE kreator","GMV LIVE afiliasi","GMV dari video afiliasi","Video jualan afiliasi","Product ID","LIVE streams","Refunded GMV","Refunded items sold")) return "TikTok";
  if (has("Omzet Penjualan","Estimasi Komisi","ID Affiliates","Nama Affiliate","Affiliate ID","Affiliate Name","Affiliate Username","Sales(Rp)","Item Sold","Est.Commission(Rp)","Total Buyers","Kode Item","Nama Item","Item id","Item Name","Price(Rp)","Produk Terjual")) return "Shopee";
  return requested || "Other";
}

type PerformanceMapping = {
  creatorName:string; username:string; affiliateId:string;
  gmv:string; qty:string; orders:string; commission:string; refund:string;
  clicks:string; buyers:string; newBuyers:string; liveGmv:string; videoGmv:string; showcaseGmv:string;
  ctr:string; ctor:string; liveCount:string; videoCount:string; sampleContent:string; sampleSent:string; impressions:string; videoViews:string; refundQty:string;
};

function findHeader(row:Row,candidates:string[],exclude:string[]=[]){
  const headers=Object.keys(row||{});
  const excluded=exclude.map(norm).filter(Boolean);
  const allowed=(header:string)=>!excluded.some(token=>norm(header).includes(token));
  for(const candidate of candidates){
    const exact=headers.find(header=>allowed(header)&&norm(header)===norm(candidate));
    if(exact)return exact;
  }
  for(const candidate of candidates){
    const nc=norm(candidate);
    if(nc.length<3)continue;
    const loose=headers.find(header=>{
      if(!allowed(header))return false;
      const nh=norm(header);
      return nh.includes(nc)||nc.includes(nh);
    });
    if(loose)return loose;
  }
  return "";
}

function performanceMapping(row:Row,platform:string):PerformanceMapping{
  const common={
    creatorName:findHeader(row,["Kreator","Nama Kreator","Creator Name","Creator name","Nama Affiliate","Nama Afiliasi","Affiliate Name","Nama Creator","Creator","Akun Kreator","Username Affiliate","Username"]),
    username:findHeader(row,["Username Affiliate","Username","Affiliate Username","Nama Pengguna","Creator Username","Username Kreator","Nama Pengguna Kreator","Handle Kreator","Handle"]),
    affiliateId:findHeader(row,["ID Affiliates","Affiliate ID","ID Affiliate","Creator ID","ID Kreator","Kreator ID","UID Kreator","Creator UID"]),
    gmv:findHeader(row,["GMV dari kreator","GMV Afiliasi","GMV Kreator","Creator GMV","Omzet Penjualan(Rp)","Omzet Penjualan","Sales(Rp)","Sales Rp","Sales","Total GMV","GMV","Total Penjualan","Nilai Penjualan","Sales Amount","Revenue"],["rate","persentase","growth"]),
    qty:findHeader(row,["Produk yang terjual dari kreator","Produk terjual","Produk Terjual","Jumlah Produk Terjual","Unit Terjual","Item Terjual","Item Sold","Items Sold","Qty Paid","Qty","Quantity","Units Sold"]),
    orders:findHeader(row,["Pesanan teratribusi","Pesanan produk afiliasi","Pesanan Afiliasi","Pesanan","Jumlah Pesanan","Total Pesanan","Attributed Orders","Orders","Order Count"],["id","rate"]),
    commission:findHeader(row,["Perkiraan komisi","Estimasi Komisi(Rp)","Estimasi Komisi","Est.Commission(Rp)","Est. Commission(Rp)","Est Commission(Rp)","Est.Commission","Estimated Commission(Rp)","Estimated Commission","Komisi Affiliate","Komisi Afiliasi","Total Komisi","Commission","Komisi"],["rate","tingkat","persentase","percentage"]),
    refund:findHeader(row,["Pengembalian dana","Refund","Refund Amount","Nilai Refund","Refunded GMV"]),
    clicks:findHeader(row,["Clicks","Klik Produk","Product Clicks","Klik"]),
    buyers:findHeader(row,["Total Pembeli","Pembeli","Buyers","Jumlah Pembeli","Rata-rata pembeli afiliasi"],["baru","new"]),
    newBuyers:findHeader(row,["Pembeli Baru","New Buyers","New Buyer"]),
    liveGmv:findHeader(row,["GMV dari LIVE kreator","GMV LIVE kreator","GMV LIVE afiliasi","LIVE GMV","Live GMV","GMV Live"]),
    videoGmv:findHeader(row,["GMV dari video afiliasi","GMV video jualan afiliasi","GMV Video Afiliasi","Video GMV","GMV Video"]),
    showcaseGmv:findHeader(row,["GMV dari kartu produk afiliasi","GMV kartu produk afiliasi","Showcase GMV","Product Card GMV","GMV Showcase"]),
    ctr:findHeader(row,["CTR","Click Through Rate"]),
    ctor:findHeader(row,["CTOR","Click To Order Rate"]),
    liveCount:findHeader(row,["Siaran LIVE afiliasi","Siaran LIVE","Jumlah LIVE","Live Count","LIVE sessions","LIVE streams","Total LIVE"],["gmv","revenue","sales","amount"]),
    videoCount:findHeader(row,["Video jualan afiliasi","Jumlah Video","Video Count","Video","Videos"],["gmv","view","tayangan"]),
    sampleContent:findHeader(row,["Jumlah konten sampel","Sample Content","Konten Sampel"]),
    sampleSent:findHeader(row,["Sampel terkirim","Sample Sent","Samples Sent","Sampel"]),
    impressions:findHeader(row,["Impresi produk","Product Impressions","Impressions","Impresi"]),
    videoViews:findHeader(row,["Tayangan video","Video Views","Views Video"]),
    refundQty:findHeader(row,["Produk yang dikembalikan dananya","Affiliate refunded items sold","Refunded items sold","Refunded Items","Item Refund","Produk Refund"],["gmv","amount"])
  };
  if(platform.toLowerCase()==="shopee"){
    common.gmv=common.gmv||findHeader(row,["Sales(Rp)","Sales Rp","Penjualan Affiliate","Penjualan Afiliasi","Sales"]);
    common.orders=common.orders||findHeader(row,["Orders","Pesanan dari Affiliate","Pesanan Afiliasi"]);
    common.qty=common.qty||findHeader(row,["Item Sold","Items Sold","Produk Terjual dari Affiliate","Produk dari Affiliate"]);
    common.commission=common.commission||findHeader(row,["Est.Commission(Rp)","Est. Commission(Rp)","Est Commission(Rp)","Estimated Commission(Rp)","Estimated Commission"]);
    common.clicks=common.clicks||findHeader(row,["Clicks"]);
    common.buyers=common.buyers||findHeader(row,["Total Buyers"]);
    common.newBuyers=common.newBuyers||findHeader(row,["New Buyers"]);
  }
  return common;
}

function mappedRaw(row:Row,keyName:string){return keyName?row[keyName]:""}

function mappingSummary(mapping:PerformanceMapping){
  return Object.fromEntries(Object.entries(mapping).filter(([,header])=>Boolean(header)));
}

type ProductPerformanceMapping={
  sku:string; productName:string; category:string; price:string; gmv:string; qty:string; orders:string; clicks:string;
  commission:string; buyers:string; newBuyers:string; samples:string; salesCreator:string; liveCount:string;
  videoCount:string; refund:string; refundQty:string; flatFee:string; roi:string;
};
function productPerformanceMapping(row:Row,platform:string):ProductPerformanceMapping{
  const common={
    sku:findHeader(row,["Kode Item","Product ID","Item ID","Kode Produk","SKU","ID Produk"]),
    productName:findHeader(row,["Nama Item","Item Name","Product name","Product Name","Nama Produk","Produk"]),
    category:findHeader(row,["Kategori","Category","Kategori Produk","Product Category","Main Category","Kategori Utama"]),
    price:findHeader(row,["Harga(Rp)","Harga","Price(Rp)","Price","Harga Jual"]),
    gmv:findHeader(row,["GMV dari kreator","GMV Afiliasi","Omzet Penjualan(Rp)","Omzet Penjualan","GMV","Sales(Rp)","Sales","Total GMV"],["rate","persentase","growth"]),
    qty:findHeader(row,["Produk yang terjual dari kreator","Produk terjual","Produk Terjual","Items sold","Item Sold","Qty","Quantity","Unit Terjual"]),
    orders:findHeader(row,["Pesanan teratribusi","Pesanan produk afiliasi","Pesanan Afiliasi","Pesanan","Orders","Order Count"]),
    clicks:findHeader(row,["Clicks","Klik"]),
    commission:findHeader(row,["Perkiraan komisi","Estimasi Komisi(Rp)","Est. commission","Est.Commission(Rp)","Estimated Commission","Commission"]),
    buyers:findHeader(row,["Total Pembeli","Total Buyers","Buyers"]),
    newBuyers:findHeader(row,["Pembeli Baru","New Buyers"]),
    samples:findHeader(row,["Sampel terkirim","Samples","Sampel"]),
    salesCreator:findHeader(row,["Sales creator","Sales Creator","Creator Sales"]),
    liveCount:findHeader(row,["LIVE streams","Live streams","LIVE Streams","Siaran LIVE","Siaran LIVE afiliasi"]),
    videoCount:findHeader(row,["Videos","Video","Jumlah Video","Video jualan afiliasi"]),
    refund:findHeader(row,["Pengembalian dana","Refunded GMV","Refund GMV"]),
    refundQty:findHeader(row,["Produk yang dikembalikan dananya","Refunded items sold","Refunded Items Sold","Item Refund"]),
    flatFee:findHeader(row,["Est. flat fee","Estimated flat fee","Flat fee"]),
    roi:findHeader(row,["ROI"])
  };
  return common;
}
function productMappingSummary(mapping:ProductPerformanceMapping){
  return Object.fromEntries(Object.entries(mapping).filter(([,header])=>Boolean(header)));
}

function creatorKeys(row: Row) {
  const name = clean(value(row, ["Kreator","Nama Kreator","Creator name","Creator Name","Nama Affiliate","Nama Afiliasi","Affiliate Name","Creator","Nama Creator","Akun Kreator","Username Affiliate","Username"]));
  const username = clean(value(row, ["Username Affiliate","Username","Affiliate Username","Creator Username","Nama Pengguna","Username Kreator","Nama Pengguna Kreator","Handle Kreator","Kreator"]));
  const affiliateId = clean(value(row, ["ID Affiliates","Affiliate ID","ID Affiliate","Creator ID","ID Kreator","Kreator ID","UID Kreator","Creator UID"]));
  return {
    name,
    username,
    affiliateId,
    keys: [
      username ? `u:${username.toLowerCase()}` : "",
      affiliateId ? `a:${affiliateId.toLowerCase()}` : "",
      name ? `n:${name.toLowerCase()}` : "",
    ].filter(Boolean),
  };
}

async function resolveCreatorIds(admin:any,workspaceId:string,rows:Row[],platform:string,importId:string){
  const identityKey=(name:string,username:string)=>`${String(username||name||"").trim().toLowerCase()}|${platform.trim().toLowerCase()||"other"}`;
  const map=new Map<string,number>();
  const register=(row:any)=>{
    const id=Number(row.id);
    const key=String(row.identity_key||identityKey(String(row.name||""),String(row.username||"")));
    if(key)map.set(`i:${key}`,id);
    if(row.affiliate_id)map.set(`a:${String(row.affiliate_id).trim().toLowerCase()}`,id);
  };

  const identities=new Map<string,{name:string;username:string;affiliateId:string}>();
  for(let idx=0; idx<rows.length; idx++){
    const row=rows[idx];
    let identity=creatorKeys(row);
    if(!identity.name&&!identity.username&&!identity.affiliateId){
      const gmvVal = num(value(row, ["GMV dari kreator","GMV Afiliasi","GMV Kreator","Total GMV","GMV","Sales(Rp)","Sales","Omzet Penjualan"]), "money");
      const ordersVal = num(value(row, ["Pesanan teratribusi","Pesanan produk afiliasi","Pesanan","Orders"]), "count");
      const qtyVal = num(value(row, ["Produk yang terjual dari kreator","Produk terjual","Items sold","Qty"]), "count");
      if(gmvVal !== 0 || ordersVal !== 0 || qtyVal !== 0){
        const fallbackName = "Afiliasi Lainnya (Tanpa Nama)";
        const fallbackUsername = `unnamed_creator_${idx + 1}`;
        identity = {
          name: fallbackName,
          username: fallbackUsername,
          affiliateId: "",
          keys: [`u:${fallbackUsername}`, `n:${fallbackName.toLowerCase()}`]
        };
      } else {
        continue;
      }
    }
    const key=identityKey(identity.name,identity.username);
    identities.set(key,{name:identity.name,username:identity.username,affiliateId:identity.affiliateId});
  }

  const identityKeys=[...identities.keys()];
  for(let i=0;i<identityKeys.length;i+=400){
    const part=identityKeys.slice(i,i+400);
    const {data,error}=await admin.from("creators")
      .select("id,name,username,affiliate_id,identity_key")
      .eq("workspace_id",workspaceId)
      .is("merged_into_creator_id",null)
      .in("identity_key",part);
    if(error)throw error;
    for(const row of data||[])register(row);
  }

  const affiliateIds=[...new Set([...identities.values()].map(x=>x.affiliateId.trim().toLowerCase()).filter(Boolean))];
  for(let i=0;i<affiliateIds.length;i+=400){
    const part=affiliateIds.slice(i,i+400);
    const {data,error}=await admin.from("creators")
      .select("id,name,username,affiliate_id,identity_key")
      .eq("workspace_id",workspaceId)
      .is("merged_into_creator_id",null)
      .ilike("platform",platform)
      .in("affiliate_id",part);
    if(error)throw error;
    for(const row of data||[])register(row);
  }

  // PR76C: merged creator identities remain resolvable through persistent aliases.
  // This prevents a future marketplace upload from recreating an archived duplicate.
  const aliasKeys=[...new Set([
    ...identityKeys.map(key=>`i:${key}`),
    ...affiliateIds.map(id=>`a:${id}`)
  ])];
  for(let i=0;i<aliasKeys.length;i+=400){
    const part=aliasKeys.slice(i,i+400);
    const {data,error}=await admin.from("creator_identity_aliases")
      .select("alias_key,canonical_creator_id")
      .eq("workspace_id",workspaceId)
      .in("alias_key",part);
    if(error)throw error;
    for(const alias of data||[]){
      const id=Number(alias.canonical_creator_id||0);
      if(alias.alias_key&&id)map.set(String(alias.alias_key),id);
    }
  }

  const missing=new Map<string,any>();
  for(const identity of identities.values()){
    const ikey=identityKey(identity.name,identity.username);
    const affiliateKey=identity.affiliateId?`a:${identity.affiliateId.trim().toLowerCase()}`:"";
    if(map.has(`i:${ikey}`)||(affiliateKey&&map.has(affiliateKey)))continue;
    if(!missing.has(ikey))missing.set(ikey,{
      workspace_id:workspaceId,creator_code:creatorCode(),name:identity.name||identity.username,
      username:identity.username||identity.name,platform,affiliate_id:identity.affiliateId||null,
      status:"Active",source_import_id:importId,updated_at:new Date().toISOString()
    });
  }

  const pending=[...missing.values()];
  for(let i=0;i<pending.length;i+=400){
    const part=pending.slice(i,i+400);
    const {data:created,error:createError}=await admin.from("creators").insert(part).select("id,name,username,affiliate_id,identity_key");
    if(createError)throw createError;
    for(const row of created||[])register(row);
  }

  return (row:Row, idx:number=0)=>{
    let identity=creatorKeys(row);
    if(!identity.name&&!identity.username&&!identity.affiliateId){
      const gmvVal = num(value(row, ["GMV dari kreator","GMV Afiliasi","GMV Kreator","Total GMV","GMV","Sales(Rp)","Sales","Omzet Penjualan"]), "money");
      const ordersVal = num(value(row, ["Pesanan teratribusi","Pesanan produk afiliasi","Pesanan","Orders"]), "count");
      const qtyVal = num(value(row, ["Produk yang terjual dari kreator","Produk terjual","Items sold","Qty"]), "count");
      if(gmvVal !== 0 || ordersVal !== 0 || qtyVal !== 0){
        const fallbackUsername = `unnamed_creator_${idx + 1}`;
        const key=identityKey("Afiliasi Lainnya (Tanpa Nama)", fallbackUsername);
        return map.get(`i:${key}`)||null;
      }
      return null;
    }
    if(identity.affiliateId){
      const affiliateHit=map.get(`a:${identity.affiliateId.trim().toLowerCase()}`);
      if(affiliateHit)return affiliateHit;
    }
    const key=identityKey(identity.name,identity.username);
    return map.get(`i:${key}`)||null;
  };
}

async function ensureCreator(admin: any, workspaceId: string, row: Row, platform: string, importId: string) {
  const name = clean(value(row, ["Kreator", "Nama Kreator", "Creator name", "Creator Name", "Nama Affiliate", "Creator", "Nama Creator", "Akun Kreator"]));
  const username = clean(value(row, ["Username Affiliate", "Username", "Affiliate Username", "Username Kreator", "Nama Pengguna Kreator", "Kreator"]));
  const affiliateId = clean(value(row, ["ID Affiliates", "Affiliate ID", "ID Kreator", "Creator ID"]));
  if (!name && !username) return null;
  let q = admin.from("creators").select("id").eq("workspace_id", workspaceId).is("merged_into_creator_id",null).ilike("platform", platform).limit(1);
  if (username) q = q.ilike("username", username); else if (affiliateId) q = q.eq("affiliate_id", affiliateId); else q = q.ilike("name", name);
  const { data: existing } = await q.maybeSingle(); if (existing?.id) return existing.id;
  const { data, error } = await admin.from("creators").insert({ workspace_id:workspaceId,creator_code:creatorCode(),name:name||username,username:username||name,platform,affiliate_id:affiliateId||null,status:"Active",source_import_id:importId,updated_at:new Date().toISOString() }).select("id").single();
  if (error) throw error; return data.id;
}

function mergePerformancePayload(existing: Row, incoming: Row): Row {
  return {
    ...existing,
    creator_name: incoming.creator_name || existing.creator_name,
    username: incoming.username || existing.username,
    sku: incoming.sku || existing.sku,
    product_name: incoming.product_name || existing.product_name,
    category: incoming.category || existing.category,
    store_name: incoming.store_name || existing.store_name,
    store_id: incoming.store_id || existing.store_id,
    channel: incoming.channel || existing.channel,
    qty: (Number(existing.qty) || 0) + (Number(incoming.qty) || 0),
    orders: (Number(existing.orders) || 0) + (Number(incoming.orders) || 0),
    gmv: (Number(existing.gmv) || 0) + (Number(incoming.gmv) || 0),
    refund: (Number(existing.refund) || 0) + (Number(incoming.refund) || 0),
    refund_qty: (Number(existing.refund_qty) || 0) + (Number(incoming.refund_qty) || 0),
    commission: (Number(existing.commission) || 0) + (Number(incoming.commission) || 0),
    cost_product: (Number(existing.cost_product) || 0) + (Number(incoming.cost_product) || 0),
    shipping_cost: (Number(existing.shipping_cost) || 0) + (Number(incoming.shipping_cost) || 0),
    ads_spend: (Number(existing.ads_spend) || 0) + (Number(incoming.ads_spend) || 0),
    points: (Number(existing.points) || 0) + (Number(incoming.points) || 0),
    clicks: (Number(existing.clicks) || 0) + (Number(incoming.clicks) || 0),
    buyers: (Number(existing.buyers) || 0) + (Number(incoming.buyers) || 0),
    new_buyers: (Number(existing.new_buyers) || 0) + (Number(incoming.new_buyers) || 0),
    live_gmv: (Number(existing.live_gmv) || 0) + (Number(incoming.live_gmv) || 0),
    video_gmv: (Number(existing.video_gmv) || 0) + (Number(incoming.video_gmv) || 0),
    showcase_gmv: (Number(existing.showcase_gmv) || 0) + (Number(incoming.showcase_gmv) || 0),
    live_count: (Number(existing.live_count) || 0) + (Number(incoming.live_count) || 0),
    video_count: (Number(existing.video_count) || 0) + (Number(incoming.video_count) || 0),
    sample_content: (Number(existing.sample_content) || 0) + (Number(incoming.sample_content) || 0),
    sample_sent: (Number(existing.sample_sent) || 0) + (Number(incoming.sample_sent) || 0),
    impressions: (Number(existing.impressions) || 0) + (Number(incoming.impressions) || 0),
    video_views: (Number(existing.video_views) || 0) + (Number(incoming.video_views) || 0),
    ctr: Math.max(Number(existing.ctr) || 0, Number(incoming.ctr) || 0),
    ctor: Math.max(Number(existing.ctor) || 0, Number(incoming.ctor) || 0),
    updated_at: incoming.updated_at || existing.updated_at
  };
}

function mergeProductPerformancePayload(existing: Row, incoming: Row): Row {
  return {
    ...existing,
    product_name: incoming.product_name || existing.product_name,
    category: incoming.category || existing.category,
    store_name: incoming.store_name || existing.store_name,
    store_id: incoming.store_id || existing.store_id,
    variant_name: incoming.variant_name || existing.variant_name,
    qty: (Number(existing.qty) || 0) + (Number(incoming.qty) || 0),
    orders: (Number(existing.orders) || 0) + (Number(incoming.orders) || 0),
    gmv: (Number(existing.gmv) || 0) + (Number(incoming.gmv) || 0),
    refund: (Number(existing.refund) || 0) + (Number(incoming.refund) || 0),
    refund_qty: (Number(existing.refund_qty) || 0) + (Number(incoming.refund_qty) || 0),
    commission: (Number(existing.commission) || 0) + (Number(incoming.commission) || 0),
    clicks: (Number(existing.clicks) || 0) + (Number(incoming.clicks) || 0),
    buyers: (Number(existing.buyers) || 0) + (Number(incoming.buyers) || 0),
    new_buyers: (Number(existing.new_buyers) || 0) + (Number(incoming.new_buyers) || 0),
    live_count: (Number(existing.live_count) || 0) + (Number(incoming.live_count) || 0),
    video_count: (Number(existing.video_count) || 0) + (Number(incoming.video_count) || 0),
    sample_sent: (Number(existing.sample_sent) || 0) + (Number(incoming.sample_sent) || 0),
    sales_creator: (Number(existing.sales_creator) || 0) + (Number(incoming.sales_creator) || 0),
    flat_fee: (Number(existing.flat_fee) || 0) + (Number(incoming.flat_fee) || 0),
    roi: Math.max(Number(existing.roi) || 0, Number(incoming.roi) || 0),
    updated_at: incoming.updated_at || existing.updated_at
  };
}

export async function POST(req: NextRequest) {
  try {
    const b=await req.json(); const workspaceId=clean(b.workspace_id); const dataType=clean(b.data_type); const requestedPlatform=clean(b.platform)||"Other"; const start=clean(b.start_date); const end=clean(b.end_date); const filename=clean(b.filename)||"upload"; const fileHash=clean(b.file_hash); const uploadStoreName=clean(b.store_name); const uploadStoreId=clean(b.store_id); const importId=clean(b.import_id)||`IMP-${randomUUID().replace(/-/g,"").slice(0,8).toUpperCase()}`; const mappingOverrides:Record<string,string>=b.mapping_overrides&&typeof b.mapping_overrides==="object"?b.mapping_overrides:{}; let rows:Row[]=Array.isArray(b.rows)?b.rows:[]; if(Object.keys(mappingOverrides).length){rows=rows.map(row=>{const nextRow:Row={...row};for(const [target,source] of Object.entries(mappingOverrides)){if(source&&Object.prototype.hasOwnProperty.call(row,source))nextRow[target]=row[source]}return nextRow})} const platform=(dataType==="performance"||dataType==="product_performance")?detectedPlatform(rows,requestedPlatform):requestedPlatform; const batchIndex=Number(b.batch_index||0); const totalBatches=Math.max(1,Number(b.total_batches||1)); const force=Boolean(b.force_reimport);
    if(!workspaceId||!dataType||!rows.length)return NextResponse.json({ok:false,error:"Workspace, jenis data, dan rows wajib diisi."},{status:400});
    const ctx=await getServerContext(workspaceId); if(!ctx.canManage)return NextResponse.json({ok:false,error:"Role Anda tidak dapat melakukan import."},{status:403}); const {admin}=ctx;
    if(batchIndex===0&&fileHash){
      const {data:dup,error:dupError}=await admin.from("imports").select("import_id,status,message").eq("workspace_id",workspaceId).eq("file_hash",fileHash);
      if(dupError)throw dupError;
      const prior=(dup||[]) as any[];
      const oldParser=prior.some(item=>{try{return JSON.parse(item.message||"{}").parser_version!==PARSER_VERSION}catch{return true}});
      if(prior.length&&!force&&!oldParser){
        const states=[...new Set(prior.map((x:any)=>x.status).filter(Boolean))].join(", ");
        return NextResponse.json({ok:false,error:`File identik sudah pernah diproses${states?" ("+states+")":""}. Aktifkan Re-import jika memang ingin mengganti data.`},{status:409});
      }
      if(prior.length&&(force||oldParser)){
        const old=prior.map((x:any)=>x.import_id).filter(Boolean);
        if(old.length){
          await admin.from("sales").delete().eq("workspace_id",workspaceId).in("import_id",old);
          await admin.from("imports").delete().eq("workspace_id",workspaceId).in("import_id",old);
        }
      }
    }
    let inserted=0,updated=0,skipped=0,duplicates=0;

    if(batchIndex===0&&(dataType==="performance"||dataType==="product_performance")){
      // PR46: a workspace may upload one consolidated file or many store files.
      // A store-scoped upload only replaces the same store + platform + period.
      // A file with multiple store columns replaces those stores, while legacy
      // files without any store identity retain the previous platform-period behavior.
      const rowStoreNames=[...new Set(rows.map(row=>clean(value(row,["Store Name","Shop Name","Nama Toko","Toko","Seller Name","Store","Shop"],false))).filter(Boolean))];
      const scopedStores=uploadStoreName?[uploadStoreName]:rowStoreNames;
      let cleanup=admin.from("sales").delete()
        .eq("workspace_id",workspaceId)
        .eq("data_type",dataType)
        .ilike("platform",platform);
      if(start)cleanup=cleanup.eq("data_date",start);
      if(end)cleanup=cleanup.eq("end_date",end);
      if(scopedStores.length===1)cleanup=cleanup.ilike("store_name",scopedStores[0]);
      else if(scopedStores.length>1)cleanup=cleanup.in("store_name",scopedStores);
      const {error:cleanupError}=await cleanup;
      if(cleanupError)throw cleanupError;

      let supersede=admin.from("imports").update({
        status:"Superseded",
        message:JSON.stringify({parser_version:PARSER_VERSION,note:"Replaced by a newer upload for the same platform, period, and store scope."})
      })
        .eq("workspace_id",workspaceId)
        .eq("data_type",dataType)
        .ilike("platform",platform);
      if(start)supersede=supersede.eq("start_date",start);
      if(end)supersede=supersede.eq("end_date",end);
      if(scopedStores.length===1)supersede=supersede.ilike("store_name",scopedStores[0]);
      else if(scopedStores.length>1)supersede=supersede.in("store_name",scopedStores);
      const {error:supersedeError}=await supersede.neq("import_id",importId);
      if(supersedeError)throw supersedeError;
    }

    if(dataType==="creators"){
      for(const row of rows){const name=clean(value(row,["Nama Affiliate","Creator Name","Creator"]));const username=clean(value(row,["Username Affiliate","Username"]));if(!name&&!username){skipped++;continue}const p=clean(value(row,["Platform"],false))||platform;let q=admin.from("creators").select("id,creator_code").eq("workspace_id",workspaceId).eq("platform",p).limit(1);q=username?q.ilike("username",username):q.ilike("name",name);const {data:ex}=await q.maybeSingle();const payload={workspace_id:workspaceId,creator_code:clean(value(row,["Creator Code"],false))||ex?.creator_code||creatorCode(),name:name||username,username:username||name,platform:p,affiliate_id:clean(value(row,["ID Affiliates","Affiliate ID"]))||null,phone:clean(value(row,["Phone","No HP","WhatsApp"]))||null,address:clean(value(row,["Address","Alamat"]))||null,payment_type:clean(value(row,["Payment/Barter","Payment Type"]))||null,ratecard:moneyNum(value(row,["Ratecard"])),profile_url:clean(value(row,["Profile URL","Social Media","Profile Link"]))||null,status:clean(value(row,["Status"]))||"Active",notes:clean(value(row,["Notes","Note","Catatan"]))||null,source_import_id:importId,updated_at:new Date().toISOString()};if(ex?.id){const {error}=await admin.from("creators").update(payload).eq("id",ex.id);if(error)throw error;updated++}else{const {error}=await admin.from("creators").insert(payload);if(error)throw error;inserted++}}
    }else if(dataType==="products"){
      const masterCache=new Map<string,any>();
      const variantsCache=new Map<number,any[]>();

      async function getMasterForSku(sku:string){
        const skuNorm=sku.toLowerCase();
        if(masterCache.has(skuNorm))return masterCache.get(skuNorm);
        const {data,error}=await admin.from("product_master")
          .select("id,sku,product_name,category,selling_price,cost_price,point_per_unit,status,notes")
          .eq("workspace_id",workspaceId).eq("sku_normalized",skuNorm).maybeSingle();
        if(error)throw error;
        masterCache.set(skuNorm,data||null);
        return data||null;
      }

      async function loadVariants(productMasterId:number){
        if(variantsCache.has(productMasterId))return variantsCache.get(productMasterId)!;
        const {data,error}=await admin.from("product_variants")
          .select("id,slot,variant_name,hpp,selling_price")
          .eq("workspace_id",workspaceId).eq("product_master_id",productMasterId)
          .order("slot",{ascending:true});
        if(error)throw error;
        const list=data||[];
        variantsCache.set(productMasterId,list);
        return list;
      }

      for(const row of rows){
        const sku=clean(value(row,["SKU","Kode SKU"],false));
        if(!sku){skipped++;continue}
        const skuNorm=sku.toLowerCase();
        const now=new Date().toISOString();
        const productName=clean(value(row,["Product Name","Nama Produk"]))||sku;
        const category=clean(value(row,["Category","Kategori"]))||null;
        const sellingRaw=value(row,["Selling Price","Harga Jual"]);
        const costRaw=value(row,["Cost Price","HPP","Harga Modal"]);
        const pointRaw=value(row,["Point per Unit","Point"]);
        const statusRaw=clean(value(row,["Status"]));
        const notesRaw=clean(value(row,["Notes","Note","Catatan"]));
        const productCode=clean(value(row,["Product Code","Kode Produk","Product ID","Item ID","Item id","Kode Item","ID Produk"]));
        const variantName=clean(value(row,["Variant","Variation","Variasi","Nama Variasi","Variant Name","Variation Name"]));
        const requestedSlot=countNum(value(row,["Variant Slot","Variation Slot","Slot Variasi"]));

        let master=await getMasterForSku(sku);
        const masterPayload:Row={
          workspace_id:workspaceId,sku,sku_normalized:skuNorm,product_name:productName,
          source_import_id:importId,updated_at:now
        };
        if(category)masterPayload.category=category;
        if(clean(sellingRaw))masterPayload.selling_price=moneyNum(sellingRaw);
        if(clean(costRaw))masterPayload.cost_price=moneyNum(costRaw);
        if(clean(pointRaw))masterPayload.point_per_unit=num(pointRaw);
        if(statusRaw)masterPayload.status=statusRaw;
        if(notesRaw)masterPayload.notes=notesRaw;

        if(master?.id){
          const {error}=await admin.from("product_master").update(masterPayload).eq("id",master.id).eq("workspace_id",workspaceId);
          if(error)throw error;
          updated++;
          master={...master,...masterPayload};
        }else{
          const {data:newMaster,error}=await admin.from("product_master").insert({
            ...masterPayload,status:statusRaw||"Active",
            selling_price:clean(sellingRaw)?moneyNum(sellingRaw):0,
            cost_price:clean(costRaw)?moneyNum(costRaw):0,
            point_per_unit:clean(pointRaw)?num(pointRaw):0
          }).select("id,sku,product_name,category,selling_price,cost_price,point_per_unit,status,notes").single();
          if(error)throw error;
          inserted++;
          master=newMaster;
        }
        masterCache.set(skuNorm,master);

        let variantSlot:number|null=null;
        if(variantName){
          const variants=await loadVariants(Number(master.id));
          const existingVariant=variants.find((x:any)=>String(x.variant_name||"").toLowerCase()===variantName.toLowerCase());
          if(existingVariant){
            variantSlot=Number(existingVariant.slot);
          }else{
            const occupied=new Set(variants.map((x:any)=>Number(x.slot)));
            const preferred=requestedSlot>=1&&requestedSlot<=15?requestedSlot:0;
            variantSlot=preferred&&!occupied.has(preferred)?preferred:Array.from({length:15},(_,i)=>i+1).find(slot=>!occupied.has(slot))||null;
            if(!variantSlot)throw new Error(`SKU ${sku} sudah memiliki 15 variasi. Maksimal variasi per SKU adalah 15.`);
            const variantPayload={
              workspace_id:workspaceId,product_master_id:Number(master.id),sku,slot:variantSlot,
              variant_name:variantName,hpp:clean(costRaw)?moneyNum(costRaw):null,
              selling_price:clean(sellingRaw)?moneyNum(sellingRaw):null,
              source_import_id:importId,updated_at:now
            };
            const {data:newVariant,error}=await admin.from("product_variants").insert(variantPayload).select("id,slot,variant_name,hpp,selling_price").single();
            if(error)throw error;
            variants.push(newVariant);
          }
        }

        if(productCode){
          const listingPayload={
            workspace_id:workspaceId,product_master_id:Number(master.id),sku,platform,
            product_code:productCode,product_name:productName,
            variant_slot:variantSlot,variant_name:variantName||null,
            source_import_id:importId,updated_at:now
          };
          const {error:listingError}=await admin.from("product_platform_items")
            .upsert(listingPayload,{onConflict:"workspace_id,platform,product_code"});
          if(listingError)throw listingError;

          const salesPatch:Row={product_code:productCode,sku,updated_at:now};
          if(variantName)salesPatch.variant_name=variantName;
          const {error:oldSalesError}=await admin.from("sales").update(salesPatch)
            .eq("workspace_id",workspaceId).eq("data_type","product_performance")
            .ilike("platform",platform).eq("sku",productCode);
          if(oldSalesError)throw oldSalesError;
          const {error:newSalesError}=await admin.from("sales").update(salesPatch)
            .eq("workspace_id",workspaceId).eq("data_type","product_performance")
            .ilike("platform",platform).eq("product_code",productCode);
          if(newSalesError)throw newSalesError;
        }
      }
    }else if(dataType==="creator_samples"){
      const payloads=rows.map(row=>({workspace_id:workspaceId,creator_id:countNum(value(row,["creator_id","Creator ID"]))||null,creator_name:clean(value(row,["creator_name","Creator Name"]))||null,platform:clean(value(row,["platform","Platform"]))||platform,sku:clean(value(row,["sku","SKU"]))||null,product_name:clean(value(row,["product_name","Product Name"]))||null,sample_status:clean(value(row,["sample_status","Sample Status"]))||"sent",sent_date:clean(value(row,["sent_date","Sent Date"]))||null,return_date:clean(value(row,["return_date","Return Date"]))||null,qty:countNum(value(row,["qty","Qty"]))||1,product_value:moneyNum(value(row,["product_value","Product Value"])),tracking:clean(value(row,["tracking","Tracking"]))||null,notes:clean(value(row,["notes","Notes"]))||null,source:"upload",source_import_id:importId,updated_at:new Date().toISOString()})).filter(x=>x.creator_id||x.creator_name);if(payloads.length){const {error}=await admin.from("creator_samples").insert(payloads);if(error)throw error;inserted+=payloads.length}skipped+=rows.length-payloads.length;
    }else if(dataType==="shipping"){
      const payloads=rows.map(row=>{
        const rawDate=clean(value(row,["data_date","Data Date","Date","Tanggal","Tanggal Kirim","Shipping Date"]));
        return {
          workspace_id:workspaceId,
          data_date:rawDate?(dateValue(rawDate,"")||null):null,
          creator_id:countNum(value(row,["creator_id","Creator ID"]))||null,
          creator_name:clean(value(row,["creator_name","Creator Name","Nama Creator","Nama Affiliate","Creator"]))||null,
          platform:clean(value(row,["platform","Platform"]))||platform,
          product_master_id:countNum(value(row,["product_master_id","Product Master ID"]))||null,
          sku:clean(value(row,["sku","SKU","Kode SKU"]))||null,
          product_name:clean(value(row,["product_name","Product Name","Nama Produk","Produk"]))||null,
          qty:countNum(value(row,["qty","Qty","Quantity","Jumlah"]))||0,
          product_cost:moneyNum(value(row,["product_cost","Product Cost","HPP","Harga Modal"])),
          shipping_cost:moneyNum(value(row,["shipping_cost","Shipping Cost","Ongkir","Biaya Ongkir"])),
          courier:clean(value(row,["courier","Courier","Kurir","Ekspedisi"]))||null,
          tracking:clean(value(row,["tracking","Tracking","Resi","Nomor Resi","No Resi"]))||null,
          status:clean(value(row,["status","Status","Shipping Status"]))||"Pending",
          updated_at:new Date().toISOString(),
        };
      }).filter(x=>x.creator_id||x.creator_name||x.tracking||x.sku||x.product_name);
      if(payloads.length){const {error}=await admin.from("shipping").insert(payloads);if(error)throw error;inserted+=payloads.length}
      skipped+=rows.length-payloads.length;
    }else if(dataType==="product_hpp"){
      for(const row of rows){
        const sku=clean(value(row,["sku","SKU","Kode SKU"]));
        if(!sku){skipped++;continue}
        const skuNorm=sku.toLowerCase();
        const period=clean(value(row,["period","Period","Periode"]))||"MASTER";
        const productName=clean(value(row,["product_name","Product Name","Nama Produk"]))||null;
        const hppRaw=value(row,["hpp","HPP","Cost Price","Harga Modal"]);
        const hpp=moneyNum(hppRaw);
        const sellingRaw=value(row,["selling_price","Selling Price","Harga Jual"]);
        const sellingPrice=moneyNum(sellingRaw);
        const now=new Date().toISOString();

        let {data:master,error:masterFindError}=await admin.from("product_master")
          .select("id,product_name,selling_price,cost_price")
          .eq("workspace_id",workspaceId).eq("sku_normalized",skuNorm).maybeSingle();
        if(masterFindError)throw masterFindError;
        if(master?.id){
          const masterPatch:Row={source_import_id:importId,updated_at:now};
          if(productName)masterPatch.product_name=productName;
          if(clean(hppRaw))masterPatch.cost_price=hpp;
          if(clean(sellingRaw))masterPatch.selling_price=sellingPrice;
          const {error:masterError}=await admin.from("product_master").update(masterPatch).eq("id",master.id).eq("workspace_id",workspaceId);
          if(masterError)throw masterError;
        }else{
          const {data:newMaster,error:masterError}=await admin.from("product_master").insert({
            workspace_id:workspaceId,sku,sku_normalized:skuNorm,product_name:productName||sku,
            selling_price:clean(sellingRaw)?sellingPrice:0,cost_price:clean(hppRaw)?hpp:0,point_per_unit:0,
            status:"Active",source_import_id:importId,updated_at:now
          }).select("id,product_name,selling_price,cost_price").single();
          if(masterError)throw masterError;
          master=newMaster;
        }

        const payload={
          workspace_id:workspaceId,product_master_id:Number(master.id),sku,period,
          product_id:null,product_name:productName,hpp,
          selling_price:clean(sellingRaw)?sellingPrice:0,
          notes:clean(value(row,["notes","Notes","Catatan"]))||null,
          source_import_id:importId,updated_at:now
        };
        const {data:ex,error:hppFindError}=await admin.from("product_hpp_history")
          .select("id").eq("workspace_id",workspaceId).ilike("sku",sku).eq("period",period).maybeSingle();
        if(hppFindError)throw hppFindError;
        if(ex?.id){
          const {error}=await admin.from("product_hpp_history").update(payload).eq("id",ex.id);
          if(error)throw error;
          updated++;
        }else{
          const {error}=await admin.from("product_hpp_history").insert(payload);
          if(error)throw error;
          inserted++;
        }

        const rowHeaders=Object.keys(row||{});
        const hasVariantTemplate=rowHeaders.some(header=>/^varia(nt|tion|si)\s*0?([1-9]|1[0-5])$/i.test(String(header).trim()));
        if(hasVariantTemplate){
          const filled:{slot:number;name:string}[]=[];
          for(let slot=1;slot<=15;slot++){
            const name=clean(value(row,[`Variasi ${slot}`,`Variant ${slot}`,`Variation ${slot}`],false));
            if(name)filled.push({slot,name});
          }
          const {error:clearVariantError}=await admin.from("product_variants").delete()
            .eq("workspace_id",workspaceId).eq("product_master_id",Number(master.id));
          if(clearVariantError)throw clearVariantError;
          if(filled.length){
            const variantPayloads=filled.map(item=>({
              workspace_id:workspaceId,product_master_id:Number(master.id),sku,slot:item.slot,
              variant_name:item.name,hpp:clean(hppRaw)?hpp:null,
              selling_price:clean(sellingRaw)?sellingPrice:null,
              source_import_id:importId,updated_at:now
            }));
            const {error:variantError}=await admin.from("product_variants").insert(variantPayloads);
            if(variantError)throw variantError;
            for(const item of filled){
              const {error:linkError}=await admin.from("product_platform_items")
                .update({variant_slot:item.slot,updated_at:now})
                .eq("workspace_id",workspaceId).eq("product_master_id",Number(master.id))
                .ilike("variant_name",item.name);
              if(linkError)throw linkError;
            }
          }
        }
      }
    }else if(dataType==="product_performance"){
      const mapping=productPerformanceMapping(rows[0]||{},platform);
      if(!mapping.sku||!mapping.productName||!mapping.gmv){
        return NextResponse.json({ok:false,error:"Format Product Performance belum dikenali. Kode Item/Product ID, Nama Produk, dan GMV/Omzet wajib tersedia.",detected_platform:platform,headers:Object.keys(rows[0]||{}),mapping:productMappingSummary(mapping)},{status:422});
      }
      const styles={
        price:inferMoneyStyle(rows,mapping.price),gmv:inferMoneyStyle(rows,mapping.gmv),
        commission:inferMoneyStyle(rows,mapping.commission),refund:inferMoneyStyle(rows,mapping.refund),
        flatFee:inferMoneyStyle(rows,mapping.flatFee)
      };

      const productCodes=[...new Set(rows.map(row=>clean(mappedRaw(row,mapping.sku))).filter(Boolean))];
      const platformMap=new Map<string,Row>();
      for(let offset=0;offset<productCodes.length;offset+=500){
        const part=productCodes.slice(offset,offset+500);
        const {data:mapped,error:mappedError}=await admin.from("product_platform_items")
          .select("product_code,sku,variant_name,product_master_id")
          .eq("workspace_id",workspaceId).ilike("platform",platform).in("product_code",part);
        if(mappedError)throw mappedError;
        for(const item of mapped||[])platformMap.set(String(item.product_code||"").toLowerCase(),item as Row);
      }

      const payloads:Row[]=[];
      const autoMasterCache=new Map<string,any>();
      for(let i=0;i<rows.length;i++){
        const row=rows[i];
        const productCode=clean(mappedRaw(row,mapping.sku));
        const productName=clean(mappedRaw(row,mapping.productName));
        const marketplaceCategory=clean(mappedRaw(row,mapping.category))||null;
        if(!productCode&&!productName){skipped++;continue}
        let mapped=productCode?platformMap.get(productCode.toLowerCase()):null;
        let canonicalSku=clean(mapped?.sku)||productCode||`product-${norm(productName)}`;
        let variantName=clean(mapped?.variant_name)||null;

        // PR34: every Product Performance row must be discoverable from Product Master.
        // If the user has not uploaded a canonical Master SKU yet, create a temporary
        // master using the marketplace product code. A later Master SKU upload can remap it.
        if(!mapped&&productCode){
          const cacheKey=`${platform.toLowerCase()}|${productCode.toLowerCase()}`;
          let master=autoMasterCache.get(cacheKey);
          if(!master){
            const skuNorm=canonicalSku.toLowerCase();
            const {data:existingMaster,error:masterFindError}=await admin.from("product_master")
              .select("id,sku,product_name,category,cost_price,selling_price")
              .eq("workspace_id",workspaceId).eq("sku_normalized",skuNorm).maybeSingle();
            if(masterFindError)throw masterFindError;
            if(existingMaster){
              master=existingMaster;
              const masterPatch:Row={updated_at:new Date().toISOString()};
              if(productName&&(!existingMaster.product_name||existingMaster.product_name===existingMaster.sku))masterPatch.product_name=productName;
              if(marketplaceCategory)masterPatch.category=marketplaceCategory;
              if(Object.keys(masterPatch).length>1){
                const {error:renameError}=await admin.from("product_master").update(masterPatch).eq("workspace_id",workspaceId).eq("id",existingMaster.id);
                if(renameError)throw renameError;
                master={...existingMaster,...masterPatch};
              }
            }else{
              const {data:newMaster,error:masterInsertError}=await admin.from("product_master").insert({
                workspace_id:workspaceId,sku:canonicalSku,sku_normalized:skuNorm,
                product_name:productName||canonicalSku,category:marketplaceCategory,selling_price:0,cost_price:0,
                point_per_unit:0,status:"Active",notes:"Auto-created from Product Performance",
                source_import_id:importId,updated_at:new Date().toISOString()
              }).select("id,sku,product_name,cost_price,selling_price").single();
              if(masterInsertError)throw masterInsertError;
              master=newMaster;
            }
            const {error:mappingError}=await admin.from("product_platform_items").upsert({
              workspace_id:workspaceId,product_master_id:Number(master.id),sku:master.sku||canonicalSku,
              platform,product_code:productCode,product_name:productName||master.product_name||canonicalSku,
              category:marketplaceCategory,variant_slot:null,variant_name:null,source_import_id:importId,updated_at:new Date().toISOString()
            },{onConflict:"workspace_id,platform,product_code"});
            if(mappingError)throw mappingError;
            autoMasterCache.set(cacheKey,master);
            mapped={product_code:productCode,sku:master.sku||canonicalSku,variant_name:null,product_master_id:master.id};
            platformMap.set(productCode.toLowerCase(),mapped);
          }
          canonicalSku=clean(mapped?.sku)||canonicalSku;
          variantName=clean(mapped?.variant_name)||null;
        }
        const gmv=moneyValue(mappedRaw(row,mapping.gmv),styles.gmv);
        const qty=countNum(mappedRaw(row,mapping.qty));
        const orders=countNum(mappedRaw(row,mapping.orders));
        const commission=moneyValue(mappedRaw(row,mapping.commission),styles.commission);
        const refund=moneyValue(mappedRaw(row,mapping.refund),styles.refund);
        const refundQty=countNum(mappedRaw(row,mapping.refundQty));
        const clicks=countNum(mappedRaw(row,mapping.clicks));
        const buyers=countNum(mappedRaw(row,mapping.buyers));
        const newBuyers=countNum(mappedRaw(row,mapping.newBuyers));
        const sampleSent=countNum(mappedRaw(row,mapping.samples));
        const salesCreator=countNum(mappedRaw(row,mapping.salesCreator));
        const liveCount=countNum(mappedRaw(row,mapping.liveCount));
        const videoCount=countNum(mappedRaw(row,mapping.videoCount));
        const flatFee=moneyValue(mappedRaw(row,mapping.flatFee),styles.flatFee);
        const roi=num(mappedRaw(row,mapping.roi),"decimal");
        const dataDate=start||null;
        const storeName=clean(value(row,["Store Name","Shop Name","Nama Toko","Toko","Seller Name","Store","Shop"],false))||uploadStoreName;
        const storeId=clean(value(row,["Store ID","Shop ID","Seller ID","ID Toko"],false))||uploadStoreId;
        const uniqueCode=(productCode||canonicalSku).toLowerCase();
        const storeKey=(storeId||storeName||"all").toLowerCase();
        const recordKey=`product_performance|${workspaceId}|${platform}|store:${storeKey}|${start||"all"}|${end||start||"all"}|${uniqueCode}`;
        payloads.push({
          workspace_id:workspaceId,record_key:recordKey,data_type:"product_performance",
          data_date:dataDate,end_date:end||dataDate,creator_id:null,creator_name:null,username:null,
          platform,channel:"Product Performance",store_name:storeName||null,store_id:storeId||null,sku:canonicalSku,product_code:productCode||null,
          variant_name:variantName,product_name:productName||canonicalSku,category:marketplaceCategory,qty,orders,gmv,refund,
          refund_qty:refundQty,commission,clicks,buyers,new_buyers:newBuyers,live_count:liveCount,
          video_count:videoCount,sample_sent:sampleSent,sales_creator:salesCreator,flat_fee:flatFee,roi,
          source_file:filename,imported_at:new Date().toISOString(),import_id:importId,updated_at:new Date().toISOString()
        });
      }
      const byKey=new Map<string,Row>();
      for(const payload of payloads){
        const key=String(payload.record_key||"");
        if(byKey.has(key)){
          duplicates++;
          const existing=byKey.get(key)!;
          byKey.set(key,mergeProductPerformancePayload(existing,payload));
        }else{
          byKey.set(key,payload);
        }
      }
      const deduped=[...byKey.values()];
      if(batchIndex>0&&deduped.length>0){
        const keys=deduped.map(d=>String(d.record_key));
        for(let k=0;k<keys.length;k+=500){
          const sliceKeys=keys.slice(k,k+500);
          const {data:priorRows}=await admin.from("sales")
            .select("*")
            .eq("workspace_id",workspaceId)
            .in("record_key",sliceKeys);
          if(priorRows&&priorRows.length>0){
            const priorMap=new Map<string,Row>(priorRows.map((r:any)=>[String(r.record_key),r]));
            for(let d=0;d<deduped.length;d++){
              const rk=String(deduped[d].record_key);
              if(priorMap.has(rk)){
                deduped[d]=mergeProductPerformancePayload(priorMap.get(rk)!,deduped[d]);
              }
            }
          }
        }
      }
      if(deduped.length){
        const {data:saved,error}=await admin.from("sales").upsert(deduped,{onConflict:"record_key"}).select("id");
        if(error)throw error;
        inserted+=saved?.length||deduped.length;
      }
    }else if(dataType==="performance"||dataType==="sales"){
      const payloads:Row[]=[];
      const perfMap=dataType==="performance"?performanceMapping(rows[0]||{},platform):null;
      if(dataType==="performance"&&perfMap){
        const creatorMapped=Boolean(perfMap.creatorName||perfMap.username||perfMap.affiliateId);
        const metricMapped=Boolean(perfMap.gmv||perfMap.qty||perfMap.orders||perfMap.commission);
        if(!creatorMapped||!metricMapped){
          return NextResponse.json({
            ok:false,
            error:"Format Affiliate Performance belum dikenali. Minimal kolom creator dan salah satu GMV/Qty/Orders/Commission harus tersedia.",
            detected_platform:platform,
            headers:Object.keys(rows[0]||{}),
            mapping:mappingSummary(perfMap)
          },{status:422});
        }
      }
      const moneyStyles=perfMap?{
        gmv:inferMoneyStyle(rows,perfMap.gmv),commission:inferMoneyStyle(rows,perfMap.commission),
        refund:inferMoneyStyle(rows,perfMap.refund),liveGmv:inferMoneyStyle(rows,perfMap.liveGmv),
        videoGmv:inferMoneyStyle(rows,perfMap.videoGmv),showcaseGmv:inferMoneyStyle(rows,perfMap.showcaseGmv)
      }:null;
      const resolveCreator=await resolveCreatorIds(admin,workspaceId,rows,platform,importId);
      for(let i=0;i<rows.length;i++){
        const row=rows[i];const creatorId=resolveCreator(row,i);if(!creatorId){skipped++;continue}
        const creatorName=(dataType==="performance"&&perfMap
          ? clean(mappedRaw(row,perfMap.creatorName))||clean(mappedRaw(row,perfMap.username))
          : clean(value(row,["Kreator","Nama Kreator","Creator name","Nama Affiliate","Creator","Nama Creator"]))||clean(value(row,["Username Affiliate","Username"])))||"Afiliasi Lainnya (Tanpa Nama)";
        const username=(dataType==="performance"&&perfMap
          ? clean(mappedRaw(row,perfMap.username))||creatorName
          : clean(value(row,["Username Affiliate","Username","Username Kreator"]))||creatorName)||"unnamed_creator";
        let gmv=0,qty=0,orders=0,commission=0,refund=0,refundQty=0,clicks=0,buyers=0,newBuyers=0,liveGmv=0,videoGmv=0,showcaseGmv=0,ctr=0,ctor=0,liveCount=0,videoCount=0,sampleContent=0,sampleSent=0,impressions=0,videoViews=0;
        if(dataType==="performance"&&perfMap&&moneyStyles){
          gmv=moneyValue(mappedRaw(row,perfMap.gmv),moneyStyles.gmv);
          qty=countNum(mappedRaw(row,perfMap.qty));
          orders=countNum(mappedRaw(row,perfMap.orders));
          commission=moneyValue(mappedRaw(row,perfMap.commission),moneyStyles.commission);
          refund=moneyValue(mappedRaw(row,perfMap.refund),moneyStyles.refund);
          clicks=countNum(mappedRaw(row,perfMap.clicks));
          buyers=countNum(mappedRaw(row,perfMap.buyers));
          newBuyers=countNum(mappedRaw(row,perfMap.newBuyers));
          liveGmv=moneyValue(mappedRaw(row,perfMap.liveGmv),moneyStyles.liveGmv);
          videoGmv=moneyValue(mappedRaw(row,perfMap.videoGmv),moneyStyles.videoGmv);
          showcaseGmv=moneyValue(mappedRaw(row,perfMap.showcaseGmv),moneyStyles.showcaseGmv);
          ctr=percentNum(mappedRaw(row,perfMap.ctr));
          ctor=percentNum(mappedRaw(row,perfMap.ctor));
          liveCount=countNum(mappedRaw(row,perfMap.liveCount));
          videoCount=countNum(mappedRaw(row,perfMap.videoCount));
          sampleContent=countNum(mappedRaw(row,perfMap.sampleContent));
          sampleSent=countNum(mappedRaw(row,perfMap.sampleSent));
          impressions=countNum(mappedRaw(row,perfMap.impressions));
          videoViews=countNum(mappedRaw(row,perfMap.videoViews));
          refundQty=countNum(mappedRaw(row,perfMap.refundQty));
        }else{
          gmv=moneyNum(value(row,["GMV","Omzet Penjualan(Rp)","Omzet Penjualan"]));
          qty=countNum(value(row,["Qty Paid","Quantity","Qty","Produk Terjual"]));
          orders=countNum(value(row,["Orders","Order","Pesanan"]));
          commission=moneyNum(value(row,["Commission","Estimasi Komisi(Rp)","Perkiraan Komisi","Komisi"]));
          refund=moneyNum(value(row,["Refund","Pengembalian dana"]));
          clicks=countNum(value(row,["Clicks","Klik"]));
          buyers=countNum(value(row,["Buyers","Pembeli","Total Pembeli"]));
          newBuyers=countNum(value(row,["New Buyers","Pembeli Baru"]));
          liveCount=countNum(value(row,["Siaran LIVE","Live Count"]));
          videoCount=countNum(value(row,["Video","Video Count"]));
        }
        const orderId=clean(value(row,["Order ID","OrderID","ID Pesanan"]));const itemId=clean(value(row,["Item ID","ItemID","ID Item"]));const tx=clean(value(row,["Transaction ID","TransactionID","ID Transaksi"]));const sku=dataType==="sales"?clean(value(row,["SKU","Kode SKU"],false)):"";const product=dataType==="sales"?clean(value(row,["Product Name","Nama Produk","Produk"],false)):"";const dataDate=dataType==="sales"?dateValue(value(row,["Transaction Date","Tanggal Transaksi","Tanggal","Date","Data Date"]),start):start;
        const storeName=clean(value(row,["Store Name","Shop Name","Nama Toko","Toko","Seller Name","Store","Shop"],false))||uploadStoreName;const storeId=clean(value(row,["Store ID","Shop ID","Seller ID","ID Toko"],false))||uploadStoreId;const storeKey=(storeId||storeName||"all").toLowerCase();
        const unique=dataType==="performance"?`creator:${creatorId}|store:${storeKey}|start:${start||"all"}|end:${end||start||"all"}`:tx||[orderId,itemId].filter(Boolean).join("|")||`${fileHash||importId}|${batchIndex}-${i}`;const costProduct=moneyNum(value(row,["HPP","Cost Product","Product Cost","Harga Modal"],false));const shippingCost=moneyNum(value(row,["Shipping Cost","Ongkir","Biaya Ongkir"],false));const adsSpend=moneyNum(value(row,["Ads Spend","Ad Spend","Biaya Ads","Iklan"],false));const points=num(value(row,["Points","Point","Poin"],false));
        payloads.push({workspace_id:workspaceId,record_key:`${dataType}|${workspaceId}|${platform}|${unique}`,data_type:dataType,transaction_id:tx||null,order_id:orderId||null,item_id:itemId||null,data_date:dataDate||null,end_date:end||dataDate||null,creator_id:creatorId,creator_name:creatorName,username,platform,channel:dataType==="performance"?"Affiliate Performance":clean(value(row,["Channel","Saluran"]))||"Affiliate",store_name:storeName||null,store_id:storeId||null,sku:sku||null,product_name:product||null,category:dataType==="sales"?clean(value(row,["Category","Kategori"],false))||null:null,qty,orders:orders||(orderId?1:0),gmv,refund,refund_qty:refundQty,commission,cost_product:costProduct,shipping_cost:shippingCost,ads_spend:adsSpend,points,clicks,buyers,new_buyers:newBuyers,live_gmv:liveGmv,video_gmv:videoGmv,showcase_gmv:showcaseGmv,ctr,ctor,live_count:liveCount,video_count:videoCount,sample_content:sampleContent,sample_sent:sampleSent,impressions,video_views:videoViews,source_file:filename,imported_at:new Date().toISOString(),import_id:importId,updated_at:new Date().toISOString()});
      }
      if(payloads.length){
        const byKey=new Map<string,Row>();
        for(const payload of payloads){
          const key=String(payload.record_key||"");
          if(byKey.has(key)){
            duplicates++;
            const existing=byKey.get(key)!;
            byKey.set(key,mergePerformancePayload(existing,payload));
          }else{
            byKey.set(key,payload);
          }
        }
        const deduped=[...byKey.values()];
        if(batchIndex>0&&deduped.length>0){
          const keys=deduped.map(d=>String(d.record_key));
          for(let k=0;k<keys.length;k+=500){
            const sliceKeys=keys.slice(k,k+500);
            const {data:priorRows}=await admin.from("sales")
              .select("*")
              .eq("workspace_id",workspaceId)
              .in("record_key",sliceKeys);
            if(priorRows&&priorRows.length>0){
              const priorMap=new Map<string,Row>(priorRows.map((r:any)=>[String(r.record_key),r]));
              for(let d=0;d<deduped.length;d++){
                const rk=String(deduped[d].record_key);
                if(priorMap.has(rk)){
                  deduped[d]=mergePerformancePayload(priorMap.get(rk)!,deduped[d]);
                }
              }
            }
          }
        }
        const {data:saved,error}=await admin.from("sales").upsert(deduped,{onConflict:"record_key"}).select("id");
        if(error)throw error;
        inserted+=saved?.length||deduped.length;
        if(dataType==="performance"){
          const affiliations=[...new Map(deduped.filter(x=>x.creator_id&&x.store_name).map(x=>[`${x.creator_id}|${String(x.platform).toLowerCase()}|${String(x.store_name).toLowerCase()}`,{
            workspace_id:workspaceId,creator_id:x.creator_id,platform:x.platform,store_name:x.store_name,store_id:x.store_id||null,last_seen_at:new Date().toISOString(),source_import_id:importId
          }])).values()];
          if(affiliations.length){const {error:affError}=await admin.from("creator_store_affiliations").upsert(affiliations,{onConflict:"workspace_id,creator_id,platform,store_name"});if(affError)throw affError}
        }
      }
    }else return NextResponse.json({ok:false,error:"Jenis Data tidak valid."},{status:400});

    const {data:existing}=await admin.from("imports").select("id,rows_imported,message").eq("workspace_id",workspaceId).eq("import_id",importId).maybeSingle();
    let prev:any={};try{prev=JSON.parse(existing?.message||"{}")}catch{}
    const stats={detected:Number(prev.detected||0)+rows.length,inserted:Number(prev.inserted||0)+inserted,updated:Number(prev.updated||0)+updated,skipped:Number(prev.skipped||0)+skipped,duplicates:Number(prev.duplicates||0)+duplicates,errors:Number(prev.errors||0)};
    const currentMapping=dataType==="performance"?mappingSummary(performanceMapping(rows[0]||{},platform)):dataType==="product_performance"?productMappingSummary(productPerformanceMapping(rows[0]||{},platform)):undefined;
    const message={...stats,parser_version:PARSER_VERSION,mapping:currentMapping||prev.mapping||null};
    const meta={workspace_id:workspaceId,import_id:importId,filename,data_type:dataType,platform,store_name:uploadStoreName||null,store_id:uploadStoreId||null,start_date:start||null,end_date:end||null,rows_imported:Number(existing?.rows_imported||0)+inserted+updated,status:batchIndex+1>=totalBatches?"Success":"Processing",imported_at:new Date().toISOString(),message:JSON.stringify(message),file_hash:fileHash||null};
    if(existing?.id){const {error}=await admin.from("imports").update(meta).eq("id",existing.id);if(error)throw error}else{const {error}=await admin.from("imports").insert(meta);if(error)throw error}
    const complete=batchIndex+1>=totalBatches;
    let persistedRows:number|null=null;
    let quality:Row|null=null;
    let warning:string|null=null;

    if(complete&&(dataType==="performance"||dataType==="sales"||dataType==="product_performance")){
      const {count,error:countError}=await admin.from("sales").select("id",{count:"exact",head:true}).eq("workspace_id",workspaceId).eq("import_id",importId);
      if(countError)throw countError;
      persistedRows=Number(count||0);
      if(persistedRows<=0)throw new Error("Import selesai diproses tetapi tidak ada row yang tersimpan ke database.");

      if(dataType==="performance"||dataType==="sales"){
        const {data:qualityRows,error:qualityError}=await admin.rpc("get_import_metric_quality",{
          p_workspace_id:workspaceId,
          p_import_id:importId
        });
        if(qualityError)throw qualityError;
        quality=(qualityRows?.[0]||null) as Row|null;

        if(quality&&Number(quality.total_rows||0)!==persistedRows){
          const qualityMessage={
            ...message,
            parser_version:PARSER_VERSION,
            quality,
            validation_error:`Persisted row mismatch: import=${persistedRows}, quality=${Number(quality.total_rows||0)}`
          };
          await admin.from("imports").update({
            status:"Error",
            message:JSON.stringify(qualityMessage)
          }).eq("workspace_id",workspaceId).eq("import_id",importId);
          throw new Error("Validasi import gagal: jumlah row yang tersimpan tidak konsisten. Data tidak dianggap sukses.");
        }

        if(quality&&Number(quality.total_rows||0)>0&&Number(quality.active_rows||0)===0){
          warning="Import tersimpan, tetapi seluruh Qty, Orders, GMV, dan Commission bernilai 0. Periksa apakah file sumber memang tidak memiliki transaksi atau mapping header berubah.";
        }

        await admin.from("imports").update({
          status:"Success",
          message:JSON.stringify({...message,parser_version:PARSER_VERSION,quality,warning})
        }).eq("workspace_id",workspaceId).eq("import_id",importId);
      }

      await notifyTopCreators(admin,workspaceId,ctx.user.id).catch(()=>undefined);

      if(dataType==="performance"||dataType==="sales"){
        const {error:campaignSyncError}=await admin.rpc("luma_sync_workspace_campaign_performance_v1",{
          p_workspace_id:workspaceId,
          p_start_date:start||null,
          p_end_date:end||start||null,
          p_platform:platform||null
        });
        if(campaignSyncError)console.warn("Campaign performance auto-sync skipped:",campaignSyncError.message);
      }
    }

    return NextResponse.json({
      ok:true,
      import_id:importId,
      stats,
      complete,
      persisted_rows:persistedRows,
      detected_platform:platform,
      parser_version:PARSER_VERSION,
      mapping:dataType==="performance"?mappingSummary(performanceMapping(rows[0]||{},platform)):dataType==="product_performance"?productMappingSummary(productPerformanceMapping(rows[0]||{},platform)):null,
      quality,
      warning
    });
  }catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Import failed."},{status:400})}
}
