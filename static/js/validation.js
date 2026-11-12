// Проверка полей форм до отправки. Сообщение выводится рядом с полем.

export const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/;

export function setFieldError(input, message) {
  const errorElement = document.getElementById(`${input.id}-error`);
  input.setAttribute("aria-invalid", message ? "true" : "false");
  if (errorElement) errorElement.textContent = message;
}

// rules: { idПоля: (значение, поле) => текст ошибки или "" }
export function validateForm(form, rules) {
  let firstInvalid = null;
  for (const [id, check] of Object.entries(rules)) {
    const input = form.querySelector(`#${id}`);
    const value = input.type === "checkbox" ? input.checked : input.value.trim();
    const message = check(value, input);
    setFieldError(input, message);
    if (message && !firstInvalid) firstInvalid = input;
  }
  if (firstInvalid) firstInvalid.focus();
  return !firstInvalid;
}

// Повторная проверка поля, когда пользователь исправляет значение
export function validateOnInput(form, rules) {
  for (const [id, check] of Object.entries(rules)) {
    const input = form.querySelector(`#${id}`);
    const eventName = input.type === "checkbox" || input.tagName === "SELECT" ? "change" : "input";
    input.addEventListener(eventName, () => {
      if (input.getAttribute("aria-invalid") !== "true") return;
      const value = input.type === "checkbox" ? input.checked : input.value.trim();
      setFieldError(input, check(value, input));
    });
  }
}

export const rules = {
  required: (label) => (value) => (value ? "" : `Заполните поле «${label}»`),
  name: (value) => {
    if (!value) return "Укажите имя";
    if (value.length < 2) return "Имя должно содержать не менее 2 символов";
    if (!/^[A-Za-zА-Яа-яЁё\s-]+$/.test(value)) return "Имя может содержать только буквы, пробел и дефис";
    return "";
  },
  email: (value) => {
    if (!value) return "Укажите e-mail";
    return EMAIL_PATTERN.test(value) ? "" : "Проверьте адрес: он должен выглядеть как name@example.ru";
  },
  password: (value) => {
    if (!value) return "Введите пароль";
    if (value.length < 8) return "Пароль должен быть не короче 8 символов";
    if (!/\d/.test(value) || !/[A-Za-zА-Яа-яЁё]/.test(value)) return "Пароль должен содержать буквы и цифры";
    return "";
  },
};
