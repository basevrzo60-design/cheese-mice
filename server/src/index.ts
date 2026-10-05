import express from "express";
import cors from "cors";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { Server } from "socket.io";
import { attachCheese } from "./cheeseSocket.js";

const app = express();
const origins = (process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);
const allowOrigin = (origin: string | undefined, callback: (error: Error | null, allowed?: boolean) => void) => {
  if (!origin || origins.length === 0 || origins.includes(origin.replace(/\/$/, ""))) {
    callback(null, true);
    return;
  }
  callback(new Error("Origin is not allowed"));
};

app.use(cors({ origin: allowOrigin }));
app.get("/health", (_, res) => res.json({ ok: true }));

const http = createServer(app);
const io = new Server(http, { cors: { origin: allowOrigin }, maxHttpBufferSize: 16384 });
attachCheese(io);

const webRoot = resolve(process.cwd(), "dist");
if (existsSync(webRoot)) {
  app.use(express.static(webRoot));
  app.get("/{*path}", (_, res) => res.sendFile(resolve(webRoot, "index.html")));
}

const port = Number(process.env.PORT) || 3000;
http.listen(port, "0.0.0.0", () => console.log(`Cheese Mice server listening on port ${port}`));
