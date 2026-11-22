# CAST // SIGNAL — WORLD V5 SELECT × V4 DETAIL

**2026-11-22 / デザイン実装レビュー用。main統合前。**

## デザイン上の決定
- 「テンションはゼンゼロ、整理の上手さはエンドフィールド」。ペルソナの白黒と赤の強いグラフィックコントラストも一部取り入れる。
- WORLD SELECT：3つのWORLDをフルHD/2Kの最初の画面で見比べるための3列カード。黒いカートリッジ状のビジュアル面＋白い情報面。WORLD固有の絵を主役にして、操作・強調だけを黄色に統一。
- 世界の画像がある場合は元画像を変形しない `object-fit:contain` と背景ぼかしで自然に表示。画像がない場合でもRESEARCH/UNASSIGNEDのグラフィックを表示。追加WORLDも破綻しない。
- WORLD DETAIL：すでに選択したWORLD名を必要以上に巨大に繰り返さず、中央に小さなWORLD DOSSIERの識別ヘッダー。白いWORLD INTELLIGENCEパネルが本文の読み物エリア。
- 長いWORLD説明でも説明欄だけが下に広がる。最初から長大なビジュアルを表示してSTORY FILESを隠すことはしない。
- STORY FILES：MAINは一つの横長の白い目立つカード（赤いFILE番号・黄色のzetaボタン）。SIDEは小さな白グレーのカード。作品タイトル→登場キャラ→行き先の順序で整理。
- CONNECTED CAST：各プロフィールへリンク。zeta等の作品は従来どおり新しいタブで開く。
- スマホは縦方向のカード選択、一画面に詰め込みすぎない。

## ユーザーの元の作品情報を変更しない
- 公開WORLDの `title`, `subtitle`, `category`, `summary`, `image`, `stories`、所属キャラと保存済みクロップはそのまま利用。
- WORLD名は「舞台や作品群をまとめる名前」。単独作品では作品名をWORLD名にしてもよい。
- EDIT MODEの「詳細説明」独立欄は今回はまだ追加しない。ユーザーによるプレビュー判断後に任意入力欄を検討する。
- 登場キャラは明示的な `workRecords` からマッチング。WORLDが同じというだけではその作品の登場キャラにしない。
- WORLDのMAINリンクとSTORYのリンクが同じ作品のときは、異なるshare_idでも重複表示しない。
- 非公開データ、生成したダミーキャラはリポジトリに入れない。

## 実装責任範囲
- `cast-worlds-current.css`：WORLD画面の単一の現行UIルール。過去のStudy 07〜V15のように末尾へ版を積むやり方は避ける。
- `app.js`：WORLDカード、WORLD DETAILの既存DOMマークアップを更新。イベントデリゲーション、検索・別ページ・公開データは変更しない。
- `index.html`, `admin.html`：同じCSS/JSバージョンを読み込む。
- `tests/world-v5-v4-implementation.mjs`：1920×911、2560×1271、390×844、WORLD/DETAIL/作品/登場キャラを実サイトの公開情報で検証。

## リリース方針
**プレビューとユーザーの確認前に main へ統合しない。** 
