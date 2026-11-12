// Контакты: форма обратной связи с проверкой полей

import { apiRequest } from "./api.js";
import { showStatus } from "./common.js";
import { rules, validateForm, validateOnInput } from "./validation.js";

const form = document.getElementById("feedback-form");
const statusElement = document.getElementById("feedback-status");
const message = document.getElementById("fb-message");
const counter = document.getElementById("fb-message-count");

const feedbackRules = {
  "fb-name": rules.name,
  "fb-email": rules.email,
  "fb-topic": (value) => (value ? "" : "Выберите тему обращения"),
  "fb-message": (value) => {
    if (!value) return "Напишите сообщение";
    return value.length < 10 ? `Сообщение слишком короткое: ещё ${10 - value.length} симв.` : "";
  },
  "fb-consent": (checked) => (checked ? "" : "Без согласия мы не сможем ответить на сообщение"),
};

message.addEventListener("input", () => {
  counter.textContent = message.value.length;
});

validateOnInput(form, feedbackRules);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  showStatus(statusElement, "");
  if (!validateForm(form, feedbackRules)) return;

  const data = new FormData(form);
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  showStatus(statusElement, "Отправляем…", "loader");
  try {
    await apiRequest("/api/feedback", {
      method: "POST",
      body: {
        name: data.get("name").trim(),
        email: data.get("email").trim(),
        topic: data.get("topic"),
        message: data.get("message").trim(),
      },
    });
    form.reset();
    counter.textContent = "0";
    showStatus(statusElement, "Спасибо! Сообщение отправлено, мы ответим в течение рабочего дня.", "status-ok");
  } catch (error) {
    showStatus(statusElement, error.message, "status-error");
  } finally {
    button.disabled = false;
  }
});
