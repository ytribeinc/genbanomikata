import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "楽々日報 - ログイン",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-amber-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-blue-600 tracking-tight">
          楽々日報
        </h1>
        <p className="mt-1 text-gray-500 text-sm">施工管理をもっとかんたんに</p>
      </div>
      {children}
    </div>
  );
}
