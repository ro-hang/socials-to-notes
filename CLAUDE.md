# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

An Obsidian plugin ("Socials to Notes") that converts social media posts (Instagram, TikTok, Twitter/X, Threads, YouTube) into structured Obsidian notes. Desktop only (uses Node.js APIs).

## Build Commands

- `npm run dev` — development build (with inline sourcemaps)
- `npm run build` — production build (minified, no sourcemaps)
- `npm run deploy` — production build + copy `main.js` and `manifest.json` to the local Obsidian vault plugins folder

Output is a single `main.js` file bundled by esbuild from `src/main.ts`. No test framework is configured.

## Architecture

The plugin follows a linear pipeline: **URL → Download → Transcribe → Summarize → Format → Save**.

- **main.ts** — Plugin entry point. Registers commands/ribbon icon, watches a "Raw Socials" folder for files containing URLs, orchestrates the pipeline via `processUrl()`. Contains `UrlInputModal` for manual URL input.
- **platform.ts** — URL → platform detection (`detectPlatform`) and display labels.
- **downloader.ts** — Uses `yt-dlp` (spawned via `child_process`) to fetch metadata and extract audio. Falls back to web scrapers for Threads/Twitter text posts. Requires `yt-dlp` and `ffmpeg` installed locally.
- **scraper.ts** — HTTP scraping for Threads (using Googlebot UA for SSR content) and Twitter (via oembed API). Also has `fetchImageAsBase64` for carousel image OCR.
- **transcriber.ts** — Sends audio to Deepgram Nova-2 API for transcription.
- **summarizer.ts** — Sends content (text + optional images) to Claude via AWS Bedrock (`us.anthropic.claude-sonnet-4-6`) to generate structured notes.
- **noteFormatter.ts** — Generates YAML frontmatter + markdown output. Extracts title from AI summary for filename.
- **types.ts** — Shared types (`SocialContent`, `PluginSettings`, `DEFAULT_SETTINGS`).
- **settings.ts** — Obsidian settings tab UI.

## Key External Dependencies

- **yt-dlp** — CLI tool for downloading; default path `/opt/homebrew/bin/yt-dlp`
- **ffmpeg** — Required by yt-dlp for audio extraction; expected at `/opt/homebrew/bin/`
- **Deepgram API** — Audio transcription (Nova-2 model)
- **AWS Bedrock** — AI summarization via Claude Sonnet
- **obsidian** — Obsidian plugin API (external in bundle)

## Auto-Processing

The plugin watches a configurable "Raw Socials" folder. When a `.md` file is created/modified there, it extracts URLs, processes them, and prefixes the file with "DONE" to prevent reprocessing. Files already starting with "DONE" are skipped.

## Settings

Configured via Obsidian settings UI. Key settings: AWS credentials, Deepgram API key, yt-dlp path, cookies browser/file for authenticated downloads, notes folder, raw socials folder, auto-process toggle.
