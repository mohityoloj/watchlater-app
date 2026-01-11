// lib/supabasePhotos.ts

import { createClient } from "@supabase/supabase-js";
import type { GooglePhoto } from "./googlePhotos";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // server-side only
);

/**
 * Inserts Google Photos metadata into Supabase.
 * Avoids duplicates using upsert on google_id.
 */
export async function savePhotosToSupabase(
  userId: string,
  photos: GooglePhoto[]
) {
  if (!photos.length) {
    console.log("No photos to save.");
    return { data: null, error: null };
  }

  // Transform GooglePhoto → DB row
  const rows = photos.map((p) => ({
    user_id: userId,
    google_id: p.id,
    filename: p.filename,
    base_url: p.baseUrl,
    created_at: p.creationTime,
    mime_type: p.mimeType,
    metadata: p.mediaMetadata || null,
  }));

  const { data, error } = await supabase
    .from("photos")
    .upsert(rows, {
      onConflict: "google_id", // prevents duplicates
    });

  if (error) {
    console.error("Supabase insert error:", error);
  } else {
    console.log(`Inserted/updated ${rows.length} photos into Supabase`);
  }

  return { data, error };
}