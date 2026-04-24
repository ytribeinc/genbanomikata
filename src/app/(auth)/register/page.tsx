"use client";

import { useState, FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

interface FormErrors {
  companyName?: string;
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export default function RegisterPage() {
  const router = useRouter();

  const [companyName, setCompanyName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function validate(): FormErrors {
    const errs: FormErrors = {};
    if (!companyName.trim()) errs.companyName = "会社名を入力してください";
    if (!name.trim()) errs.name = "名前を入力してください";
    if (!email.trim()) errs.email = "メールアドレスを入力してください";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errs.email = "正しいメールアドレスを入力してください";
    if (!password) errs.password = "パスワードを入力してください";
    else if (password.length < 8) errs.password = "8文字以上で入力してください";
    if (!confirmPassword)
      errs.confirmPassword = "確認用パスワードを入力してください";
    else if (password !== confirmPassword)
      errs.confirmPassword = "パスワードが一致しません";
    return errs;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(null);

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setServerError(data.error ?? "登録に失敗しました");
        return;
      }

      // 登録成功後、自動ログイン
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: "/",
      });

      if (result?.error) {
        router.push("/login");
      } else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setServerError("登録に失敗しました。もう一度お試しください。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md" shadow="md">
      <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
        新規アカウント登録
      </h2>

      {serverError && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
          <svg
            className="h-5 w-5 flex-shrink-0 mt-0.5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Input
          label="会社名"
          type="text"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="株式会社〇〇建設"
          required
          error={errors.companyName}
          autoFocus
        />

        <Input
          label="お名前"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="山田 太郎"
          required
          error={errors.name}
        />

        <Input
          label="メールアドレス"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          autoComplete="email"
          error={errors.email}
        />

        <Input
          label="パスワード"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="8文字以上"
          required
          autoComplete="new-password"
          error={errors.password}
          hint="8文字以上で設定してください"
        />

        <Input
          label="パスワード（確認）"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="••••••••"
          required
          autoComplete="new-password"
          error={errors.confirmPassword}
        />

        <Button
          type="submit"
          size="lg"
          loading={loading}
          className="w-full mt-2"
        >
          登録する
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        すでにアカウントをお持ちの方は{" "}
        <Link
          href="/login"
          className="text-blue-600 font-medium hover:underline"
        >
          ログイン
        </Link>
      </p>
    </Card>
  );
}
