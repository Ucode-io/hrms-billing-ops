/**
 * Сумма прописью — в счёте на оплату это обязательная строка, а сервер отдаёт
 * только число. Копеек в сумах нет, поэтому дробную часть не пишем.
 */
const ONES = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const ONES_F = ["", "одна", "две", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const TEENS = [
  "десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать",
  "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать",
];
const TENS = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
const HUNDREDS = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];

const GROUPS: { forms: [string, string, string]; feminine: boolean }[] = [
  { forms: ["", "", ""], feminine: false },
  { forms: ["тысяча", "тысячи", "тысяч"], feminine: true },
  { forms: ["миллион", "миллиона", "миллионов"], feminine: false },
  { forms: ["миллиард", "миллиарда", "миллиардов"], feminine: false },
  { forms: ["триллион", "триллиона", "триллионов"], feminine: false },
];

const pluralForm = (n: number, forms: [string, string, string]): string => {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
};

function triadToWords(value: number, feminine: boolean): string[] {
  const parts: string[] = [];
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  if (hundreds) parts.push(HUNDREDS[hundreds]);
  if (rest >= 10 && rest < 20) {
    parts.push(TEENS[rest - 10]);
  } else {
    const tens = Math.floor(rest / 10);
    const ones = rest % 10;
    if (tens) parts.push(TENS[tens]);
    if (ones) parts.push((feminine ? ONES_F : ONES)[ones]);
  }
  return parts;
}

export function uzsInWords(amount: number): string {
  const value = Math.abs(Math.round(Number(amount) || 0));
  if (value === 0) return "Ноль сум";

  const triads: number[] = [];
  let rest = value;
  while (rest > 0) {
    triads.push(rest % 1000);
    rest = Math.floor(rest / 1000);
  }

  const words: string[] = [];
  for (let index = triads.length - 1; index >= 0; index -= 1) {
    const triad = triads[index];
    if (!triad) continue;
    const group = GROUPS[index] ?? GROUPS[GROUPS.length - 1];
    words.push(...triadToWords(triad, group.feminine));
    if (index > 0) words.push(pluralForm(triad, group.forms));
  }

  const text = `${words.join(" ")} сум`;
  const sign = Number(amount) < 0 ? "Минус " : "";
  return sign + text.charAt(0).toUpperCase() + text.slice(1);
}
