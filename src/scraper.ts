import * as https from "https";
import * as http from "http";
import { SocialContent, Platform } from "./types";

const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1";

const GOOGLEBOT_UA =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

function fetchUrl(url: string, userAgent?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options: https.RequestOptions = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: "GET",
      headers: {
        "User-Agent": userAgent || MOBILE_UA,
        Accept: "text/html",
      },
    };

    const req = https.request(options, (res: http.IncomingMessage) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchUrl(res.headers.location, userAgent).then(resolve).catch(reject);
        return;
      }
      let data = "";
      res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
      res.on("end", () => resolve(data));
    });

    req.on("error", reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error("Timeout")); });
    req.end();
  });
}

export function fetchImageAsBase64(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options: https.RequestOptions = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: "GET",
      headers: { "User-Agent": MOBILE_UA },
    };

    const req = https.request(options, (res: http.IncomingMessage) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchImageAsBase64(res.headers.location).then(resolve).catch(reject);
        return;
      }
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer.toString("base64"));
      });
    });

    req.on("error", reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error("Timeout")); });
    req.end();
  });
}

function extractImageUrls(html: string): string[] {
  const urls: string[] = [];

  // Extract og:image first (most reliable for cover image)
  const ogImageMatch = html.match(/property="og:image"\s+content="([^"]*)"/);
  if (ogImageMatch) {
    urls.push(ogImageMatch[1].replace(/&amp;/g, "&"));
  }

  // Also look for any additional CDN image URLs
  const imgMatches = html.match(/https?:\/\/scontent[^"\\&\s]+\.jpg[^"\\&\s]*/g) || [];
  for (const rawUrl of imgMatches) {
    const decoded = rawUrl.replace(/&amp;/g, "&");
    if (!decoded.includes("profile_pic") && !decoded.includes("150x150")) {
      urls.push(decoded);
    }
  }

  return [...new Set(urls)];
}

function decodeJsonString(s: string): string {
  return s
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\")
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, code: string) => {
      const cp = parseInt(code, 16);
      // Skip unpaired surrogates
      if (cp >= 0xD800 && cp <= 0xDFFF) return "";
      return String.fromCharCode(cp);
    });
}

export async function scrapeThreadsPost(url: string): Promise<SocialContent> {
  const cleanUrl = url.split("?")[0];

  // Use Googlebot UA — Threads serves full SSR content (including text_fragments) to crawlers
  const html = await fetchUrl(cleanUrl, GOOGLEBOT_UA);

  // Extract author
  const authorMatch = cleanUrl.match(/@([^/]+)/);
  const author = authorMatch ? authorMatch[1] : "Unknown";
  let displayName = author;
  const nameMatch = html.match(/content="([^"]+)\s*\(@/);
  if (nameMatch) displayName = nameMatch[1].trim();

  // Strategy 1: Extract "plaintext" from text_fragments in data-sjs scripts (most complete)
  // This captures the full text of "text box" posts and regular text posts
  const plaintextMatches = html.match(/"plaintext":"((?:[^"\\]|\\.)*)"/g) || [];
  const plaintexts = plaintextMatches
    .map((m) => decodeJsonString(m.slice(13, -1)))
    .filter((t) => t.length > 0);
  const uniquePlaintexts = [...new Set(plaintexts)];

  // Strategy 2: Fallback to "text":"..." pattern (works with mobile UA responses)
  let uniqueTexts: string[] = [];
  if (uniquePlaintexts.length === 0) {
    const textMatches = html.match(/"text":"((?:[^"\\]|\\.)*)"/g) || [];
    const texts = textMatches.map((m) => decodeJsonString(m.slice(8, -1)));
    uniqueTexts = [...new Set(texts)];
  }

  // Strategy 3: og:description as last fallback
  const ogDescMatch = html.match(/property="og:description"\s+content="([^"]*)"/);
  const ogDesc = ogDescMatch ? ogDescMatch[1].replace(/&amp;/g, "&").replace(/&#064;/g, "@") : "";

  // Pick the best text source — prefer plaintext (has full text box content)
  const allTexts = uniquePlaintexts.length > 0 ? uniquePlaintexts : uniqueTexts;
  const fullText = allTexts.length > 0 ? allTexts.join("\n\n") : ogDesc;
  const title = (allTexts[0] || ogDesc || "Threads Post").slice(0, 100);

  // Extract carousel image URLs for actual image posts
  const imageUrls = extractImageUrls(html);

  const content: SocialContent = {
    platform: "threads" as Platform,
    url: cleanUrl,
    title,
    author: displayName || author,
    description: fullText,
    hasVideo: false,
  };

  // Only use vision OCR if we have images AND very little text (actual image carousel posts)
  if (imageUrls.length > 0 && fullText.length < 200) {
    console.log(`Socials-to-Notes: Found ${imageUrls.length} carousel images, will use vision OCR`);
    content.imageUrls = imageUrls;
  }

  return content;
}

export async function scrapeRedditPost(url: string): Promise<SocialContent | null> {
  try {
    // Reddit's public JSON API: append .json to any post URL
    let cleanUrl = url.split("?")[0];
    if (!cleanUrl.endsWith("/")) cleanUrl += "/";
    const jsonUrl = cleanUrl.replace(/\/$/, ".json");

    const response = await fetchUrl(jsonUrl, "socials-to-notes/1.0");
    const data = JSON.parse(response);
    const post = data[0]?.data?.children?.[0]?.data;
    if (!post) return null;

    const title = post.title || "";
    const author = post.author || "";
    const selftext = post.selftext || "";
    const subreddit = post.subreddit_name_prefixed || `r/${post.subreddit}`;

    // Gather top comments for context
    const commentTexts: string[] = [];
    const comments = data[1]?.data?.children || [];
    for (const c of comments.slice(0, 10)) {
      if (c.kind === "t1" && c.data?.body) {
        commentTexts.push(`**u/${c.data.author}:** ${c.data.body}`);
      }
    }

    const parts = [`## ${title}`, `*Posted by u/${author} in ${subreddit}*`];
    if (selftext) parts.push(selftext);
    if (commentTexts.length > 0) {
      parts.push("## Top Comments\n" + commentTexts.join("\n\n"));
    }

    return {
      platform: "reddit",
      url: cleanUrl,
      title: title.slice(0, 100),
      author,
      description: parts.join("\n\n"),
      hasVideo: false,
    };
  } catch {
    return null;
  }
}

export async function scrapeTwitterPost(url: string): Promise<SocialContent | null> {
  const cleanUrl = url.split("?")[0];
  const tweetIdMatch = cleanUrl.match(/status\/(\d+)/);
  if (!tweetIdMatch) return null;

  try {
    const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(cleanUrl)}`;
    const response = await fetchUrl(oembedUrl);
    const data = JSON.parse(response);
    const text = (data.html || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .trim();

    return {
      platform: "twitter",
      url: cleanUrl,
      title: text.slice(0, 100),
      author: data.author_name || "",
      description: text,
      hasVideo: false,
    };
  } catch {
    return null;
  }
}
