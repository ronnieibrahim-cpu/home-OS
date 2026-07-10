import { ImageResponse } from "next/og";

// App icon used for the manifest (home-screen install on Android/desktop) and
// as a high-res favicon. Generated at request time.
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          color: "#ffffff",
          fontSize: 320,
          fontWeight: 700,
          letterSpacing: -12,
        }}
      >
        H
      </div>
    ),
    { ...size }
  );
}
