import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/customers/[id]/last-address
// 顧客の最新案件住所を返す（案件登録時の住所引き継ぎ用）
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const project = await prisma.project.findFirst({
    where: { customerId: params.id, companyId: session.user.companyId, address: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { address: true },
  });

  return NextResponse.json({ address: project?.address ?? null });
}
