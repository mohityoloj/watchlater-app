import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ----------------------------------------
// 1. ENVIRONMENT SETUP
// ----------------------------------------
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // service key required for inserts
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

// ----------------------------------------
// 2. PLATFORM DETECTION
// ----------------------------------------
function detectPlatform(url: string) {
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  if (url.includes("tiktok.com")) return "tiktok";
  if (url.includes("instagram.com")) return "instagram";
  return "generic";
}

// ----------------------------------------
// 3. METADATA FETCHERS
// ----------------------------------------

// YOUTUBE
async function fetchYouTubeMetadata(url: string) {
  try {
    const oembed = `https://www.youtube.com/oembed?url=${url}&format=json`;
    const res = await fetch(oembed);
    const data = await res.json();

    return {
      title: data.title,
      author: data.author_name,
      thumbnail: data.thumbnail_url,
      description: "",
    };
  } catch {
    return null;
  }
}

// TIKTOK
async function fetchTikTokMetadata(url: string) {
  try {
    const api = `https://www.tiktok.com/oembed?url=${url}`;
    const res = await fetch(api);
    const data = await res.json();

    return {
      title: data.title,
      author: data.author_name,
      thumbnail: data.thumbnail_url,
      description: "",
    };
  } catch {
    return null;
  }
}

// INSTAGRAM
async function fetchInstagramMetadata(url: string) {
  try {
    const api = `https://api.instagram.com/oembed/?url=${url}`;
    const res = await fetch(api);
    const data = await res.json();

    return {
      title: data.title || "",
      author: data.author_name || "",
      thumbnail: data.thumbnail_url || "",
      description: "",
    };
  } catch {
    return null;
  }
}

// GENERIC WEBPAGE (Wikipedia, blogs, news, etc.)
async function fetchGenericMetadata(url: string) {
  try {
    const res = await fetch(url);
    const html = await res.text();

    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1] : "Untitled Page";

    return {
      title,
      author: "",
      thumbnail: "",
      description: "",
    };
  } catch {
    return {
      title: "Unknown Page",
      author: "",
      thumbnail: "",
      description: "",
    };
  }
}

// ----------------------------------------
// 4. AI LABEL GENERATION (GEMINI)
// ----------------------------------------
async function generateLabels(metadata: any) {
  const prompt = `
You are an expert content classifier.

Given this metadata:

Title: ${metadata.title}
Author: ${metadata.author}

Generate 4–5 short labels (1–2 words each) that describe the core topics.

Return ONLY a JSON array of strings.
`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  return JSON.parse(text);
}

// ----------------------------------------
// 5. AI SUMMARY GENERATION (GEMINI)
// ----------------------------------------
async function generateSummary(metadata: any) {
  const prompt = `
Summarize this content in 3–5 sentences.
Make it clear, factual, and easy to skim.

Title: ${metadata.title}
Author: ${metadata.author}
`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

// ----------------------------------------
// 6. MAIN WEBHOOK HANDLER
// ----------------------------------------
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }
	// ⭐ ADD THIS LINE HERE
    console.log("Incoming body:", req.body);


   // Accept URL from Twilio WhatsApp or manual POST
const url =
  req.body?.url ||        // manual POST
  req.body?.Body ||       // Twilio WhatsApp text
  req.body?.body ||       // lowercase fallback
  req.body?.message ||    // some clients send this
  null;

console.log("Extracted URL:", url);

if (!url) {
  return res.status(400).json({ error: "No URL provided" });
}

    const platform = detectPlatform(url);

    let metadata = null;

    if (platform === "youtube") metadata = await fetchYouTubeMetadata(url);
    else if (platform === "tiktok") metadata = await fetchTikTokMetadata(url);
    else if (platform === "instagram") metadata = await fetchInstagramMetadata(url);
    else metadata = await fetchGenericMetadata(url);

    if (!metadata) {
      return res.status(500).json({ error: "Metadata fetch failed" });
    }

    // AI processing
    const labels = await generateLabels(metadata);
    const summary = await generateSummary(metadata);

    // Insert into Supabase
    await supabase.from("links").insert({
      url,
      title: metadata.title,
      labels,
      ai_summary: summary,
      thumbnail: metadata.thumbnail,
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}