import * as React from "react";

import { cn } from "@/lib/utils";
// CUSTOM-HOOK: primitive-quiet-paper-input begin
import { fieldClass } from "@/custom/primitives/classes";
// CUSTOM-HOOK: primitive-quiet-paper-input end

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          fieldClass,
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
