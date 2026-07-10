import { ImageResponse } from "next/og";

// Home-screen icon for iOS ("Add to Home Screen"). Full-bleed square — iOS
// applies its own rounded-corner mask. Generated at request time, so there's no
// binary asset to maintain; swap for real artwork later if desired.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          fontSize: 112,
          fontWeight: 700,
          letterSpacing: -4,
        }}
      >
        H
      </div>
    ),
    { ...size }
  );
}
