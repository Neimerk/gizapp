import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { SEO, canonicalUrl } from "../lib/seo";

type RobotsDirective = "index,follow" | "noindex,nofollow" | "noindex,follow" | "index,nofollow";

function setMeta(attr: "name" | "property", key: string, value: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}

function setLink(rel: string, href: string) {
  let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function removeMeta(attr: "name" | "property", key: string) {
  document.querySelector(`meta[${attr}="${key}"]`)?.remove();
}

export function usePageMeta({
  title,
  description,
  imageUrl,
  robots,
  ogType,
  canonical: explicitCanonical,
}: {
  title?: string;
  description?: string;
  imageUrl?: string;
  robots?: RobotsDirective;
  ogType?: "website" | "product" | "article";
  canonical?: string;
} = {}) {
  const { pathname } = useLocation();

  useEffect(() => {
    const fullTitle = title ? `${title} — ${SEO.site.name}` : SEO.site.name;
    const desc = description ?? SEO.site.description;
    const image = imageUrl ?? SEO.site.ogImage;
    const canonical = explicitCanonical ?? canonicalUrl(pathname);
    const type = ogType ?? "website";
    const robotsContent = robots ?? "index,follow";

    document.title = fullTitle;

    setMeta("name", "description", desc);
    setMeta("name", "robots", robotsContent);
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:site", SEO.site.twitterHandle);
    setMeta("name", "twitter:title", fullTitle);
    setMeta("name", "twitter:description", desc);
    setMeta("name", "twitter:image", image);

    setMeta("property", "og:title", fullTitle);
    setMeta("property", "og:description", desc);
    setMeta("property", "og:type", type);
    setMeta("property", "og:site_name", SEO.site.name);
    setMeta("property", "og:image", image);
    setMeta("property", "og:url", canonical);
    setMeta("property", "og:locale", SEO.site.locale);

    setLink("canonical", canonical);

    return () => {
      document.title = SEO.site.name;
      removeMeta("name", "robots");
    };
  }, [title, description, imageUrl, robots, ogType, explicitCanonical, pathname]);
}
