import * as React from "react";
import { cn } from "@/lib/utils";
import { CONTROL, CONTROL_HEIGHT } from "./control";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          CONTROL,
          CONTROL_HEIGHT,
          "flex px-3 py-1 file:border-0 file:bg-transparent file:font-medium file:text-foreground file:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
