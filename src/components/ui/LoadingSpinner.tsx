interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
}

const sizeClasses = {
  sm: "h-4 w-4 border-2",
  md: "h-8 w-8 border-2",
  lg: "h-12 w-12 border-4",
};

export function LoadingSpinner({
  size = "md",
  label = "読み込み中...",
  className = "",
}: LoadingSpinnerProps) {
  return (
    <div
      className={["flex flex-col items-center justify-center gap-3", className].join(
        " "
      )}
      role="status"
      aria-label={label}
    >
      <div
        className={[
          "rounded-full border-blue-200 border-t-blue-600 animate-spin",
          sizeClasses[size],
        ].join(" ")}
      />
      <span className="text-sm text-gray-500">{label}</span>
    </div>
  );
}

export function PageSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <LoadingSpinner size="lg" />
    </div>
  );
}
