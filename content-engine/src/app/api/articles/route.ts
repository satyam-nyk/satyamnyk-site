import { NextRequest, NextResponse } from "next/server";

import { connectToDb } from "@/lib/services/db";
import { assertAdmin, UnauthorizedError } from "@/lib/utils/requireAdmin";
import { Article } from "@/models/Article";

export async function GET(request: NextRequest) {
  try {
    assertAdmin(request);
    await connectToDb();

    const status = request.nextUrl.searchParams.get("status");
    const clusterId = request.nextUrl.searchParams.get("clusterId");

    const query: Record<string, unknown> = {};

    if (status) {
      query.status = status;
    }

    if (clusterId) {
      query.clusterId = clusterId;
    }

    const articles = await Article.find(query)
      .populate("clusterId")
      .sort({ createdAt: -1 })
      .lean()
      .limit(200);

    return NextResponse.json({ articles });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
