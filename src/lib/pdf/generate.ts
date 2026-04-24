import { renderToBuffer } from "@react-pdf/renderer";
import type React from "react";

/**
 * React要素からPDFバッファを生成する
 * @react-pdf/renderer の renderToBuffer はサーバーサイド専用
 */
export async function generatePDF(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  element: React.ReactElement<any>
): Promise<Buffer> {
  // renderToBuffer の型引数は DocumentProps だが、実際には Document コンポーネントを
  // 渡せばよいため any でキャスト
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(element as React.ReactElement<any>);
  return Buffer.from(buffer);
}
