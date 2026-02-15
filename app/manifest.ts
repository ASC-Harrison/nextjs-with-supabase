import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Baxter ASC Inventory",
    short_name: "ASC Inventory",
    description: "Cabinet tracking + building totals + low stock alerts",
    start_url: "/protected",
    display: "standalone",
    background_color: "#303136",
    theme_color: "#303136",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
