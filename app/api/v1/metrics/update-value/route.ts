import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: NextRequest) {
  try {
    const { dashboardId, section, field, fields, value } = await req.json();

    if (!dashboardId || !field) {
      return NextResponse.json({ success: false, error: "Thiếu dashboardId hoặc field" }, { status: 400 });
    }

    const numValue = Number(value) || 0;
    const sec = (section || "").toUpperCase();

    // TẦNG 2, 3, 4, 5
    if (
      sec === "L2" || sec === "L3" || sec === "L4" || sec === "L5" ||
      sec === "LEVEL2" || sec === "LEVEL3" || sec === "LEVEL4" || sec === "LEVEL5"
    ) {
      const col = sec.includes("2")
        ? "level2"
        : sec.includes("3")
        ? "level3"
        : sec.includes("4")
        ? "level4"
        : "level5";

      const prefix = sec.includes("2")
        ? "l2_"
        : sec.includes("3")
        ? "l3_"
        : sec.includes("4")
        ? "l4_"
        : "l5_";

      const { data: dash } = await supabase.from("dashboards").select(`${col}, metadata`).eq("id", dashboardId).single();
      const currentData = (dash as any)?.[col] || (dash as any)?.metadata?.[col] || {};

      currentData[field] = numValue;
      currentData[`${prefix}${field}`] = numValue;

      const { error: updateColErr } = await supabase
        .from("dashboards")
        .update({ [col]: currentData })
        .eq("id", dashboardId);

      if (updateColErr) {
        const meta = (dash as any)?.metadata || {};
        meta[col] = currentData;
        await supabase.from("dashboards").update({ metadata: meta }).eq("id", dashboardId);
      }

      return NextResponse.json({ success: true, value: numValue });
    }

    // KHỐI B3 -> B9
    if (["B3", "B4", "B5", "B6", "B7", "B8", "B9"].includes(sec)) {
      const col = sec.toLowerCase();
      const { data: dash } = await supabase.from("dashboards").select(col).eq("id", dashboardId).single();
      const currentData = (dash as any)?.[col] || {};
      currentData[field] = numValue;

      const { error } = await supabase.from("dashboards").update({ [col]: currentData }).eq("id", dashboardId);
      if (error) throw error;
      return NextResponse.json({ success: true, value: numValue });
    }

    // KHỐI B1
    if (sec === "B1") {
      const updateFields = fields && fields.length > 0 ? fields : [field];
      const updateObj: Record<string, number> = {};
      updateFields.forEach((f: string) => (updateObj[f] = numValue));

      const { error } = await supabase.from("kpi_business_units").update(updateObj).eq("dashboard_id", dashboardId);
      if (error) throw error;
      return NextResponse.json({ success: true, value: numValue });
    }

    // KHỐI B2
    if (sec === "B2") {
      const { error } = await supabase.from("kpi_products").update({ [field]: numValue }).eq("dashboard_id", dashboardId);
      if (error) throw error;
      return NextResponse.json({ success: true, value: numValue });
    }

    return NextResponse.json({ success: true, value: numValue });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Lỗi cập nhật số liệu" }, { status: 500 });
  }
}