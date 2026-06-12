/* Faby Playground Interpreter — a small tree-walking interpreter
   for a subset of the Faby language. Runs fully in the browser. */
(function (global) {
'use strict';

function FabyError(msg, line) {
  const e = new Error(msg);
  e.faby = true;
  e.fabyLine = line;
  return e;
}

/* ---------------- preprocessing ---------------- */

function logicalLines(src) {
  const raw = src.split('\n');
  const out = [];
  for (let i = 0; i < raw.length; i++) {
    let text = raw[i];
    let s = '', inStr = false;
    for (let j = 0; j < text.length; j++) {
      const c = text[j];
      if (!inStr && c === '-' && text[j + 1] === '-') break;
      if (c === '"' && text[j - 1] !== '\\') inStr = !inStr;
      s += c;
    }
    text = s;
    if (!text.trim()) continue;
    const indent = text.match(/^ */)[0].length;
    const trimmed = text.trim();
    // line continuations: |> and ? pull onto previous logical line
    if (out.length && (trimmed.startsWith('|>') || trimmed.startsWith('?'))) {
      out[out.length - 1].text += ' ' + trimmed;
      continue;
    }
    out.push({ indent, text: trimmed, line: i + 1 });
  }
  return out;
}

/* ---------------- expression tokenizer ---------------- */

const TWO_OPS = ['|>', '==', '!=', '<=', '>=', '+=', '-=', '*=', '/=', '->'];

function tokenize(s, line) {
  const toks = []; let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ' || c === '\t') { i++; continue; }
    if (c === '"') {
      let j = i + 1; const parts = []; let cur = '';
      while (j < s.length && s[j] !== '"') {
        if (s[j] === '\\') {
          const n = s[j + 1];
          cur += n === 'n' ? '\n' : n === 't' ? '\t' : n;
          j += 2; continue;
        }
        if (s[j] === '{') {
          parts.push({ t: 'text', v: cur }); cur = '';
          let depth = 1, k = j + 1, inner = '';
          while (k < s.length && depth > 0) {
            if (s[k] === '{') depth++;
            if (s[k] === '}') depth--;
            if (depth > 0) inner += s[k];
            k++;
          }
          parts.push({ t: 'expr', v: inner }); j = k; continue;
        }
        cur += s[j]; j++;
      }
      if (j >= s.length) throw FabyError('unterminated string', line);
      parts.push({ t: 'text', v: cur });
      toks.push({ t: 'str', parts, line }); i = j + 1; continue;
    }
    if (/[0-9]/.test(c)) {
      const m = s.slice(i).match(/^\d+(\.\d+)?/);
      toks.push({ t: 'num', v: parseFloat(m[0]), line }); i += m[0].length; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = s.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*/);
      toks.push({ t: 'id', v: m[0], line }); i += m[0].length; continue;
    }
    const two = s.substr(i, 2);
    if (TWO_OPS.includes(two)) { toks.push({ t: 'op', v: two, line }); i += 2; continue; }
    if ('+-*/%<>=?().,[]:{}'.includes(c)) { toks.push({ t: 'op', v: c, line }); i++; continue; }
    throw FabyError('unexpected character "' + c + '"', line);
  }
  return toks;
}

/* ---------------- expression parser (Pratt) ---------------- */

const BIN_PREC = {
  '|>': 2,
  'or': 3, 'and': 4,
  '==': 5, '!=': 5,
  '<': 6, '>': 6, '<=': 6, '>=': 6,
  '+': 7, '-': 7,
  '*': 8, '/': 8, '%': 8
};

function ExprParser(toks, line) {
  this.toks = toks; this.pos = 0; this.line = line;
}
ExprParser.prototype = {
  peek() { return this.toks[this.pos]; },
  next() { return this.toks[this.pos++]; },
  atOp(v) { const t = this.peek(); return t && t.t === 'op' && t.v === v; },
  atId(v) { const t = this.peek(); return t && t.t === 'id' && t.v === v; },
  expectOp(v) {
    if (!this.atOp(v)) throw FabyError('expected "' + v + '"', this.line);
    return this.next();
  },

  parse() {
    const e = this.parseExpr(0);
    if (this.pos < this.toks.length) {
      throw FabyError('unexpected "' + (this.peek().v ?? '?') + '"', this.line);
    }
    return e;
  },

  parseExpr(minPrec) {
    let left = this.parseUnary();
    for (;;) {
      const t = this.peek();
      if (!t) break;
      // recovery operator — lowest precedence, left assoc
      if (t.t === 'op' && t.v === '?' && minPrec <= 1) {
        this.next();
        const h = this.next();
        if (!h || h.t !== 'id') throw FabyError('expected recovery handler after "?"', this.line);
        let arg = null;
        if (this.atOp('(')) {
          this.next();
          if (!this.atOp(')')) arg = this.parseExpr(2);
          this.expectOp(')');
        }
        left = { k: 'recover', expr: left, handler: h.v, arg, line: this.line };
        continue;
      }
      let opName = null;
      if (t.t === 'op' && BIN_PREC[t.v]) opName = t.v;
      if (t.t === 'id' && (t.v === 'and' || t.v === 'or')) opName = t.v;
      if (!opName) break;
      const prec = BIN_PREC[opName];
      if (prec < minPrec) break;
      this.next();
      const right = this.parseExpr(prec + 1);
      if (opName === '|>') {
        if (right.k === 'call') { right.args.unshift(left); left = right; }
        else left = { k: 'call', callee: right, args: [left], line: this.line };
      } else {
        left = { k: 'bin', op: opName, l: left, r: right, line: this.line };
      }
    }
    return left;
  },

  parseUnary() {
    if (this.atOp('-')) { this.next(); return { k: 'neg', e: this.parseUnary(), line: this.line }; }
    if (this.atId('not')) { this.next(); return { k: 'not', e: this.parseUnary(), line: this.line }; }
    if (this.atId('spawn') || this.atId('await')) { this.next(); return { k: 'await', e: this.parseUnary(), line: this.line }; }
    return this.parsePostfix(this.parsePrimary());
  },

  parsePostfix(e) {
    for (;;) {
      if (this.atOp('(')) {
        this.next();
        const args = [];
        while (!this.atOp(')')) {
          // named argument "name: expr" → value only
          const t = this.peek(), t2 = this.toks[this.pos + 1];
          if (t && t.t === 'id' && t2 && t2.t === 'op' && t2.v === ':') { this.next(); this.next(); }
          args.push(this.parseExpr(2));
          if (this.atOp(',')) this.next(); else break;
        }
        this.expectOp(')');
        e = { k: 'call', callee: e, args, line: this.line };
      } else if (this.atOp('.')) {
        this.next();
        const id = this.next();
        if (!id || id.t !== 'id') throw FabyError('expected property name after "."', this.line);
        e = { k: 'member', obj: e, name: id.v, line: this.line };
      } else break;
    }
    return e;
  },

  parsePrimary() {
    const t = this.next();
    if (!t) throw FabyError('unexpected end of expression', this.line);
    if (t.t === 'num') return { k: 'num', v: t.v, line: this.line };
    if (t.t === 'str') return { k: 'str', parts: t.parts, line: this.line };
    if (t.t === 'id') {
      if (t.v === 'true') return { k: 'bool', v: true, line: this.line };
      if (t.v === 'false') return { k: 'bool', v: false, line: this.line };
      return { k: 'id', name: t.v, line: this.line };
    }
    if (t.t === 'op' && t.v === '(') {
      const e = this.parseExpr(0);
      this.expectOp(')');
      return e;
    }
    if (t.t === 'op' && t.v === '[') {
      const items = [];
      while (!this.atOp(']')) {
        items.push(this.parseExpr(2));
        if (this.atOp(',')) this.next(); else break;
      }
      this.expectOp(']');
      return { k: 'list', items, line: this.line };
    }
    if (t.t === 'op' && t.v === '{') {
      // record / map literal: { key: expr, ... }   (key is an identifier or string)
      const pairs = [];
      while (!this.atOp('}')) {
        const kt = this.next();
        let key;
        if (kt && kt.t === 'id') key = kt.v;
        else if (kt && kt.t === 'str') key = kt.parts.map(p => p.t === 'text' ? p.v : '').join('');
        else throw FabyError('expected a field name in {…}', this.line);
        this.expectOp(':');
        pairs.push({ key, val: this.parseExpr(2) });
        if (this.atOp(',')) this.next(); else break;
      }
      this.expectOp('}');
      return { k: 'record', pairs, line: this.line };
    }
    throw FabyError('unexpected "' + t.v + '"', this.line);
  }
};

function containsUnderscore(ast) {
  if (!ast || typeof ast !== 'object') return false;
  if (ast.k === 'lambda') return false; // `_` inside a lambda is already bound
  if (ast.k === 'id' && ast.name === '_') return true;
  for (const key of Object.keys(ast)) {
    const v = ast[key];
    if (Array.isArray(v)) { if (v.some(containsUnderscore)) return true; }
    else if (v && typeof v === 'object' && containsUnderscore(v)) return true;
  }
  return false;
}

function wrapLambdas(ast) {
  // any call argument that mentions `_` becomes a one-param lambda
  if (!ast || typeof ast !== 'object') return ast;
  if (ast.k === 'call') {
    ast.callee = wrapLambdas(ast.callee);
    ast.args = ast.args.map(a => {
      a = wrapLambdas(a);
      if (containsUnderscore(a)) return { k: 'lambda', body: a, line: a.line };
      return a;
    });
    return ast;
  }
  for (const key of Object.keys(ast)) {
    const v = ast[key];
    if (Array.isArray(v)) ast[key] = v.map(wrapLambdas);
    else if (v && typeof v === 'object' && v.k) ast[key] = wrapLambdas(v);
  }
  return ast;
}

function parseExprText(text, line) {
  return wrapLambdas(new ExprParser(tokenize(text, line), line).parse());
}

/* ---------------- statement / block parser ---------------- */

function parseBlock(lines, start, indent) {
  const stmts = [];
  let i = start;
  while (i < lines.length && lines[i].indent >= indent) {
    if (lines[i].indent > indent) throw FabyError('unexpected indentation', lines[i].line);
    const L = lines[i];
    const text = L.text;
    let m;

    if ((m = text.match(/^use\s+\w+$/)) || (m = text.match(/^intent\s+".*"$/))) {
      i++; continue;
    }
    if ((m = text.match(/^(expect|ensure)\s+(.+)$/))) {
      stmts.push({ k: 'contract', kind: m[1], expr: parseExprText(m[2], L.line), line: L.line });
      i++; continue;
    }
    if ((m = text.match(/^type\s+\w+/))) {
      // skip type declarations (and their indented body)
      i++;
      while (i < lines.length && lines[i].indent > indent) i++;
      continue;
    }
    if ((m = text.match(/^flow\s+(\w+)\s*(?:\(([^)]*)\))?\s*(?:->\s*(.+))?$/))) {
      const name = m[1];
      const raw = (m[2] || '').split(',').map(p => p.trim()).filter(Boolean);
      const params = raw.map(p => p.split(':')[0].trim());
      const ptypes = raw.map(p => { const c = p.split(':'); return c[1] ? c[1].trim() : null; });
      const ret = m[3] ? m[3].trim() : null;
      const body = parseBlock(lines, i + 1, indent + 2);
      stmts.push({ k: 'flowdef', name, params, ptypes, ret, body: body.stmts, line: L.line });
      i = body.next; continue;
    }
    if ((m = text.match(/^test\s+"((?:[^"\\]|\\.)*)"$/))) {
      const body = parseBlock(lines, i + 1, indent + 2);
      stmts.push({ k: 'testblock', name: m[1], body: body.stmts, line: L.line });
      i = body.next; continue;
    }
    if ((m = text.match(/^spawn\s+for\s+(\w+)\s+in\s+(.+)$/))) {
      const body = parseBlock(lines, i + 1, indent + 2);
      stmts.push({ k: 'for', var: m[1], expr: parseExprText(m[2], L.line), body: body.stmts, line: L.line, spawned: true });
      i = body.next; continue;
    }
    if ((m = text.match(/^(let|mut)\s+(\w+)\s*=\s*(.+)$/))) {
      stmts.push({ k: 'decl', mut: m[1] === 'mut', name: m[2], expr: parseExprText(m[3], L.line), line: L.line });
      i++; continue;
    }
    if ((m = text.match(/^(\w+)\s*(\+=|-=|\*=|\/=)\s*(.+)$/))) {
      stmts.push({ k: 'aug', name: m[1], op: m[2][0], expr: parseExprText(m[3], L.line), line: L.line });
      i++; continue;
    }
    if ((m = text.match(/^(\w+)\s*=\s*([^=].*)$/)) && !text.startsWith('if') && !text.includes('==')) {
      stmts.push({ k: 'assign', name: m[1], expr: parseExprText(m[2], L.line), line: L.line });
      i++; continue;
    }
    if ((m = text.match(/^if\s+(.+)$/))) {
      const cond = parseExprText(m[1], L.line);
      const body = parseBlock(lines, i + 1, indent + 2);
      let elseBody = null; i = body.next;
      if (i < lines.length && lines[i].indent === indent && lines[i].text === 'else') {
        const eb = parseBlock(lines, i + 1, indent + 2);
        elseBody = eb.stmts; i = eb.next;
      }
      stmts.push({ k: 'if', cond, body: body.stmts, elseBody, line: L.line });
      continue;
    }
    if ((m = text.match(/^for\s+(\w+)\s+in\s+(.+)$/))) {
      const body = parseBlock(lines, i + 1, indent + 2);
      stmts.push({ k: 'for', var: m[1], expr: parseExprText(m[2], L.line), body: body.stmts, line: L.line });
      i = body.next; continue;
    }
    if ((m = text.match(/^match\s+(.+)$/))) {
      const subject = parseExprText(m[1], L.line);
      const arms = [];
      let j = i + 1;
      while (j < lines.length && lines[j].indent >= indent + 2) {
        const armText = lines[j].text;
        const am = armText.match(/^(.+?)\s*->\s*(.+)$/);
        if (!am) throw FabyError('invalid match arm', lines[j].line);
        let patText = am[1].trim();
        let guard = null;
        const gm = patText.match(/^(.+?)\s+if\s+(.+)$/);
        if (gm) { patText = gm[1].trim(); guard = parseExprText(gm[2], lines[j].line); }
        const alts = patText.split('|').map(p => p.trim()).map(p => {
          if (p === '_') return { any: true };
          return { expr: parseExprText(p, lines[j].line) };
        });
        arms.push({ alts, guard, result: parseExprText(am[2], lines[j].line), line: lines[j].line });
        j++;
      }
      if (!arms.length) throw FabyError('match needs at least one arm', L.line);
      stmts.push({ k: 'match', subject, arms, line: L.line });
      i = j; continue;
    }
    // plain expression statement
    stmts.push({ k: 'expr', expr: parseExprText(text, L.line), line: L.line });
    i++;
  }
  return { stmts, next: i };
}

/* ---------------- runtime ---------------- */

function Scope(parent) { this.vars = Object.create(null); this.parent = parent; }
Scope.prototype.get = function (name, line) {
  let s = this;
  while (s) { if (name in s.vars) return s.vars[name].v; s = s.parent; }
  throw FabyError('unknown name "' + name + '"', line);
};
Scope.prototype.declare = function (name, v, mut) { this.vars[name] = { v, mut }; };
Scope.prototype.set = function (name, v, line) {
  let s = this;
  while (s) {
    if (name in s.vars) {
      if (!s.vars[name].mut) throw FabyError('"' + name + '" is immutable — use mut to allow changes', line);
      s.vars[name].v = v; return;
    }
    s = s.parent;
  }
  throw FabyError('unknown name "' + name + '"', line);
};

function fmt(v) {
  if (v === null || v === undefined) return 'none';
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return String(v);
    return String(Math.round(v * 1e9) / 1e9);
  }
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (Array.isArray(v)) return '[' + v.map(fmt).join(', ') + ']';
  if (typeof v === 'object' && v.flow) return '<flow ' + (v.name || 'λ') + '>';
  if (typeof v === 'object') return '{' + Object.keys(v).map(k => k + ': ' + fmt(v[k])).join(', ') + '}';
  return String(v);
}

function truthy(v) { return !(v === false || v === null || v === undefined || v === 0); }

function Interp(output) {
  this.out = output;
  this.steps = 0;
  this.depth = 0;
  this.exprCache = new Map();
}

Interp.prototype.tick = function (line) {
  if (++this.steps > 1000000) throw FabyError('execution limit exceeded (possible infinite loop)', line);
};

Interp.prototype.builtins = function () {
  const self = this;
  const needList = (v, name, line) => {
    if (!Array.isArray(v)) throw FabyError(name + ' expects a list', line);
    return v;
  };
  const needNum = (v, name, line) => {
    if (typeof v !== 'number') throw FabyError(name + ' expects a number', line);
    return v;
  };
  return {
    print: (args) => { self.out.push(args.map(fmt).join(' ')); return null; },
    range: (a, line) => {
      const from = needNum(a[0], 'range', line), to = needNum(a[1], 'range', line);
      const step = a[2] !== undefined ? needNum(a[2], 'range', line) : 1;
      if (step === 0) throw FabyError('range step must not be 0', line);
      const r = [];
      if (step > 0) for (let x = from; x < to; x += step) { self.tick(line); r.push(x); }
      else for (let x = from; x > to; x += step) { self.tick(line); r.push(x); }
      return r;
    },
    map: (a, line) => needList(a[0], 'map', line).map(x => self.callValue(a[1], [x], line)),
    filter: (a, line) => needList(a[0], 'filter', line).filter(x => truthy(self.callValue(a[1], [x], line))),
    each: (a, line) => needList(a[0], 'each', line).map(x => self.callValue(a[1], [x], line)),
    sum: (a, line) => needList(a[0], 'sum', line).reduce((s, x) => s + x, 0),
    len: (a, line) => {
      const v = a[0];
      if (Array.isArray(v) || typeof v === 'string') return v.length;
      throw FabyError('len expects a list or text', line);
    },
    take: (a, line) => needList(a[0], 'take', line).slice(0, needNum(a[1], 'take', line)),
    drop: (a, line) => needList(a[0], 'drop', line).slice(needNum(a[1], 'drop', line)),
    reverse: (a, line) => Array.isArray(a[0]) ? a[0].slice().reverse()
      : typeof a[0] === 'string' ? a[0].split('').reverse().join('')
      : (() => { throw FabyError('reverse expects a list or text', line); })(),
    sort: (a, line) => needList(a[0], 'sort', line).slice().sort((x, y) => x < y ? -1 : x > y ? 1 : 0),
    join: (a, line) => needList(a[0], 'join', line).map(fmt).join(a[1] !== undefined ? a[1] : ''),
    split: (a, line) => String(a[0]).split(a[1] !== undefined ? a[1] : ' '),
    upper: (a) => String(a[0]).toUpperCase(),
    lower: (a) => String(a[0]).toLowerCase(),
    abs: (a, line) => Math.abs(needNum(a[0], 'abs', line)),
    min: (a, line) => Array.isArray(a[0]) ? Math.min(...a[0]) : Math.min(...a),
    max: (a, line) => Array.isArray(a[0]) ? Math.max(...a[0]) : Math.max(...a),
    sqrt: (a, line) => Math.sqrt(needNum(a[0], 'sqrt', line)),
    floor: (a, line) => Math.floor(needNum(a[0], 'floor', line)),
    round: (a, line) => Math.round(needNum(a[0], 'round', line)),
    push: (a, line) => needList(a[0], 'push', line).concat([a[1]]),
    contains: (a, line) => needList(a[0], 'contains', line).includes(a[1]),
    str: (a) => fmt(a[0]),
    int: (a, line) => {
      const n = parseInt(a[0], 10);
      if (Number.isNaN(n)) throw FabyError('cannot convert "' + fmt(a[0]) + '" to Int', line);
      return n;
    },
    now: () => { try { return new Date().toISOString(); } catch (e) { return ''; } },
    fail: (a, line) => { throw FabyError(a[0] !== undefined ? fmt(a[0]) : 'explicit fail', line); }
  };
};

/* ---- store module: tiny JSON-file persistence (Node-backed) ---- */
Interp.prototype.storeModule = function () {
  const nodeFs = () => {
    try { return require('fs'); }
    catch (e) { throw FabyError('store runs only in the faby CLI (Node), not the browser', 0); }
  };
  return {
    load: { native: true, fn: (a, line) => {
      const fs = nodeFs(); const path = a[0];
      try { if (!fs.existsSync(path)) return a[1] !== undefined ? a[1] : null;
        return JSON.parse(fs.readFileSync(path, 'utf8')); }
      catch (e) { return a[1] !== undefined ? a[1] : null; }
    } },
    save: { native: true, fn: (a, line) => {
      const fs = nodeFs();
      fs.writeFileSync(a[0], JSON.stringify(a[1], null, 2));
      return a[1];
    } }
  };
};

/* ---- http module (Node-backed; not available in the browser) ---- */
function matchPath(pattern, path) {
  const ps = pattern.split('/').filter(Boolean);
  const xs = path.split('/').filter(Boolean);
  if (ps.length !== xs.length) return null;
  const params = {};
  for (let i = 0; i < ps.length; i++) {
    if (ps[i][0] === ':') params[ps[i].slice(1)] = decodeURIComponent(xs[i]);
    else if (ps[i] !== xs[i]) return null;
  }
  return params;
}
function sendResult(res, v) {
  let status = 200, headers = {}, body;
  if (v && typeof v === 'object' && v.__resp) {
    status = v.status || 200;
    if (v.ctype) headers['content-type'] = v.ctype;
    if (v.headers) Object.assign(headers, v.headers);
    v = v.body;
  }
  if (v && typeof v === 'object') { headers['content-type'] = headers['content-type'] || 'application/json'; body = JSON.stringify(v); }
  else if (typeof v === 'string') { headers['content-type'] = headers['content-type'] || 'text/html; charset=utf-8'; body = v; }
  else { headers['content-type'] = headers['content-type'] || 'text/plain; charset=utf-8'; body = (v === null || v === undefined) ? '' : fmt(v); }
  res.writeHead(status, headers);
  res.end(body);
}

Interp.prototype.httpModule = function () {
  const self = this;
  const routes = [];
  const resp = (status, body, ctype) => ({ __resp: true, status, body, ctype });
  const reg = (method) => ({ native: true, fn: (a) => { routes.push({ method, path: a[0], handler: a[1] }); return null; } });
  return {
    get: reg('GET'), post: reg('POST'), put: reg('PUT'), delete: reg('DELETE'),
    json: { native: true, fn: (a) => resp(typeof a[1] === 'number' ? a[1] : 200, a[0], 'application/json') },
    html: { native: true, fn: (a) => resp(200, a[0], 'text/html; charset=utf-8') },
    text: { native: true, fn: (a) => resp(200, a[0], 'text/plain; charset=utf-8') },
    status: { native: true, fn: (a) => resp(a[0], a[1] !== undefined ? a[1] : '', null) },
    redirect: { native: true, fn: (a) => ({ __resp: true, status: 303, headers: { Location: a[0] || '/' }, body: '' }) },
    not_found: resp(404, 'Not Found', 'text/plain; charset=utf-8'),
    serve: { native: true, fn: (a, line) => self.startServer(routes, a[0] || 8080, line) }
  };
};

Interp.prototype.startServer = function (routes, port, line) {
  let nodeHttp;
  try { nodeHttp = require('http'); }
  catch (e) { throw FabyError('the http server runs only in the faby CLI (Node), not the browser playground', line); }
  const self = this;
  const server = nodeHttp.createServer((req, res) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      let urlObj; try { urlObj = new URL(req.url, 'http://localhost'); } catch (_) { urlObj = { pathname: req.url, searchParams: new Map() }; }
      const path = urlObj.pathname;
      let route = null, params = {};
      for (const r of routes) {
        if (r.method !== req.method) continue;
        const p = matchPath(r.path, path);
        if (p) { route = r; params = p; break; }
      }
      const query = {};
      if (urlObj.searchParams && urlObj.searchParams.forEach) urlObj.searchParams.forEach((v, k) => { query[k] = v; });
      const rawBody = Buffer.concat(chunks).toString();
      let body = rawBody;
      const ctype = req.headers['content-type'] || '';
      if (rawBody && /json/.test(ctype)) { try { body = JSON.parse(rawBody); } catch (_) {} }
      else if (rawBody && /urlencoded/.test(ctype)) { body = {}; new URLSearchParams(rawBody).forEach((v, k) => { body[k] = v; }); }
      if (!route) { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('Not Found'); return; }
      const reqRec = { method: req.method, path, params, query, body };
      self.steps = 0;                      // fresh execution budget per request
      const prevOut = self.out;
      self.out = { push: (l) => console.log(l) };
      try {
        const result = self.callValue(route.handler, [reqRec], line);
        self.out = prevOut;
        sendResult(res, result);
      } catch (err) {
        self.out = prevOut;
        const msg = err && err.faby ? err.message : 'internal error';
        res.writeHead(500, { 'content-type': 'text/plain' }); res.end('500: ' + msg);
        console.error('handler error on ' + req.method + ' ' + path + ': ' + msg);
      }
    });
  });
  server.on('error', (e) => { console.error('http server error: ' + e.message); });
  server.listen(port, () => { console.log('faby http · listening on http://localhost:' + port); });
  return null;
};

Interp.prototype.callValue = function (fn, args, line) {
  this.tick(line);
  if (fn && fn.native) return fn.fn(args, line);
  if (fn && fn.flow) {
    if (++this.depth > 200) { this.depth--; throw FabyError('recursion too deep (max 200)', line); }
    const scope = new Scope(fn.closure);
    fn.params.forEach((p, idx) => scope.declare(p, args[idx], false));
    if (fn.lambdaBody) {
      const r = this.evalExpr(fn.lambdaBody, scope);
      this.depth--; return r;
    }
    // `ensure` contracts run after the body, with `result` in scope
    const ensures = fn.body.filter(s => s.k === 'contract' && s.kind === 'ensure');
    const rest = fn.body.filter(s => !(s.k === 'contract' && s.kind === 'ensure'));
    const r = this.execBlock(rest, scope);
    if (ensures.length) {
      scope.declare('result', r, false);
      for (const en of ensures) {
        if (!truthy(this.evalExpr(en.expr, scope)))
          throw FabyError('contract violated: ensure', en.line);
      }
    }
    this.depth--; return r;
  }
  throw FabyError('"' + fmt(fn) + '" is not callable', line);
};

Interp.prototype.evalExpr = function (e, scope) {
  this.tick(e.line);
  switch (e.k) {
    case 'num': return e.v;
    case 'bool': return e.v;
    case 'str': {
      let s = '';
      for (const p of e.parts) {
        if (p.t === 'text') s += p.v;
        else {
          let ast = this.exprCache.get(p);
          if (!ast) { ast = parseExprText(p.v, e.line); this.exprCache.set(p, ast); }
          s += fmt(this.evalExpr(ast, scope));
        }
      }
      return s;
    }
    case 'id': return scope.get(e.name, e.line);
    case 'list': return e.items.map(x => this.evalExpr(x, scope));
    case 'record': {
      const o = {};
      for (const p of e.pairs) o[p.key] = this.evalExpr(p.val, scope);
      return o;
    }
    case 'lambda': {
      return { flow: true, name: 'λ', params: ['_'], lambdaBody: e.body, closure: scope };
    }
    case 'neg': {
      const v = this.evalExpr(e.e, scope);
      if (typeof v !== 'number') throw FabyError('cannot negate ' + fmt(v), e.line);
      return -v;
    }
    case 'not': return !truthy(this.evalExpr(e.e, scope));
    case 'await': return this.evalExpr(e.e, scope);  // structured concurrency: deterministic in the Genesis runtime
    case 'member': {
      const obj = this.evalExpr(e.obj, scope);
      if (e.name === 'len' && (Array.isArray(obj) || typeof obj === 'string')) return obj.length;
      if (obj && typeof obj === 'object' && !Array.isArray(obj) && !obj.flow && (e.name in obj)) return obj[e.name];
      throw FabyError('unknown property ".' + e.name + '" on ' + fmt(obj), e.line);
    }
    case 'call': {
      const args = e.args.map(a => this.evalExpr(a, scope));
      const fn = this.evalExpr(e.callee, scope);
      return this.callValue(fn, args, e.line);
    }
    case 'recover': {
      try {
        return this.evalExpr(e.expr, scope);
      } catch (err) {
        if (!err.faby) throw err;
        if (e.handler === 'default') return e.arg ? this.evalExpr(e.arg, scope) : null;
        if (e.handler === 'skip') return null;
        if (e.handler === 'retry') {
          const n = e.arg ? this.evalExpr(e.arg, scope) : 1;
          let last = err;
          for (let i = 0; i < n; i++) {
            try { return this.evalExpr(e.expr, scope); } catch (er2) { if (!er2.faby) throw er2; last = er2; }
          }
          throw last;
        }
        throw err; // ? fail
      }
    }
    case 'bin': {
      if (e.op === 'and') return truthy(this.evalExpr(e.l, scope)) ? this.evalExpr(e.r, scope) : false;
      if (e.op === 'or') {
        const l = this.evalExpr(e.l, scope);
        return truthy(l) ? l : this.evalExpr(e.r, scope);
      }
      const l = this.evalExpr(e.l, scope), r = this.evalExpr(e.r, scope);
      switch (e.op) {
        case '+':
          if (typeof l === 'string' || typeof r === 'string') return fmt(l) + fmt(r);
          if (Array.isArray(l) && Array.isArray(r)) return l.concat(r);
          if (typeof l === 'number' && typeof r === 'number') return l + r;
          throw FabyError('cannot add ' + fmt(l) + ' and ' + fmt(r), e.line);
        case '-': case '*': case '/': case '%': {
          if (typeof l !== 'number' || typeof r !== 'number')
            throw FabyError('arithmetic needs numbers, got ' + fmt(l) + ' and ' + fmt(r), e.line);
          if (e.op === '-') return l - r;
          if (e.op === '*') return l * r;
          if (e.op === '/') {
            if (r === 0) throw FabyError('division by zero', e.line);
            return l / r;
          }
          if (r === 0) throw FabyError('modulo by zero', e.line);
          return l % r;
        }
        case '==': return fmt(l) === fmt(r);
        case '!=': return fmt(l) !== fmt(r);
        case '<': return l < r;
        case '>': return l > r;
        case '<=': return l <= r;
        case '>=': return l >= r;
      }
      throw FabyError('unknown operator ' + e.op, e.line);
    }
  }
  throw FabyError('cannot evaluate expression', e.line);
};

Interp.prototype.execBlock = function (stmts, scope) {
  let last = null;
  for (const st of stmts) {
    this.tick(st.line);
    switch (st.k) {
      case 'flowdef':
        scope.declare(st.name, { flow: true, name: st.name, params: st.params, body: st.body, closure: scope }, false);
        break;
      case 'testblock':
        break;  // test blocks are ignored by `run`; executed by `faby test`

      case 'decl':
        scope.declare(st.name, this.evalExpr(st.expr, scope), st.mut);
        break;
      case 'assign':
        scope.set(st.name, this.evalExpr(st.expr, scope), st.line);
        break;
      case 'aug': {
        const cur = scope.get(st.name, st.line);
        const delta = this.evalExpr(st.expr, scope);
        let v;
        if (st.op === '+') v = (typeof cur === 'string') ? cur + fmt(delta) : cur + delta;
        else if (st.op === '-') v = cur - delta;
        else if (st.op === '*') v = cur * delta;
        else v = cur / delta;
        scope.set(st.name, v, st.line);
        break;
      }
      case 'contract': {
        const ok = truthy(this.evalExpr(st.expr, scope));
        if (!ok) throw FabyError('contract violated: ' + st.kind, st.line);
        break;
      }
      case 'if': {
        if (truthy(this.evalExpr(st.cond, scope))) last = this.execBlock(st.body, new Scope(scope));
        else if (st.elseBody) last = this.execBlock(st.elseBody, new Scope(scope));
        break;
      }
      case 'for': {
        const it = this.evalExpr(st.expr, scope);
        const arr = Array.isArray(it) ? it : (typeof it === 'string' ? it.split('') : null);
        if (!arr) throw FabyError('for needs a list, got ' + fmt(it), st.line);
        for (const x of arr) {
          this.tick(st.line);
          const s2 = new Scope(scope);
          s2.declare(st.var, x, false);
          this.execBlock(st.body, s2);
        }
        break;
      }
      case 'match': {
        const subj = this.evalExpr(st.subject, scope);
        let matched = false;
        for (const arm of st.arms) {
          let hit = arm.alts.some(alt => alt.any || fmt(this.evalExpr(alt.expr, scope)) === fmt(subj));
          if (hit && arm.guard) hit = truthy(this.evalExpr(arm.guard, scope));
          if (hit) { last = this.evalExpr(arm.result, scope); matched = true; break; }
        }
        if (!matched) throw FabyError('no match arm matched ' + fmt(subj) + ' — add a "_" arm', st.line);
        break;
      }
      case 'expr':
        last = this.evalExpr(st.expr, scope);
        break;
    }
  }
  return last;
};

/* ---------------- entry point ---------------- */

function runFaby(source) {
  const output = [];
  const t0 = Date.now();
  try {
    const lines = logicalLines(source);
    if (!lines.length) return { output, error: 'nothing to run — write some Faby first', ms: 0 };
    const block = parseBlock(lines, 0, 0);
    const interp = new Interp(output);
    const root = new Scope(null);
    const b = interp.builtins();
    for (const name of Object.keys(b)) root.declare(name, { native: true, fn: b[name] }, false);
    root.declare('http', interp.httpModule(), false);   // `use http` module
    root.declare('store', interp.storeModule(), false);  // `use store` module
    interp.execBlock(block.stmts, root);
    const main = root.vars.main;
    if (main && main.v && main.v.flow) interp.callValue(main.v, [], 1);
    else if (block.stmts.every(s => s.k === 'flowdef'))
      return { output, error: 'no "flow main" found — add one as the entry point', ms: Date.now() - t0 };
    return { output, error: null, ms: Date.now() - t0 };
  } catch (err) {
    if (err && err.faby) {
      const where = err.fabyLine ? ' (line ' + err.fabyLine + ')' : '';
      return { output, error: err.message + where, ms: Date.now() - t0 };
    }
    return { output, error: 'internal playground error: ' + err.message, ms: Date.now() - t0 };
  }
}

// ---- exports for tooling (fmt / check) ----
function parseProgram(source) {
  const lines = logicalLines(source);
  return parseBlock(lines, 0, 0).stmts;
}
function builtinNames() {
  try { return Object.keys(new Interp([]).builtins()).concat(['http', 'store']); } catch (e) { return ['http', 'store']; }
}

global.runFaby = runFaby;
global.fabyParseProgram = parseProgram;
global.fabyBuiltinNames = builtinNames;
if (typeof module !== 'undefined' && module.exports)
  module.exports = { runFaby, parseProgram, builtinNames };
})(typeof window !== 'undefined' ? window : globalThis);
