import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
const IMAGES_DIR = path.join(UPLOADS_DIR, "images");
const AUDIO_DIR = path.join(UPLOADS_DIR, "audio");

// 許容MIMEタイプと拡張子のマッピング
const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg"
};

const ALLOWED_AUDIO_TYPES: Record<string, string> = {
  "audio/mpeg": ".mp3",
  "audio/mp3": ".mp3",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/m4a": ".m4a",
  "audio/x-m4a": ".m4a",
  "audio/aac": ".m4a",
  "audio/ogg": ".ogg",
  "audio/webm": ".webm"
};

// 最大ファイルサイズ
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25MB

async function ensureUploadDirs() {
  await fs.mkdir(IMAGES_DIR, { recursive: true });
  await fs.mkdir(AUDIO_DIR, { recursive: true });
}

export async function POST(req: NextRequest) {
  try {
    await ensureUploadDirs();

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: "アップロードするファイルが指定されていません。" },
        { status: 400 }
      );
    }

    const mimeType = file.type.toLowerCase();
    const isImage = mimeType in ALLOWED_IMAGE_TYPES;
    const isAudio = mimeType in ALLOWED_AUDIO_TYPES;

    if (!isImage && !isAudio) {
      return NextResponse.json(
        {
          error: "対応していないファイル形式です。（画像: JPG/PNG/WebP/GIF/SVG, 音声: MP3/WAV/M4A/OGG/WebM）"
        },
        { status: 400 }
      );
    }

    const maxLimit = isImage ? MAX_IMAGE_SIZE : MAX_AUDIO_SIZE;
    if (file.size > maxLimit) {
      const limitMb = maxLimit / (1024 * 1024);
      return NextResponse.json(
        { error: `ファイルサイズが上限（${limitMb}MB）を超えています。` },
        { status: 400 }
      );
    }

    // 拡張子の決定
    let ext = isImage ? ALLOWED_IMAGE_TYPES[mimeType] : ALLOWED_AUDIO_TYPES[mimeType];
    // 元ファイル名から拡張子が拾えれば優先（拡張子偽装防止のため許可拡張子のみ）
    if ("name" in file && typeof file.name === "string") {
      const origExt = path.extname(file.name).toLowerCase();
      if (
        (isImage && Object.values(ALLOWED_IMAGE_TYPES).includes(origExt)) ||
        (isAudio && Object.values(ALLOWED_AUDIO_TYPES).includes(origExt))
      ) {
        ext = origExt;
      }
    }

    const uniqueId = crypto.randomUUID().slice(0, 8);
    const timestamp = Date.now();
    const filename = `${timestamp}_${uniqueId}${ext}`;
    const subDir = isImage ? IMAGES_DIR : AUDIO_DIR;
    const publicSubDir = isImage ? "images" : "audio";
    const filePath = path.join(subDir, filename);

    // バッファを書き込み
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.writeFile(filePath, buffer);

    const publicUrl = `/uploads/${publicSubDir}/${filename}`;

    return NextResponse.json({
      success: true,
      url: publicUrl,
      filename,
      type: isImage ? "image" : "audio",
      size: file.size
    });
  } catch (error: any) {
    console.error("Upload handler error:", error);
    return NextResponse.json(
      { error: "アップロード処理中にエラーが発生しました: " + (error?.message || "不明なエラー") },
      { status: 500 }
    );
  }
}
