// ==========================================================================
//  Ситуационный центр — интерактив и анимации (Motion / motion.dev)
// ==========================================================================
import { animate, inView, stagger } from "https://cdn.jsdelivr.net/npm/motion@11/+esm";

const root = document.documentElement;
root.classList.add("js");
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

/* Лоадер: прячем по полной загрузке страницы (или максимум через 3.5с) */
const ready = Promise.race([
  new Promise(r => {
    if (document.readyState === "complete") r();
    else window.addEventListener("load", r, { once: true });
  }),
  new Promise(r => setTimeout(r, 3500)),
]).then(() => { root.classList.add("loaded"); });

/* ------------------------------------------------------------------ *
 * 0. Темы: светлая (по умолчанию) ↔ тёмная — дабл-клик по логотипу
 * ------------------------------------------------------------------ */
(function themeSwitcher() {
  $$(".logo").forEach(logo => logo.addEventListener("dblclick", (e) => {
    e.preventDefault();
    const dark = root.getAttribute("data-theme") === "dark";
    if (dark) root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", "dark");
    try { sessionStorage.setItem("sc-theme", dark ? "light" : "dark"); } catch (err) {}
  }));
})();

/* ------------------------------------------------------------------ *
 * 1. Hero: генерация и пульсация точек на карте
 * ------------------------------------------------------------------ */
(function heroDots() {
  const wrap = $("#heroDots");
  if (!wrap) return;
  // координаты (%) и размер точек — имитируют объекты на карте
  const dots = [
    [46, 12, 10], [30, 24, 6], [58, 20, 8], [78, 16, 20], [88, 34, 7],
    [52, 34, 14], [40, 44, 7], [50, 52, 16], [66, 46, 6], [74, 56, 9],
    [24, 58, 8], [12, 62, 10], [36, 66, 6], [60, 70, 7], [84, 72, 6],
  ];
  dots.forEach(([x, y, d], i) => {
    const el = document.createElement("span");
    el.className = "dot";
    // пульс — целиком CSS (transform/opacity): Safari рисовал box-shadow кляксами
    el.style.cssText = `left:${x}%;top:${y}%;width:${d}px;height:${d}px;margin:${-d/2}px 0 0 ${-d/2}px;` +
      `--pulse-dur:${(2.4 + (i % 4) * .4).toFixed(1)}s;--pulse-delay:${(i * .18).toFixed(2)}s`;
    wrap.appendChild(el);
  });
})();

/* ------------------------------------------------------------------ *
 * 2. Hero: заголовок печатается (Iron Man HUD). Первый показ — все три
 *    строки; дальше «Место,» неизменно, перепечатываются строки 2–3.
 * ------------------------------------------------------------------ */
(function heroTitle() {
  const t = $("[data-split]");
  if (!t) return;
  if (t.dataset.typerInit) return; // защита от двойной инициализации (гонка двух циклов печати)
  t.dataset.typerInit = "1";
  const PHRASES = [
    ["откуда виден", "завтрашний город"],
    ["где строится", "будущая Москва"],
    ["где город виден", "в реальном времени"],
  ];
  const PERIOD = 4000;   // пауза между сменами
  const ERASE_MS = 14;   // скорость стирания (на символ)
  const TYPE_MS = 34;    // скорость набора (на символ)

  const lines = t.innerHTML.split(/<br\s*\/?>/i);
  t.innerHTML = lines.map(l => `<span class="split-line"><span class="split-inner">${l.trim()}</span></span>`).join("");
  const inners = $$(".split-inner", t);
  const first = inners.map(el => el.textContent); // исходная фраза из разметки
  const mutable = inners.slice(1);                // строки 2 и 3; «Место,» не трогаем

  if (reduced) {
    t.style.opacity = 1;
    let i = 0;
    setInterval(() => {
      i = (i + 1) % PHRASES.length;
      mutable.forEach((el, n) => { el.textContent = PHRASES[i][n] || ""; });
    }, PERIOD);
    return;
  }

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  async function erase(el) {
    while (el.textContent.length) {
      el.textContent = el.textContent.slice(0, -1);
      await sleep(ERASE_MS);
    }
  }
  async function type(el, text) {
    el.classList.add("typing");
    for (let n = 1; n <= text.length; n++) {
      el.textContent = text.slice(0, n);
      await sleep(TYPE_MS);
    }
    el.classList.remove("typing");
  }

  let idx = 0;
  async function swap() {
    idx = (idx + 1) % PHRASES.length;
    // стираем снизу вверх, печатаем сверху вниз — «терминальный» ритм
    await erase(mutable[1]);
    await erase(mutable[0]);
    await type(mutable[0], PHRASES[idx][0]);
    await type(mutable[1], PHRASES[idx][1]);
  }

  (async function intro() {
    inners.forEach(el => { el.textContent = ""; });
    t.style.opacity = 1;
    await ready;      // печать начинается после скрытия лоадера
    await sleep(450);
    for (let n = 0; n < inners.length; n++) await type(inners[n], first[n]);
    setInterval(swap, PERIOD);
  })();
})();

/* ------------------------------------------------------------------ *
 * 3. Scroll-reveal для [data-anim="fade-up"]
 * ------------------------------------------------------------------ */
(function reveal() {
  const items = $$('[data-anim="fade-up"]');
  if (reduced) { items.forEach(i => i.style.opacity = 1); return; }
  // группируем по родителю для stagger
  inView(items, ({ target }) => {
    animate(target, { opacity: [0, 1], transform: ["translateY(28px)", "translateY(0)"] },
      { duration: .7, ease: [.16, 1, .3, 1] });
    return () => {}; // однократно (по умолчанию inView срабатывает раз)
  }, { amount: .2 });
})();

/* ------------------------------------------------------------------ *
 * 4. Факт в hero: ротация 3 цифр по таймеру (4с) + count-up
 * ------------------------------------------------------------------ */
(function heroFactRotator() {
  const box = $("#heroFact");
  if (!box) return;
  if (box.dataset.rotatorInit) return; // защита от двойной инициализации
  box.dataset.rotatorInit = "1";
  const numEl = box.querySelector(".fact__num");
  const labelEl = box.querySelector(".fact__label");
  const FACTS = [
    { value: 4000,   label: "объектов<br>на контроле" },
    { value: 400000, label: "строителей" },
    { value: 20000,  label: "автомобилей" },
  ];
  const PERIOD = 4000; // мс между сменами
  const fmt = (n) => Math.round(n).toLocaleString("ru-RU").replace(/\u202f/g, "\u00a0");
  let i = 0;

  function countUp(target) {
    if (reduced) { numEl.textContent = fmt(target); return; }
    animate(0, target, { duration: 1.2, ease: [.16, 1, .3, 1],
      onUpdate: v => { numEl.textContent = fmt(v); } });
  }

  function show(idx, first = false) {
    const f = FACTS[idx];
    if (reduced || first) {
      labelEl.innerHTML = f.label;
      countUp(f.value);
      return;
    }
    // уход вверх → смена → count-up + возврат снизу
    animate([numEl, labelEl], { opacity: [1, 0], transform: ["translateY(0)", "translateY(-14px)"] },
      { duration: .35, ease: "easeIn" }).finished.then(() => {
      labelEl.innerHTML = f.label;
      countUp(f.value);
      animate([numEl, labelEl], { opacity: [0, 1], transform: ["translateY(14px)", "translateY(0)"] },
        { duration: .45, ease: [.16, 1, .3, 1] });
    });
  }

  // первый показ — count-up при появлении hero, дальше — таймер
  let started = false;
  inView(box, () => {
    if (started) return; started = true;
    show(0, true);
    setInterval(() => { i = (i + 1) % FACTS.length; show(i); }, PERIOD);
  }, { amount: .4 });
})();

/* ------------------------------------------------------------------ *
 * 4b. Общая пагинация списочных страниц (окно вокруг текущей + края)
 * ------------------------------------------------------------------ */
function setupPagination(pag, total, onChange) {
  let current = 1;
  function pages(c) {
    const set = new Set([1, 2, c - 1, c, c + 1, total - 1, total]);
    const arr = [...set].filter(n => n >= 1 && n <= total).sort((a, b) => a - b);
    const out = [];
    arr.forEach((n, i) => {
      if (i && n - arr[i - 1] > 1) out.push("...");
      out.push(n);
    });
    return out;
  }
  function render() {
    pag.innerHTML = pages(current).map(p =>
      p === "..."
        ? `<span class="pagination__item is-dots">...</span>`
        : `<button class="pagination__item${p === current ? " is-active" : ""}" data-page="${p}" ${p === current ? 'aria-current="page"' : ""}>${p}</button>`
    ).join("");
  }
  pag.addEventListener("click", (e) => {
    const b = e.target.closest("[data-page]");
    if (!b || +b.dataset.page === current) return;
    current = +b.dataset.page;
    render();
    onChange(current);
  });
  render();
}

/* ------------------------------------------------------------------ *
 * 4c. Страница «Все новости»: список из 10 + пагинация
 * ------------------------------------------------------------------ */
(function newsListPage() {
  const list = $("#newsList");
  const pag = $("#pagination");
  if (!list || !pag) return;

  const ITEMS = [
    { img: "assets/img/news-1.webp", date: "11 июл. 2026 г. 18:00",
      title: "Получайте ежедневную подборку актуальных публикаций о строительстве в Москве" },
    { img: "assets/img/news-2.webp", date: "11 июл. 2026 г. 17:50",
      title: "Сергей Собянин поздравил жителей столицы с Днём московского транспорта" },
    { img: "assets/img/news-3.webp", date: "11 июл. 2026 г. 16:30",
      title: "Владимир Ефимов: более 1200 домов полностью расселили по программе реновации в Москве" },
  ];

  function renderList() {
    const rows = [];
    for (let n = 0; n < 10; n++) {
      const it = ITEMS[n % 3];
      rows.push(`<li class="news-item">
        <a class="news-item__thumb" href="news.html" style="--img:url('../${it.img}')"></a>
        <div class="news-item__body">
          <time class="news-item__date">${it.date}</time>
          <a class="news-item__title" href="news.html">${it.title}</a>
        </div>
      </li>`);
    }
    list.innerHTML = rows.join("");
    if (!reduced) {
      animate($$(".news-item", list), { opacity: [0, 1], transform: ["translateY(20px)", "translateY(0)"] },
        { duration: .5, delay: stagger(.05), ease: [.16, 1, .3, 1] });
    }
  }

  renderList();
  setupPagination(pag, 168, () => {
    renderList();
    list.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  });
})();

/* ------------------------------------------------------------------ *
 * 4d. Страница «Все события»: сетка карточек (как на главной) + пагинация
 * ------------------------------------------------------------------ */
(function eventsListPage() {
  const grid = $("#eventsGrid");
  const pag = $("#eventsPagination");
  if (!grid || !pag) return;

  const RIPPLE = `<svg class="ev-card__hover" viewBox="0 0 329 429" preserveAspectRatio="none" aria-hidden="true">
      <circle class="rp rp--fill" cx="40.78" cy="392.5" r="295.4" />
      <circle class="rp rp--ring" cx="40.78" cy="392.5" r="425.75" />
    </svg>`;
  const CARDS = [
    { img: "assets/img/event-1.webp", date: "Скоро", label: "Москва<br>2040" },
    { img: "assets/img/event-2.webp", date: "Скоро", label: "лекция<br>Сергея Кузнецова" },
    { img: "assets/img/event-3.webp", date: "19:00<br>24.07.2026", label: "архитектурный<br>воркшоп" },
  ];

  function renderGrid() {
    const cells = [];
    for (let n = 0; n < 18; n++) {
      const c = CARDS[n % 3];
      cells.push(`<a class="ev-card" href="event.html" style="--img:url('../${c.img}')">
        ${RIPPLE}
        <span class="ev-card__date">${c.date}</span>
        <span class="ev-card__label">${c.label}</span>
      </a>`);
    }
    grid.innerHTML = cells.join("");
    if (!reduced) {
      animate($$(".ev-card", grid), { opacity: [0, 1], transform: ["translateY(20px)", "translateY(0)"] },
        { duration: .5, delay: stagger(.04), ease: [.16, 1, .3, 1] });
    }
  }

  renderGrid();
  setupPagination(pag, 168, () => {
    renderGrid();
    grid.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  });
})();

/* ------------------------------------------------------------------ *
 * 5. Панорама: разбор здания по этажам (киношно)
 * ------------------------------------------------------------------ */
(function panorama() {
  const building = $("#building");
  if (!building) return;
  const floors = $$(".floor", building);
  const btns = $$("[data-floor-btn]");
  const OFFSET = 300; // px на «ступень» — старт по ТЗ, правится легко
  let current = 0;    // 0 = здание собрано

  function apply(level) {
    floors.forEach(f => {
      const fl = +f.dataset.floor;
      // level=0 → собранное здание; иначе: выше выбранного → вверх, ниже → вниз
      const diff = level === 0 ? 0 : fl - level;
      const y = -OFFSET * diff;
      const opacity = diff === 0 ? 1 : 0.2;
      if (reduced) { f.style.transform = `translateY(${y}px)`; f.style.opacity = opacity; return; }
      animate(f, { transform: `translateY(${y}px)`, opacity },
        { duration: 1.1, ease: [.22, 1, .36, 1] });
    });
    btns.forEach(b => {
      const on = +b.dataset.floorBtn === level;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
  }

  btns.forEach(b => b.addEventListener("click", () => {
    const level = +b.dataset.floorBtn;
    current = current === level ? 0 : level; // повторный клик — собрать здание
    apply(current);
  }));
})();

/* ------------------------------------------------------------------ *
 * 6. Sticky topbar — появление после hero
 * ------------------------------------------------------------------ */
(function topbar() {
  const bar = $("#topbar");
  const hero = $("#hero");
  if (!bar || !hero) return;
  const io = new IntersectionObserver(([e]) => {
    bar.classList.toggle("is-visible", !e.isIntersecting);
  }, { rootMargin: "-80px 0px 0px 0px" });
  io.observe(hero);
})();

/* ------------------------------------------------------------------ *
 * 7. Мобильное меню (бургеры)
 * ------------------------------------------------------------------ */
(function mobileMenu() {
  const links = $$(".hero__menu a, .pagebar__menu a").map(a => `<a href="${a.getAttribute("href")}">${a.textContent}</a>`).join("");
  const menu = document.createElement("nav");
  menu.className = "mobile-menu";
  menu.innerHTML = links + `<button class="btn btn--red-outline" data-open-form>Записаться на экскурсию</button>`;
  const scrim = document.createElement("div");
  scrim.className = "mobile-menu__scrim";
  document.body.append(scrim, menu);

  const burgers = $$("#burger, #burgerHero");
  const close = () => { menu.classList.remove("is-open"); scrim.classList.remove("is-open"); burgers.forEach(b => b.setAttribute("aria-expanded", "false")); };
  const open  = () => { menu.classList.add("is-open"); scrim.classList.add("is-open"); burgers.forEach(b => b.setAttribute("aria-expanded", "true")); };
  burgers.forEach(b => b.addEventListener("click", () => menu.classList.contains("is-open") ? close() : open()));
  scrim.addEventListener("click", close);
  menu.querySelectorAll("a").forEach(a => a.addEventListener("click", close));
})();

/* ------------------------------------------------------------------ *
 * 8. Модалка «Запись на экскурсию» + блюр страницы
 * ------------------------------------------------------------------ */
(function modals() {
  const openModal = (m) => { m.classList.add("is-open"); m.setAttribute("aria-hidden", "false"); document.body.classList.add("form-open"); };
  const closeAll = () => {
    $$(".modal.is-open").forEach(m => {
      m.classList.remove("is-open"); m.setAttribute("aria-hidden", "true");
      // сброс флоу к начальному состоянию (форма ↔ подтверждение)
      const states = $$(".modal__state", m);
      if (states.length) {
        states.forEach(s => { s.hidden = s.dataset.state !== "form"; });
        m.querySelector("form")?.reset();
      }
    });
    document.body.classList.remove("form-open");
  };
  // делегирование: [data-open-form] → экскурсия; [data-open-modal="id"] → любая модалка
  document.addEventListener("click", (e) => {
    const generic = e.target.closest("[data-open-modal]");
    if (generic) {
      e.preventDefault();
      const m = document.getElementById(generic.dataset.openModal);
      if (m) openModal(m);
      return;
    }
    if (e.target.closest("[data-open-form]")) {
      e.preventDefault();
      const m = $("#excursion");
      if (m) openModal(m);
    }
    if (e.target.closest("[data-close-form]")) closeAll();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAll(); });

  // Флоу «Запись на лекцию»: сабмит → состояние «Ваша запись принята»
  const lf = $("#lectureForm");
  if (lf) lf.addEventListener("submit", (e) => {
    e.preventDefault();
    const m = lf.closest(".modal");
    $$(".modal__state", m).forEach(s => { s.hidden = s.dataset.state !== "success"; });
  });
})();

/* ------------------------------------------------------------------ *
 * 9. Демо-отправка форм (без бэкенда)
 * ------------------------------------------------------------------ */
(function formsDemo() {
  $$("form").forEach(form => {
    if (form.id === "lectureForm") return; // у лекции свой флоу (подтверждение)
    form.addEventListener("submit", (e) => {
    e.preventDefault();
    const btn = form.querySelector("button[type=submit]");
    if (!btn) return;
    const label = btn.textContent;
    btn.textContent = "Отправлено ✓";
    btn.disabled = true;
    if (!reduced) animate(btn, { scale: [1, .96, 1] }, { duration: .35 });
    setTimeout(() => { btn.textContent = label; btn.disabled = false; form.reset(); }, 1800);
  });
  });
})();
