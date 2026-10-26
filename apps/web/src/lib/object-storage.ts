/**
 * GC-Scouting - object-storage
 *
 * S3 compatible bucket (Infomaniak Object Storage) holding the rendered share images.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { DeleteObjectsCommand, GetObjectCommand, NoSuchKey, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

// S3_BUCKET unset (local dev): no storage, the images are rendered on each request.

/** DeleteObjects takes 1000 keys at most. */
const DELETE_BATCH = 1000;

export type StoredObject = { bytes: Uint8Array; metadata: Record<string, string> };

let client: S3Client | null = null;

function config(): { s3: S3Client; bucket: string } | null {
  const { S3_BUCKET: bucket, S3_ENDPOINT: endpoint, S3_ACCESS_KEY_ID: accessKeyId, S3_SECRET_ACCESS_KEY: secretAccessKey } = process.env;
  if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) return null;
  client ??= new S3Client({
    endpoint,
    region: process.env.S3_REGION || "us-east-1",
    credentials: { accessKeyId, secretAccessKey },
    // Swift/Ceph style endpoints do not resolve bucket subdomains.
    forcePathStyle: true,
  });
  return { s3: client, bucket };
}

export function storageEnabled(): boolean {
  return config() !== null;
}

/** Null when the object does not exist or storage is not configured. */
export async function getObject(key: string): Promise<StoredObject | null> {
  const target = config();
  if (!target) return null;
  try {
    const { Body, Metadata } = await target.s3.send(new GetObjectCommand({ Bucket: target.bucket, Key: key }));
    return Body ? { bytes: await Body.transformToByteArray(), metadata: Metadata ?? {} } : null;
  } catch (error) {
    if (error instanceof NoSuchKey) return null;
    throw error;
  }
}

export async function putObject(key: string, bytes: ArrayBuffer, contentType: string, metadata: Record<string, string>): Promise<void> {
  const target = config();
  if (!target) return;
  await target.s3.send(new PutObjectCommand({ Bucket: target.bucket, Key: key, Body: new Uint8Array(bytes), ContentType: contentType, Metadata: metadata }));
}

export async function deleteObjects(keys: string[]): Promise<void> {
  const target = config();
  if (!target) return;
  for (let i = 0; i < keys.length; i += DELETE_BATCH) {
    const Objects = keys.slice(i, i + DELETE_BATCH).map((Key) => ({ Key }));
    await target.s3.send(new DeleteObjectsCommand({ Bucket: target.bucket, Delete: { Objects, Quiet: true } }));
  }
}
