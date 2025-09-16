import { NextResponse } from "next/server";
import { put } from "@vercel/blob";

// If you prefer Edge runtime, you can uncomment this:
// export const runtime = "edge";

export async function POST(req: Request) {
  try {
    const form = await req.formData();

    const file = form.get("file") as File | null;
    const prefix = String(form.get("prefix") || "cards");
    const originalName = String(form.get("filename") || (file?.name ?? "upload"));

    if (!file) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const ts = Date.now();
    const safeName = originalName.replace(/[^\w.\-]/g, "_");
    const pathname = `${prefix}/${ts}-${safeName}`;

    // `put` reads BLOB_READ_WRITE_TOKEN from your env automatically
    const blob = await put(pathname, file, { access: "public" });

    return NextResponse.json({ url: blob.url }, { status: 200 });
  } catch (err) {
    console.error("blob/upload error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
