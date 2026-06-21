import { useEffect } from "react";

const APP_NAME = "BrasUX Shopping";
const DEFAULT_DESCRIPTION =
  "O Shopping Brasileiro de Soluções Tecnológicas. Educação, IA, Desenvolvimento, Gestão, Dados, APIs e muito mais.";

function setMetaTag(attr: "name" | "property", key: string, value: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}

export function usePageMeta({
  title,
  description,
  imageUrl,
}: {
  title?: string;
  description?: string;
  imageUrl?: string;
} = {}) {
  useEffect(() => {
    const fullTitle = title ? `${title} — ${APP_NAME}` : APP_NAME;
    const desc = description ?? DEFAULT_DESCRIPTION;

    document.title = fullTitle;

    setMetaTag("name", "description", desc);
    setMetaTag("property", "og:title", fullTitle);
    setMetaTag("property", "og:description", desc);
    setMetaTag("property", "og:type", "website");
    setMetaTag("property", "og:site_name", APP_NAME);
    setMetaTag("name", "twitter:card", "summary_large_image");
    setMetaTag("name", "twitter:title", fullTitle);
    setMetaTag("name", "twitter:description", desc);

    if (imageUrl) {
      setMetaTag("property", "og:image", imageUrl);
      setMetaTag("name", "twitter:image", imageUrl);
    }

    return () => {
      document.title = APP_NAME;
    };
  }, [title, description, imageUrl]);
}
