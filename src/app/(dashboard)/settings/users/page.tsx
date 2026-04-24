"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

type UserRole = "ADMIN" | "MANAGER" | "WORKER";
type MemberType = "own" | "sub"; // 自社スタッフ | 下請け業者

interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  subcontractorName: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

const ROLE_COLORS: Record<UserRole, string> = {
  ADMIN: "bg-purple-100 text-purple-700",
  MANAGER: "bg-blue-100 text-blue-700",
  WORKER: "bg-gray-100 text-gray-600",
};
const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "管理者",
  MANAGER: "監督",
  WORKER: "作業員",
};

export default function UsersPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const isManagerOrAdmin =
    session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER";

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // フォーム値
  const [memberType, setMemberType] = useState<MemberType>("own");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [subcontractorName, setSubcontractorName] = useState("");
  // 自社スタッフのみ: 監督か作業員か（ADMINが追加するときのみ選択可）
  const [staffRole, setStaffRole] = useState<"WORKER" | "MANAGER">("WORKER");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const d = await res.json();
        setUsers(d.users ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  function resetForm() {
    setMemberType("own");
    setName(""); setEmail(""); setPassword("");
    setSubcontractorName(""); setStaffRole("WORKER");
    setFormError(null);
    setEditingId(null);
  }

  function openCreate() {
    resetForm();
    setShowForm(true);
  }

  function openEdit(u: AppUser) {
    setEditingId(u.id);
    setMemberType(u.subcontractorName ? "sub" : "own");
    setName(u.name);
    setEmail(u.email);
    setPassword("");
    setSubcontractorName(u.subcontractorName ?? "");
    setStaffRole(u.role === "MANAGER" ? "MANAGER" : "WORKER");
    setFormError(null);
    setShowForm(true);
  }

  async function handleSave() {
    if (!name.trim()) { setFormError("名前を入力してください"); return; }
    if (!editingId && !email.trim()) { setFormError("メールアドレスを入力してください"); return; }
    if (!editingId && !password.trim()) { setFormError("パスワードを入力してください"); return; }
    if (memberType === "sub" && !subcontractorName.trim()) {
      setFormError("下請け会社名を入力してください"); return;
    }

    const role: UserRole = memberType === "sub" ? "WORKER" : staffRole;
    const subName = memberType === "sub" ? subcontractorName.trim() : null;

    setSaving(true);
    setFormError(null);
    try {
      let res: Response;
      if (editingId) {
        res = await fetch(`/api/users/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), role, subcontractorName: subName }),
        });
      } else {
        res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim(),
            password: password.trim(),
            role,
            subcontractorName: subName,
          }),
        });
      }
      if (!res.ok) {
        const d = await res.json();
        setFormError(d.error ?? "保存に失敗しました");
        return;
      }
      setShowForm(false);
      resetForm();
      fetchUsers();
    } catch {
      setFormError("サーバーエラーが発生しました");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, userName: string) {
    if (!confirm(`${userName} を削除しますか？`)) return;
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (res.ok || res.status === 204) {
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } else {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "削除に失敗しました");
    }
  }

  if (loading) return <div className="py-16"><LoadingSpinner label="読み込み中..." /></div>;

  const ownUsers = users.filter((u) => !u.subcontractorName);
  const subUsers = users.filter((u) => u.subcontractorName);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/settings" className="hover:text-blue-600 transition-colors">設定</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">メンバー管理</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">メンバー管理</h1>
          <p className="mt-1 text-sm text-gray-500">自社スタッフと下請け業者を管理します</p>
        </div>
        {isManagerOrAdmin && !showForm && (
          <Button variant="primary" size="md" onClick={openCreate}>
            + メンバーを追加
          </Button>
        )}
      </div>

      {/* フォーム */}
      {showForm && (
        <Card padding="md" shadow="sm">
          <h2 className="text-base font-semibold text-gray-900 mb-5">
            {editingId ? "メンバーを編集" : "新しいメンバーを追加"}
          </h2>
          <div className="space-y-4">

            {/* 種別選択 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">種別</label>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { value: "own", label: "自社スタッフ", desc: "自社の従業員・監督" },
                  { value: "sub", label: "下請け業者", desc: "外部の職人・業者" },
                ] as { value: MemberType; label: string; desc: string }[]).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setMemberType(opt.value)}
                    className={[
                      "p-3 rounded-lg border-2 text-left transition-colors",
                      memberType === opt.value
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300",
                    ].join(" ")}
                  >
                    <p className={["text-sm font-medium", memberType === opt.value ? "text-blue-700" : "text-gray-800"].join(" ")}>
                      {opt.label}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* 下請け会社名（下請け選択時のみ） */}
            {memberType === "sub" && (
              <Input
                label="下請け会社名"
                value={subcontractorName}
                onChange={(e) => setSubcontractorName(e.target.value)}
                placeholder="例：山田塗装"
                required
              />
            )}

            {/* 自社スタッフの役割（ADMINのみ選択可） */}
            {memberType === "own" && isAdmin && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">役割</label>
                <div className="flex gap-2">
                  {([
                    { value: "WORKER", label: "作業員" },
                    { value: "MANAGER", label: "監督" },
                  ] as { value: "WORKER" | "MANAGER"; label: string }[]).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setStaffRole(opt.value)}
                      className={[
                        "px-4 py-2 rounded-full text-sm font-medium border transition-colors",
                        staffRole === opt.value
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50",
                      ].join(" ")}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Input
              label="氏名"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例：田中太郎"
              required
            />

            <Input
              label="メールアドレス"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tanaka@example.com"
              required
              disabled={!!editingId}
            />

            {!editingId && (
              <Input
                label="パスワード"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8文字以上推奨"
                required
              />
            )}

            {formError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {formError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" size="md" onClick={() => { setShowForm(false); resetForm(); }}>
                キャンセル
              </Button>
              <Button type="button" variant="primary" size="md" loading={saving} onClick={handleSave}>
                {editingId ? "保存" : "追加"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* 自社スタッフ一覧 */}
      <section>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          自社スタッフ（{ownUsers.length}名）
        </h2>
        {ownUsers.length === 0 ? (
          <p className="text-sm text-gray-400 px-1">登録されていません</p>
        ) : (
          <div className="space-y-2">
            {ownUsers.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                currentUserId={session?.user?.id ?? ""}
                isManagerOrAdmin={isManagerOrAdmin}
                isAdmin={isAdmin}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </section>

      {/* 下請け業者一覧 */}
      <section>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          下請け業者（{subUsers.length}名）
        </h2>
        {subUsers.length === 0 ? (
          <p className="text-sm text-gray-400 px-1">
            下請け業者が登録されていません
          </p>
        ) : (
          <div className="space-y-2">
            {subUsers.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                currentUserId={session?.user?.id ?? ""}
                isManagerOrAdmin={isManagerOrAdmin}
                isAdmin={isAdmin}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function UserRow({
  user,
  currentUserId,
  isManagerOrAdmin,
  isAdmin,
  onEdit,
  onDelete,
}: {
  user: AppUser;
  currentUserId: string;
  isManagerOrAdmin: boolean;
  isAdmin: boolean;
  onEdit: (u: AppUser) => void;
  onDelete: (id: string, name: string) => void;
}) {
  const isSelf = user.id === currentUserId;
  const canEdit = isManagerOrAdmin && (isAdmin || user.role !== "ADMIN");
  const canDelete = isManagerOrAdmin && !isSelf && (isAdmin || user.role !== "ADMIN");

  return (
    <Card padding="sm" shadow="sm">
      <div className="flex items-center gap-3 px-1 py-0.5">
        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-sm font-semibold text-blue-700 flex-shrink-0">
          {user.name.slice(0, 1)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-gray-900">{user.name}</p>
            {isSelf && <span className="text-xs text-gray-400">（自分）</span>}
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[user.role]}`}>
              {ROLE_LABELS[user.role]}
            </span>
            {user.subcontractorName && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-100">
                {user.subcontractorName}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{user.email}</p>
        </div>
        {(canEdit || canDelete) && (
          <div className="flex items-center gap-3 flex-shrink-0">
            {canEdit && (
              <button onClick={() => onEdit(user)} className="text-xs text-gray-500 hover:text-blue-600 transition-colors">
                編集
              </button>
            )}
            {canDelete && (
              <button onClick={() => onDelete(user.id, user.name)} className="text-xs text-gray-500 hover:text-red-600 transition-colors">
                削除
              </button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
