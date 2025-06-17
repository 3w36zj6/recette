import { describe, expect, it } from "bun:test";
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

	it("should handle missing command argument", () => {
		const cli = new Cli({ name: "test-cli" });
		let executed = false;
		let receivedName: string | undefined;

		cli.command("hello [name]", (c) => {
			executed = true;
			receivedName = c.arg("name");
		});

		cli.run(["hello"]);

		expect(executed).toBe(true);
		expect(receivedName).toBeUndefined();
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
});
