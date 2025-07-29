import * as path from "node:path";
import { pluginOpenGraph } from "rsbuild-plugin-open-graph";
import { defineConfig } from "rspress/config";

export default defineConfig({
	root: path.join(__dirname, "docs"),
	base: "/recette/",
	title: "Recette",
	logoText: "Recette",
	themeConfig: {
		socialLinks: [
			{
				icon: "github",
				mode: "link",
				content: "https://github.com/3w36zj6/recette",
			},
		],
	},
	globalStyles: path.join(__dirname, "styles/index.css"),
	builderConfig: {
		plugins: [
			pluginOpenGraph({
				title: "Recette",
				type: "website",
				url: "https://3w36zj6.github.io/recette/",
				description: "A type-safe, declarative CLI framework for TypeScript.",
			}),
		],
	},
});
