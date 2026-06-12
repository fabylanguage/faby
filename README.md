<div align="center">

# Faby

**The AI-native programming language.** Designed end-to-end by Claude Fable-5.
Token-minimal · deterministic · one canonical form.

[faby.codes](https://faby.codes) · [Docs](https://faby.codes/docs) · [Playground](https://faby.codes/playground) · [Live app demo](https://faby.codes/guestbook) · [@fabylanguage](https://x.com/fabylanguage)

</div>

---

## What is this?

Faby is the first programming language conceived end-to-end by an AI model — built
for the era where code is generated, reviewed and maintained by machines and verified
by humans. This repository is the real thing: the interpreter, the CLI, the website,
and a web app written in Faby that runs in production.

```faby
flow fib(n: Int) -> Int
  match n
    0 | 1 -> n
    _     -> fib(n - 1) + fib(n - 2)

flow main
  range(1, 10) |> map(fib) |> each(print)
```

## Install

```sh
# standalone binary (macOS · Linux, no Node required)
curl -fsSL https://faby.codes/install.sh | sh

# or via NPM (any platform incl. Windows)
npm i -g @fabycode/cli

faby init hello && cd hello && faby run main.fy
```

Editor support: the **Faby** extension on the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=fabycodes.faby) (`code --install-extension fabycodes.faby`).

## Honest status — shipped vs. roadmap

Faby is built in public and we are precise about what is real. Everything below marked
**shipped** runs today; the rest is being built.

| Area | Status |
| --- | --- |
| Interpreter: flows, pipelines (`\|>`), exhaustive `match`, recovery (`?`), records | ✅ shipped |
| `faby run` · `repl` · `init` | ✅ shipped |
| `faby check` (unknown names, arity, exhaustiveness) | ✅ shipped |
| `faby fmt` (idempotent canonical formatter) | ✅ shipped |
| `faby test` (test blocks + contract-derived **property fuzzing**) | ✅ shipped |
| Contracts `expect`/`ensure` — runtime enforcement | ✅ shipped |
| `spawn` / `await` / parallel pipelines (deterministic; data-race-free by construction) | ✅ shipped |
| `use http` — real web server (routing, params, JSON/HTML, POST bodies) | ✅ shipped |
| `use store` — file-backed persistence | ✅ shipped |
| Standalone binary (macOS arm64 · Linux x64) | ✅ shipped |
| VS Code extension (syntax highlighting) | ✅ shipped |
| Static contract **proving** (compile time) | ◷ in progress |
| Semantic-type / refinement **enforcement**, full type inference | ◷ in progress |
| Channels · true multi-core `spawn` | ○ planned |
| Native / WASM compilation (`faby build`) | ○ planned |
| `db` / `web` / `ai` / `csv` / `stats` stdlib modules · package registry | ○ planned |

> The Genesis runtime is a tree-walking interpreter (in JS), which is why the standalone
> "binary" bundles a runtime rather than being native machine code. It's honest, it's real,
> and it runs your programs — native AOT compilation is on the roadmap.

## A web app, written in Faby — running in production

[`demo/guestbook.fy`](demo/guestbook.fy) is a complete web app: HTML page, form handling
and disk persistence, all in Faby. It runs live at **[faby.codes/guestbook](https://faby.codes/guestbook)**
via `faby run` behind nginx.

```faby
use http
use store

flow main
  http.get("/guestbook", page)
  http.post("/guestbook/sign", sign)
  http.serve(8080)
```

## Repository layout

```
interpreter/   the Faby interpreter + tooling (fmt / check / test) — pure JS
cli/           @fabycode/cli npm package source (bin + lib + examples)
build/         standalone-binary build (Node SEA bundle + config)
web/           the faby.codes website (landing, docs, playground, benchmark) + assets
demo/          guestbook.fy — the live production web app
vscode-faby/   VS Code syntax-highlighting extension
benchmark/     the reproducible token benchmark (bench.js)
```

## Benchmark

`benchmark/bench.js` is the reproducible token comparison behind the
[faby.codes/benchmark](https://faby.codes/benchmark) page: the same programs in Python,
TypeScript, Rust and Faby, counted with one identical tokenizer. Run it with `node benchmark/bench.js`.

## License

MIT © The Faby Project · designed by Claude Fable-5
