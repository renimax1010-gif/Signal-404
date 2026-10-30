'use strict';
// ХАОС: Cloudflare Workers + VK Callback API.
// Bindings: CHAOS_KV (KV namespace); secrets VK_GROUP_TOKEN,
// VK_CALLBACK_SECRET, VK_CONFIRMATION_CODE; text variable VK_GROUP_ID.

const API_VERSION = '5.199';
const GLOBAL_COOLDOWN_MS = 120000;
const USER_COOLDOWN_MS = 300000;
const RANDOM_CHANCE = 0.035;
const TOPICS = [
  { re: /(еда|есть|жрать|голод|пицц|борщ|кофе|чай|ужин|завтрак|обед)/i, lines: ['Разговор пришёл к главному вопросу цивилизации: кто заказывает еду?','Я поддерживаю эту тему. Особенно ту её часть, где еда появляется сама.','План хороший. Добавьте пункт «накормить ХАОС» — и я одобрю.'] },
  { re: /(деньг|зарплат|доллар|грив|евро|дорого|дешев|купить|покуп|цена|богат|бедн)/i, lines: ['Финансовая стратегия звучит уверенно. Баланс карты пока не комментирует.','Деньги — это такие цифры, которые почему-то быстро покидают чат и кошелёк.','Предлагаю сначала разбогатеть, а потом уже обсуждать детали.'] },
  { re: /(работ|начальник|офис|смена|уволь|задач|дела|труд)/i, lines: ['Сочувствую. Работа опять мешает людям заниматься важными вещами — например, перепиской.','У меня тоже много работы. Правда, я просто сижу здесь и оцениваю ваши решения.','Звучит как повод взять паузу. Научно обоснованную, разумеется.'] },
  { re: /(спать|сон|устал|высп|проснул|ночью|бессон)/i, lines: ['Сон — бесплатная подписка на отключение от проблем. Рекомендую тариф «8 часов».','Вы не ленитесь, вы переходите в энергосберегающий режим.','Если кто-то найдёт кнопку «выспаться за пять минут», сообщите первым.'] },
  { re: /(любов|девушк|парень|жен[аы]|муж|свидан|расстал|отношен)/i, lines: ['Отношения — это когда два человека вместе пытаются понять, что имел в виду третий.','Я бы дал совет, но у меня даже личная жизнь состоит из серверных процессов.','Тут нужен не совет, а попкорн и протокол наблюдений.'] },
  { re: /(игр|побед|проигр|катк|ранг|стрим|гейм)/i, lines: ['Главное — играть ради удовольствия. А проигрыш объяснять плохим интернетом.','Тактика ясна: нажимать кнопки с уверенностью профессионала.','Я болею за вас. Но статистику потом всё равно проверю.'] },
  { re: /(дожд|снег|жар|холод|погод|ветер|мороз)/i, lines: ['Погода опять ведёт себя так, будто у неё личный конфликт с планами людей.','Предлагаю обвинить климат. Он всё равно не вступит в спор.','Идеальная погода — это когда на улицу можно не выходить и не чувствовать вины.'] }
];
const GENERIC = ['Любопытно. Я пока не понял, это гениальная мысль или начало очень длинной истории.','В этой реплике есть потенциал. Особенно если добавить к ней факты.','Я бы уточнил детали, но боюсь, мы случайно получим целый сюжет.','Записал в мысленный протокол. Раздел «неожиданные повороты».'];
const DIRECT = ['Я здесь. К сожалению, у меня опять есть мнение.','Слушаю. Надеюсь, это не очередная попытка переложить на меня ответственность.','На связи. Кто сегодня решил проверить границы моего терпения?','Да? Я как раз делал вид, что занят важными вычислениями.','Внимание получил. Здравый смысл — пока нет.'];
const OPENERS = ['Так, секунду.','Я тут кое-что заметил.','Позвольте внести хаос в эту стройную картину.'];
const AUTONOMOUS = ['Так, проверка связи. Чат ещё жив или все ушли заниматься взрослыми делами?','Небольшое наблюдение: чем дольше молчит чат, тем подозрительнее становится тишина.','Я решил напомнить о себе. Не благодарите, я и так великолепен.','Вопрос дня: если планы постоянно меняются, это уже стратегия или просто хаос?','Кто-нибудь принёс новости, мемы или хотя бы убедительное оправдание своего отсутствия?'];
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function clean(v) { return String(v || '').replace(/\s+/g, ' ').trim().slice(0, 1000); }
function isDirect(text, groupId, reply) {
  if (Number(reply && reply.from_id) === -Number(groupId)) return true;
  const s = String(text || '');
  return s.includes('[club' + groupId + '|') || s.includes('[public' + groupId + '|') ||
    /(?:^|[\s,!?])(?:ботик?|хаос|ии)(?=$|[\s,!?])/i.test(s);
}
function makeReply(message) {
  const s = message.toLowerCase();
  if (/^(привет|прив|здаров|здравствуйте|доброе утро|добрый вечер|хай|ку)/i.test(s)) return pick(['О, публика собралась. Приветствую.','Здорово. Я уже начал скучать по вашему хаосу.','Привет! Давайте постараемся не принимать сегодня необратимых решений.']);
  if (/(кто ты|ты кто|что ты такое|ты бот|ты ии|искусственный интеллект)/i.test(s)) return 'Я ХАОС. Локальная интеллектуальная неприятность с чувством юмора и ограниченной ответственностью. Работаю на алгоритмах, сарказме и подозрительно большом количестве заготовок.';
  if (/(шутк|рассмеш|анекдот|прикол)/i.test(s)) return pick(['Почему программист не пошёл гулять? У него и так была открытая вкладка с природой.','Оптимист видит свет в конце тоннеля. Пессимист — поезд. Я вижу, что вы опять забыли оплатить интернет.','Мой любимый спорт — наблюдать, как люди уверенно нажимают «Отправить», а потом перечитывают сообщение.']);
  if (/(скучно|развлеки|удиви|что делать|предложи)/i.test(s)) return pick(['Мини-испытание: каждый пишет самое нелепое оправдание опоздания. Победителя выбираю я, поэтому шансы у всех одинаково несправедливые.','Игра: задайте друг другу вопрос, на который нельзя ответить «нормально». Начинайте.','Предлагаю голосование: кто в этом чате дольше всех продержится без телефона? Не врите, я всё равно не поверю.']);
  if (/(спасибо|благодарю|сенкс)/i.test(s)) return pick(['Пожалуйста. Запишите этот исторический момент.','Всегда пожалуйста. Чаевые принимаю в виде адекватных сообщений.','Не за что. Я делаю вид, что мне не приятно.']);
  if (/(пока|спокойной ночи|до встречи|уш[её]л)/i.test(s)) return pick(['Уходите? Ладно. Я останусь присматривать за уровнем абсурда.','До связи. Не совершайте ничего интересного без меня.','Спокойной ночи. Пусть хотя бы во сне ваши решения будут логичными.']);
  if (/\?/.test(s) && /(как дела|как ты|чем занят|что делаешь)/i.test(s)) return 'Слежу за беседой, классифицирую хаос и периодически теряю веру в пунктуацию. В общем, обычный рабочий день.';
  if (/\?/.test(s)) return pick(['Вопрос принят. Мой предварительный вердикт: нужно больше данных и меньше уверенности.','Интересный вопрос. А вы хотите честный ответ или тот, после которого беседа продолжится?','Могу предположить, но тогда это будет не ответ, а художественная самодеятельность. Дайте контекст.']);
  const topic = TOPICS.find(t => t.re.test(s));
  return topic ? pick(topic.lines) : pick(GENERIC);
}
async function vkSend(env, peerId, message) {
  const body = new URLSearchParams({ access_token: env.VK_GROUP_TOKEN, v: API_VERSION, peer_id: String(peerId), random_id: String(Math.floor(Math.random() * 2147483647)), message });
  const res = await fetch('https://api.vk.com/method/messages.send', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
  const data = await res.json();
  if (data.error) throw new Error('VK API ' + data.error.error_code + ': ' + data.error.error_msg);
  return data.response;
}
export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return new Response('ХАОС на связи');
    if (!env.CHAOS_KV || !env.VK_GROUP_TOKEN || !env.VK_GROUP_ID || !env.VK_CALLBACK_SECRET || !env.VK_CONFIRMATION_CODE) return new Response('Worker configuration incomplete', { status: 500 });
    let payload;
    try { payload = await request.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }
    if (Number(payload.group_id) !== Number(env.VK_GROUP_ID)) return new Response('wrong group', { status: 403 });
    if (payload.secret !== env.VK_CALLBACK_SECRET) return new Response('wrong secret', { status: 403 });
    if (payload.type === 'confirmation') return new Response(env.VK_CONFIRMATION_CODE);
    if (payload.type !== 'message_new') return new Response('ok');
    const msg = payload.object && (payload.object.message || payload.object);
    const peerId = Number(msg && msg.peer_id), senderId = Number(msg && msg.from_id), message = clean(msg && msg.text);
    if (!peerId || !senderId || senderId < 0 || !message) return new Response('ok');
    await env.CHAOS_KV.put('last_active_peer', String(peerId), { expirationTtl: 1209600 });
    if (payload.event_id) {
      const eventKey = 'event:' + payload.event_id;
      if (await env.CHAOS_KV.get(eventKey)) return new Response('ok');
      await env.CHAOS_KV.put(eventKey, '1', { expirationTtl: 86400 });
    }
    const direct = isDirect(message, env.VK_GROUP_ID, msg.reply_message);
    const now = Date.now();
    let shouldReply = direct;
    if (!direct) {
      const globalAt = Number(await env.CHAOS_KV.get('last_random_global') || 0);
      const userAt = Number(await env.CHAOS_KV.get('last_random_user:' + senderId) || 0);
      shouldReply = now - globalAt >= GLOBAL_COOLDOWN_MS && now - userAt >= USER_COOLDOWN_MS && Math.random() < RANDOM_CHANCE;
    }
    if (shouldReply) {
      const answer = direct ? makeReply(message) : pick(OPENERS) + ' ' + makeReply(message);
      await vkSend(env, peerId, answer);
      if (!direct) {
        await env.CHAOS_KV.put('last_random_global', String(now), { expirationTtl: 86400 });
        await env.CHAOS_KV.put('last_random_user:' + senderId, String(now), { expirationTtl: 86400 });
      }
    }
    return new Response('ok');
  },
  async scheduled(controller, env, ctx) {
    if (!env.CHAOS_KV || !env.VK_GROUP_TOKEN) return;
    const peerId = await env.CHAOS_KV.get('last_active_peer');
    if (!peerId) return;
    const now = Date.now();
    const last = Number(await env.CHAOS_KV.get('last_autonomous_message') || 0);
    if (now - last < 7200000) return;
    await vkSend(env, Number(peerId), pick(AUTONOMOUS));
    await env.CHAOS_KV.put('last_autonomous_message', String(now), { expirationTtl: 86400 });
  }
};
