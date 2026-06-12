-- The Faby Guestbook — a real web app, written in Faby, running in production.
-- Run: faby run guestbook.fy   (serves on :8080, persists to guestbook.json)
use http
use store

flow entries() -> [Text]
  store.load("guestbook.json", [])

flow row(e) -> Text
  "<li><b>{e.name}</b><span>{e.at}</span><p>{e.message}</p></li>"

flow page(req) -> Text
  let items = entries() |> map(row) |> join("")
  mut html = "<!doctype html><html><head><meta charset=utf-8><title>Faby Guestbook</title>"
  html += "<meta name=viewport content='width=device-width,initial-scale=1'>"
  html += "<style>body\{background:#030303;color:#f0f0f0;font-family:system-ui,sans-serif;max-width:680px;margin:0 auto;padding:48px 20px}"
  html += "h1\{letter-spacing:-1px}a\{color:#fff}form\{display:flex;flex-direction:column;gap:10px;margin:24px 0}"
  html += "input,textarea\{background:#0a0a0a;border:1px solid #2c2c2c;border-radius:8px;color:#fff;padding:12px;font:inherit}"
  html += "button\{background:#fff;color:#000;border:0;border-radius:8px;padding:12px;font-weight:700;cursor:pointer}"
  html += "ul\{list-style:none;padding:0}li\{border:1px solid #1d1d1d;border-radius:10px;padding:14px 16px;margin:10px 0}"
  html += "li span\{color:#5a5a5a;font-size:12px;margin-left:8px}li p\{color:#8f8f8f;margin:6px 0 0}.t\{color:#5a5a5a;font-family:monospace;font-size:12px}</style></head><body>"
  html += "<h1>The Faby Guestbook</h1>"
  html += "<p class=t>This page &amp; its backend are written in Faby, served by <b>faby run</b>, and persisted with <b>use store</b>. Sign it below.</p>"
  html += "<form method=post action=/guestbook/sign>"
  html += "<input name=name placeholder='your name' maxlength=40 required>"
  html += "<textarea name=message placeholder='say hi to the AI-native language' maxlength=240 required></textarea>"
  html += "<button>Sign the guestbook</button></form>"
  html += "<ul>{items}</ul>"
  html += "<p class=t>Powered by <a href='https://faby.codes'>faby.codes</a> &#183; npm i -g @fabycode/cli</p>"
  html += "</body></html>"
  html

intent "append a signed entry, persist it, redirect home"
flow sign(req) -> Text
  let name = req.body.name ? default("anon")
  let msg = req.body.message ? default("(empty)")
  let entry = {name: name, message: msg, at: now()}
  store.save("guestbook.json", push(entries(), entry))
  http.redirect("/guestbook")

flow api(req)
  entries()

flow main
  http.get("/guestbook", page)
  http.post("/guestbook/sign", sign)
  http.get("/guestbook/api", api)
  http.serve(8080)
