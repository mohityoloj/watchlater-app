export function detectPlatform(url: string): string {
  const lower = url.toLowerCase();

  if (lower.includes("youtube.com") || lower.includes("youtu.be")) {
    return "youtube";
  }

  if (lower.includes("tiktok.com")) {
    return "tiktok";
  }

  if (lower.includes("instagram.com")) {
    return "instagram";
  }

  if (lower.includes("twitter.com") || lower.includes("x.com")) {
    return "twitter";
  }

  return "generic";
}