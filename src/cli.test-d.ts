import { describe, expectTypeOf, it } from "vitest";
import { Cli } from "./cli";

describe("Cli", () => {
	it("should correctly infer types for TestCommand1: copy [src] [dest?]", () => {
		const cli = new Cli({ name: "test-cli" });

		cli.command("copy [src] [dest?]", (c) => {
			const src = c.arg("src");
			expectTypeOf<typeof src>().toEqualTypeOf<string>();

			const dest = c.arg("dest");
			expectTypeOf<typeof dest>().toEqualTypeOf<string | undefined>();
		});

		cli.run(["copy", "file1.txt", "file2.txt"]);
	});

	it("should correctly infer types for TestCommand2: hello [name]", () => {
		const cli = new Cli({ name: "test-cli" });

		cli.command("hello [name]", (c) => {
			const name = c.arg("name");
			expectTypeOf(name).toEqualTypeOf<string>();
		});
	});

	it("should correctly infer types for TestCommand3: list [dir?]", () => {
		const cli = new Cli({ name: "test-cli" });

		cli.command("list [dir?]", (c) => {
			const dir = c.arg("dir");
			expectTypeOf(dir).toEqualTypeOf<string | undefined>();
		});
	});

	it("should correctly infer types for TestCommand4: build [src?] [dest] [output?]", () => {
		const cli = new Cli({ name: "test-cli" });

		cli.command("build [src?] [dest] [output?]", (c) => {
			const src = c.arg("src");
			expectTypeOf(src).toEqualTypeOf<string | undefined>();

			const dest = c.arg("dest");
			expectTypeOf(dest).toEqualTypeOf<string>();

			const output = c.arg("output");
			expectTypeOf(output).toEqualTypeOf<string | undefined>();
		});
	});

	it("should correctly infer types for complex mixed arguments", () => {
		const cli = new Cli({ name: "test-cli" });

		cli.command("deploy [env] [region?] [version] [config?]", (c) => {
			const env = c.arg("env");
			expectTypeOf(env).toEqualTypeOf<string>();

			const region = c.arg("region");
			expectTypeOf(region).toEqualTypeOf<string | undefined>();

			const version = c.arg("version");
			expectTypeOf(version).toEqualTypeOf<string>();

			const config = c.arg("config");
			expectTypeOf(config).toEqualTypeOf<string | undefined>();
		});
	});

	it("should correctly infer types for commands with no arguments", () => {
		const cli = new Cli({ name: "test-cli" });

		cli.command("status", (c) => {
			// @ts-expect-error
			const anyArg = c.arg("nonexistent");
			expectTypeOf(anyArg).toEqualTypeOf<never>();
		});
	});

	it("should not allow short-only flag definitions", () => {
		const cli = new Cli({ name: "test-cli" });
		// @ts-expect-error
		cli.command("foo -f", (c) => {
			expectTypeOf(c.flag).parameter(0).toEqualTypeOf<never>();
			// @ts-expect-error
			c.flag("f");
		});
	});

	it("should not allow wrong order or double long flag definitions", () => {
		const cli = new Cli({ name: "test-cli" });
		// @ts-expect-error
		cli.command("foo -f|--flag", (c) => {
			expectTypeOf(c.flag).parameter(0).toEqualTypeOf<never>();
			// @ts-expect-error
			c.flag("flag");
		});
		// @ts-expect-error
		cli.command("foo --flag|--f", (c) => {
			expectTypeOf(c.flag).parameter(0).toEqualTypeOf<never>();
			// @ts-expect-error
			c.flag("flag");
		});
	});

	it("should not allow long flag with only one character", () => {
		const cli = new Cli({ name: "test-cli" });
		// @ts-expect-error
		cli.command("build --v", (c) => {
			expectTypeOf(c.flag).parameter(0).toEqualTypeOf<never>();
			// @ts-expect-error
			c.flag("v");
		});
	});

	it("should correctly infer types for multiple mixed flags", () => {
		const cli = new Cli({ name: "test-cli" });

		cli.command("foo --bar|-b --baz", (c) => {
			expectTypeOf(c.flag).parameter(0).toEqualTypeOf<"bar" | "baz">();

			const bar = c.flag("bar");
			expectTypeOf(bar).toEqualTypeOf<boolean>();

			const baz = c.flag("baz");
			expectTypeOf(baz).toEqualTypeOf<boolean>();
		});
	});

	it("should correctly infer types for options", () => {
		const cli = new Cli({ name: "test-cli" });

		cli.command("commit --message=<string> --author=<string>", (c) => {
			expectTypeOf(c.option).parameter(0).toEqualTypeOf<"message" | "author">();

			const message = c.option("message");
			expectTypeOf(message).toEqualTypeOf<string | undefined>();

			const author = c.option("author");
			expectTypeOf(author).toEqualTypeOf<string | undefined>();
		});

		cli.command("foo --bar|-b=<string>", (c) => {
			expectTypeOf(c.option).parameter(0).toEqualTypeOf<"bar">();

			const bar = c.option("bar");
			expectTypeOf(bar).toEqualTypeOf<string | undefined>();
		});
	});

	it("should not allow short-only option definitions", () => {
		const cli = new Cli({ name: "test-cli" });
		// @ts-expect-error
		cli.command("foo -m=<string>", (c) => {
			expectTypeOf(c.option).parameter(0).toEqualTypeOf<never>();
			// @ts-expect-error
			c.option("m");
		});
	});

	it("should not allow long option with only one character", () => {
		const cli = new Cli({ name: "test-cli" });
		// @ts-expect-error
		cli.command("foo --m=<string>", (c) => {
			expectTypeOf(c.option).parameter(0).toEqualTypeOf<never>();
			// @ts-expect-error
			c.option("m");
		});
	});

	it("should not allow double long option or wrong order", () => {
		const cli = new Cli({ name: "test-cli" });
		// @ts-expect-error
		cli.command("foo --option|--o=<string>", (c) => {
			expectTypeOf(c.option).parameter(0).toEqualTypeOf<never>();
			// @ts-expect-error
			c.option("option");
		});
		// @ts-expect-error
		cli.command("foo -m|--option=<string>", (c) => {
			expectTypeOf(c.option).parameter(0).toEqualTypeOf<never>();
			// @ts-expect-error
			c.option("option");
		});
	});

	it("should not include variadic argument in arg() candidates", () => {
		const cli = new Cli({ name: "test-cli" });

		cli.command("cat [file] [...files]", (c) => {
			expectTypeOf(c.arg).parameter(0).toEqualTypeOf<"file">();
			const file = c.arg("file");
			expectTypeOf(file).toEqualTypeOf<string>();

			expectTypeOf(c.args).parameter(0).toEqualTypeOf<"files">();
			const files = c.args("files");
			expectTypeOf(files).toEqualTypeOf<string[]>();
		});
	});

	it("should infer types correctly for variadic argument with flags and options", () => {
		const cli = new Cli({ name: "test-cli" });

		cli.command("cat [...files] --flag --opt=<string>", (c) => {
			expectTypeOf(c.args).parameter(0).toEqualTypeOf<"files">();
			const files = c.args("files");
			expectTypeOf(files).toEqualTypeOf<string[]>();

			expectTypeOf(c.flag).parameter(0).toEqualTypeOf<"flag">();
			const flag = c.flag("flag");
			expectTypeOf(flag).toEqualTypeOf<boolean>();

			expectTypeOf(c.option).parameter(0).toEqualTypeOf<"opt">();
			const opt = c.option("opt");
			expectTypeOf(opt).toEqualTypeOf<string | undefined>();
		});
	});

	it("should infer types correctly for mount() subcommand grouping and nesting", () => {
		const featureCli = new Cli({ name: "feature-cli" });
		featureCli.command("start [name]", (c) => {
			expectTypeOf(c.arg("name")).toEqualTypeOf<string>();
		});

		const branchCli = new Cli({ name: "branch-cli" });
		branchCli.command("list --remote", (c) => {
			expectTypeOf(c.flag("remote")).toEqualTypeOf<boolean>();
		});
		branchCli.command("delete [name]", (c) => {
			expectTypeOf(c.arg("name")).toEqualTypeOf<string>();
		});
		branchCli.mount("feature", featureCli);

		const cli = new Cli({ name: "mycli" });
		cli.mount("branch", branchCli);
	});

	it("should infer types correctly for multiple levels of mount() nesting", () => {
		const deepCli = new Cli({ name: "deep-cli" });
		deepCli.command("info [topic] --verbose", (c) => {
			expectTypeOf(c.arg("topic")).toEqualTypeOf<string>();
			expectTypeOf(c.flag("verbose")).toEqualTypeOf<boolean>();
			const topic = c.arg("topic");
			const verbose = c.flag("verbose");
			expectTypeOf(topic).toEqualTypeOf<string>();
			expectTypeOf(verbose).toEqualTypeOf<boolean>();
		});

		const subCli = new Cli({ name: "sub-cli" });
		subCli.command("foo [bar]", (c) => {
			expectTypeOf(c.arg("bar")).toEqualTypeOf<string>();
			const bar = c.arg("bar");
			expectTypeOf(bar).toEqualTypeOf<string>();
		});
		subCli.mount("deep", deepCli);

		const rootCli = new Cli({ name: "root-cli" });
		rootCli.mount("sub", subCli);
	});

	it("should infer types correctly for direct subcommand definition with spaces", () => {
		const cli = new Cli({ name: "mycli" });
		cli.command("branch list --remote", (c) => {
			expectTypeOf(c.flag("remote")).toEqualTypeOf<boolean>();
		});
	});

	it("should not allow invalid command definitions", () => {
		const cli = new Cli({ name: "test-cli" });

		// @ts-expect-error
		cli.command("foo [...a] [...b]", () => {});

		// @ts-expect-error
		cli.command("foo [...a] [b]", () => {});

		// @ts-expect-error
		cli.command("foo [bar] [bar]", () => {});

		// @ts-expect-error
		cli.command("foo -f", () => {});

		// @ts-expect-error
		cli.command("foo -o=<string>", () => {});
	});

	it("should infer types correctly for middleware context", () => {
		const cli = new Cli({ name: "test-cli" });

		cli.use("--verbose|-v", (c, next) => {
			expectTypeOf(c.flag).parameter(0).toEqualTypeOf<"verbose">();
			const verbose = c.flag("verbose");
			expectTypeOf(verbose).toEqualTypeOf<boolean>();
			return next();
		});

		cli.use("--remote", (c, next) => {
			expectTypeOf(c.flag).parameter(0).toEqualTypeOf<"remote">();
			const remote = c.flag("remote");
			expectTypeOf(remote).toEqualTypeOf<boolean>();
			return next();
		});

		cli.use("--opt=<string>", (c, next) => {
			expectTypeOf(c.option).parameter(0).toEqualTypeOf<"opt">();
			const opt = c.option("opt");
			expectTypeOf(opt).toEqualTypeOf<string | undefined>();
			return next();
		});

		// @ts-expect-error
		cli.use("copy [src]", (c, next) => {});

		// @ts-expect-error
		cli.use("copy [src] [dest?]", (c, next) => {});

		// @ts-expect-error
		cli.use("cat [...files]", (c, next) => {});
	});
});
