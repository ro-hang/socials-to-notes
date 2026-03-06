import * as fs from "fs";
import * as https from "https";
import * as http from "http";

export async function transcribeAudio(
  audioPath: string,
  deepgramApiKey: string
): Promise<string> {
  const audioBuffer = fs.readFileSync(audioPath);

  return new Promise((resolve, reject) => {
    const options: https.RequestOptions = {
      hostname: "api.deepgram.com",
      port: 443,
      path: "/v1/listen?model=nova-2&smart_format=true&paragraphs=true",
      method: "POST",
      headers: {
        Authorization: `Token ${deepgramApiKey}`,
        "Content-Type": "audio/mp4",
        "Content-Length": audioBuffer.length,
      },
    };

    const req = https.request(options, (res: http.IncomingMessage) => {
      let data = "";
      res.on("data", (chunk: Buffer) => {
        data += chunk.toString();
      });
      res.on("end", () => {
        try {
          const result = JSON.parse(data);
          if (result.error) {
            reject(new Error(`Deepgram error: ${result.error}`));
            return;
          }
          const transcript =
            result.results?.channels?.[0]?.alternatives?.[0]?.paragraphs?.transcript ||
            result.results?.channels?.[0]?.alternatives?.[0]?.transcript ||
            "";
          resolve(transcript);
        } catch (e) {
          reject(new Error(`Failed to parse Deepgram response: ${data}`));
        }
      });
    });

    req.on("error", reject);
    req.write(audioBuffer);
    req.end();
  });
}
