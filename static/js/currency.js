// Внешний источник данных: ежедневные курсы валют ЦБ РФ (www.cbr-xml-daily.ru)

const RATES_URL = "https://www.cbr-xml-daily.ru/daily_json.js";
const CURRENCY_KEY = "pereplet-currency";

export const CURRENCIES = {
  RUB: { label: "₽ рубли", symbol: "₽" },
  USD: { label: "$ доллары", symbol: "$" },
  EUR: { label: "€ евро", symbol: "€" },
  CNY: { label: "¥ юани", symbol: "¥" },
};

let ratesPromise = null;

// Курс приходит за «Nominal» единиц валюты, поэтому делим Value на Nominal
async function requestRates() {
  const response = await fetch(RATES_URL);
  if (!response.ok) throw new Error(`Сервис курсов ответил кодом ${response.status}`);
  const data = await response.json();
  const rates = { RUB: 1 };
  for (const code of Object.keys(CURRENCIES)) {
    if (code !== "RUB") rates[code] = data.Valute[code].Value / data.Valute[code].Nominal;
  }
  return { date: new Date(data.Date), rates };
}

export function loadRates() {
  if (!ratesPromise) {
    ratesPromise = requestRates().catch((error) => {
      ratesPromise = null; // при следующем вызове попробуем снова
      throw error;
    });
  }
  return ratesPromise;
}

export function getSelectedCurrency() {
  return localStorage.getItem(CURRENCY_KEY) || "RUB";
}

export function setSelectedCurrency(code) {
  localStorage.setItem(CURRENCY_KEY, code);
}

export function formatRub(value) {
  return `${value.toLocaleString("ru-RU")} ₽`;
}

export function convertPrice(rub, code, rates) {
  if (code === "RUB" || !rates) return null;
  const value = rub / rates[code];
  return `≈ ${value.toLocaleString("ru-RU", { maximumFractionDigits: 2, minimumFractionDigits: 2 })} ${CURRENCIES[code].symbol}`;
}

// Подключает выпадающий список валют и строку состояния загрузки курсов.
// onChange(rates, code) вызывается, когда нужно перерисовать цены.
export function setupCurrencySelect(select, statusElement, onChange) {
  for (const [code, { label }] of Object.entries(CURRENCIES)) {
    select.add(new Option(label, code));
  }
  select.value = getSelectedCurrency();

  async function apply() {
    const code = select.value;
    setSelectedCurrency(code);
    if (code === "RUB") {
      statusElement.textContent = "";
      onChange(null, code);
      return;
    }
    statusElement.className = "hint loader";
    statusElement.textContent = "Загружаем курс ЦБ РФ…";
    try {
      const { date, rates } = await loadRates();
      statusElement.className = "hint";
      statusElement.textContent = `Курс ЦБ РФ на ${date.toLocaleDateString("ru-RU")}: 1 ${code} = ${rates[code].toFixed(2)} ₽`;
      onChange(rates, code);
    } catch {
      statusElement.className = "hint status-error";
      statusElement.textContent = "Не удалось получить курсы валют — цены показаны в рублях.";
      onChange(null, "RUB");
    }
  }

  select.addEventListener("change", apply);
  apply();
}
