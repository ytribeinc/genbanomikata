import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/customers/[id]/last-address
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { id } = await params;
  const project = await prisma.project.findFirst({
    where: { customerId: id, companyId: session.user.companyId, address: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { address: true },
  });

  return NextResponse.json({ address: project?.address ?? null });
}
