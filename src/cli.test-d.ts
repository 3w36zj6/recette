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
});
