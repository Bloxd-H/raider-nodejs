# Discord Auto Sender - Node.js

Node.js環境で動作する、高機能・非同期型のDiscord自動送信ツールです。
設定をフォルダごとに分けて管理でき、トークンやチャンネルのローテーション、自動削除、ランダム文字列に対応しています。

## 必要要件
* **[Node.js v18 以上](https://nodejs.org/)**

## 📂 ディレクトリ構成
`main.js` (本ツール) と同じ階層に、任意の名前のフォルダ(例: `data1`)を作成し、その中に4つの設定ファイルを配置してください。

```text
.
├── main.js             <-- ツール本体
└── data1/              <-- 設定フォルダ (名前は自由)
     ├── token.txt      <-- トークンリスト
     ├── channels.txt   <-- チャンネルIDリスト
     ├── message.txt    <-- 送信する文章
     └── settings.json  <-- 動作設定ファイル
```

## ファイルの書き方

各ファイルはUTF-8で保存してください。

### 1. `token.txt`
Discordのアカウントトークンを1行に1つずつ入力してください。
```text
MzUz...
OTVk...
```

### 2. `channels.txt`
送信先のチャンネルIDを1行に1つずつ入力してください。
```text
123456789...
987654321...
```

### 3. `message.txt`
送信したいメッセージを入力してください。

* **ランダム文字列生成**: 
  `{r-数字}` と記述すると、指定した桁数のランダムな英数字に置換されます。  
  例: `こんにちは {r-10}` → `こんにちは aB3x9Gz1pL`
* **複数行モード**: 
  `settings.json` で `SPLIT_NEWLINE` を `true` に設定すると、改行ごとに別のメッセージとして読み込まれ、ランダムに選択されて送信されます。

### 4. `settings.json`
動作の詳細設定を行います。

```json
{
  "INTERVAL": "1000-2000",
  "AFTER_DELETE": true,
  "AFTER_DELETE_TIME": "1500",
  "SPLIT_NEWLINE": true,
  "SEND_COUNT": 0
}
```

| キー | 説明 | 値の例 |
| --- | --- | --- |
| `INTERVAL` | 送信間隔 (ms)<br>範囲指定も可能 | `1000`<br>`"1000-2000"` |
| `AFTER_DELETE` | 送信後に自動削除するか | `true` / `false` |
| `AFTER_DELETE_TIME` | 削除を実行するまでの遅延 (ms) | `"1500-3000"` |
| `SPLIT_NEWLINE` | `message.txt` を改行で区切るか | `true` / `false` |
| `SEND_COUNT` | 総送信回数 (`0` で無限ループ) | `0`<br>`100` |

---

## 起動方法

1. コマンドプロンプト (またはターミナル) を開き、`main.js` があるディレクトリに移動します。
2. 以下のコマンドを実行します。
   ```bash
   node main.js
   ```
3. `folder name >` と表示されたら、作成した設定フォルダ名（例: `data1`）を入力します。
4. 設定の読み込みが完了し `Ready? >` と表示されたら、`y` を入力して開始します。

## ログの見方

コンソールには以下のカラーログが表示されます。

* <span style="color:cyan">**[INFO]**</span> : ツールの状態、読み込み完了通知など
* <span style="color:green">**[SUCCESS]**</span> : 送信成功 (ユーザー名 -> チャンネル名)
* <span style="color:yellow">**[RATE]**</span> : レート制限検知 (指定時間待機した後、自動で再開します)
* <span style="color:red">**[ERROR]**</span> : エラー発生 (トークン無効、ネットワークエラー、権限不足など)

---

## ⚠️ 免責事項
本ツールを使用したことによるアカウントの凍結・BAN等のトラブルについて、開発者は一切の責任を負いません。自己責任でご利用ください。
