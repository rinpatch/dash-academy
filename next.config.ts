import type { NextConfig } from "next";
import { createMDX } from "fumadocs-mdx/next";

function developmentOrigins(): string[] {
  const configured = process.env.DEV_ORIGINS?.split(",").filter(Boolean) ?? [];
  try {
    if (process.env.PORTLESS_URL) configured.push(new URL(process.env.PORTLESS_URL).hostname);
  } catch {
    // Keep explicit origins usable if an unrelated process supplied a malformed value.
  }
  return [...new Set(configured)];
}

const nextConfig: NextConfig = {
  // A tunnel (ngrok and friends) is a different origin than localhost, and Next blocks dev
  // resources from unlisted hosts. The page still renders, but nothing hydrates, so anything
  // waiting on client state — the quiz, the progress sidebar — sits on its skeleton forever.
  allowedDevOrigins: developmentOrigins(),
};

export default createMDX()(nextConfig);
