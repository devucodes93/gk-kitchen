// seed.js
// Seeds the `menu` table in Supabase with Gautam Kitchen (Nati Style) menu items.
// Run with:  node seed.js
//
// Requires: npm install pg dotenv

require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: false }, // required for Supabase pooler
});

// Small helper to build a stable-but-"random" placeholder image per item.
// Swap these out later with real product photos.
const placeholderImage = (name) => {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `https://picsum.photos/seed/${slug}/500/400`;
};

// menu_type: broad grouping (Food / Beverage)
// category: the specific section from the menu card
const items = [
  // ---------------- FOOD ----------------
  { menu_type: "Food", category: "Biryani", menu_name: "Chicken Biryani (Incl. 4pc - 500gm)", price: 159 },
  { menu_type: "Food", category: "Biryani", menu_name: "Mutton Biryani (Incl. 4pc - 500gm)", price: 299 },
  { menu_type: "Food", category: "Biryani", menu_name: "Biryani Rice (500gm)", price: 99 },

  { menu_type: "Food", category: "Chicken Starters", menu_name: "Chicken Kabab (8pc)", price: 119 },
  { menu_type: "Food", category: "Chicken Starters", menu_name: "Chicken Pepper Dry (8pc)", price: 129 },
  { menu_type: "Food", category: "Chicken Starters", menu_name: "Chilli Chicken (8pc)", price: 149 },
  { menu_type: "Food", category: "Chicken Starters", menu_name: "Chicken Chops (8pc)", price: 149 },

  { menu_type: "Food", category: "Chicken Gravy/Semi Gravy", menu_name: "Chicken Saru (8pc)", price: 149 },

  { menu_type: "Food", category: "Mutton Starters", menu_name: "Mutton Pepper Dry (4pc)", price: 269 },
  { menu_type: "Food", category: "Mutton Starters", menu_name: "Boti Gojju (Sunday Only)", price: 159 },
  { menu_type: "Food", category: "Mutton Starters", menu_name: "Mutton Chops (2pc)", price: 199 },

  { menu_type: "Food", category: "Mutton Gravy/Semi Gravy", menu_name: "Mutton Saru (4pc)", price: 289 },
  { menu_type: "Food", category: "Mutton Gravy/Semi Gravy", menu_name: "Paya Soup Plain (Sunday Only)", price: 49 },
  { menu_type: "Food", category: "Mutton Gravy/Semi Gravy", menu_name: "Paya Soup (Sunday Only)", price: 149 },

  { menu_type: "Food", category: "Rice & Mudde", menu_name: "Mudde (1pc)", price: 25 },
  { menu_type: "Food", category: "Rice & Mudde", menu_name: "White Rice (Full)", price: 49 },
  { menu_type: "Food", category: "Rice & Mudde", menu_name: "White Rice (Half)", price: 39 },

  // ---------------- BEVERAGES ----------------
  { menu_type: "Beverage", category: "Tea", menu_name: "Adrak Chai", price: 20 },
  { menu_type: "Beverage", category: "Tea", menu_name: "Rose Chai", price: 25 },
  { menu_type: "Beverage", category: "Tea", menu_name: "Chocolate Chai", price: 25 },
  { menu_type: "Beverage", category: "Tea", menu_name: "Elaichi Chai", price: 25 },
  { menu_type: "Beverage", category: "Tea", menu_name: "Pan Chai", price: 25 },
  { menu_type: "Beverage", category: "Tea", menu_name: "Masala Chai", price: 30 },
  { menu_type: "Beverage", category: "Tea", menu_name: "Lemon Chai", price: 25 },

  { menu_type: "Beverage", category: "Hot Coffee", menu_name: "Hot Coffee", price: 25 },
  { menu_type: "Beverage", category: "Hot Coffee", menu_name: "Chocolate Hot Coffee", price: 30 },
  { menu_type: "Beverage", category: "Hot Coffee", menu_name: "Black Coffee", price: 30 },

  { menu_type: "Beverage", category: "Cold Coffee", menu_name: "Cold Coffee", price: 79 },
  { menu_type: "Beverage", category: "Cold Coffee", menu_name: "Strong Cold Coffee", price: 89 },
  { menu_type: "Beverage", category: "Cold Coffee", menu_name: "Chocolate Cold Coffee", price: 99 },
  { menu_type: "Beverage", category: "Cold Coffee", menu_name: "Brownie Cold Coffee", price: 149 },

  { menu_type: "Beverage", category: "Mojito", menu_name: "Lime Juice", price: 49 },
  { menu_type: "Beverage", category: "Mojito", menu_name: "Lime Soda", price: 59 },
  { menu_type: "Beverage", category: "Mojito", menu_name: "Classic Mojito", price: 79 },
  { menu_type: "Beverage", category: "Mojito", menu_name: "Chat Pata Mojito", price: 89 },

  { menu_type: "Beverage", category: "Ice Tea", menu_name: "Classic Ice Tea", price: 79 },
  { menu_type: "Beverage", category: "Ice Tea", menu_name: "Lemon Ice Tea", price: 89 },

  { menu_type: "Beverage", category: "Shake", menu_name: "Strawberry Shake", price: 79 },
  { menu_type: "Beverage", category: "Shake", menu_name: "Oreo Shake", price: 99 },
  { menu_type: "Beverage", category: "Shake", menu_name: "Kit Kat Shake", price: 109 },
  { menu_type: "Beverage", category: "Shake", menu_name: "Brownie Shake", price: 149 },

  { menu_type: "Beverage", category: "Cold Pressed Fusion Juices", menu_name: "ABC (Apple, Beetroot & Carrot)", price: 159 },
  { menu_type: "Beverage", category: "Cold Pressed Fusion Juices", menu_name: "Show Time (Kiwi, Pineapple & Orange)", price: 199 },
  { menu_type: "Beverage", category: "Cold Pressed Fusion Juices", menu_name: "Melony C (Watermelon, Orange & Pineapple)", price: 139 },
  { menu_type: "Beverage", category: "Cold Pressed Fusion Juices", menu_name: "Crunchy Melon (Apple & Watermelon)", price: 139 },
  { menu_type: "Beverage", category: "Cold Pressed Fusion Juices", menu_name: "Sweet Beet (Beetroot, Apple & Muskmelon)", price: 139 },
  { menu_type: "Beverage", category: "Cold Pressed Fusion Juices", menu_name: "Kiwi Green (Kiwi, Cucumber & Apple)", price: 189 },
  { menu_type: "Beverage", category: "Cold Pressed Fusion Juices", menu_name: "Kick Start (Kiwi, Orange & Apple)", price: 199 },

  { menu_type: "Beverage", category: "Cold Pressed Mono Juices", menu_name: "Watermelon Juice", price: 79 },
  { menu_type: "Beverage", category: "Cold Pressed Mono Juices", menu_name: "Indian Kamala Juice", price: 89 },
  { menu_type: "Beverage", category: "Cold Pressed Mono Juices", menu_name: "Muskmelon Juice", price: 89 },
  { menu_type: "Beverage", category: "Cold Pressed Mono Juices", menu_name: "Pineapple Juice", price: 89 },
];

const ensureMenuTable = async () => {
  // Matches the schema your AddMenu controller expects.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS menu (
      menu_id SERIAL PRIMARY KEY,
      menu_type TEXT,
      menu_name TEXT NOT NULL,
      price NUMERIC NOT NULL,
      category TEXT,
      image_url TEXT,
      description TEXT,
      is_available BOOLEAN DEFAULT TRUE,
      original_price NUMERIC,
      discounted_price NUMERIC,
      is_discounted BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

const seed = async () => {
  const client = await pool.connect();
  try {
    await ensureMenuTable();

    console.log(`Seeding ${items.length} menu items...`);

    for (const item of items) {
      const image_url = placeholderImage(item.menu_name);
      await client.query(
        `INSERT INTO menu
          (menu_type, menu_name, price, category, image_url, description, is_available, original_price, discounted_price, is_discounted)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          item.menu_type,
          item.menu_name,
          item.price,
          item.category,
          image_url,
          item.description || null,
          true, // is_available
          item.price, // original_price
          null, // discounted_price
          false, // is_discounted
        ],
      );
      console.log(`  ✓ ${item.menu_name} (${item.category}) - ₹${item.price}`);
    }

    console.log("Done! Seeded all items.");
  } catch (err) {
    console.error("Seeding failed:", err);
  } finally {
    client.release();
    await pool.end();
  }
};

seed();