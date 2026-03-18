# 割るくん

PAYPAY銀行のミニロトCSVを自動取得し、直近2回の当選番号から候補数字を出すローカルWebツールです。

## 起動方法

1. `start.bat` をダブルクリック
2. ブラウザで `http://127.0.0.1:3000` が開く
3. 自動で最新CSVを取得して計算

## Netlify公開

このツールは Netlify Functions 前提で公開できます。

1. GitHub にこのフォルダを push
2. Netlify で対象リポジトリを接続
3. Build command は空欄
4. Publish directory は `.` のまま
5. 環境変数 `WARUKUN_PASSWORD` を設定
6. 必要なら `WARUKUN_COOKIE_SECRET` も設定

`/api/*` は [netlify.toml](C:/ミニロト　/netlify.toml) で Functions にリダイレクトされます。

## ローカル起動

ローカルでは引き続き `server.js` で確認できます。

## 取得元

- `https://www.japannetbank.co.jp/lottery/co/minilotojnb.csv`

## 仕様

- 対象は `第1数字` から `ボーナス数字` までの6ポジション
- 合計を2で割った値の小数点以下は切り捨て
- 中心数字の前後1つも候補に追加
- 候補群から重み付けで `自動5数字案` も表示

## ファイル

- `netlify/functions`: Netlify Functions
- `netlify.toml`: Netlify設定
- `server.js`: ローカルサーバーとPAYPAY銀行CSVの自動取得
- `index.html`: 画面
- `styles.css`: デザイン
- `script.js`: CSV解析と割るくんロジック
- `start.bat`: 起動用
