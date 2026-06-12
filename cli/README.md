# @fabycode/cli

> **Faby** — the AI-native programming language, designed end-to-end by Claude Fable-5.
> Token-minimal · deterministic · one canonical form.

```
npm i -g @fabycode/cli
```

## Quick start

```bash
faby init hello && cd hello
faby run main.fy
```

```
Hello, World — welcome to Faby.
Hello, Fable-5 — welcome to Faby.
Hello, you — welcome to Faby.
```

## What is Faby?

Faby is the first programming language conceived end-to-end by an AI model —
built for the era in which code is generated, reviewed and maintained by
machines, and verified by humans.

```faby
flow fib(n: Int) -> Int
  match n
    0 | 1 -> n
    _     -> fib(n - 1) + fib(n - 2)

flow main
  range(1, 50)
    |> filter(_ % 3 == 0)
    |> map(_ * _)
    |> take(5)
    |> each(print)
```

- **Flows, not functions** — the last expression returns, no ceremony
- **Pipelines** — data reads left to right with `|>`
- **Exhaustive `match`** — the compiler-grade runtime rejects missed cases
- **Contracts** — `expect` / `ensure` are part of the signature and actually fail
- **Recovery operators** — `? default(x)`, `? retry(3)`, `? skip`, `? fail` at the call site

## Commands

| Command | Description |
| --- | --- |
| `faby run <file.fy>` | run a program (`--json` for machine-readable output) |
| `faby repl` | interactive session with persistent state |
| `faby init [name]` | scaffold a new project |
| `faby version` | print version |
| `faby help` | help |

## Scope of this release

This is the **Genesis runtime** (v0.1): the same interpreter that powers the
[browser playground](https://faby.codes/playground), packaged for your terminal.
It covers flows, recursion, pipelines with `_`-lambdas, exhaustive pattern
matching with guards, contracts and recovery operators, plus ~20 stdlib builtins.

The full native toolchain — `faby build`, `faby check --intent`, `spawn`
concurrency, semantic types — ships with v0.2 "Pulse". Follow the roadmap at
[faby.codes](https://faby.codes#roadmap).

## Links

- Website: [faby.codes](https://faby.codes)
- Language docs: [faby.codes/docs](https://faby.codes/docs)
- CLI reference: [faby.codes/cli](https://faby.codes/cli)
- Playground: [faby.codes/playground](https://faby.codes/playground)
- X / Twitter: [@fabylanguage](https://x.com/fabylanguage)

MIT © 2026 The Faby Project · Designed by Claude Fable-5
