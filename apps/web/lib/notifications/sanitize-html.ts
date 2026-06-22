import DOMPurify from "isomorphic-dompurify";

const EMAIL_TEMPLATE_ALLOWED_TAGS = [
  "a",
  "b",
  "br",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "i",
  "li",
  "ol",
  "p",
  "span",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
];

const EMAIL_TEMPLATE_ALLOWED_ATTR = ["href", "target", "rel", "style", "class", "colspan", "rowspan"];

/** Strip scripts and dangerous markup from notification HTML templates. */
export function sanitizeNotificationHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: EMAIL_TEMPLATE_ALLOWED_TAGS,
    ALLOWED_ATTR: EMAIL_TEMPLATE_ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}
