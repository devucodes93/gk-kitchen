const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { ApifyClient } = require("apify-client");
const dotenv = require("dotenv");
dotenv.config();
const app = express();
app.use(cors());

const client = new ApifyClient({ token: process.env.APIFY_API_TOKEN });

// Cache so you don't re-run the actor on every page load
let cachedPosts = [];
let lastFetched = 0;
const CACHE_TTL = 1000 * 60 * 30; // 30 minutes

async function fetchFromApify() {
  const now = Date.now();
  if (cachedPosts.length && now - lastFetched < CACHE_TTL) return cachedPosts;

  const run = await client.actor("apify/instagram-profile-scraper").call({
    usernames: ["gautamkitchen"],
    resultsLimit: 5,
  });

  const { items } = await client.dataset(run.defaultDatasetId).listItems();

  // Log the raw item so you can see exact field names
  console.log("Raw Apify item keys:", Object.keys(items[0] ?? {}));
  console.log(
    "Sample post keys:",
    Object.keys(items[0]?.latestPosts?.[0] ?? {}),
  );

  cachedPosts = (items[0]?.latestPosts ?? []).map((post, i) => ({
    id: post.id ?? `post_${i}`,
    // Try all possible field names Apify might return
    url:
      post.displayUrl ||
      post.imageUrl ||
      post.media_url ||
      post.thumbnailUrl ||
      "",
    caption: post.caption ?? "",
    likes: post.likesCount ?? 0,
    permalink: post.url ?? "",
  }));

  lastFetched = now;
  return cachedPosts;
}

app.get("/api/instagram-feed", async (req, res) => {
  try {
    const posts = await fetchFromApify();
    res.json({ posts });
  } catch (err) {
    console.error("Apify error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Image proxy route — avoids CORS + expired URL issues
app.get("/api/proxy-image", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send("Missing url param");

  try {
    const response = await axios.get(decodeURIComponent(url), {
      responseType: "stream",
      headers: {
        "User-Agent": "Mozilla/5.0",
        Referer: "https://www.instagram.com/",
      },
    });
    res.setHeader("Content-Type", response.headers["content-type"]);
    response.data.pipe(res);
  } catch (err) {
    console.error("Proxy error:", err.message);
    res.status(500).send("Image fetch failed");
  }
});

app.listen(5000, () => console.log("Server running on port 5000"));
