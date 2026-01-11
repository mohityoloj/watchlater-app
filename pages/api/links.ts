import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("links")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching links:", error);
      return res.status(500).json({ error: "Failed to fetch links" });
    }

    // FIX: return { links: [...] }
    return res.status(200).json({ links: data });
  }

  if (req.method === "POST") {
    const { url, platform, title, thumbnail_url, description, video_url, source_type } = req.body;

    const { data, error } = await supabase.from("links").insert([
      {
        url,
        platform,
        title,
        thumbnail_url,
        description,
        video_url,
        source_type,
        tags: [],
        metadata: null,
        summary: null,
      },
    ]);

    if (error) {
      console.error("Error inserting link:", error);
      return res.status(500).json({ error: "Failed to save link" });
    }

    return res.status(200).json({ success: true, link: data?.[0] });
  }

  return res.status(405).json({ error: "Method not allowed" });
}