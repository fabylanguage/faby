// One identical tokenizer for ALL languages: words (\w+) = 1 token,
// every other non-space character = 1 token. Reproducible & fair.
function tokens(code){ return (code.match(/\w+|[^\s\w]/g)||[]).length; }
function chars(code){ return code.replace(/\n+$/,'').length; }

const T = {};

T.fizzbuzz = {
python:`for i in range(1, 21):
    if i % 15 == 0:
        print("FizzBuzz")
    elif i % 3 == 0:
        print("Fizz")
    elif i % 5 == 0:
        print("Buzz")
    else:
        print(i)`,
typescript:`for (let i = 1; i <= 20; i++) {
  if (i % 15 === 0) console.log("FizzBuzz");
  else if (i % 3 === 0) console.log("Fizz");
  else if (i % 5 === 0) console.log("Buzz");
  else console.log(i);
}`,
rust:`fn main() {
    for i in 1..=20 {
        if i % 15 == 0 {
            println!("FizzBuzz");
        } else if i % 3 == 0 {
            println!("Fizz");
        } else if i % 5 == 0 {
            println!("Buzz");
        } else {
            println!("{}", i);
        }
    }
}`,
faby:`flow fizzbuzz(n: Int) -> Text
  match n
    _ if n % 15 == 0 -> "FizzBuzz"
    _ if n % 3 == 0  -> "Fizz"
    _ if n % 5 == 0  -> "Buzz"
    _                -> str(n)

flow main
  range(1, 21) |> map(fizzbuzz) |> each(print)`
};

T.discount = {
python:`def discount(prices):
    result = []
    for p in prices:
        if p > 50:
            result.append(p * 0.9)
        else:
            result.append(p)
    return result

print(discount([20, 60, 99, 45, 120]))`,
typescript:`function discount(prices: number[]): number[] {
  return prices.map((p) => (p > 50 ? p * 0.9 : p));
}

console.log(discount([20, 60, 99, 45, 120]));`,
rust:`fn discount(prices: &[f64]) -> Vec<f64> {
    prices.iter().map(|&p| if p > 50.0 { p * 0.9 } else { p }).collect()
}

fn main() {
    println!("{:?}", discount(&[20.0, 60.0, 99.0, 45.0, 120.0]));
}`,
faby:`flow discount(p: Float) -> Float
  match p
    _ if p > 50 -> p * 0.9
    _           -> p

flow main
  [20, 60, 99, 45, 120] |> map(discount) |> each(print)`
};

T.evens = {
python:`total = 0
for n in range(1, 101):
    if n % 2 == 0:
        total += n
print(total)`,
typescript:`let total = 0;
for (let n = 1; n <= 100; n++) {
  if (n % 2 === 0) total += n;
}
console.log(total);`,
rust:`fn main() {
    let total: i32 = (1..=100).filter(|n| n % 2 == 0).sum();
    println!("{}", total);
}`,
faby:`flow main
  let total = range(1, 101)
    |> filter(_ % 2 == 0)
    |> sum
  print(total)`
};

T.shout = {
python:`def shout(words):
    return [w.upper() + "!" for w in words]

for s in shout(["faby", "rust", "python"]):
    print(s)`,
typescript:`function shout(words: string[]): string[] {
  return words.map((w) => w.toUpperCase() + "!");
}

for (const s of shout(["faby", "rust", "python"])) {
  console.log(s);
}`,
rust:`fn shout(words: &[&str]) -> Vec<String> {
    words.iter().map(|w| format!("{}!", w.to_uppercase())).collect()
}

fn main() {
    for s in shout(&["faby", "rust", "python"]) {
        println!("{}", s);
    }
}`,
faby:`flow shout(t: Text) -> Text
  upper(t) + "!"

flow main
  ["faby", "rust", "python"] |> map(shout) |> each(print)`
};

T.user = {
python:`from dataclasses import dataclass

@dataclass
class User:
    id: int
    name: str
    email: str

def greet(u: User) -> str:
    return f"Hi {u.name} <{u.email}>"

print(greet(User(1, "Ada", "ada@faby.dev")))`,
typescript:`interface User {
  id: number;
  name: string;
  email: string;
}

function greet(u: User): string {
  return \`Hi \${u.name} <\${u.email}>\`;
}

console.log(greet({ id: 1, name: "Ada", email: "ada@faby.dev" }));`,
rust:`struct User {
    id: u32,
    name: String,
    email: String,
}

fn greet(u: &User) -> String {
    format!("Hi {} <{}>", u.name, u.email)
}

fn main() {
    let u = User { id: 1, name: "Ada".into(), email: "ada@faby.dev".into() };
    println!("{}", greet(&u));
}`,
faby:`type User
  id:    Id
  name:  Text
  email: Email

flow greet(u: User) -> Text
  "Hi {u.name} <{u.email}>"

flow main
  print(greet(User(id: 1, name: "Ada", email: "ada@faby.dev")))`
};

const langs=["python","typescript","rust","faby"];
let sumOther=0,sumFaby=0,charOther=0,charFaby=0;
const rows={};
for(const [task,impls] of Object.entries(T)){
  rows[task]={};
  for(const l of langs){rows[task][l]={t:tokens(impls[l]),c:chars(impls[l])};}
  const others=["python","typescript","rust"].map(l=>rows[task][l].t);
  const avgOther=others.reduce((a,b)=>a+b,0)/others.length;
  sumOther+=avgOther; sumFaby+=rows[task].faby.t;
  const co=["python","typescript","rust"].map(l=>rows[task][l].c);
  charOther+=co.reduce((a,b)=>a+b,0)/co.length; charFaby+=rows[task].faby.c;
  rows[task].reduction=Math.round((1-rows[task].faby.t/avgOther)*100);
}
console.log("task        py  ts  rs  FABY  | vs-avg-reduction");
for(const [task,r] of Object.entries(rows)){
  console.log(task.padEnd(11),
    String(r.python.t).padStart(3),String(r.typescript.t).padStart(3),
    String(r.rust.t).padStart(3),String(r.faby.t).padStart(4),
    "  -"+r.reduction+"%");
}
console.log("\nOVERALL token reduction vs avg(py,ts,rs):", Math.round((1-sumFaby/sumOther)*100)+"%");
console.log("OVERALL char  reduction vs avg(py,ts,rs):", Math.round((1-charFaby/charOther)*100)+"%");
// emit JSON for the page
const out={tasks:rows, overallTokens:Math.round((1-sumFaby/sumOther)*100), overallChars:Math.round((1-charFaby/charOther)*100)};
require('fs').writeFileSync('/tmp/bench-data.json',JSON.stringify(out,null,2));
