(() => {
  const tg = window.Telegram?.WebApp;
  const main = document.querySelector("#main");
  const mobileNav = document.querySelector("#mobile-nav");
  const searchForm = document.querySelector("#search-form");
  const searchInput = document.querySelector("#site-search");
  const filterDrawer = document.querySelector("#filter-drawer");
  const filterBackdrop = document.querySelector("#filter-backdrop");
  const lightbox = document.querySelector("#lightbox");
  const lightboxImage = document.querySelector("#lightbox-image");
  const toast = document.querySelector("#toast");
  const INSTAGRAM = "https://www.instagram.com/kuzel.shop/";
  const CART_KEY = "kuzel-cart-v2";
  const FAVORITES_KEY = "kuzel-favorites-v2";

  const state = {
    categories: [],
    products: [],
    cart: loadMap(CART_KEY),
    favorites: new Set(loadArray(FAVORITES_KEY)),
    search: "",
    detailQuantity: 1,
    detailImage: "",
    toastTimer: 0,
    lastRoute: ""
  };

  function loadArray(key) {
    try { const value = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(value) ? value : []; }
    catch (_) { return []; }
  }
  function loadMap(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      return new Map(Array.isArray(value) ? value : []);
    } catch (_) { return new Map(); }
  }
  function saveState() {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify([...state.cart]));
      localStorage.setItem(FAVORITES_KEY, JSON.stringify([...state.favorites]));
    } catch (_) { flash("Браузер не разрешил сохранить корзину на этом устройстве."); }
    updateHeaderCounts();
  }
  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }
  function slug(value) { return String(value || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9а-яё]+/gi, "-").replace(/^-|-$/g, ""); }
  function money(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? new Intl.NumberFormat("ru-RU").format(number) + " ₽" : "Цена по запросу";
  }
  function numericPrice(product) {
    if (Number.isFinite(Number(product.priceValue)) && Number(product.priceValue) > 0) return Number(product.priceValue);
    const parsed = Number(String(product.price || "").replace(/[^0-9.,]/g, "").replace(",", "."));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  function productById(id) { return state.products.find(item => item.id === id); }
  function productHref(product) { return `#/product/${encodeURIComponent(product.id)}`; }
  function flash(message) {
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => { toast.hidden = true; }, 3000);
  }
  function setTitle(title) { document.title = title ? `${title} — KUZEL` : "KUZEL — тувинская одежда в новой форме"; }
  function updateHeaderCounts() {
    const cartCount = [...state.cart.values()].reduce((sum, item) => sum + item.quantity, 0);
    const favoriteCount = state.favorites.size;
    const cartBadge = document.querySelector("#header-cart-count");
    const favoriteBadge = document.querySelector("#favorite-count");
    cartBadge.textContent = String(cartCount);
    cartBadge.hidden = cartCount === 0;
    favoriteBadge.textContent = String(favoriteCount);
    favoriteBadge.hidden = favoriteCount === 0;
  }
  function routeParts() {
    const raw = location.hash.startsWith("#") ? location.hash.slice(1) : "/";
    const queryIndex = raw.indexOf("?");
    let path = (queryIndex < 0 ? raw : raw.slice(0, queryIndex)) || "/";
    const legacyRoutes = { top: "/", catalog: "/catalog", favorites: "/favorites", cart: "/cart", about: "/about", collections: "/collections", shipping: "/shipping", returns: "/returns", profile: "/profile" };
    if (!path.startsWith("/")) path = legacyRoutes[path] || `/${path}`;
    return { path, query: new URLSearchParams(queryIndex < 0 ? "" : raw.slice(queryIndex + 1)) };
  }
  function image(product, className = "", alt = "") {
    if (!product?.image) return `<div class="image-fallback ${className}" role="img" aria-label="${esc(alt || product?.name || "Модель KUZEL")}"></div>`;
    return `<img class="${className}" src="${esc(product.image)}" alt="${esc(alt || product.name)}" loading="lazy" decoding="async">`;
  }
  function productCard(product) {
    const favorite = state.favorites.has(product.id);
    const price = money(numericPrice(product) ?? product.price);
    return `<article class="product-card">
      <a class="product-media" href="${productHref(product)}" aria-label="Открыть ${esc(product.name)}">${image(product)}
        <span class="product-meta-pill">${esc(product.gender || "KUZEL")}</span>
      </a>
      <button class="product-favorite" type="button" data-action="favorite" data-id="${esc(product.id)}" aria-label="${favorite ? "Убрать из избранного" : "Добавить в избранное"}: ${esc(product.name)}" aria-pressed="${favorite}">${favorite ? "♥" : "♡"}</button>
      <div class="product-info">
        <div class="product-meta"><span>${esc(product.type || product.category || "Одежда")}</span><span>${esc(product.color || "")}</span></div>
        <a class="product-name" href="${productHref(product)}">${esc(product.name)}</a>
        <div class="product-bottom"><span class="product-price">${esc(price)}</span><button class="quick-add" type="button" data-action="add" data-id="${esc(product.id)}">В корзину <span aria-hidden="true">+</span></button></div>
      </div>
    </article>`;
  }
  function productGrid(products) {
    if (!products.length) return `<div class="empty-state"><h2>Пока ничего не найдено</h2><p>Попробуйте изменить фильтры или посмотреть весь каталог.</p><button class="button button-secondary" type="button" data-action="reset-filters">Сбросить фильтры</button></div>`;
    return `<div class="product-grid">${products.map(productCard).join("")}</div>`;
  }
  function sectionHead(kicker, title, aside = "") {
    return `<div class="section-head"><div><p class="section-kicker">${esc(kicker)}</p><h2 class="section-title">${esc(title)}</h2></div>${aside ? `<span class="section-aside">${esc(aside)}</span>` : ""}</div>`;
  }
  function renderHome() {
    const featured = [state.products[2], state.products[0], state.products[5], state.products[3]].filter(Boolean);
    const women = state.products.find(item => item.gender === "female") || state.products[0];
    const men = state.products.find(item => item.gender === "male") || state.products[5];
    const dress = state.products.find(item => item.type === "Платье") || women;
    const detail = state.products.find(item => item.id === "woman-embroidered-burgundy") || women;
    const hero = state.products.find(item => item.id === "woman-embroidered-green") || state.products[2] || state.products[0];
    const editorial = state.products.find(item => item.id === "woman-embroidered-burgundy") || women;
    setTitle("");
    return `<section class="hero page-wrap">
      <div class="hero-copy"><p class="eyebrow">KUZEL · ТУВИНСКАЯ ОДЕЖДА</p><h1>Наследие<br><span>в новой форме</span></h1>
        <p class="body-copy">Традиции Тувы. Современный взгляд на национальную одежду.</p>
        <a class="button" href="#/catalog">Смотреть коллекцию <span aria-hidden="true">→</span></a>
      </div>
      <a class="hero-media" href="${hero ? productHref(hero) : "#/catalog"}" aria-label="Открыть модель ${esc(hero?.name || "KUZEL")}">${image(hero, "", hero?.name || "Модель KUZEL")}<span class="hero-caption">Современная национальная одежда</span></a>
    </section>
    <section class="section page-wrap">${sectionHead("Выбор KUZEL", "Новая коллекция", `${state.products.length} моделей`)}${productGrid(featured)}
      <div class="section-cta"><a class="text-link" href="#/catalog">Весь каталог <span aria-hidden="true">→</span></a></div>
    </section>
    <section class="section page-wrap category-section">${sectionHead("Найдите свой образ", "Категории")}
      <div class="category-grid">
        ${categoryCard("Женская одежда", women, "#/catalog?gender=female")}
        ${categoryCard("Мужская одежда", men, "#/catalog?gender=male")}
        ${categoryCard("Национальные модели", hero, "#/collections")}
        ${categoryCard("Аксессуары и детали", detail, INSTAGRAM, true)}
      </div>
    </section>
    <section class="section page-wrap"><div class="editorial">
      <a class="editorial-media" href="${editorial ? productHref(editorial) : "#/about"}" aria-label="История KUZEL">${image(editorial, "", "Тувинская одежда KUZEL")}</a>
      <div class="editorial-copy"><p class="eyebrow">Наследие · культура · современность</p><h2>Корни.<br>Культура.<br>Современность.</h2>
        <p>Мы сохраняем культурное наследие Тувы, переосмысляя традиционные формы и создавая одежду для нового поколения.</p>
        <a class="text-link" href="#/about">Наша история <span aria-hidden="true">→</span></a>
      </div>
    </div></section>
    <section class="section page-wrap"><div class="heritage">
      <div class="heritage-intro"><p class="eyebrow">В основе коллекций</p><h2>Внимание<br>к деталям</h2><p class="body-copy">Одежда рассказывает о культуре через крой, фактуру и орнамент. Для нас важно сохранять уважение к традиции и говорить о ней точно.</p><a class="text-link" href="#/about">О бренде <span aria-hidden="true">→</span></a></div>
      <div class="heritage-points">
        <div class="heritage-point"><strong>Орнамент</strong><p>Используем детали, представленные в моделях KUZEL. Значение отдельных узоров уточняйте у команды.</p></div>
        <div class="heritage-point"><strong>Силуэт</strong><p>Современный взгляд на национальную одежду — в пропорциях и характере каждой модели.</p></div>
        <div class="heritage-point"><strong>Фактура</strong><p>Состав ткани и рекомендации по уходу доступны по запросу для конкретного изделия.</p></div>
        <div class="heritage-point"><strong>Изготовление</strong><p>Подробности производства и наличие ручной работы уточняйте у команды KUZEL.</p></div>
      </div>
    </div></section>
    <section class="page-wrap"><div class="newsletter"><div><h2>Открывайте KUZEL</h2><p>Новые модели и новости бренда.</p></div><div class="newsletter-actions"><form class="newsletter-form" id="newsletter-form"><label class="sr-only" for="newsletter-email">Электронная почта</label><input id="newsletter-email" name="email" type="email" required maxlength="140" autocomplete="email" placeholder="Ваш e-mail"><button class="button" type="submit">Подписаться</button></form><p class="newsletter-note" id="newsletter-note">E-mail-рассылка пока не подключена. Сейчас новости — в <a href="${INSTAGRAM}" target="_blank" rel="noreferrer">Instagram KUZEL ↗</a>.</p></div></div></section>`;
  }
  function categoryCard(title, product, href, external = false) {
    return `<a class="category-card" href="${href}" ${external ? 'target="_blank" rel="noreferrer"' : ""}>${image(product, "", title)}<span>${esc(title)} <b aria-hidden="true">→</b></span></a>`;
  }
  function filterForm(query, drawer = false) {
    const types = unique(state.products.map(item => item.type).filter(Boolean));
    const genders = [{ value: "female", title: "Женская" }, { value: "male", title: "Мужская" }].filter(option => state.products.some(item => item.gender === option.value));
    const colors = unique(state.products.map(item => item.color).filter(Boolean));
    const sizes = unique(state.products.flatMap(item => Array.isArray(item.sizes) ? item.sizes : []));
    const collections = unique(state.products.map(item => item.collection).filter(Boolean));
    const hasPrice = state.products.some(item => numericPrice(item) !== null);
    const selected = key => esc(query.get(key) || "");
    return `${drawer ? `<div class="mobile-filter-actions"><strong>Фильтры</strong><button class="drawer-close" type="button" data-action="filter-close">Закрыть ×</button></div>` : ""}
      <div class="filter-heading">Подбор <button class="filter-reset" type="button" data-action="reset-filters">Сбросить</button></div>
      <div class="filter-group"><label for="filter-type-${drawer ? "m" : "d"}">Категория</label><select class="filter-select" id="filter-type-${drawer ? "m" : "d"}" data-filter="type"><option value="">Все категории</option>${types.map(value => `<option value="${esc(value)}" ${selected("type") === esc(value) ? "selected" : ""}>${esc(value)}</option>`).join("")}</select></div>
      <div class="filter-group"><label for="filter-gender-${drawer ? "m" : "d"}">Пол</label><select class="filter-select" id="filter-gender-${drawer ? "m" : "d"}" data-filter="gender"><option value="">Все модели</option>${genders.map(value => `<option value="${value.value}" ${selected("gender") === value.value ? "selected" : ""}>${value.title}</option>`).join("")}</select></div>
      <div class="filter-group"><label for="filter-size-${drawer ? "m" : "d"}">Размер</label><select class="filter-select" id="filter-size-${drawer ? "m" : "d"}" data-filter="size" ${sizes.length ? "" : "disabled"}><option value="">${sizes.length ? "Все размеры" : "Уточняется"}</option>${sizes.map(value => `<option value="${esc(value)}" ${selected("size") === esc(value) ? "selected" : ""}>${esc(value)}</option>`).join("")}</select>${sizes.length ? "" : `<p class="filter-help">Размеры уточняйте у менеджера.</p>`}</div>
      <div class="filter-group"><label for="filter-color-${drawer ? "m" : "d"}">Цвет</label><select class="filter-select" id="filter-color-${drawer ? "m" : "d"}" data-filter="color"><option value="">Все цвета</option>${colors.map(value => `<option value="${esc(value)}" ${selected("color") === esc(value) ? "selected" : ""}>${esc(value)}</option>`).join("")}</select></div>
      <div class="filter-group"><label>Цена</label><div class="filter-price-range"><input class="filter-select" type="number" placeholder="От" aria-label="Цена от" data-filter="minPrice" ${hasPrice ? "" : "disabled"}><input class="filter-select" type="number" placeholder="До" aria-label="Цена до" data-filter="maxPrice" ${hasPrice ? "" : "disabled"}></div>${hasPrice ? "" : `<p class="filter-help">Все цены уточняются у менеджера.</p>`}</div>
      <div class="filter-group"><label for="filter-collection-${drawer ? "m" : "d"}">Коллекция</label><select class="filter-select" id="filter-collection-${drawer ? "m" : "d"}" data-filter="collection" ${collections.length ? "" : "disabled"}><option value="">${collections.length ? "Все коллекции" : "Уточняется"}</option>${collections.map(value => `<option value="${esc(value)}" ${selected("collection") === esc(value) ? "selected" : ""}>${esc(value)}</option>`).join("")}</select></div>`;
  }
  function unique(values) { return [...new Set(values.map(value => String(value)))].sort((a, b) => a.localeCompare(b, "ru")); }
  function filteredProducts(query) {
    let items = state.products.filter(product => {
      const text = `${product.name} ${product.description || ""} ${product.type || ""} ${product.color || ""}`.toLocaleLowerCase("ru");
      const price = numericPrice(product);
      return (!query.get("q") || text.includes(query.get("q").toLocaleLowerCase("ru"))) &&
        (!query.get("gender") || product.gender === query.get("gender")) &&
        (!query.get("type") || product.type === query.get("type")) &&
        (!query.get("color") || product.color === query.get("color")) &&
        (!query.get("size") || (product.sizes || []).includes(query.get("size"))) &&
        (!query.get("collection") || product.collection === query.get("collection")) &&
        (!query.get("minPrice") || (price !== null && price >= Number(query.get("minPrice")))) &&
        (!query.get("maxPrice") || (price !== null && price <= Number(query.get("maxPrice"))));
    });
    const sort = query.get("sort") || "featured";
    if (sort === "name") items.sort((a, b) => a.name.localeCompare(b.name, "ru"));
    if (sort === "price-asc") items.sort((a, b) => (numericPrice(a) ?? Infinity) - (numericPrice(b) ?? Infinity));
    if (sort === "price-desc") items.sort((a, b) => (numericPrice(b) ?? -Infinity) - (numericPrice(a) ?? -Infinity));
    return items;
  }
  function renderCatalog(query) {
    setTitle("Каталог");
    const items = filteredProducts(query);
    const genderLabel = query.get("gender") === "female" ? "Женская одежда" : query.get("gender") === "male" ? "Мужская одежда" : "Коллекция KUZEL";
    const hasPrices = state.products.some(item => numericPrice(item) !== null);
    const controls = filterForm(query);
    filterDrawer.innerHTML = `<div class="catalog-filters drawer-content">${filterForm(query, true)}</div>`;
    filterDrawer.setAttribute("aria-hidden", "true");
    return `<div class="page-wrap"><div class="page-heading"><p class="eyebrow">Каталог KUZEL</p><h1>${esc(genderLabel)}</h1><p class="body-copy">Одежда, в которой культурное наследие Тувы встречается с современным силуэтом.</p></div>
      <div class="catalog-toolbar"><div class="catalog-toolbar-left"><button class="filter-toggle" type="button" data-action="filter-open">Фильтры <span aria-hidden="true">＋</span></button><span class="catalog-count">${items.length} ${plural(items.length)}${query.get("q") ? ` · поиск: «${esc(query.get("q"))}»` : ""}</span></div>
      <div class="catalog-toolbar-right"><label class="sort-label" for="sort-select">Сортировка</label><select class="sort-select" id="sort-select" data-filter="sort"><option value="featured" ${query.get("sort") === "featured" || !query.get("sort") ? "selected" : ""}>Рекомендуем</option><option value="name" ${query.get("sort") === "name" ? "selected" : ""}>По названию</option><option value="price-asc" ${query.get("sort") === "price-asc" ? "selected" : ""} ${hasPrices ? "" : "disabled"}>Сначала дешевле</option><option value="price-desc" ${query.get("sort") === "price-desc" ? "selected" : ""} ${hasPrices ? "" : "disabled"}>Сначала дороже</option></select></div></div>
      <div class="catalog-layout"><aside class="catalog-filters">${controls}</aside><div class="catalog-results">${productGrid(items)}</div></div></div>`;
  }
  function plural(count) { return count === 1 ? "модель" : count > 1 && count < 5 ? "модели" : "моделей"; }
  function renderCollections() {
    setTitle("Коллекция");
    const women = state.products.filter(item => item.gender === "female");
    const men = state.products.filter(item => item.gender === "male");
    return `<div class="page-wrap"><div class="page-heading"><p class="eyebrow">KUZEL</p><h1>Коллекция</h1><p class="body-copy">Современная национальная одежда для разных образов.</p></div>
      <section class="section collection-group">${sectionHead("01 / Женская линия", "Женская одежда", `${women.length} моделей`)}${productGrid(women)}</section>
      <section class="section collection-group">${sectionHead("02 / Мужская линия", "Мужская одежда", `${men.length} моделей`)}${productGrid(men)}</section></div>`;
  }
  function renderAbout() {
    const editorial = state.products.find(item => item.id === "woman-embroidered-burgundy") || state.products[0];
    setTitle("О бренде");
    return `<div class="page-wrap"><div class="page-heading"><p class="eyebrow">О KUZEL</p><h1>Культура<br>в новой форме</h1><p class="body-copy">Современная тувинская национальная одежда, вдохновлённая наследием республики и взглядом нового поколения.</p></div>
      <div class="about-hero editorial"><div class="editorial-media">${image(editorial, "", "Модель в одежде KUZEL")}</div><div class="editorial-copy"><p class="eyebrow">Корни · культура · современность</p><h2>Одежда как продолжение истории</h2><p>Мы сохраняем культурное наследие Тувы, переосмысляя традиционные формы и создавая одежду для нового поколения.</p><a class="button" href="#/catalog">Смотреть модели <span aria-hidden="true">→</span></a></div></div>
      <section class="section"><div class="heritage"><div class="heritage-intro"><p class="eyebrow">Подход KUZEL</p><h2>Внимание к источнику</h2><p class="body-copy">Мы не приписываем орнаментам неподтверждённых значений. Состав ткани, происхождение материалов, уход и особенности изготовления уточняются у команды для каждой модели.</p></div><div class="heritage-points"><div class="heritage-point"><strong>Традиционные формы</strong><p>Обращаемся к национальному силуэту в современной одежде.</p></div><div class="heritage-point"><strong>Орнамент и вышивка</strong><p>Рассматриваем детали так, как они представлены на конкретной вещи.</p></div><div class="heritage-point"><strong>Материалы</strong><p>Состав и рекомендации по уходу сообщит менеджер.</p></div><div class="heritage-point"><strong>Изготовление</strong><p>Подробности производства подтверждаются отдельно для каждой модели.</p></div></div></div></section>
    </div>`;
  }
  function renderProduct(id) {
    const product = productById(decodeURIComponent(id));
    if (!product) return renderNotFound();
    setTitle(product.name);
    const gallery = Array.isArray(product.gallery) && product.gallery.length ? product.gallery : [product.image].filter(Boolean);
    const selectedImage = state.detailImage && gallery.includes(state.detailImage) ? state.detailImage : gallery[0];
    const related = state.products.filter(item => item.id !== product.id && item.gender === product.gender).slice(0, 4);
    const sizeOptions = Array.isArray(product.sizes) ? product.sizes : [];
    return `<div class="page-wrap"><nav class="breadcrumbs" aria-label="Хлебные крошки"><a href="#/">Главная</a><span>／</span><a href="#/catalog">Каталог</a><span>／</span><span>${esc(product.name)}</span></nav>
      <section class="product-detail"><div><button class="detail-image" type="button" data-action="zoom" data-id="${esc(product.id)}" data-image="${esc(selectedImage || "")}" aria-label="Увеличить фото товара">${image({ ...product, image: selectedImage }, "", product.name)}<span class="zoom-hint">Увеличить фото</span></button>
        ${gallery.length > 1 ? `<div class="detail-thumbnails">${gallery.map(src => `<button class="detail-thumbnail" type="button" data-action="image-select" data-id="${esc(product.id)}" data-image="${esc(src)}" aria-label="Показать другое фото">${image({ image: src, name: product.name }, "", product.name)}</button>`).join("")}</div>` : ""}
      </div><div class="detail-copy"><p class="eyebrow">${esc(product.category || "Коллекция KUZEL")}</p><h1>${esc(product.name)}</h1><p class="detail-price">${esc(money(numericPrice(product) ?? product.price))}</p>
        <p class="detail-description">${esc(product.description || "Подробности о модели уточняйте у менеджера.")}</p>
        <div class="detail-controls"><label for="detail-size">Размер ${sizeOptions.length ? "" : "· уточнить"}<select class="field-select" id="detail-size"><option value="Уточнить размер">${sizeOptions.length ? "Выберите размер" : "Подобрать с менеджером"}</option>${sizeOptions.map(size => `<option value="${esc(size)}">${esc(size)}</option>`).join("")}</select></label>
          <div><span class="field-label">Количество</span><div class="quantity"><button type="button" data-action="detail-qty" data-delta="-1" aria-label="Уменьшить количество">−</button><span id="detail-quantity">${state.detailQuantity}</span><button type="button" data-action="detail-qty" data-delta="1" aria-label="Увеличить количество">+</button></div></div>
          <div class="detail-actions"><button class="button" type="button" data-action="add-detail" data-id="${esc(product.id)}">Добавить в корзину</button><button class="favorite-large" type="button" data-action="favorite" data-id="${esc(product.id)}" aria-label="${state.favorites.has(product.id) ? "Убрать из избранного" : "Добавить в избранное"}" aria-pressed="${state.favorites.has(product.id)}">${state.favorites.has(product.id) ? "♥" : "♡"}</button></div>
        </div>
        <div class="detail-meta"><details open><summary>Описание и характеристики</summary><p>Цвет: ${esc(product.color || "уточните у менеджера")}<br>Состав, детали изготовления и наличие: уточняйте у менеджера.</p></details><details><summary>Размер и посадка</summary><p>${sizeOptions.length ? `Доступные размеры: ${sizeOptions.map(esc).join(", ")}.` : "Таблица размеров и помощь с подбором доступны у менеджера."}</p></details><details><summary>Уход и доставка</summary><p>Рекомендации по уходу, условия доставки и возврата уточняйте перед оформлением заказа.</p></details></div>
      </div></section>
      ${related.length ? `<section class="section">${sectionHead("В том же направлении", "Похожие модели")}${productGrid(related)}</section>` : ""}</div>`;
  }
  function cartRows() {
    return [...state.cart.entries()].map(([key, item]) => {
      const product = productById(item.id);
      if (!product) return "";
      const price = numericPrice(product);
      return `<article class="cart-row"><a href="${productHref(product)}">${image(product, "", product.name)}</a><div><h3><a href="${productHref(product)}">${esc(product.name)}</a></h3><p>Размер: ${esc(item.size || "уточнить")}<br>${esc(money(price ?? product.price))}</p><button class="cart-remove" type="button" data-action="remove" data-key="${esc(key)}">Удалить</button></div><div class="quantity"><button type="button" data-action="cart-qty" data-key="${esc(key)}" data-delta="-1" aria-label="Уменьшить количество">−</button><span>${item.quantity}</span><button type="button" data-action="cart-qty" data-key="${esc(key)}" data-delta="1" aria-label="Увеличить количество">+</button></div></article>`;
    }).join("");
  }
  function cartTotals() {
    const rows = [...state.cart.values()];
    const count = rows.reduce((sum, row) => sum + row.quantity, 0);
    const total = rows.reduce((sum, row) => {
      const product = productById(row.id);
      return sum + (product && numericPrice(product) ? numericPrice(product) * row.quantity : 0);
    }, 0);
    const allPriced = rows.length > 0 && rows.every(row => numericPrice(productById(row.id) || {}) !== null);
    return { count, total, totalText: allPriced ? money(total) : "Уточнит менеджер" };
  }
  function summaryCard(checkout = false) {
    const totals = cartTotals();
    return `<aside class="cart-summary"><h2>${checkout ? "Ваш заказ" : "Итого"}</h2><div class="summary-line"><span>Товаров</span><span>${totals.count}</span></div><div class="summary-line summary-total"><span>Сумма</span><span>${esc(totals.totalText)}</span></div><p class="form-note">Оплата не списывается. Наличие, доставку и окончательную стоимость подтвердит менеджер.</p><a class="button" href="${checkout ? "https://www.instagram.com/kuzel.shop/" : "#/checkout"}" ${checkout ? `target="_blank" rel="noreferrer"` : ""} ${totals.count ? "" : "aria-disabled=\"true\""}>${checkout ? "Связаться с менеджером" : "Оформить заказ"}</a></aside>`;
  }
  function renderCart() {
    setTitle("Корзина");
    const hasItems = state.cart.size > 0;
    return `<div class="page-wrap cart-page"><div class="page-heading"><p class="eyebrow">KUZEL</p><h1>Корзина</h1></div>${hasItems ? `<div class="cart-layout"><div class="cart-items">${cartRows()}</div>${summaryCard()}</div>` : `<div class="empty-state"><h2>Корзина пока пуста</h2><p>Посмотрите коллекцию KUZEL и добавьте подходящую модель.</p><a class="button" href="#/catalog">Открыть каталог</a></div>`}</div>`;
  }
  function renderCheckout() {
    setTitle("Оформление заказа");
    if (!state.cart.size) return `<div class="page-wrap checkout-page"><div class="page-heading"><p class="eyebrow">KUZEL</p><h1>Оформление</h1></div><div class="empty-state"><h2>Корзина пока пуста</h2><p>Добавьте модель из каталога, чтобы продолжить.</p><a class="button" href="#/catalog">Открыть каталог</a></div></div>`;
    const lines = [...state.cart.values()].map(item => {
      const product = productById(item.id);
      return product ? `<div class="summary-line"><span>${esc(product.name)} × ${item.quantity}<small class="checkout-size">Размер: ${esc(item.size || "уточнить")}</small></span><span>${esc(money(numericPrice(product) === null ? product.price : numericPrice(product) * item.quantity))}</span></div>` : "";
    }).join("");
    return `<div class="page-wrap checkout-page"><div class="page-heading"><p class="eyebrow">Последний шаг</p><h1>Оформление заказа</h1><p class="body-copy">Менеджер подтвердит наличие, стоимость и доставку. Оплата на сайте не проводится.</p></div>
      <form class="checkout-grid" id="checkout-form"><div><section class="form-section"><h2>Контактные данные</h2><div class="form-fields"><div class="field"><label for="customer-name">Имя *</label><input class="field-input" id="customer-name" name="name" required maxlength="100" autocomplete="name"></div><div class="field"><label for="customer-phone">Телефон *</label><input class="field-input" id="customer-phone" name="phone" type="tel" required maxlength="80" autocomplete="tel" placeholder="+7 900 000-00-00"></div><div class="field field-full"><label for="customer-email">Электронная почта</label><input class="field-input" id="customer-email" name="email" type="email" maxlength="140" autocomplete="email"></div></div></section>
      <section class="form-section"><h2>Доставка</h2><div class="form-fields"><div class="field"><label for="customer-city">Город *</label><input class="field-input" id="customer-city" name="city" required maxlength="120" autocomplete="address-level2"></div><div class="field"><label for="delivery-method">Способ доставки *</label><select class="field-select" id="delivery-method" name="delivery" required><option value="" selected disabled>Выберите</option><option value="Доставка — согласовать с менеджером">Доставка — согласовать с менеджером</option><option value="Другой вариант — согласовать с менеджером">Другой вариант — согласовать с менеджером</option></select></div><div class="field field-full"><label for="customer-address">Адрес доставки *</label><input class="field-input" id="customer-address" name="address" required maxlength="240" autocomplete="street-address" placeholder="Уточним детали с менеджером"></div><div class="field field-full"><label for="customer-comment">Комментарий к заказу</label><textarea class="field-textarea" id="customer-comment" name="comment" maxlength="500" placeholder="Пожелания и вопросы по заказу"></textarea></div></div></section><p class="form-note">Отправляя заказ, вы передаёте эти данные боту KUZEL в Telegram для связи по заказу. Для оформления через сайт нужен подключённый backend.</p></div>
      <aside class="cart-summary"><h2>Ваш заказ</h2>${lines}<div class="summary-line summary-total"><span>Итого</span><span>${esc(cartTotals().totalText)}</span></div><p class="form-note">Итоговую сумму и условия доставки подтвердит менеджер. Платёжные данные не запрашиваются.</p><button class="button" type="submit">Отправить в Telegram</button></aside></form></div>`;
  }
  function renderFavorites() {
    setTitle("Избранное");
    const items = state.products.filter(product => state.favorites.has(product.id));
    return `<div class="page-wrap"><div class="page-heading"><p class="eyebrow">Ваш выбор</p><h1>Избранное</h1></div>${items.length ? productGrid(items) : `<div class="empty-state"><h2>Здесь пока пусто</h2><p>Сохраняйте понравившиеся модели, нажимая на сердечко в каталоге.</p><a class="button" href="#/catalog">Перейти в каталог</a></div>`}</div>`;
  }
  function renderProfile() {
    setTitle("Профиль");
    const user = tg?.initDataUnsafe?.user;
    return `<div class="page-wrap"><div class="page-heading"><p class="eyebrow">Личный кабинет</p><h1>Профиль</h1></div><section class="profile-card">${user ? `<h2>Здравствуйте, ${esc(user.first_name || "покупатель")}.</h2><p class="body-copy">Профиль доступен в Telegram Mini App.</p><div class="profile-details"><div>Имя <span>${esc(user.first_name || "—")}</span></div><div>Telegram <span>${user.username ? `@${esc(user.username)}` : "не указан"}</span></div></div><p class="form-note">История заказов появится после подключения личного кабинета к системе магазина.</p>` : `<h2>Профиль KUZEL</h2><p class="body-copy">Откройте магазин через Telegram, чтобы передать заказ боту и связать его с вашим аккаунтом.</p><a class="button" href="${INSTAGRAM}" target="_blank" rel="noreferrer">Написать в Instagram ↗</a>`}</section></div>`;
  }
  function renderInfo(path) {
    const isReturns = path === "/returns";
    setTitle(isReturns ? "Возврат" : "Доставка и оплата");
    const title = isReturns ? "Возврат и обмен" : "Доставка и оплата";
    return `<div class="page-wrap"><div class="page-heading"><p class="eyebrow">Информация для покупателей</p><h1>${title}</h1></div><section class="info-panel"><h2>Уточните условия у менеджера</h2><p>${isReturns ? "Условия возврата и обмена зависят от изделия. Перед заказом уточните сроки и порядок у менеджера KUZEL." : "Города, сроки и стоимость доставки, а также доступные способы оплаты подтвердит менеджер перед оформлением заказа."}</p><a class="button button-secondary" href="${INSTAGRAM}" target="_blank" rel="noreferrer">Связаться в Instagram ↗</a></section><section class="section"><h2 class="section-title">Частые вопросы</h2><div class="detail-meta"><details><summary>Как узнать размер?</summary><p>Напишите менеджеру — доступные размеры уточняются для каждой модели.</p></details><details><summary>Как узнать итоговую цену?</summary><p>Цена отображается как «по запросу». Менеджер подтвердит стоимость до оформления.</p></details><details><summary>Как оплатить заказ?</summary><p>Онлайн-оплата не подключена. Способ оплаты согласовывается с менеджером.</p></details></div></section></div>`;
  }
  function renderNotFound() {
    setTitle("Страница не найдена");
    return `<div class="page-wrap"><div class="empty-state"><h2>Такой страницы нет</h2><p>Вернитесь на главную или откройте каталог.</p><a class="button" href="#/">На главную</a></div></div>`;
  }
  function render() {
    const { path, query } = routeParts();
    if (path !== state.lastRoute) { state.detailQuantity = 1; state.detailImage = ""; state.lastRoute = path; }
    if (path === "/" || path === "") main.innerHTML = renderHome();
    else if (path === "/catalog") main.innerHTML = renderCatalog(query);
    else if (path === "/collections") main.innerHTML = renderCollections();
    else if (path === "/about") main.innerHTML = renderAbout();
    else if (path.startsWith("/product/")) main.innerHTML = renderProduct(path.slice("/product/".length));
    else if (path === "/cart") main.innerHTML = renderCart();
    else if (path === "/checkout") main.innerHTML = renderCheckout();
    else if (path === "/favorites") main.innerHTML = renderFavorites();
    else if (path === "/profile") main.innerHTML = renderProfile();
    else if (path === "/shipping" || path === "/returns") main.innerHTML = renderInfo(path);
    else main.innerHTML = renderNotFound();
    updateHeaderCounts();
    mobileNav.hidden = true;
    document.querySelector(".menu-toggle").setAttribute("aria-expanded", "false");
    closeFilters();
    window.scrollTo(0, 0);
  }
  function openFilters() {
    filterDrawer.classList.add("open");
    filterBackdrop.hidden = false;
    filterDrawer.setAttribute("aria-hidden", "false");
  }
  function closeFilters() {
    filterDrawer.classList.remove("open");
    filterBackdrop.hidden = true;
    filterDrawer.setAttribute("aria-hidden", "true");
  }
  function addToCart(product, size = "Уточнить размер", quantity = 1) {
    if (!product) return;
    const key = `${product.id}::${size}`;
    const current = state.cart.get(key) || { id: product.id, size, quantity: 0 };
    current.quantity = Math.min(20, current.quantity + quantity);
    state.cart.set(key, current);
    saveState();
    flash("Модель добавлена в корзину.");
  }
  function toggleFavorite(id) {
    if (state.favorites.has(id)) { state.favorites.delete(id); flash("Убрано из избранного."); }
    else { state.favorites.add(id); flash("Добавлено в избранное."); }
    saveState();
    const scrollY = window.scrollY;
    render();
    window.scrollTo(0, scrollY);
  }
  function setFilter(name, value) {
    const { query } = routeParts();
    if (value) query.set(name, value); else query.delete(name);
    const suffix = query.toString();
    location.hash = `#/catalog${suffix ? `?${suffix}` : ""}`;
  }
  function updateOrder(form) {
    const data = new FormData(form);
    const items = [...state.cart.values()].map(item => {
      const product = productById(item.id);
      return product ? { name: product.name, quantity: item.quantity, size: item.size } : null;
    }).filter(Boolean);
    const payload = {
      type: "order",
      items,
      name: String(data.get("name") || "").trim(),
      phone: String(data.get("phone") || "").trim(),
      email: String(data.get("email") || "").trim(),
      city: String(data.get("city") || "").trim(),
      address: String(data.get("address") || "").trim(),
      delivery: String(data.get("delivery") || "").trim(),
      comment: String(data.get("comment") || "").trim()
    };
    if (!items.length) { flash("Добавьте товары в корзину."); return; }
    if (tg?.sendData) {
      tg.sendData(JSON.stringify(payload));
      state.cart.clear();
      saveState();
      flash("Данные заказа переданы боту KUZEL в Telegram.");
      return;
    }
    flash("Заказ не отправлен: откройте Mini App в Telegram или свяжитесь с менеджером в Instagram.");
  }

  document.addEventListener("click", event => {
    const control = event.target.closest("[data-action]");
    if (!control) return;
    const action = control.dataset.action;
    const id = control.dataset.id;
    if (action === "menu-toggle") {
      mobileNav.hidden = !mobileNav.hidden;
      control.setAttribute("aria-expanded", String(!mobileNav.hidden));
    } else if (action === "search-toggle") {
      searchForm.classList.toggle("open");
      if (searchForm.classList.contains("open")) searchInput.focus();
    } else if (action === "favorite") toggleFavorite(id);
    else if (action === "add") addToCart(productById(id));
    else if (action === "add-detail") {
      addToCart(productById(id), document.querySelector("#detail-size")?.value || "Уточнить размер", state.detailQuantity);
    } else if (action === "detail-qty") {
      state.detailQuantity = Math.max(1, Math.min(20, state.detailQuantity + Number(control.dataset.delta)));
      document.querySelector("#detail-quantity").textContent = String(state.detailQuantity);
    } else if (action === "cart-qty") {
      const item = state.cart.get(control.dataset.key);
      if (!item) return;
      item.quantity = Math.max(0, Math.min(20, item.quantity + Number(control.dataset.delta)));
      if (!item.quantity) state.cart.delete(control.dataset.key);
      saveState(); render();
    } else if (action === "remove") { state.cart.delete(control.dataset.key); saveState(); render(); }
    else if (action === "reset-filters") { location.hash = "#/catalog"; }
    else if (action === "filter-open") openFilters();
    else if (action === "filter-close") closeFilters();
    else if (action === "zoom") {
      const product = productById(control.dataset.id);
      const src = control.dataset.image || product?.image;
      if (src) { lightboxImage.src = src; lightboxImage.alt = product?.name || "KUZEL"; lightbox.hidden = false; }
    } else if (action === "lightbox-close" || event.target === lightbox) lightbox.hidden = true;
    else if (action === "image-select") { state.detailImage = control.dataset.image; render(); }
  });
  document.addEventListener("change", event => {
    const control = event.target.closest("[data-filter]");
    if (control) setFilter(control.dataset.filter, control.value);
  });
  searchForm.addEventListener("submit", event => {
    event.preventDefault();
    const q = searchInput.value.trim();
    location.hash = `#/catalog${q ? `?q=${encodeURIComponent(q)}` : ""}`;
  });
  document.addEventListener("submit", event => {
    if (event.target.id === "checkout-form") { event.preventDefault(); updateOrder(event.target); }
    if (event.target.id === "newsletter-form") {
      event.preventDefault();
      const endpoint = window.KUZEL_SERVICES?.newsletterEndpoint;
      if (!endpoint) { flash("E-mail-рассылка пока не подключена. Следите за новостями KUZEL в Instagram."); return; }
      const form = event.target;
      const button = form.querySelector("button[type='submit']");
      button.disabled = true;
      fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: String(new FormData(form).get("email") || "").trim() }) })
        .then(response => { if (!response.ok) throw new Error("subscription failed"); document.querySelector("#newsletter-note").textContent = "Спасибо! Подписка оформлена."; form.reset(); })
        .catch(() => flash("Не удалось оформить подписку. Попробуйте позже или следите за новостями в Instagram."))
        .finally(() => { button.disabled = false; });
    }
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") { lightbox.hidden = true; closeFilters(); mobileNav.hidden = true; }
  });
  window.addEventListener("hashchange", render);
  window.addEventListener("storage", event => {
    if (event.key === CART_KEY) state.cart = loadMap(CART_KEY);
    if (event.key === FAVORITES_KEY) state.favorites = new Set(loadArray(FAVORITES_KEY));
    render();
  });

  tg?.ready();
  tg?.expand();
  try { tg?.setHeaderColor("#ffffff"); tg?.setBackgroundColor("#ffffff"); } catch (_) { /* Telegram color API differs between clients. */ }

  fetch("../catalog.json", { cache: "no-store" })
    .then(response => { if (!response.ok) throw new Error("catalog unavailable"); return response.json(); })
    .then(data => {
      state.categories = Array.isArray(data.categories) ? data.categories : [];
      let index = 0;
      state.products = state.categories.flatMap(category => (category.products || []).map(product => ({
        ...product,
        id: product.id || `model-${++index}`,
        category: category.name || "",
        type: product.type || category.name || "Одежда"
      })));
      render();
    })
    .catch(() => {
      main.innerHTML = `<div class="page-wrap"><div class="empty-state"><h2>Каталог временно недоступен</h2><p>Обновите страницу чуть позже или напишите нам в Instagram.</p><a class="button" href="${INSTAGRAM}" target="_blank" rel="noreferrer">Instagram ↗</a></div></div>`;
    });
})();
