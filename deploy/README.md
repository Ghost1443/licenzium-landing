# Размещение на сервере 109.248.175.97

Сайт: https://109-248-175-97.sslip.io/licenzium/

| Что | Где на сервере |
| --- | --- |
| Файлы сайта | `/var/www/licenzium/` |
| Блок nginx | `/etc/nginx/sites-available/projects`, секция «Лицензиум-Консалт» |
| Сервис отправки писем | `/opt/licenzium/mailer.py`, служба `licenzium-mailer` (127.0.0.1:8010) |
| Настройки почты | `/etc/licenzium/mail.env` (доступ только root) |

## Обновить сайт

Из папки проекта:

```bash
tar -czf - index.html assets | ssh root@109.248.175.97 "tar -xzf - -C /var/www/licenzium"
```

## Включить отправку заявок через пароль Mail.ru

Сейчас хостинг закрывает исходящие почтовые порты, и сервис не может достучаться до smtp.mail.ru. Пока это так, формы отправляют заявки через FormSubmit.

1. Попросите поддержку хостинга открыть исходящий порт 465 до smtp.mail.ru. Проверка с сервера:

```bash
ssh root@109.248.175.97 "timeout 6 bash -c '</dev/tcp/94.100.180.160/465' && echo open || echo closed"
```

2. Создайте в Mail.ru пароль для внешнего приложения: Настройки → Безопасность → Пароли для внешних приложений, доступ «Почта (SMTP)».
3. Впишите его на сервере (откроется редактор, заполните строку `MAIL_PASSWORD=`):

```bash
ssh -t root@109.248.175.97 "nano /etc/licenzium/mail.env && systemctl restart licenzium-mailer && curl -s http://127.0.0.1:8010/health"
```

Ответ `"configured"` значит, что пароль на месте.

4. В `index.html` поменяйте адрес отправки и обновите сайт:

```html
<meta name="lead-endpoint" content="api/lead">
```

## Журнал сервиса

```bash
ssh root@109.248.175.97 "journalctl -u licenzium-mailer -n 50"
```
