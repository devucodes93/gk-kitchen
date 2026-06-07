import React, { useEffect, useRef, useState } from "react";

const LazyImage = ({ src, alt, className, style, placeholder, ...props }) => {
  const imgRef = useRef();
  const [inView, setInView] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if ("loading" in HTMLImageElement.prototype) {
      // browser supports native lazy loading
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: "200px" },
    );

    if (imgRef.current) observer.observe(imgRef.current);

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={imgRef} style={{ display: "inline-block", ...style }}>
      {!loaded && placeholder}
      {inView && (
        <img
          src={src}
          alt={alt}
          className={className}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          style={loaded ? {} : { display: "none" }}
          {...props}
        />
      )}
    </div>
  );
};

export default LazyImage;
