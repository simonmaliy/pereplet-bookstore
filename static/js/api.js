// Запросы к серверу приложения и хранение токена входа

const TOKEN_KEY = "pereplet-token";
const USER_KEY = "pereplet-user";

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getSavedUser() {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function apiRequest(path, { method = "GET", body, auth = false } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Нет связи с сервером. Проверьте подключение к интернету и обновите страницу.", 0);
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && auth) clearSession();
    const message = data && typeof data.detail === "string" ? data.detail : `Ошибка сервера (${response.status})`;
    throw new ApiError(message, response.status);
  }
  return data;
}
