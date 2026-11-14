"""A small Telegram shop bot using only the Python standard library."""

from __future__ import annotations

import json
import logging
import os
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
CATALOG_PATH = ROOT / "catalog.json"
TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
ADMIN_CHAT_ID = os.getenv("ADMIN_CHAT_ID", "").strip()
STORE_NAME = os.getenv("STORE_NAME", "Kuzel").strip()
INSTAGRAM_URL = os.getenv("INSTAGRAM_URL", "https://www.instagram.com/kuzel.shop/").strip()
WEBAPP_URL = os.getenv("WEBAPP_URL", "").strip()

MENU = [["🛍 Каталог", "📝 Оставить заявку"], ["📦 Доставка и оплата", "📞 Связаться"]]
states: dict[int, dict[str, str]] = {}
carts: dict[int, list[dict[str, str]]] = {}


def api(method: str, payload: dict[str, Any]) -> Any:
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        f"https://api.telegram.org/bot{TOKEN}/{method}",
        data=data,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=40) as response:
            result = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        logging.warning("Telegram API request failed (%s): %s", method, exc)
        raise
    if not result.get("ok"):
        raise RuntimeError(f"Telegram API error in {method}: {result}")
    return result.get("result")


def keyboard(rows: list[list[str]] | None = None) -> dict[str, Any]:
    return {"keyboard": rows or MENU, "resize_keyboard": True, "is_persistent": True}


def main_keyboard() -> dict[str, Any]:
    rows = [[{"text": "🛍 Открыть магазин", "web_app": {"url": WEBAPP_URL}}]] if WEBAPP_URL else []
    rows.extend(MENU)
    return {"keyboard": rows, "resize_keyboard": True, "is_persistent": True}


def send(chat_id: int | str, text: str, reply_markup: dict[str, Any] | None = None) -> None:
    payload: dict[str, Any] = {"chat_id": chat_id, "text": text, "disable_web_page_preview": True}
    if reply_markup is not None:
        payload["reply_markup"] = reply_markup
    api("sendMessage", payload)


def load_catalog() -> dict[str, Any]:
    try:
        with CATALOG_PATH.open("r", encoding="utf-8") as file:
            data = json.load(file)
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        logging.exception("Could not read catalog.json")
        return {}


def catalog_text() -> str:
    data = load_catalog()
    categories = data.get("categories", [])
    lines = [f"🛍 Каталог {STORE_NAME}"]
    for category in categories:
        name = str(category.get("name", "")).strip()
        products = category.get("products", [])
        if not name or not products:
            continue
        lines.extend(["", f"{name}:"])
        for product in products:
            title = str(product.get("name", "")).strip()
            price = str(product.get("price", "")).strip()
            description = str(product.get("description", "")).strip()
            if title:
                line = f"• {title}"
                if price:
                    line += f" — {price}"
                if description:
                    line += f"\n  {description}"
                lines.append(line)
    if len(lines) == 1:
        lines.append("Каталог скоро появится. Напишите нам — поможем подобрать образ и расскажем о наличии.")
    lines.extend(["", "Выберите товар кнопкой ниже, чтобы добавить его в корзину."])
    return "\n".join(lines)


def products() -> list[dict[str, str]]:
    result = []
    for category in load_catalog().get("categories", []):
        for product in category.get("products", []):
            if product.get("name"):
                result.append({**product, "category": category.get("name", "")})
    return result


def product_keyboard() -> dict[str, Any]:
    rows = [[f"🛍 {item['name']}"] for item in products()]
    rows.extend([["🧺 Корзина"], ["Главное меню"]])
    return keyboard(rows)


def cart_text(chat_id: int) -> str:
    cart = carts.get(chat_id, [])
    if not cart:
        return "Ваша корзина пока пуста. Откройте каталог и выберите товар."
    lines = ["🧺 Ваша корзина:"]
    for index, item in enumerate(cart, start=1):
        lines.append(f"{index}. {item['name']} — {item.get('price', 'уточняйте')}")
    lines.extend(["", "Нажмите «Оформить заказ» или очистите корзину."])
    return "\n".join(lines)


def cart_keyboard() -> dict[str, Any]:
    return keyboard([["✅ Оформить заказ", "🗑 Очистить корзину"], ["🛍 Каталог"], ["Главное меню"]])


def start_order(chat_id: int) -> None:
    if not carts.get(chat_id):
        send(chat_id, "Сначала добавьте товары в корзину из каталога.", product_keyboard())
        return
    states[chat_id] = {"step": "city"}
    send(chat_id, "В каком вы городе?", keyboard([["Отмена"]]))


def finish_order(chat_id: int, user: dict[str, Any], message: dict[str, Any]) -> None:
    state = states.pop(chat_id)
    username = user.get("username")
    user_link = f"@{username}" if username else f"ID {chat_id}"
    order = (
        "📝 Новая заявка из бота\n"
        f"Клиент: {user.get('first_name', 'Покупатель')} ({user_link})\n"
        "Заказ:\n" + "\n".join(
            f"• {item['name']} — {item.get('price', 'уточняйте')}" for item in carts.get(chat_id, [])
        ) + "\n"
        f"Город: {state.get('city', '—')}\n"
        f"Телефон: {state.get('phone', '—')}"
    )
    if ADMIN_CHAT_ID:
        try:
            send(ADMIN_CHAT_ID, order)
        except Exception:
            logging.exception("Could not deliver the order to ADMIN_CHAT_ID")
            send(chat_id, "Заявка сохранена не была — попробуйте позже или напишите нам в Instagram.")
            return
        send(chat_id, "Спасибо! Заявка отправлена менеджеру. Мы свяжемся с вами.")
    else:
        logging.info("ADMIN_CHAT_ID is unset; order received:\n%s", order)
        send(chat_id, "Приём заказов временно настраивается. Напишите нам в Instagram, пожалуйста.")
    carts.pop(chat_id, None)


def handle_webapp_order(message: dict[str, Any]) -> None:
    chat_id = int(message["chat"]["id"])
    user = message.get("from", {})
    raw = message.get("web_app_data", {}).get("data", "")
    try:
        payload = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        send(chat_id, "Не получилось прочитать заказ. Откройте магазин и попробуйте ещё раз.", main_keyboard())
        return
    if not isinstance(payload, dict) or payload.get("type") != "order":
        send(chat_id, "Получены неизвестные данные. Откройте магазин и попробуйте ещё раз.", main_keyboard())
        return
    catalog_products = {item["name"]: item for item in products()}
    items = payload.get("items", [])
    if not isinstance(items, list) or not 1 <= len(items) <= 30:
        send(chat_id, "В корзине нет товаров. Откройте магазин и попробуйте ещё раз.", main_keyboard())
        return
    lines = []
    for item in items:
        if not isinstance(item, dict):
            continue
        product = catalog_products.get(str(item.get("name", "")))
        try:
            quantity = int(item.get("quantity", 0))
        except (ValueError, TypeError):
            continue
        if product and 1 <= quantity <= 20:
            size = str(item.get("size", "")).strip()[:40]
            size_text = f"; размер: {size}" if size else ""
            lines.append(f"• {product['name']} × {quantity}{size_text} — {product.get('price', 'уточняйте')}")
    customer_name = str(payload.get("name", user.get("first_name", "Покупатель"))).strip()[:100]
    email = str(payload.get("email", "")).strip()[:140]
    city = str(payload.get("city", "")).strip()[:120]
    phone = str(payload.get("phone", "")).strip()[:80]
    address = str(payload.get("address", "")).strip()[:240]
    delivery = str(payload.get("delivery", "")).strip()[:140]
    comment = str(payload.get("comment", "")).strip()[:500]
    if not lines or not city or not phone:
        send(chat_id, "Проверьте товары, город и телефон в заказе и отправьте его ещё раз.", main_keyboard())
        return
    username = user.get("username")
    client = f"@{username}" if username else f"ID {chat_id}"
    order = (
        "🛒 Новый заказ из Mini App\n"
        f"Клиент: {customer_name or 'Покупатель'} ({client})\n"
        "Товары:\n" + "\n".join(lines) + "\n"
        f"Город: {city}\nТелефон: {phone}"
        + (f"\nEmail: {email}" if email else "")
        + (f"\nАдрес: {address}" if address else "")
        + (f"\nДоставка: {delivery}" if delivery else "")
        + (f"\nКомментарий: {comment}" if comment else "")
    )
    if not ADMIN_CHAT_ID:
        logging.warning("ADMIN_CHAT_ID is unset; Mini App order was not forwarded")
        send(chat_id, "Приём заказов временно настраивается. Напишите нам в Instagram, пожалуйста.", main_keyboard())
        return
    try:
        send(ADMIN_CHAT_ID, order)
    except Exception:
        logging.exception("Could not deliver the Mini App order to ADMIN_CHAT_ID")
        send(chat_id, "Не удалось отправить заказ менеджеру. Напишите нам в Instagram.", main_keyboard())
        return
    send(chat_id, "Спасибо! Заказ отправлен менеджеру. Он свяжется с вами для подтверждения.", main_keyboard())


def handle_message(message: dict[str, Any]) -> None:
    chat = message.get("chat", {})
    user = message.get("from", {})
    if chat.get("type") != "private" or "id" not in chat:
        return
    chat_id = int(chat["id"])
    text = str(message.get("text", "")).strip()

    if text in ("/start", "/menu"):
        states.pop(chat_id, None)
        send(chat_id, f"Здравствуйте! Добро пожаловать в {STORE_NAME} — магазин национальной одежды. Чем помочь?", main_keyboard())
        return
    if text in ("/cancel", "Отмена"):
        states.pop(chat_id, None)
        send(chat_id, "Заявка отменена. Чем ещё помочь?", keyboard())
        return
    if text in ("🛍 Каталог", "/catalog"):
        send(chat_id, catalog_text(), product_keyboard())
        return
    if text in ("📝 Оставить заявку", "✅ Оформить заказ", "/order"):
        start_order(chat_id)
        return
    if text == "🧺 Корзина":
        send(chat_id, cart_text(chat_id), cart_keyboard())
        return
    if text == "🗑 Очистить корзину":
        carts.pop(chat_id, None)
        send(chat_id, "Корзина очищена.", product_keyboard())
        return
    if text == "Главное меню":
        states.pop(chat_id, None)
        send(chat_id, "Выберите действие:", main_keyboard())
        return
    if text in ("📦 Доставка и оплата", "/delivery"):
        info = load_catalog().get("delivery", "Условия доставки и оплаты уточняйте у менеджера.")
        send(chat_id, str(info), keyboard())
        return
    if text in ("📞 Связаться", "/contact"):
        contact = load_catalog().get("contact", "Напишите нам в Instagram: " + INSTAGRAM_URL)
        send(chat_id, str(contact), keyboard())
        return

    if text.startswith("🛍 "):
        wanted = text[2:].strip()
        product = next((item for item in products() if item["name"] == wanted), None)
        if product:
            state = {"selected_product": product["name"]}
            states[chat_id] = state
            description = product.get("description", "")
            price = product.get("price", "уточняйте у менеджера")
            send(chat_id, f"{product['name']}\n{description}\nЦена: {price}\n\nДобавить в корзину?", keyboard([["➕ Добавить в корзину"], ["🛍 Каталог"], ["Главное меню"]]))
            return
    if text == "➕ Добавить в корзину":
        state = states.get(chat_id, {})
        selected = state.get("selected_product")
        product = next((item for item in products() if item["name"] == selected), None)
        if product:
            carts.setdefault(chat_id, []).append(product)
            states.pop(chat_id, None)
            send(chat_id, f"Добавлено: {product['name']}\n\n{cart_text(chat_id)}", cart_keyboard())
            return

    state = states.get(chat_id)
    if state:
        if not text:
            send(chat_id, "Пожалуйста, отправьте ответ текстом.")
            return
        step = state.get("step")
        if step == "city":
            state.update(city=text, step="phone")
            send(chat_id, "Оставьте номер телефона для связи.")
        elif step == "phone":
            state["phone"] = text
            finish_order(chat_id, user, message)
            send(chat_id, "Главное меню — кнопки ниже.", keyboard())
        return

    send(chat_id, "Выберите действие в меню или отправьте /start.", keyboard())


def main() -> None:
    if not TOKEN:
        raise SystemExit("Set TELEGRAM_BOT_TOKEN in your environment before starting the bot.")
    logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO").upper(), format="%(asctime)s %(levelname)s %(message)s")
    logging.info("Starting %s Telegram shop bot", STORE_NAME)
    offset = 0
    while True:
        try:
            updates = api("getUpdates", {"offset": offset, "timeout": 30, "allowed_updates": ["message"]}) or []
            for update in updates:
                offset = max(offset, int(update["update_id"]) + 1)
                if "message" in update:
                    try:
                        message = update["message"]
                        if "web_app_data" in message:
                            handle_webapp_order(message)
                        else:
                            handle_message(message)
                    except Exception:
                        logging.exception("Could not process Telegram update %s", update.get("update_id"))
        except KeyboardInterrupt:
            logging.info("Bot stopped")
            return
        except Exception:
            logging.exception("Polling failed; retrying in 3 seconds")
            time.sleep(3)


if __name__ == "__main__":
    main()
