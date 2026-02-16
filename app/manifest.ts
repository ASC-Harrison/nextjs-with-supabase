// app/manifest.ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Baxter ASC Inventory",
    short_name: "ASC Inventory",
    start_url: "/protected",
    display: "standalone",
    background_color: "#2f3136",
    theme_color: "#2f3136",
    icons: [
      {
        src: "/asc-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/asc-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
