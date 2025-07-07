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

		cli.command("greet [first] [second] [third]", (c) => {
			receivedFirst = c.arg("first");
			receivedSecond = c.arg("second");
			receivedThird = c.arg("third");
		});

		cli.run(["greet", "Alice", "Bob", "Charlie"]);

		expect(receivedFirst).toBe("Alice");
		expect(receivedSecond).toBe("Bob");
		expect(receivedThird).toBe("Charlie");
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

	it("should handle variadic arguments", () => {
		const cli = new Cli({ name: "test-cli" });
		let receivedFiles: string[] | undefined;

		cli.command("remove [...files]", (c) => {
			receivedFiles = c.args("files");
		});

		cli.run(["remove", "a.txt", "b.txt", "c.txt"]);
		expect(receivedFiles).toEqual(["a.txt", "b.txt", "c.txt"]);

		cli.run(["remove"]);
		expect(receivedFiles).toEqual([]);
	});

	it("should not allow multiple variadic arguments", () => {
		const cli = new Cli({ name: "test-cli" });
		expect(() => {
			// @ts-expect-error
			cli.command("foo [...files] [...others]", (c) => {});
		}).toThrowError(/Only one variadic argument is allowed/);
	});

	it("should not allow variadic argument except at last position", () => {
		const cli = new Cli({ name: "test-cli" });
		expect(() => {
			// @ts-expect-error
			cli.command("foo [...files] [other]", (c) => {});
		}).toThrowError(/Variadic argument must be last/);
	});

	it("should handle required and variadic arguments together", () => {
		const cli = new Cli({ name: "test-cli" });
		let receivedDir: string | undefined;
		let receivedFiles: string[] | undefined;

		cli.command("upload [dir] [...files]", (c) => {
			receivedDir = c.arg("dir");
			receivedFiles = c.args("files");
		});

		cli.run(["upload", "src", "a.txt", "b.txt"]);
		expect(receivedDir).toBe("src");
		expect(receivedFiles).toEqual(["a.txt", "b.txt"]);

		cli.run(["upload", "src"]);
		expect(receivedDir).toBe("src");
		expect(receivedFiles).toEqual([]);
	});

	it("should handle required, optional, and variadic arguments together", () => {
		const cli = new Cli({ name: "test-cli" });
		let receivedA: string | undefined;
		let receivedB: string | undefined;
		let receivedRest: string[] | undefined;

		cli.command("foo [a] [b?] [...rest]", (c) => {
			receivedA = c.arg("a");
			receivedB = c.arg("b");
			receivedRest = c.args("rest");
		});

		cli.run(["foo", "A", "B", "X", "Y"]);
		expect(receivedA).toBe("A");
		expect(receivedB).toBe("B");
		expect(receivedRest).toEqual(["X", "Y"]);

		cli.run(["foo", "A"]);
		expect(receivedA).toBe("A");
		expect(receivedB).toBeUndefined();
		expect(receivedRest).toEqual([]);
	});

	it("should allow empty variadic arguments", () => {
		const cli = new Cli({ name: "test-cli" });
		let received: string[] | undefined;

		cli.command("bar [...items]", (c) => {
			received = c.args("items");
		});

		cli.run(["bar"]);
		expect(received).toEqual([]);
	});

	it("should handle single value for variadic argument", () => {
		const cli = new Cli({ name: "test-cli" });
		let received: string[] | undefined;

		cli.command("baz [...values]", (c) => {
			received = c.args("values");
		});

		cli.run(["baz", "one"]);
		expect(received).toEqual(["one"]);
	});

	it("should assign correct values when required arg precedes variadic", () => {
		const cli = new Cli({ name: "test-cli" });
		let receivedFirst: string | undefined;
		let receivedRest: string[] | undefined;

		cli.command("qux [first] [...rest]", (c) => {
			receivedFirst = c.arg("first");
			receivedRest = c.args("rest");
		});

		cli.run(["qux", "A", "B", "C"]);
		expect(receivedFirst).toBe("A");
		expect(receivedRest).toEqual(["B", "C"]);
	});

	it("should handle variadic arguments with spaces and special characters", () => {
		const cli = new Cli({ name: "test-cli" });
		let received: string[] | undefined;

		cli.command("files [...paths]", (c) => {
			received = c.args("paths");
		});

		cli.run(["files", "a b.txt", "c@d.txt", "e#f.txt"]);
		expect(received).toEqual(["a b.txt", "c@d.txt", "e#f.txt"]);
	});

	it("should throw if multiple variadic arguments are defined", () => {
		const cli = new Cli({ name: "test-cli" });
		expect(() => {
			// @ts-expect-error
			cli.command("foo [...a] [...b]", () => {});
		}).toThrow(/Only one variadic argument is allowed/);
	});

	it("should throw if variadic argument is not last", () => {
		const cli = new Cli({ name: "test-cli" });
		expect(() => {
			// @ts-expect-error
			cli.command("foo [...a] [b]", () => {});
		}).toThrow(/Variadic argument must be last/);
	});

	it("should parse flags and options with arguments", () => {
		const cli = new Cli({ name: "test-cli" });
		let called = false;

		cli.command("commit [file] --amend|-a --message|-m=<string>", (c) => {
			expect(c.arg("file")).toBe("index.ts");
			expect(c.flag("amend")).toBe(true);
			expect(c.option("message")).toBe("fix bug");
			called = true;
		});

		cli.run(["commit", "index.ts", "--amend", "--message", "fix bug"]);
		expect(called).toBe(true);
	});

	it("should throw on duplicate argument names", () => {
		const cli = new Cli({ name: "test-cli" });
		expect(() => {
			// @ts-expect-error
			cli.command("foo [bar] [bar]", () => {});
		}).toThrowError(/Duplicate argument name/);
	});

	it("should throw on reserved word as argument", () => {
		const cli = new Cli({ name: "test-cli" });
		expect(() => {
			cli.command("foo [constructor]", () => {});
		}).toThrowError(/Reserved word/);
	});

	it("should return undefined for unknown flag or option", () => {
		const cli = new Cli({ name: "test-cli" });
		let called = false;
		cli.command("foo --bar|-b --baz=<string>", (c) => {
			expect(c.flag("bar")).toBe(false);
			expect(c.option("baz")).toBeUndefined();
			// @ts-expect-error
			c.flag("unknown");
			// @ts-expect-error
			c.option("unknown");
			called = true;
		});
		cli.run(["foo"]);
		expect(called).toBe(true);
	});

	it("should show error if required argument is missing", () => {
		const cli = new Cli({ name: "test-cli" });
		let errorOutput = "";
		const originalError = console.error;
		const originalLog = console.log;
		console.error = (msg: string) => {
			errorOutput = msg;
		};
		console.log = () => {};

		cli.command("hello [name]", () => {});
		cli.run(["hello"]);
		expect(errorOutput).toMatch(/Required argument/);

		console.error = originalError;
		console.log = originalLog;
	});

	it("should not include flags or options in variadic argument", () => {
		const cli = new Cli({ name: "test-cli" });
		let capturedFiles: string[] | undefined;
		let capturedFlag: boolean | undefined;
		let capturedOpt: string | undefined;

		cli.command("cat [...files] --flag --opt=<string>", (c) => {
			capturedFiles = c.args("files");
			capturedFlag = c.flag("flag");
			capturedOpt = c.option("opt");
		});
		cli.run(["cat", "a.txt", "b.txt", "--flag", "--opt", "value", "c.txt"]);

		expect(capturedFiles).toEqual(["a.txt", "b.txt", "c.txt"]);
		expect(capturedFlag).toBe(true);
		expect(capturedOpt).toBe("value");
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

	it("should not allow duplicate argument names", () => {
		const cli = new Cli({ name: "test-cli" });
		expect(() => {
			// @ts-expect-error
			cli.command("foo [bar] [bar]", (c) => {
				c.arg("bar");
			});
			cli.run(["foo", "a", "b"]);
		}).toThrowError(/Duplicate argument name: "bar"/);
	});

	it("should show usage when no command provided", () => {
		const cli = new Cli({ name: "test-cli" });
		const originalLog = console.log;
		const originalError = console.error;
		let logOutput = "";

		console.log = (message: string) => {
			logOutput = message;
		};
		console.error = () => {};

		cli.run([]);

		console.log = originalLog;
		console.error = originalError;
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
			// @ts-expect-error
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
			// @ts-expect-error
			cli.command("foo -f|--flag", (c) => {
				// @ts-expect-error
				c.flag("flag");
			});
			cli.run(["foo", "--flag"]);
		}).toThrowError(/Invalid flag definition/);

		expect(() => {
			// @ts-expect-error
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
			// @ts-expect-error
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
			// @ts-expect-error
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
			// @ts-expect-error
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
			// @ts-expect-error
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
			// @ts-expect-error
			cli.command("foo -m|--option=<string>", (c) => {
				// @ts-expect-error
				c.option("option");
			});
			cli.run(["foo", "-m", "val"]);
		}).toThrowError(/Invalid (option|flag) definition/);
	});

	it("should not allow duplicate flag or option names", () => {
		const cli = new Cli({ name: "test-cli" });
		expect(() => {
			cli.command("foo --bar|-b --bar|-c", (c) => {
				c.flag("bar");
			});
			cli.run(["foo", "--bar"]);
		}).toThrowError(/Duplicate flag name: "bar"/);
		expect(() => {
			cli.command("foo --opt=<string> --opt=<string>", (c) => {
				c.option("opt");
			});
			cli.run(["foo", "--opt", "val"]);
		}).toThrowError(/Duplicate option name: "opt"/);
	});

	it("should not allow flag and option with the same name", () => {
		const cli = new Cli({ name: "test-cli" });
		expect(() => {
			cli.command("foo --bar --bar=<string>", (c) => {
				c.option("bar");
			});
			cli.run(["foo", "--bar", "--bar", "val"]);
		}).toThrowError(/Duplicate flag and option name: "bar"/);
	});

	it("should return undefined for unknown flag or option", () => {
		const cli = new Cli({ name: "test-cli" });
		let unknownFlag: boolean | undefined;
		let unknownOption: string | undefined;

		cli.command("foo --bar --baz=<string>", (c) => {
			// @ts-expect-error
			unknownFlag = c.flag("unknown");
			// @ts-expect-error
			unknownOption = c.option("unknown");
		});
		cli.run(["foo", "--bar", "--baz", "val"]);
		expect(unknownFlag).toBeUndefined();
		expect(unknownOption).toBeUndefined();
	});

	it("should treat empty string option value as valid", () => {
		const cli = new Cli({ name: "test-cli" });
		let receivedMessage: string | undefined;

		cli.command("commit --message=<string>", (c) => {
			receivedMessage = c.option("message");
		});
		cli.run(["commit", "--message", ""]);
		expect(receivedMessage).toBe("");
	});

	it("should not allow reserved words as argument, flag, or option names", () => {
		const cli = new Cli({ name: "test-cli" });
		expect(() => {
			cli.command("foo --constructor=<string>", (c) => {
				c.option("constructor");
			});
			cli.run(["foo", "--constructor", "val"]);
		}).toThrowError(
			/Reserved word used as argument\/flag\/option name: "constructor"/,
		);
		expect(() => {
			cli.command("foo --prototype", (c) => {
				c.flag("prototype");
			});
			cli.run(["foo", "--prototype"]);
		}).toThrowError(
			/Reserved word used as argument\/flag\/option name: "prototype"/,
		);
		expect(() => {
			cli.command("foo [__proto__]", (c) => {
				c.arg("__proto__");
			});
			cli.run(["foo", "val"]);
		}).toThrowError(
			/Reserved word used as argument\/flag\/option name: "__proto__"/,
		);
	});

	it("should handle run with empty array or undefined", () => {
		const cli = new Cli({ name: "test-cli" });
		const originalLog = console.log;
		const originalError = console.error;
		let logOutput = "";
		console.log = (msg: string) => {
			logOutput = msg;
		};
		console.error = () => {};

		cli.run([]);
		expect(logOutput).toBe("Usage: test-cli <command> [arguments...]");

		logOutput = "";
		cli.run(undefined);
		expect(logOutput).toBe("Usage: test-cli <command> [arguments...]");

		console.log = originalLog;
		console.error = originalError;
	});

	it("should handle option value with spaces if quoted", () => {
		const cli = new Cli({ name: "test-cli" });
		let receivedMessage: string | undefined;

		cli.command("commit --message=<string>", (c) => {
			receivedMessage = c.option("message");
		});
		cli.run(["commit", "--message", "hello world"]);
		expect(receivedMessage).toBe("hello world");
	});

	it("should treat multiple option values as last one wins", () => {
		const cli = new Cli({ name: "test-cli" });
		let receivedMessage: string | undefined;

		cli.command("commit --message=<string>", (c) => {
			receivedMessage = c.option("message");
		});
		cli.run(["commit", "--message", "first", "--message", "second"]);
		expect(receivedMessage).toBe("second");
	});

	it("should support mount() for subcommand grouping and nesting", () => {
		const featureCli = new Cli({ name: "feature-cli" });
		let featureStarted: string | undefined;

		featureCli.command("start [name]", (c) => {
			featureStarted = c.arg("name");
		});

		const branchCli = new Cli({ name: "branch-cli" });
		let branchListed = false;
		let branchDeleted: string | undefined;

		branchCli.command("list --remote", (c) => {
			branchListed = c.flag("remote");
		});
		branchCli.command("delete [name]", (c) => {
			branchDeleted = c.arg("name");
		});
		branchCli.mount("feature", featureCli);

		const cli = new Cli({ name: "mycli" });
		cli.mount("branch", branchCli);

		cli.run(["branch", "list", "--remote"]);
		expect(branchListed).toBe(true);

		cli.run(["branch", "delete", "dev"]);
		expect(branchDeleted).toBe("dev");

		cli.run(["branch", "feature", "start", "awesome"]);
		expect(featureStarted).toBe("awesome");
	});

	it("should support multiple levels of mount() nesting", () => {
		const deepCli = new Cli({ name: "deep-cli" });
		let deepInfoCalled = false;
		deepCli.command("info", () => {
			deepInfoCalled = true;
		});

		const subCli = new Cli({ name: "sub-cli" });
		let subFooCalled = false;
		subCli.command("foo", () => {
			subFooCalled = true;
		});
		subCli.mount("deep", deepCli);

		const rootCli = new Cli({ name: "root-cli" });
		rootCli.mount("sub", subCli);

		rootCli.run(["sub", "foo"]);
		expect(subFooCalled).toBe(true);

		rootCli.run(["sub", "deep", "info"]);
		expect(deepInfoCalled).toBe(true);
	});

	it("should support direct subcommand definition with spaces", () => {
		const cli = new Cli({ name: "mycli" });
		let called = false;
		let remoteFlag: boolean | undefined;

		cli.command("branch list --remote", (c) => {
			called = true;
			remoteFlag = c.flag("remote");
		});

		cli.run(["branch", "list", "--remote"]);
		expect(called).toBe(true);
		expect(remoteFlag).toBe(true);
	});
});
