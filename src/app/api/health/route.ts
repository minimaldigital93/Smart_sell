import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    ok: true,
    name: "smart_sell",
    time: new Date().toISOString(),
  });
}
