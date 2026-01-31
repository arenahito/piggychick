# Learning

この作業で強く残った学びは、基盤設定・テーマ設計・UI実装・文書化が一本の線でつながっているという実感だ。Vite は ESM 前提のためパス解決に fileURLToPath(new URL(..., import.meta.url)) を使うほうが安定し、設定の揺れが減る。Tailwind v4 は Vite プラグインと CSS の @import "tailwindcss" を前提にした構成が要となり、土台が整えばテーマの一貫性を担保できる。shadcn/ui の初期化は CSS を上書きするため、トークンとタイポグラフィの再適用が不可欠だという理解に至った。

データ設計では、系列データの並び順や KPI の単位整合が UI の説得力に直結することを改めて認識した。固定日付の採用は再現性の強化につながるが、最新感の表現とトレードオフになる。レイアウトとナビゲーションでは、セマンティクスと到達性の両立が軸となる。nav/ul/li/a と aria-current を使い、モバイルでサイドレールを隠す場合は代替導線を用意する判断が欠かせない。可視性と動きの面では motion-safe による reduced-motion 対応や focus-within の活用が堅実な改善になる。チャートの型差異は最小プロップ型の自前定義で吸収し、role=img と aria-label を付与してアクセシビリティを担保する。Badge は読み上げの癖を踏まえて sr-only で補足する設計が有効だ。

下記は学びの流れと依存関係を可視化したものだ。

```mermaid
flowchart TD
  A[Scaffold: Vite + React + TS] --> B[Tailwind v4 基盤]
  B --> C[shadcn/ui 初期化]
  C --> D[テーマ再適用]
  D --> E[データ設計]
  E --> F[レイアウト/ナビ]
  F --> G[ダッシュボード可視化]
  G --> H[動き/アクセシビリティ調整]
  H --> I[README/文書化]
```

CSS の上書きと再適用の関係は、初期化の副作用を前提に回復手順を組み込む思考へつながる。

```mermaid
sequenceDiagram
  participant Dev as 開発者
  participant Init as shadcn init
  participant CSS as src/index.css
  Dev->>Init: 初期化を実行
  Init-->>CSS: CSS を上書き
  Dev->>CSS: トークン/タイポを再適用
  Dev->>CSS: @custom-variant と @theme inline を維持
  Dev-->>Dev: 見た目と型の安定を確認
```

設計上の力点は「再現性」「到達性」「可視性」「説明可能性」のバランスに集約される。

```mermaid
mindmap
  root((学びの重心))
    再現性
      日付固定
      依存設定の安定化
    到達性
      セマンティックナビ
      モバイル代替導線
    可視性
      focus-within
      motion-safe
    説明可能性
      role=img
      aria-label
      sr-only 補足
```

結果として、基盤の安定性が UI の一貫性を支え、UI の一貫性がデータの説得力を引き上げるという循環が明確になった。ドキュメントは指示に従って言語を統一し、実装の意図を同じ温度で残すことが重要だと結論づけた。
