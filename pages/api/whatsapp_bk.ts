import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { detectPlatform } from "@/lib/detectPlatform";
import { fetchMetadataForUrl } from "@/lib/fetchMetadata";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
	console.log("WHATSAPP ROUTE HIT");
  if (req.method !== "POST") {
    return res.status(200).send("OK");
  }

  const message = req.body?.Body || "";

  // Extract ANY URL
  const urlMatch = message.match(/https?:\/\/\S+/);

  if (!urlMatch) {
    res.setHeader("Content-Type", "text/xml");
    return res
      .status(200)
      .send(`<Response><Message>No valid URL found in your message.</Message></Response>`);
  }

  const url = urlMatch[0];

  // Detect platform
  const platform = detectPlatform(url);

  // Fetch metadata
  const meta = await fetchMetadataForUrl(url, platform);

  // 🔍 DEBUG LOG #1 — Before inserting into Supabase
  console.log("DEBUG: About to insert into Supabase", {
    url,
    platform,
    meta,
  });

  // Insert into Supabase
  const { error } = await supabase.from("links").insert([
    {
      url,
      platform,
      title: meta.title,
      thumbnail_url: meta.thumbnail_url,
      description: meta.description,
      video_url: meta.video_url,
      source_type: meta.source_type,
      tags: [],
      metadata: null,
      summary: null,
    },
  ]);

  // 🔍 DEBUG LOG #2 — After insert attempt
  console.log("DEBUG: Supabase insert result:", { error });

  if (error) {
    console.error("Supabase insert error:", error);
    res.setHeader("Content-Type", "text/xml");
    return res
      .status(200)
      .send(`<Response><Message>Oops! Something went wrong saving your link.</Message></Response>`);
  }

  // Success reply
  res.setHeader("Content-Type", "text/xml");
  return res
    .status(200)
    .send(`<Response><Message>Saved to Watch Later! 🎉</Message></Response>`);
}