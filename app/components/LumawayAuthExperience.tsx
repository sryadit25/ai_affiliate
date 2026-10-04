"use client";

import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";

type AuthView="signin"|"signup"|"forgot"|"whatsapp"|"verify";

const slides=[
  {
    eyebrow:"BUSINESS INTELLIGENCE WORKSPACE",
    title:"Lihat apa yang berubah, bukan sekadar angka.",
    copy:"Pantau creator, GMV, orders, produk, dan performa campaign dari satu workspace yang lebih mudah dibaca.",
    image:"https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1800&q=85"
  },
  {
    eyebrow:"AFFILIATE & CREATOR INTELLIGENCE",
    title:"Kerja tim lebih fokus dengan data yang sama.",
    copy:"Satukan upload, ranking creator, product performance, insight, dan tindak lanjut tanpa berpindah banyak tools.",
    image:"https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1800&q=85"
  },
  {
    eyebrow:"FROM DATA TO ACTION",
    title:"Lebih cepat memahami performa bisnis.",
    copy:"Gunakan data harian untuk menemukan pola, membandingkan periode, dan menentukan tindakan berikutnya dengan lebih percaya diri.",
    image:"https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1800&q=85"
  }
];

const normalizePhone=(value:string)=>{
  let phone=String(value||"").replace(/[^0-9+]/g,"");
  if(phone.startsWith("08"))phone="+62"+phone.slice(1);
  else if(phone.startsWith("62"))phone="+"+phone;
  else if(phone&&!phone.startsWith("+"))phone="+"+phone;
  return phone;
};

function GoogleMark(){
  return <span className="auth-v7-google-mark" aria-hidden="true">
    <svg viewBox="0 0 24 24"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.8 3-4.3 3-7.3Z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 .9-3.4.9-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.4 13.9a6 6 0 0 1 0-3.8V7.5H3.1A10 10 0 0 0 2 12c0 1.6.4 3.1 1.1 4.5l3.3-2.6Z"/><path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.8-2.8A9.4 9.4 0 0 0 12 2a10 10 0 0 0-8.9 5.5l3.3 2.6C7.2 7.8 9.4 6 12 6Z"/></svg>
  </span>;
}

function EyeIcon({open}:{open:boolean}){
  return <svg viewBox="0 0 24 24" aria-hidden="true">{open?<><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>:<><path d="m3 3 18 18"/><path d="M10.6 6.2A10.6 10.6 0 0 1 12 6c6.4 0 10 6 10 6a16.4 16.4 0 0 1-3 3.6"/><path d="M6.7 6.7C3.8 8.5 2 12 2 12s3.6 6 10 6c1.8 0 3.3-.5 4.7-1.2"/><path d="M9.9 9.9A3 3 0 0 0 14.1 14"/></>}</svg>;
}

function AuthCarousel(){
  const [index,setIndex]=useState(0);
  useEffect(()=>{
    const timer=window.setInterval(()=>setIndex(current=>(current+1)%slides.length),5000);
    return()=>window.clearInterval(timer);
  },[]);
  return <aside className="auth-v7-showcase">
    <div className="auth-v7-brand"><img src="/luma-mark.png" alt="Lumaway"/><b>LUMA</b><span>Light Up Your Potential.</span></div>
    <div className="auth-v7-slides">
      {slides.map((slide,i)=><article key={slide.title} className={"auth-v7-slide "+(i===index?"active":"")}>
        <img src={slide.image} alt="" loading={i===0?"eager":"lazy"}/>
        <div className="auth-v7-slide-overlay"/>
        <div className="auth-v7-slide-copy">
          <span>{slide.eyebrow}</span>
          <h2>{slide.title}</h2>
          <p>{slide.copy}</p>
        </div>
      </article>)}
    </div>
    <div className="auth-v7-dots" role="tablist" aria-label="Carousel Lumaway">
      {slides.map((slide,i)=><button key={slide.title} type="button" className={i===index?"active":""} onClick={()=>setIndex(i)} aria-label={"Tampilkan slide "+(i+1)}/>)}
    </div>
  </aside>;
}

export default function LumawayAuthExperience({onAuthenticated}:{onAuthenticated:(userId:string)=>Promise<void>}){
  const supabase=useMemo(()=>createClient(),[]);
  const [view,setView]=useState<AuthView>("signin");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [showPassword,setShowPassword]=useState(false);
  const [remember,setRemember]=useState(true);
  const [terms,setTerms]=useState(false);
  const [phone,setPhone]=useState("");
  const [otp,setOtp]=useState("");
  const [otpRequested,setOtpRequested]=useState(false);
  const [resetOtp,setResetOtp]=useState("");
  const [resetRequested,setResetRequested]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [googleEnabled,setGoogleEnabled]=useState(true);

  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const queryView=String(params.get("view")||"");
    if(["forgot","whatsapp"].includes(queryView))setView(queryView as AuthView);
    else if(window.location.pathname.endsWith("/register"))setView("signup");
    else setView("signin");
    if(params.get("verified")==="1")setMessage("Email berhasil diverifikasi. Silakan masuk menggunakan email dan password Anda.");
    void fetch("/api/auth/google-config",{cache:"no-store"}).then(r=>setGoogleEnabled(r.ok)).catch(()=>setGoogleEnabled(false));
  },[]);

  function go(next:AuthView){
    setView(next);setError("");setMessage("");
    if(next!=="forgot"){setResetOtp("");setResetRequested(false)}
    if(next!=="whatsapp"){setOtp("");setOtpRequested(false)}
    const url=new URL(window.location.href);
    if(next==="signup"){
      url.pathname="/register";url.searchParams.delete("view");
    }else{
      url.pathname="/login";
      if(next==="signin")url.searchParams.delete("view");
      else if(next==="forgot"||next==="whatsapp")url.searchParams.set("view",next);
    }
    window.history.replaceState(null,"",url.pathname+(url.search?"?"+url.searchParams.toString():""));
  }

  async function google(){
    if(!googleEnabled)return;
    setBusy(true);setError("");setMessage("");
    try{
      const redirectTo=`${window.location.origin}/auth/callback?next=${encodeURIComponent("/dashboard")}`;
      const {data,error}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo,skipBrowserRedirect:true}});
      if(error||!data?.url)throw error||new Error("OAuth URL unavailable");
      window.location.assign(data.url);
    }catch{
      setError("Login Google belum dapat dimulai. Gunakan email dan password terlebih dahulu.");
      setBusy(false);
    }
  }

  async function signin(){
    if(!email.trim()||!password)return setError("Email dan password wajib diisi.");
    setBusy(true);setError("");setMessage("");
    const {data,error}=await supabase.auth.signInWithPassword({email:email.trim(),password});
    if(error){
      const unverified=/email.*not.*confirmed|not confirmed/i.test(String(error.message||""));
      setError(unverified?"Email belum diverifikasi. Cek email Lumaway atau kirim ulang verifikasi.":"Email atau password tidak sesuai.");
      setBusy(false);return;
    }
    if(!remember){
      try{window.localStorage.removeItem("sb-"+new URL(process.env.NEXT_PUBLIC_SUPABASE_URL||"https://supabase.co").hostname.split(".")[0]+"-auth-token")}catch{}
    }
    if(data.user)await onAuthenticated(data.user.id);
    setBusy(false);
  }

  async function signup(){
    if(!email.trim()||!password)return setError("Email dan password wajib diisi.");
    if(password.length<8)return setError("Gunakan password minimal 8 karakter.");
    if(!terms)return setError("Centang persetujuan Syarat Layanan dan Kebijakan Privasi.");
    setBusy(true);setError("");setMessage("");
    try{
      const response=await fetch("/api/auth/email-verification",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"signup",email:email.trim(),password})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok||!result?.ok)throw new Error(String(result?.error||"Akun belum dapat dibuat."));
      setView("verify");setPassword("");
      setMessage("Permintaan diterima. Jika email belum terdaftar, verifikasi sudah dikirim — buka email dari Lumaway lalu konfirmasi akun Anda. Jika sudah punya akun, silakan masuk.");
    }catch(e:any){setError(e?.message||"Akun belum dapat dibuat.");}
    finally{setBusy(false)}
  }

  async function resendVerification(){
    if(!email.trim())return setError("Masukkan email akun terlebih dahulu.");
    setBusy(true);setError("");setMessage("");
    try{
      const response=await fetch("/api/auth/email-verification",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"resend",email:email.trim()})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok||!result?.ok)throw new Error(String(result?.error||"Email belum dapat dikirim."));
      setMessage("Email verifikasi Lumaway sudah dikirim ulang. Cek Inbox, Spam, Promotions, atau Junk.");
    }catch(e:any){setError(e?.message||"Email belum dapat dikirim.");}
    finally{setBusy(false)}
  }

  async function forgot(){
    if(!email.trim())return setError("Masukkan email yang terdaftar.");
    setBusy(true);setError("");setMessage("");
    try{
      const response=await fetch("/api/auth/password-reset",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"request",email:email.trim()})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok||!result?.ok)throw new Error(String(result?.error||"Permintaan reset password belum dapat diproses."));
      setResetRequested(true);setResetOtp("");
      setMessage("Jika email terdaftar, kode reset 6 digit dan link alternatif sudah dikirim. Kode berlaku 10 menit. Cek Inbox, Spam, Promotions, atau Junk.");
    }catch(e:any){setError(e?.message||"Permintaan reset password belum dapat diproses.");}
    finally{setBusy(false)}
  }

  async function verifyResetOtp(){
    if(!/^\d{6}$/.test(resetOtp))return setError("Masukkan kode reset 6 digit dari email.");
    setBusy(true);setError("");setMessage("");
    try{
      const response=await fetch("/api/auth/password-reset",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"verify",email:email.trim(),otp:resetOtp})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok||!result?.ok||!result?.token_hash)throw new Error(String(result?.error||"Kode reset tidak valid atau sudah kedaluwarsa."));
      const {error}=await supabase.auth.verifyOtp({token_hash:String(result.token_hash),type:"recovery"});
      if(error)throw error;
      window.location.assign("/auth/reset-password");
    }catch(e:any){setError(e?.message||"Kode reset tidak valid atau sudah kedaluwarsa.");}
    finally{setBusy(false)}
  }

  async function requestWhatsappOtp(){
    const normalized=normalizePhone(phone);
    if(!/^\+[1-9][0-9]{8,14}$/.test(normalized))return setError("Gunakan nomor WhatsApp aktif, contoh +62812xxxx.");
    setBusy(true);setError("");setMessage("");
    try{
      const response=await fetch("/api/auth/whatsapp-otp",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"request",phone:normalized})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok||!result?.ok)throw new Error(String(result?.error||"Kode OTP belum dapat dikirim."));
      setPhone(normalized);setOtpRequested(true);setOtp("");
      if(result?.channel==="email_fallback")setMessage("Provider WhatsApp sedang bermasalah. Agar Anda tetap bisa masuk, kode 6 digit dikirim ke email akun yang terhubung. Kode berlaku 5 menit.");
      else setMessage("Jika nomor terhubung ke akun Lumaway, kode OTP 6 digit sudah dikirim melalui WhatsApp. Kode berlaku 5 menit.");
    }catch(e:any){setError(e?.message||"Kode OTP belum dapat dikirim.");}
    finally{setBusy(false)}
  }

  async function verifyWhatsappOtp(){
    const normalized=normalizePhone(phone);
    if(!/^\d{6}$/.test(otp))return setError("Masukkan kode OTP 6 digit.");
    setBusy(true);setError("");setMessage("");
    try{
      const response=await fetch("/api/auth/whatsapp-otp",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"verify",phone:normalized,otp})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok||!result?.ok||!result?.token_hash)throw new Error(String(result?.error||"Kode OTP tidak valid atau sudah kedaluwarsa."));
      const {data,error}=await supabase.auth.verifyOtp({token_hash:String(result.token_hash),type:"magiclink"});
      if(error||!data.user)throw error||new Error("Sesi login belum dapat dibuat.");
      await onAuthenticated(data.user.id);
    }catch(e:any){setError(e?.message||"Kode OTP tidak valid atau sudah kedaluwarsa.");}
    finally{setBusy(false)}
  }

  const title=view==="signin"?"Masuk ke Lumaway":view==="signup"?"Buat akun Lumaway":view==="forgot"?"Lupa password?":view==="whatsapp"?"Masuk dengan WhatsApp":"Verifikasi email Anda";
  const subtitle=view==="signin"
    ?"Kelola data, insight, dan performa bisnis Anda dalam satu workspace."
    :view==="signup"
      ?"Mulai workspace Anda dan satukan data affiliate, creator, produk, serta insight."
      :view==="forgot"
        ?"Kami akan mengirim kode 6 digit dan link aman untuk membuat password baru."
        :view==="whatsapp"
          ?"Gunakan nomor WhatsApp yang sudah terhubung ke akun Lumaway."
          :"Klik link pada email dari Lumaway untuk mengaktifkan akun Anda.";

  return <main className="auth-v7-page">
    <section className="auth-v7-shell">
      <AuthCarousel/>
      <section className="auth-v7-panel">
        <div className="auth-v7-mobile-brand"><img src="/luma-mark.png" alt="Lumaway"/><span className="auth-v7-brand-text"><b>LUMA</b><span>Light Up Your Potential.</span></span></div>
        <div className="auth-v7-form">
          <span className="auth-v7-dot" aria-hidden="true"/>
          <h1>{title}</h1>
          <p className="auth-v7-subtitle">{subtitle}</p>

          {view==="signin"&&<>
            <button type="button" className="auth-v7-oauth" disabled={busy||!googleEnabled} onClick={()=>void google()}><GoogleMark/><span>Lanjutkan dengan Google</span></button>
            {!googleEnabled&&<p className="auth-v7-helper">Google Login sedang disesuaikan. Silakan gunakan login email terlebih dahulu.</p>}
            <button type="button" className="auth-v7-oauth" disabled={busy} onClick={()=>go("whatsapp")}><span className="auth-v7-line-icon" aria-hidden="true">☎</span><span>Masuk dengan WhatsApp OTP</span></button>
            <div className="auth-v7-divider"><span>ATAU</span></div>
          </>}

          {(view==="signin"||view==="signup"||view==="forgot")&&<div className="auth-v7-fields">
            <label><span>Email</span><input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="nama@perusahaan.com" disabled={view==="forgot"&&resetRequested}/></label>
            {view==="forgot"&&resetRequested&&<label><span>Kode reset 6 digit</span><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={resetOtp} onChange={e=>setResetOtp(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="Masukkan 6 digit dari email" onKeyDown={e=>{if(e.key==="Enter")void verifyResetOtp()}}/><small className="auth-v7-helper">Kode berlaku 10 menit. Link reset di email tetap bisa digunakan sebagai alternatif.</small></label>}
            {(view==="signin"||view==="signup")&&<label><span>Password</span><div className="auth-v7-password"><input type={showPassword?"text":"password"} autoComplete={view==="signin"?"current-password":"new-password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder={view==="signup"?"Minimal 8 karakter":"Masukkan password"} onKeyDown={e=>{if(e.key==="Enter"){if(view==="signin")void signin();else if(view==="signup")void signup()}}}/><button type="button" aria-label={showPassword?"Sembunyikan password":"Tampilkan password"} onClick={()=>setShowPassword(x=>!x)}><EyeIcon open={showPassword}/></button></div></label>}
          </div>}

          {view==="signin"&&<div className="auth-v7-meta"><label><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/><span>Ingat saya</span></label><button type="button" onClick={()=>go("forgot")}>Lupa password?</button></div>}
          {view==="signup"&&<label className="auth-v7-consent"><input type="checkbox" checked={terms} onChange={e=>setTerms(e.target.checked)}/><span>Saya menyetujui <a href="/web/terms">Syarat Layanan</a> dan <a href="/web/privacy">Kebijakan Privasi</a> Lumaway.</span></label>}

          {view==="whatsapp"&&<div className="auth-v7-fields">
            <label><span>Nomor WhatsApp</span><input inputMode="tel" autoComplete="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+62812xxxx"/></label>
            {otpRequested&&<label><span>Kode OTP</span><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="6 digit"/></label>}
          </div>}

          {error&&<div className="auth-v7-alert error"><b>Perlu diperiksa</b><span>{error}</span></div>}
          {message&&<div className="auth-v7-alert success"><b>Informasi</b><span>{message}</span></div>}

          {view==="signin"&&<button type="button" className="auth-v7-primary" disabled={busy} onClick={()=>void signin()}>{busy?"Memproses...":"Masuk"}</button>}
          {view==="signup"&&<button type="button" className="auth-v7-primary" disabled={busy} onClick={()=>void signup()}>{busy?"Menyiapkan akun...":"Daftar"}</button>}
          {view==="forgot"&&!resetRequested&&<button type="button" className="auth-v7-primary" disabled={busy} onClick={()=>void forgot()}>{busy?"Mengirim...":"Kirim kode reset password"}</button>}
          {view==="forgot"&&resetRequested&&<><button type="button" className="auth-v7-primary" disabled={busy} onClick={()=>void verifyResetOtp()}>{busy?"Memverifikasi...":"Verifikasi kode & lanjutkan"}</button><button type="button" className="auth-v7-secondary-link auth-v7-resend" disabled={busy} onClick={()=>void forgot()}>Kirim ulang kode</button></>}
          {view==="whatsapp"&&<><button type="button" className="auth-v7-primary" disabled={busy} onClick={()=>void (otpRequested?verifyWhatsappOtp():requestWhatsappOtp())}>{busy?"Memproses...":otpRequested?"Verifikasi & masuk":"Kirim kode WhatsApp"}</button>{otpRequested&&<button type="button" className="auth-v7-secondary-link auth-v7-resend" disabled={busy} onClick={()=>void requestWhatsappOtp()}>Kirim ulang kode</button>}</>}
          {view==="verify"&&<button type="button" className="auth-v7-primary" disabled={busy} onClick={()=>void resendVerification()}>{busy?"Mengirim...":"Kirim ulang email verifikasi"}</button>}

          <div className="auth-v7-bottom">
            {view==="signin"&&<p>Belum punya akun? <button type="button" onClick={()=>go("signup")}>Daftar sekarang</button></p>}
            {view==="signup"&&<p>Sudah punya akun? <button type="button" onClick={()=>go("signin")}>Masuk</button></p>}
            {(view==="forgot"||view==="whatsapp"||view==="verify")&&<button type="button" className="auth-v7-secondary-link" onClick={()=>go("signin")}>← Kembali ke halaman masuk</button>}
          </div>

          <p className="auth-v7-legal">Dengan melanjutkan, Anda menyetujui Syarat Layanan dan Kebijakan Privasi Lumaway. Jangan bagikan password atau kode OTP kepada siapa pun.</p>
        </div>
      </section>
    </section>
  </main>;
}
