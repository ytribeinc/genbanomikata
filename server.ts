import "dotenv/config";
import { execSync } from "child_process";
import { createServer } from "http";
import next from "next";
import { initSocketIO } from "./src/server/socket";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "localhost";
const port = parseInt(process.env.PORT ?? "3000", 10);

// 本番環境でDBマイグレーションを自動実行
if (!dev) {
  try {
    console.log("> Running prisma db push...");
    execSync("node node_modules/.bin/prisma db push", { stdio: "inherit" });
    console.log("> Database schema applied.");
  } catch (e) {
    console.error("prisma db push failed:", e);
  }
}

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  // Socket.io を HTTP サーバーに統合
  initSocketIO(httpServer);

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
