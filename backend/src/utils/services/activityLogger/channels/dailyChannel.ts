import fs from "fs";
import path from "path";
import { ActivityLogEntry, LogChannelInterface } from "../types";

export class DailyChannel implements LogChannelInterface {
  private logPath: string;
  private retentionDays: number;

  constructor(logPath: string, retentionDays: number = 30) {
    this.logPath = logPath;
    this.retentionDays = retentionDays;
    this.ensureDirectoryExists(logPath);
  }

  private ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  private getDateString(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private getLogFileName(): string {
    return `activity-${this.getDateString()}.log`;
  }

  private formatEntry(entry: ActivityLogEntry): string {
    const line = JSON.stringify(entry);
    return line + "\n";
  }

  async write(entry: ActivityLogEntry): Promise<void> {
    const logFile = path.join(this.logPath, this.getLogFileName());
    const formattedEntry = this.formatEntry(entry);

    return new Promise((resolve, reject) => {
      fs.appendFile(logFile, formattedEntry, (err) => {
        if (err) {
          console.error("Failed to write activity log:", err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async cleanup(): Promise<void> {
    const files = fs.readdirSync(this.logPath);
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - this.retentionDays * 24 * 60 * 60 * 1000);

    for (const file of files) {
      if (!file.startsWith("activity-") || !file.endsWith(".log")) {
        continue;
      }

      const dateMatch = file.match(/activity-(\d{4}-\d{2}-\d{2})\.log/);
      if (!dateMatch) continue;

      const fileDate = new Date(dateMatch[1]!);
      if (fileDate < cutoffDate) {
        const filePath = path.join(this.logPath, file);
        try {
          fs.unlinkSync(filePath);
          console.log(`Cleaned up old activity log: ${file}`);
        } catch (err) {
          console.error(`Failed to delete old log file ${file}:`, err);
        }
      }
    }
  }
}
