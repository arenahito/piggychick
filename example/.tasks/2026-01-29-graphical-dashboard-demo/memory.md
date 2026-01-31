## F1: Scaffold Vite + React + TypeScript with Tooling

- Vite config は ESM 前提なので __dirname ではなく fileURLToPath(new URL("./src", import.meta.url)) を使うと安定する
- tsconfig の project references に composite: true を足しても noEmit と共存できる
- ESLint を外すなら README も合わせて最小化して混乱を避ける
## F2: Tailwind CSS and Global Theme Foundation

- Tailwind v4 は @tailwindcss/vite を Vite plugin として追加し、CSS で @import "tailwindcss" を使う
- ダーク固定にするなら html.dark と :root の両方にトークンを置くとぶれない
- Tailwind は devDependencies なのでビルド環境で dev 依存も入れる前提になる
## F3: shadcn/ui Initialization and Base Components

- shadcn init は src/index.css を上書きするので、カスタムトークンとタイポグラフィは再適用が必要
- v4 では @custom-variant dark と @theme inline が追加されるため、消さずに値だけ差し替えると安全
- tailwindcss-animate を使うなら CSS で @plugin を残し、余計な @import は削るほうが安定する
## F4: Demo Data Model and Mock Data

- series は日付昇順に並べて selectSeries で末尾スライスする前提
- 日付は固定起点にするとデモの再現性が上がるが、最新感は弱くなる
- KPI と alert は値の単位と意味が UI で整合するように揃えておく
## F5: Layout Shell and Navigation Components

- サイドレールを隠すならモバイル用の代替ナビを用意して到達性を担保する
- ナビゲーションは button ではなく nav/ul/li/a と aria-current を使うほうが適切
- Tabs の値は受け取る前に許可リストでガードすると型と挙動が安定する
## F6: Dashboard Sections and Visual Components

- Recharts の Tooltip 型はバージョン差で合わないため、最小プロップ型を自前定義すると TS が安定する
- グラフは role=img と aria-label を付けてスクリーンリーダーに説明を与える
- Badge に aria-label を付けると中身が読まれないので sr-only で補完するほうが安全
## F7: Interaction Polish, Motion, and Responsive Refinements

- motion-safe を使えば reduced-motion を尊重したアニメーションにできる
- hover だけに頼らず focus-within で入力の可視性を確保する
- カードの浮き上がりは translate と shadow を併用すると立体感が出る
## D1: Project README

- README に Volta の固定バージョンを明記するとセットアップが安定する
- ドキュメント言語は指示に従って統一する
