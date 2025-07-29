import * as path from "node:path";
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
});
