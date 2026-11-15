import * as React from "react";

import { cn } from "@/lib/utils";
// CUSTOM-HOOK: primitive-quiet-paper-textarea begin
import { fieldClass } from "@/custom/primitives/classes";
// CUSTOM-HOOK: primitive-quiet-paper-textarea end

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(fieldClass, "h-auto min-h-24 py-2 leading-normal", className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
