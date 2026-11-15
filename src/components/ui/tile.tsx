import { cn } from "@/lib/utils";

type TileProps<E extends React.ElementType> = {
  as?: E;
  /** A course colour (or any colour value) to tint the tile with. */
  tint?: string | null;
  /** Border glow that follows the pointer (hover devices only). */
  spotlight?: boolean;
  /** Position in a staggered entrance (0, 1, 2…). Omit for no entrance animation. */
  reveal?: number;
} & Omit<React.ComponentPropsWithoutRef<E>, "as">;

/** The bento card: layered surface, soft border and shadow, optional course tint, spotlight and entrance. */
export function Tile<E extends React.ElementType = "div">({
  as,
  tint,
  spotlight = false,
  reveal,
  className,
  style,
  ...props
}: TileProps<E>) {
  const Component = as ?? "div";
  return (
    <Component
      data-spotlight={spotlight || undefined}
      className={cn("tile", tint && "tile-tinted", reveal !== undefined && "reveal", className)}
      style={{
        ...(tint ? { "--tint": tint } : null),
        ...(reveal !== undefined ? { "--i": reveal } : null),
        ...style,
      }}
      {...props}
    />
  );
}

/** Inline style for a staggered entrance on any element (pair with the `reveal` class). */
export function revealStyle(index: number): React.CSSProperties {
  return { "--i": index } as React.CSSProperties;
}
