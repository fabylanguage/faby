-- a real web server in Faby — run with: faby run server.fy
use http

flow home(req) -> Text
  "<h1>Hello from Faby</h1><p>A web server, written in the AI-native language.</p>"

flow greet(req) -> Text
  "Hi, {req.params.name}!"

flow add(req)
  {sum: req.body.a + req.body.b}

flow main
  http.get("/", home)
  http.get("/hi/:name", greet)
  http.post("/add", add)
  http.serve(8080)
