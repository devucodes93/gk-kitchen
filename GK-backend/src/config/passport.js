const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const pool = require("./db");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:
        "http://localhost:5000/api/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        const name = profile.displayName;
        const picture = profile.photos[0].value;

        let result = await pool.query(
          "SELECT * FROM users WHERE email = $1",
          [email]
        );

        if (result.rows.length === 0) {
          result = await pool.query(
            `INSERT INTO users
            (name,email,google_id,picture)
            VALUES ($1,$2,$3,$4)
            RETURNING *`,
            [name, email, profile.id, picture]
          );
        } else {
          result = await pool.query(
            `UPDATE users
             SET picture=$1
             WHERE email=$2
             RETURNING *`,
            [picture, email]
          );
        }

        return done(null, result.rows[0]);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

module.exports = passport;