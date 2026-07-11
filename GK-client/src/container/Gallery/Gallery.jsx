import React, { useState, useEffect, useRef } from "react";
import {
  BsInstagram,
  BsArrowLeftShort,
  BsArrowRightShort,
} from "react-icons/bs";
import { SubHeading } from "../../components";
import "./Gallery.css";

const SkeletonCard = () => (
  <div
    className="app__gallery-images_card flex__center"
    style={{
      background:
        "linear-gradient(90deg, #1a1a1a 25%, #2a2a2a 50%, #1a1a1a 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.5s infinite",
      minWidth: "301px",
      height: "447px",
      borderRadius: "4px",
    }}
  />
);

const Gallery = () => {
  const scrollRef = useRef(null);

  const [instaPhotos, setInstaPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  const fetchInstagramFeed = () => {
    fetch("https://gk-kitchen.onrender.com/api/instagram-feed")
      .then((res) => res.json())
      .then((data) => {
        const posts = Array.isArray(data.posts)
          ? data.posts.filter((p) => p && typeof p === "object" && p.url)
          : [];

        setInstaPhotos(posts);
        setLoading(false);
        setConnecting(false);
      })
      .catch((err) => {
        console.error("Connection failed:", err);

        setLoading(false);
        setConnecting(true);

        // Retry every 5 seconds
        setTimeout(fetchInstagramFeed, 5000);
      });
  };

  useEffect(() => {
    fetchInstagramFeed();
  }, []);

  const scroll = (direction) => {
    const { current } = scrollRef;

    if (direction === "left") {
      current.scrollLeft -= 300;
    } else {
      current.scrollLeft += 300;
    }
  };

  return (
    <div className="app__gallery flex__center">
      <div className="app__gallery-content">
        <SubHeading title="Instagram" />

        <h1 className="headtext__cormorant">Photo Gallery</h1>

        <p
          className="p__opensans"
          style={{
            color: "#AAAAAA",
            marginTop: "2rem",
          }}
        >
          Follow our latest culinary journey updated straight from our live
          feed.
        </p>

        <button
          type="button"
          className="custom__button"
          onClick={() =>
            window.open("https://www.instagram.com/gautamkitchen/", "_blank")
          }
        >
          View More
        </button>
      </div>

      <div className="app__gallery-images">
        <div className="app__gallery-images_container" ref={scrollRef}>
          {/* Loading Skeleton */}
          {loading && [1, 2, 3, 4, 5].map((i) => <SkeletonCard key={i} />)}

          {/* Connecting UI */}
          {!loading && connecting && (
            <div className="gallery__waiting-ui">
              <div className="gallery__loader"></div>

              <BsInstagram className="gallery__waiting-icon" />

              <h3>Connecting to Instagram...</h3>

              <p>
                Fetching our latest photos.
                <br />
                Please wait a few seconds.
              </p>

              <div className="gallery__dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}

          {/* Instagram Posts */}
          {!loading &&
            !connecting &&
            instaPhotos.map((post, index) => (
              <div
                className="app__gallery-images_card flex__center"
                key={post.id ?? `gallery-${index}`}
              >
                <a
                  href={post.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    position: "relative",
                    display: "flex",
                  }}
                >
                  <img
                    src={`https://gk-kitchen.onrender.com/api/proxy-image?url=${encodeURIComponent(
                      post.url,
                    )}`}
                    alt={post.caption || "Instagram Post"}
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />

                  <BsInstagram className="gallery__image-icon" />
                </a>
              </div>
            ))}
        </div>

        <div className="app__gallery-images_arrows">
          <BsArrowLeftShort
            className="gallery__arrow-icon"
            onClick={() => scroll("left")}
          />

          <BsArrowRightShort
            className="gallery__arrow-icon"
            onClick={() => scroll("right")}
          />
        </div>
      </div>
    </div>
  );
};

export default Gallery;
