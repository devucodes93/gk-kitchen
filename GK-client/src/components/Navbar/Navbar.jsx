import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { GiHamburgerMenu } from "react-icons/gi";
import { MdOutlineRestaurantMenu } from "react-icons/md";
import images from "../../constants/images";
import "./Navbar.css";
import Login from "../Login/Login";
import { jwtDecode } from "jwt-decode";

const NAV_LINKS = [
  { label: "Home", href: "#home" },
  { label: "About", href: "#why-us" },
  { label: "Menu", href: "#menu" },
  { label: "Chefs", href: "#chefs" },
  { label: "Contact", href: "#contact" },
];

const Navbar = () => {
  const [toggleMenu, setToggleMenu] = useState(false);
  const [isLight, setIsLight] = useState(false);
  const [navStyle, setNavStyle] = useState("solid");
  const [activeLink, setActiveLink] = useState("#home");
  const [isLoginOpen, setIsLoginOpen] = useState(false); // Integrated from second snippet
  const [user, setUser] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

  const isHomePage = location.pathname === "/";
  const isMenuPage = location.pathname.startsWith("/menu");
  // The scroll handler below only knows how to read light/dark from the
  // homepage's sections (it looks for a `#home` element). On other routes
  // it just keeps whatever navStyle it started with, which defaults to the
  // dark "solid" look. The menu page is a permanently light page, so force
  // the light navbar there instead of relying on that scroll detection.
  const effectiveLight = isMenuPage ? true : isLight;

  const handleNavClick = (link, event) => {
    event.preventDefault();
    setActiveLink(link.href);
    setToggleMenu(false);

    if (isHomePage) {
      const targetId = link.href.replace("#", "");
      const target = document.getElementById(targetId);

      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        window.history.replaceState(null, "", link.href);
      }

      return;
    }

    navigate(`/${link.href}`);
  };

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (token) {
      try {
        const decoded = jwtDecode(token);

        if (decoded.exp && decoded.exp * 1000 < Date.now()) {
          localStorage.removeItem("token");
          return;
        }

        setUser(decoded);
      } catch (err) {
        console.log(err);
      }
    }

    const handleScroll = () => {
      const heroSection = document.getElementById("home");
      if (!heroSection) return;
      const heroBottom = heroSection.getBoundingClientRect().bottom;

      if (heroBottom > 80) {
        setNavStyle("solid");
        setIsLight(false);
      } else {
        const sections = document.querySelectorAll("section, [id]");
        let currentBg = "dark";
        sections.forEach((section) => {
          const rect = section.getBoundingClientRect();
          if (rect.top <= 80 && rect.bottom >= 80) {
            const bg = window.getComputedStyle(section).backgroundColor;
            if (
              bg.includes("255, 255, 255") ||
              bg.includes("245") ||
              bg.includes("249")
            ) {
              currentBg = "light";
            }
          }
        });
        setNavStyle("glass");
        setIsLight(currentBg === "light");
      }

      const ids = NAV_LINKS.map((l) => l.href.replace("#", ""));
      for (let i = ids.length - 1; i >= 0; i--) {
        const el = document.getElementById(ids[i]);
        if (el && el.getBoundingClientRect().top <= 100) {
          setActiveLink(`#${ids[i]}`);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navClass = isMenuPage
    ? "navbar--dark"
    : navStyle === "solid"
      ? "navbar--solid"
      : isLight
        ? "navbar--light"
        : "navbar--dark";

  return (
    <>
      <nav className={`app__navbar ${navClass}`}>
        <div className="app__navbar-logo">
          <img src={images.icon} alt="app__logo" loading="lazy" />
        </div>

        <ul className="app__navbar-links">
          {NAV_LINKS.map((link) => (
            <li
              key={link.href}
              className={activeLink === link.href ? "active" : ""}
            >
              <a
                href={link.href}
                onClick={(event) => handleNavClick(link, event)}
              >
                {link.label}
                <span className="nav-underline" />
              </a>
            </li>
          ))}
        </ul>

        <div className="app__navbar-login">
          {user ? (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <img
                  src={user.picture}
                  alt="profile"
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: "2px solid #DCCA87",
                  }}
                />

                {/* <span
                  style={{
                    color: "white",
                    fontSize: "14px",
                    maxWidth: "180px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {user.email}
                </span> */}
              </div>

              <div className="nav-divider" />

              <button
                onClick={() => {
                  localStorage.removeItem("token");
                  window.location.reload();
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#DCCA87",
                  cursor: "pointer",
                }}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <a
                href="#login"
                className="p__opensans nav-login-link"
                onClick={(e) => {
                  e.preventDefault();
                  setIsLoginOpen(true);
                }}
              >
                Log In
              </a>
            </>
          )}
        </div>

        <div className="app__navbar-smallscreen">
          <GiHamburgerMenu
            color={effectiveLight ? "#000" : "#fff"}
            fontSize={24}
            onClick={() => setToggleMenu(true)}
          />
          {toggleMenu && (
            <div className="app__navbar-smallscreen_overlay flex__center slide-bottom">
              <MdOutlineRestaurantMenu
                fontSize={27}
                className="overlay__close"
                onClick={() => setToggleMenu(false)}
              />
              <div className="overlay__logo">
                <img src={images.icon} alt="logo" />
              </div>
              <ul className="app__navbar-smallscreen_links">
                {NAV_LINKS.map((link) => (
                  <li
                    key={link.href}
                    className={activeLink === link.href ? "active" : ""}
                  >
                    <a
                      href={link.href}
                      onClick={(event) => handleNavClick(link, event)}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>

              <div className="overlay__account">
                {user ? (
                  <div className="overlay__user">
                    <img
                      src={user.picture}
                      alt="profile"
                      className="overlay__avatar"
                    />
                    <button
                      type="button"
                      className="overlay__logout-btn"
                      onClick={() => {
                        localStorage.removeItem("token");
                        window.location.reload();
                      }}
                    >
                      Logout
                    </button>
                  </div>
                ) : (
                  <a
                    href="#login"
                    className="overlay__login-link"
                    onClick={(event) => {
                      event.preventDefault();
                      setToggleMenu(false);
                      setIsLoginOpen(true);
                    }}
                  >
                    Log In
                  </a>
                )}


                 <a href="#login"
                className="p__opensans nav-login-btn"
                onClick={(e) => {
                  e.preventDefault();
                  setIsLoginOpen(true);
                }}
              >
                Log In
              </a>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Integrated Login Modal Wrapper */}
      <Login isLoginOpen={isLoginOpen} setIsLoginOpen={setIsLoginOpen} />
    </>
  );
};

export default Navbar;
