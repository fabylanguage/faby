-- hello.fy — run with: faby run hello.fy

flow greet(name: Text) -> Text
  "Hello, {name} — welcome to Faby."

flow main
  let names = ["World", "Fable-5", "you"]
  names |> map(greet) |> each(print)
