import path from "node:path";

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
	readonly [K in keyof T]: T[K] extends `[...${string}]`
		? never
		: T[K] extends string
			? IsBracketSegmentOptional<T[K]> extends false
				? CleanBracketSegment<T[K]>
				: never
			: never;
}[number];

/**
 * Filter bracket segments to only optional ones, then convert to union
 */
type BracketSegmentsToOptionalArgs<T extends readonly string[]> = {
	readonly [K in keyof T]: T[K] extends `[...${string}]`
		? never
		: T[K] extends string
			? IsBracketSegmentOptional<T[K]> extends true
				? CleanBracketSegment<T[K]>
				: never
			: never;
}[number];

/**
 * Returns true if the given bracket segment is a variadic argument.
 * @example
 * IsVariadicBracket<"[...files]"> // true
 * IsVariadicBracket<"[name]"> // false
 */
type IsVariadicBracket<T extends string> = T extends `[...${string}]`
	? true
	: false;

/**
 * Converts an array of bracket segments to a union of argument names,
 * excluding variadic arguments.
 * @example
 * BracketSegmentsToArgsWithoutVariadic<["[file]", "[...files]"]> // "file"
 */
type BracketSegmentsToArgsWithoutVariadic<T extends readonly string[]> = {
	[K in keyof T]: T[K] extends `[...${string}]`
		? never
		: T[K] extends `[${infer Content}]`
			? Content extends `${infer Name}?`
				? Name
				: Content
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
type ExtractArgs<T extends string> = BracketSegmentsToArgsWithoutVariadic<
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
 * Returns true if the given string is a valid long flag name (2 or more characters).
 * @example
 * IsLong<"long"> // true
 * IsLong<"l"> // false
 */
type IsLong<L extends string> = L extends `${infer _A}${infer _B}`
	? _B extends ""
		? false
		: true
	: false;

/**
 * Returns true if the given string is a valid short flag name (exactly 1 character).
 * @example
 * IsShort<"l"> // true
 * IsShort<"long"> // false
 * IsShort<""> // false
 */
type IsShort<S extends string> = S extends `${infer A}`
	? A extends ""
		? false
		: S extends `${infer _}${infer Rest}`
			? Rest extends ""
				? true
				: false
			: false
	: false;

/**
 * Converts a tuple to a union type, excluding string if present.
 */
type StrictTupleToUnion<T extends readonly unknown[]> =
	T[number] extends infer U ? (string extends U ? never : U) : never;

/**
 * Extracts all valid long flag names from a command definition string.
 * @example
 * ExtractFlagSegments<"list --long|-l --all|-a"> // ["long", "all"]
 * ExtractFlagSegments<"foo --bar|-b --baz"> // ["bar", "baz"]
 */
type ExtractFlagSegments<T extends string> = IsValidFlagPattern<T> extends true
	? FilterValidFlagTokens<SplitTokens<T>> extends infer Arr
		? Arr extends readonly string[]
			? ExtractLongNamesFromTuple<Arr> extends never
				? never
				: ExtractLongNamesFromTuple<Arr>
			: never
		: never
	: never;

/**
 * Extracts long flag names from a tuple of flag segments.
 */
type ExtractLongNamesFromTuple<T extends readonly string[]> = T extends [
	infer Head,
	...infer Tail,
]
	? Head extends string
		?
				| ExtractLongName<Head>
				| ExtractLongNamesFromTuple<Tail extends string[] ? Tail : []>
		: never
	: never;

/**
 * Splits a string into tokens separated by spaces.
 * @example
 * SplitTokens<"foo --bar|-b --baz"> // ["foo", "--bar|-b", "--baz"]
 */
type SplitTokens<
	T extends string,
	Acc extends string[] = [],
> = T extends `${infer Head} ${infer Tail}`
	? SplitTokens<Tail, [...Acc, Head]>
	: T extends ""
		? Acc
		: [...Acc, T];

/**
 * Filters valid option segments from a list of tokens.
 * @example
 * FilterValidOptionTokens<["foo", "--bar|-b=<string>", "--baz=<string>"]> // ["--bar|-b=<string>", "--baz=<string>"]
 */
type FilterValidOptionTokens<Tokens extends readonly string[]> =
	Tokens extends [infer Head, ...infer Tail]
		? Head extends string
			? IsValidOptionSegment<Head> extends true
				? [Head, ...FilterValidOptionTokens<Tail extends string[] ? Tail : []>]
				: FilterValidOptionTokens<Tail extends string[] ? Tail : []>
			: []
		: [];

/**
 * Filters valid flag segments from a list of tokens.
 * @example
 * FilterValidFlagTokens<["foo", "--bar|-b", "--baz"]> // ["--bar|-b", "--baz"]
 */
type FilterValidFlagTokens<Tokens extends readonly string[]> = Tokens extends [
	infer Head,
	...infer Tail,
]
	? Head extends string
		? Head extends `${string}=<${string}>`
			? FilterValidFlagTokens<Tail extends string[] ? Tail : []>
			: IsValidFlagSegment<Head> extends true
				? [Head, ...FilterValidFlagTokens<Tail extends string[] ? Tail : []>]
				: FilterValidFlagTokens<Tail extends string[] ? Tail : []>
		: []
	: [];

/**
 * Returns true if the given flag segment is valid.
 * @example
 * IsValidFlagSegment<"--long|-l"> // true
 * IsValidFlagSegment<"--flag|--f"> // false
 * IsValidFlagSegment<"-f|--flag"> // false
 * IsValidFlagSegment<"--l"> // false
 */
type IsValidFlagSegment<S extends string> = S extends `--${string}|--${string}`
	? false
	: S extends `--${infer Long}|-${infer Short}`
		? IsValidLongFlag<Long> extends true
			? IsValidShortFlag<Short> extends true
				? true
				: false
			: false
		: S extends `--${infer Long}`
			? IsValidLongFlag<Long>
			: false;

type Alphabet =
	| "a"
	| "b"
	| "c"
	| "d"
	| "e"
	| "f"
	| "g"
	| "h"
	| "i"
	| "j"
	| "k"
	| "l"
	| "m"
	| "n"
	| "o"
	| "p"
	| "q"
	| "r"
	| "s"
	| "t"
	| "u"
	| "v"
	| "w"
	| "x"
	| "y"
	| "z"
	| "A"
	| "B"
	| "C"
	| "D"
	| "E"
	| "F"
	| "G"
	| "H"
	| "I"
	| "J"
	| "K"
	| "L"
	| "M"
	| "N"
	| "O"
	| "P"
	| "Q"
	| "R"
	| "S"
	| "T"
	| "U"
	| "V"
	| "W"
	| "X"
	| "Y"
	| "Z";

type Digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

type ValidFlagChar = Alphabet | Digit | "_" | "-";

/**
 * Returns true if the given string is a valid long flag name.
 */
type IsValidLongFlag<T extends string> = T extends `${infer First}${infer Rest}`
	? First extends Alphabet
		? IsLong<T> extends true
			? IsValidFlagChars<Rest> extends true
				? true
				: false
			: false
		: false
	: false;

/**
 * Returns true if all characters in the string are valid flag characters.
 */
type IsValidFlagChars<T extends string> = T extends ""
	? true
	: T extends `${infer F}${infer R}`
		? F extends ValidFlagChar
			? IsValidFlagChars<R>
			: false
		: false;

/**
 * Returns true if the given string is a valid short flag name.
 */
type IsValidShortFlag<T extends string> = T extends `${infer F}`
	? F extends Alphabet
		? true
		: false
	: false;

/**
 * Returns true if the given string is a valid argument name.
 */
type IsValidArgName<T extends string> = T extends `${infer F}${infer R}`
	? F extends Alphabet | "_"
		? IsValidFlagChars<R>
		: false
	: false;

/**
 * Returns true if the given bracket segment is valid.
 */
type IsValidBracketSegment<T extends string> = T extends `[...${infer Name}]`
	? Name extends
			| ""
			| `[${string}`
			| `${string}]`
			| `${string}[${string}`
			| `${string}]${string}`
		? false
		: IsValidArgName<Name>
	: T extends `[${infer Name}?]`
		? Name extends
				| ""
				| `[${string}`
				| `${string}]`
				| `${string}[${string}`
				| `${string}]${string}`
			? false
			: IsValidArgName<Name>
		: T extends `[${infer Name}]`
			? Name extends
					| ""
					| `[${string}`
					| `${string}]`
					| `${string}[${string}`
					| `${string}]${string}`
				? false
				: IsValidArgName<Name>
			: false;

/**
 * Splits a command definition string into its units.
 */
type SplitCommandUnits<T extends string> =
	T extends `${infer Head} ${infer Tail}`
		? [Head, ...SplitCommandUnits<Tail>]
		: T extends ""
			? []
			: [T];

/**
 * Returns true if the given string is a valid command or subcommand name.
 */
type IsValidCommandName<T extends string> = T extends `${infer F}${infer R}`
	? F extends Lowercase<F> | Uppercase<F>
		? IsValidCommandNameChars<R>
		: false
	: false;

/**
 * Returns true if all characters in the string are valid command name characters.
 */
type IsValidCommandNameChars<T extends string> =
	T extends `${infer F}${infer R}`
		? F extends
				| Lowercase<F>
				| Uppercase<F>
				| "_"
				| "-"
				| "0"
				| "1"
				| "2"
				| "3"
				| "4"
				| "5"
				| "6"
				| "7"
				| "8"
				| "9"
			? IsValidCommandNameChars<R>
			: false
		: true;

/**
 * Returns true if the given command unit is valid.
 */
type IsValidCommandUnit<T extends string> = IsValidCommandName<T> extends true
	? true
	: IsValidBracketSegment<T> extends true
		? true
		: IsValidFlagSegment<T> extends true
			? true
			: IsValidOptionSegment<T> extends true
				? true
				: false;

/**
 * Returns true if all command units in the list are valid.
 */
type AllUnitsValid<T extends readonly string[]> = T extends [
	infer H,
	...infer R,
]
	? H extends string
		? IsValidCommandUnit<H> extends true
			? AllUnitsValid<R extends string[] ? R : []>
			: false
		: false
	: true;

/**
 * Extracts the long name from a flag or option segment.
 * @example
 * ExtractLongName<"--bar|-b"> // "bar"
 * ExtractLongName<"--bar=<string>"> // "bar"
 * ExtractLongName<"--bar"> // "bar"
 */
type ExtractLongName<S extends string> = S extends `--${infer Long}|-${string}`
	? Long
	: S extends `--${infer Long}=<${string}>`
		? Long
		: S extends `--${infer Long}`
			? Long
			: never;

/**
 * Returns true if all flag segments in the list are valid.
 */
type AllFlagsValid<T extends readonly string[]> = T extends [
	infer Head,
	...infer Tail,
]
	? Head extends string
		? IsValidFlagSegment<Head> extends true
			? AllFlagsValid<Tail extends readonly string[] ? Tail : []>
			: false
		: false
	: true;

/**
 * Returns true if the command definition contains a short-only flag or a short|long pattern.
 */
type ContainsShortOnlyFlag<T extends string> =
	T extends `${infer A} -${infer S} ${infer Rest}`
		? S extends `-${string}`
			? ContainsShortOnlyFlag<Rest>
			: S extends "" | `${string}|${string}` | `${string}=<${string}>`
				? ContainsShortOnlyFlag<Rest>
				: S extends `${infer B}|--${infer C}`
					? true
					: S extends `${infer D}`
						? S extends `${string}=<${string}>` | `${string}|${string}`
							? ContainsShortOnlyFlag<Rest>
							: true
						: ContainsShortOnlyFlag<Rest>
		: T extends `${infer E} -${infer S}`
			? S extends `-${string}`
				? false
				: S extends "" | `${string}|${string}` | `${string}=<${string}>`
					? false
					: S extends `${infer F}|--${infer G}`
						? true
						: S extends `${infer H}`
							? S extends `${string}=<${string}>` | `${string}|${string}`
								? false
								: true
							: false
			: false;

/**
 * Filters out option tokens (with =<string>) from a list of tokens, leaving only flag tokens.
 */
type FlagTokensOnly<Tokens extends readonly string[]> = Tokens extends [
	infer Head,
	...infer Tail,
]
	? Head extends string
		? Head extends `${string}=<${string}>`
			? FlagTokensOnly<Tail extends string[] ? Tail : []>
			: Head extends
						| `--${string}`
						| `--${string}|-${string}`
						| `-${string}|--${string}`
						| `-${string}`
				? [Head, ...FlagTokensOnly<Tail extends string[] ? Tail : []>]
				: FlagTokensOnly<Tail extends string[] ? Tail : []>
		: []
	: [];

/**
 * Returns true if any flag token exists in the list (excluding options).
 */
type HasAnyFlagToken<Tokens extends readonly string[]> =
	FlagTokensOnly<Tokens> extends [infer Head, ...infer Tail]
		? Head extends string
			? Head extends
					| `--${string}`
					| `--${string}|-${string}`
					| `-${string}|--${string}`
					| `-${string}`
				? true
				: HasAnyFlagToken<Tail extends string[] ? Tail : []>
			: false
		: false;

/**
 * Returns true if any invalid flag token exists in the list (excluding options).
 */
type HasInvalidFlagToken<Tokens extends readonly string[]> =
	FlagTokensOnly<Tokens> extends [infer Head, ...infer Tail]
		? Head extends string
			? IsValidFlagSegment<Head> extends false
				? true
				: HasInvalidFlagToken<Tail extends string[] ? Tail : []>
			: false
		: false;

/**
 * Returns true if the command definition contains only valid flag patterns.
 * @example
 * IsValidFlagPattern<"--foo|-f"> // true
 * IsValidFlagPattern<"-f|--foo"> // false
 * IsValidFlagPattern<"--foo|--f"> // false
 */
type IsValidFlagPattern<T extends string> = HasAnyFlagToken<
	SplitTokens<T>
> extends true
	? HasInvalidFlagToken<SplitTokens<T>> extends true
		? false
		: AllFlagsValid<FilterValidFlagTokens<SplitTokens<T>>> extends true
			? true
			: false
	: true;

/**
 * Extracts the union of all valid long flag names from a command definition string.
 * Returns never if the definition contains invalid flag patterns.
 * @example
 * ExtractFlags<"list --long|-l --all|-a"> // "long" | "all"
 * ExtractFlags<"build --verbose"> // "verbose"
 * ExtractFlags<"foo -f"> // never
 */
type ExtractFlags<T extends string> = ExtractFlagSegments<T>;

/**
 * Returns true if the given option segment is valid (long or long|short, both with value).
 * @example
 * IsValidOptionSegment<"--message=<string>"> // true
 * IsValidOptionSegment<"--message|-m=<string>"> // true
 * IsValidOptionSegment<"-m=<string>"> // false
 * IsValidOptionSegment<"--m=<string>"> // false
 * IsValidOptionSegment<"--option|--o=<string>"> // false
 * IsValidOptionSegment<"-m|--option=<string>"> // false
 */
type IsValidOptionSegment<S extends string> =
	S extends `--${string}|--${string}=<${string}>`
		? false
		: S extends `-${string}|--${string}=<${string}>`
			? false
			: S extends `--${infer Long}|-${infer Short}=<${infer Type}>`
				? IsValidLongFlag<Long> extends true
					? IsValidShortFlag<Short> extends true
						? IsValidOptionType<Type>
						: false
					: false
				: S extends `--${infer Long}=<${infer Type}>`
					? IsValidLongFlag<Long> extends true
						? IsValidOptionType<Type>
						: false
					: false;

/**
 * Returns true if the given string is a valid option type.
 */
type IsValidOptionType<T extends string> = T extends ""
	? false
	: IsValidFlagChars<T>;

/**
 * Returns true if all option segments in the command definition are valid.
 * Only segments with a value (=<...>) are considered options.
 * @example
 * AllOptionsValid<"foo --bar=<string> --baz"> // true
 * AllOptionsValid<"foo --bar|--b=<string>"> // false
 */
type AllOptionsValid<T extends string> = T extends `${infer Head} ${infer Tail}`
	? Head extends `${string}=<${string}>`
		? IsValidOptionSegment<Head> extends true
			? AllOptionsValid<Tail>
			: false
		: AllOptionsValid<Tail>
	: T extends `${string}=<${string}>`
		? IsValidOptionSegment<T> extends true
			? true
			: false
		: true;

/**
 * Extracts the union of all valid long option names from a command definition string.
 * Returns never if the definition contains invalid option patterns.
 * @example
 * ExtractOptions<"foo --bar=<string> --baz=<string>"> // "bar" | "baz"
 * ExtractOptions<"foo --bar|--b=<string>"> // never
 */
type ExtractOptionSegmentsSafe<T extends string> =
	AllOptionsValid<T> extends true
		? FilterValidOptionTokens<SplitTokens<T>> extends infer Arr
			? Arr extends string[]
				? ExtractLongName<Arr[number]> extends never
					? never
					: ExtractLongName<Arr[number]>
				: never
			: never
		: never;

/**
 * Extracts the union of all valid long option names from a command definition string.
 * Returns never if the definition contains invalid option patterns.
 * @example
 * ExtractOptions<"foo --bar=<string> --baz=<string>"> // "bar" | "baz"
 * ExtractOptions<"foo --bar|--b=<string>"> // never
 */
type ExtractOptions<T extends string> = ExtractOptionSegmentsSafe<T>;

/**
 * Extracts all valid long option names from a command definition string.
 * @example
 * ExtractOptionSegments<"foo --bar|-b=<string> --baz=<string>"> // ["bar", "baz"]
 */
type ExtractOptionSegments<T extends string> =
	T extends `${infer _Before}--${infer Long}|-${infer Short}=<${infer _Type}> ${infer After}`
		? IsLong<Long> extends true
			? IsShort<Short> extends true
				? [Long, ...ExtractOptionSegments<After>]
				: ExtractOptionSegments<After>
			: ExtractOptionSegments<After>
		: T extends `${infer _Before}--${infer Long}|-${infer Short}=<${infer _Type}>`
			? IsLong<Long> extends true
				? IsShort<Short> extends true
					? [Long]
					: []
				: []
			: T extends `${infer _Before}--${infer Long}=<${infer _Type}> ${infer After}`
				? IsLong<Long> extends true
					? [Long, ...ExtractOptionSegments<After>]
					: ExtractOptionSegments<After>
				: T extends `${infer _Before}--${infer Long}=<${infer _Type}>`
					? IsLong<Long> extends true
						? [Long]
						: []
					: [];

/**
 * Utility type to extract argument accessors from command definition strings.
 * @example
 * type Example1 = ExtractArgsType<"copy [src] [dest?]">; // { (name: "src"): string; (name: "dest"): string | undefined }
 * type Example2 = ExtractArgsType<"hello [name]">; // (name: "name") => string
 * type Example3 = ExtractArgsType<"list [dir?]">; // (name: "dir") => string | undefined
 * type Example4 = ExtractArgsType<"status">; // (name: never) => never
 */
type ExtractArgsType<T extends string> = [ExtractArgs<T>] extends [never]
	? (name: never) => never
	: [ExtractRequiredArgs<T>] extends [never]
		? <K extends ExtractOptionalArgs<T>>(name: K) => string | undefined
		: [ExtractOptionalArgs<T>] extends [never]
			? <K extends ExtractRequiredArgs<T>>(name: K) => string
			: {
					<K extends ExtractRequiredArgs<T>>(name: K): string;
					<K extends ExtractOptionalArgs<T>>(name: K): string | undefined;
				};

/**
 * Extracts the name of a variadic argument from a command definition string.
 * @example
 * ExtractVariadicArgName<"remove [...files]"> // "files"
 */
type ExtractVariadicArgName<T extends string> =
	T extends `${string}[...${infer Name}]${string}` ? Name : never;

/**
 * Returns true if the string contains unmatched brackets.
 */
type HasUnmatchedBracket<T extends string> =
	T extends `${infer _Before}[${infer Rest}`
		? Rest extends `${infer _Inside}]${infer After}`
			? HasUnmatchedBracket<After>
			: true
		: T extends `${infer _Before}]${infer _Rest}`
			? true
			: false;

/**
 * Determines if a command definition is valid at the type level.
 */
type IsValidCommandDef<T extends string> = HasUnmatchedBracket<T> extends true
	? false
	: AllUnitsValid<SplitCommandUnits<T>> extends true
		? IsValidFlagPattern<T> extends true
			? AllOptionsValid<T> extends true
				? IsValidBracketPattern<T> extends true
					? true
					: false
				: false
			: false
		: false;

/**
 * Validates bracket patterns at the type level (e.g., only one variadic argument, must be last, no duplicates).
 */
type IsValidBracketPattern<T extends string> =
	ExtractBracketSegments<T> extends infer Segs
		? Segs extends readonly string[]
			? AllValidBracketSegments<Segs> extends true
				? CountVariadic<Segs> extends 0 | 1
					? CountVariadic<Segs> extends 1
						? VariadicIsLast<Segs> extends true
							? NoDuplicateArgs<Segs> extends true
								? true
								: false
							: false
						: NoDuplicateArgs<Segs> extends true
							? true
							: false
					: false
				: false
			: false
		: false;

/**
 * Returns true if all bracket segments in the list are valid.
 */
type AllValidBracketSegments<T extends readonly string[]> = T extends [
	infer H,
	...infer R,
]
	? H extends string
		? IsValidBracketSegment<H> extends true
			? AllValidBracketSegments<R extends string[] ? R : []>
			: false
		: false
	: true;

/**
 * Counts the number of variadic arguments in a tuple of bracket segments.
 */
type CountVariadic<T extends readonly string[]> = T extends [
	infer H,
	...infer R,
]
	? H extends `[...${string}]`
		? 1 extends CountVariadic<R extends string[] ? R : []>
			? 2
			: 1
		: CountVariadic<R extends string[] ? R : []>
	: 0;

/**
 * Returns true if the variadic argument is the last in the tuple.
 */
type VariadicIsLast<T extends readonly string[]> = T extends [
	...infer Rest,
	infer Last,
]
	? Last extends `[...${string}]`
		? true
		: T extends [infer H, ...infer R]
			? H extends `[...${string}]`
				? false
				: VariadicIsLast<R extends string[] ? R : []>
			: false
	: false;

/**
 * Checks for duplicate argument names in a tuple of bracket segments.
 */
type NoDuplicateArgs<
	T extends readonly string[],
	Seen extends string[] = [],
> = T extends [infer H, ...infer R]
	? H extends `[${infer Name}]`
		? Name extends `...${infer V}`
			? V extends Seen[number]
				? false
				: NoDuplicateArgs<R extends string[] ? R : [], [...Seen, V]>
			: Name extends `${infer N}?`
				? N extends Seen[number]
					? false
					: NoDuplicateArgs<R extends string[] ? R : [], [...Seen, N]>
				: Name extends Seen[number]
					? false
					: NoDuplicateArgs<R extends string[] ? R : [], [...Seen, Name]>
		: NoDuplicateArgs<R extends string[] ? R : [], Seen>
	: true;

/**
 * Command definition type.
 */
type ValidCommandDef<T extends string> = IsValidCommandDef<T> extends true
	? T
	: never;

/**
 * Context object passed to command handlers containing parsed arguments, flags, options, and shared variables.
 * @template C - The command definition string used for type-safe argument/flag/option access
 * @template T - The object type containing a `Variables` property for shared context variables
 */
export type Context<
	C extends string = string,
	T extends { Variables?: Record<string, unknown> } = {
		Variables?: Record<string, unknown>;
	},
> = {
	/** Type-safe method to access named arguments from command definition */
	arg: ExtractArgsType<C>;
	/** Type-safe method to access variadic arguments from command definition */
	args: ExtractVariadicArgName<C> extends never
		? (name: never) => never
		: <K extends ExtractVariadicArgName<C>>(name: K) => string[];
	/**
	 * Type-safe method to access boolean flags from command definition.
	 * @param name - The long flag name (e.g. "long" for --long|-l)
	 * @returns true if the flag is present, false otherwise
	 */
	flag: ExtractFlags<C> extends never
		? (name: never) => never
		: <K extends ExtractFlags<C>>(name: K) => boolean;
	/**
	 * Type-safe method to access options from command definition.
	 * @param name - The long option name (e.g. "message" for --message=<string>)
	 * @returns The option value if present, undefined otherwise
	 */
	option: ExtractOptions<C> extends never
		? (name: never) => never
		: <K extends ExtractOptions<C>>(name: K) => string | undefined;
	/**
	 * Sets a value in the shared context variables.
	 * @param key - The variable name (must be defined in Variables)
	 * @param value - The value to set
	 */
	set: <K extends keyof T["Variables"]>(
		key: K,
		value: T["Variables"][K],
	) => void;
	/**
	 * Gets a value from the shared context variables.
	 * @param key - The variable name (must be defined in Variables)
	 * @returns The value if set, or undefined
	 */
	get: <K extends keyof T["Variables"]>(
		key: K,
	) => T["Variables"][K] | undefined;
};

/**
 * Middleware function type.
 * @template T - The command definition string for type inference
 */
type MiddlewareFn<
	T extends string = string,
	V extends Record<string, unknown> = Record<string, unknown>,
> = (c: Context<T, V>, next: () => Promise<void>) => Promise<void> | void;

/**
 * Middleware command definition type.
 * @template T - The command definition string for type inference
 */
type MiddlewareCommandDef<T extends string> =
	T extends `${string}[${string}]${string}` ? never : ValidCommandDef<T>;

/**
 * A lightweight CLI framework for building command-line applications.
 */
export class Cli<
	T extends { Variables?: Record<string, unknown> } = {
		Variables?: Record<string, unknown>;
	},
> {
	private name: string;
	private commands: Map<
		string,
		// biome-ignore lint/suspicious/noExplicitAny: Allows storing handlers for commands with different Context types in a single map.
		{ def: string; handler: (c: any) => void }
	> = new Map();
	// biome-ignore lint/suspicious/noExplicitAny: Allows storing handlers for middlewares with different Context types in a single array.
	private middlewares: Array<{ path: string; handler: any }> = [];
	private variables: Partial<T["Variables"]> = {};

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
	command<C extends string>(
		name: ValidCommandDef<C>,
		handler: (c: Context<C, T>) => void,
	) {
		Cli.validateCommandUnits(name);

		const flagDefs = this.extractFlagDefs(name);
		const optionDefs = this.extractOptionDefs(name);

		const flagNames = new Set(flagDefs.map((f) => f.long));
		for (const opt of optionDefs) {
			if (flagNames.has(opt.long)) {
				throw new Error(`Duplicate flag and option name: "${opt.long}"`);
			}
		}

		const argNames = this.extractArgNames(name);
		const seen = new Set<string>();
		for (const arg of argNames) {
			if (seen.has(arg)) {
				throw new Error(`Duplicate argument name: "${arg}"`);
			}
			seen.add(arg);
		}

		this.commands.set(name, {
			def: name,
			handler,
		});
		return this;
	}

	/**
	 * Registers a sub CLI under a command prefix, enabling command grouping and nesting.
	 * All commands from the sub CLI will be registered with the given prefix as their namespace.
	 * This method can be used recursively to support multi-level subcommand trees.
	 * @param prefix - The command prefix (e.g., "sub" or "branch")
	 * @param subCli - The sub CLI instance containing commands to mount under the prefix
	 * @returns The CLI instance for method chaining
	 * @example
	 * ```typescript
	 * const branchCli = new Cli();
	 * branchCli.command("list", c => { ... });
	 * branchCli.command("delete [name]", c => { ... });
	 *
	 * const cli = new Cli({ name: "mycli" });
	 * cli.mount("branch", branchCli);
	 * cli.run(["branch", "list"]);
	 * ```
	 */
	mount(prefix: string, subCli: Cli) {
		for (const [def, entry] of subCli.commands) {
			const newDef = `${prefix} ${def}`;
			this.commands.set(newDef, { ...entry, def: newDef });
		}
		return this;
	}

	/**
	 * Registers a middleware function for the CLI.
	 * @template T - The command definition string for type inference
	 * @param path - Middleware path (must not contain positional or variadic arguments)
	 * @param handler - Middleware function
	 * @returns The CLI instance for method chaining
	 * @throws Error if the middleware path contains positional or variadic arguments
	 */
	use<C extends string>(
		path: MiddlewareCommandDef<C>,
		handler: MiddlewareFn<C, T>,
	): this {
		Cli.validateCommandUnits(path);
		const hasBracket = /\[[^\]]+\]/.test(path);
		if (hasBracket) {
			throw new Error(
				"Middleware path must not contain positional or variadic arguments. Only flags and options are allowed.",
			);
		}
		this.middlewares.push({ path, handler });
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
	async run(args?: string[]) {
		const actualArgs = args ?? this.getProcessArgs();
		// biome-ignore lint/suspicious/noExplicitAny: Allows storing handlers for commands with different Context types in a single map.
		let found: { def: string; handler: (c: any) => void } | null = null;
		null;
		let matchedLen = 0;
		for (const [def, entry] of this.commands) {
			const defParts = def.split(" ");
			const cmdNameParts = [];
			for (const part of defParts) {
				if (part.startsWith("[") || part.startsWith("--")) break;
				cmdNameParts.push(part);
			}
			const argParts = actualArgs.slice(0, cmdNameParts.length);
			if (cmdNameParts.join(" ") === argParts.join(" ")) {
				if (cmdNameParts.length > matchedLen) {
					found = entry;
					matchedLen = cmdNameParts.length;
				}
			}
		}
		if (!found) {
			if (actualArgs.length > 0) {
				console.error(`Unknown command: ${actualArgs[0]}`);
			}
			this.showUsage();
			return;
		}

		const { def: commandDef, handler } = found;
		const defParts = commandDef.split(" ");
		const cmdNameParts = [];
		for (const part of defParts) {
			if (part.startsWith("[") || part.startsWith("--")) break;
			cmdNameParts.push(part);
		}
		const restArgs = actualArgs.slice(cmdNameParts.length);

		const matchedMiddlewares = this.middlewares.filter((mw) =>
			this.isMiddlewareMatch(mw.path, commandDef),
		);

		const allFlagDefs = [
			...this.extractFlagDefs(commandDef),
			...matchedMiddlewares.flatMap((mw) => this.extractFlagDefs(mw.path)),
		];
		const allOptionDefs = [
			...this.extractOptionDefs(commandDef),
			...matchedMiddlewares.flatMap((mw) => this.extractOptionDefs(mw.path)),
		];

		const flagDefsMap = new Map<string, { long: string; short?: string }>();
		for (const f of allFlagDefs) flagDefsMap.set(f.long, f);
		const optionDefsMap = new Map<string, { long: string; short?: string }>();
		for (const o of allOptionDefs) optionDefsMap.set(o.long, o);

		const mergedFlagDefs = Array.from(flagDefsMap.values());
		const mergedOptionDefs = Array.from(optionDefsMap.values());

		const parseFlagsMerged = (args: string[]) => {
			const result: Record<string, boolean> = {};
			for (const { long, short } of mergedFlagDefs) {
				result[long] = false;
			}
			for (const arg of args) {
				if (arg.startsWith("--")) {
					const name = arg.slice(2);
					const def = mergedFlagDefs.find((f) => f.long === name);
					if (def) result[def.long] = true;
				} else if (arg.startsWith("-") && arg.length === 2) {
					const name = arg.slice(1);
					const def = mergedFlagDefs.find((f) => f.short === name);
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

		const parseOptionsMerged = (args: string[]) => {
			const result: Record<string, string | undefined> = {};
			for (const { long } of mergedOptionDefs) {
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
						const def = mergedOptionDefs.find((o) => o.long === name);
						if (def) {
							result[def.long] = value;
						}
					} else {
						const name = arg.slice(2);
						const nextArg = args[i + 1];
						const def = mergedOptionDefs.find((o) => o.long === name);
						if (
							def &&
							typeof nextArg === "string" &&
							!nextArg.startsWith("-")
						) {
							result[def.long] = nextArg;
							i++;
						}
					}
				} else if (arg.startsWith("-") && arg.length === 2) {
					const name = arg.slice(1);
					const nextArg = args[i + 1];
					const def = mergedOptionDefs.find((o) => o.short === name);
					if (def && typeof nextArg === "string" && !nextArg.startsWith("-")) {
						result[def.long] = nextArg;
						i++;
					}
				}
				i++;
			}
			return result;
		};

		const parsedArgs = this.parseCommandArgs(commandDef, restArgs);
		const parsedFlags = parseFlagsMerged(restArgs);
		const parsedOptions = parseOptionsMerged(restArgs);

		try {
			this.validateArgs(commandDef, parsedArgs);
		} catch (error) {
			console.error(`Error: ${(error as Error).message}`);
			this.showUsage();
			return;
		}

		const variables: Partial<T["Variables"]> = {};

		const context = {
			arg: ((name: string) => {
				const value = parsedArgs[name];
				return typeof value === "string" ? value : undefined;
			}) as unknown as ExtractArgsType<typeof commandDef>,
			args: ((name: string) => {
				const value = parsedArgs[name];
				return Array.isArray(value) ? value : [];
			}) as unknown as ExtractVariadicArgName<typeof commandDef> extends never
				? (name: never) => never
				: <K extends ExtractVariadicArgName<typeof commandDef>>(
						name: K,
					) => string[],
			flag: ((name: string) => {
				const value = parsedFlags[name];
				return value === undefined ? undefined : value;
			}) as unknown as ExtractFlags<typeof commandDef> extends never
				? (name: never) => never
				: <K extends ExtractFlags<typeof commandDef>>(name: K) => boolean,
			option: ((name: string) => {
				return parsedOptions[name];
			}) as unknown as ExtractOptions<typeof commandDef> extends never
				? (name: never) => never
				: <K extends ExtractOptions<typeof commandDef>>(
						name: K,
					) => string | undefined,
			set: <K extends keyof T["Variables"]>(
				key: K,
				value: T["Variables"][K],
			) => {
				variables[key] = value;
			},
			get: <K extends keyof T["Variables"]>(key: K) => {
				return variables[key];
			},
		} as Context<typeof commandDef, T>;

		const handlers = [...matchedMiddlewares.map((mw) => mw.handler), handler];

		let idx = 0;
		const next = async (): Promise<void> => {
			if (idx >= handlers.length) return;
			const fn = handlers[idx++];
			if (!fn) return;
			let called = false;
			await fn(context, async () => {
				if (called) throw new Error("next() called multiple times");
				called = true;
				await next();
			});
		};
		await next();
	}

	/**
	 * Determines if a middleware path matches a command definition.
	 * @param mwPath - Middleware path
	 * @param cmdDef - Command definition
	 * @returns True if the middleware path matches the command definition, false otherwise
	 */
	private isMiddlewareMatch(mwPath: string, cmdDef: string): boolean {
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
	}

	/**
	 * Regular expressions for validating each unit of a command definition.
	 * - Command and subcommand names: /^[a-zA-Z][\w-]*$/
	 * - Positional and variadic arguments: /^\[(\.\.\.)?[a-zA-Z_][\w-]*\??\]$/
	 * - Flags (long and optional short): /^--[a-zA-Z][\w-]+(\|-[a-zA-Z])?$/
	 * - Options (long and optional short, with value): /^--[a-zA-Z][\w-]+(\|-[a-zA-Z])?=<[\w-]+>$/
	 */
	private static readonly COMMAND_UNIT_PATTERNS = [
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
	private static validateCommandUnits(commandDef: string) {
		const units = commandDef.trim().split(/\s+/);
		for (const unit of units) {
			if (!Cli.COMMAND_UNIT_PATTERNS.some((re) => re.test(unit))) {
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
	}

	/**
	 * Returns the user arguments, handling various runtime and binary launch patterns.
	 * @returns Array of user-provided arguments (excluding runtime and script/command)
	 * @example
	 * // node mycli.ts foo bar        -> ["foo", "bar"]
	 * // bun mycli.ts foo bar         -> ["foo", "bar"]
	 * // bun run mycli.ts foo bar     -> ["foo", "bar"]
	 * // deno run mycli.ts foo bar    -> ["foo", "bar"]
	 * // ./mycli foo bar              -> ["foo", "bar"]
	 */
	private getProcessArgs(): string[] {
		const argv = process.argv;
		const executablePath = argv[0];
		const executableName = executablePath ? path.basename(executablePath) : "";
		const knownRuntimes = ["node", "bun", "deno"];
		const isKnownRuntime =
			!!executableName &&
			knownRuntimes.some(
				(runtime) =>
					executableName === runtime || executableName === `${runtime}.exe`,
			);
		if (!isKnownRuntime) {
			return argv.slice(1);
		}
		if (
			(argv[0]?.includes("bun") && argv[1] === "run") ||
			(argv[0]?.includes("deno") && argv[1] === "run")
		) {
			return argv.slice(3);
		}
		// node mycli.ts, bun mycli.ts, deno mycli.ts
		return argv.slice(2);
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
	private findCommand(commandName: string) {
		const tryNames = [commandName];
		if (Array.isArray(commandName)) {
			tryNames.push(commandName.join(" "));
		}
		for (const [def, entry] of this.commands) {
			if (def === commandName) return entry;
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
	 * Parses options from command line arguments based on the command definition.
	 * @param commandDef - Command definition string
	 * @param args - Raw command line arguments
	 * @returns An object with two properties:
	 *   - options: Parsed options object with long option names as keys and string or undefined values
	 *   - consumedIndexes: Set of argument indexes that were consumed as option values
	 * @example
	 * this.parseOptionsWithConsumed("commit --message=<string>", ["--message", "hi"]);
	 * // returns { options: { message: "hi" }, consumedIndexes: Set([1]) }
	 */
	private parseOptionsWithConsumed(
		commandDef: string,
		args: string[],
	): {
		options: Record<string, string | undefined>;
		consumedIndexes: Set<number>;
	} {
		const optionDefs = this.extractOptionDefs(commandDef);
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
		const matches = commandDef.match(/\[([^\]]+)\]/g) ?? [];
		const argNames = matches.map((match) => {
			const argName = match.slice(1, -1);
			if (argName.startsWith("...")) return argName.slice(3);
			return argName.endsWith("?") ? argName.slice(0, -1) : argName;
		});

		const variadicIndex = matches.findIndex((match) =>
			match.startsWith("[..."),
		);

		const result: Record<string, string | string[]> = {};
		const { consumedIndexes } = this.parseOptionsWithConsumed(commandDef, args);

		if (variadicIndex === -1) {
			argNames.forEach((name, i) => {
				if (
					args[i] !== undefined &&
					!args[i].startsWith("-") &&
					!consumedIndexes.has(i)
				) {
					result[name] = args[i];
				}
			});
		} else {
			argNames.slice(0, variadicIndex).forEach((name, i) => {
				if (
					args[i] !== undefined &&
					!args[i].startsWith("-") &&
					!consumedIndexes.has(i)
				) {
					result[name] = args[i];
				}
			});
			const variadicName = argNames[variadicIndex];
			if (variadicName !== undefined) {
				const variadicArgs = args.slice(variadicIndex).filter((_, idx) => {
					const absIdx = idx + variadicIndex;
					const val = args[absIdx];
					return (
						val !== undefined &&
						!val.startsWith("-") &&
						!consumedIndexes.has(absIdx)
					);
				});
				result[variadicName] = variadicArgs;
			}
		}

		return result;
	}

	private static readonly RESERVED_NAMES = [
		"constructor",
		"prototype",
		"__proto__",
	];

	/**
	 * Checks if a name is reserved and throws an error if so.
	 * @param name - The name to check
	 * @throws Error if the name is reserved
	 */
	private static checkReserved(name: string) {
		if (Cli.RESERVED_NAMES.includes(name)) {
			throw new Error(
				`Reserved word used as argument/flag/option name: "${name}"`,
			);
		}
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
		const matches = commandDef.match(/\[([^\]]+)\]/g) ?? [];
		return matches.map((match) => {
			let argName = match.slice(1, -1);
			if (argName.startsWith("...")) {
				argName = argName.slice(3);
			}
			Cli.checkReserved(argName);
			return argName;
		});
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
					let name = optional ? argWithBrackets.slice(0, -1) : argWithBrackets;
					if (name.startsWith("...")) {
						name = name.slice(3);
					}
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
	}

	/**
	 * Parses flags from command line arguments based on the command definition.
	 * @param commandDef - Command definition string
	 * @param args - Raw command line arguments
	 * @returns Parsed flags object with long flag names as keys and boolean values
	 * @example
	 * this.parseFlags("list --long|-l --all|-a", ["--long", "--all"]);
	 * // returns { long: true, all: true }
	 * this.parseFlags("list --long|-l --all|-a", ["-l"]);
	 * // returns { long: true, all: false }
	 */
	private parseFlags(
		commandDef: string,
		args: string[],
	): Record<string, boolean | undefined> {
		const flagDefs = this.extractFlagDefs(commandDef);
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
	}

	/**
	 * Extracts flag definitions from a command definition string.
	 * Throws an Error if the definition contains invalid flag patterns.
	 * @param commandDef - Command definition string
	 * @returns Array of flag definitions { long, short }
	 * @throws Error if the command definition contains invalid flag patterns
	 * @example
	 * this.extractFlagDefs("list --long|-l --all|-a");
	 * // returns [{ long: "long", short: "l" }, { long: "all", short: "a" }]
	 * this.extractFlagDefs("foo --bar");
	 * // returns [{ long: "bar", short: undefined }]
	 */
	private extractFlagDefs(
		commandDef: string,
	): Array<{ long: string; short?: string }> {
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
			Cli.checkReserved(long);
			if (short) Cli.checkReserved(short);
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
	}

	/**
	 * Parses options from command line arguments based on the command definition.
	 * @param commandDef - Command definition string
	 * @param args - Raw command line arguments
	 * @returns Parsed options object with long option names as keys and string or undefined values
	 * @example
	 * this.parseOptions("commit --message=<string>", ["--message", "hi"]);
	 * // returns { message: "hi" }
	 */
	private parseOptions(
		commandDef: string,
		args: string[],
	): Record<string, string | undefined> {
		return this.parseOptionsWithConsumed(commandDef, args).options;
	}

	/**
	 * Extracts option definitions from a command definition string.
	 * Throws an Error if the definition contains invalid option patterns.
	 * @param commandDef - Command definition string
	 * @returns Array of option definitions { long, short }
	 * @throws Error if the command definition contains invalid option patterns
	 * @example
	 * this.extractOptionDefs("commit --message=<string> --author=<string>");
	 * // returns [{ long: "message", short: undefined }, { long: "author", short: undefined }]
	 */
	private extractOptionDefs(
		commandDef: string,
	): Array<{ long: string; short?: string }> {
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
			Cli.checkReserved(long);
			if (short) Cli.checkReserved(short);

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
	}
}
