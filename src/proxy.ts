import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// 認証不要のパスパターン
const PUBLIC_PATHS = [
  /^\/api\/auth\//,   // /api/auth/* (NextAuth endpoints + register)
  /^\/api\/debug$/,   // デバッグ用（一時的）
  /^\/login$/,
  /^\/register$/,
  /^\/_next\//,
  /^\/favicon\.ico$/,
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((pattern) => pattern.test(pathname));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    // APIリクエストには401を返す
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      );
    }

    // ページリクエストはログインへリダイレクト
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * _next/static, _next/image, favicon.ico を除くすべてのパスにマッチ
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
