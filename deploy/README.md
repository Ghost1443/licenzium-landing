# Размещение на сервере 109.248.175.97

Сайт: https://109-248-175-97.sslip.io/licenzium/

| Что | Где на сервере |
| --- | --- |
| Файлы сайта | `/var/www/licenzium/` |
| Блок nginx | `/etc/nginx/sites-available/projects`, секция «Лицензиум-Консалт» |
| Сервис заявок | `/opt/licenzium/mailer.py`, служба `licenzium-mailer` (127.0.0.1:8010) |
| Настройки почты | `/etc/licenzium/mail.env` (доступ только root) |

## Как доставляются заявки

Форма на сайте отправляет заявку на `/licenzium/api/lead`, сервис кладёт её письмом прямо во «Входящие» licenzkonsalt@mail.ru по IMAP (порт 993). Используется пароль для внешнего приложения Mail.ru.

Обычная отправка через SMTP не используется: хостинг закрывает серверу исходящие почтовые порты. Если их откроют, можно переключиться, добавив в `mail.env` строку `DELIVERY=smtp`.

Копия сайта на GitHub Pages сервера не видит и отправляет заявки через FormSubmit (так указано в `index.html` в репозитории).

## Обновить сайт

Из папки проекта. Команда загружает файлы и подставляет адрес отправки для сервера:

```bash
tar -czf - index.html assets | ssh root@109.248.175.97 "tar -xzf - -C /var/www/licenzium && sed -i 's#<meta name=\"lead-endpoint\" content=\"[^\"]*\">#<meta name=\"lead-endpoint\" content=\"api/lead\">#' /var/www/licenzium/index.html"
```

## Обновить сервис заявок

```bash
cat deploy/mailer.py | ssh root@109.248.175.97 "cat > /opt/licenzium/mailer.py && systemctl restart licenzium-mailer"
```

## Сменить пароль Mail.ru

```bash
ssh -t root@109.248.175.97 "nano /etc/licenzium/mail.env && systemctl restart licenzium-mailer && curl -s http://127.0.0.1:8010/health"
```

Ответ `"configured"` значит, что пароль на месте.

## Журнал сервиса

В журнал пишутся только метод, путь и код ответа, без имён и телефонов.

```bash
ssh root@109.248.175.97 "journalctl -u licenzium-mailer -n 50"
```
