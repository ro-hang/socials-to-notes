import { App, PluginSettingTab, Setting } from "obsidian";
import SocialsToNotesPlugin from "./main";

export class SocialsToNotesSettingTab extends PluginSettingTab {
  plugin: SocialsToNotesPlugin;

  constructor(app: App, plugin: SocialsToNotesPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Socials to Notes Settings" });

    // AWS Settings
    containerEl.createEl("h3", { text: "AWS (for AI Summarization)" });

    new Setting(containerEl)
      .setName("AWS Access Key ID")
      .setDesc("Your AWS access key for Bedrock")
      .addText((text) =>
        text
          .setPlaceholder("AKIA...")
          .setValue(this.plugin.settings.awsAccessKeyId)
          .onChange(async (value) => {
            this.plugin.settings.awsAccessKeyId = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("AWS Secret Access Key")
      .setDesc("Your AWS secret key")
      .addText((text) =>
        text
          .setPlaceholder("Enter secret key")
          .setValue(this.plugin.settings.awsSecretAccessKey)
          .onChange(async (value) => {
            this.plugin.settings.awsSecretAccessKey = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("AWS Region")
      .setDesc("AWS region for Bedrock")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.awsRegion)
          .onChange(async (value) => {
            this.plugin.settings.awsRegion = value;
            await this.plugin.saveSettings();
          })
      );

    // Deepgram Settings
    containerEl.createEl("h3", { text: "Deepgram (for Transcription)" });

    new Setting(containerEl)
      .setName("Deepgram API Key")
      .setDesc("Your Deepgram API key for audio transcription")
      .addText((text) =>
        text
          .setPlaceholder("Enter Deepgram API key")
          .setValue(this.plugin.settings.deepgramApiKey)
          .onChange(async (value) => {
            this.plugin.settings.deepgramApiKey = value;
            await this.plugin.saveSettings();
          })
      );

    // Folder & Auto-Processing Settings
    containerEl.createEl("h3", { text: "Folders & Auto-Processing" });

    new Setting(containerEl)
      .setName("Auto-process Raw Socials folder")
      .setDesc("Automatically process URLs found in files dropped into the Raw Socials folder")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoProcess)
          .onChange(async (value) => {
            this.plugin.settings.autoProcess = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Raw Socials Folder")
      .setDesc("Drop files with URLs here — they'll be auto-processed into notes")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.rawSocialsFolder)
          .onChange(async (value) => {
            this.plugin.settings.rawSocialsFolder = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Notes Folder")
      .setDesc("Folder where processed social notes will be saved")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.notesFolder)
          .onChange(async (value) => {
            this.plugin.settings.notesFolder = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("yt-dlp Path")
      .setDesc("Path to yt-dlp binary (default: yt-dlp)")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.ytDlpPath)
          .onChange(async (value) => {
            this.plugin.settings.ytDlpPath = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Browser for Cookies")
      .setDesc("Browser to extract login cookies from (chrome, firefox, safari, brave, edge)")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("chrome", "Chrome")
          .addOption("firefox", "Firefox")
          .addOption("safari", "Safari")
          .addOption("brave", "Brave")
          .addOption("edge", "Edge")
          .setValue(this.plugin.settings.cookiesBrowser)
          .onChange(async (value) => {
            this.plugin.settings.cookiesBrowser = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Cookies File Path")
      .setDesc("Path to a Netscape-format cookies.txt file (optional, overrides browser cookies). Export from browser with a cookies extension.")
      .addText((text) =>
        text
          .setPlaceholder("/path/to/cookies.txt")
          .setValue(this.plugin.settings.cookiesFilePath)
          .onChange(async (value) => {
            this.plugin.settings.cookiesFilePath = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
