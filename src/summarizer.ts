import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { SocialContent } from "./types";
import { platformLabel } from "./platform";
import { fetchImageAsBase64 } from "./scraper";

export async function summarizeContent(
  content: SocialContent,
  awsAccessKeyId: string,
  awsSecretAccessKey: string,
  awsRegion: string
): Promise<string> {
  const client = new BedrockRuntimeClient({
    region: awsRegion,
    credentials: {
      accessKeyId: awsAccessKeyId,
      secretAccessKey: awsSecretAccessKey,
    },
  });

  const platformName = platformLabel(content.platform);

  let sourceText = "";
  if (content.transcript) {
    sourceText += `## Transcript:\n${content.transcript}\n\n`;
  }
  if (content.description) {
    sourceText += `## Post Description/Caption:\n${content.description}\n\n`;
  }
  if (!sourceText.trim()) {
    sourceText = "(No text content available - only metadata was extracted)";
  }

  const hasImages = content.imageUrls && content.imageUrls.length > 0;

  const prompt = `You are a note-taking assistant. I saved a ${platformName} post and need you to turn it into a useful, well-structured note for my knowledge base (Obsidian).

Source URL: ${content.url}
Author: ${content.author || "Unknown"}
Title: ${content.title || "Untitled"}

${sourceText}
${hasImages ? "I've also attached the carousel images from this post. Please read ALL text from the images and incorporate it fully into the note. The images contain the main content of this post." : ""}

Create a well-structured note with:
1. A clear, descriptive title (not the original post title if it's vague)
2. A "Key Takeaways" section with bullet points of the main insights
3. A "Summary" section with a concise paragraph summarizing the content
4. A "Details" section with any specific tips, steps, or information worth remembering
5. A "What to Implement" section with actionable items I can actually apply — specific things to try, build, change, or experiment with based on this content. Frame these as concrete next steps or action items, using checkboxes (- [ ]) so I can track them in Obsidian.
6. Relevant tags (as #hashtags) that would help me find this note later

Format the output as clean Markdown. Be concise but capture all the valuable information. If the content is instructional, preserve the steps/instructions clearly. If it's informational, focus on the key facts and insights.

Do NOT include a YAML frontmatter block - just start with the markdown content directly.`;

  // Build message content - text + optional images
  const messageContent: any[] = [];

  // Add images first if available (Claude processes them better when they come first)
  if (hasImages) {
    // Limit to 10 images max to stay within token limits
    const imagesToProcess = content.imageUrls!.slice(0, 10);
    console.log(`Socials-to-Notes: Downloading ${imagesToProcess.length} carousel images for vision OCR`);

    for (const imageUrl of imagesToProcess) {
      try {
        const base64 = await fetchImageAsBase64(imageUrl);
        messageContent.push({
          type: "image",
          source: {
            type: "base64",
            media_type: "image/jpeg",
            data: base64,
          },
        });
      } catch (e: any) {
        console.error("Socials-to-Notes: Failed to download image:", e.message);
      }
    }
  }

  messageContent.push({ type: "text", text: prompt });

  const body = JSON.stringify({
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 4096,
    messages: [{ role: "user", content: messageContent }],
  });

  const command = new InvokeModelCommand({
    modelId: "us.anthropic.claude-sonnet-4-6",
    contentType: "application/json",
    accept: "application/json",
    body: new TextEncoder().encode(body),
  });

  const response = await client.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  return responseBody.content[0].text;
}
