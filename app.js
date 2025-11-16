/* ==========================================================================
   app.js — PixelSync Weather (final)
   - Spline hero iframe loader
   - Weather detection (OpenWeatherMap)
   - Weather -> video mapping (5 videos)
   - Weather dashboard updates
   - Canvas particle background (rain/snow/float)
   - Scroll reveal & navbar active highlighting
   - Smooth scroll with header offset
   ========================================================================== */
   /* ============================
   SITE INTRO / SPLASH CONTROLLER
   - plays intro video if available, else uses CSS fallback
   - shows for approx 4 seconds, then removes
   ============================ */

(function siteIntroController(){
  const intro = document.getElementById('site-intro');
  if (!intro) return;

  const introVideo = document.getElementById('intro-video');
  const showDuration = 4000; // 4 seconds
  let finished = false;
  let startedAt = Date.now();

  // helper to finish intro
  function finishIntro() {
    if (finished) return;
    finished = true;

    // add fade-out class
    intro.classList.add('hidden');

    // ensure removed from DOM after transition to prevent focus traps
    setTimeout(() => {
      try { intro.remove(); } catch (e) {}
      // hide any global preloader if present
      const pre = document.getElementById('site-preloader');
      if (pre && !pre.classList.contains('hidden')) {
        pre.classList.add('hidden');
        setTimeout(()=> pre.remove?.(), 800);
      }
    }, 950);
  }

  // start the reveal animation
  requestAnimationFrame(() => intro.classList.add('playing'));

  // If there's a video element with source, try to play it (muted)
  if (introVideo && introVideo.querySelector('source')?.src) {
    // ensure muted for autoplay
    introVideo.muted = true;
    introVideo.playsInline = true;

    // Attempt to play; if it starts, use its time to decide end (but clamp to 4s)
    introVideo.play().then(() => {
      // If the video is longer, end after 4s anyway
      const remaining = showDuration - (Date.now() - startedAt);
      setTimeout(finishIntro, Math.max(300, remaining));
    }).catch((err) => {
      // autoplay blocked or failed — fallback to timed animation
      console.warn('Intro video autoplay failed:', err);
      setTimeout(finishIntro, showDuration);
    });

    // fallback: if browser can't play or error occurs, ensure finish after duration
    introVideo.addEventListener('error', () => setTimeout(finishIntro, showDuration), { once:true });
  } else {
    // No video -> use CSS-only animation for the duration
    setTimeout(finishIntro, showDuration);
  }

  // Also ensure the intro doesn't block if page scripts error: maximum hard-fallback after 6.5s
  setTimeout(finishIntro, 6500);

  // If user prefers reduced motion, skip long animations: hide after 500ms
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    setTimeout(finishIntro, 200);
  }
})();

   // RANDOM VIDEO STARTUP (before weather loads)

const startupVideos = [
  "assets/videos/cold.mp4",
  "assets/videos/hot.mp4",
  "assets/videos/moderate.mp4",
  "assets/videos/humid.mp4",
  "assets/videos/windy.mp4"
];

window.addEventListener("DOMContentLoaded", () => {
  const randomVid = startupVideos[Math.floor(Math.random() * startupVideos.length)];
  const vs = document.getElementById("video-source");
  const video = document.getElementById("weather-video");

  if (vs && video) {
    vs.src = randomVid;
    video.load();
    video.play().catch(()=>{});
  }
});


/* -----------------------
   CONFIG — YOUR API KEY
   ----------------------- */
const OPENWEATHER_API_KEY = "0aab7a40fc89d4bbdcafb5b4c229bc09";
const OPENWEATHER_BASE = "https://api.openweathermap.org/data/2.5/weather";

/* -----------------------
   DOM REFS
   ----------------------- */
const heroIframe = document.getElementById("hero-spline-iframe");
const heroIframeLoader = document.getElementById("hero-spline-loader");

const videoLoader = document.getElementById("video-loader");
const weatherVideo = document.getElementById("weather-video");

const moodEmojiEl = document.getElementById("moodEmoji");
const moodLabelEl = document.getElementById("moodLabel");
const locationLabelEl = document.getElementById("locationLabel");

const tempNowEl = document.getElementById("tempNow");
const descNowEl = document.getElementById("descNow");
const todaySummaryEl = document.getElementById("todaySummary");
const forecastSummaryEl = document.getElementById("forecastSummary");

const bgCanvas = document.getElementById("bg-canvas");

/* -----------------------
   Environment helpers
   ----------------------- */
const IS_MOBILE = /Mobi|Android/i.test(navigator.userAgent);

/* -----------------------
   WEATHER VIDEO MAP
   Files expected in assets/videos/
     - cold.mp4      (winter/snow)
     - hot.mp4       (hot/clear)
     - moderate.mp4  (pleasant/clear/moderate)
     - humid.mp4     (rain/humid/drizzle/mist)
     - windy.mp4     (wind / thunder)
   ----------------------- */
const WEATHER_VIDEO_MAP = {
  snow: "assets/videos/cold.mp4",
  thunder: "assets/videos/windy.mp4",
  rain: "assets/videos/humid.mp4",
  drizzle: "assets/videos/humid.mp4",
  mist: "assets/videos/humid.mp4",
  haze: "assets/videos/humid.mp4",
  fog: "assets/videos/humid.mp4",
  cloud: "assets/videos/moderate.mp4",
  clear_hot: "assets/videos/hot.mp4",
  clear_cold: "assets/videos/cold.mp4",
  clear: "assets/videos/moderate.mp4",
  default: "assets/videos/moderate.mp4",
  windy: "assets/videos/windy.mp4"
};

/* -----------------------
   CHOOSE VIDEO BASED ON WEATHER
   ----------------------- */
function chooseWeatherVideo(main, tempC) {
  if (!main) return WEATHER_VIDEO_MAP.default;
  const m = main.toLowerCase();

  if (m.includes("snow")) return WEATHER_VIDEO_MAP.snow;
  if (m.includes("thunder") || m.includes("storm")) return WEATHER_VIDEO_MAP.thunder;
  if (m.includes("drizzle") || m.includes("rain")) return WEATHER_VIDEO_MAP.rain;
  if (m.includes("mist") || m.includes("haze") || m.includes("fog")) return WEATHER_VIDEO_MAP.mist;
  if (m.includes("wind") || m.includes("squall")) return WEATHER_VIDEO_MAP.windy;
  if (m.includes("cloud")) return WEATHER_VIDEO_MAP.cloud;

  if (m.includes("clear")) {
    if (typeof tempC === "number") {
      if (tempC >= 30) return WEATHER_VIDEO_MAP.clear_hot;
      if (tempC <= 5) return WEATHER_VIDEO_MAP.clear_cold;
    }
    return WEATHER_VIDEO_MAP.clear;
  }

  return WEATHER_VIDEO_MAP.default;
}

/* -----------------------
   SET VIDEO SRC & PLAY (muted for autoplay)
   - shows loader while setting up
   ----------------------- */
async function setWeatherVideo(src) {
  if (!weatherVideo) return;
  videoLoader && videoLoader.classList.remove("hidden");
  // Replace source element if present
  const sourceEl = weatherVideo.querySelector("source");
  if (sourceEl) {
    sourceEl.src = src;
    weatherVideo.load();
  } else {
    weatherVideo.setAttribute("src", src);
  }

  weatherVideo.muted = true;
  weatherVideo.playsInline = true;

  try {
    await weatherVideo.play();
    videoLoader && videoLoader.classList.add("hidden");
  } catch (err) {
    // autoplay blocked — show loader message and attach user tap to play
    console.warn("Autoplay blocked or failed:", err);
    const lt = videoLoader && videoLoader.querySelector(".loader-text");
    if (lt) lt.textContent = "Tap to play scene";
    videoLoader && videoLoader.classList.remove("hidden");
    videoLoader && (videoLoader.onclick = async () => {
      try {
        await weatherVideo.play();
        videoLoader.classList.add("hidden");
        videoLoader.onclick = null;
      } catch (e) { console.warn("Play still blocked:", e); }
    });
  }
}

/* -----------------------
   OPENWEATHER HELPERS
   ----------------------- */
async function fetchWeatherByCoords(lat, lon) {
  const url = `${OPENWEATHER_BASE}?lat=${lat}&lon=${lon}&units=metric&appid=${OPENWEATHER_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Weather API error: " + res.status);
  return await res.json();
}

async function fetchWeatherByCity(q) {
  const url = `${OPENWEATHER_BASE}?q=${encodeURIComponent(q)}&units=metric&appid=${OPENWEATHER_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Weather API error: " + res.status);
  return await res.json();
}

/* -----------------------
   APPLY WEATHER DATA -> UI + VIDEO
   ----------------------- */
async function applyWeatherAndScene(data) {
  if (!data) return;

  const main = data.weather?.[0]?.main || "";
  const desc = data.weather?.[0]?.description || "";
  const tempC = data.main?.temp;

  // Update dashboard UI (guard elements may be missing)
  if (locationLabelEl) locationLabelEl.textContent = `${data.name}${data.sys?.country ? ", " + data.sys.country : ""}`;
  if (tempNowEl) tempNowEl.textContent = Math.round(tempC) + "°C";
  if (descNowEl) descNowEl.textContent = desc;
  if (todaySummaryEl) todaySummaryEl.textContent = `Feels ${Math.round(data.main.feels_like)}° • Humidity ${data.main.humidity}%`;
  if (forecastSummaryEl) forecastSummaryEl.textContent = `Wind ${Math.round(data.wind.speed)} m/s`;

  // Set mood emoji/label
  let emoji = "☀️", label = "Sunny";
  const m = (main || "").toLowerCase();
  if (/rain|drizzle|shower/.test(m)) { emoji = "🌧️"; label = "Rainy"; }
  else if (/snow/.test(m)) { emoji = "❄️"; label = "Snowy"; }
  else if (/cloud/.test(m)) { emoji = "☁️"; label = "Cloudy"; }
  else if (/thunder|storm/.test(m)) { emoji = "⛈️"; label = "Stormy"; }
  else if (/mist|haze|fog/.test(m)) { emoji = "🌫️"; label = "Misty"; }

  if (moodEmojiEl) moodEmojiEl.textContent = emoji;
  if (moodLabelEl) moodLabelEl.textContent = label;

  // Determine and play the correct video
  const videoSrc = chooseWeatherVideo(main, tempC);
  try {
    await setWeatherVideo(videoSrc);
  } catch (e) {
    console.warn("Failed to set weather video:", e);
  }
}

/* -----------------------
   GEOLOCATION FLOW
   ----------------------- */
function detectAndLoadWeather() {
  if (!navigator.geolocation) {
    if (locationLabelEl) locationLabelEl.textContent = "Geolocation not supported";
    // fallback video
    setWeatherVideo(WEATHER_VIDEO_MAP.default).catch(()=>{});
    return;
  }

  if (locationLabelEl) locationLabelEl.textContent = "Detecting location…";

  navigator.geolocation.getCurrentPosition(async (pos) => {
    try {
      const data = await fetchWeatherByCoords(pos.coords.latitude, pos.coords.longitude);
      await applyWeatherAndScene(data);
    } catch (err) {
      console.error("Weather fetch failed:", err);
      if (locationLabelEl) locationLabelEl.textContent = "Weather fetch error";
      setWeatherVideo(WEATHER_VIDEO_MAP.default).catch(()=>{});
    }
  }, async (err) => {
    console.warn("Geolocation error:", err);
    if (locationLabelEl) locationLabelEl.textContent = "Location denied — enter city";
    // fallback to default moderate scene
    setWeatherVideo(WEATHER_VIDEO_MAP.default).catch(()=>{});
  }, { timeout: 9000 });
}

/* -----------------------
   HERO IFRAME LOADER HANDLING
   ----------------------- */
if (heroIframe) {
  // If iframe loads successfully, hide loader
  heroIframe.addEventListener("load", () => {
    heroIframeLoader && heroIframeLoader.classList.add("hidden");
  });
  // Fallback hide: after 10s hide loader if not loaded
  setTimeout(() => heroIframeLoader && heroIframeLoader.classList.add("hidden"), 10000);
}

/* -----------------------
   PARTICLE SYSTEM (canvas background)
   - supports types: float, rain, snow, spark (kept simple & efficient)
   ----------------------- */
const particleSystem = (function () {
  if (!bgCanvas) return { setConfig: () => {} };

  const ctx = bgCanvas.getContext("2d", { alpha: true });
  let W = bgCanvas.width = innerWidth;
  let H = bgCanvas.height = innerHeight;

  let config = { count: 80, speed: 0.6, type: "float" };
  let parts = [];
  let raf = null;

  function resize() {
    W = bgCanvas.width = innerWidth;
    H = bgCanvas.height = innerHeight;
  }
  window.addEventListener("resize", resize);

  function newParticle() {
    const p = {
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 2 + 0.6,
      opacity: Math.random() * 0.6 + 0.06,
      type: config.type
    };
    p.vx = (Math.random() - 0.5) * 0.6 * config.speed;
    p.vy = (Math.random() * 0.6 + 0.1) * config.speed;

    if (p.type === "rain") { p.vx = Math.random() * -0.6; p.vy = Math.random() * 6 + 6; p.r = Math.random() * 1.2 + 0.2; }
    if (p.type === "snow") { p.vx = Math.random() * 0.6 - 0.3; p.vy = Math.random() * 0.6 + 0.4; p.r = Math.random() * 2 + 0.8; }
    if (p.type === "spark") { p.vx = (Math.random() - 0.5) * 0.8; p.vy = (Math.random() - 0.5) * 0.8; p.r = Math.random() * 2.6 + 0.2; }
    return p;
  }

  function seed(n) {
    parts = [];
    for (let i = 0; i < n; i++) parts.push(newParticle());
  }

  function setConfig(c) {
    config = { ...config, ...c };
    if (IS_MOBILE) config.count = Math.round(config.count * 0.6);
    // respect reduced-motion
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      config.count = Math.min(config.count, 30);
      config.speed *= 0.4;
    }
    seed(config.count || 60);
  }

  function step() {
    ctx.clearRect(0, 0, W, H);
    const pcolor = getComputedStyle(document.documentElement).getPropertyValue("--particle-color") || "rgba(255,255,255,0.06)";
    for (const p of parts) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.y > H + 40 || p.x < -80 || p.x > W + 80) {
        Object.assign(p, newParticle());
        p.x = Math.random() * W;
        p.y = -20;
      }
      ctx.globalAlpha = p.opacity;
      if (p.type === "rain") {
        ctx.strokeStyle = pcolor;
        ctx.lineWidth = Math.max(1, p.r * 1.2);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 1.5, p.y - p.vy * 0.9);
        ctx.stroke();
      } else {
        ctx.fillStyle = pcolor;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    raf = requestAnimationFrame(step);
  }

  // init default
  setConfig({ count: 80, speed: 0.6, type: "float" });
  step();

  return { setConfig };
})();

/* -----------------------
   SCROLL REVEAL (IntersectionObserver)
   ----------------------- */
(function setupScrollReveal() {
  const els = document.querySelectorAll(".fade-up");
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) e.target.classList.add("visible");
    });
  }, { threshold: 0.12 });
  els.forEach(el => obs.observe(el));
})();

/* -----------------------
   NAV SMOOTH SCROLL + ACTIVE SECTION HIGHLIGHT
   ----------------------- */
(function setupNav() {
  const header = document.querySelector(".navbar");
  const links = document.querySelectorAll("nav a");

  // smooth scroll with header offset
  links.forEach(a => {
    a.addEventListener("click", (ev) => {
      const href = a.getAttribute("href");
      if (!href || !href.startsWith("#")) return;
      ev.preventDefault();
      const target = document.querySelector(href);
      if (!target) return;
      const headerH = header ? header.offsetHeight : 72;
      const top = target.getBoundingClientRect().top + window.scrollY - headerH - 12;
      window.scrollTo({ top, behavior: "smooth" });
    });
  });

  // highlight current section
  const sections = Array.from(document.querySelectorAll("section[id]"));
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        links.forEach(l => l.classList.remove("active"));
        const match = document.querySelector(`nav a[href="#${id}"]`);
        if (match) match.classList.add("active");
      }
    });
  }, { threshold: 0.45 });
  sections.forEach(s => obs.observe(s));
})();

/* -----------------------
   THEME SYNC HOOK (optional)
   - call window.updateSplineTheme(themeVars) to style iframe wrapper
   - this page posts messages to iframe only; Spline must listen if possible
   ----------------------- */
window.updateSplineTheme = window.updateSplineTheme || function (vars) {
  // example: add a glow to iframe based on theme var --glow
  try {
    const iframe = document.querySelector(".spline-frame");
    if (iframe) {
      const glow = vars["--glow"] || "rgba(255,255,255,0.08)";
      iframe.style.filter = `drop-shadow(0 40px 120px ${glow})`;
      // post message for iframe content if it listens
      iframe.contentWindow && iframe.contentWindow.postMessage({ type: "pixelsync-theme", theme: vars }, "*");
    }
  } catch (e) {
    console.warn("updateSplineTheme error:", e);
  }
};

/* -----------------------
   STARTUP: detect weather + init UI
   ----------------------- */
(function init() {
  // style transitions for fade-up elements
  document.querySelectorAll(".fade-up").forEach(el => {
    el.style.transition = "opacity 0.9s cubic-bezier(.2,.9,.3,1), transform 0.9s cubic-bezier(.2,.9,.3,1)";
  });

  // Hero iframe loader fallback: hide loader after 10s if still visible
  setTimeout(() => heroIframeLoader && heroIframeLoader.classList.add("hidden"), 10000);

  // Start weather detection and video scene
  detectAndLoadWeather();

  // If no API key, fallback gracefully
  if (!OPENWEATHER_API_KEY || OPENWEATHER_API_KEY.indexOf("YOUR_") === 0) {
    console.warn("OpenWeather API key missing — using default scene");
    setWeatherVideo(WEATHER_VIDEO_MAP.default).catch(()=>{});
  }
})();
/* ======================================================
   CUSTOM FOLLOW CURSOR + HOVER SWITCH
   ====================================================== */
(function(){
  const cursor = document.querySelector(".custom-cursor");
  const img = cursor.querySelector(".cursor-img");

  let x = 0, y = 0;
  let mx = 0, my = 0;
  const ease = 0.18;

  // follow loop
  function animate() {
    mx += (x - mx) * ease;
    my += (y - my) * ease;
    cursor.style.left = mx + "px";
    cursor.style.top = my + "px";
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);

  // track mouse position
  document.addEventListener("mousemove", (e) => {
    x = e.clientX;
    y = e.clientY;

    // detect clickable elements
    const target = document.elementFromPoint(e.clientX, e.clientY);
    const clickable = target?.closest("a, button, .footer-btn, .nav-links a, input, textarea, .clickable");

    if (clickable) {
      cursor.classList.add("hover");
    } else {
      cursor.classList.remove("hover");
    }
  });

  // accessibility: hide custom cursor on Tab
  window.addEventListener("keydown", (e) => {
    if (e.key === "Tab") cursor.style.opacity = "0";
  });
  window.addEventListener("mousedown", () => {
    cursor.style.opacity = "1";
  });
})();
