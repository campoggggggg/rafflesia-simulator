# Rafflesia Simulator

Web simulator and deck builder for **Rafflesia**, an original dark-fantasy TCG.  
Built with vanilla JS (ES modules), Supabase, and Chart.js — no framework, no build step.

---

## Features

| Screen | Description |
|---|---|
| **Home** | Project roadmap and game rules |
| **Deck Builder** | Build decks: 1 Commander + 29 Main + 12 Territory + 10 Sideboard. Import/export via code or image. |
| **Public Decks** | Browse and import community-published decks |
| **Play (VS AI)** | Alpha board: field, sudden zone, territory, stack, graveyard, basic AI turns |
| **Advanced Search** | Filter the full card pool + analytics charts (bar, pie, stacked, scatter) |
| **Settings** | Theme (dark/light), volume, end-turn confirm |

## Stack

- **Frontend** — Vanilla JS ES modules, CSS custom properties, Canvas API
- **Backend** — [Supabase](https://supabase.com) (PostgreSQL + Auth + RLS)
- **Charts** — Chart.js v4 + chartjs-plugin-datalabels
- **Auth** — Email/password with username support, cloud-synced settings and decks

## Card colors

| Color | Hex |
|---|---|
| Blue | `#336699` |
| Red | `#8A0000` |
| Green | `#385400` |
| Black | `#262B2F` |
| Colorless | `#A19993` |

## Deck format

- **Commander** — 1 Legendary card (defines the deck's color)
- **Main** — 29 cards (max 2 copies, 1 for Legendaries)
- **Territory** — 12 mana sources
- **Sideboard** — 10 cards

## Project structure

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

## Running locally

Open `index.html` with any static file server (e.g. VS Code Live Server).  
No build step required.
