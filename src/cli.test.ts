import { describe, expect, it } from "vitest";
import { Cli, type Context } from "./cli";

describe("Cli", () => {
	it("should create cli with name", () => {
		const cli = new Cli({ name: "test-cli" });
		expect(cli).toBeInstanceOf(Cli);
	});

	it("should register and execute command", () => {
		const cli = new Cli({ name: "test-cli" });
		let executed1 = false;
		let executed2 = false;
		let receivedContext1: Context<"test1"> | null = null;
		let receivedContext2: Context<"test2"> | null = null;

		cli.command("test1", (c) => {
			executed1 = true;
			receivedContext1 = c;
		});

		cli.command("test2", (c) => {
			executed2 = true;
			receivedContext2 = c;
		});

		cli.run(["test1"]);

		expect(executed1).toBe(true);
		expect(receivedContext1).toBeDefined();

		cli.run(["test2"]);
		expect(executed2).toBe(true);
		expect(receivedContext2).toBeDefined();
	});

	it("should parse command arguments correctly", () => {
		const cli = new Cli({ name: "test-cli" });
		let receivedName: string | undefined;

		cli.command("hello [name]", (c) => {
			receivedName = c.arg("name");
		});

		cli.run(["hello", "world"]);

		expect(receivedName).toBe("world");
	});

	it("should handle multiple arguments", () => {
		const cli = new Cli({ name: "test-cli" });
		let receivedFirst: string | undefined;
		let receivedSecond: string | undefined;
		let receivedThird: string | undefined;
		let receivedArgs: Record<string, string | string[]> | undefined;

		cli.command("greet [first] [second] [third]", (c) => {
			receivedFirst = c.arg("first");
			receivedSecond = c.arg("second");
			receivedThird = c.arg("third");
			receivedArgs = c.args;
		});

		cli.run(["greet", "Alice", "Bob", "Charlie"]);

		expect(receivedFirst).toBe("Alice");
		expect(receivedSecond).toBe("Bob");
		expect(receivedThird).toBe("Charlie");
		expect(receivedArgs?.first).toEqual("Alice");
		expect(receivedArgs?.second).toEqual("Bob");
		expect(receivedArgs?.third).toEqual("Charlie");
	});

	it("should handle optional arguments", () => {
		const cli = new Cli({ name: "test-cli" });
		let receivedDir: string | undefined;
		let executionCount = 0;

		cli.command("list [dir?]", (c) => {
			receivedDir = c.arg("dir");
			executionCount++;
		});

		cli.run(["list", "src"]);
		expect(receivedDir).toBe("src");
		expect(executionCount).toBe(1);

		cli.run(["list"]);
		expect(receivedDir).toBeUndefined();
		expect(executionCount).toBe(2);
	});

	it("should validate required arguments", () => {
		const cli = new Cli({ name: "test-cli" });
		const originalError = console.error;
		const originalLog = console.log;
		let errorOutput = "";

		console.error = (message: string) => {
			errorOutput = message;
		};
		console.log = () => {};

		cli.command("hello [name]", (c) => {
			// This should not be called
		});

		cli.run(["hello"]);

		console.error = originalError;
		console.log = originalLog;
		expect(errorOutput).toBe("Error: Required argument 'name' is missing");
	});

	it("should handle mixed required and optional arguments", () => {
		const cli = new Cli({ name: "test-cli" });
		let receivedSrc: string | undefined;
		let receivedDest: string | undefined;

		cli.command("copy [src] [dest?]", (c) => {
			receivedSrc = c.arg("src");
			receivedDest = c.arg("dest");
		});

		cli.run(["copy", "file1.txt", "file2.txt"]);
		expect(receivedSrc).toBe("file1.txt");
		expect(receivedDest).toBe("file2.txt");

		cli.run(["copy", "file1.txt"]);
		expect(receivedSrc).toBe("file1.txt");
		expect(receivedDest).toBeUndefined();
	});

	it("should show usage when no command provided", () => {
		const cli = new Cli({ name: "test-cli" });
		const originalLog = console.log;
		let logOutput = "";

		console.log = (message: string) => {
			logOutput = message;
		};

		cli.run([]);

		console.log = originalLog;
		expect(logOutput).toBe("Usage: test-cli <command> [arguments...]");
	});

	it("should show error for unknown command", () => {
		const cli = new Cli({ name: "test-cli" });
		const originalLog = console.log;
		const originalError = console.error;
		let errorOutput = "";

		console.error = (message: string) => {
			errorOutput = message;
		};
		console.log = () => {};

		cli.run(["unknown"]);

		console.error = originalError;
		console.log = originalLog;
		expect(errorOutput).toBe("Unknown command: unknown");
	});

	it("should support method chaining", () => {
		const cli = new Cli({ name: "test-cli" });
		let command1Executed = false;
		let command2Executed = false;

		const result = cli
			.command("cmd1", () => {
				command1Executed = true;
			})
			.command("cmd2", () => {
				command2Executed = true;
			});

		expect(result).toBe(cli);

		cli.run(["cmd1"]);
		expect(command1Executed).toBe(true);

		cli.run(["cmd2"]);
		expect(command2Executed).toBe(true);
	});

	it("should parse flags (long and short) correctly", () => {
		const cli = new Cli({ name: "test-cli" });
		let receivedLong: boolean | undefined;
		let receivedAll: boolean | undefined;

		cli.command("list --long|-l --all|-a", (c) => {
			receivedLong = c.flag("long");
			receivedAll = c.flag("all");
		});

		cli.run(["list", "--long", "--all"]);
		expect(receivedLong).toBe(true);
		expect(receivedAll).toBe(true);

		cli.run(["list", "-l"]);
		expect(receivedLong).toBe(true);
		expect(receivedAll).toBe(false);

		cli.run(["list", "-a"]);
		expect(receivedLong).toBe(false);
		expect(receivedAll).toBe(true);

		cli.run(["list"]);
		expect(receivedLong).toBe(false);
		expect(receivedAll).toBe(false);
	});

	it("should parse long-only flags", () => {
		const cli = new Cli({ name: "test-cli" });
		let receivedVerbose: boolean | undefined;

		cli.command("build --verbose", (c) => {
			receivedVerbose = c.flag("verbose");
		});

		cli.run(["build", "--verbose"]);
		expect(receivedVerbose).toBe(true);

		cli.run(["build"]);
		expect(receivedVerbose).toBe(false);
	});

	it("should throw on short-only flags", () => {
		const cli = new Cli({ name: "test-cli" });
		expect(() => {
			cli.command("foo -f", (c) => {
				// @ts-expect-error
				c.flag("f");
			});
			cli.run(["foo", "-f"]);
		}).toThrowError(/Invalid flag definition/);
	});

	it("should throw on invalid flag patterns", () => {
		const cli = new Cli({ name: "test-cli" });
		expect(() => {
			cli.command("foo -f|--flag", (c) => {
				// @ts-expect-error
				c.flag("flag");
			});
			cli.run(["foo", "--flag"]);
		}).toThrowError(/Invalid flag definition/);

		expect(() => {
			cli.command("foo --flag|--f", (c) => {
				// @ts-expect-error
				c.flag("flag");
			});
			cli.run(["foo", "--flag"]);
		}).toThrowError(/Invalid flag definition/);
	});

	it("should throw on long flag with only one character", () => {
		const cli = new Cli({ name: "test-cli" });
		expect(() => {
			cli.command("build --v", (c) => {
				// @ts-expect-error
				c.flag("v");
			});
			cli.run(["build", "--v"]);
		}).toThrowError(/Invalid flag definition/);
	});

	it("should parse multiple mixed flags", () => {
		const cli = new Cli({ name: "test-cli" });
		let receivedBar: boolean | undefined;
		let receivedBaz: boolean | undefined;

		cli.command("foo --bar|-b --baz", (c) => {
			receivedBar = c.flag("bar");
			receivedBaz = c.flag("baz");
		});

		cli.run(["foo", "--bar", "--baz"]);
		expect(receivedBar).toBe(true);
		expect(receivedBaz).toBe(true);

		cli.run(["foo", "-b"]);
		expect(receivedBar).toBe(true);
		expect(receivedBaz).toBe(false);

		cli.run(["foo"]);
		expect(receivedBar).toBe(false);
		expect(receivedBaz).toBe(false);
	});

	it("should parse long option with equal sign (--message=hello)", () => {
		const cli = new Cli({ name: "test-cli" });
		let receivedMessage: string | undefined;

		cli.command("commit --message=<string>", (c) => {
			receivedMessage = c.option("message");
		});

		cli.run(["commit", "--message=hello"]);
		expect(receivedMessage).toBe("hello");
	});

	it("should parse long option with space (--message hello)", () => {
		const cli = new Cli({ name: "test-cli" });
		let receivedMessage: string | undefined;

		cli.command("commit --message=<string>", (c) => {
			receivedMessage = c.option("message");
		});

		cli.run(["commit", "--message", "hello"]);
		expect(receivedMessage).toBe("hello");
	});

	it("should parse short option with space (-m hello)", () => {
		const cli = new Cli({ name: "test-cli" });
		let receivedMessage: string | undefined;

		cli.command("commit --message|-m=<string>", (c) => {
			receivedMessage = c.option("message");
		});

		cli.run(["commit", "-m", "hello"]);
		expect(receivedMessage).toBe("hello");
	});

	it("should return undefined for missing option", () => {
		const cli = new Cli({ name: "test-cli" });
		let receivedMessage: string | undefined;

		cli.command("commit --message=<string>", (c) => {
			receivedMessage = c.option("message");
		});

		cli.run(["commit"]);
		expect(receivedMessage).toBeUndefined();
	});

	it("should parse multiple options", () => {
		const cli = new Cli({ name: "test-cli" });
		let receivedMessage: string | undefined;
		let receivedAuthor: string | undefined;

		cli.command("commit --message|-m=<string> --author=<string>", (c) => {
			receivedMessage = c.option("message");
			receivedAuthor = c.option("author");
		});

		cli.run(["commit", "--message=hi", "--author", "foo"]);
		expect(receivedMessage).toBe("hi");
		expect(receivedAuthor).toBe("foo");
	});

	it("should parse options mixed with flags and args", () => {
		const cli = new Cli({ name: "test-cli" });
		let receivedMessage: string | undefined;
		let receivedLong: boolean | undefined;
		let receivedName: string | undefined;

		cli.command("commit [name] --message=<string> --long|-l", (c) => {
			receivedMessage = c.option("message");
			receivedLong = c.flag("long");
			receivedName = c.arg("name");
		});

		cli.run(["commit", "alice", "--message", "hi", "--long"]);
		expect(receivedMessage).toBe("hi");
		expect(receivedLong).toBe(true);
		expect(receivedName).toBe("alice");
	});

	it("should ignore unknown options", () => {
		const cli = new Cli({ name: "test-cli" });
		let receivedMessage: string | undefined;

		cli.command("commit --message=<string>", (c) => {
			receivedMessage = c.option("message");
		});

		cli.run(["commit", "--unknown", "foo"]);
		expect(receivedMessage).toBeUndefined();
	});

	it("should not treat next flag as option value", () => {
		const cli = new Cli({ name: "test-cli" });
		let receivedMessage: string | undefined;
		let receivedLong: boolean | undefined;

		cli.command("commit --message=<string> --long", (c) => {
			receivedMessage = c.option("message");
			receivedLong = c.flag("long");
		});

		cli.run(["commit", "--message", "--long"]);
		expect(receivedMessage).toBeUndefined();
		expect(receivedLong).toBe(true);
	});

	it("should parse both long and short option names", () => {
		const cli = new Cli({ name: "test-cli" });
		let receivedMessage: string | undefined;

		cli.command("commit --message|-m=<string>", (c) => {
			receivedMessage = c.option("message");
		});

		cli.run(["commit", "-m", "hello"]);
		expect(receivedMessage).toBe("hello");

		cli.run(["commit", "--message", "world"]);
		expect(receivedMessage).toBe("world");
	});

	it("should throw on short-only option", () => {
		const cli = new Cli({ name: "test-cli" });
		expect(() => {
			cli.command("foo -m=<string>", (c) => {
				// @ts-expect-error
				c.option("m");
			});
			cli.run(["foo", "-m", "val"]);
		}).toThrowError(/Invalid option definition/);
	});

	it("should throw on long option with only one character", () => {
		const cli = new Cli({ name: "test-cli" });
		expect(() => {
			cli.command("foo --m=<string>", (c) => {
				// @ts-expect-error
				c.option("m");
			});
			cli.run(["foo", "--m", "val"]);
		}).toThrowError(/Invalid option definition/);
	});

	it("should throw on double long option", () => {
		const cli = new Cli({ name: "test-cli" });
		expect(() => {
			cli.command("foo --option|--o=<string>", (c) => {
				// @ts-expect-error
				c.option("option");
			});
			cli.run(["foo", "--option", "val"]);
		}).toThrowError(/Invalid (option|flag) definition/);
	});

	it("should throw on wrong order of short/long option", () => {
		const cli = new Cli({ name: "test-cli" });
		expect(() => {
			cli.command("foo -m|--option=<string>", (c) => {
				// @ts-expect-error
				c.option("option");
			});
			cli.run(["foo", "-m", "val"]);
		}).toThrowError(/Invalid (option|flag) definition/);
	});
});
