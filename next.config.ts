import type {NextConfig} from "next";

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const config:NextConfig={
  turbopack:{root:process.cwd()},
  // Public /web routes are served by this application directly.
  // Keeping them local avoids cross-project rewrite loops in the monorepo.
  poweredByHeader:false,
  async redirects(){
    return [
      {
        source:"/:path*",
        has:[{type:"host",value:"lumaway.online"}],
        destination:"https://www.lumaway.online/:path*",
        permanent:true,
      },
      {source:"/insights",destination:"/web/insights",permanent:true},
      {source:"/insights/:path*",destination:"/web/insights/:path*",permanent:true},
    ];
  },
  async headers(){
    return [
      {
        source:"/sw.js",
        headers:[{key:"Cache-Control",value:"no-cache, no-store, must-revalidate"}],
      },
      {
        source:"/:path*",
        headers:securityHeaders,
      },
    ];
  },
};

export default config;
