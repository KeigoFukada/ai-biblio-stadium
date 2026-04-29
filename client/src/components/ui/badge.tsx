import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-violet-500/20 text-violet-300 border border-violet-500/30",
        gold: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
        green: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
        red: "bg-red-500/20 text-red-300 border border-red-500/30",
        blue: "bg-blue-500/20 text-blue-300 border border-blue-500/30",
        slate: "bg-slate-500/20 text-slate-300 border border-slate-500/30",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}
