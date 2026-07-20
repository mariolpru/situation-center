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
    // точки под зоной заголовка/лида (лево-верх) — глушим на мобилке (класс срабатывает
    // только в @media ≤767: там контент прижат к верху и текст перекрывает эту область)
    if (x <= 76 && y >= 10 && y <= 54) el.classList.add("dot--muted");
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
    // НИЧЕГО не возвращаем: в Motion возврат функции = leave-обработчик, из-за него
    // появление повторялось при каждом повторном входе (дёрганье/зацикливание у порога).
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
    for (let n = 0; n < 16; n++) {   // 16 = ровно 4 полных ряда по 4 карточки
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
  const OFFSET = 300;      // px на «ступень» — старт по ТЗ, правится легко
  const FILL_DESK = 0.92;  // доля свободной ширины сцены, которую занимает выбранный этаж
  const FILL_MOB  = 1;     // на телефоне план должен заполнять экран целиком
  const stage = building.closest(".panorama__stage");
  let current = 0;         // 0 = здание собрано

  /* Наезд на выбранный этаж. Простой scale() не подходит: этажи разной ширины и лежат
     в разных местах бокса здания (жилой и крыша — 48.8% ширины со сдвигом вправо),
     поэтому общий масштаб уводит план вбок и на переключатели. Считаем масштаб под
     конкретный этаж и сдвигаем его центр в центр сцены. */
  let zoomRetry = 0;
  function zoomTo(level) {
    if (level === 0) { building.style.transform = ""; zoomRetry = 0; return; }
    const floor = floors.find(f => +f.dataset.floor === level);
    if (!floor) return;
    const bw = building.clientWidth, bh = building.clientHeight;
    const fw = floor.offsetWidth, fh = floor.offsetHeight;
    // картинки этажей ленивые (loading="lazy"): пока не загрузились, размеры нулевые
    // и масштаб не посчитать — повторяем по загрузке, иначе зум просто не применится
    if (!fw || !fh) {
      const img = floor.querySelector("img");
      const again = () => { if (current === level) zoomTo(level); };
      if (img && !img.complete) img.addEventListener("load", again, { once: true });
      else if (zoomRetry++ < 10) requestAnimationFrame(again); // ждём раскладку, но не бесконечно
      return;
    }
    zoomRetry = 0;
    const fill = window.matchMedia("(max-width: 1024px)").matches ? FILL_MOB : FILL_DESK;
    // по высоте ограничиваемся сценой (минус фейд маски у краёв), чтобы план не наезжал
    // на кнопки этажей и не обрезался
    const availH = (stage ? stage.clientHeight : bh) - 128;
    const z = Math.max(1, Math.min(fill * bw / fw, availH / fh));
    // сдвиг, приводящий центр этажа в центр сцены (transform-origin: 50% 50%)
    const dx = (bw / 2 - (floor.offsetLeft + fw / 2)) * z;
    const dy = (bh / 2 - (floor.offsetTop + fh / 2)) * z;
    building.style.transform = `translate(${dx}px, ${dy}px) scale(${z})`;
  }

  function apply(level) {
    // Зум CSS-транзишеном: .building, в отличие от .floor, Motion не анимирует,
    // так что двойного проигрывания в Safari не будет.
    zoomTo(level);

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
    // точки-зоны видны только когда выбран 2-й этаж
    building.classList.toggle("show-hotspots", level === 2);
  }

  btns.forEach(b => b.addEventListener("click", () => {
    const level = +b.dataset.floorBtn;
    current = current === level ? 0 : level; // повторный клик — собрать здание
    apply(current);
  }));

  // масштаб считается от размеров сцены — пересчитываем при ресайзе/повороте
  let resizeT;
  window.addEventListener("resize", () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => zoomTo(current), 150);
  });

  // Точки-зоны 2-го этажа: 6 маркеров, по 2 ведут на один из трёх попапов.
  // Пины взяты из Figma (компонент 3272:50) целиком, 1:1 — вместе с кругом и бордером;
  // масштабируются размером кнопки. Два состояния макета: default и hover.
  const hs = $("#hotspots");
  if (hs) {
    const PIN = {
      info: {
        def: `<g id="info"> <g id="Property 1=light"> <rect x="1" y="1" width="29" height="29" rx="14.5" fill="white"/> <rect x="1" y="1" width="29" height="29" rx="14.5" stroke="#BE171E" stroke-width="2"/> <path id="i" d="M14.871 6.825C15.4543 6.69167 15.9627 6.83333 16.396 7.25C16.7127 7.6 16.871 7.98333 16.871 8.4C16.871 8.66667 16.8127 8.91667 16.696 9.15C16.396 9.71667 15.9043 10.0167 15.221 10.05C14.5877 10.05 14.1127 9.76667 13.796 9.2C13.6627 8.95 13.596 8.68333 13.596 8.4C13.596 8.15 13.6543 7.90833 13.771 7.675C13.9877 7.20833 14.3543 6.925 14.871 6.825ZM14.696 12.6C16.096 12.5 16.7627 12.45 16.696 12.45H16.771V17.175C16.771 20.325 16.7877 21.9167 16.821 21.95C16.871 22 16.9127 22.025 16.946 22.025C17.046 22.075 17.4127 22.1 18.046 22.1H18.521V22.8V23.5H18.321L16.896 23.45C16.0627 23.4333 15.2043 23.4333 14.321 23.45C13.3043 23.4833 12.7877 23.5 12.771 23.5H12.546V22.8V22.1H13.071C13.9377 22.1 14.4043 22.0417 14.471 21.925C14.4877 21.9083 14.496 20.7583 14.496 18.475C14.496 16.075 14.4627 14.7917 14.396 14.625C14.346 14.475 14.246 14.3667 14.096 14.3C13.8627 14.1833 13.471 14.125 12.921 14.125H12.646V13.425V12.725H12.696L14.696 12.6Z" fill="#161F26"/> </g> </g>`,
        hov: `<g id="info"> <g id="Property 1=hover"> <rect x="1" y="1" width="29" height="29" rx="14.5" fill="#BE171E"/> <rect x="1" y="1" width="29" height="29" rx="14.5" stroke="#BE171E" stroke-width="2"/> <path id="i" d="M14.871 6.825C15.4543 6.69167 15.9627 6.83333 16.396 7.25C16.7127 7.6 16.871 7.98333 16.871 8.4C16.871 8.66667 16.8127 8.91667 16.696 9.15C16.396 9.71667 15.9043 10.0167 15.221 10.05C14.5877 10.05 14.1127 9.76667 13.796 9.2C13.6627 8.95 13.596 8.68333 13.596 8.4C13.596 8.15 13.6543 7.90833 13.771 7.675C13.9877 7.20833 14.3543 6.925 14.871 6.825ZM14.696 12.6C16.096 12.5 16.7627 12.45 16.696 12.45H16.771V17.175C16.771 20.325 16.7877 21.9167 16.821 21.95C16.871 22 16.9127 22.025 16.946 22.025C17.046 22.075 17.4127 22.1 18.046 22.1H18.521V22.8V23.5H18.321L16.896 23.45C16.0627 23.4333 15.2043 23.4333 14.321 23.45C13.3043 23.4833 12.7877 23.5 12.771 23.5H12.546V22.8V22.1H13.071C13.9377 22.1 14.4043 22.0417 14.471 21.925C14.4877 21.9083 14.496 20.7583 14.496 18.475C14.496 16.075 14.4627 14.7917 14.396 14.625C14.346 14.475 14.246 14.3667 14.096 14.3C13.8627 14.1833 13.471 14.125 12.921 14.125H12.646V13.425V12.725H12.696L14.696 12.6Z" fill="white"/> </g> </g>`,
      },
      panorama: {
        def: `<g id="info"> <g id="Property 1=panorama"> <rect x="1" y="1" width="29" height="29" rx="14.5" fill="white"/> <rect x="1" y="1" width="29" height="29" rx="14.5" stroke="#BE171E" stroke-width="2"/> <path id="Vector" d="M22.0325 10.0333C17.7724 11.3791 13.2276 11.3791 8.96747 10.0333C8.74037 9.96184 8.49428 10.0068 8.30374 10.1548C8.1132 10.3029 8.0007 10.5364 8 10.7854V20.214C8 20.463 8.1125 20.6972 8.30304 20.8453C8.49428 20.9934 8.74037 21.0383 8.96747 20.9661C13.2276 19.6203 17.7724 19.6203 22.0325 20.9661C22.1028 20.9882 22.176 20.9993 22.2498 21C22.6639 20.9993 22.9993 20.6479 23 20.214V10.7854C22.9993 10.5364 22.8868 10.3022 22.6963 10.1541C22.505 10.0075 22.2596 9.96332 22.0325 10.0333ZM21.5003 19.1776H21.4996C17.5644 18.1154 13.4357 18.1154 9.50045 19.1776V11.8217C13.4364 12.8795 17.5637 12.8795 21.4996 11.8217L21.5003 19.1776Z" fill="black"/> </g> </g>`,
        hov: `<g id="info"> <g id="Property 1=panorama_hover"> <rect x="1" y="1" width="29" height="29" rx="14.5" fill="#BE171E"/> <rect x="1" y="1" width="29" height="29" rx="14.5" stroke="#BE171E" stroke-width="2"/> <path id="Vector" d="M22.0325 10.0333C17.7724 11.3791 13.2276 11.3791 8.96747 10.0333C8.74037 9.96184 8.49428 10.0068 8.30374 10.1548C8.1132 10.3029 8.0007 10.5364 8 10.7854V20.214C8 20.463 8.1125 20.6972 8.30304 20.8453C8.49428 20.9934 8.74037 21.0383 8.96747 20.9661C13.2276 19.6203 17.7724 19.6203 22.0325 20.9661C22.1028 20.9882 22.176 20.9993 22.2498 21C22.6639 20.9993 22.9993 20.6479 23 20.214V10.7854C22.9993 10.5364 22.8868 10.3022 22.6963 10.1541C22.505 10.0075 22.2596 9.96332 22.0325 10.0333ZM21.5003 19.1776H21.4996C17.5644 18.1154 13.4357 18.1154 9.50045 19.1776V11.8217C13.4364 12.8795 17.5637 12.8795 21.4996 11.8217L21.5003 19.1776Z" fill="white"/> </g> </g>`,
      },
      game: {
        def: `<g id="info"> <g id="Property 1=game"> <rect x="1" y="1" width="29" height="29" rx="14.5" fill="white"/> <rect x="1" y="1" width="29" height="29" rx="14.5" stroke="#BE171E" stroke-width="2"/> <g id="gamepad"> <path id="Vector" d="M15.5098 9.2998C15.7897 9.30237 17.1527 9.32615 18.6338 9.52832C19.3744 9.62942 20.1502 9.7761 20.8369 9.98926C21.5181 10.2007 22.1349 10.4837 22.5381 10.8721L22.5898 10.9219L22.5908 10.9229C23.1145 11.4295 23.467 12.1611 23.7061 12.9561C23.946 13.7538 24.0773 14.6334 24.1455 15.4541C24.2798 17.0705 24.172 18.4826 24.1611 18.6367L24.1621 18.6377C24.1397 19.17 23.9286 19.9326 23.3867 20.5654C22.8383 21.2057 21.9613 21.7002 20.6406 21.7002C19.6305 21.7001 18.7634 21.0557 18.1055 20.335C17.5048 19.677 17.0516 18.9241 16.7891 18.4385C16.4695 18.5244 16.0315 18.6035 15.5029 18.6035C14.9719 18.6035 14.5364 18.5245 14.2148 18.4385C13.9523 18.9241 13.4998 19.6772 12.8994 20.335C12.2415 21.0556 11.3748 21.7002 10.3643 21.7002C9.04344 21.7002 8.166 21.2045 7.61621 20.5625C7.07278 19.9279 6.85983 19.1631 6.83691 18.6279L6.83789 18.627C6.82726 18.4716 6.73492 17.0494 6.88477 15.4229C6.96085 14.597 7.09996 13.7123 7.3457 12.9111C7.59068 12.1126 7.94793 11.3783 8.47168 10.873C8.87615 10.4831 9.49429 10.1986 10.1768 9.98633C10.864 9.77261 11.6395 9.6255 12.3799 9.52441C13.8613 9.32219 15.2242 9.2998 15.5029 9.2998H15.5098ZM15.5137 10.5303C14.8211 10.5383 13.5229 10.6046 12.2705 10.793C11.6433 10.8873 11.0326 11.012 10.5176 11.1729C9.9964 11.3356 9.5978 11.5283 9.37207 11.7461C9.0577 12.0493 8.80791 12.5242 8.61523 13.1104C8.42359 13.6934 8.29436 14.3688 8.21094 15.0547C8.04408 16.4268 8.06195 17.8184 8.11426 18.5488L8.11523 18.5537C8.11967 18.6481 8.15976 19.1293 8.45898 19.5811C8.74923 20.0192 9.29825 20.4541 10.375 20.4541C10.6712 20.4541 10.9784 20.3343 11.2871 20.1211C11.5953 19.9081 11.8927 19.6103 12.165 19.2793C12.7102 18.6167 13.1355 17.8436 13.3291 17.415L13.3301 17.4131C13.3906 17.2835 13.4987 17.1677 13.6426 17.1045L13.707 17.0801C13.8681 17.0295 14.0513 17.0445 14.2051 17.126L14.2236 17.1357C14.2354 17.1412 14.2539 17.15 14.2793 17.1602C14.3345 17.1821 14.4193 17.2119 14.5312 17.2422C14.7552 17.3029 15.0874 17.3643 15.5088 17.3643C15.9296 17.3642 16.2628 17.3016 16.4883 17.2402C16.6009 17.2096 16.6868 17.1793 16.7432 17.1572C16.7713 17.1462 16.7925 17.1377 16.8057 17.1318C16.8104 17.1297 16.8137 17.1272 16.8164 17.126C16.9688 17.0442 17.1526 17.0287 17.3174 17.0869L17.3184 17.0859C17.4803 17.1384 17.6221 17.2586 17.6943 17.4209H17.6934C17.8846 17.8464 18.311 18.619 18.8574 19.2822C19.1304 19.6136 19.428 19.9116 19.7363 20.125C20.0453 20.3388 20.352 20.4598 20.6465 20.46C21.7233 20.46 22.2733 20.0251 22.5635 19.5889C22.8619 19.14 22.9026 18.6628 22.9072 18.5693L22.9121 18.4775L22.918 18.4727C22.9656 17.7203 22.979 16.3796 22.8184 15.0576C22.7349 14.3709 22.6056 13.6949 22.4141 13.1113C22.2214 12.5245 21.9705 12.0492 21.6562 11.7461C21.4307 11.5284 21.0328 11.3357 20.5117 11.1729C19.9967 11.0119 19.3861 10.8873 18.7588 10.793C17.5053 10.6044 16.2058 10.5378 15.5137 10.5303Z" fill="black" stroke="black" stroke-width="0.4"/> <g id="Frame 41"> <path id="Vector 15" d="M11.3086 13.3022L11.3086 15.9069" stroke="black" stroke-linecap="round"/> <path id="Vector 16" d="M12.6108 14.6045L10.0062 14.6045" stroke="black" stroke-linecap="round"/> </g> <circle id="Ellipse 391" cx="17.9906" cy="14.4706" r="0.551147" transform="rotate(-17.2594 17.9906 14.4706)" fill="black"/> <circle id="Ellipse 393" cx="19.3704" cy="15.8504" r="0.551147" transform="rotate(-17.2594 19.3704 15.8504)" fill="black"/> <circle id="Ellipse 392" cx="19.3703" cy="13.0908" r="0.551147" transform="rotate(-17.2594 19.3703 13.0908)" fill="black"/> <circle id="Ellipse 394" cx="20.75" cy="14.4706" r="0.551147" transform="rotate(-17.2594 20.75 14.4706)" fill="black"/> </g> </g> </g>`,
        hov: `<g id="info"> <g id="Property 1=game_hover"> <rect x="1" y="1" width="29" height="29" rx="14.5" fill="#BE171E"/> <rect x="1" y="1" width="29" height="29" rx="14.5" stroke="#BE171E" stroke-width="2"/> <g id="gamepad"> <path id="Vector" d="M15.5098 9.2998C15.7897 9.30237 17.1527 9.32615 18.6338 9.52832C19.3744 9.62942 20.1502 9.7761 20.8369 9.98926C21.5181 10.2007 22.1349 10.4837 22.5381 10.8721L22.5898 10.9219L22.5908 10.9229C23.1145 11.4295 23.467 12.1611 23.7061 12.9561C23.946 13.7538 24.0773 14.6334 24.1455 15.4541C24.2798 17.0705 24.172 18.4826 24.1611 18.6367L24.1621 18.6377C24.1397 19.17 23.9286 19.9326 23.3867 20.5654C22.8383 21.2057 21.9613 21.7002 20.6406 21.7002C19.6305 21.7001 18.7634 21.0557 18.1055 20.335C17.5048 19.677 17.0516 18.9241 16.7891 18.4385C16.4695 18.5244 16.0315 18.6035 15.5029 18.6035C14.9719 18.6035 14.5364 18.5245 14.2148 18.4385C13.9523 18.9241 13.4998 19.6772 12.8994 20.335C12.2415 21.0556 11.3748 21.7002 10.3643 21.7002C9.04344 21.7002 8.166 21.2045 7.61621 20.5625C7.07278 19.9279 6.85983 19.1631 6.83691 18.6279L6.83789 18.627C6.82726 18.4716 6.73492 17.0494 6.88477 15.4229C6.96085 14.597 7.09996 13.7123 7.3457 12.9111C7.59068 12.1126 7.94793 11.3783 8.47168 10.873C8.87615 10.4831 9.49429 10.1986 10.1768 9.98633C10.864 9.77261 11.6395 9.6255 12.3799 9.52441C13.8613 9.32219 15.2242 9.2998 15.5029 9.2998H15.5098ZM15.5137 10.5303C14.8211 10.5383 13.5229 10.6046 12.2705 10.793C11.6433 10.8873 11.0326 11.012 10.5176 11.1729C9.9964 11.3356 9.5978 11.5283 9.37207 11.7461C9.0577 12.0493 8.80791 12.5242 8.61523 13.1104C8.42359 13.6934 8.29436 14.3688 8.21094 15.0547C8.04408 16.4268 8.06195 17.8184 8.11426 18.5488L8.11523 18.5537C8.11967 18.6481 8.15976 19.1293 8.45898 19.5811C8.74923 20.0192 9.29825 20.4541 10.375 20.4541C10.6712 20.4541 10.9784 20.3343 11.2871 20.1211C11.5953 19.9081 11.8927 19.6103 12.165 19.2793C12.7102 18.6167 13.1355 17.8436 13.3291 17.415L13.3301 17.4131C13.3906 17.2835 13.4987 17.1677 13.6426 17.1045L13.707 17.0801C13.8681 17.0295 14.0513 17.0445 14.2051 17.126L14.2236 17.1357C14.2354 17.1412 14.2539 17.15 14.2793 17.1602C14.3345 17.1821 14.4193 17.2119 14.5312 17.2422C14.7552 17.3029 15.0874 17.3643 15.5088 17.3643C15.9296 17.3642 16.2628 17.3016 16.4883 17.2402C16.6009 17.2096 16.6868 17.1793 16.7432 17.1572C16.7713 17.1462 16.7925 17.1377 16.8057 17.1318C16.8104 17.1297 16.8137 17.1272 16.8164 17.126C16.9688 17.0442 17.1526 17.0287 17.3174 17.0869L17.3184 17.0859C17.4803 17.1384 17.6221 17.2586 17.6943 17.4209H17.6934C17.8846 17.8464 18.311 18.619 18.8574 19.2822C19.1304 19.6136 19.428 19.9116 19.7363 20.125C20.0453 20.3388 20.352 20.4598 20.6465 20.46C21.7233 20.46 22.2733 20.0251 22.5635 19.5889C22.8619 19.14 22.9026 18.6628 22.9072 18.5693L22.9121 18.4775L22.918 18.4727C22.9656 17.7203 22.979 16.3796 22.8184 15.0576C22.7349 14.3709 22.6056 13.6949 22.4141 13.1113C22.2214 12.5245 21.9705 12.0492 21.6562 11.7461C21.4307 11.5284 21.0328 11.3357 20.5117 11.1729C19.9967 11.0119 19.3861 10.8873 18.7588 10.793C17.5053 10.6044 16.2058 10.5378 15.5137 10.5303Z" fill="white" stroke="white" stroke-width="0.4"/> <g id="Frame 41"> <path id="Vector 15" d="M11.3086 13.3022L11.3086 15.9069" stroke="white" stroke-linecap="round"/> <path id="Vector 16" d="M12.6108 14.6045L10.0062 14.6045" stroke="white" stroke-linecap="round"/> </g> <circle id="Ellipse 391" cx="17.9906" cy="14.4706" r="0.551147" transform="rotate(-17.2594 17.9906 14.4706)" fill="white"/> <circle id="Ellipse 393" cx="19.3704" cy="15.8504" r="0.551147" transform="rotate(-17.2594 19.3704 15.8504)" fill="white"/> <circle id="Ellipse 392" cx="19.3703" cy="13.0908" r="0.551147" transform="rotate(-17.2594 19.3703 13.0908)" fill="white"/> <circle id="Ellipse 394" cx="20.75" cy="14.4706" r="0.551147" transform="rotate(-17.2594 20.75 14.4706)" fill="white"/> </g> </g> </g>`,
      },
    };
    const POINTS = [
      { x: 23.7, y: 44.0, modal: "zal",           icon: "info",     label: "Зал принятия решений" },
      { x: 42.9, y: 22.3, modal: "game",          icon: "game",     label: "Игра" },
      { x: 52.2, y: 46.0, modal: "zone-panorama", icon: "panorama", label: "Панорама" },
      { x: 54.5, y: 76.3, modal: "game",          icon: "game",     label: "Игра" },
      { x: 68.6, y: 62.1, modal: "zone-panorama", icon: "panorama", label: "Панорама" },
      { x: 82.0, y: 48.9, modal: "zal",           icon: "info",     label: "Зал принятия решений" },
    ];
    // fill="none" обязателен, как в экспорте Figma: у обводочного круга нет своего fill,
    // без этого он заливается дефолтным чёрным и перекрывает глиф
    const svg = (markup, cls) => `<svg class="${cls}" viewBox="0 0 31 31" fill="none" aria-hidden="true">${markup}</svg>`;
    hs.innerHTML = POINTS.map(p => `
      <button class="hotspot" style="left:${p.x}%; top:${p.y}%"
        data-open-modal="${p.modal}" aria-label="${p.label}">${svg(PIN[p.icon].def, "hotspot__def")}${svg(PIN[p.icon].hov, "hotspot__hov")}</button>`).join("");
  }
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
  menu.innerHTML = `<button class="mobile-menu__close" aria-label="Закрыть меню">
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
    </button>` + links + `<button class="btn btn--red-outline" data-open-form>Записаться на экскурсию</button>`;
  const scrim = document.createElement("div");
  scrim.className = "mobile-menu__scrim";
  document.body.append(scrim, menu);

  const burgers = $$("#burger, #burgerHero");
  const close = () => { menu.classList.remove("is-open"); scrim.classList.remove("is-open"); burgers.forEach(b => b.setAttribute("aria-expanded", "false")); };
  const open  = () => { menu.classList.add("is-open"); scrim.classList.add("is-open"); burgers.forEach(b => b.setAttribute("aria-expanded", "true")); };
  burgers.forEach(b => b.addEventListener("click", () => menu.classList.contains("is-open") ? close() : open()));
  scrim.addEventListener("click", close);
  menu.querySelector(".mobile-menu__close").addEventListener("click", close);
  menu.querySelectorAll("a").forEach(a => a.addEventListener("click", close));
})();

/* ------------------------------------------------------------------ *
 * 8. Ошибки заполнения полей: подсветка + сообщение под полем
 * ------------------------------------------------------------------ */
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;
const MSG_REQUIRED = "Это поле нужно обязательно заполнить";
const MSG_EMAIL = "Введите корректный email латиницей";

/* Ставит/снимает ошибку у поля. Обёртку .field-wrap создаём при первом обращении,
   чтобы не дублировать её в разметке пяти страниц. */
function setFieldError(input, msg) {
  let wrap = input.parentElement;
  const wrapped = wrap.classList.contains("field-wrap");
  if (!wrapped && !msg) { input.classList.remove("is-invalid"); return; }
  if (!wrapped) {
    wrap = document.createElement("div");
    wrap.className = "field-wrap";
    input.replaceWith(wrap);
    wrap.append(input);
  }
  input.classList.toggle("is-invalid", !!msg);
  let p = $(".field-error", wrap);
  if (!msg) { p?.remove(); return; }
  if (!p) { p = document.createElement("p"); p.className = "field-error"; wrap.append(p); }
  p.textContent = msg;
}

/* Проверяет все .field формы, подсвечивает ошибки, возвращает true если всё верно */
function validateForm(form) {
  let ok = true;
  $$(".field", form).forEach(input => {
    const val = input.value.trim();
    const msg = !val ? MSG_REQUIRED
      : (input.type === "email" && !EMAIL_RE.test(val)) ? MSG_EMAIL : "";
    setFieldError(input, msg);
    if (msg) ok = false;
    if (!input.dataset.errBound) {
      input.dataset.errBound = "1";
      input.addEventListener("input", () => setFieldError(input, ""));
    }
  });
  return ok;
}

/* ------------------------------------------------------------------ *
 * 9. Модалки: открытие/закрытие + блюр страницы
 * ------------------------------------------------------------------ */
const CLOSE_BTN = `<button class="modal__close" aria-label="Закрыть" data-close-form>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>`;
/* Тонкий шеврон вместо ‹ › из шрифта — в стиле обводок assets/icons/arrow-circle.svg */
const chevron = (dir) =>
  `<svg viewBox="0 0 18 18" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${dir < 0 ? "M12 3 5 9l7 6" : "M6 3l7 6-7 6"}"/></svg>`;

const openModal = (m) => { m.classList.add("is-open"); m.setAttribute("aria-hidden", "false"); document.body.classList.add("form-open"); };
const closeAll = () => {
  $$(".modal.is-open").forEach(m => {
    m.classList.remove("is-open"); m.setAttribute("aria-hidden", "true");
    // сброс мультистейт-флоу к первому шагу
    $$(".modal__state", m).forEach((s, i) => { s.hidden = i > 0; });
    $$("form", m).forEach(f => {
      f.reset();
      $$(".field", f).forEach(i => setFieldError(i, ""));
    });
    m.dispatchEvent(new CustomEvent("modal:reset"));
  });
  document.body.classList.remove("form-open");
};

(function modals() {
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

  // Флоу «Запись на лекцию»: валидный сабмит → состояние «Ваша запись принята»
  const lf = $("#lectureForm");
  if (lf) lf.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!validateForm(lf)) return;
    const m = lf.closest(".modal");
    $$(".modal__state", m).forEach(s => { s.hidden = s.dataset.state !== "success"; });
  });
})();

/* ------------------------------------------------------------------ *
 * 10. Рассылка: валидация email → попап «Подписка на новости оформлена»
 * ------------------------------------------------------------------ */
(function subscribeFlow() {
  const forms = $$(".subscribe__form");
  if (!forms.length) return;

  // модалку строим здесь, чтобы не дублировать разметку в пяти html
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.id = "subscribed";
  modal.setAttribute("aria-hidden", "true");
  modal.innerHTML = `
    <div class="modal__backdrop" data-close-form></div>
    <div class="modal__dialog" role="dialog" aria-modal="true" aria-label="Подписка на новости оформлена">
      ${CLOSE_BTN}
      <h2 class="eyebrow modal__title">Подписка на новости оформлена</h2>
      <p class="modal__text">Мы будем присылать новости на почту <span class="js-sub-email"></span></p>
    </div>`;
  document.body.append(modal);
  const mail = $(".js-sub-email", modal);

  forms.forEach(form => form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!validateForm(form)) return;
    mail.textContent = $(".field", form).value.trim();
    form.reset();
    openModal(modal);
  }));
})();

/* ------------------------------------------------------------------ *
 * 11. Флоу «Запись на экскурсию»: дата → время → количество → форма → успех
 * ------------------------------------------------------------------ */
(function excursionFlow() {
  if (!$("[data-open-form]")) return;

  const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
                  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
  const DOW = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  const HOURS = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
  const MAX_GUESTS = 20;

  const modal = document.createElement("div");
  modal.className = "modal";
  modal.id = "excursion";
  modal.setAttribute("aria-hidden", "true");
  modal.innerHTML = `
    <div class="modal__backdrop" data-close-form></div>
    <div class="modal__dialog" role="dialog" aria-modal="true" aria-label="Запись на экскурсию">
      ${CLOSE_BTN}

      <div class="modal__state" data-state="type">
        <h2 class="eyebrow modal__title">Выберите вид экскурсии</h2>
        <div class="types">
          <button type="button" class="type-card" data-type="Образовательная">Образовательная</button>
          <button type="button" class="type-card" data-type="Информационная">Информационная</button>
        </div>
      </div>

      <div class="modal__state" data-state="date" hidden>
        <h2 class="eyebrow modal__title">Выберите дату экскурсии</h2>
        <div class="cal">
          <div class="cal__head">
            <button class="cal__nav" type="button" data-dir="-1" aria-label="Предыдущий месяц">${chevron(-1)}</button>
            <span class="cal__month"></span>
            <button class="cal__nav" type="button" data-dir="1" aria-label="Следующий месяц">${chevron(1)}</button>
          </div>
          <div class="cal__grid"></div>
        </div>
      </div>

      <div class="modal__state" data-state="time" hidden>
        <h2 class="eyebrow modal__title">Выберите время экскурсии</h2>
        <div class="slots"></div>
      </div>

      <div class="modal__state" data-state="count" hidden>
        <h2 class="eyebrow modal__title">Выберите количество экскурсантов</h2>
        <div class="stepper">
          <button class="stepper__btn" type="button" data-step="-1" aria-label="Меньше">${chevron(-1)}</button>
          <span class="stepper__val">1</span>
          <button class="stepper__btn" type="button" data-step="1" aria-label="Больше">${chevron(1)}</button>
        </div>
        <button class="btn btn--red-outline" type="button" data-count-next>Продолжить</button>
      </div>

      <div class="modal__state" data-state="form" hidden>
        <h2 class="eyebrow modal__title">Запись на экскурсию</h2>
        <p class="modal__summary"></p>
        <form class="modal__form" id="excursionForm" novalidate>
          <input class="field" type="text" placeholder="ФИО" aria-label="ФИО" />
          <input class="field" type="email" placeholder="Email" aria-label="Email" />
          <input class="field" type="tel" placeholder="Телефон" aria-label="Телефон" />
          <button class="btn btn--red-outline" type="submit">Записаться</button>
        </form>
      </div>

      <div class="modal__state" data-state="success" hidden>
        <h2 class="eyebrow modal__title">Ваша запись принята</h2>
        <p class="modal__text">Подтверждение записи отправлено на почту</p>
      </div>
    </div>`;
  document.body.append(modal);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  let view = new Date(today.getFullYear(), today.getMonth(), 1);
  const pick = { type: null, date: null, hour: null, count: 1 };

  /* Детерминированный псевдорандом (FNV-1a): занятость одного и того же дня
     и слота не «прыгает» между перерисовками, но выглядит живой */
  const seeded = (...nums) => {
    let h = 2166136261;
    for (const n of nums) h = Math.imul(h ^ n, 16777619);
    return ((h >>> 0) % 1000) / 1000;
  };
  const hourBusy = (d, h) =>
    (+d === +today && h <= new Date().getHours()) ||
    seeded(d.getFullYear(), d.getMonth(), d.getDate(), h) < .35;
  const freeHours = (d) => HOURS.filter(h => !hourBusy(d, h));
  const dayOff = (d) =>
    d < today || seeded(d.getFullYear(), d.getMonth(), d.getDate()) < .25 || !freeHours(d).length;

  const step = (name) => $$(".modal__state", modal).forEach(s => { s.hidden = s.dataset.state !== name; });
  const fmtDate = (d) => d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });

  function renderCal() {
    const y = view.getFullYear(), m = view.getMonth();
    $(".cal__month", modal).textContent = `${MONTHS[m]} ${y}`;
    $("[data-dir='-1']", modal).disabled = y === today.getFullYear() && m === today.getMonth();

    const lead = (new Date(y, m, 1).getDay() + 6) % 7;  // понедельник = 0
    const total = new Date(y, m + 1, 0).getDate();
    const cells = Array.from({ length: lead }, () => `<span class="cal__day cal__day--out"></span>`);
    for (let d = 1; d <= total; d++) {
      const date = new Date(y, m, d);
      const cls = ["cal__day"];
      if ((date.getDay() + 6) % 7 > 4) cls.push("cal__day--weekend");
      if (+date === +today) cls.push("cal__day--today");
      if (pick.date && +date === +pick.date) cls.push("is-selected");
      cells.push(`<button type="button" class="${cls.join(" ")}" data-day="${d}"${dayOff(date) ? " disabled" : ""}>${d}</button>`);
    }
    $(".cal__grid", modal).innerHTML =
      DOW.map((n, i) => `<span class="cal__dow${i > 4 ? " cal__dow--weekend" : ""}">${n}</span>`).join("") +
      cells.join("");
  }

  function renderSlots() {
    $(".slots", modal).innerHTML = HOURS.map(h =>
      `<button type="button" class="slot" data-hour="${h}"${hourBusy(pick.date, h) ? " disabled" : ""}>${h}:00</button>`
    ).join("");
  }

  function renderCount() {
    $(".stepper__val", modal).textContent = pick.count;
    $("[data-step='-1']", modal).disabled = pick.count <= 1;
    $("[data-step='1']", modal).disabled = pick.count >= MAX_GUESTS;
  }

  modal.addEventListener("click", (e) => {
    const type = e.target.closest("[data-type]");
    if (type) { pick.type = type.dataset.type; step("date"); return; }

    const nav = e.target.closest(".cal__nav");
    if (nav) { view.setMonth(view.getMonth() + Number(nav.dataset.dir)); renderCal(); return; }

    const day = e.target.closest(".cal__day[data-day]:not(:disabled)");
    if (day) {
      pick.date = new Date(view.getFullYear(), view.getMonth(), Number(day.dataset.day));
      renderSlots(); step("time"); return;
    }
    const slot = e.target.closest(".slot:not(:disabled)");
    if (slot) { pick.hour = Number(slot.dataset.hour); renderCount(); step("count"); return; }

    const st = e.target.closest("[data-step]");
    if (st) {
      pick.count = Math.min(MAX_GUESTS, Math.max(1, pick.count + Number(st.dataset.step)));
      renderCount(); return;
    }
    if (e.target.closest("[data-count-next]")) {
      // сводка: на шаге формы иначе не видно, что именно выбрано
      $(".modal__summary", modal).textContent =
        `${pick.type} · ${fmtDate(pick.date)} · ${pick.hour}:00 · ${pick.count} чел.`;
      step("form");
    }
  });

  $("#excursionForm", modal).addEventListener("submit", (e) => {
    e.preventDefault();
    if (!validateForm(e.target)) return;
    step("success");
  });

  modal.addEventListener("modal:reset", () => {
    pick.type = null; pick.date = null; pick.hour = null; pick.count = 1;
    view = new Date(today.getFullYear(), today.getMonth(), 1);
    renderCal(); renderCount();
  });

  renderCal(); renderCount();
})();

/* ------------------------------------------------------------------ *
 * 12. Попапы зон панорамы (2-й этаж): Зал / Игра / Панорама
 * ------------------------------------------------------------------ */
(function panoramaPopups() {
  if (!$("#hotspots")) return; // только на главной с панорамой

  const makeModal = (id, inner) => {
    const m = document.createElement("div");
    m.className = "modal";
    m.id = id;
    m.setAttribute("aria-hidden", "true");
    m.innerHTML = `
      <div class="modal__backdrop" data-close-form></div>
      <div class="modal__dialog modal__dialog--wide" role="dialog" aria-modal="true">
        ${CLOSE_BTN}
        ${inner}
      </div>`;
    document.body.append(m);
    return m;
  };

  /* ---- Зал принятия решений: описание + фото + галерея ---- */
  const HALL = [1, 2, 3, 4, 5, 6].map(n => `assets/img/hall-${n}.webp`);
  const HERO = 1; // индекс фото по умолчанию (ракурс как в макете)
  const zal = makeModal("zal", `
    <div class="zal">
      <div class="zal__aside">
        <h2 class="eyebrow modal__title">Зал принятия решений</h2>
        <p class="zal__lead">Многофункциональное пространство, которое переключается между режимами в зависимости от задачи: оперативное управление, публичная презентация или обучение через симуляцию</p>
        <div class="zal__mode">
          <p class="zal__mode-h">Режим «Штаб»</p>
          <p class="zal__mode-t">Дашборды, онлайн-трансляции с объектов, метрики для управленческих решений, аналитика</p>
        </div>
        <div class="zal__mode">
          <p class="zal__mode-h">Режим «Презентация»</p>
          <p class="zal__mode-t">Материалы спикера, инфографика, live-данные со строек, медиаконтент</p>
        </div>
      </div>
      <div class="zal__media">
        <img class="zal__hero" src="${HALL[HERO]}" alt="Зал принятия решений" />
        <div class="zal__thumbs">
          ${HALL.map((src, i) => `<img class="zal__thumb${i === HERO ? " is-active" : ""}" src="${src}" alt="Ракурс ${i + 1}" data-idx="${i}" />`).join("")}
        </div>
      </div>
    </div>`);
  const hero = $(".zal__hero", zal);
  zal.addEventListener("click", (e) => {
    const th = e.target.closest(".zal__thumb");
    if (!th) return;
    hero.src = HALL[+th.dataset.idx];
    $$(".zal__thumb", zal).forEach(t => t.classList.toggle("is-active", t === th));
  });

  /* ---- Панорама: медиа-плейсхолдер (как в макете). id != секции #panorama ---- */
  makeModal("zone-panorama", `
    <h2 class="eyebrow modal__title">Панорама</h2>
    <div class="panorama-pop__media"></div>`);

  /* ---- Игра «Строитель» ---- */
  const game = makeModal("game", `
    <h2 class="eyebrow modal__title">Игра</h2>
    <div class="game">
      <div class="game__stage" id="gameStage">
        <canvas width="960" height="560"></canvas>
        <p class="game__hint">Space / ↑ — прыжок, ↓ — пригнуться</p>
        <div class="game__over">
          <p class="game__over-title">Игра окончена</p>
          <p class="game__over-score"></p>
          <p class="game__over-score">Нажмите «Прыгать», чтобы начать заново</p>
        </div>
      </div>
      <div class="game__controls">
        <button class="btn btn--solid" type="button" data-game="jump">Прыгать</button>
        <button class="btn btn--solid" type="button" data-game="duck">Пригнуться</button>
      </div>
    </div>`);
  setupBuilderGame(game);
})();

/* Мини-игра «Строитель»: раннер в стиле Chrome-дино на canvas.
   Строитель в оранжевой жилете перепрыгивает конусы и строительные ямы,
   пригибается под балками. Детерминированной случайности не нужно — живой геймплей. */
function setupBuilderGame(modal) {
  const stage = $(".game__stage", modal);
  const canvas = $("canvas", modal);
  const ctx = canvas.getContext("2d");
  const scoreEl = $(".game__over-score", modal);
  const W = canvas.width, H = canvas.height;
  const GROUND = H - 70;           // уровень земли (ступни)
  const P_X = 130;                 // фикс. позиция игрока по X

  const player = { w: 40, hStand: 74, hDuck: 40, y: 0, vy: 0, duck: false, onGround: true };
  let obstacles, speed, dist, spawnIn, state, raf = null, legPhase = 0;

  function reset() {
    obstacles = [];
    speed = 6;
    dist = 0;
    spawnIn = 60;
    legPhase = 0;
    player.y = 0; player.vy = 0; player.duck = false; player.onGround = true;
    state = "ready"; // ready → playing → over
    stage.classList.remove("is-over");
    draw();
  }

  function jump() {
    if (state === "over") reset();                 // рестарт после проигрыша
    if (state === "ready" || state === "over") state = "playing";
    if (player.onGround) { player.vy = -15.2; player.onGround = false; }
    start();
  }
  const setDuck = (v) => { player.duck = v && state === "playing"; };
  const start = () => { if (!raf) raf = requestAnimationFrame(loop); };

  function spawn() {
    const r = Math.random();
    if (r < 0.4)      obstacles.push({ type: "cone", w: 30, h: 40, x: W });
    else if (r < 0.72) obstacles.push({ type: "pit",  w: 96, h: 26, x: W });
    else              obstacles.push({ type: "beam", w: 46, h: 26, x: W }); // пригнуться
  }

  function playerBox() {
    const h = player.duck ? player.hDuck : player.hStand;
    return { x: P_X, y: GROUND - h + player.y, w: player.duck ? player.w + 14 : player.w, h };
  }
  function obstacleBox(o) {
    if (o.type === "beam") return { x: o.x, y: GROUND - player.hStand + 4, w: o.w, h: o.h };
    return { x: o.x, y: GROUND - o.h, w: o.w, h: o.h };
  }
  const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  function update() {
    dist += speed;
    speed = 6 + dist / 1400;                 // плавное ускорение
    legPhase += speed * 0.04;

    player.vy += 0.9;                         // гравитация
    player.y += player.vy;
    if (player.y >= 0) { player.y = 0; player.vy = 0; player.onGround = true; }

    if (--spawnIn <= 0) {
      spawn();
      spawnIn = Math.max(58, 150 - speed * 6) + Math.random() * 60;
    }
    obstacles.forEach(o => o.x -= speed);
    obstacles = obstacles.filter(o => o.x + o.w > -20);

    const pb = playerBox();
    for (const o of obstacles) {
      if (hit(pb, obstacleBox(o))) { gameOver(); return; }
    }
  }

  function gameOver() {
    state = "over";
    stage.classList.add("is-over");
    scoreEl.textContent = `Пройдено: ${Math.floor(dist / 10)} м`;
  }

  function draw() {
    // фон: небо + земля стройплощадки
    ctx.fillStyle = "#cfe3ef"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#d9c9a8"; ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = "#c8b48c"; ctx.fillRect(0, GROUND, W, 5);

    obstacles.forEach(o => drawObstacle(o));
    drawPlayer();
  }

  function drawObstacle(o) {
    if (o.type === "cone") {
      const bx = o.x, by = GROUND;
      ctx.fillStyle = "#e8541e";
      ctx.beginPath(); ctx.moveTo(bx + o.w / 2, by - o.h); ctx.lineTo(bx + o.w, by); ctx.lineTo(bx, by); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.fillRect(bx + o.w * 0.2, by - o.h * 0.55, o.w * 0.6, o.h * 0.16);
      ctx.fillStyle = "#e8541e"; ctx.fillRect(bx - 3, by - 4, o.w + 6, 4);
    } else if (o.type === "pit") {
      // строительная яма с трубами
      ctx.fillStyle = "#6b5533"; ctx.fillRect(o.x, GROUND, o.w, 30);
      ctx.fillStyle = "#4a3a22"; ctx.fillRect(o.x, GROUND, o.w, 6);
      ctx.fillStyle = "#9aa3ab";
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.arc(o.x + 20 + i * 28, GROUND + 16, 8, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = "#e8541e"; ctx.lineWidth = 3;
      ctx.strokeRect(o.x - 1, GROUND - o.h, o.w + 2, o.h); // ограждение над ямой
    } else { // beam — балка, под которой нужно пригнуться
      const b = obstacleBox(o);
      ctx.fillStyle = "#f4b400"; ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = "#222"; for (let i = 0; i < b.w; i += 14) ctx.fillRect(b.x + i, b.y, 7, b.h);
      ctx.fillStyle = "#8a8f96"; ctx.fillRect(b.x + b.w / 2 - 3, 0, 6, b.y); // подвес сверху
    }
  }

  function drawPlayer() {
    const h = player.duck ? player.hDuck : player.hStand;
    const x = P_X, top = GROUND - h + player.y, w = player.w;
    const cx = x + w / 2;
    // ноги (шагают)
    ctx.fillStyle = "#37516b";
    const swing = player.onGround ? Math.sin(legPhase) * 6 : 3;
    ctx.fillRect(cx - 12, GROUND + player.y - 16, 9, 16 + swing);
    ctx.fillRect(cx + 3, GROUND + player.y - 16, 9, 16 - swing);
    // тело (оранжевая жилетка)
    const bodyH = h - 34;
    ctx.fillStyle = "#f26a1b"; ctx.fillRect(cx - w / 2, top + 18, w, bodyH);
    ctx.fillStyle = "#fff"; ctx.fillRect(cx - 3, top + 18, 6, bodyH); // светоотражающая полоса
    ctx.fillStyle = "#e0e4e8"; ctx.fillRect(cx - w / 2, top + 20 + bodyH * 0.45, w, 5);
    // руки
    ctx.fillStyle = "#f26a1b"; ctx.fillRect(cx + w / 2 - 2, top + 22, 7, bodyH * 0.6);
    // голова + каска
    ctx.fillStyle = "#e8b58a"; ctx.beginPath(); ctx.arc(cx, top + 10, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#f4c400";
    ctx.beginPath(); ctx.arc(cx, top + 6, 13, Math.PI, 0); ctx.closePath(); ctx.fill();
    ctx.fillRect(cx - 15, top + 5, 30, 4);
  }

  function loop() {
    raf = null;
    if (!modal.classList.contains("is-open")) return; // модалка закрыта — стоп
    if (state === "playing") update();
    draw();
    raf = requestAnimationFrame(loop);               // продолжаем, пока открыто
  }

  // управление
  const onKey = (e) => {
    if (!modal.classList.contains("is-open")) return;
    if (e.code === "Space" || e.code === "ArrowUp") { e.preventDefault(); jump(); }
    else if (e.code === "ArrowDown") { e.preventDefault(); setDuck(true); }
  };
  const onKeyUp = (e) => { if (e.code === "ArrowDown") setDuck(false); };
  document.addEventListener("keydown", onKey);
  document.addEventListener("keyup", onKeyUp);

  const jumpBtn = $('[data-game="jump"]', modal);
  const duckBtn = $('[data-game="duck"]', modal);
  jumpBtn.addEventListener("click", jump);
  duckBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); setDuck(true); });
  ["pointerup", "pointerleave", "pointercancel"].forEach(ev => duckBtn.addEventListener(ev, () => setDuck(false)));

  // старт/сброс по открытию модалки
  const mo = new MutationObserver(() => {
    if (modal.classList.contains("is-open")) { reset(); start(); }
  });
  mo.observe(modal, { attributes: true, attributeFilter: ["class"] });
  modal.addEventListener("modal:reset", reset);

  reset();
}
