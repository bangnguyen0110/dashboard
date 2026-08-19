import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase"; // hoặc getSupabaseAdmin()

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const id = resolvedParams.id;
    const body = await req.json();

    const domainLink = body.domainLink || body.base_domain || body.domain_link || "";

    // 1. Lấy metadata hiện tại để không bị ghi đè mất dữ liệu khác
    const { data: currentDash } = await supabase
      .from("dashboards")
      .select("metadata")
      .eq("id", id)
      .maybeSingle();

    const mergedMetadata = {
      ...(currentDash?.metadata || {}),
      ...(body.metadata || {}),
      base_domain: domainLink,
    };

    // 2. Cập nhật vào DB
    const updatePayload: Record<string, any> = {
      domain_link: domainLink,
      base_domain: domainLink,
      metadata: mergedMetadata,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("dashboards")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("❌ Lỗi Supabase Backend:", error);
      return NextResponse.json(
        { error: error.message || "Không thể cập nhật cơ sở dữ liệu" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("❌ Lỗi API Route:", err);
    return NextResponse.json(
      { error: err?.message || "Lỗi xử lý yêu cầu phía máy chủ" },
      { status: 500 }
    );
  }
}