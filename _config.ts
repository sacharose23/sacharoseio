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
  { location: new URL("https://stormclouddevelopment.com/") },
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
    content: ['./**/*.{html,js}'],
    theme: {
      extend: {
        colors: {
          storm: { 900: '#0B0E12', 800: '#11151B', 700: '#1A202A' },
          lightning: '#18D5FF', ember: '#FF4D4D', aurora: '#9B5CFF',
        },
        fontFamily: {
          display: ['ui-sans-serif', 'system-ui', 'Inter', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
          mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace']
        },
        boxShadow: { soft: '0 10px 40px -12px rgba(0,0,0,0.35)' }
      }
    },
    // theme: {
    //   colors: {
    //     "current": "currentColor",
    //     "primary": "#e4c26b",    // Gold - for rustic and cozy elements
    //     "accent": "#468189",     // Deep Teal - for a calming, lake-inspired tone
    //     "secondary": "#2a120c",  // Dark brown - good for text
    //     "black": "#2B2B2B",      // Soft Black - for text and strong contrast elements
    //     "gray": {
    //       "50": "#F7F6F2",
    //       "100": "#ECE8E1",
    //       "200": "#DDD7C8",
    //       "300": "#C5BAA2",
    //       "400": "#A7997E",
    //       "500": "#8A716A",
    //       "600": "#6F5B56",
    //       "700": "#564641",
    //       "800": "#3E302C",
    //       "900": "#28211F"
    //     },
    //     "slate": {
    //       "50": "#F8FAFC", // background-color: rgb(248 250 252);
    //       "100": "#F1F5F9", // background-color: rgb(241 245 249);
    //       "200": "#E2E8F0", // background-color: rgb(226 232 240);
    //       "300": "#CBD5E1", // background-color: rgb(203 213 225);
    //       "400": "#94A3B8", // background-color: rgb(148 163 184);
    //       "500": "#64748B", // background-color: rgb(100 116 139);
    //       "600": "#475569", // background-color: rgb(71 85 105);
    //       "700": "#334155", // background-color: rgb(51 65 85);
    //       "800": "#1E293B", // background-color: rgb(30 41 59);
    //       "900": "#0F172A", // background-color: rgb(15 23 42);
    //       "950": "#020617", // background-color: rgb(2 6 23);
    //     },
    //     "green": "#6A8E46",     // Forest Green - to highlight nature and outdoor activities
    //     "beige": "#F4E3C7",     // Soft Beige - for backgrounds and neutral areas
    //     "red": "#B5383F"        // Warm Red - for inviting and energetic accents
    //   },
    //   fontFamily: {
    //     heading: ['Oswald', 'sans-serif'],
    //     body: ['Open Sans', 'sans-serif'],
    //   },
    // },
  },
},
));

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
