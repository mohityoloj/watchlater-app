export type BasicMetadata = {
  title: string | null;
  description: string | null;
  thumbnail_url: string | null;
  video_url: string | null;   // ⭐ NEW
  source_type: string;
};

/**
 * Fetch basic metadata for a URL, based on platform.
 * Supports: YouTube, TikTok (via oEmbed)
 */
export async function fetchMetadataForUrl(
  url: string,
  platform: string
): Promise<BasicMetadata> {
  // -----------------------------
  // YOUTUBE (oEmbed)
  // -----------------------------
  if (platform === "youtube") {
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(
        url
      )}&format=json`;

      const res = await fetch(oembedUrl);

      if (!res.ok) {
        return {
          title: null,
          description: null,
          thumbnail_url: null,
          source_type: "youtube",
        };
      }

      const data = await res.json();

      return {
        title: data.title ?? null,
        description: null, // YouTube oEmbed doesn't include description
        thumbnail_url: data.thumbnail_url ?? null,
		video_url: null,                 // ⭐ NEW
        source_type: "youtube",
      };
    } catch (e) {
      console.error("Error fetching YouTube metadata:", e);
      return {
        title: null,
        description: null,
        thumbnail_url: null,
		video_url: null,                 // ⭐ NEW
        source_type: "youtube",
      };
    }
  }

  // -----------------------------
  // TIKTOK (oEmbed — the ONLY reliable server-side method)
  // -----------------------------
  if (platform === "tiktok") {
    try {
      const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(
        url
      )}`;

      const res = await fetch(oembedUrl);

      if (!res.ok) {
        return {
          title: null,
          description: null,
          thumbnail_url: null,
          source_type: "tiktok",
        };
      }

      const data = await res.json();

      return {
        title: data.title ?? null,
        description: null, // TikTok oEmbed does not include description
        thumbnail_url: data.thumbnail_url ?? null,
		video_url: null,                 // ⭐ NEW
        source_type: "tiktok",
      };
    } catch (e) {
      console.error("Error fetching TikTok metadata:", e);
      return {
        title: null,
        description: null,
        thumbnail_url: null,
		video_url: null,                 // ⭐ NEW
        source_type: "tiktok",
      };
    }
  }

 
  // -----------------------------
// INSTAGRAM (OpenGraph scraping)
// -----------------------------
// -----------------------------
// INSTAGRAM (RapidAPI - "Instagram" by 9527)
// -----------------------------
// -----------------------------
// INSTAGRAM (RapidAPI - Instagram Scraper Stable API)
// -----------------------------
// -----------------------------
// INSTAGRAM (RapidAPI - Instagram Scraper Stable API)
// -----------------------------
// -----------------------------
// INSTAGRAM (RapidAPI - Instagram Scraper Stable API)
// -----------------------------

// -----------------------------
// INSTAGRAM (RapidAPI - Instagram Scraper Stable API)
// -----------------------------
// -----------------------------
// INSTAGRAM (RapidAPI - Instagram120)
// -----------------------------

// -----------------------------
// INSTAGRAM (RapidAPI - Instagram120)
// -----------------------------

// -----------------------------
// INSTAGRAM (RapidAPI - Instagram120)
// -----------------------------
if (platform === "instagram") {
  try {
    // Extract shortcode from URL
    const match = url.match(/\/(p|reel)\/([^\/]+)/);
    const shortcode = match ? match[2] : null;

    if (!shortcode) {
      console.error("Could not extract shortcode from Instagram URL:", url);
      return {
        title: null,
        description: null,
        thumbnail_url: null,
        source_type: "instagram",
      };
    }

    const apiUrl = `https://${process.env.RAPIDAPI_HOST}/api/instagram/mediaByShortcode`;

    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-RapidAPI-Key": process.env.RAPIDAPI_KEY!,
        "X-RapidAPI-Host": process.env.RAPIDAPI_HOST!,
      },
      body: JSON.stringify({ shortcode }),
    });

    if (!res.ok) {
      console.error("Instagram API error:", await res.text());
      return {
        title: null,
        description: null,
        thumbnail_url: null,
        source_type: "instagram",
      };
    }

    const data = await res.json();
    const item = Array.isArray(data) ? data[0] : null;

    if (!item) {
      console.error("Instagram API returned empty data:", data);
      return {
        title: null,
        description: null,
        thumbnail_url: null,
        source_type: "instagram",
      };
    }

    return {
      title: item.meta?.title ?? null,
      description: item.meta?.title ?? null,
      thumbnail_url: item.pictureUrl ?? null,
      video_url: item.urls?.[0]?.url ?? null,   // ⭐ NEW
      source_type: "instagram",
    };
  } catch (e) {
    console.error("Instagram API error:", e);
    return {
      title: null,
      description: null,
      thumbnail_url: null,
	  video_url: null,                 // ⭐ NEW
      source_type: "instagram",
    };
  }
}


 // -----------------------------
  // DEFAULT (other platforms)
  // -----------------------------
  return {
    title: null,
    description: null,
    thumbnail_url: null,
	video_url: null,                 // ⭐ NEW
    source_type: "other",
  };
}