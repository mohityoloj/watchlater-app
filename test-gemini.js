import "dotenv/config";
import fetch from "node-fetch";

const API_KEY = process.env.GEMINI_API_KEY;

async function test() {
  console.log("Loaded key:", API_KEY);

  const url =
    "https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=" +
    API_KEY;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: "Say hello from Gemini 2.0 Flash" }],
        },
      ],
    }),
  });

  const data = await response.json();
  console.log("Response:", data);
}

test();