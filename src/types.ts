export type Platform = "instagram" | "tiktok" | "twitter" | "threads" | "youtube" | "reddit" | "unknown";

export interface SocialContent {
  platform: Platform;
  url: string;
  title: string;
  author: string;
  description: string;
  hasVideo: boolean;
  audioPath?: string;
  transcript?: string;
  summary?: string;
  imageUrls?: string[];
}

export interface PluginSettings {
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  awsRegion: string;
  deepgramApiKey: string;
  notesFolder: string;
  ytDlpPath: string;
  cookiesBrowser: string;
  cookiesFilePath: string;
  rawSocialsFolder: string;
  autoProcess: boolean;
}

export const DEFAULT_SETTINGS: PluginSettings = {
  awsAccessKeyId: "",
  awsSecretAccessKey: "",
  awsRegion: "us-east-1",
  deepgramApiKey: "",
  notesFolder: "Social Notes",
  ytDlpPath: "/opt/homebrew/bin/yt-dlp",
  cookiesBrowser: "chrome",
  cookiesFilePath: "",
  rawSocialsFolder: "Raw Socials",
  autoProcess: true,
};
