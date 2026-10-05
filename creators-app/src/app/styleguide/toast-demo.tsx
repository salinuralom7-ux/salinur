"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ToastDemo() {
  return (
    <Button variant="glass" onClick={() => toast.success("Saved to shortlist 💜", { description: "You can find it under Saved." })}>
      Show a toast
    </Button>
  );
}
