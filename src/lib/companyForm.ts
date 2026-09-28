// Правила окна «Новая компания» — те же, что проверяет сервер
// (udevs-hrms-billing: billing-company.js), с теми же текстами. Здесь они нужны,
// чтобы ошибка была видна под полем сразу, а не после запроса.

// Транслитерация — как у кодов планов в функции (billing-ops.js, slugCode).
const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z", и: "i", й: "y", к: "k",
  л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts",
  ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  ў: "o", қ: "q", ғ: "g", ҳ: "h",
};

/**
 * «Burch development» → «burch-development-admin». Апостроф узбекских слов
 * (Chirog'im, O‘zbek) выбрасываем, а не превращаем в дефис. Пусто — если
 * собрать не из чего.
 */
export function suggestLogin(companyName: string): string {
  const slug = companyName
    .trim()
    .toLowerCase()
    .replace(/['‘’ʻʼ`´]/g, "")
    .replace(/[^\x00-\x7f]/g, (ch) => TRANSLIT[ch] ?? "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  return slug ? `${slug}-admin` : "";
}

// Логин, который auth при входе ищет не среди логинов, а среди почт (ucode
// IsValidEmailNew) или ИНН (одни цифры): создастся, но войти под ним нельзя.
const EMAIL_SHAPE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export function loginProblem(raw: string): string {
  const login = raw.trim().toLowerCase();
  if (login.length < 6) return "Логин — не короче 6 символов";
  if (login.length > 64) return "Логин — не длиннее 64 символов";
  if (/\s/.test(login)) return "В логине не должно быть пробелов";
  if (login.includes("+")) return "В логине не должно быть знака «+»";
  if (/\p{C}/u.test(login)) return "В логине есть непечатаемые символы";
  if (EMAIL_SHAPE.test(login)) return "Логин не может быть email-адресом: система будет искать его среди почт и не пустит";
  if (/^[0-9]+$/.test(login)) return "Логин не может состоять только из цифр";
  return "";
}

export function passwordProblem(password: string): string {
  if (password.length < 8) return "Пароль — не короче 8 символов";
  if (password.length > 128) return "Пароль — не длиннее 128 символов";
  if (/\s/.test(password)) return "В пароле не должно быть пробелов";
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
    return "В пароле должны быть заглавная и строчная латинская буква и цифра";
  }
  return "";
}

export function nameProblem(raw: string): string {
  const name = raw.trim();
  if (name.length < 2) return "Название компании — не короче 2 символов";
  if (name.length > 100) return "Название компании — не длиннее 100 символов";
  return "";
}

// Без похожих друг на друга символов (I/l/1, O/0) и без знаков, которые
// мессенджер превращает в разметку (* _ ~ `): пароль отправляют клиенту текстом.
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnpqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "!#$%&?@";

function pick(source: string): string {
  const [n] = crypto.getRandomValues(new Uint32Array(1));
  return source[n % source.length];
}

/** 12 символов: хотя бы по одной заглавной, строчной, цифре и знаку — как в hrms-admin. */
export function generatePassword(length = 12): string {
  const all = UPPER + LOWER + DIGITS + SYMBOLS;
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < length) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const [n] = crypto.getRandomValues(new Uint32Array(1));
    const j = n % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

/** Текст, который оператор отправляет клиенту. */
export function credentialsText(companyName: string, url: string, login: string, password: string): string {
  return [`Доступ к HRMS для компании «${companyName}»`, `Адрес: ${url}`, `Логин: ${login}`, `Пароль: ${password}`].join("\n");
}
