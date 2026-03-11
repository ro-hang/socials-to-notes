# Socials to Notes

An Obsidian plugin that converts social media posts into structured, interlinked notes in your vault. Drop a link from Instagram, TikTok, Twitter/X, Threads, YouTube, or Reddit and get back an AI-summarized note with key takeaways, action items, wikilinks, and tags — ready to plug into your knowledge graph.

![Desktop Only](https://img.shields.io/badge/desktop-only-blue) ![License](https://img.shields.io/badge/license-ISC-green)

## How It Works

```
URL → Download → Transcribe → Summarize → Save
```

1. **Download** — Fetches video/audio via `yt-dlp`, or scrapes text content directly for text-based platforms
2. **Transcribe** — Sends audio to Deepgram's Nova-2 API for speech-to-text (video posts only)
3. **Summarize** — Sends content to Claude (via AWS Bedrock) to generate a structured note with Obsidian-native formatting
4. **Save** — Creates a markdown note with YAML frontmatter, wikilinks, tags, and collapsible original content

## What You Get

Each note includes:

- **Key Takeaways** — Bullet points of the main insights
- **Summary** — Concise overview of the content
- **Details** — Specific tips, steps, or information worth remembering
- **What to Implement** — Actionable checkboxes (`- [ ]`) you can track in Obsidian
- **Related Topics** — `[[Wikilinks]]` to concepts, tools, and people for backlinking across your vault
- **Tags** — `#hashtags` for broad categorization and Obsidian search
- **Original Content** — Collapsible transcript and caption preserved for reference

## Supported Platforms

| Platform | Content Types | Method |
|----------|--------------|--------|
| **Instagram** | Reels, image posts, carousels | yt-dlp (video) / scraper (images) |
| **TikTok** | Videos | yt-dlp |
| **YouTube** | Videos | yt-dlp |
| **Twitter/X** | Tweets, threads | oembed API |
| **Threads** | Text posts, text-box posts | Scraper (Googlebot SSR) |
| **Reddit** | Posts + top comments | Reddit JSON API |

## Setup

### Prerequisites

- **Obsidian** (desktop only — uses Node.js APIs)
- **yt-dlp** — for downloading video/audio from social platforms
- **ffmpeg** — required by yt-dlp for audio extraction
- **AWS account** — with Bedrock access to Claude Sonnet
- **Deepgram API key** — for audio transcription

#### Install yt-dlp and ffmpeg (macOS)

```bash
brew install yt-dlp ffmpeg
```

### Installation

1. Clone or download this repo
2. `npm install`
3. `npm run build`
4. Copy `main.js` and `manifest.json` to your vault's `.obsidian/plugins/socials-to-notes/` folder
5. Enable the plugin in Obsidian Settings → Community Plugins

### Configuration

Open Obsidian Settings → Socials to Notes and fill in:

| Setting | Description |
|---------|-------------|
| AWS Access Key ID | Your AWS access key for Bedrock |
| AWS Secret Access Key | Your AWS secret key |
| AWS Region | AWS region (default: `us-east-1`) |
| Deepgram API Key | For audio transcription |
| yt-dlp Path | Path to yt-dlp binary (default: `/opt/homebrew/bin/yt-dlp`) |
| Browser for Cookies | Browser to extract login cookies from (for Instagram auth) |
| Notes Folder | Where processed notes are saved |
| Raw Socials Folder | Drop files with URLs here for auto-processing |
| Auto-process | Toggle automatic processing of the Raw Socials folder |

Copy `.env.example` to `.env` for reference on required keys.

## Usage

### Manual

1. Click the bookmark ribbon icon or run the command **"Save social media post as note"**
2. Paste a URL
3. Wait for processing (downloading → transcribing → summarizing)
4. Note opens automatically

### Auto-Processing

1. Enable "Auto-process Raw Socials folder" in settings
2. Create a markdown file in your Raw Socials folder with one or more URLs
3. The plugin detects new/modified files, processes all URLs, and renames the file with a "DONE" prefix

This is great for mobile workflows — save links to a synced folder from your phone, and notes are ready when you open Obsidian on desktop.

### From Clipboard

Run the command **"Save social media post from clipboard"** to process whatever URL is in your clipboard.

## Build

```bash
npm run dev      # development build (with sourcemaps)
npm run build    # production build
npm run deploy   # build + copy to local Obsidian vault
```

## Architecture

```
src/
├── main.ts          # Plugin entry, commands, ribbon icon, folder watcher
├── platform.ts      # URL → platform detection
├── downloader.ts    # yt-dlp orchestration, routes to scrapers for text platforms
├── scraper.ts       # HTTP scrapers for Threads, Twitter, Reddit, Instagram
├── transcriber.ts   # Deepgram Nova-2 audio transcription
├── summarizer.ts    # AWS Bedrock Claude summarization with Obsidian-aware prompting
├── noteFormatter.ts # YAML frontmatter + markdown output generation
├── settings.ts      # Obsidian settings tab UI
└── types.ts         # Shared types and default settings
```

## License

ISC
