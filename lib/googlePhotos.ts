// lib/googlePhotos.ts

export interface GooglePhoto {
  id: string;
  filename: string;
  baseUrl: string;
  creationTime: string;
  mimeType: string;
  mediaMetadata?: {
    width?: string;
    height?: string;
    creationTime?: string;
    photo?: any;
    video?: any;
  };
  productUrl?: string;
}

const GOOGLE_PHOTOS_API = "https://photoslibrary.googleapis.com/v1/mediaItems";

/**
 * Fetches ALL Google Photos metadata for a user.
 * Handles pagination automatically (10k+ photos).
 * Returns metadata only — no image downloads.
 */
export async function getGooglePhotos(accessToken: string): Promise<GooglePhoto[]> {
  console.log("📸 [GOOGLE PHOTOS] Starting fetch...");
  console.log("📸 [GOOGLE PHOTOS] Access token received:", accessToken);

  let items: GooglePhoto[] = [];
  let nextPageToken: string | undefined = undefined;

  try {
    do {
      const url = new URL(GOOGLE_PHOTOS_API);
      if (nextPageToken) url.searchParams.set("pageToken", nextPageToken);
      url.searchParams.set("pageSize", "100");

      console.log("📸 [GOOGLE PHOTOS] Fetching page with token:", nextPageToken);
      console.log("📸 [GOOGLE PHOTOS] Request URL:", url.toString());

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      console.log("📸 [GOOGLE PHOTOS] Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ [GOOGLE PHOTOS] API error response:", errorText);
        throw new Error("Failed to fetch Google Photos");
      }

      const data = await response.json();

      console.log(
        "📸 [GOOGLE PHOTOS] Items returned in this page:",
        data.mediaItems?.length || 0
      );

      if (data.mediaItems && Array.isArray(data.mediaItems)) {
        const mapped = data.mediaItems.map((item: any) => ({
          id: item.id,
          filename: item.filename,
          baseUrl: item.baseUrl,
          creationTime: item.mediaMetadata?.creationTime,
          mimeType: item.mimeType,
          mediaMetadata: item.mediaMetadata,
          productUrl: item.productUrl,
        }));

        items.push(...mapped);
      }

      nextPageToken = data.nextPageToken;
      console.log("📸 [GOOGLE PHOTOS] Next page token:", nextPageToken);
    } while (nextPageToken);

    console.log("🟢 [GOOGLE PHOTOS] Total items fetched:", items.length);
    return items;
  } catch (error) {
    console.error("❌ [GOOGLE PHOTOS] Exception:", error);
    return [];
  }
}