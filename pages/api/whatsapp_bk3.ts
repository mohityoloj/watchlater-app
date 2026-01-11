import type { NextApiRequest, NextApiResponse } from "next";
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

export const config = {
  api: {
    bodyParser: {
      type: "application/x-www-form-urlencoded",
    },
  },
};

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

// Helper: Check if URL is YouTube
function isYouTube(url: string) {
  return url.includes("youtube.com") || url.includes("youtu.be");
}

// Helper: Fetch YouTube metadata via oEmbed
async function fetchYouTubeMetadata(url: string) {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(
      url
    )}&format=json`;

    const response = await fetch(oembedUrl);
    if (!response.ok) return null;

    const data = await response.json();

    return {
      title: data.title || null,
      thumbnail_url: data.thumbnail_url || null,
      platform: "youtube",
    };
  } catch (err) {
    console.log("YouTube metadata fetch error:", err);
    return null;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log("\n===== NEW REQUEST =====");
  console.log("RAW TWILIO BODY:", req.body);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const message = req.body.Body;
    console.log("EXTRACTED MESSAGE:", message);

    if (!message) {
      return res.status(400).json({ error: "No message text found" });
    }

    // ------------------------------------
    // 1. YOUTUBE METADATA (title + thumbnail)
    // ------------------------------------
    let title = null;
    let thumbnail_url = null;
    let platform = null;

    if (isYouTube(message)) {
      console.log("Detected YouTube URL — fetching metadata...");
      const meta = await fetchYouTubeMetadata(message);

      if (meta) {
        title = meta.title;
        thumbnail_url = meta.thumbnail_url;
        platform = meta.platform;
      }
    }

    // ------------------------------------
    // 2. GEMINI SUMMARY + TAGS
    // ------------------------------------
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `
You are a JSON-only engine.

Given this message:
"${message}"

Return ONLY valid JSON. No explanation. No markdown. No extra text.

Format exactly like this:
{
  "summary": "short summary",
  "tags": ["tag1", "tag2"]
}
                  `,
                },
              ],
            },
          ],
        }),
      }
    );

    console.log("GEMINI STATUS:", geminiResponse.status);

    const geminiData = await geminiResponse.json();
    console.log("RAW GEMINI RESPONSE:", geminiData);

    // Universal Gemini 2.x extractor
    const content = geminiData?.candidates?.[0]?.content;
    console.log("CONTENT STRUCTURE:", content);

    let aiText = "";

    try {
      if (Array.isArray(content)) {
        for (const item of content) {
          if (typeof item.text === "string") aiText += item.text;
          if (Array.isArray(item.parts)) {
            for (const p of item.parts) {
              if (typeof p.text === "string") aiText += p.text;
            }
          }
        }
      } else if (content && typeof content === "object") {
        if (Array.isArray(content.parts)) {
          for (const p of content.parts) {
            if (typeof p.text === "string") aiText += p.text;
          }
        }
        if (typeof content.text === "string") aiText += content.text;
      }
    } catch (err) {
      console.log("TEXT EXTRACTION ERROR:", err);
    }

    console.log("EXTRACTED AI TEXT:", aiText);

    if (!aiText) {
      return res.status(500).json({
        error: "Gemini returned no usable text",
        raw: geminiData,
      });
    }

    // Clean + parse JSON
    let cleaned = aiText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) cleaned = jsonMatch[0];

    console.log("CLEANED JSON TEXT:", cleaned);

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
      console.log("PARSED JSON:", parsed);
    } catch (err) {
      console.log("JSON PARSE ERROR:", err);
      return res.status(500).json({
        error: "Invalid JSON from Gemini",
        aiText,
        cleaned,
      });
    }

    const { summary, tags } = parsed;

    // ------------------------------------
    // 3. SUPABASE INSERT
    // ------------------------------------
    const { data, error } = await supabase.from("links").insert([
      {
        url: message,
        summary,
        tags,
        title,
        thumbnail_url,
        platform,
      },
    ]);

    if (error) {
      console.log("SUPABASE ERROR:", error);
      return res.status(500).json({
        error: "Supabase insert failed",
        details: error,
      });
    }

    console.log("SUPABASE INSERT SUCCESS:", data);

    // ------------------------------------
    // 4. TWILIO WHATSAPP CONFIRMATION
    // ------------------------------------
    res.setHeader("Content-Type", "text/xml");
    return res.status(200).send(`
      <Response>
        <Message>Saved! 🎉\n${title ? `Title: ${title}` : ""}</Message>
      </Response>
    `);
  } catch (err: any) {
    console.log("UNEXPECTED ERROR:", err);
    return res.status(500).json({
      error: "Unexpected server error",
      details: err.message,
    });
  }
}