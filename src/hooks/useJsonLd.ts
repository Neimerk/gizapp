import { useEffect, useId } from "react";

// Injects and cleans up JSON-LD structured data per component lifecycle.
// Multiple schemas per page are supported by passing an array.
export function useJsonLd(schema: object | object[] | null | undefined) {
  const id = useId();
  const scriptId = `jsonld-${id.replace(/:/g, "")}`;

  useEffect(() => {
    if (!schema) return;

    const schemas = Array.isArray(schema) ? schema : [schema];
    const existing = document.getElementById(scriptId);
    if (existing) existing.remove();

    const script = document.createElement("script");
    script.id = scriptId;
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(schemas.length === 1 ? schemas[0] : schemas);
    document.head.appendChild(script);

    return () => {
      document.getElementById(scriptId)?.remove();
    };
  }, [schema, scriptId]);
}
