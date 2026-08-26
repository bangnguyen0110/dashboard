import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { dashboardId, durationSec } = await req.json();
    
    // In trực tiếp ra terminal VS Code
    console.log(`\n========================================`);
    console.log(`⏱️ [PERF LOG] Dashboard ID: [${dashboardId}]`);
    console.log(`🚀 Thời gian load xong: ${durationSec} giây`);
    console.log(`========================================\n`);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false }, { status: 400 });
  }
}