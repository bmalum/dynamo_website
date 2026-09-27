# ⚡ Dynamo Website

> Landing page for [Dynamo](https://github.com/bmalum/dynamo) — an elegant DynamoDB DSL for Elixir

[![Live Site](https://img.shields.io/badge/Live-elixir--dynamodb.dev-6366f1)](https://elixir-dynamodb.dev/)
[![Cloudflare Pages](https://img.shields.io/badge/Hosted%20on-Cloudflare%20Pages-f38020)](https://pages.cloudflare.com/)

## 🚀 Live

**[elixir-dynamodb.dev](https://elixir-dynamodb.dev/)**

## 🛠 Tech Stack

- Static HTML/CSS/JS
- [Prism.js](https://prismjs.com/) for syntax highlighting
- Hosted on Cloudflare Pages

## 💻 Development

```bash
# Option 1: Python
python -m http.server 8000

# Option 2: Node
npx serve .
```

Then open [localhost:8000](http://localhost:8000)

## 📚 Docs

`/docs` is the ExDoc output of the library (README, guides, module docs),
served at [elixir-dynamodb.dev/docs](https://elixir-dynamodb.dev/docs/) until
the package is on Hex. Regenerate after a library change:

```bash
./build-docs.sh ../dynamo
```

## ✅ Keeping snippets honest

Every code snippet on the page is exercised against the library's test suite
before it is published (`Dynamo 0.2` API). When the library API changes,
update `index.html` **and** the matching `codeSnippets` in `script.js`.

## 🚢 Deployment

Automatically deployed to Cloudflare Pages on push to `main`.

## 📄 License

MIT
