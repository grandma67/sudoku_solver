/** Decorative animated layer; the look depends on the theme's [data-effect]. */
export function Background() {
  return (
    <div className="fx" aria-hidden="true">
      <div className="fx-a" />
      <div className="fx-b" />
      <div className="fx-c" />
    </div>
  );
}
