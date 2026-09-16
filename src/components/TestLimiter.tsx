import React, { useEffect } from "react";
import { useToasterStore, toast } from "react-hot-toast";

export function TestLimiter() {
  const { toasts } = useToasterStore();
  
  useEffect(() => {
    if (toasts.length > 0) {
      console.log("TOASTS ORDER:", toasts.map(t => t.message));
    }
  }, [toasts]);
  
  return null;
}
