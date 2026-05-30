import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json({ error: "Online payments are disabled for this release." }, { status: 410 });
}
