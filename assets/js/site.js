(() => {
  const icon = (name) => {
    const paths = {
      code: '<path d="m8 9-3 3 3 3m8-6 3 3-3 3m-2-9-4 12"/>',
      copy: '<rect x="8" y="8" width="11" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2"/>',
      check: '<path d="m5 12 4 4L19 6"/>',
    };

    return `<svg class="mp-symbol" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths[name]}</svg>`;
  };

  const menuToggle = document.querySelector("[data-menu-toggle]");
  const navigation = document.querySelector("[data-site-navigation]");

  const setMenu = (open) => {
    if (!menuToggle || !navigation) return;
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute("aria-label", open ? "메뉴 닫기" : "메뉴 열기");
    navigation.classList.toggle("is-open", open);
    document.body.classList.toggle("menu-open", open);
  };

  menuToggle?.addEventListener("click", () => {
    setMenu(menuToggle.getAttribute("aria-expanded") !== "true");
  });

  navigation?.addEventListener("click", (event) => {
    if (event.target.closest("a")) setMenu(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setMenu(false);
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 720) setMenu(false);
  });

  document.querySelectorAll(".article-content > pre").forEach((pre) => {
    const wrapper = document.createElement("div");
    wrapper.className = "highlight";
    pre.before(wrapper);
    wrapper.append(pre);
  });

  document.querySelectorAll(".article-content .highlight").forEach((highlight) => {
    if (highlight.querySelector(".code-toolbar")) return;

    const toolbar = document.createElement("div");
    toolbar.className = "code-toolbar";

    const label = document.createElement("span");
    label.className = "code-toolbar__label";
    label.innerHTML = `${icon("code")}<span>Code</span>`;

    const button = document.createElement("button");
    button.className = "code-copy";
    button.type = "button";
    button.setAttribute("aria-label", "코드 복사");
    button.innerHTML = `${icon("copy")}<span>Copy</span>`;

    button.addEventListener("click", async () => {
      const code = highlight.querySelector("pre");
      if (!code) return;

      try {
        await navigator.clipboard.writeText(code.innerText);
        button.classList.add("is-copied");
        button.innerHTML = `${icon("check")}<span>Copied</span>`;
        window.setTimeout(() => {
          button.classList.remove("is-copied");
          button.innerHTML = `${icon("copy")}<span>Copy</span>`;
        }, 1800);
      } catch {
        button.setAttribute("aria-label", "복사하지 못했습니다");
      }
    });

    toolbar.append(label, button);
    highlight.prepend(toolbar);
  });

  const tocLinks = Array.from(document.querySelectorAll(".article-toc a"));
  if (tocLinks.length && "IntersectionObserver" in window) {
    const headingMap = new Map();

    tocLinks.forEach((link) => {
      const id = decodeURIComponent(link.getAttribute("href")?.slice(1) || "");
      const heading = document.getElementById(id);
      if (heading) headingMap.set(heading, link);
    });

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (!visible.length) return;

        tocLinks.forEach((link) => link.classList.remove("is-active"));
        headingMap.get(visible[0].target)?.classList.add("is-active");
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 },
    );

    headingMap.forEach((_, heading) => observer.observe(heading));
  }

  const backToTop = document.querySelector("[data-back-to-top]");
  if (backToTop) {
    const syncBackToTop = () => {
      backToTop.hidden = window.scrollY < 560;
    };

    syncBackToTop();
    window.addEventListener("scroll", syncBackToTop, { passive: true });
    backToTop.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  const searchRoot = document.querySelector("[data-search]");
  if (searchRoot) {
    const input = searchRoot.querySelector("[data-search-input]");
    const status = searchRoot.querySelector("[data-search-status]");
    const items = Array.from(searchRoot.querySelectorAll("[data-search-item]"));

    const normalize = (value) =>
      value.normalize("NFKC").toLocaleLowerCase().trim();

    const filter = () => {
      const query = normalize(input.value);

      if (!query) {
        items.forEach((item) => {
          item.hidden = true;
          item.removeAttribute("data-match");
        });
        status.textContent = "검색어를 입력하면 글을 바로 필터링합니다.";
        return;
      }

      let count = 0;
      items.forEach((item) => {
        const match = normalize(item.dataset.searchText || "").includes(query);
        item.hidden = !match;
        item.toggleAttribute("data-match", match);
        if (match) count += 1;
      });

      status.textContent = count
        ? `${count}개의 글을 찾았습니다.`
        : "일치하는 글이 없습니다.";
    };

    input?.addEventListener("input", filter);
  }
})();
