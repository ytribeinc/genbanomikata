// Prisma で定義された enum の手動型エクスポート
// `prisma generate` 実行前でも型チェックが通るようにするための補助ファイル
// 実際のランタイム値は @prisma/client から取得すること

export type UserRole = "ADMIN" | "MANAGER" | "WORKER";
