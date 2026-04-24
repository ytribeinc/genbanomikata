type BadgeVariant =
  // 案件ステータス
  | "active"
  | "completed"
  | "pending"
  | "cancelled"
  // 天気
  | "sunny"
  | "cloudy"
  | "rainy"
  | "snowy"
  // 役割
  | "admin"
  | "manager"
  | "worker"
  // 汎用
  | "default"
  | "info"
  | "success"
  | "warning"
  | "danger";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  // 案件ステータス
  active: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  pending: "bg-amber-100 text-amber-800",
  cancelled: "bg-gray-100 text-gray-600",
  // 天気
  sunny: "bg-yellow-100 text-yellow-800",
  cloudy: "bg-gray-100 text-gray-700",
  rainy: "bg-sky-100 text-sky-800",
  snowy: "bg-indigo-100 text-indigo-800",
  // 役割
  admin: "bg-purple-100 text-purple-800",
  manager: "bg-blue-100 text-blue-800",
  worker: "bg-teal-100 text-teal-800",
  // 汎用
  default: "bg-gray-100 text-gray-700",
  info: "bg-blue-100 text-blue-800",
  success: "bg-green-100 text-green-800",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-800",
};

export function Badge({
  variant = "default",
  children,
  className = "",
}: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        variantClasses[variant],
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}
