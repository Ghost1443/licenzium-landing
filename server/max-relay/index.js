'use strict';
/*
 * Пересылка заявок с лендинга в мессенджер MAX.
 *
 * Работает как Яндекс Cloud Function (Node.js 18+): точка входа index.handler.
 * Токен бота хранится только здесь, в переменных окружения, и никогда не попадает в браузер.
 *
 * Переменные окружения:
 *   MAX_TOKEN       токен бота MAX (обязательно)
 *   MAX_USER_ID     ID пользователя, которому писать (или MAX_CHAT_ID для группового чата)
 *   MAX_CHAT_ID     ID чата, если заявки нужны в группе
 *   ALLOWED_ORIGIN  адрес сайта, например https://ghost1443.github.io (можно несколько через запятую)
 *   MAX_API         адрес API, по умолчанию https://platform-api.max.ru
 */

const API = (process.env.MAX_API || 'https://platform-api.max.ru').replace(/\/$/, '');
const ORIGINS = (process.env.ALLOWED_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);

function cors(origin) {
  const allow = ORIGINS.includes(origin) ? origin : ORIGINS[0] || '';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function reply(statusCode, body, origin) {
  return {
    statusCode,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, cors(origin)),
    body: JSON.stringify(body),
  };
}

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const list = (v, maxItems, maxLen) => (Array.isArray(v) ? v.slice(0, maxItems).map((x) => str(x, maxLen)).filter(Boolean) : []);

/* Проверяем и обрезаем всё, что пришло из браузера: доверять этим данным нельзя. */
function clean(input) {
  const phoneDigits = str(input.phone, 40).replace(/\D/g, '');
  const okPhone = phoneDigits.length === 10 || (phoneDigits.length === 11 && /^[78]/.test(phoneDigits));
  const name = str(input.name, 100);
  if (!name || !okPhone) return null;
  return {
    type: input.type === 'callback' ? 'callback' : 'quiz',
    topic: str(input.topic, 100),
    name,
    phone: str(input.phone, 40),
    task: list(input.task, 4, 120),
    waste: list(input.waste, 10, 120),
    fleet: list(input.fleet, 4, 120),
    ready: list(input.ready, 6, 120),
    codes: (Array.isArray(input.codes) ? input.codes.slice(0, 60) : [])
      .map((c) => ({ code: str(c && c.code, 20), name: str(c && c.name, 200) }))
      .filter((c) => c.code),
    page: str(input.page, 300),
  };
}

function format(d) {
  const when = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
  const lines = [
    d.type === 'callback' ? 'Новая заявка: ' + (d.topic || 'обратный звонок') : 'Новая заявка: расчёт стоимости',
    '',
    'Имя: ' + d.name,
    'Телефон: ' + d.phone,
  ];
  if (d.task.length) lines.push('Задача: ' + d.task.join(', '));
  if (d.waste.length) lines.push('Отходы: ' + d.waste.join(', '));
  if (d.fleet.length) lines.push('Транспорт: ' + d.fleet.join(', '));
  if (d.ready.length) lines.push('Готово: ' + d.ready.join(', '));
  if (d.codes.length) {
    lines.push('', 'Коды ФККО (' + d.codes.length + '):');
    d.codes.forEach((c) => lines.push(c.code + ' ' + c.name));
  }
  lines.push('', 'Время (МСК): ' + when);
  if (d.page) lines.push('Страница: ' + d.page);
  /* Лимит MAX: 4000 символов в сообщении */
  const text = lines.join('\n');
  return text.length > 3990 ? text.slice(0, 3980) + '\n…' : text;
}

async function sendToMax(text) {
  const target = process.env.MAX_CHAT_ID
    ? 'chat_id=' + encodeURIComponent(process.env.MAX_CHAT_ID)
    : 'user_id=' + encodeURIComponent(process.env.MAX_USER_ID || '');
  const res = await fetch(API + '/messages?' + target, {
    method: 'POST',
    headers: { Authorization: process.env.MAX_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, notify: true }),
  });
  const body = await res.json().catch(() => ({}));
  /* MAX иногда отвечает 200 с success: false, поэтому проверяем и код, и тело */
  if (!res.ok || body.success === false) {
    throw new Error('MAX API ' + res.status + ': ' + (body.message || body.code || 'unknown error'));
  }
}

module.exports.handler = async function (event) {
  const headers = event.headers || {};
  const origin = headers.Origin || headers.origin || '';
  const method = event.httpMethod || (event.requestContext && event.requestContext.http && event.requestContext.http.method) || 'POST';

  if (method === 'OPTIONS') return { statusCode: 204, headers: cors(origin), body: '' };
  if (method !== 'POST') return reply(405, { ok: false, error: 'method' }, origin);
  if (ORIGINS.length && !ORIGINS.includes(origin)) return reply(403, { ok: false, error: 'origin' }, origin);
  if (!process.env.MAX_TOKEN || !(process.env.MAX_USER_ID || process.env.MAX_CHAT_ID)) {
    console.error('MAX_TOKEN и MAX_USER_ID (или MAX_CHAT_ID) не заданы');
    return reply(500, { ok: false, error: 'config' }, origin);
  }

  let raw = event.body || '';
  if (event.isBase64Encoded) raw = Buffer.from(raw, 'base64').toString('utf8');
  if (raw.length > 20000) return reply(413, { ok: false, error: 'too_large' }, origin);

  let input;
  try { input = JSON.parse(raw); } catch (e) { return reply(400, { ok: false, error: 'json' }, origin); }
  if (input && input.company_site) return reply(200, { ok: true }, origin); /* скрытое поле: бот, молча игнорируем */

  const data = clean(input || {});
  if (!data) return reply(422, { ok: false, error: 'validation' }, origin);

  try {
    await sendToMax(format(data));
    return reply(200, { ok: true }, origin);
  } catch (err) {
    console.error(err.message);
    return reply(502, { ok: false, error: 'max' }, origin);
  }
};

module.exports._test = { clean, format };
