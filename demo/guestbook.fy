-- The Faby Guestbook — a complete web app written in Faby.
-- The UI is declarative (use ui) and compiles to HTML/CSS. No raw markup.
-- Run: faby run guestbook.fy   (serves on :8080, persists to guestbook.json)
use http
use store
use ui

flow entries() -> [Text]
  store.load("guestbook.json", [])

intent "render one guestbook entry as a card"
flow row(e)
  ui.item([
    ui.row([ui.strong(e.name), ui.muted(e.at)]),
    ui.p(e.message)
  ])

intent "the whole page, built from Faby components"
flow page(req)
  ui.page("Faby Guestbook", [
    ui.h1("The Faby Guestbook"),
    ui.muted("This page is built with Faby components (use ui) and served by faby run. Sign it below."),
    ui.form("/guestbook/sign", [
      ui.input("name", "your name"),
      ui.textarea("message", "say hi to the AI-native language"),
      ui.button("Sign the guestbook")
    ]),
    ui.list(entries() |> map(row)),
    ui.box([ui.link("https://faby.codes", "Powered by Faby — faby.codes")])
  ])

intent "append a signed entry, persist it, redirect home"
flow sign(req) -> Text
  let entry = {name: req.body.name ? default("anon"), message: req.body.message ? default("(empty)"), at: now()}
  store.save("guestbook.json", push(entries(), entry))
  http.redirect("/guestbook")

flow api(req)
  entries()

flow main
  http.get("/guestbook", page)
  http.post("/guestbook/sign", sign)
  http.get("/guestbook/api", api)
  http.serve(8080)
