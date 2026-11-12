// Каталог: фильтр, поиск, сортировка и пересчёт цен в валюту без перезагрузки

import { apiRequest } from "./api.js";
import { bookCardHtml, handleAddToCartClicks, showStatus } from "./common.js";
import { getSelectedCurrency, setupCurrencySelect } from "./currency.js";
import { setFieldError, validateForm } from "./validation.js";

const form = document.getElementById("filter-form");
const genreSelect = document.getElementById("genre");
const sortSelect = document.getElementById("sort");
const catalog = document.getElementById("catalog");
const countElement = document.getElementById("results-count");
const statusElement = document.getElementById("catalog-status");

let books = [];
let currency = getSelectedCurrency();
let rates = null;

const filterRules = {
  "search": (value) => (value.length === 1 ? "Введите хотя бы 2 символа" : ""),
  "min-price": (value) => (value !== "" && Number(value) < 0 ? "Цена не может быть отрицательной" : ""),
  "max-price": (value) => {
    if (value === "") return "";
    if (Number(value) < 0) return "Цена не может быть отрицательной";
    const min = form.querySelector("#min-price").value;
    return min !== "" && Number(value) < Number(min) ? "«До» должно быть не меньше, чем «от»" : "";
  },
};

function booksWord(n) {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "книга";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "книги";
  return "книг";
}

function render() {
  catalog.innerHTML = books.map((book) => bookCardHtml(book, currency, rates)).join("");
  countElement.textContent = `Найдено: ${books.length} ${booksWord(books.length)}`;
  if (!books.length) showStatus(statusElement, "По заданным условиям ничего не нашлось. Измените фильтры.");
}

function buildQuery() {
  const params = new URLSearchParams();
  const data = new FormData(form);
  for (const [key, value] of data) {
    if (String(value).trim() !== "") params.set(key, String(value).trim());
  }
  params.set("sort", sortSelect.value);
  return params;
}

async function loadBooks() {
  const params = buildQuery();
  // Параметры фильтра сохраняются в адресе: ссылкой можно поделиться
  history.replaceState(null, "", `?${params}`);
  showStatus(statusElement, "Загружаем каталог…", "loader");
  try {
    books = await apiRequest(`/api/books?${params}`);
    showStatus(statusElement, "");
    render();
  } catch (error) {
    books = [];
    catalog.innerHTML = "";
    countElement.textContent = "Каталог недоступен";
    showStatus(statusElement, error.message, "status-error");
  }
}

async function loadGenres() {
  try {
    const genres = await apiRequest("/api/genres");
    for (const genre of genres) {
      genreSelect.add(new Option(`${genre.name} (${genre.books_count})`, genre.slug));
    }
  } catch {
    // Если жанры не загрузились, фильтр «Все жанры» продолжает работать
  }
}

function restoreFiltersFromUrl() {
  const params = new URLSearchParams(location.search);
  for (const [key, value] of params) {
    const field = form.elements.namedItem(key);
    if (field) field.value = value;
  }
  if (params.has("sort")) sortSelect.value = params.get("sort");
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (validateForm(form, filterRules)) loadBooks();
});

form.addEventListener("reset", () => {
  Object.keys(filterRules).forEach((id) => setFieldError(form.querySelector(`#${id}`), ""));
  setTimeout(loadBooks); // ждём, пока форма очистит поля
});

genreSelect.addEventListener("change", loadBooks);
sortSelect.addEventListener("change", loadBooks);

setupCurrencySelect(
  document.getElementById("currency"),
  document.getElementById("currency-status"),
  (newRates, code) => {
    rates = newRates;
    currency = code;
    if (books.length) render();
  },
);

handleAddToCartClicks(catalog);
await loadGenres();
restoreFiltersFromUrl();
loadBooks();
