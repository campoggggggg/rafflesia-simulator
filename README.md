# Rafflesia Simulator

Web simulator and deck builder for **Rafflesia**, an original dark-fantasy TCG.  
Built with vanilla JS (ES modules) and data persistance on Supabase.

---

## Features

| Screen | Description |
|---|---|
| **Home** | Project roadmap and game rules |
| **Deck Builder** | Build decks: 1 Commander + 29 Main + 12 Territory + 10 Sideboard. Import/export via code or image. |
| **Public Decks** | Browse and import community-published decks |
| **Advanced Search** | Filter the full card pool + analytics charts (bar, pie, stacked, scatter) |
| **Settings** | Theme (dark/light), volume, end-turn confirm |

## Stack

- **Frontend** — Vanilla JS ES modules, CSS custom properties
- **Backend** — [Supabase](https://supabase.com) (PostgreSQL + Auth + RLS)
- **Auth** — Email/password with username support, cloud-synced settings and decks

## Project structure (old)

```
index.html          ← entry point (served from root)
src/
├── js/
│   ├── core/       ← app, router, state, ui, particles, supabase client
│   ├── auth/       ← authentication logic and screen
│   ├── data/       ← card and deck sync with Supabase
│   └── screens/    ← one file per screen
├── css/
│   ├── main.css    ← @import entry point
│   ├── base/       ← variables, reset
│   ├── layout/     ← shell, sidebar
│   └── components/ ← per-screen styles
└── assets/         ← images, card art (001–287)
```

## Running on

https://campoggggggg.github.io/rafflesia-simulator/
