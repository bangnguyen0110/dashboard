import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawUrl = body.url || body.targetUrl;

    if (!rawUrl || typeof rawUrl !== "string") {
      return NextResponse.json(
        { error: "Thiếu URL cần lấy dữ liệu" },
        { status: 400 }
      );
    }

    const targetUrl = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;

    // 1. Fetch HTML từ web đích
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Không thể truy cập URL: HTTP ${response.status}` },
        { status: response.status }
      );
    }

    const html = await response.text();

    let extractedNumber: number | null = null;
    let matchedText = "";

    // LỚP 1: Bắt chính xác class "padding10 chudo chudam" (hỗ trợ nhiều khoảng trắng)
    const exactClassRegex = /<div[^>]*class=["'][^"']*padding10\s+chudo\s+chudam[^"']*["'][^>]*>([\s\S]*?)<\/div>/i;
    let match = html.match(exactClassRegex);

    // LỚP 2: Bắt 3 class bất kể thứ tự (vd: chudo padding10 chudam)
    if (!match) {
      const flexibleClassRegex = /<div[^>]*class=["'][^"']*(?=.*\bpadding10\b)(?=.*\bchudo\b)(?=.*\bchudam\b)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i;
      match = html.match(flexibleClassRegex);
    }

    if (match && match[1]) {
      matchedText = match[1].replace(/<[^>]*>/g, "").trim();
      const numMatch = matchedText.match(/\d[\d.,]*/);
      if (numMatch) {
        extractedNumber = parseInt(numMatch[0].replace(/[.,]/g, ""), 10);
      }
    }

    // LỚP 3: Quét trực tiếp cụm text "Tổng: [số]" hoặc "Tổng : [số]" trong toàn bộ HTML
    if (extractedNumber === null) {
      const tongRegex = /Tổng\s*:\s*(\d[\d.,]*)/i;
      const tongMatch = html.match(tongRegex);
      if (tongMatch && tongMatch[1]) {
        matchedText = tongMatch[0];
        extractedNumber = parseInt(tongMatch[1].replace(/[.,]/g, ""), 10);
      }
    }

    // Nếu vẫn không tìm thấy, trả về thông tin debug cụ thể
    if (extractedNumber === null) {
      return NextResponse.json(
        {
          error: "Không tìm thấy thẻ chứa 'padding10 chudo chudam' hoặc chuỗi 'Tổng: [số]'",
          debug: {
            hasPadding10: html.includes("padding10"),
            hasChudo: html.includes("chudo"),
            hasChudam: html.includes("chudam"),
            hasTong: html.includes("Tổng:"),
            htmlLength: html.length,
          },
          success: false,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      value: extractedNumber, // Trả về 177
      rawText: matchedText,
      url: targetUrl,
    });
  } catch (error: any) {
    console.error("Scrape Error:", error);
    return NextResponse.json(
      { error: error?.message || "Lỗi xử lý bóc tách dữ liệu" },
      { status: 500 }
    );
  }
}