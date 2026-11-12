// Главная: подборки по жанру переключаются без перезагрузки страницы

import { apiRequest } from "./api.js";
import { bookCardHtml, handleAddToCartClicks, showStatus } from "./common.js";

const tabs = document.getElementById("genre-tabs");
const picks = document.getElementById("picks");
const statusElement = document.getElementById("picks-status");

async function showPicks(genre) {
  showStatus(statusElement, "Загружаем подборку…", "loader");
  const query = genre ? `genre=${encodeURIComponent(genre)}` : "featured=true";
  try {
    const books = await apiRequest(`/api/books?${query}`);
    picks.innerHTML = books.slice(0, 6).map((book) => bookCardHtml(book)).join("");
    showStatus(statusElement, books.length ? "" : "В этом жанре пока нет книг.");
  } catch (error) {
    picks.innerHTML = "";
    showStatus(statusElement, error.message, "status-error");
  }
}

async function loadGenreTabs() {
  try {
    const genres = await apiRequest("/api/genres");
    for (const genre of genres) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.genre = genre.slug;
      button.setAttribute("aria-pressed", "false");
      button.textContent = genre.name;
      tabs.append(button);
    }
  } catch {
    // Без списка жанров остаётся вкладка «Выбор редакции»
  }
}

tabs.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  tabs.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
  showPicks(button.dataset.genre);
});

handleAddToCartClicks(picks);
loadGenreTabs();
showPicks("");
