// Общие функции для всех страниц: корзина, шапка, карточка книги

import { getSavedUser } from "./api.js";
import { convertPrice, formatRub } from "./currency.js";

const CART_KEY = "pereplet-cart";

// ---------- Корзина хранится в браузере до оформления заказа ----------

export function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || {};
  } catch {
    return {};
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartCount();
}

export function addToCart(bookId, quantity = 1) {
  const cart = getCart();
  cart[bookId] = (cart[bookId] || 0) + quantity;
  saveCart(cart);
}

export function setCartQuantity(bookId, quantity) {
  const cart = getCart();
  if (quantity > 0) cart[bookId] = quantity;
  else delete cart[bookId];
  saveCart(cart);
}

export function clearCart() {
  saveCart({});
}

export function updateCartCount() {
  const total = Object.values(getCart()).reduce((sum, qty) => sum + qty, 0);
  document.querySelectorAll("[data-cart-count]").forEach((el) => {
    el.textContent = total;
  });
}

// ---------- Шапка: ссылка «Войти» или «Кабинет» ----------

function updateAccountLink() {
  const link = document.querySelector("[data-account-link]");
  if (!link) return;
  const user = getSavedUser();
  link.textContent = user ? "Кабинет" : "Войти";
}

// ---------- Карточка книги ----------

export function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

export function priceHtml(rub, currency, rates) {
  const alt = convertPrice(rub, currency, rates);
  return `${formatRub(rub)}${alt ? `<span class="price-alt">${alt}</span>` : ""}`;
}

export function bookCardHtml(book, currency = "RUB", rates = null) {
  const title = escapeHtml(book.title);
  return `
    <li>
      <article class="book-card">
        <a class="cover-link" href="book.html?id=${book.id}" tabindex="-1" aria-hidden="true">
          <img src="${book.cover}" alt="Обложка книги «${title}»" width="300" height="450" loading="lazy">
        </a>
        <div class="body">
          <span class="genre-label">${escapeHtml(book.genre_name)}</span>
          <h3><a href="book.html?id=${book.id}">${title}</a></h3>
          <p class="author">${escapeHtml(book.author)}, ${book.year}</p>
          <div class="card-footer">
            <span class="price" data-price="${book.price}">${priceHtml(book.price, currency, rates)}</span>
            <button class="btn btn-small" type="button" data-add-to-cart="${book.id}"
              ${book.stock === 0 ? "disabled" : ""}>${book.stock === 0 ? "Нет в наличии" : "В корзину"}</button>
          </div>
        </div>
      </article>
    </li>`;
}

// Одна подписка на весь список: работает и для карточек, добавленных позже
export function handleAddToCartClicks(container) {
  container.addEventListener("click", (event) => {
    const button = event.target.closest("[data-add-to-cart]");
    if (!button) return;
    addToCart(Number(button.dataset.addToCart));
    button.textContent = "Добавлено ✓";
    setTimeout(() => { button.textContent = "В корзину"; }, 1200);
  });
}

export function showStatus(element, message, type = "") {
  element.className = `status ${type}`.trim();
  element.textContent = message;
}

updateCartCount();
updateAccountLink();
