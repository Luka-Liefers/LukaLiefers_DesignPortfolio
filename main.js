/* ---------------------------------------------------------
   Subtle UI sound — a soft wind swoosh generated with the Web
   Audio API (no audio file needed): brown noise with a sweeping
   band-pass. Played when navigating to another page.
   --------------------------------------------------------- */
let _audioCtx = null;
function playTransitionSound() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!_audioCtx) _audioCtx = new AC();
    if (_audioCtx.state === "suspended") _audioCtx.resume();

    const ctx = _audioCtx;
    const t = ctx.currentTime;
    const dur = 0.6;

    // Brown noise (softer, deeper than white noise → reads as rushing air).
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;

    // Resonant band-pass with a gentle sweep → a soft wind gust.
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 2.4;
    filter.frequency.setValueAtTime(320, t);
    filter.frequency.exponentialRampToValueAtTime(760, t + dur * 0.5);
    filter.frequency.exponentialRampToValueAtTime(380, t + dur);

    // Tame any remaining high hiss.
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1200;

    // Slow swell in, gentle fade out.
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.07, t + 0.16);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    src.connect(filter).connect(lp).connect(gain).connect(ctx.destination);
    src.start(t);
    src.stop(t + dur);
  } catch (e) {
    /* Audio unavailable — ignore. */
  }
}

/* ---------------------------------------------------------
   Page-transition sound — play the wind swoosh when the user
   clicks an internal link to another page, briefly delaying
   the navigation so the sound is heard before the page unloads.
   --------------------------------------------------------- */
(function () {
  function isInternalPageLink(a) {
    const href = a.getAttribute("href");
    if (!href) return false;
    if (a.target && a.target !== "_self") return false;
    if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return false;
    if (/^https?:\/\//i.test(href)) return false; // external
    return /\.html(\?|#|$)/.test(href); // internal page, e.g. work.html?project=...
  }

  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // let new-tab etc. through
    const a = e.target.closest("a[href]");
    if (!a || !isInternalPageLink(a)) return;

    e.preventDefault();
    playTransitionSound();
    const href = a.getAttribute("href");
    setTimeout(() => {
      window.location.href = href;
    }, 320);
  });
})();

/* ---------------------------------------------------------
   RESUME block letters (homepage) — each letter nudges to a
   small random offset on hover and eases back on leave,
   matching the behaviour on lukaliefers.nl.
   --------------------------------------------------------- */
(function () {
  const letters = document.querySelectorAll(".resume-card .letter");
  letters.forEach((letter) => {
    letter.addEventListener("mouseenter", (e) => {
      const x = (Math.random() - 0.5) * 20;
      const y = (Math.random() - 0.5) * 20;
      e.currentTarget.style.transform = `translate(${x}px, ${y}px)`;
    });
    letter.addEventListener("mouseleave", (e) => {
      e.currentTarget.style.transform = "translate(0, 0)";
    });
  });
})();

/* ---------------------------------------------------------
   Resume accordion — click an item bar to expand its details.
   --------------------------------------------------------- */
(function () {
  const bars = document.querySelectorAll(".item-bar");
  bars.forEach((bar) => {
    const wrapper = bar.querySelector(".item-details-wrapper");
    if (!wrapper) return;

    bar.addEventListener("click", () => {
      const isOpen = bar.classList.contains("expanded");

      const list = bar.closest(".item-list");
      if (list) {
        list.querySelectorAll(".item-bar.expanded").forEach((other) => {
          if (other !== bar) {
            other.classList.remove("expanded");
            const w = other.querySelector(".item-details-wrapper");
            if (w) w.classList.remove("open");
          }
        });
      }

      bar.classList.toggle("expanded", !isOpen);
      wrapper.classList.toggle("open", !isOpen);
    });
  });
})();

/* ---------------------------------------------------------
   Visual Works — project accordion with image carousels.
   Opening a project expands it and shows a carousel that
   cycles through every image in that project's folder, both
   in the large left preview (desktop) and inline (mobile).
   --------------------------------------------------------- */
(function () {
  const projectBars = document.querySelectorAll(".project-bar");
  const imageArea = document.querySelector(".image-area");
  if (!projectBars.length) return;

  // Each Visuals category folder, with its sequential image count + extension.
  const FOLDERS = {
    illustration: { dir: "illustration", ext: "png", count: 1 },
    photography: { dir: "photography", ext: "jpg", count: 31 },
    "3d-modeling": { dir: "3d-modeling", ext: "png", count: 1 },
    branding: { dir: "branding", ext: "png", count: 2 },
  };

  function imagesFor(bar) {
    const cfg = FOLDERS[bar.getAttribute("data-project")];
    if (cfg) {
      return Array.from(
        { length: cfg.count },
        (_, i) => "assets/img/" + cfg.dir + "/" + (i + 1) + "." + cfg.ext
      );
    }
    const single = bar.getAttribute("data-image");
    return single && single !== "placeholder" ? [single] : [];
  }

  // Build a carousel inside `container`. Returns a stop() that clears its timer.
  function makeCarousel(container, images, alt) {
    container.innerHTML = "";
    if (!images.length) return function () {};

    const wrap = document.createElement("div");
    wrap.className = "carousel";

    const img = document.createElement("img");
    img.className = "carousel-img";
    img.alt = alt;
    img.src = images[0];
    wrap.appendChild(img);

    let idx = 0;
    let timer = null;
    let counter = null;

    function stopAuto() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }
    function startAuto() {
      if (images.length > 1) timer = setInterval(() => show(idx + 1), 3800);
    }
    function show(i) {
      idx = (i + images.length) % images.length;
      img.classList.remove("is-fade");
      void img.offsetWidth; // restart the fade animation
      img.src = images[idx];
      img.classList.add("is-fade");
      if (counter) counter.textContent = idx + 1 + " / " + images.length;
    }

    if (images.length > 1) {
      const prevBtn = document.createElement("button");
      prevBtn.type = "button";
      prevBtn.className = "carousel-btn carousel-prev";
      prevBtn.setAttribute("aria-label", "Previous image");
      prevBtn.innerHTML = "‹";

      const nextBtn = document.createElement("button");
      nextBtn.type = "button";
      nextBtn.className = "carousel-btn carousel-next";
      nextBtn.setAttribute("aria-label", "Next image");
      nextBtn.innerHTML = "›";

      counter = document.createElement("div");
      counter.className = "carousel-counter";

      prevBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        show(idx - 1);
        stopAuto();
        startAuto();
      });
      nextBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        show(idx + 1);
        stopAuto();
        startAuto();
      });

      wrap.appendChild(prevBtn);
      wrap.appendChild(nextBtn);
      wrap.appendChild(counter);
      wrap.addEventListener("mouseenter", stopAuto);
      wrap.addEventListener("mouseleave", startAuto);
    }

    container.appendChild(wrap);
    show(0);
    startAuto();
    return stopAuto;
  }

  let carouselStop = null;

  // Left column keeps the single highlight image (the project's data-image).
  function renderHighlight(bar) {
    if (!imageArea) return;
    const src = bar.getAttribute("data-image");
    const title = bar.querySelector(".project-title");
    const alt = title ? title.textContent.trim() : "";
    if (src && src !== "placeholder") {
      imageArea.innerHTML =
        '<img src="' + src + '" alt="' + alt + '" class="project-image" />';
    }
  }

  function buildPreview(bar) {
    renderHighlight(bar);
    if (carouselStop) {
      carouselStop();
      carouselStop = null;
    }
    // Carousel lives on the right of the opened section; revealed as it expands.
    const slot = bar.querySelector(".project-carousel");
    if (slot) {
      const title = bar.querySelector(".project-title");
      const alt = title ? title.textContent.trim() : "";
      carouselStop = makeCarousel(slot, imagesFor(bar), alt);
    }
  }

  // Expand one project (collapsing the rest) and build its carousel.
  function openBar(bar) {
    projectBars.forEach((other) => {
      const w = other.querySelector(".project-details-wrapper");
      const isTarget = other === bar;
      other.classList.toggle("expanded", isTarget);
      if (w) w.classList.toggle("open", isTarget);
    });
    buildPreview(bar);
  }

  projectBars.forEach((bar) => {
    const wrapper = bar.querySelector(".project-details-wrapper");
    if (!wrapper) return;
    bar.addEventListener("click", () => {
      if (bar.classList.contains("expanded")) {
        // Collapse: stop the carousel; the left highlight image stays.
        bar.classList.remove("expanded");
        wrapper.classList.remove("open");
        if (carouselStop) {
          carouselStop();
          carouselStop = null;
        }
      } else {
        openBar(bar);
      }
    });
  });

  // On load, open the project named in the URL (?project=slug) if present,
  // e.g. when arriving from a highlight card on the home page.
  const slug = new URLSearchParams(window.location.search).get("project");
  const target =
    (slug &&
      Array.from(projectBars).find(
        (b) => b.getAttribute("data-project") === slug
      )) ||
    document.querySelector(".project-bar.expanded") ||
    projectBars[0];

  if (target) {
    openBar(target);
    // Bring the chosen project into view if it isn't the first one.
    if (slug && target !== projectBars[0]) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
})();
