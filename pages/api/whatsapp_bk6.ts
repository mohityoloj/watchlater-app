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

// ------------------------
// Env + Supabase
// ------------------------

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const INSTAGRAM_STABLE_API_KEY =
  process.env.INSTAGRAM_STABLE_API_KEY ??
  "ebf500af15mshbac820680a7851ap106b9ajsnad9019028383";
const INSTAGRAM_STABLE_HOST =
  "instagram-scraper-stable-api.p.rapidapi.com";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

// ------------------------
// Helpers
// ------------------------

function extractFirstUrl(text: string): string | null {
  const urlRegex =
    /(https?:\/\/[^\s<>"]+|www\.[^\s<>"]+)/i;
  const match = text.match(urlRegex);
  if (!match) return null;

  let raw = match[0].trim();
  raw = raw.replace(/[),.]+$/, "");
  if (!raw.startsWith("http")) raw = "https://" + raw;
  return raw;
}

// Unwrap Microsoft SafeLinks
function unwrapSafeLink(url: string): string {
  try {
    const parsed = new URL(url);
    const real = parsed.searchParams.get("url");
    return real ? decodeURIComponent(real) : url;
  } catch {
    return url;
  }
}

function isYouTube(url: string) {
  return url.includes("youtube.com") || url.includes("youtu.be");
}

function isInstagram(url: string) {
  return url.includes("instagram.com");
}

// ------------------------
// YouTube metadata (oEmbed)
// ------------------------

async function fetchYouTubeMetadata(url: string) {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(
      url
    )}&format=json`;

    const response = await fetch(oembedUrl);
    if (!response.ok) {
      console.log("YouTube oEmbed not ok:", response.status);
      return null;
    }

    const data = await response.json();

    return {
      title: data.title || null,
      thumbnail_url: data.thumbnail_url || null,
      platform: "youtube",
      description: null,
      raw: data,
    };
  } catch (err) {
    console.log("YouTube metadata fetch error:", err);
    return null;
  }
}

// ------------------------
// Instagram Stable API (primary)
// ------------------------

async function fetchInstagramStableMetadata(url: string) {
  try {
    const urlObj = new URL(url);
    const cleanUrl = `https://www.instagram.com${urlObj.pathname}`;

    const isReel = urlObj.pathname.toLowerCase().startsWith("/reel/");
    const type = isReel ? "reel" : "post";

    const encoded = encodeURIComponent(cleanUrl);

    const apiUrl = `https://${INSTAGRAM_STABLE_HOST}/get_media_data.php?reel_post_code_or_url=${encoded}&type=${type}`;

    const res = await fetch(apiUrl, {
      headers: {
        "x-rapidapi-host": INSTAGRAM_STABLE_HOST,
        "x-rapidapi-key": INSTAGRAM_STABLE_API_KEY,
      },
    });

    if (!res.ok) {
      console.log("Instagram Stable API HTTP error:", res.status);
      return null;
    }

    const data = await res.json();
    if (data.error) {
      console.log("Instagram Stable API error field:", data.error);
      return null;
    }

    const caption =
      data.edge_media_to_caption?.edges?.[0]?.node?.text || null;

    return {
      title:
        (data.title && data.title.trim().length > 0
          ? data.title
          : caption) || "Instagram",
      description: caption,
      thumbnail_url: data.thumbnail_src || data.display_url || null,
      platform: "instagram.com",
      raw: data,
    };
  } catch (err) {
    console.log("Instagram Stable metadata fetch error:", err);
    return null;
  }
}

// ------------------------
// Instagram Post metadata (fallback)
// ------------------------

async function fetchInstagramPostMetadata(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      },
    });

    const html = await response.text();

    const jsonMatch = html.match(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/
    );

    if (!jsonMatch) {
      console.log("Instagram Post JSON metadata not found");
      return null;
    }

    const json = JSON.parse(jsonMatch[1]);

    return {
      title: json.caption || json.name || "Instagram Post",
      description: json.caption || null,
      thumbnail_url: json.image || null,
      platform: "instagram.com",
      raw: json,
    };
  } catch (err) {
    console.log("Instagram Post metadata fetch error:", err);
    return null;
  }
}

// ------------------------
// Instagram Reel metadata (fallback)
// ------------------------

async function fetchInstagramReelMetadata(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      },
    });

    const html = await response.text();

    const match = html.match(
      /window\.__additionalDataLoaded\([^,]+,\s*(\{[\s\S]*?\})\);/
    );

    if (!match) {
      console.log("Reel JSON metadata not found");
      return null;
    }

    const json = JSON.parse(match[1]);
    const media = json?.graphql?.shortcode_media;

    if (!media) return null;

    return {
      title:
        media.title ||
        media.edge_media_to_caption?.edges?.[0]?.node?.text ||
        "Instagram Reel",
      description:
        media.edge_media_to_caption?.edges?.[0]?.node?.text || null,
      thumbnail_url: media.display_url || null,
      platform: "instagram.com",
      raw: json,
    };
  } catch (err) {
    console.log("Instagram Reel metadata fetch error:", err);
    return null;
  }
}

// ------------------------
// OpenGraph fallback
// ------------------------

async function fetchOpenGraph(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      },
    });

    if (!response.ok) {
      console.log("OpenGraph fetch not ok:", response.status);
      return null;
    }

    const html = await response.text();

    const getMeta = (property: string) => {
      const regex = new RegExp(
        `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`,
        "i"
      );
      const match = html.match(regex);
      return match?.[1] || null;
    };

    const title =
      getMeta("og:title") ||
      html.match(/<title>(.*?)<\/title>/i)?.[1] ||
      null;

    const description =
      getMeta("og:description") ||
      html.match(
        /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i
      )?.[1] ||
      null;

    const thumbnail_url = getMeta("og:image");

    const hostname = (() => {
      try {
        return new URL(url).hostname.replace(/^www\./, "");
      } catch {
        return null;
      }
    })();

    return {
      title,
      description,
      thumbnail_url,
      platform: hostname,
      raw: { ogTitle: title, ogDescription: description, ogImage: thumbnail_url },
    };
  } catch (err) {
    console.log("OpenGraph fetch error:", err);
    return null;
  }
}

// ------------------------
// Gemini Auto‑Model Detection
// ------------------------

async function callGemini(prompt: string) {
  const models = [
    "gemini-2.0-flash",   // try newest first
    "gemini-1.5-flash",   // fallback (guaranteed to work)
  ];

  for (const model of models) {
    try {
      console.log(`TRYING MODEL: ${model}`);

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        }
      );

      if (!response.ok) {
        console.log(`MODEL FAILED (${model}):`, response.status);
        continue;
      }

      const data = await response.json();
      console.log(`MODEL SUCCESS (${model})`);
      return data;
    } catch (err) {
      console.log(`MODEL ERROR (${model}):`, err);
    }
  }

  throw new Error("All Gemini models failed");
}

// ------------------------
// Main handler
// ------------------------

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body as any;
    const message: string = body.Body || body.message || "";

    if (!message) {
      return res.status(400).json({ error: "No message received" });
    }

    let url = extractFirstUrl(message);
    if (!url) {
      return res.status(400).json({ error: "No URL found in message" });
    }

    url = unwrapSafeLink(url);

    console.log("INCOMING MESSAGE:", message);
    console.log("EXTRACTED URL:", url);

    // ------------------------------------
    // 1. METADATA FETCH
    // ------------------------------------

    let meta: any = null;

    if (isYouTube(url)) {
      meta = await fetchYouTubeMetadata(url);
    } else if (isInstagram(url)) {
      meta =
        (await fetchInstagramStableMetadata(url)) ||
        (url.includes("/reel/")
          ? await fetchInstagramReelMetadata(url)
          : await fetchInstagramPostMetadata(url));
    } else {
      meta = await fetchOpenGraph(url);
    }

    const title = meta?.title || null;
    const description = meta?.description || null;
    const thumbnail_url = meta?.thumbnail_url || null;
    const platform = meta?.platform || null;

    console.log("FINAL METADATA:", {
      title,
      description,
      thumbnail_url,
      platform,
    });

    // ------------------------------------
    // 2. GEMINI CALL (auto‑model detection)
    // ------------------------------------

    const prompt = `
You are helping categorize a saved link.

Given this link and its metadata:

URL: ${url}
Title: ${title ?? "N/A"}
Description: ${description ?? "N/A"}
Platform: ${platform ?? "N/A"}

Return a concise JSON object with this shape:

{
  "summary": "one or two sentence human-friendly summary of what this link is about",
  "tags": ["short", "keyword-like", "tags", "for", "this", "link"]
}

Rules:
- Respond with ONLY valid JSON.
- Do not wrap it in backticks.
- Do not add commentary.
`;

    const geminiData = await callGemini(prompt);

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

    let parsed: { summary: string; tags: string[] };
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

    const { data, error } = await supabase
      .from("links")
      .insert([
        {
          url,
          summary,
          tags,
          title,
          thumbnail_url,
          platform,
          description,
          source_type: "whatsapp",
          watched: false,
          metadata: meta?.raw ?? meta ?? null,
          video_url: null,
          labels: [],
          ai_summary: summary,
        },
      ])
      .select();

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

    const replyTitle = title || summary || "Link saved";
    res.setHeader("Content-Type", "text/xml");
    return res.status(200).send(`
      <Response>
        <Message>Saved!
${replyTitle}</Message>
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