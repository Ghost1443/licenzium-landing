#!/usr/bin/env python3
"""Приём заявок с лендинга и отправка их письмом через SMTP Mail.ru.

Пароль хранится только на сервере, в /etc/licenzium/mail.env (пароль для внешнего приложения Mail.ru).
Сайт шлёт JSON на /licenzium/api/lead, nginx проксирует сюда, на 127.0.0.1:8010/lead.
Ответ в формате FormSubmit ({"success": "true"}), поэтому скрипт сайта не нужно менять.
Только стандартная библиотека Python, ставить ничего не нужно.
"""
import json
import os
import smtplib
import socket
import ssl
import sys
import threading
import time
from email.message import EmailMessage
from email.utils import formataddr, formatdate, make_msgid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

USER = os.environ.get("MAIL_USER", "").strip()
PASSWORD = os.environ.get("MAIL_PASSWORD", "").strip()
TO = os.environ.get("MAIL_TO", "").strip() or USER
SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.mail.ru")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "465"))
LISTEN_PORT = int(os.environ.get("LISTEN_PORT", "8010"))
ORIGINS = {o.strip() for o in os.environ.get("ALLOWED_ORIGIN", "").split(",") if o.strip()}
MAX_BODY = 20000
RATE_LIMIT, RATE_WINDOW = 5, 600  # не больше 5 заявок за 10 минут с одного IP

# У сервера нет IPv6-маршрута наружу: к почтовому серверу подключаемся только по IPv4.
_getaddrinfo = socket.getaddrinfo
def _ipv4_only(host, *args, **kwargs):
    res = _getaddrinfo(host, *args, **kwargs)
    v4 = [r for r in res if r[0] == socket.AF_INET]
    return v4 or res
socket.getaddrinfo = _ipv4_only

_hits = {}
_lock = threading.Lock()


def rate_limited(ip):
    now = time.time()
    with _lock:
        recent = [t for t in _hits.get(ip, []) if now - t < RATE_WINDOW]
        limited = len(recent) >= RATE_LIMIT
        if not limited:
            recent.append(now)
        _hits[ip] = recent
        return limited


def clean(value, limit):
    return str(value).replace("\r", " ").strip()[:limit]


def build_message(data):
    name = clean(data.get("Имя", ""), 100)
    phone = clean(data.get("Телефон", ""), 40)
    digits = "".join(ch for ch in phone if ch.isdigit())
    if not name or not (len(digits) == 10 or (len(digits) == 11 and digits[0] in "78")):
        return None
    subject = clean(data.get("_subject") or "Заявка с сайта", 150).replace("\n", " ")
    lines = []
    for key, value in list(data.items())[:20]:
        key = clean(key, 60).replace("\n", " ")
        if key.startswith("_"):
            continue
        value = clean(value, 4000)
        if key.startswith("Коды ФККО"):
            value = "\n  " + value.replace("; ", "\n  ")
        lines.append(f"{key}: {value}")
    lines.append("")
    lines.append("Время: " + time.strftime("%d.%m.%Y %H:%M", time.localtime()))
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = formataddr(("Сайт Лицензиум-Консалт", USER))
    msg["To"] = TO
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid()
    msg.set_content("\n".join(lines) + "\n")
    return msg


def send(msg):
    ctx = ssl.create_default_context()
    with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=15, context=ctx) as smtp:
        smtp.login(USER, PASSWORD)
        smtp.send_message(msg)


class Handler(BaseHTTPRequestHandler):
    server_version = "licenzium-mailer"

    def reply(self, code, success, message=""):
        body = json.dumps({"success": "true" if success else "false", "message": message}, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            return self.reply(200, bool(USER and PASSWORD), "configured" if USER and PASSWORD else "no password")
        self.reply(404, False, "not found")

    def do_POST(self):
        if self.path != "/lead":
            return self.reply(404, False, "not found")
        origin = self.headers.get("Origin", "")
        if ORIGINS and origin and origin not in ORIGINS:
            return self.reply(403, False, "origin")
        if not (USER and PASSWORD):
            return self.reply(503, False, "mail is not configured")
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_BODY:
            return self.reply(413, False, "size")
        ip = self.headers.get("X-Real-IP") or self.client_address[0]
        if rate_limited(ip):
            return self.reply(429, False, "too many requests")
        try:
            data = json.loads(self.rfile.read(length).decode("utf-8"))
            assert isinstance(data, dict)
        except Exception:
            return self.reply(400, False, "json")
        msg = build_message(data)
        if msg is None:
            return self.reply(422, False, "validation")
        try:
            send(msg)
        except Exception as exc:  # причину пишем в журнал, посетителю отдаём общую ошибку
            print(f"send failed: {type(exc).__name__}: {exc}", file=sys.stderr, flush=True)
            return self.reply(502, False, "send failed")
        self.reply(200, True, "sent")

    def log_message(self, fmt, *args):
        # в журнал попадают только метод, путь и код ответа, без личных данных
        print(f"{self.command} {self.path} -> {args[1] if len(args) > 1 else ''}", file=sys.stderr, flush=True)


if __name__ == "__main__":
    if not (USER and PASSWORD):
        print("MAIL_USER / MAIL_PASSWORD не заданы: заявки будут отклоняться с кодом 503", file=sys.stderr, flush=True)
    ThreadingHTTPServer(("127.0.0.1", LISTEN_PORT), Handler).serve_forever()
