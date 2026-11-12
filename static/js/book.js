// Страница книги: данные по идентификатору из адреса ?id=…

import { apiRequest, getToken } from "./api.js";
import { addToCart, bookCardHtml, handleAddToCartClicks, priceHtml, showStatus } from "./common.js";
import { setupCurrencySelect } from "./currency.js";

const bookId = Number(new URLSearchParams(location.search).get("id"));
const statusElement = document.getElementById("book-status");
const actionStatus = document.getElementById("action-status");
let book = null;

function fill(id, text) {
  document.getElementById(id).textContent = text;
}

function renderBook() {
  document.title = `${book.title} — «Переплёт»`;
  fill("crumb-title", book.title);
  fill("book-genre", book.genre_name);
  fill("book-title", book.title);
  fill("book-author", book.author);
  fill("book-description", book.description);
  fill("book-year", book.year);
  fill("book-pages", book.pages);
  fill("book-binding", book.binding);
  fill("book-stock", book.stock > 0 ? `в наличии, ${book.stock} шт.` : "нет в наличии");
  const cover = document.getElementById("book-cover");
  cover.src = book.cover;
  cover.alt = `Обложка книги «${book.title}», ${book.author}`;
  document.getElementById("add-to-cart").disabled = book.stock === 0;
  document.getElementById("book").hidden = false;
}

async function loadSimilar() {
  try {
    const books = await apiRequest(`/api/books?genre=${encodeURIComponent(book.genre_slug)}`);
    const others = books.filter((b) => b.id !== book.id).slice(0, 4);
    if (!others.length) return;
    const list = document.getElementById("similar");
    list.innerHTML = others.map((b) => bookCardHtml(b)).join("");
    handleAddToCartClicks(list);
    document.getElementById("similar-section").hidden = false;
  } catch {
    // Блок «Ещё в этом жанре» необязателен — при ошибке просто не показываем его
  }
}

document.getElementById("add-to-cart").addEventListener("click", () => {
  addToCart(book.id);
  showStatus(actionStatus, `«${book.title}» добавлена в корзину.`, "status-ok");
});

document.getElementById("read-later").addEventListener("click", async () => {
  if (!getToken()) {
    location.href = `login.html?next=${encodeURIComponent(location.pathname + location.search)}`;
    return;
  }
  try {
    await apiRequest("/api/reading-list", { method: "POST", body: { book_id: book.id }, auth: true });
    showStatus(actionStatus, "Книга добавлена в список «Прочитать позже».", "status-ok");
  } catch (error) {
    showStatus(actionStatus, error.message, "status-error");
  }
});

async function init() {
  if (!Number.isInteger(bookId) || bookId <= 0) {
    showStatus(statusElement, "Книга не выбрана. Вернитесь в каталог.", "status-error");
    return;
  }
  try {
    book = await apiRequest(`/api/books/${bookId}`);
  } catch (error) {
    showStatus(statusElement, error.message, "status-error");
    return;
  }
  showStatus(statusElement, "");
  renderBook();
  setupCurrencySelect(
    document.getElementById("currency"),
    document.getElementById("currency-status"),
    (rates, code) => {
      document.getElementById("book-price").innerHTML = priceHtml(book.price, code, rates);
    },
  );
  loadSimilar();
}

init();
