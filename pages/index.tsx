import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type LinkItem = {
  id: string;
  url: string;
  title: string;
  thumbnail_url: string | null;
  description: string | null;
  source_type: string;
  tags: string[] | null;
  watched: boolean;
  created_at: string;

  // NEW FIELDS FROM AI PIPELINE
  labels?: string[];
  ai_summary?: string;
  sender?: string;   // 👈 ADD THIS
  _isNew?: boolean;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const fetchLinks = async () => {
    setInitialLoading(true);
    try {
      const res = await fetch("/api/links");
      const data = await res.json();
      setLinks(Array.isArray(data.links) ? data.links : []);
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
  }, []);

  // Realtime Supabase updates
  useEffect(() => {
    const channel = supabase
      .channel("public:links")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "links" },
        (payload) => {
          const newLink = { ...payload.new, _isNew: true };

          setLinks((prev) => [newLink, ...prev]);

          setTimeout(() => {
            setLinks((prev) =>
              prev.map((l) =>
                l.id === newLink.id ? { ...l, _isNew: false } : l
              )
            );
          }, 4000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleAdd = async () => {
    if (!url.trim()) return;
    setLoading(true);

    try {
      const res = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();

      if (res.ok && data.link) {
        setLinks((prev) => [data.link, ...prev]);
        setUrl("");
      } else {
        alert(data.error || "Failed to add link");
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleWatched = async (id: string, current: boolean) => {
    const res = await fetch(`/api/links/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ watched: !current }),
    });

    if (res.ok) {
      setLinks((prev) =>
        prev.map((link) =>
          link.id === id ? { ...link, watched: !current } : link
        )
      );
    }
  };

  const deleteLink = async (id: string) => {
    if (!window.confirm("Delete this link?")) return;

    const res = await fetch(`/api/links/${id}`, { method: "DELETE" });

    if (res.ok) {
      setLinks((prev) => prev.filter((link) => link.id !== id));
    }
  };

  const filteredLinks = links.filter((link) => {
    const text = search.toLowerCase();

    return (
      link.title?.toLowerCase().includes(text) ||
      link.url?.toLowerCase().includes(text) ||
      link.description?.toLowerCase().includes(text) ||
      link.source_type?.toLowerCase().includes(text) ||
      link.tags?.some((t) => t.toLowerCase().includes(text)) ||
      link.labels?.some((t) => t.toLowerCase().includes(text))
    );
  });

  return (
    <div style={{ maxWidth: 900, margin: "2rem auto", padding: "0 1rem" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
        }}
      >
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>Watch Later Queue</h1>

        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: "0.6rem 1rem",
            borderRadius: 8,
            border: "1px solid #ccc",
            width: 220,
            fontSize: 14,
          }}
        />
      </div>

      <p style={{ marginBottom: 20, color: "#555" }}>
        Paste Instagram, TikTok, or YouTube links to save them for later.
      </p>

      {/* Input Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          marginBottom: "2rem",
          padding: "1rem 1.25rem",
          borderRadius: 12,
          border: "1px solid #e0e0e0",
          background: "#fafafa",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        <input
          type="text"
          placeholder="Paste any Instagram, TikTok, or YouTube link..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          style={{
            flex: 1,
            padding: "0.75rem 1rem",
            borderRadius: 8,
            border: "1px solid #ccc",
            fontSize: 15,
            outline: "none",
          }}
        />

        <button
          onClick={handleAdd}
          disabled={loading}
          style={{
            padding: "0.75rem 1.25rem",
            borderRadius: 8,
            background: loading ? "#999" : "#0070f3",
            color: "white",
            border: "none",
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Saving..." : "Save"}
        </button>
      </div>

      {/* Loading / Empty / List */}
      {initialLoading ? (
        <div>Loading links...</div>
      ) : filteredLinks.length === 0 ? (
        <div>No matching links.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {filteredLinks.map((link) => {
            const isNew = link._isNew === true;

            return (
              <div
                key={link.id}
                className={isNew ? "new-card" : ""}
                style={{
                  display: "flex",
                  gap: "1rem",
                  padding: "1rem",
                  borderRadius: 12,
                  border: "1px solid #e5e5e5",
                  backgroundColor: link.watched ? "#f3f3f3" : "#fff",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                }}
              >
                {link.thumbnail_url && (
                  <img
                    src={link.thumbnail_url}
                    alt={link.title || ""}
                    style={{
                      width: 120,
                      height: 120,
                      objectFit: "cover",
                      borderRadius: 10,
                    }}
                  />
                )}

                <div style={{ flex: 1 }}>
                  {/* TITLE + BADGES */}
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 16,
                      marginBottom: 6,
                      lineHeight: 1.3,
                    }}
                  >
                    {link.title || "Untitled"}
					
					{/* SENDER BADGE */}
{link.sender && (
  <span
    style={{
      background: "#e8d9ff",
      color: "#6a0dad",
      padding: "3px 8px",
      borderRadius: 6,
      fontSize: 11,
      marginLeft: 8,
      fontWeight: 600,
    }}
  >
    {link.sender}
  </span>
)}
					
					

                    {/* NEW BADGE */}
                    {isNew && (
                      <span
                        style={{
                          background: "#ff4757",
                          color: "white",
                          padding: "3px 8px",
                          borderRadius: 6,
                          fontSize: 11,
                          marginLeft: 8,
                        }}
                      >
                        New
                      </span>
                    )}
					
					
					

                    {/* AI BADGE */}
                    {link.ai_summary && (
                      <span
                        style={{
                          background: "#6c5ce7",
                          color: "white",
                          padding: "3px 8px",
                          borderRadius: 6,
                          fontSize: 11,
                          marginLeft: 8,
                          fontWeight: 600,
                        }}
                      >
                        AI
                      </span>
                    )}
                  </div>

                  {/* URL */}
                  <div
                    style={{
                      fontSize: 12,
                      color: "#666",
                      marginBottom: 10,
                      wordBreak: "break-all",
                    }}
                  >
                    {link.url}
                  </div>

                  {/* LABEL CHIPS */}
                  {link.labels && link.labels.length > 0 && (
                    <div
                      style={{
                        marginBottom: 10,
                        display: "flex",
                        gap: 6,
                        flexWrap: "wrap",
                      }}
                    >
                      {link.labels.map((label, i) => (
                        <span
                          key={i}
                          style={{
                            background: "#eceaff",
                            color: "#6c5ce7",
                            padding: "3px 8px",
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 500,
                          }}
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* AI SUMMARY BOX */}
                  {link.ai_summary && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: "10px 12px",
                        background: "#f3f0ff",
                        borderLeft: "3px solid #6c5ce7",
                        borderRadius: 6,
                        fontSize: 14,
                        lineHeight: 1.4,
                        color: "#2d2d2d",
                        animation: "fadeIn 0.6s ease-out",
                      }}
                    >
                      <strong style={{ color: "#6c5ce7" }}>
                        AI Summary:
                      </strong>
                      <div style={{ marginTop: 4 }}>{link.ai_summary}</div>
                    </div>
                  )}

                  {/* BUTTONS */}
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <a href={link.url} target="_blank" rel="noreferrer">
                      <button
                        style={{
                          padding: "0.4rem 0.75rem",
                          borderRadius: 6,
                          background: "#eee",
                          border: "1px solid #ccc",
                          cursor: "pointer",
                        }}
                      >
                        Open
                      </button>
                    </a>

                    <button
                      onClick={() => toggleWatched(link.id, link.watched)}
                      style={{
                        padding: "0.4rem 0.75rem",
                        borderRadius: 6,
                        background: link.watched ? "#ffe9c7" : "#d4f8d4",
                        border: "1px solid #ccc",
                        cursor: "pointer",
                      }}
                    >
                      {link.watched ? "Mark Unwatched" : "Mark Watched"}
                    </button>

                    <button
                      onClick={() => deleteLink(link.id)}
                      style={{
                        padding: "0.4rem 0.75rem",
                        borderRadius: 6,
                        background: "#ffd6d6",
                        border: "1px solid #ccc",
                        cursor: "pointer",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}