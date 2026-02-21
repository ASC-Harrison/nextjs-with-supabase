// app/manifest.ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Baxter ASC Inventory",
    short_name: "ASC Inventory",
    description: "Cabinet tracking + building totals + low stock alerts",

    // ✅ this is the IMPORTANT part
    start_url: "/",
    scope: "/",
    display: "standalone",

    background_color: "#000000",
    theme_color: "#000000",

    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
