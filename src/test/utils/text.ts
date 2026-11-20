// visibleText is an element's text without SVG titles, which give icons an
// accessible name but aren't shown.
export const visibleText = (element: Element | null | undefined): string => {
  if (!element) return "";
  const clone = element.cloneNode(true) as Element;
  clone.querySelectorAll("title").forEach((title) => title.remove());
  return clone.textContent ?? "";
};
