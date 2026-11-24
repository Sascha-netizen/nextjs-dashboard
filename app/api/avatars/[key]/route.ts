import { GetObjectCommand } from '@aws-sdk/client-s3';
import { s3, BUCKET } from '@/app/lib/s3';

// Only keys we generated ourselves: a UUID plus an allowed extension.
const KEY_PATTERN = /^[0-9a-f-]{36}\.(png|jpg|webp)$/;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  if (!KEY_PATTERN.test(key)) {
    return new Response('Not found', { status: 404 });
  }

  try {
    const object = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    return new Response(object.Body!.transformToWebStream(), {
      headers: {
        'Content-Type': object.ContentType ?? 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}