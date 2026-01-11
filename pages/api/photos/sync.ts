// pages/api/photos/sync.ts

import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { getGooglePhotos } from "@/lib/googlePhotos";
import { savePhotosToSupabase } from "@/lib/supabasePhotos";

export default async function handler(req, res) {
  try {
    // 1. Validate session
    const session = await getServerSession(req, res, authOptions);

    if (!session) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // 2. Fetch Google Photos metadata
    const photos = await getGooglePhotos(session.accessToken);

    console.log("Fetched photos:", photos.length);

    // 3. Save to Supabase
    const { data, error } = await savePhotosToSupabase(
      session.user.email, // or session.user.id if you store IDs
      photos
    );

    if (error) {
      console.error("Supabase error:", error);
      return res.status(500).json({ error: "Failed to save photos" });
    }

    // 4. Respond
    return res.status(200).json({
      message: "Sync complete",
      totalPhotos: photos.length,
    });
  } catch (err) {
    console.error("Sync error:", err);
    return res.status(500).json({ error: "Unexpected server error" });
  }
}