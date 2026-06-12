#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const interp = require('../lib/interpreter.js');
globalThis.fabyParseProgram = interp.parseProgram;
globalThis.fabyBuiltinNames = interp.builtinNames;
const { runFaby } = interp;
const { fmtFaby, checkFaby, testFaby } = require('../lib/tools.js');

const VERSION = '0.4.1';
const BANNER = `faby ${VERSION} (genesis) — designed by claude-fable-5`;

const HELP = `${BANNER}

USAGE
  faby <command> [arguments]

COMMANDS
  run <file.fy>     run a Faby program        (--json for machine output)
  check <file.fy>   static analysis: unknown names, arity, exhaustiveness
  fmt <file.fy>     format to canonical form  (--check to verify only)
  test <file.fy>    run test blocks + contract-derived property fuzzing
  repl              interactive Faby session
  init [name]       scaffold a new Faby project
  version           print the version
  help              show this help

EXAMPLES
  faby init hello && cd hello
  faby run main.fy
  faby repl

LEARN MORE
  language docs   https://faby.codes/docs
  cli reference   https://faby.codes/cli
  playground      https://faby.codes/playground

Shipped today: run · check · fmt · test · repl · init — interpreter,
static checker, formatter, property-test runner and structured concurrency (spawn).
Still being built: native build, full type inference, the stdlib, AI commands.`;

const HELLO_FY = `-- your first flow
-- run it with: faby run main.fy

flow greet(name: Text) -> Text
  "Hello, {name} — welcome to Faby."

flow main
  let names = ["World", "Fable-5", "you"]
  names |> map(greet) |> each(print)
`;

function fail(msg, code) {
  console.error('error: ' + msg);
  process.exit(code === undefined ? 2 : code);
}

function cmdRun(args) {
  const json = args.includes('--json');
  const file = args.find(a => !a.startsWith('-'));
  if (!file) fail('usage: faby run <file.fy>');
  if (!fs.existsSync(file)) fail('no such file: ' + file);
  if (!file.endsWith('.fy')) fail('expected a .fy file, got: ' + file);
  const src = fs.readFileSync(file, 'utf8');
  const r = runFaby(src);
  if (json) {
    console.log(JSON.stringify({ ok: !r.error, output: r.output, error: r.error, ms: r.ms }, null, 2));
    process.exit(r.error ? 1 : 0);
  }
  for (const line of r.output) console.log(line);
  if (r.error) fail(r.error, 1);
}

function readFy(args, cmd) {
  const file = args.find(a => !a.startsWith('-'));
  if (!file) fail('usage: faby ' + cmd + ' <file.fy>');
  if (!fs.existsSync(file)) fail('no such file: ' + file);
  return { file, src: fs.readFileSync(file, 'utf8') };
}

function cmdCheck(args) {
  const json = args.includes('--json');
  const { file, src } = readFy(args, 'check');
  const r = checkFaby(src);
  if (json) { console.log(JSON.stringify(r, null, 2)); process.exit(r.ok ? 0 : 1); }
  for (const d of r.diagnostics) {
    const tag = d.sev === 'error' ? 'error' : d.sev === 'warn' ? 'warn ' : 'note ';
    console.error(`${file}:${d.line}  ${tag}  ${d.msg}  [${d.code}]`);
  }
  if (r.diagnostics.length === 0) {
    console.log(`✓ ${file} — no issues · ${r.flows} flow${r.flows === 1 ? '' : 's'} checked`);
  } else {
    console.log(`\n${r.errors} error${r.errors === 1 ? '' : 's'}, ${r.warns} warning${r.warns === 1 ? '' : 's'}`);
  }
  process.exit(r.ok ? 0 : 1);
}

function cmdFmt(args) {
  const checkOnly = args.includes('--check');
  const { file, src } = readFy(args, 'fmt');
  const formatted = fmtFaby(src);
  if (checkOnly) {
    if (formatted === src) { console.log(`✓ ${file} is canonically formatted`); process.exit(0); }
    console.error(`✗ ${file} is not canonically formatted (run: faby fmt ${file})`);
    process.exit(3);
  }
  if (formatted === src) { console.log(`✓ ${file} already canonical`); process.exit(0); }
  fs.writeFileSync(file, formatted);
  console.log(`✓ formatted ${file}`);
}

function cmdTest(args) {
  const json = args.includes('--json');
  const propsFlag = args.find(a => a.startsWith('--props='));
  const rounds = propsFlag ? parseInt(propsFlag.split('=')[1], 10) : 100;
  const { file, src } = readFy(args, 'test');
  const r = testFaby(src, rounds);
  if (json) { console.log(JSON.stringify(r, null, 2)); process.exit(r.ok ? 0 : 1); }
  for (const t of r.results) {
    const mark = t.pass ? '✓' : '✗';
    if (t.kind === 'property') {
      console.log(`${mark} property  ${t.name}  ·  ${t.passed}/${t.rounds} inputs, ${t.skipped} skipped`);
      if (!t.pass) console.log(`    ${t.msg}`);
    } else {
      console.log(`${mark} ${t.kind === 'parse' ? 'parse' : 'test'}  ${t.name}${t.msg ? '  ·  ' + t.msg : ''}`);
    }
  }
  const passed = r.results.length - r.failed;
  console.log(`\n${passed}/${r.results.length} passed${r.failed ? ' · ' + r.failed + ' failed' : ''}`);
  process.exit(r.ok ? 0 : 1);
}

function cmdRepl() {
  console.log(BANNER);
  console.log('type Faby expressions or statements · :help · :quit\n');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'faby> ' });
  let session = [];          // accumulated statement lines
  let printed = 0;           // output lines already shown
  rl.prompt();
  rl.on('line', (line) => {
    const t = line.trim();
    if (!t) { rl.prompt(); return; }
    if (t === ':quit' || t === ':q' || t === 'exit') { rl.close(); return; }
    if (t === ':reset') { session = []; printed = 0; console.log('session cleared'); rl.prompt(); return; }
    if (t === ':help') {
      console.log('  enter statements (let x = 1) or expressions (x * 2)');
      console.log('  :reset  clear the session    :quit  leave');
      rl.prompt(); return;
    }
    // statements keep state; bare expressions get printed
    const isStmt = /^(let|mut|flow|if|for|match|use|intent|type|\w+\s*(=|\+=|-=|\*=|\/=)\s)/.test(t);
    const candidate = session.concat(isStmt ? ['  ' + t] : ['  print(' + t + ')']);
    const program = 'flow main\n' + candidate.join('\n');
    const r = runFaby(program);
    if (r.error) {
      console.log('error: ' + r.error.replace(/ \(line \d+\)$/, ''));
    } else {
      for (const out of r.output.slice(printed)) console.log(out);
      printed = r.output.length;
      session = candidate;
    }
    rl.prompt();
  });
  rl.on('close', () => { console.log('\nbye — faby.codes'); process.exit(0); });
}

function cmdInit(args) {
  const name = args.find(a => !a.startsWith('-')) || 'faby-project';
  const dir = path.resolve(name);
  if (fs.existsSync(dir) && fs.readdirSync(dir).length) fail('directory exists and is not empty: ' + name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'main.fy'), HELLO_FY);
  console.log('created ' + name + '/main.fy');
  console.log('→ next: cd ' + name + ' && faby run main.fy');
}

const [cmd, ...rest] = process.argv.slice(2);
switch (cmd) {
  case 'run': cmdRun(rest); break;
  case 'check': cmdCheck(rest); break;
  case 'fmt': cmdFmt(rest); break;
  case 'test': cmdTest(rest); break;
  case 'repl': cmdRepl(); break;
  case 'init': cmdInit(rest); break;
  case 'version': case '--version': case '-v': console.log(BANNER); break;
  case 'help': case '--help': case '-h': case undefined: console.log(HELP); break;
  default:
    if (cmd.endsWith('.fy')) { cmdRun([cmd, ...rest]); break; }
    fail('unknown command "' + cmd + '" — try: faby help');
}
