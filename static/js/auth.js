// Вход и регистрация

import { apiRequest, saveSession } from "./api.js";
import { showStatus } from "./common.js";
import { rules, validateForm, validateOnInput } from "./validation.js";

const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");

// Переход только на страницу этого же сайта, чтобы ссылка ?next= не уводила на чужой адрес
function redirectAfterLogin() {
  const next = new URLSearchParams(location.search).get("next");
  location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : "account.html";
}

const loginRules = {
  "login-email": rules.email,
  "login-password": (value) => (value ? "" : "Введите пароль"),
};

const registerRules = {
  "reg-name": rules.name,
  "reg-email": rules.email,
  "reg-password": rules.password,
  "reg-password2": (value) => {
    if (!value) return "Повторите пароль";
    return value === registerForm.querySelector("#reg-password").value ? "" : "Пароли не совпадают";
  },
};

validateOnInput(loginForm, loginRules);
validateOnInput(registerForm, registerRules);

async function submit(form, statusElement, path, body) {
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  showStatus(statusElement, "Отправляем…", "loader");
  try {
    const result = await apiRequest(path, { method: "POST", body });
    saveSession(result.token, result.user);
    redirectAfterLogin();
  } catch (error) {
    showStatus(statusElement, error.message, "status-error");
    button.disabled = false;
  }
}

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!validateForm(loginForm, loginRules)) return;
  submit(loginForm, document.getElementById("login-status"), "/api/auth/login", {
    email: loginForm.querySelector("#login-email").value.trim(),
    password: loginForm.querySelector("#login-password").value,
  });
});

registerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!validateForm(registerForm, registerRules)) return;
  submit(registerForm, document.getElementById("register-status"), "/api/auth/register", {
    name: registerForm.querySelector("#reg-name").value.trim(),
    email: registerForm.querySelector("#reg-email").value.trim(),
    password: registerForm.querySelector("#reg-password").value,
  });
});
