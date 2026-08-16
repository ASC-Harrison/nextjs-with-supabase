import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Financial Control Center",
    short_name: "Money Plan",
    description: "Live wedding, debt, savings and household budget planner",
    start_url: "/finance",
    display: "standalone",
    background_color: "#080d18",
    theme_color: "#080d18",
  };
}
