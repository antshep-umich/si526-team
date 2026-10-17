import { icons, type IconName } from "./icons.ts";

/**
 * Shows the light or dark version of an icon to match the current theme
 * (switching rules in src/styles/base.css). Decorative: the surrounding
 * control carries the accessible name. Each file keeps its own Figma size.
 */
export default function ThemedIcon({ name, className }: { name: IconName; className?: string }) {
  const { light, dark } = icons[name];
  return (
    <span className={className} style={{ display: "inline-flex", flexShrink: 0 }} aria-hidden="true">
      <img src={light} alt="" data-icon-theme="light" />
      <img src={dark} alt="" data-icon-theme="dark" />
    </span>
  );
}
