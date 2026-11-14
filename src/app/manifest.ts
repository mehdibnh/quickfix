import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "QuickFix Tunisia",
    short_name: "QuickFix",
    description: "Des artisans de confiance, près de chez vous.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f9f7",
    theme_color: "#2b6852",
    lang: "fr-TN",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
