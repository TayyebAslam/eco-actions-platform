import fs from "fs";
import path from "path";
import { ActivityLogEntry, LogChannelInterface } from "../types";

export class SingleChannel implements LogChannelInterface {
  private logFile: string;

  constructor(logPath: string) {
    this.logFile = path.join(logPath, "activity.log");
    this.ensureDirectoryExists(logPath);
  }

  private ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  private formatEntry(entry: ActivityLogEntry): string {
    const line = JSON.stringify(entry);
    return line + "\n";
  }

  async write(entry: ActivityLogEntry): Promise<void> {
    const formattedEntry = this.formatEntry(entry);

    return new Promise((resolve, reject) => {
      fs.appendFile(this.logFile, formattedEntry, (err) => {
        if (err) {
          console.error("Failed to write activity log:", err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}
