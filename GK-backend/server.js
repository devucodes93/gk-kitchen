const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { ApifyClient } = require("apify-client");
const dotenv = require("dotenv");
dotenv.config();
const session = require("express-session");
const listEndpoints = require("express-list-endpoints");

const pool = require("./src/config/db.js");
const userRoutes = require("./src/routes/authRoutes.js");
const passport = require("./src/config/passport");
const SignupRoute = require("./src/routes/signupRoutes");

const app = express();

app.use(cors());
app.use(express.json());

// ─── PostgreSQL ───────────────────────────────────────────────────────────────
(async () => {
  try {
    await pool.query("SELECT 1");
    console.log("✅ PostgreSQL Database Connected");
  } catch (err) {
    console.error("❌ PostgreSQL Database Connection Failed:", err.message);
  }
})();

// ─── Session + Passport ───────────────────────────────────────────────────────
app.use(
  session({
    secret: process.env.SESSION_SECRET || "restaurant",
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/auth", SignupRoute);   // POST /api/auth/register, POST /api/auth/login
app.use("/api/auth", userRoutes);       // GET  /api/auth/google, GET /api/auth/google/callback

// List endpoints AFTER routes are registered
console.log("Registered endpoints:", listEndpoints(app));

// ─── Apify / Instagram ────────────────────────────────────────────────────────
const client = new ApifyClient({ token: process.env.APIFY_API_TOKEN });
let cachedPosts = [];
let lastFetched = 0;
const CACHE_TTL = 1000 * 60 * 30;

async function fetchFromApify() {
  const now = Date.now();
  if (cachedPosts.length && now - lastFetched < CACHE_TTL) return cachedPosts;

  const run = await client.actor("apify/instagram-profile-scraper").call({
    usernames: ["gautamkitchen"],
    resultsLimit: 5,
  });

  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  console.log("Raw Apify item keys:", Object.keys(items[0] ?? {}));
  console.log("Sample post keys:", Object.keys(items[0]?.latestPosts?.[0] ?? {}));

  cachedPosts = (items[0]?.latestPosts ?? []).map((post, i) => ({
    id: post.id ?? `post_${i}`,
    url: post.displayUrl || post.imageUrl || post.media_url || post.thumbnailUrl || "",
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

// Image proxy — avoids CORS + expired URL issues
app.get("/api/proxy-image", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send("Missing url param");

  try {
    const response = await axios.get(decodeURIComponent(url), {
      responseType: "stream",
      headers: { "User-Agent": "Mozilla/5.0", Referer: "https://www.instagram.com/" },
    });
    res.setHeader("Content-Type", response.headers["content-type"]);
    response.data.pipe(res);
  } catch (err) {
    console.error("Proxy error:", err.message);
    res.status(500).send("Image fetch failed");
  }
});

app.listen(5000, () => console.log("🚀 Server running on port 5000"));