import "./luma-v2.css";
import "./luma-social.css";
import "./luma-social-extra.css";
import "./creator360.css";
import "./owner-monitoring.css";
import "./product-ui.css";
import "./production-polish.css";
import "./luma-helpdesk.css";
import "./runtime-guard.css";
import "./luma-route-ui-hotfix.css";
import "./lumaway-auth-v7.css";
import "./luma-ops-v4.css";
import "./lumaway-hallmark.css";
import "./luma-layout-standard.css";
import Script from "next/script";
import ReferralCapture from "./components/ReferralCapture";

export const metadata = {
  title: "Lumaway",
  description: "Lumaway — Light Up Your Potential.",
  manifest: "/manifest.webmanifest",
  applicationName: "Lumaway",
  appleWebApp: {
    capable: true,
    title: "Lumaway",
    statusBarStyle: "black-translucent" as const,
  },
  icons: {
    icon: "/luma-mark.png",
    apple: "/luma-mark.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  colorScheme: "light",
  themeColor: "#f6f7fb",
};

const themeBoot = `(()=>{try{document.documentElement.dataset.theme='light';localStorage.removeItem('lumaway_theme')}catch{}})();`;

const metaPixelBoot = `!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '1283842006708051');
fbq('track', 'PageView');`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body>
        <noscript>
          <img height="1" width="1" style={{ display: "none" }} src="https://www.facebook.com/tr?id=1283842006708051&ev=PageView&noscript=1" alt="" />
        </noscript>
        <Script id="meta-pixel" strategy="afterInteractive">
          {metaPixelBoot}
        </Script>
        <ReferralCapture />
        {children}
      </body>
    </html>
  );
}
