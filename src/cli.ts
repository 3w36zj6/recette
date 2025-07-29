import path from "node:path";
import {
	extractArgNames,
	extractCommandUsage,
	extractFlagDefs,
	extractOptionDefs,
	isMiddlewareMatch,
	parseCommandArgs,
	validateArgs,
	validateCommandUnits,
} from "./internal/utils/parser";

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
		validateCommandUnits(name);

		const flagDefs = extractFlagDefs(name);
		const optionDefs = extractOptionDefs(name);

		const flagNames = new Set(flagDefs.map((f) => f.long));
		for (const opt of optionDefs) {
			if (flagNames.has(opt.long)) {
				throw new Error(`Duplicate flag and option name: "${opt.long}"`);
			}
		}

		const argNames = extractArgNames(name);
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
			const newDef = prefix ? `${prefix} ${def}` : def;
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
		validateCommandUnits(path);
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
		let matchedLen = 0;
		let missingArgsDef: string | null = null;

		for (const [def, entry] of this.commands) {
			const defParts = def.split(" ");
			const cmdNameParts = [];
			for (const part of defParts) {
				if (part.startsWith("[") || part.startsWith("--")) break;
				cmdNameParts.push(part);
			}
			const argParts = actualArgs.slice(0, cmdNameParts.length);
			if (cmdNameParts.join(" ") !== argParts.join(" ")) continue;

			const restArgs = actualArgs.slice(cmdNameParts.length);
			const possibleSub = Array.from(this.commands.keys()).filter(
				(k) => k.startsWith(`${def} `) && k !== def,
			);
			if (possibleSub.length > 0 && restArgs.length > 0) {
				const subNames = possibleSub.map((k) => {
					const subParts = k.split(" ").slice(cmdNameParts.length);
					return subParts;
				});
				if (
					subNames.some(
						(parts) =>
							parts.length >= restArgs.length &&
							parts.slice(0, restArgs.length).join(" ") === restArgs.join(" "),
					)
				) {
					continue;
				}
			}

			const argDefs = defParts
				.slice(cmdNameParts.length)
				.filter((p) => p.startsWith("["));
			const requiredArgsCount = argDefs.filter(
				(a) => !a.endsWith("?]") && !a.startsWith("[..."),
			).length;

			if (restArgs.length < requiredArgsCount) {
				if (cmdNameParts.length > matchedLen) {
					missingArgsDef = def;
					matchedLen = cmdNameParts.length;
				}
				continue;
			}

			if (cmdNameParts.length > matchedLen) {
				found = entry;
				matchedLen = cmdNameParts.length;
				missingArgsDef = null;
			}
		}

		if (!found) {
			if (missingArgsDef) {
				const errorHeading = "\x1b[1m\x1b[37m\x1b[41mError:\x1b[0m\x1b[31m";
				const errorReset = "\x1b[0m";
				const defParts = missingArgsDef.split(" ");
				const cmdNameParts = [];
				for (const part of defParts) {
					if (part.startsWith("[") || part.startsWith("--")) break;
					cmdNameParts.push(part);
				}
				const argDefs = defParts
					.slice(cmdNameParts.length)
					.filter(
						(p) =>
							p.startsWith("[") && !p.endsWith("?]") && !p.startsWith("[..."),
					);
				const missingArg =
					argDefs[actualArgs.length - cmdNameParts.length] ||
					argDefs[0] ||
					"[arg]";
				const argName = missingArg.replace(/[\[\]?]/g, "");
				console.error(
					`${errorHeading} Required argument '${argName}' is missing${errorReset}`,
				);
				this.showCommandUsage(missingArgsDef);
				return;
			}
			const partialPath = actualArgs.join(" ");
			const subcommands = Array.from(this.commands.keys()).filter((k) =>
				k.startsWith(`${partialPath} `),
			);
			if (subcommands.length > 0) {
				const usageHeading = "\x1b[1m\x1b[4mUsage:\x1b[0m";
				for (const sub of subcommands) {
					this.showCommandUsage(sub);
				}
				return;
			}
			if (actualArgs.length > 0) {
				const errorHeading =
					"\x1b[1m\x1b[37m\x1b[41mUnknown command:\x1b[0m\x1b[31m";
				const errorReset = "\x1b[0m";
				console.error(`${errorHeading} ${actualArgs[0]}${errorReset}`);
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
			isMiddlewareMatch(mw.path, commandDef),
		);

		const allFlagDefs = [
			...extractFlagDefs(commandDef),
			...matchedMiddlewares.flatMap((mw) => extractFlagDefs(mw.path)),
		];
		const allOptionDefs = [
			...extractOptionDefs(commandDef),
			...matchedMiddlewares.flatMap((mw) => extractOptionDefs(mw.path)),
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

		const parsedArgs = parseCommandArgs(commandDef, restArgs);
		const parsedFlags = parseFlagsMerged(restArgs);
		const parsedOptions = parseOptionsMerged(restArgs);

		try {
			validateArgs(commandDef, parsedArgs);
		} catch (error) {
			const errorHeading = "\x1b[1m\x1b[37m\x1b[41mError:\x1b[0m\x1b[31m";
			const errorReset = "\x1b[0m";
			console.error(`${errorHeading} ${(error as Error).message}${errorReset}`);
			this.showCommandUsage(commandDef);
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
	 */
	private showUsage() {
		const usageHeading = "\x1b[1m\x1b[4mUsage:\x1b[0m";
		const usageCommand = `\x1b[0m\x1b[1m${this.name}\x1b[0m`;
		const usageCmd = "\x1b[1m\x1b[34m<command>\x1b[0m";
		const usageArgs = "\x1b[32m[...args]\x1b[0m";
		const usageFlag = "\x1b[33m--flag\x1b[0m";
		const usageOpt = "\x1b[35m--option=<value>\x1b[0m";
		console.log(
			`${usageHeading} ${usageCommand} ${usageCmd} ${usageArgs} ${usageFlag} ${usageOpt}`,
		);

		if (this.commands.size > 0) {
			const groups = new Map<string, Array<[string, string]>>();
			for (const [commandDef] of this.commands) {
				const parts = commandDef.split(" ");
				const cmdNames = [];
				for (const part of parts) {
					if (part.startsWith("[") || part.startsWith("--")) break;
					cmdNames.push(part);
				}
				let group: string;
				if (cmdNames.length === 1) {
					group = "Commands";
				} else if (cmdNames.length > 1) {
					group = cmdNames[0] ?? "Commands";
				} else {
					group = "Commands";
				}
				if (!groups.has(group)) groups.set(group, []);
				groups.get(group)?.push([commandDef, extractCommandUsage(commandDef)]);
			}

			for (const [group, arr] of groups.entries()) {
				const heading =
					group === "Commands"
						? "Main Tasks"
						: `${group.charAt(0).toUpperCase()}${group.slice(1)}`;
				const headingStyled = `\x1b[1m\x1b[4m${heading}:\x1b[0m`;
				console.log(`\n${headingStyled}`);

				const commandsHeading = "\x1b[1m\x1b[4mCommands:\x1b[0m";
				console.log(`  ${commandsHeading}`);

				const sorted = arr.slice().sort(([a], [b]) => a.localeCompare(b));
				for (const [commandDef] of sorted) {
					const parts = commandDef.split(" ");
					const nameParts = [];
					for (const part of parts) {
						if (part.startsWith("[") || part.startsWith("--")) break;
						nameParts.push(part);
					}
					const commandName = nameParts.join(" ");
					const argTokens = parts
						.slice(nameParts.length)
						.filter((p) => p.startsWith("["));
					const flagTokens = parts
						.slice(nameParts.length)
						.filter((p) => p.startsWith("--") && !p.includes("=<"));
					const optionTokens = parts
						.slice(nameParts.length)
						.filter((p) => p.startsWith("--") && p.includes("=<"));

					const commandNameColored = `\x1b[1m\x1b[34m${commandName}\x1b[0m`;
					const argsColored = argTokens
						.map((a) => `\x1b[32m${a}\x1b[0m`)
						.join(" ");
					const flagStr = flagTokens
						.map((f) =>
							f.includes("|-")
								? f
										.split("|-")
										.map((t, i) =>
											i === 0 ? `\x1b[33m${t}\x1b[0m` : `\x1b[33m-${t}\x1b[0m`,
										)
										.join("|")
								: `\x1b[33m${f}\x1b[0m`,
						)
						.join(" ");
					const optionStr = optionTokens
						.map((o) =>
							o.includes("|-")
								? o
										.split("|-")
										.map((t, i) =>
											i === 0
												? `\x1b[35m${t}\x1b[0m`
												: `\x1b[35m-${t.replace("=<string>", "")}=<string>\x1b[0m`,
										)
										.join("|")
								: `\x1b[35m${o}\x1b[0m`,
						)
						.join(" ");

					const usage = [commandNameColored, argsColored, flagStr, optionStr]
						.filter(Boolean)
						.join(" ");
					console.log(`    ${usage}`);
				}

				const groupCommands = arr.map(([commandDef]) => commandDef);
				const groupMiddlewares = this.middlewares.filter((mw) =>
					groupCommands.some((cmd) => isMiddlewareMatch(mw.path, cmd)),
				);
				const groupFlagDefs = [
					...new Set(
						groupMiddlewares.flatMap((mw) =>
							extractFlagDefs(mw.path).map((f) =>
								f.short
									? `\x1b[33m--${f.long}|-${f.short}\x1b[0m`
									: `\x1b[33m--${f.long}\x1b[0m`,
							),
						),
					),
				];
				const groupOptionDefs = [
					...new Set(
						groupMiddlewares.flatMap((mw) =>
							extractOptionDefs(mw.path).map((o) =>
								o.short
									? `\x1b[35m--${o.long}|-${o.short}=<string>\x1b[0m`
									: `\x1b[35m--${o.long}=<string>\x1b[0m`,
							),
						),
					),
				];

				if (groupFlagDefs.length || groupOptionDefs.length) {
					const optionsHeading = "\x1b[1m\x1b[4mOptions:\x1b[0m";
					console.log(`\n  ${optionsHeading}`);
					console.log(
						`    ${[...groupFlagDefs, ...groupOptionDefs].join(" ")}`,
					);
				}
			}
		}
	}

	/**
	 * Shows usage information for a specific command.
	 * @param commandDef - Command definition string (e.g., `hello [name]`)
	 */
	private showCommandUsage(commandDef: string) {
		const usageHeading = "\x1b[1m\x1b[4mUsage:\x1b[0m";
		const parts = commandDef.split(" ");
		const nameParts = [];
		for (const part of parts) {
			if (part.startsWith("[") || part.startsWith("--")) break;
			nameParts.push(part);
		}
		const commandName = `\x1b[1m${this.name}\x1b[0m \x1b[1m\x1b[34m${nameParts.join(" ")}\x1b[0m`;
		const argTokens = parts
			.slice(nameParts.length)
			.filter((p) => p.startsWith("["));
		const flagTokens = parts
			.slice(nameParts.length)
			.filter((p) => p.startsWith("--") && !p.includes("=<"));
		const optionTokens = parts
			.slice(nameParts.length)
			.filter((p) => p.startsWith("--") && p.includes("=<"));

		const argsColored = argTokens.map((a) => `\x1b[32m${a}\x1b[0m`).join(" ");
		const flagStr = flagTokens
			.map((f) =>
				f.includes("|-")
					? f
							.split("|-")
							.map((t, i) =>
								i === 0 ? `\x1b[33m${t}\x1b[0m` : `\x1b[33m-${t}\x1b[0m`,
							)
							.join("|")
					: `\x1b[33m${f}\x1b[0m`,
			)
			.join(" ");
		const optionStr = optionTokens
			.map((o) =>
				o.includes("|-")
					? o
							.split("|-")
							.map((t, i) =>
								i === 0
									? `\x1b[35m${t}\x1b[0m`
									: `\x1b[35m-${t.replace("=<string>", "")}=<string>\x1b[0m`,
							)
							.join("|")
					: `\x1b[35m${o}\x1b[0m`,
			)
			.join(" ");

		const usage = [commandName, argsColored, flagStr, optionStr]
			.filter(Boolean)
			.join(" ");
		console.log(`${usageHeading} ${usage}`);
	}
}
