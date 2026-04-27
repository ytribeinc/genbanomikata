import { NextResponse } from "next/server";
import { execSync } from "child_process";

export async function GET() {
  const info: Record<string, unknown> = {
    DATABASE_URL: process.env.DATABASE_URL
      ? "設定済み: " + process.env.DATABASE_URL.replace(/:\/\/.*@/, "://***@")
      : "未設定",
    NODE_ENV: process.env.NODE_ENV,
  };

  // prisma db push を実行して結果を返す
  try {
    const output = execSync("node node_modules/.bin/prisma db push 2>&1", {
      env: { ...process.env },
      encoding: "utf8",
      timeout: 60000,
    });
    info.prisma_push = "成功";
    info.prisma_output = output;
  } catch (e: unknown) {
    const err = e as { message?: string; stdout?: string; stderr?: string; status?: number };
    info.prisma_push = "失敗";
    info.prisma_error = err.message;
    info.prisma_stdout = err.stdout;
    info.prisma_stderr = err.stderr;
    info.prisma_status = err.status;
  }

  return NextResponse.json(info, { headers: { "Content-Type": "application/json" } });
}
