// Узнать свой user_id в MAX: напишите боту любое сообщение, затем запустите
//   MAX_TOKEN=ваш_токен node get-user-id.mjs
// Скрипт покажет, кто писал боту в последнее время, и user_id каждого.
const API = (process.env.MAX_API || 'https://platform-api.max.ru').replace(/\/$/, '');
const token = process.env.MAX_TOKEN;
if (!token) {
  console.error('Укажите токен: MAX_TOKEN=... node get-user-id.mjs');
  process.exit(1);
}

const res = await fetch(API + '/updates?limit=100&timeout=0', { headers: { Authorization: token } });
const data = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error('Ошибка API', res.status, data.message || '');
  process.exit(1);
}

const seen = new Map();
for (const u of data.updates || []) {
  const s = (u.message && u.message.sender) || u.user;
  if (s && s.user_id && !seen.has(s.user_id)) seen.set(s.user_id, [s.first_name, s.last_name].filter(Boolean).join(' ') || s.name || '');
}
if (!seen.size) console.log('Сообщений пока нет. Напишите боту в MAX и запустите скрипт ещё раз.');
for (const [id, name] of seen) console.log('user_id: ' + id + '  ' + name);
