# 🎯 Танчики — 3D Multiplayer Browser Game

Многопользовательская 3D-игра в стиле .io на React + Three.js + Socket.io.

## 🚀 Быстрый старт (локально)

```bash
# 1. Установить зависимости
npm run install:all

# 2. Запустить сервер (в одном терминале)
npm run dev:server
# Сервер запустится на http://localhost:3001

# 3. Запустить клиент (в другом терминале)
npm run dev:client
# Клиент: http://localhost:5173
```

## 📦 Структура проекта

```
tankiki/
├── server/                 # Node.js + Socket.io сервер
│   ├── src/
│   │   └── index.js        # Вся серверная логика (игровой цикл, ИИ ботов)
│   └── package.json
├── client/                 # React + Three.js клиент
│   ├── src/
│   │   ├── components/
│   │   │   ├── Game.jsx    # Главный игровой компонент
│   │   │   ├── HUD.jsx     # HUD: лидерборд, HP, XP, мини-карта
│   │   │   └── StartScreen.jsx
│   │   ├── game/
│   │   │   ├── SceneManager.js  # Three.js сцена, камера, рендеринг
│   │   │   ├── ThreeObjects.js  # Танки, блоки, пикапы (3D-объекты)
│   │   │   └── ParticleSystem.js # 2D-партиклы (взрывы, искры, дым)
│   │   ├── hooks/
│   │   │   ├── useSocket.js     # Socket.io подключение
│   │   │   └── useInput.js      # WASD + мышь
│   │   ├── sounds/
│   │   │   └── SoundManager.js  # Web Audio API (без файлов)
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   └── package.json
├── render.yaml             # Конфиг деплоя Render.com
└── package.json            # Корневой (скрипты запуска)
```

## 🌐 Деплой на Render.com

### Вариант 1: Через render.yaml (рекомендуется)

1. Загрузи весь проект в GitHub репозиторий
2. Зайди на [render.com](https://render.com) → **New** → **Blueprint**
3. Подключи свой GitHub репозиторий
4. Render автоматически найдёт `render.yaml` и создаст оба сервиса
5. После деплоя сервера скопируй его URL (например `https://tankiki-server.onrender.com`)
6. В настройках клиента (Environment) задай `VITE_SERVER_URL=https://tankiki-server.onrender.com`
7. Передеплой клиент

### Вариант 2: Ручной деплой

#### Сервер:
1. Render → **New Web Service** → подключи репозиторий
2. Root Directory: `server`
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Env: `NODE_ENV=production`

#### Клиент:
1. Render → **New Static Site** → подключи репозиторий
2. Root Directory: `client`
3. Build Command: `npm install && npm run build`
4. Publish Dir: `dist`
5. Env: `VITE_SERVER_URL=https://<твой-сервер>.onrender.com`

### ⚠️ Важно для 50+ игроков

На бесплатном тире Render сервер "засыпает" после 15 мин неактивности.
Для нагрузки 50+ игроков используй **Starter plan** ($7/мес) — он не засыпает.

Также добавь в render.yaml:
```yaml
plan: starter
```

## 🎮 Геймплей

| Клавиша | Действие |
|---------|----------|
| W / ↑  | Движение вперёд |
| S / ↓  | Движение назад |
| A / ←  | Поворот влево |
| D / →  | Поворот вправо |
| Мышь   | Прицеливание башни |
| ЛКМ    | Выстрел |

## ✨ Фичи

- **3D графика** — Three.js с тенями, туманом, Filmic tonemapping
- **Детализированные танки** — корпус, башня, дуло, катки, гусеницы, антенна
- **Реальный мультиплеер** — Socket.io, до 50+ игроков
- **Умные боты** — машина состояний (атака/сбор/скитание)
- **Динамическая арена** — расширяется с ростом числа игроков
- **Разрушаемые блоки** — нормальные и бронированные, дропают опыт
- **Партиклы** — взрывы, искры, дым, осколки
- **Звук** — синтезированный Web Audio (без файлов)
- **HUD** — HP/XP бары, лидерборд, мини-карта, килл-фид
- **Система уровней** — опыт → уровень → урон/скорострельность
- **Классическая зелёная тема** — военный минимализм

## 🛠 Технологии

- **Frontend**: React 18 + Vite + Three.js
- **Backend**: Node.js + Express + Socket.io
- **Физика**: Кастомная (AABB коллизии)
- **Звук**: Web Audio API (процедурный синтез)
- **Деплой**: Render.com
