# CAST // SIGNAL — CSSの責任範囲と改修ルール

更新：2026-11-21。対象は公開サイトで採用中のV15.6。**V16デザインはまだ本番未導入**。

## 読み込み順（変更しない）

1. `style.css` — サイト全体の基本UI
2. `mobile.css` — スマホ共通
3. `cast-side-rail.css` — SELECTの舞台構成、遠近カードの土台、Study13までの必要な継承指定
4. `cast-view-adjustments.css` — WORLD / ABOUT / WORLD DETAIL / PROFILE / STORY FILESの画面別補正
5. `cast-rail-current.css` — SELECTの現行仕上げ専用（画像クロップ、V15.4の矢印、V15.6のカードUI）

この順序は既存のカスケードをそのまま維持するためのもの。分離時点では**3ファイルを順に連結した内容が、旧`cast-side-rail.css`と1文字も変わらない**。

## 今後の修正先

- カード枠、名前ラベル、画像クロップ、zeta/NEW、ALL CAST、矢印：まず`cast-rail-current.css`と継承元`cast-side-rail.css`を調べ、**該当する採用ルールを直接更新**する。
- WORLD / ABOUT / 世界詳細 / PROFILE：`cast-view-adjustments.css`の既存定義を更新。
- スマホ：`mobile.css`、`style.css`と上記のmobile条件を調査し、表示の実測を行う。

## 保守ルール（厳守）

1. **「修正用CSSを末尾に付け足す」を繰り返さない**。上書きが必要な場合、元のルールと責任範囲を明示して統合・撤去する。
2. 同一の部品に異なるバージョンの定義が残ったら、その変更が必要になった理由を確認して整理する。単純に古い章を丸ごと削除するのは禁止（共有部品を壊すため）。
3. BEFORE/AFTERの比較用UI、仮のzeta/NEWデータ、不要になったインジケーターは本番コードに持ち込まない。
4. 既存のJSとHTMLは、表示だけの修正で勝手に変えない。
5. 画面の実測結果（CSS computed values、レイアウト、実画像）とGitHub Actionsの検証結果を確認してからmainへマージ。
6. 意図的に外観を変えるV16改修は、この整理PRとは別に実施し、新しい基準画像を検証する。今回の「見た目一致テスト」はV16の意図的なデザイン変更にはそのまま流用しない。
7. CSSファイルの変更時は、`index.html`のアセットバージョンを適切に更新する。ブラウザキャッシュのせいで旧CSSが残る問題を防ぐ。

## 検証

- `tests/rail-css-modules-integrity.mjs` — モジュール連結結果、ファイル存在とCSS読み込み順を検査
- `tests/rail-css-parity.mjs` — 8画面幅×4状態のテスト画面でスクリーンショットとComputed Styleを比較
- `tests/rail-live-visual-parity.mjs` — 公開中SELECTを読み取り専用で開き、実画像込みの4画面幅×3状態を比較

### 注意

モジュール分割は**構造整理**であり、Study 07〜13のうち現在も継承されるルールまで除去できたことを意味しない。以後は機能別の実装を維持し、必要に応じて古い継承の調査・統合を別の検証可能な差分として実施する。
