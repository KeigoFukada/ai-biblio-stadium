import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-white placeholder:text-slate-500 backdrop-blur-sm transition-all",
        "focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white placeholder:text-slate-500 backdrop-blur-sm transition-all resize-none",
        "focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
      {...props}
    />
  );
}
