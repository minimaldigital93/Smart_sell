import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    ok: true,
    name: "csms-app",
    time: new Date().toISOString(),
  });
}
