# recette

[![npm version](https://img.shields.io/npm/v/recette)](https://www.npmjs.com/package/recette?activeTab=versions)
[![npm downloads](https://img.shields.io/npm/d18m/recette)](https://www.npmjs.com/package/recette)
[![npm license](https://img.shields.io/npm/l/recette)](https://github.com/3w36zj6/recette/blob/HEAD/LICENSE)
[![CI](https://github.com/3w36zj6/recette/actions/workflows/ci.yaml/badge.svg?branch=main&event=push)](https://github.com/3w36zj6/recette/actions/workflows/ci.yaml)

A type-safe, declarative CLI framework that lets you define your command-line tools clearly and intuitively.

## Features

- **Declarative and Simple API**
  - Define commands, arguments, flags, and options in a clear and concise way. The API is designed to be intuitive and easy to read, so you can focus on what your CLI should do, not how to parse arguments. The command "signature"—a string that describes the structure of your command (e.g., `copy [src] [dest?] --force|-f`)—makes the command structure explicit and easy to understand.
- **Type Safety by Design**
  - All command definitions are fully type-safe. Argument and option types are inferred directly from your command signature, catching mistakes at compile time and providing a smooth developer experience with IDE autocompletion and error checking.
- **Strong Constraints for Reliability**
  - The framework enforces strict rules on command definitions, argument names, and flag patterns. This prevents ambiguous or invalid CLI specifications, reducing runtime errors and making your CLI tools more robust and maintainable.

## Installation

To get started, install recette using your preferred package manager:

```sh
# npm
npm install recette

# Yarn
yarn add recette

# pnpm
pnpm add recette

# Bun
bun add recette
```

## Usage

> [!NOTE]
> This framework is experimental. The API is subject to frequent changes.

Here is an example of how to develop a CLI tool using this framework:

```ts
// mycli.ts

import { Cli } from "recette"

// Create a new CLI instance
type Variables = {
  userName?: string
}

const cli = new Cli<{ Variables: Variables }>({
  name: "mycli",
})

// Simple positional argument
cli.command("hello [name]", (c) => {
  const name = c.arg("name") // (name: "name") => string
  console.log(`Hello, ${name}!`)
})

// Required and optional positional arguments
cli.command("copy [src] [dest?]", (c) => {
  const src = c.arg("src") // (name: "src") => string
  const dest = c.arg("dest") // (name: "dest") => string | undefined
  console.log(`Copy from ${src} to ${dest ?? "(not specified)"}`)
})

// Optional argument and flags
cli.command("list [dir?] --long|-l --all|-a", (c) => {
  const dir = c.arg("dir") // (name: "dir") => string | undefined
  const isLong = c.flag("long") // (name: "long" | "all"): boolean
  const showAll = c.flag("all") // (name: "long" | "all"): boolean
  console.log(`List ${dir ?? "current directory"} (long=${isLong}, all=${showAll})`)
})

// Options with values
cli.command("commit --message|-m=<string> --author=<string>", (c) => {
  const message = c.option("message") // (name: "message" | "author"): string | undefined
  const author = c.option("author") // (name: "message" | "author"): string | undefined
  console.log(`Commit: "${message}" by ${author}`)
})

// Variadic arguments
cli.command("remove [...files]", (c) => {
  const files = c.args("files") // (name: "files") => string[]
  console.log(`Remove files: ${files.join(", ")}`)
})

// Accessing stored variables
cli.command("whoami", (c) => {
  const user = c.get("userName") // (key: "userName") => string | undefined
  if (user) {
    console.log(`Current user: ${user}`)
  } else {
    console.log("No user specified.")
  }
})

// Subcommand group
const branchCli = new Cli({ name: "branch" })

branchCli.command("list --remote", (c) => {
  const remote = c.flag("remote")
  console.log(`Branch list (remote: ${remote})`)
})
branchCli.command("delete [name]", (c) => {
  const name = c.arg("name")
  console.log(`Delete branch: ${name}`)
})

// Nested command group
const featureCli = new Cli({ name: "feature" })

featureCli.command("start [name]", (c) => {
  const name = c.arg("name")
  console.log(`Start feature: ${name}`)
})

// Mounting subcommands
branchCli.mount("feature", featureCli)
cli.mount("branch", branchCli)

// Middleware
cli.use("--verbose|-v", async (c, next) => {
  if (c.flag("verbose")) {
    console.log("[verbose] Command execution started")
  }
  await next()
  if (c.flag("verbose")) {
    console.log("[verbose] Command execution finished")
  }
})

cli.use("--user=<string>", async (c, next) => {
  const user = c.option("user")
  if (user) {
    c.set("userName", user)
  }
  await next()
})

// Run CLI
cli.run()
```

<p align="center">
  <img src="./docs/images/usage.png" alt="Example of CLI usage output">
</p>

You can distribute your CLI tool via npmjs, or create a single executable file using Bun or Deno.
For example, to create a standalone executable with Bun, run the following command:

```sh
bun build mycli.ts --compile --outfile mycli
```

For more details, see [Single-file executable – Runtime | Bun Docs](https://bun.sh/docs/bundler/executables).

## Contributing

> [!NOTE]
> This framework is a work in progress. The implementation is verbose, tests are not comprehensive, and many features are missing.
>
> If you have any useful feedback or suggestions, feel free to contribute!

The development toolchain is managed with [mise](https://mise.jdx.dev/). To install it, run:

```sh
mise install
```

Dependencies are managed with [Bun](https://bun.sh). To install them, run:

```sh
bun install --frozen-lockfile
```
