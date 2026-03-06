import { App, Modal, Notice, Plugin, TFile, TextComponent } from "obsidian";
import { PluginSettings, DEFAULT_SETTINGS } from "./types";
import { SocialsToNotesSettingTab } from "./settings";
import { downloadContent, cleanupTemp } from "./downloader";
import { transcribeAudio } from "./transcriber";
import { summarizeContent } from "./summarizer";
import { formatNote, generateFileName } from "./noteFormatter";
import { detectPlatform } from "./platform";
import * as path from "path";
import * as os from "os";

const URL_REGEX = /https?:\/\/[^\s<>"')\]]+/g;

class UrlInputModal extends Modal {
  onSubmit: (url: string) => void;
  url = "";

  constructor(app: App, onSubmit: (url: string) => void) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: "Save Social Media Post" });
    contentEl.createEl("p", {
      text: "Paste a link from Instagram, TikTok, Twitter/X, Threads, YouTube, or Reddit",
      cls: "setting-item-description",
    });

    const inputContainer = contentEl.createDiv({ cls: "socials-input-container" });
    const textComponent = new TextComponent(inputContainer);
    textComponent.setPlaceholder("https://www.instagram.com/reel/...");
    textComponent.inputEl.style.width = "100%";
    textComponent.inputEl.style.marginBottom = "1em";
    textComponent.onChange((value) => {
      this.url = value;
    });

    const buttonContainer = contentEl.createDiv({ cls: "modal-button-container" });
    const submitBtn = buttonContainer.createEl("button", {
      text: "Convert to Note",
      cls: "mod-cta",
    });
    submitBtn.addEventListener("click", () => {
      if (this.url.trim()) {
        this.close();
        this.onSubmit(this.url.trim());
      } else {
        new Notice("Please enter a URL");
      }
    });

    textComponent.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submitBtn.click();
      }
    });

    setTimeout(() => textComponent.inputEl.focus(), 50);
  }

  onClose() {
    this.contentEl.empty();
  }
}

export default class SocialsToNotesPlugin extends Plugin {
  settings: PluginSettings = DEFAULT_SETTINGS;
  processing = new Set<string>();

  async onload() {
    await this.loadSettings();

    this.addCommand({
      id: "save-social-post",
      name: "Save social media post as note",
      callback: () => {
        new UrlInputModal(this.app, (url) => this.processUrl(url)).open();
      },
    });

    this.addCommand({
      id: "save-social-post-clipboard",
      name: "Save social media post from clipboard",
      callback: async () => {
        const url = await navigator.clipboard.readText();
        if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
          this.processUrl(url);
        } else {
          new Notice("No valid URL found in clipboard");
        }
      },
    });

    this.addSettingTab(new SocialsToNotesSettingTab(this.app, this));

    this.addRibbonIcon("bookmark-plus", "Save social post", () => {
      new UrlInputModal(this.app, (url) => this.processUrl(url)).open();
    });

    // Start folder watcher
    this.setupFolderWatcher();
  }

  setupFolderWatcher() {
    // Watch for new/modified files in Raw Socials folder
    this.registerEvent(
      this.app.vault.on("create", (file) => {
        if (file instanceof TFile) this.handleRawFile(file);
      })
    );
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof TFile) this.handleRawFile(file);
      })
    );

    // Also process any existing files on startup (after a short delay for vault to load)
    setTimeout(() => this.scanRawFolder(), 3000);
  }

  async scanRawFolder() {
    if (!this.settings.autoProcess) return;

    const rawFolder = this.settings.rawSocialsFolder;
    const folder = this.app.vault.getAbstractFileByPath(rawFolder);
    if (!folder) return;

    const files = this.app.vault.getFiles().filter(
      (f) => f.path.startsWith(rawFolder + "/") && f.extension === "md"
    );

    for (const file of files) {
      await this.handleRawFile(file);
    }
  }

  async handleRawFile(file: TFile) {
    if (!this.settings.autoProcess) return;
    if (file.extension !== "md") return;
    if (!file.path.startsWith(this.settings.rawSocialsFolder + "/")) return;
    if (file.basename.startsWith("DONE")) return;
    if (this.processing.has(file.path)) return;

    this.processing.add(file.path);

    try {
      const content = await this.app.vault.read(file);
      if (content.trimStart().startsWith("DONE")) {
        this.processing.delete(file.path);
        return;
      }
      const urls = content.match(URL_REGEX) || [];

      // Filter to supported social URLs only
      const socialUrls = urls.filter((u) => detectPlatform(u) !== "unknown");

      if (socialUrls.length === 0) {
        this.processing.delete(file.path);
        return;
      }

      console.log(`Socials-to-Notes: Auto-processing ${socialUrls.length} URL(s) from ${file.name}`);
      new Notice(`Processing ${socialUrls.length} link(s) from ${file.name}...`);

      let processed = 0;
      for (const url of socialUrls) {
        try {
          await this.processUrl(url, false);
          processed++;
        } catch (e) {
          console.error(`Socials-to-Notes: Failed to process ${url}:`, e);
        }
      }

      // Mark the raw file as done by prepending DONE to the title
      const rawContent = await this.app.vault.read(file);
      const doneContent = `DONE\n\n${rawContent}`;
      await this.app.vault.modify(file, doneContent);
      const newName = file.path.replace(file.name, `DONE - ${file.name}`);
      await this.app.vault.rename(file, newName).catch(() => {});

      new Notice(`Processed ${processed}/${socialUrls.length} links from ${file.name}`);
    } catch (e) {
      console.error("Socials-to-Notes: Error handling raw file:", e);
    } finally {
      this.processing.delete(file.path);
    }
  }

  async processUrl(url: string, showNotices = true) {
    const platform = detectPlatform(url);
    if (platform === "unknown") {
      if (showNotices) new Notice("Unsupported platform. Supported: Instagram, TikTok, Twitter/X, Threads, YouTube, Reddit");
      return;
    }

    const notice = showNotices ? new Notice("Processing social post...", 0) : null;
    const tempDir = path.join(os.tmpdir(), `socials-to-notes-${Date.now()}`);

    try {
      if (notice) notice.setMessage("Downloading content...");
      const { content } = await downloadContent(
        url,
        tempDir,
        this.settings.ytDlpPath,
        this.settings.cookiesBrowser,
        this.settings.cookiesFilePath
      );

      if (content.audioPath) {
        if (notice) notice.setMessage("Transcribing audio...");
        console.log("Socials-to-Notes: Audio found at", content.audioPath, "size:", require("fs").statSync(content.audioPath).size);
        try {
          content.transcript = await transcribeAudio(
            content.audioPath,
            this.settings.deepgramApiKey
          );
          console.log("Socials-to-Notes: Transcript length:", content.transcript?.length);
        } catch (e) {
          console.error("Socials-to-Notes: Transcription failed:", e);
          if (showNotices) new Notice("Transcription failed, continuing with available text...");
        }
      } else {
        console.log("Socials-to-Notes: No audio path found. Content:", JSON.stringify({ title: content.title, author: content.author, hasVideo: content.hasVideo, description: content.description?.slice(0, 100) }));
      }

      if (notice) notice.setMessage("Generating note with AI...");
      const summary = await summarizeContent(
        content,
        this.settings.awsAccessKeyId,
        this.settings.awsSecretAccessKey,
        this.settings.awsRegion
      );
      content.summary = summary;

      if (notice) notice.setMessage("Saving note...");
      const noteContent = formatNote(content, summary);
      const fileName = generateFileName(content, summary);

      const folderPath = this.settings.notesFolder;
      const folder = this.app.vault.getAbstractFileByPath(folderPath);
      if (!folder) {
        await this.app.vault.createFolder(folderPath);
      }

      const filePath = `${folderPath}/${fileName}.md`;
      const file = await this.app.vault.create(filePath, noteContent);

      if (showNotices) {
        await this.app.workspace.getLeaf(false).openFile(file);
      }

      if (notice) notice.hide();
      if (showNotices) new Notice(`Note saved: ${fileName}`);
    } catch (e) {
      if (notice) notice.hide();
      console.error("Failed to process social post:", e);
      if (showNotices) new Notice(`Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      cleanupTemp(tempDir);
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
