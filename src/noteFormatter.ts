import { SocialContent } from "./types";
import { platformLabel } from "./platform";

export function formatNote(content: SocialContent, summary: string): string {
  const platform = platformLabel(content.platform);
  const date = new Date().toISOString().split("T")[0];

  let note = `---
source: ${content.url}
platform: ${platform}
author: "${content.author || "Unknown"}"
date_saved: ${date}
type: social-note
---

`;

  // Add the AI-generated summary (which is already formatted as markdown)
  note += summary;

  // Add original transcript as a collapsible section if it exists
  if (content.transcript) {
    note += `\n\n---\n\n> [!note]- Original Transcript\n`;
    const lines = content.transcript.split("\n");
    for (const line of lines) {
      note += `> ${line}\n`;
    }
  }

  // Add original description if different from transcript
  if (content.description && content.description !== content.transcript) {
    note += `\n\n> [!info]- Original Caption/Description\n`;
    const lines = content.description.split("\n");
    for (const line of lines) {
      note += `> ${line}\n`;
    }
  }

  note += `\n\n---\n*Saved from [${platform}](${content.url}) on ${date}*\n`;

  return note;
}

export function generateFileName(content: SocialContent, summary: string): string {
  // Try to extract a title from the summary (first heading)
  const headingMatch = summary.match(/^#\s+(.+)$/m);
  let title = headingMatch?.[1] || content.title || "Untitled Note";

  // Clean the title for use as a filename
  title = title
    .replace(/[\\/:*?"<>|#^[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);

  return title;
}
