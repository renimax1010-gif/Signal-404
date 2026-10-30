# ХАОС — VK chat bot

Разговорный бот для бесед ВКонтакте: отвечает на прямые обращения и изредка вмешивается в разговор с сарказмом и самоиронией.

## Возможности
- Работа от имени сообщества через VK Long Poll.
- Прямые ответы на обращения «бот», «ботик», «хаос», «ии» и упоминание сообщества.
- Ответы на исходное сообщение.
- Редкие случайные реплики с общей и персональной паузой.
- Настройки поведения через переменные окружения.
- Тексты переписки не записываются в логи по умолчанию.

## Важно
Это исходный код, а не уже созданный профиль ВКонтакте. Для работы потребуется сообщество, ключ доступа сообщества и включённый доступ к сообщениям. Возможность добавить сообщество в конкретную беседу и получать события из неё зависит от актуальных ограничений и настроек VK. Сначала проверьте работу в тестовой беседе.

## Настройка сообщества
1. Создайте сообщество, от имени которого будет писать бот.
2. Включите сообщения сообщества.
3. В управлении API создайте ключ сообщества с минимально необходимыми правами для сообщений.
4. Включите Long Poll и события новых сообщений, если это требуется интерфейсом VK.
5. Сохраните ID сообщества и токен. **Не отправляйте токен в чат и не публикуйте его в GitHub.**

## Локальный запуск
Нужен Node.js 20+.

```bash
cd vk-chaos-bot
npm install
cp .env.example .env
```

Заполните `.env` значениями `VK_GROUP_TOKEN` и `VK_GROUP_ID`, затем:

```bash
npm test
npm run check
npm start
```

## Постоянная работа
Нужен постоянно работающий Node.js-хостинг или VPS. GitHub Pages не запускает фоновые процессы и не подходит для VK Long Poll.

Docker:

```bash
docker build -t vk-chaos-bot .
docker run --restart unless-stopped --env-file .env vk-chaos-bot
```

На хостинге добавьте токен и ID как секретные переменные окружения. Не добавляйте настоящий `.env` в репозиторий.

## Параметры
| Переменная | По умолчанию | Назначение |
|---|---:|---|
| RANDOM_REPLY_CHANCE | 0.025 | Шанс случайной реплики на каждое подходящее сообщение |
| RANDOM_REPLY_COOLDOWN_SECONDS | 90 | Минимальная пауза между случайными репликами |
| USER_COOLDOWN_SECONDS | 300 | Пауза для одного участника |
| LOG_MESSAGE_TEXT | false | Включает запись текста в технические логи; лучше оставить false |

## Приватность
Бот не хранит историю чата и не пересылает переписку сторонним сервисам. По умолчанию в логах только технические события и ID. Токен нельзя помещать в HTML, клиентский JavaScript или публичные файлы.


## AI personality (current build)

The bot uses the OpenAI Responses API for natural, contextual replies. It keeps a short rolling conversation context in RAM per chat (up to 16 entries); context is lost when the process restarts. Message text is sent to the configured AI provider when the bot generates a reply. Make sure participants know an AI bot is present.

Required AI settings:
- `OPENAI_API_KEY`: a separate OpenAI API key (ChatGPT subscription does not include API usage).
- `OPENAI_MODEL`: a model ID enabled for your API project.

AI API usage may incur separate charges. Set project spending limits and monitor usage before inviting the bot to a large group.
