import { Platform } from "./types";

export function detectPlatform(url: string): Platform {
  const u = url.toLowerCase();
  if (u.includes("instagram.com") || u.includes("instagr.am")) return "instagram";
  if (u.includes("tiktok.com") || u.includes("vm.tiktok.com")) return "tiktok";
  if (u.includes("twitter.com") || u.includes("x.com")) return "twitter";
  if (u.includes("threads.net") || u.includes("threads.com")) return "threads";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  if (u.includes("reddit.com") || u.includes("redd.it")) return "reddit";
  return "unknown";
}

export function platformLabel(platform: Platform): string {
  const labels: Record<Platform, string> = {
    instagram: "Instagram",
    tiktok: "TikTok",
    twitter: "Twitter/X",
    threads: "Threads",
    youtube: "YouTube",
    reddit: "Reddit",
    unknown: "Unknown",
  };
  return labels[platform];
}
