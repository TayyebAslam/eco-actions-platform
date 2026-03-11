import winston from "winston";
import dotenv from "dotenv";

dotenv.config();

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const level = () => {
  const env = process.env.NODE_ENV || "development";
  return process.env.LOG_LEVEL || (env === "development" ? "debug" : "warn");
};

const colors = {
  error: "red",
  warn: "yellow",
  info: "green",
  http: "magenta",
  debug: "white",
};

winston.addColors(colors);

// Clean format for log files - no color codes, structured and readable
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.printf((info) => {
    const level = info.level.toUpperCase().padEnd(5);
    return `[${info.timestamp}] ${level} | ${info.message}`;
  })
);

// Colorized format for terminal only
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: "HH:mm:ss" }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`)
);

const transports = [
  new winston.transports.Console({
    format: consoleFormat,
  }),
  new winston.transports.File({
    filename: "logs/error.log",
    level: "error",
    format: fileFormat,
  }),
  new winston.transports.File({
    filename: "logs/all.log",
    format: fileFormat,
  }),
];

const Logger = winston.createLogger({
  level: level(),
  levels,
  transports,
});

export default Logger;
