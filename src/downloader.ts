import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";
import { SocialContent } from "./types";
import { detectPlatform } from "./platform";
import { scrapeThreadsPost, scrapeTwitterPost, scrapeRedditPost } from "./scraper";

const SPAWN_ENV = {
  ...process.env,
  PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ""}`,
};

export interface DownloadResult {
  content: SocialContent;
  tempDir: string;
}

function runCommand(cmd: string, args: string[], timeoutMs = 120000): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { env: SPAWN_ENV, timeout: timeoutMs });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
    proc.on("close", (code) => {
      resolve({ stdout, stderr, code: code ?? 1 });
    });
    proc.on("error", (err) => {
      resolve({ stdout, stderr: stderr + "\n" + err.message, code: 1 });
    });
  });
}

function buildCookieArgs(cookiesBrowser: string, cookiesFilePath: string): string[] {
  if (cookiesFilePath && fs.existsSync(cookiesFilePath)) {
    return ["--cookies", cookiesFilePath];
  }
  if (cookiesBrowser) {
    return ["--cookies-from-browser", cookiesBrowser];
  }
  return [];
}

export async function downloadContent(
  url: string,
  tempDir: string,
  ytDlpPath: string,
  cookiesBrowser: string = "chrome",
  cookiesFilePath: string = ""
): Promise<DownloadResult> {
  const platform = detectPlatform(url);

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const audioPath = path.join(tempDir, "audio.m4a");
  const cookieArgs = buildCookieArgs(cookiesBrowser, cookiesFilePath);

  // Text-only platforms: skip yt-dlp entirely and go straight to scrapers
  if (platform === "reddit") {
    console.log("Socials-to-Notes: Using Reddit JSON API");
    try {
      const scraped = await scrapeRedditPost(url);
      if (scraped) return { content: scraped, tempDir };
    } catch (e: any) {
      console.error("Socials-to-Notes: Reddit scraper failed:", e.message);
    }
    return { content: { platform, url, title: "Reddit Post", author: "", description: "", hasVideo: false }, tempDir };
  }

  if (platform === "threads") {
    console.log("Socials-to-Notes: Using Threads scraper");
    try {
      const scraped = await scrapeThreadsPost(url);
      return { content: scraped, tempDir };
    } catch (e: any) {
      console.error("Socials-to-Notes: Threads scraper failed:", e.message);
      return { content: { platform, url, title: "Text Post", author: "", description: "", hasVideo: false }, tempDir };
    }
  }

  if (platform === "twitter") {
    console.log("Socials-to-Notes: Using Twitter scraper");
    try {
      const scraped = await scrapeTwitterPost(url);
      if (scraped) return { content: scraped, tempDir };
    } catch (e: any) {
      console.error("Socials-to-Notes: Twitter scraper failed:", e.message);
    }
    return { content: { platform, url, title: "Text Post", author: "", description: "", hasVideo: false }, tempDir };
  }

  let title = "";
  let author = "";
  let description = "";

  // Get metadata via yt-dlp (video platforms only)
  const metaResult = await runCommand(ytDlpPath, [
    "--dump-json",
    "--no-download",
    ...cookieArgs,
    url,
  ], 60000);

  console.log("Socials-to-Notes: metadata exit code:", metaResult.code);
  if (metaResult.stderr) console.log("Socials-to-Notes: metadata stderr:", metaResult.stderr.slice(0, 500));

  if (metaResult.code === 0 && metaResult.stdout.trim()) {
    try {
      const meta = JSON.parse(metaResult.stdout);
      title = meta.title || meta.fulltitle || "";
      author = meta.uploader || meta.creator || meta.channel || "";
      description = meta.description || "";
    } catch (e) {
      console.error("Socials-to-Notes: JSON parse failed for metadata");
    }
  }

  // Download audio for video platforms
  let downloadedAudio = false;
  if (platform === "instagram" || platform === "tiktok" || platform === "youtube") {
    const dlResult = await runCommand(ytDlpPath, [
      "-x",
      "--audio-format", "m4a",
      "--audio-quality", "0",
      "--ffmpeg-location", "/opt/homebrew/bin/",
      "-o", audioPath,
      "--no-playlist",
      ...cookieArgs,
      url,
    ], 120000);

    console.log("Socials-to-Notes: download exit code:", dlResult.code);
    if (dlResult.stderr) console.log("Socials-to-Notes: download stderr:", dlResult.stderr.slice(0, 500));

    // Check for the audio file - yt-dlp may or may not have exited 0
    if (fs.existsSync(audioPath)) {
      downloadedAudio = true;
      console.log("Socials-to-Notes: audio found at expected path, size:", fs.statSync(audioPath).size);
    } else {
      // yt-dlp sometimes saves with a slightly different name
      const files = fs.readdirSync(tempDir);
      console.log("Socials-to-Notes: files in temp dir:", files);
      const audioFile = files.find(f => /\.(m4a|mp3|opus|webm|ogg)$/i.test(f));
      if (audioFile) {
        const foundPath = path.join(tempDir, audioFile);
        fs.renameSync(foundPath, audioPath);
        downloadedAudio = true;
        console.log("Socials-to-Notes: found audio as", audioFile, "renamed to audio.m4a");
      }
    }
  }


  return {
    content: {
      platform,
      url,
      title,
      author,
      description,
      hasVideo: downloadedAudio,
      audioPath: downloadedAudio ? audioPath : undefined,
    },
    tempDir,
  };
}

export function cleanupTemp(tempDir: string): void {
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (e) {
    console.error("Cleanup failed:", e);
  }
}
