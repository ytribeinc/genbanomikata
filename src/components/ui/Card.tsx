import { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: "none" | "sm" | "md" | "lg";
  shadow?: "none" | "sm" | "md" | "lg";
}

const paddingClasses = {
  none: "",
  sm: "p-3",
  md: "p-5",
  lg: "p-7",
};

const shadowClasses = {
  none: "",
  sm: "shadow-sm",
  md: "shadow-md",
  lg: "shadow-lg",
};

export function Card({
  padding = "md",
  shadow = "sm",
  children,
  className = "",
  ...props
}: CardProps) {
  return (
    <div
      className={[
        "bg-white rounded-xl border border-gray-200",
        paddingClasses[padding],
        shadowClasses[shadow],
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={["mb-4 border-b border-gray-100 pb-4", className].join(" ")}>
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h3 className={["text-lg font-semibold text-gray-900", className].join(" ")}>
      {children}
    </h3>
  );
}
