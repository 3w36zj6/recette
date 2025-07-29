/**
 * Extracts the command name from a command definition string.
 * @param commandDef - Command definition (e.g., `hello [name]`)
 * @returns The command name (e.g., `hello`)
 * @example
 * ```typescript
 * extractCommandName("hello [name]"); // returns "hello"
 * extractCommandName("build"); // returns "build"
 * extractCommandName("greet [first] [last]"); // returns "greet"
 * ```
 */
export const extractCommandName = (commandDef: string): string => {
	return commandDef.split(" ")[0] || "";
};

/**
 * Extracts command usage format for display
 * @param commandDef - Command definition string
 * @returns Formatted argument string for usage display
 * @example
 * ```typescript
 * extractCommandUsage("hello [name]"); // returns "[name]"
 * extractCommandUsage("greet [first] [last]"); // returns "[first] [last]"
 * extractCommandUsage("build"); // returns ""
 * ```
 */
export const extractCommandUsage = (commandDef: string): string => {
	const parts = commandDef.split(" ");
	const args = parts.slice(1);
	return args.join(" ");
};

/**
 * Extracts argument names from a command definition string.
 * @param commandDef - Command definition string
 * @returns Array of argument names found in brackets (with optional markers removed)
 * @example
 * ```typescript
 * extractArgNames("hello [name]"); // returns ["name"]
 * extractArgNames("list [dir?]"); // returns ["dir"]
 * extractArgNames("build [src?] [dest]"); // returns ["src", "dest"]
 * extractArgNames("greet [first] [last]"); // returns ["first", "last"]
 * extractArgNames("build"); // returns []
 * ```
 */
export const extractArgNames = (commandDef: string): string[] => {
	const matches = commandDef.match(/\[([^\]]+)\]/g) ?? [];
	return matches.map((match) => {
		let argName = match.slice(1, -1);
		if (argName.startsWith("...")) {
			argName = argName.slice(3);
		}
		checkReserved(argName);
		return argName;
	});
};

/**
 * Extracts argument metadata from a command definition string.
 * @param commandDef - Command definition string
 * @returns Array of argument metadata with optional flags
 * @example
 * ```typescript
 * extractArgMetadata("list [dir?]");
 * // returns [{ name: "dir", optional: true }]
 *
 * extractArgMetadata("build [src?] [dest]");
 * // returns [{ name: "src", optional: true }, { name: "dest", optional: false }]
 * ```
 */
export const extractArgMetadata = (
	commandDef: string,
): Array<{ name: string; optional: boolean }> => {
	const matches = commandDef.match(/\[([^\]]+)\]/g);
	return matches
		? matches.map((match) => {
				const argWithBrackets = match.slice(1, -1);
				const optional = argWithBrackets.endsWith("?");
				let name = optional ? argWithBrackets.slice(0, -1) : argWithBrackets;
				if (name.startsWith("...")) {
					name = name.slice(3);
				}
				return { name, optional };
			})
		: [];
};

/**
 * Extracts flag definitions from a command definition string.
 * Throws an Error if the definition contains invalid flag patterns.
 * @param commandDef - Command definition string
 * @returns Array of flag definitions { long, short }
 * @throws Error if the command definition contains invalid flag patterns
 * @example
 * extractFlagDefs("list --long|-l --all|-a");
 * // returns [{ long: "long", short: "l" }, { long: "all", short: "a" }]
 * extractFlagDefs("foo --bar");
 * // returns [{ long: "bar", short: undefined }]
 */
export const extractFlagDefs = (
	commandDef: string,
): Array<{ long: string; short?: string }> => {
	const optionPattern = /--[a-zA-Z][\w-]*(\|-[a-zA-Z])?=<[\w-]+>/g;
	const commandDefWithoutOptions = commandDef.replace(optionPattern, "");
	const flagPattern = /--([a-zA-Z][\w-]*)(\|-[a-zA-Z])?/g;
	const result: Array<{ long: string; short?: string }> = [];
	const seenLong = new Set<string>();
	const seenShort = new Set<string>();
	let match: RegExpExecArray | null = flagPattern.exec(
		commandDefWithoutOptions,
	);
	while (match !== null) {
		const long = match[1];
		const short = match[2] ? match[2].slice(2) : undefined;
		if (!long) {
			match = flagPattern.exec(commandDefWithoutOptions);
			continue;
		}
		checkReserved(long);
		if (short) checkReserved(short);
		if (seenLong.has(long)) {
			throw new Error(`Duplicate flag name: "${long}"`);
		}
		seenLong.add(long);
		if (short) {
			if (seenShort.has(short)) {
				throw new Error(`Duplicate short flag name: "${short}"`);
			}
			seenShort.add(short);
		}
		result.push({ long, short });

		match = flagPattern.exec(commandDefWithoutOptions);
	}
	return result;
};

/**
 * Extracts option definitions from a command definition string.
 * Throws an Error if the definition contains invalid option patterns.
 * @param commandDef - Command definition string
 * @returns Array of option definitions { long, short }
 * @throws Error if the command definition contains invalid option patterns
 * @example
 * extractOptionDefs("commit --message=<string> --author=<string>");
 * // returns [{ long: "message", short: undefined }, { long: "author", short: undefined }]
 */
export const extractOptionDefs = (
	commandDef: string,
): Array<{ long: string; short?: string }> => {
	const optionPattern = /--([a-zA-Z][\w-]*)(\|-[a-zA-Z])?=<[\w-]+>/g;
	const result: Array<{ long: string; short?: string }> = [];
	const seenLong = new Set<string>();
	const seenShort = new Set<string>();
	let match: RegExpExecArray | null = optionPattern.exec(commandDef);

	while (match !== null) {
		const long = match[1];
		const short = match[2] ? match[2].slice(2) : undefined;
		if (typeof long !== "string") {
			match = optionPattern.exec(commandDef);
			continue;
		}
		checkReserved(long);
		if (short) checkReserved(short);

		if (seenLong.has(long)) {
			throw new Error(`Duplicate option name: "${long}"`);
		}
		seenLong.add(long);
		if (short) {
			if (seenShort.has(short)) {
				throw new Error(`Duplicate short option name: "${short}"`);
			}
			seenShort.add(short);
		}
		result.push({ long, short });
		match = optionPattern.exec(commandDef);
	}
	return result;
};

/**
 * Parses command line arguments based on the command definition.
 * @param commandDef - Command definition string
 * @param args - Raw command line arguments
 * @returns Parsed arguments object with named parameters and extras in `_` array
 * @example
 * ```typescript
 * parseCommandArgs("hello [name]", ["world"]);
 * // returns { name: "world", _: [] }
 *
 * parseCommandArgs("greet [first] [last]", ["John", "Doe", "extra"]);
 * // returns { first: "John", last: "Doe", _: ["extra"] }
 * ```
 */
export const parseCommandArgs = (
	commandDef: string,
	args: string[],
): Record<string, string | string[]> => {
	const matches = commandDef.match(/\[([^\]]+)\]/g) ?? [];
	const argNames = matches.map((match) => {
		const argName = match.slice(1, -1);
		if (argName.startsWith("...")) return argName.slice(3);
		return argName.endsWith("?") ? argName.slice(0, -1) : argName;
	});

	const variadicIndex = matches.findIndex((match) => match.startsWith("[..."));

	const result: Record<string, string | string[]> = {};
	const { consumedIndexes } = parseOptionsWithConsumed(commandDef, args);

	const positionalArgs = args
		.map((v, i) =>
			!v.startsWith("-") && !consumedIndexes.has(i) ? v : undefined,
		)
		.filter((v): v is string => v !== undefined);

	if (variadicIndex === -1) {
		argNames.forEach((name, i) => {
			if (positionalArgs[i] !== undefined) {
				result[name] = positionalArgs[i];
			}
		});
	} else {
		argNames.slice(0, variadicIndex).forEach((name, i) => {
			if (positionalArgs[i] !== undefined) {
				result[name] = positionalArgs[i];
			}
		});
		const variadicName = argNames[variadicIndex];
		if (variadicName !== undefined) {
			result[variadicName] = positionalArgs.slice(variadicIndex);
		}
	}

	return result;
};

/**
 * Parses flags from command line arguments based on the command definition.
 * @param commandDef - Command definition string
 * @param args - Raw command line arguments
 * @returns Parsed flags object with long flag names as keys and boolean values
 * @example
 * parseFlags("list --long|-l --all|-a", ["--long", "--all"]);
 * // returns { long: true, all: true }
 * parseFlags("list --long|-l --all|-a", ["-l"]);
 * // returns { long: true, all: false }
 */
export const parseFlags = (
	commandDef: string,
	args: string[],
): Record<string, boolean | undefined> => {
	const flagDefs = extractFlagDefs(commandDef);
	const result: Record<string, boolean> = {};
	for (const { long, short } of flagDefs) {
		result[long] = false;
	}
	for (const arg of args) {
		if (arg.startsWith("--")) {
			const name = arg.slice(2);
			const def = flagDefs.find((f) => f.long === name);
			if (def) result[def.long] = true;
		} else if (arg.startsWith("-") && arg.length === 2) {
			const name = arg.slice(1);
			const def = flagDefs.find((f) => f.short === name);
			if (def) result[def.long] = true;
		}
	}
	return new Proxy(result, {
		get(target, prop: string) {
			return Object.prototype.hasOwnProperty.call(target, prop)
				? target[prop]
				: undefined;
		},
	}) as Record<string, boolean | undefined>;
};

/**
 * Parses options from command line arguments based on the command definition.
 * @param commandDef - Command definition string
 * @param args - Raw command line arguments
 * @returns Parsed options object with long option names as keys and string or undefined values
 * @example
 * parseOptions("commit --message=<string>", ["--message", "hi"]);
 * // returns { message: "hi" }
 */
export const parseOptions = (
	commandDef: string,
	args: string[],
): Record<string, string | undefined> => {
	return parseOptionsWithConsumed(commandDef, args).options;
};

/**
 * Parses options from command line arguments based on the command definition.
 * @param commandDef - Command definition string
 * @param args - Raw command line arguments
 * @returns An object with two properties:
 *   - options: Parsed options object with long option names as keys and string or undefined values
 *   - consumedIndexes: Set of argument indexes that were consumed as option values
 * @example
 * parseOptionsWithConsumed("commit --message=<string>", ["--message", "hi"]);
 * // returns { options: { message: "hi" }, consumedIndexes: Set([1]) }
 */
export const parseOptionsWithConsumed = (
	commandDef: string,
	args: string[],
): {
	options: Record<string, string | undefined>;
	consumedIndexes: Set<number>;
} => {
	const optionDefs = extractOptionDefs(commandDef);
	const result: Record<string, string | undefined> = {};
	const consumedIndexes = new Set<number>();
	for (const { long } of optionDefs) {
		result[long] = undefined;
	}
	let i = 0;
	while (i < args.length) {
		const arg = args[i];
		if (typeof arg !== "string") {
			i++;
			continue;
		}
		if (arg.startsWith("--")) {
			const eqIdx = arg.indexOf("=");
			if (eqIdx !== -1) {
				const name = arg.slice(2, eqIdx);
				const value = arg.slice(eqIdx + 1);
				const def = optionDefs.find((o) => o.long === name);
				if (def) {
					result[def.long] = value;
					consumedIndexes.add(i);
				}
			} else {
				const name = arg.slice(2);
				const nextArg = args[i + 1];
				const def = optionDefs.find((o) => o.long === name);
				if (def && typeof nextArg === "string" && !nextArg.startsWith("-")) {
					result[def.long] = nextArg;
					consumedIndexes.add(i + 1);
					i++;
				}
			}
		} else if (arg.startsWith("-") && arg.length === 2) {
			const name = arg.slice(1);
			const nextArg = args[i + 1];
			const def = optionDefs.find((o) => o.short === name);
			if (def && typeof nextArg === "string" && !nextArg.startsWith("-")) {
				result[def.long] = nextArg;
				consumedIndexes.add(i + 1);
				i++;
			}
		}
		i++;
	}
	return { options: result, consumedIndexes };
};

/**
 * Regular expressions for validating each unit of a command definition.
 * - Command and subcommand names: /^[a-zA-Z][\w-]*$/
 * - Positional and variadic arguments: /^\[(\.\.\.)?[a-zA-Z_][\w-]*\??\]$/
 * - Flags (long and optional short): /^--[a-zA-Z][\w-]+(\|-[a-zA-Z])?$/
 * - Options (long and optional short, with value): /^--[a-zA-Z][\w-]+(\|-[a-zA-Z])?=<[\w-]+>$/
 */
const COMMAND_UNIT_PATTERNS = [
	/^[a-zA-Z][\w-]*$/, // command or subcommand name
	/^\[(\.\.\.)?[a-zA-Z_][\w-]*\??\]$/, // positional or variadic argument
	/^--[a-zA-Z][\w-]+(\|-[a-zA-Z])?$/, // flag (long and optional short)
	/^--[a-zA-Z][\w-]+(\|-[a-zA-Z])?=<[\w-]+>$/, // option (long and optional short, with value)
];

/**
 * Validates that each unit in the command definition matches an allowed pattern.
 * Throws an error if any unit is invalid, if more than one variadic argument is present,
 * or if a positional or variadic argument appears after a variadic argument.
 *
 * @param commandDef - The command definition string to validate
 * @throws Error if the command definition contains invalid syntax or structure
 */
export const validateCommandUnits = (commandDef: string) => {
	const units = commandDef.trim().split(/\s+/);
	for (const unit of units) {
		if (!COMMAND_UNIT_PATTERNS.some((re) => re.test(unit))) {
			throw new Error(`Invalid command syntax: "${unit}"`);
		}
	}

	const variadicIdx = units.findIndex((u) =>
		/^\[\.\.\.[a-zA-Z_][\w-]*\??\]$/.test(u),
	);

	if (variadicIdx !== -1) {
		// More than one variadic argument is not allowed
		if (
			units.filter((u) => /^\[\.\.\.[a-zA-Z_][\w-]*\??\]$/.test(u)).length > 1
		) {
			throw new Error("Only one variadic argument is allowed");
		}
		// No positional or variadic argument allowed after a variadic argument
		const after = units.slice(variadicIdx + 1);
		const hasPositionalAfter = after.some(
			(u) =>
				/^\[[a-zA-Z_][\w-]*\??\]$/.test(u) || // positional argument
				/^\[\.\.\.[a-zA-Z_][\w-]*\??\]$/.test(u), // variadic argument
		);
		if (hasPositionalAfter) {
			throw new Error(
				"No positional or variadic argument allowed after variadic argument",
			);
		}
	}
};

/**
 * Validates command arguments based on the command definition.
 * @param commandDef - Command definition string
 * @param parsedArgs - Parsed arguments object
 * @throws Error if required arguments are missing
 */
export const validateArgs = (
	commandDef: string,
	parsedArgs: Record<string, string | string[]>,
): void => {
	const argMetadata = extractArgMetadata(commandDef);

	for (const { name, optional } of argMetadata) {
		const value = parsedArgs[name];
		const isVariadic = commandDef.includes(`[...${name}]`);
		if (!optional) {
			if (
				value === undefined ||
				(!isVariadic && Array.isArray(value) && value.length === 0)
			) {
				throw new Error(`Required argument '${name}' is missing`);
			}
		}
	}
};

const RESERVED_NAMES = ["constructor", "prototype", "__proto__"];

/**
 * Checks if a name is reserved and throws an error if so.
 * @param name - The name to check
 * @throws Error if the name is reserved
 */
export const checkReserved = (name: string) => {
	if (RESERVED_NAMES.includes(name)) {
		throw new Error(
			`Reserved word used as argument/flag/option name: "${name}"`,
		);
	}
};

/**
 * Determines if a middleware path matches a command definition.
 * @param mwPath - Middleware path
 * @param cmdDef - Command definition
 * @returns True if the middleware path matches the command definition, false otherwise
 */
export const isMiddlewareMatch = (mwPath: string, cmdDef: string): boolean => {
	if (!mwPath.trim()) return true;
	const mwTokens = mwPath
		.trim()
		.split(/\s+/)
		.filter(
			(t) => !t.startsWith("--") && !t.startsWith("-") && !t.startsWith("["),
		);
	const cmdTokens = cmdDef
		.trim()
		.split(/\s+/)
		.filter(
			(t) => !t.startsWith("--") && !t.startsWith("-") && !t.startsWith("["),
		);

	if (mwTokens.length === 0) return true;
	return mwTokens.every((token, idx) => cmdTokens[idx] === token);
};
