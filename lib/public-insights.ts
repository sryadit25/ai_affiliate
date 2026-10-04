export type PublicBlogPost={
  id:number;
  slug:string;
  title:string;
  excerpt:string|null;
  content_html:string|null;
  category:string;
  cover_image_url:string|null;
  seo_title:string|null;
  seo_description:string|null;
  seo_keywords:string[]|null;
  external_dofollow_url:string|null;
  video_embed_url:string|null;
  image_alt:string|null;
  author_name:string|null;
  published_at:string|null;
  updated_at:string;
  faq_json?:Array<{question?:string;answer?:string}>|null;
};

export type StaticInsight={
  slug:string;
  title:string;
  description:string;
  category:string;
  date:string;
  readTime:string;
  sections:Array<{title:string;paragraphs:string[]}>;
};

export const STATIC_INSIGHTS:StaticInsight[]=[
  {
    slug:"dari-data-ke-keputusan",
    title:"Banyak data, tetapi keputusan masih terasa sulit?",
    description:"Cara memulai analisis dari pertanyaan bisnis, menyamakan definisi metrik, dan merumuskan tindakan.",
    category:"Business Intelligence",
    date:"2026-09-16",
    readTime:"4 menit",
    sections:[
      {title:"Mulai dari keputusan yang ingin dibuat",paragraphs:["Dashboard sering dimulai dari pertanyaan: angka apa yang bisa ditampilkan? Untuk kerja sehari-hari, tentukan dulu keputusan yang perlu dibuat, lalu cari data yang membantu menilai pilihan tersebut.","Total penjualan saja belum selalu cukup. Periode, kontribusi kreator, kondisi stok, dan biaya dukungan memberi konteks yang berbeda pada keputusan."]},
      {title:"Samakan arti angka sebelum membandingkan",paragraphs:["Order, kuantitas barang, GMV, dan pendapatan bersih menjawab pertanyaan yang berbeda. Buat definisi metrik yang jelas: nama, sumber, periode, dan hal yang tidak tercakup.","Jika dua sumber memakai definisi berbeda, tampilkan terpisah sampai rekonsiliasinya jelas. Angka kosong berarti belum diketahui, bukan otomatis nol."]},
      {title:"Pisahkan observasi, dugaan, dan tindakan",paragraphs:["Observasi menjelaskan apa yang terlihat pada data. Dugaan menjelaskan kemungkinan penyebab. Tindakan menjelaskan apa yang akan dilakukan untuk memeriksa atau merespons temuan tersebut.","Urutan ini menjaga analisis tetap terbuka untuk diuji dan membantu tim menghindari kesimpulan yang terlalu cepat."]},
      {title:"Tutup analisis dengan catatan keputusan",paragraphs:["Catat pilihan yang diambil, alasan, pemilik pekerjaan, waktu evaluasi, serta indikator untuk menilai hasilnya.","Lumaway menghubungkan data, pemahaman, analisis, dan tindak lanjut agar keputusan tidak berhenti pada dashboard."]}
    ]
  },
  {
    slug:"rnd-marketing-dari-hipotesis-ke-eksperimen",
    title:"R&D marketing: dari ide kampanye menjadi eksperimen.",
    description:"Kerangka praktis untuk merumuskan hipotesis, membatasi variabel, dan mencatat pembelajaran marketing.",
    category:"Marketing & R&D",
    date:"2026-09-16",
    readTime:"5 menit",
    sections:[
      {title:"Riset dimulai dengan pertanyaan yang spesifik",paragraphs:["Mulai dari masalah operasional yang nyata: pesan apa yang belum jelas, segmen mana yang paling relevan, atau mengapa calon pelanggan belum melanjutkan ke tindakan berikutnya.","Kumpulkan bukti dari hasil kampanye, pertanyaan pelanggan, umpan balik sales, dan materi komunikasi. Bedakan bukti dari asumsi."]},
      {title:"Ubah ide menjadi hipotesis yang dapat diperiksa",paragraphs:["Hipotesis yang berguna menghubungkan perubahan, audiens, dan hasil yang diharapkan. Tuliskan alasan di balik dugaan tersebut sebelum eksperimen berjalan."]},
      {title:"Tentukan batas eksperimen",paragraphs:["Pilih satu perubahan utama, audiens, channel, periode, dan indikator yang diamati. Terlalu banyak perubahan sekaligus membuat penyebab hasil sulit ditelusuri.","Catat faktor lain seperti stok, promosi, musim, atau perubahan operasional yang dapat memengaruhi pembacaan."]},
      {title:"Simpan pembelajaran",paragraphs:["Hasil dapat mendukung hipotesis, melemahkannya, atau belum cukup jelas. Ketiganya tetap berguna jika konteksnya terdokumentasi.","Simpan pertanyaan, bukti awal, hipotesis, eksperimen, hasil, keterbatasan, dan langkah berikutnya sebagai knowledge tim."]}
    ]
  },
  {
    slug:"evaluasi-affiliate-di-luar-gmv",
    title:"Evaluasi affiliate lebih lengkap dari sekadar GMV.",
    description:"Baca kontribusi kreator bersama konteks produk, dukungan program, dan kualitas data.",
    category:"Affiliate Intelligence",
    date:"2026-09-16",
    readTime:"4 menit",
    sections:[
      {title:"GMV adalah titik awal pembahasan",paragraphs:["GMV membantu menggambarkan nilai transaksi pada definisi laporan tertentu, tetapi belum selalu menjelaskan nilai bersih, kebutuhan dukungan kreator, atau konsistensi hasil.","Pastikan periode, platform, dan status transaksi sebanding sebelum membandingkan kreator."]},
      {title:"Baca kontribusi bersama konteks dukungan",paragraphs:["Susun kreator, SKU, komisi, sampel, dan dukungan kampanye dalam satu bahan evaluasi. Jangan menganggap seluruh biaya sudah tercakup jika sumber data belum lengkap.","Periksa pula konsentrasi penjualan agar tim memahami apakah hasil bergantung pada satu SKU atau tersebar di portofolio."]},
      {title:"Jaga identitas dan kualitas data",paragraphs:["Nama kreator atau produk dapat berubah antar file. Gunakan identitas stabil bila tersedia dan pertahankan jejak sumber agar duplikasi dapat ditelusuri.","Jika SKU tidak tersedia pada sumber, tandai belum tersedia; jangan mengisi dengan tebakan."]},
      {title:"Jadikan review sebagai tindakan",paragraphs:["Tindak lanjut dapat berupa evaluasi materi, kecocokan produk, stok, atau kebutuhan data tambahan. Tetapkan pemilik aksi dan waktu review berikutnya."]}
    ]
  }
];

function publicConfig(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL||"";
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_PUBLISHABLE_KEY||"";
  return {url:url.replace(/\/$/,""),key};
}

export async function getPublicBlogs(limit=100):Promise<PublicBlogPost[]>{
  const {url,key}=publicConfig();
  if(!url||!key)return [];
  const query=new URLSearchParams({
    select:"id,slug,title,excerpt,content_html,category,cover_image_url,seo_title,seo_description,seo_keywords,external_dofollow_url,video_embed_url,image_alt,author_name,published_at,updated_at,faq_json",
    status:"eq.published",
    order:"published_at.desc",
    limit:String(limit)
  });
  try{
    const response=await fetch(`${url}/rest/v1/luma_blog_posts?${query.toString()}`,{
      headers:{apikey:key,Authorization:`Bearer ${key}`},
      cache:"no-store"
    });
    if(!response.ok)return [];
    return await response.json();
  }catch{return []}
}

export async function getPublicBlog(slug:string){
  const rows=await getPublicBlogs(200);
  return rows.find((row)=>row.slug===slug)||null;
}

export function getStaticInsight(slug:string){
  return STATIC_INSIGHTS.find((article)=>article.slug===slug)||null;
}

export function sanitizeBlogHtml(input:string){
  let html=String(input||"");
  html=html.replace(/<\s*(script|style|iframe|object|embed|form|input|button|svg|math)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,"");
  html=html.replace(/<\s*(script|style|iframe|object|embed|form|input|button|svg|math)\b[^>]*\/?\s*>/gi,"");
  html=html.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi,"");
  html=html.replace(/\s+(style|srcdoc)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi,"");
  html=html.replace(/(href|src)\s*=\s*(["'])\s*(javascript:|data:)[\s\S]*?\2/gi,'$1="#"');
  const allowed=new Set(["h2","h3","p","ul","ol","li","strong","em","blockquote","a","br","hr"]);
  html=html.replace(/<\/?([a-z0-9-]+)([^>]*)>/gi,(full,tag,attrs)=>{
    const name=String(tag).toLowerCase();
    if(!allowed.has(name))return "";
    if(full.startsWith("</"))return `</${name}>`;
    if(name==="br"||name==="hr")return `<${name}/>`;
    if(name==="a"){
      const match=String(attrs||"").match(/href\s*=\s*(["'])(.*?)\1/i);
      const href=match?.[2]||"#";
      const safe=/^(https?:\/\/|\/|#)/i.test(href)?href:"#";
      return `<a href="${safe.replace(/"/g,"&quot;")}" target="_blank" rel="noopener noreferrer">`;
    }
    return `<${name}>`;
  });
  return html;
}

export function youtubeEmbed(url:string|null){
  if(!url)return "";
  try{
    const parsed=new URL(url);
    if(parsed.hostname.includes("youtu.be"))return `https://www.youtube.com/embed/${parsed.pathname.replace(/^\//,"")}`;
    if(parsed.hostname.includes("youtube.com")){
      const id=parsed.searchParams.get("v");
      if(id)return `https://www.youtube.com/embed/${id}`;
      if(parsed.pathname.includes("/embed/"))return url;
      if(parsed.pathname.includes("/shorts/"))return `https://www.youtube.com/embed/${parsed.pathname.split("/shorts/")[1]?.split("/")[0]||""}`;
    }
  }catch{}
  return "";
}

// Used by robots.ts, sitemap.ts and the public insights page for canonical URLs.
// Stays absolute because those files are server-side and must always emit the
// canonical public host.
export const PUBLIC_SITE_ORIGIN="https://www.lumaway.online";

// Blog cover images are stored in the database as absolute URLs built against the
// production host, which 404s during local development. Rewriting the origin to
// the current host lets the same rows serve local and deployed environments.
// Both hosts appear in stored rows: the public site and the app subdomain.
// ponytail: string matching rather than a migration; if covers ever move off
// lumaway.online this stops matching and the original URL is returned as-is.
export function localizePublicAsset(url:string){
  return url.replace(/https?:\/\/([a-z0-9-]+\.)*lumaway\.online/i,"");
}
