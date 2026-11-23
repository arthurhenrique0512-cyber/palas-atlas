import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.dzi': 'application/xml; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
};

const ASSETS_ROOT = path.resolve(process.cwd(), 'assets');

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await context.params;
  const relNormalized = path.posix
    .normalize((segments || []).join('/'))
    .replace(/^\/+/, '');
  if (
    relNormalized === 'histologia/manifest.json' ||
    relNormalized.endsWith('/manifest.json') ||
    /(?:^|\/)[^/]+_files(?:\/|$)/i.test(relNormalized)
  ) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const resolved = path.resolve(ASSETS_ROOT, ...(segments || []));

  if (
    resolved !== ASSETS_ROOT &&
    !resolved.startsWith(ASSETS_ROOT + path.sep)
  ) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  try {
    const stat = fs.statSync(resolved);
    if (!stat.isFile()) {
      return new NextResponse('Not Found', { status: 404 });
    }
    const ext = path.extname(resolved).toLowerCase();
    const contentType = MIME_MAP[ext] || 'application/octet-stream';
    const data = fs.readFileSync(resolved);

    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(stat.size),
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch {
    return new NextResponse('Not Found', { status: 404 });
  }
}
