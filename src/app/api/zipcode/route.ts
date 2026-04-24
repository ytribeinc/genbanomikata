import { NextRequest, NextResponse } from "next/server";

// GET /api/zipcode?code=1234567
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")?.replace(/[^0-9]/g, "");
  if (!code || code.length !== 7) {
    return NextResponse.json({ address: null });
  }

  try {
    const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${code}`);
    const data = await res.json();
    if (data.results?.[0]) {
      const r = data.results[0];
      return NextResponse.json({ address: `${r.address1}${r.address2}${r.address3}` });
    }
  } catch { /* ignore */ }

  return NextResponse.json({ address: null });
}
