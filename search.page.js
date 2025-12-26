export const url = "/search.json";

export default function ({ search }, { url }) {
  const result = [];

  // Search tags
  for (const tag of search.values("type=posts")) {
    result.push({
      label: `Tag: ${tag}`,
      search: tag,
      value: url(`/tags/${tag}/`),
    });
  }

  // Search posts
  for (const data of search.pages("type=posts")) {
    result.push({
      label: data.title,
      search: `${data.title} ${data.tags.join(" ")}`,
      value: url(data.url),
    });
  }

  return JSON.stringify(result);
}
