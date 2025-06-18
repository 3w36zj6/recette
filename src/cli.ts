/**
 * Configuration options for creating a CLI instance.
 */
export type CliOptions = {
	/** The name of the CLI application */
	name: string;
};

/**
 * Extract all bracket segments from command definition
 * @example "copy [src] [dest?]" -> ["[src]", "[dest?]"]
 */
type ExtractBracketSegments<T extends string> =
	T extends `${infer Before}[${infer Inside}]${infer After}`
		? [`[${Inside}]`, ...ExtractBracketSegments<After>]
		: [];

/**
 * Remove brackets and optional marker from a single bracket segment
 * @example "[name?]" -> "name", "[src]" -> "src"
 */
type CleanBracketSegment<T extends string> = T extends `[${infer Content}]`
	? Content extends `${infer Name}?`
		? Name
		: Content
	: never;

/**
 * Check if a bracket segment is optional
 * @example "[name?]" -> true, "[src]" -> false
 */
type IsBracketSegmentOptional<T extends string> = T extends `[${infer Content}]`
	? Content extends `${string}?`
		? true
		: false
	: false;

/**
 * Convert array of bracket segments to union of argument names
 */
type BracketSegmentsToArgs<T extends readonly string[]> = {
	readonly [K in keyof T]: T[K] extends string
		? CleanBracketSegment<T[K]>
		: never;
}[number];

/**
 * Filter bracket segments to only required ones, then convert to union
 */
type BracketSegmentsToRequiredArgs<T extends readonly string[]> = {
	readonly [K in keyof T]: T[K] extends string
		? IsBracketSegmentOptional<T[K]> extends false
			? CleanBracketSegment<T[K]>
			: never
		: never;
}[number];

/**
 * Filter bracket segments to only optional ones, then convert to union
 */
type BracketSegmentsToOptionalArgs<T extends readonly string[]> = {
	readonly [K in keyof T]: T[K] extends string
		? IsBracketSegmentOptional<T[K]> extends true
			? CleanBracketSegment<T[K]>
			: never
		: never;
}[number];

/**
 * Utility type to extract argument names from command definition strings.
 * @example
 * ```typescript
 * type Example1 = ExtractArgs<"hello [name] [age]">; // "name" | "age"
 * type Example2 = ExtractArgs<"build">; // never
 * type Example3 = ExtractArgs<"greet [first] [last]">; // "first" | "last"
 * type Example4 = ExtractArgs<"list [dir?]">; // "dir"
 * ```
 */
type ExtractArgs<T extends string> = BracketSegmentsToArgs<
	ExtractBracketSegments<T>
>;

/**
 * Utility type to extract required argument names from command definition strings.
 * @example
 * ```typescript
 * type Example1 = ExtractRequiredArgs<"hello [name]">; // "name"
 * type Example2 = ExtractRequiredArgs<"list [dir?]">; // never
 * type Example3 = ExtractRequiredArgs<"build [src?] [dest]">; // "dest"
 * ```
 */
type ExtractRequiredArgs<T extends string> = BracketSegmentsToRequiredArgs<
	ExtractBracketSegments<T>
>;

/**
 * Utility type to extract optional argument names from command definition strings.
 * @example
 * ```typescript
 * type Example1 = ExtractOptionalArgs<"list [dir?]">; // "dir"
 * type Example2 = ExtractOptionalArgs<"hello [name]">; // never
 * type Example3 = ExtractOptionalArgs<"build [src?] [dest]">; // "src"
 * ```
 */
type ExtractOptionalArgs<T extends string> = BracketSegmentsToOptionalArgs<
	ExtractBracketSegments<T>
>;

/**
 * Context object passed to command handlers containing parsed arguments.
 * @template T - The command definition string used for type-safe argument access
 */
export type Context<T extends string = string> = {
	/** Raw parsed arguments object */
	args: Record<string, string | string[]>;
	/** Type-safe method to access named arguments from command definition */
	arg: ExtractArgs<T> extends never
		? (name: never) => never
		: <K extends ExtractArgs<T>>(
				name: K,
			) => K extends ExtractOptionalArgs<T> ? string | undefined : string;
};

/**
 * A lightweight CLI framework for building command-line applications.
 */
export class Cli {
	private name: string;
	private commands: Map<string, (c: Context<string>) => void> = new Map();

	/**
	 * Creates a new CLI instance.
	 * @param options - Configuration options for the CLI
	 */
	constructor(options: CliOptions) {
		this.name = options.name;
	}

	/**
	 * Registers a command with the CLI.
	 * @template T - The command definition string for type inference
	 * @param name - Command definition string (e.g., `hello [name]`)
	 * @param handler - Function to execute when command is called
	 * @returns The CLI instance for method chaining
	 */
	command<T extends string>(name: T, handler: (c: Context<T>) => void) {
		this.commands.set(name, handler);
		return this;
	}

	/**
	 * Executes the CLI with the provided arguments.
	 * @param args - Command line arguments (defaults to `process.argv` based on execution context)
	 * @example
	 * ```typescript
	 * // Run with process.argv
	 * cli.run();
	 *
	 * // Run with custom arguments
	 * cli.run(['hello', 'world']);
	 *
	 * // Run with optional arguments
	 * cli.run(['list']); // dir is optional
	 * cli.run(['list', 'src']); // dir provided
	 * ```
	 */
	run(args?: string[]) {
		const actualArgs = args ?? this.getProcessArgs();
		const [commandName, ...restArgs] = actualArgs;

		if (!commandName) {
			this.showUsage();
			return;
		}

		const commandEntry = this.findCommand(commandName);
		if (!commandEntry) {
			console.error(`Unknown command: ${commandName}`);
			this.showUsage();
			return;
		}

		const [commandDef, handler] = commandEntry;
		const parsedArgs = this.parseCommandArgs(commandDef, restArgs);

		try {
			this.validateArgs(commandDef, parsedArgs);
		} catch (error) {
			console.error(`Error: ${(error as Error).message}`);
			this.showUsage();
			return;
		}

		const context = {
			args: parsedArgs,
			arg: (name) => {
				const value = parsedArgs[name];
				return typeof value === "string" ? value : undefined;
			},
		} as Context<string>;

		handler(context);
	}

	/**
	 * Determines if running as built binary by checking if `argv[0]` is a known runtime
	 * @returns `true` if running as built binary, `false` if running through runtime
	 * @example
	 * ```typescript
	 * // Runtime execution: bun script.ts
	 * // process.argv[0] = "/usr/bin/bun"
	 * this.isBuiltBinary(); // returns false
	 *
	 * // Binary execution: ./my-cli
	 * // process.argv[0] = "./my-cli"
	 * this.isBuiltBinary(); // returns true
	 * ```
	 */
	private isBuiltBinary(): boolean {
		const executablePath = process.argv[0];

		if (!executablePath) return true;

		const executableName = executablePath.split("/").pop()?.split("\\").pop();

		if (!executableName) return true;

		const knownRuntimes = ["node", "bun", "deno"];
		const isKnownRuntime = knownRuntimes.some(
			(runtime) =>
				executableName === runtime || executableName === `${runtime}.exe`,
		);

		return !isKnownRuntime;
	}

	/**
	 * Gets command line arguments based on execution context
	 * @returns Array of command line arguments excluding executable and script paths
	 * @example
	 * ```typescript
	 * // Runtime: bun script.ts hello world
	 * this.getProcessArgs(); // returns ["hello", "world"]
	 *
	 * // Binary: ./my-cli hello world
	 * this.getProcessArgs(); // returns ["hello", "world"]
	 * ```
	 */
	private getProcessArgs(): string[] {
		return this.isBuiltBinary() ? process.argv.slice(1) : process.argv.slice(2);
	}

	/**
	 * Shows usage information with available commands
	 * @example
	 * ```typescript
	 * // Output:
	 * // Usage: my-cli <command> [arguments...]
	 * //
	 * // Available commands:
	 * //   hello [name]
	 * //   greet [first] [last]
	 * this.showUsage();
	 * ```
	 */
	private showUsage() {
		console.log(`Usage: ${this.name} <command> [arguments...]`);

		if (this.commands.size > 0) {
			console.log("\nAvailable commands:");
			for (const [commandDef] of this.commands) {
				const commandName = this.extractCommandName(commandDef);
				const args = this.extractCommandUsage(commandDef);
				console.log(`  ${commandName}${args ? ` ${args}` : ""}`);
			}
		}
	}

	/**
	 * Extracts command usage format for display
	 * @param commandDef - Command definition string
	 * @returns Formatted argument string for usage display
	 * @example
	 * ```typescript
	 * this.extractCommandUsage("hello [name]"); // returns "[name]"
	 * this.extractCommandUsage("greet [first] [last]"); // returns "[first] [last]"
	 * this.extractCommandUsage("build"); // returns ""
	 * ```
	 */
	private extractCommandUsage(commandDef: string): string {
		const parts = commandDef.split(" ");
		const args = parts.slice(1); // Remove command name
		return args.join(" ");
	}

	/**
	 * Finds a registered command by its name.
	 * @param commandName - The command name to search for
	 * @returns Tuple of `[command definition, handler]` or `null` if not found
	 * @example
	 * ```typescript
	 * // Internal usage - finds command by name
	 * const result = this.findCommand('hello');
	 * if (result) {
	 *   const [commandDef, handler] = result;
	 *   // commandDef: "hello [name]"
	 *   // handler: function to execute
	 * }
	 * ```
	 */
	private findCommand(
		commandName: string,
	): [string, (c: Context<string>) => void] | null {
		for (const [commandDef, handler] of this.commands) {
			const actualCommandName = this.extractCommandName(commandDef);
			if (actualCommandName === commandName) {
				return [commandDef, handler];
			}
		}
		return null;
	}

	/**
	 * Extracts the command name from a command definition string.
	 * @param commandDef - Command definition (e.g., `hello [name]`)
	 * @returns The command name (e.g., `hello`)
	 * @example
	 * ```typescript
	 * this.extractCommandName("hello [name]"); // returns "hello"
	 * this.extractCommandName("build"); // returns "build"
	 * this.extractCommandName("greet [first] [last]"); // returns "greet"
	 * ```
	 */
	private extractCommandName(commandDef: string): string {
		return commandDef.split(" ")[0] || "";
	}

	/**
	 * Parses command line arguments based on the command definition.
	 * @param commandDef - Command definition string
	 * @param args - Raw command line arguments
	 * @returns Parsed arguments object with named parameters and extras in `_` array
	 * @example
	 * ```typescript
	 * this.parseCommandArgs("hello [name]", ["world"]);
	 * // returns { name: "world", _: [] }
	 *
	 * this.parseCommandArgs("greet [first] [last]", ["John", "Doe", "extra"]);
	 * // returns { first: "John", last: "Doe", _: ["extra"] }
	 * ```
	 */
	private parseCommandArgs(
		commandDef: string,
		args: string[],
	): Record<string, string | string[]> {
		// Extract argument names from command definition (e.g., "hello [name]" -> ["name"])
		const argNames = this.extractArgNames(commandDef);
		const result: Record<string, string | string[]> = { _: [] };

		args.forEach((arg, index) => {
			if (argNames[index]) {
				result[argNames[index]] = arg;
			} else {
				(result._ as string[]).push(arg);
			}
		});

		return result;
	}

	/**
	 * Extracts argument names from a command definition string.
	 * @param commandDef - Command definition string
	 * @returns Array of argument names found in brackets (with optional markers removed)
	 * @example
	 * ```typescript
	 * this.extractArgNames("hello [name]"); // returns ["name"]
	 * this.extractArgNames("list [dir?]"); // returns ["dir"]
	 * this.extractArgNames("build [src?] [dest]"); // returns ["src", "dest"]
	 * this.extractArgNames("greet [first] [last]"); // returns ["first", "last"]
	 * this.extractArgNames("build"); // returns []
	 * ```
	 */
	private extractArgNames(commandDef: string): string[] {
		const matches = commandDef.match(/\[([^\]]+)\]/g);
		return matches
			? matches.map((match) => {
					// Remove brackets and optional marker
					const argName = match.slice(1, -1);
					return argName.endsWith("?") ? argName.slice(0, -1) : argName;
				})
			: [];
	}

	/**
	 * Extracts argument metadata from a command definition string.
	 * @param commandDef - Command definition string
	 * @returns Array of argument metadata with optional flags
	 * @example
	 * ```typescript
	 * this.extractArgMetadata("list [dir?]");
	 * // returns [{ name: "dir", optional: true }]
	 *
	 * this.extractArgMetadata("build [src?] [dest]");
	 * // returns [{ name: "src", optional: true }, { name: "dest", optional: false }]
	 * ```
	 */
	private extractArgMetadata(
		commandDef: string,
	): Array<{ name: string; optional: boolean }> {
		const matches = commandDef.match(/\[([^\]]+)\]/g);
		return matches
			? matches.map((match) => {
					const argWithBrackets = match.slice(1, -1);
					const optional = argWithBrackets.endsWith("?");
					const name = optional
						? argWithBrackets.slice(0, -1)
						: argWithBrackets;
					return { name, optional };
				})
			: [];
	}

	/**
	 * Validates command arguments based on the command definition.
	 * @param commandDef - Command definition string
	 * @param parsedArgs - Parsed arguments object
	 * @throws Error if required arguments are missing
	 */
	private validateArgs(
		commandDef: string,
		parsedArgs: Record<string, string | string[]>,
	): void {
		const argMetadata = this.extractArgMetadata(commandDef);

		for (const { name, optional } of argMetadata) {
			if (
				!optional &&
				(parsedArgs[name] === undefined || parsedArgs[name] === "")
			) {
				throw new Error(`Required argument '${name}' is missing`);
			}
		}
	}
}
