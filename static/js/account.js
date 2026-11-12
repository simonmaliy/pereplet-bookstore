// Личный кабинет: доступен только после входа (сервер проверяет токен)

import { apiRequest, clearSession, getToken } from "./api.js";
import { escapeHtml, showStatus } from "./common.js";
import { formatRub } from "./currency.js";

const statusElement = document.getElementById("account-status");

function goToLogin() {
  location.href = "login.html?next=/account.html";
}

function renderReadingList(books) {
  const list = document.getElementById("reading-list");
  document.getElementById("reading-empty").hidden = books.length > 0;
  list.innerHTML = books.map((book) => `
    <div class="reading-item" data-id="${book.id}">
      <img src="${book.cover}" alt="Обложка книги «${escapeHtml(book.title)}»" width="46" height="69">
      <div class="info">
        <a href="book.html?id=${book.id}">${escapeHtml(book.title)}</a><br>
        <span class="hint">${escapeHtml(book.author)} · ${formatRub(book.price)}</span>
      </div>
      <button class="btn btn-small btn-outline" type="button" data-remove>Убрать</button>
    </div>`).join("");
}

function renderOrders(orders) {
  document.getElementById("orders-empty").hidden = orders.length > 0;
  document.getElementById("orders").innerHTML = orders.map((order) => `
    <article class="order">
      <h3>Заказ № ${order.id} — ${formatRub(order.total)}</h3>
      <p class="hint">${new Date(order.created_at).toLocaleString("ru-RU")} · статус: ${escapeHtml(order.status)}</p>
      <ul>${order.items.map((item) => `<li>${escapeHtml(item.title)} × ${item.quantity}</li>`).join("")}</ul>
    </article>`).join("");
}

document.getElementById("reading-list").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-remove]");
  if (!button) return;
  const item = button.closest(".reading-item");
  try {
    await apiRequest(`/api/reading-list/${item.dataset.id}`, { method: "DELETE", auth: true });
    item.remove();
    document.getElementById("reading-empty").hidden = document.querySelector(".reading-item") !== null;
  } catch (error) {
    showError(error.message);
  }
});

function showError(message) {
  statusElement.hidden = false;
  showStatus(statusElement, message, "status-error");
}

document.getElementById("logout").addEventListener("click", async () => {
  try {
    await apiRequest("/api/auth/logout", { method: "POST", auth: true });
  } finally {
    clearSession();
    location.href = "index.html";
  }
});

async function init() {
  if (!getToken()) {
    goToLogin();
    return;
  }
  try {
    const [user, readingList, orders] = await Promise.all([
      apiRequest("/api/me", { auth: true }),
      apiRequest("/api/reading-list", { auth: true }),
      apiRequest("/api/orders", { auth: true }),
    ]);
    document.getElementById("profile-name").textContent = user.name;
    document.getElementById("profile-email").textContent = user.email;
    document.getElementById("profile-date").textContent = new Date(user.created_at).toLocaleDateString("ru-RU");
    renderReadingList(readingList);
    renderOrders(orders);
    statusElement.hidden = true;
    document.getElementById("account").hidden = false;
  } catch (error) {
    if (error.status === 401) goToLogin();
    else showStatus(statusElement, error.message, "status-error");
  }
}

init();
