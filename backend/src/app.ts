import express, { Express, Request, Response } from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import corsOptions from "./config/cors";
import Routes from "./routes";
import { errorHandler } from "./middlewares/errorHandler";

dotenv.config();

const app: Express = express();

app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/api/v1", Routes);

app.use((req: Request, res: Response) => {
  res
    .status(404)
    .json({ status: 404, success: false, message: "Route not found" });
});

// Global error handler - must be after all routes
app.use(errorHandler);

export default app;
