import lume from "lume/mod.ts";
import nunjucks from "lume/plugins/nunjucks.ts";
import date from "lume/plugins/date.ts";
import postcss from "lume/plugins/postcss.ts";
import terser from "lume/plugins/terser.ts";
import codeHighlight from "lume/plugins/code_highlight.ts";
import basePath from "lume/plugins/base_path.ts";
import slugifyUrls from "lume/plugins/slugify_urls.ts";
import resolveUrls from "lume/plugins/resolve_urls.ts";
import gpm from "https://deno.land/x/gpm@v0.5.0/mod.ts";
import tailwindcss from "lume/plugins/tailwindcss.ts";

const modules = { pageSubExtension: ".page" };
const json = { pageSubExtension: ".page" };

const site = lume(
  { location: new URL("https://sacharose.io/") },
  { modules, json },
);

site.data("currentYear", new Date().getFullYear());

site.use(nunjucks());

site.use(slugifyUrls({
  alphanumeric: false, // To allow non-alphanumeric characters
  extensions: [".html"], // To slugify only HTML pages
}));

site.data("isDevEnv", Deno.env.get("PROD") === "true");
site.use(tailwindcss({
  extensions: [".html", ".njk"],
  options: {
    content: ["./**/*.{html,njk,js,ts}"],
    theme: {
      extend: {
        colors: {
          neutral: {
            950: "#1F1F1F",
            900: "#2B2B2B",
            800: "#3A3A3A",
            700: "#4A4A4A",
            300: "#D7D1CA",
            200: "#CFC9C2",
            150: "#B7B0A8",
            100: "#EDEAE6",
            50: "#F3EFE9",
          },
          moon: {
            blue: "#A9C4FF",
            coral: "#FF8B82",
            green: "#6FBFA6",
          },
          earth: {
            clay: "#8A6F5A",
            wood: "#6F6A63",
          },

          // keep your original accents if you still use them elsewhere
          green: "#0b8a6f",
          blue: "#265ba4",
          pink: "#ef8484",
        },
        fontFamily: {
          display: ["ui-sans-serif", "system-ui", "Inter", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
          mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "Liberation Mono", "Courier New", "monospace"],
        },
        boxShadow: {
          soft: "0 10px 40px -12px rgba(0,0,0,0.35)",
        },
      },
    },
  },
}));


site
  .ignore("README.md", "functions")
  .copy("img")
  .use(postcss())
  .use(date())
  .use(terser())
  .use(codeHighlight())
  .use(basePath())
  .use(resolveUrls())
  .copy("_redirects", "_redirects")
  .addEventListener(
    "beforeBuild",
    () => gpm(["oom-components/searcher"], "js/vendor"),
  );

// site.addEventListener("afterBuild", (site: Site) => {
//   const blogArticles = Array.from(site.pages.values());

//   console.log('Generated Blog Articles:', blogArticles);
// });


export default site;
