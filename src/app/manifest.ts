import type { MetadataRoute } from "next";

// Web-app manifest so the app can be installed to the iPhone home screen and
// launch full-screen (standalone), without Safari's address bar and toolbar.
// Served by Next at /manifest.webmanifest.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Household OS",
    short_name: "Household",
    description: "The second brain for running our household",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}
