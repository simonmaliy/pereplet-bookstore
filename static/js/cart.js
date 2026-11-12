// Корзина: количество меняется без перезагрузки, заказ оформляется на сервере

import { apiRequest, getToken } from "./api.js";
import { clearCart, escapeHtml, getCart, setCartQuantity, showStatus } from "./common.js";
import { formatRub } from "./currency.js";

const FREE_DELIVERY_FROM = 1500;
const DELIVERY_PRICE = 250;

const table = document.getElementById("cart-table");
const body = document.getElementById("cart-body");
const statusElement = document.getElementById("cart-status");
const checkoutButton = document.getElementById("checkout");
const checkoutStatus = document.getElementById("checkout-status");

let books = {};

function rowHtml(book, quantity) {
  const title = escapeHtml(book.title);
  return `
    <tr data-id="${book.id}">
      <td>
        <div class="cart-book">
          <img src="${book.cover}" alt="Обложка книги «${title}»" width="48" height="72">
          <div><a href="book.html?id=${book.id}">${title}</a><br><span class="hint">${escapeHtml(book.author)}</span></div>
        </div>
      </td>
      <td data-label="Цена">${formatRub(book.price)}</td>
      <td data-label="Количество">
        <div class="qty">
          <button type="button" data-step="-1" aria-label="Уменьшить количество «${title}»">−</button>
          <output aria-live="polite">${quantity}</output>
          <button type="button" data-step="1" aria-label="Увеличить количество «${title}»"
            ${quantity >= book.stock ? "disabled" : ""}>+</button>
        </div>
      </td>
      <td data-label="Сумма">${formatRub(book.price * quantity)}</td>
      <td><button class="btn btn-small btn-outline" type="button" data-remove>Удалить</button></td>
    </tr>`;
}

function render() {
  const cart = getCart();
  const ids = Object.keys(cart).filter((id) => books[id]);
  if (!ids.length) {
    table.hidden = true;
    showStatus(statusElement, "Корзина пуста. Добавьте книги из каталога.");
    statusElement.insertAdjacentHTML("beforeend", ' <a href="catalog.html">Перейти в каталог</a>');
  } else {
    table.hidden = false;
    showStatus(statusElement, "");
  }
  body.innerHTML = ids.map((id) => rowHtml(books[id], cart[id])).join("");

  const count = ids.reduce((sum, id) => sum + cart[id], 0);
  const subtotal = ids.reduce((sum, id) => sum + books[id].price * cart[id], 0);
  const delivery = subtotal === 0 || subtotal >= FREE_DELIVERY_FROM ? 0 : DELIVERY_PRICE;
  document.getElementById("summary-count").textContent = count;
  document.getElementById("summary-delivery").textContent = subtotal === 0 ? "—" : delivery ? formatRub(delivery) : "бесплатно";
  document.getElementById("summary-total").textContent = formatRub(subtotal + delivery);
  checkoutButton.disabled = count === 0;
}

body.addEventListener("click", (event) => {
  const row = event.target.closest("tr[data-id]");
  if (!row) return;
  const id = row.dataset.id;
  const quantity = getCart()[id] || 0;
  if (event.target.closest("[data-remove]")) setCartQuantity(id, 0);
  const step = event.target.closest("[data-step]");
  if (step) setCartQuantity(id, Math.min(quantity + Number(step.dataset.step), books[id].stock));
  render();
});

checkoutButton.addEventListener("click", async () => {
  if (!getToken()) {
    showStatus(checkoutStatus, "Чтобы оформить заказ, войдите в учётную запись.", "status-error");
    checkoutStatus.insertAdjacentHTML("beforeend", ' <a href="login.html?next=/cart.html">Войти</a>');
    return;
  }
  const items = Object.entries(getCart()).map(([bookId, quantity]) => ({ book_id: Number(bookId), quantity }));
  checkoutButton.disabled = true;
  showStatus(checkoutStatus, "Оформляем заказ…", "loader");
  try {
    const order = await apiRequest("/api/orders", { method: "POST", body: { items }, auth: true });
    clearCart();
    render();
    showStatus(checkoutStatus, `Заказ № ${order.id} на ${formatRub(order.total)} оформлен.`, "status-ok");
    checkoutStatus.insertAdjacentHTML("beforeend", ' <a href="account.html">Мои заказы</a>');
  } catch (error) {
    checkoutButton.disabled = false;
    showStatus(checkoutStatus, error.message, "status-error");
  }
});

async function init() {
  const ids = Object.keys(getCart());
  if (!ids.length) {
    render();
    return;
  }
  showStatus(statusElement, "Загружаем корзину…", "loader");
  try {
    const list = await apiRequest(`/api/books?ids=${ids.join(",")}`);
    books = Object.fromEntries(list.map((book) => [book.id, book]));
    render();
  } catch (error) {
    showStatus(statusElement, error.message, "status-error");
  }
}

init();
