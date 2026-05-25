# CycleCoach - Project TODO

## デザインシステム
- [x] レトロフューチャー・ディストピア美学のCSS設定（黒背景、スキャンライン、クロマティックアベレーション）
- [x] Google Fonts追加（Space Grotesk + JetBrains Mono）
- [x] 共通UIスタイル（ブラケット装飾、エラーコード、ノイズテクスチャ）

## データベーススキーマ
- [x] `userProfiles`相当のフィールド拡張（realName, displayName, height, weight, ftp, status, approvedAt）
- [x] `rides`テーブル（FIT/CSV解析後のサマリ：duration, distance, avgPower, normalizedPower, tss, if, fileKey）
- [x] `rideSamples`テーブル（時系列パワーデータ）
- [x] `trainingPlans`テーブル（AI推奨プラン保存）
- [x] `notificationSchedules`テーブル（メール通知スケジュール）
- [x] スキーマ生成・マイグレーション適用

## バックエンドAPI（tRPC）
- [x] `auth.register` - 本名・表示名登録（pending状態）
- [x] `auth.me` - 承認状態を含むユーザー情報取得
- [x] `profile.updateMetrics` - 身長・体重・FTPの更新
- [x] `admin.listAll` - 全ユーザー一覧
- [x] `admin.approve` / `admin.reject`
- [x] `rides.upload` - FIT/CSVファイルアップロード（S3保存）
- [x] `rides.list` - ライド一覧取得（期間フィルタ）
- [x] `rides.detail` - 1ライド詳細
- [x] `rides.delete` / `rides.signedUrl`
- [x] `analytics.summary` - 週/月/年の統計
- [x] `ai.recommend` - LLMベースのトレーニング推奨
- [x] `ai.history` - 過去のAIプラン
- [x] `schedules.create/list/toggle/delete` - 通知スケジュール

## ライド解析ロジック
- [x] CSVパーサー（time, timestamp, power, hr, cadence, speed, distance, altitude列対応）
- [x] FITファイル簡易パーサー
- [x] NP（Normalized Power）計算
- [x] IF（Intensity Factor）計算
- [x] TSS計算
- [x] SST時間計算（FTP 88-94%帯域）
- [x] パワーゾーン分布計算（Z1-Z7）
- [x] トレーニングスコア算出
- [x] CTL/ATL/TSB（疲労度）計算

## フロントエンド画面
- [x] レイアウトとサイドバー（ディストピア風）
- [x] ランディング/ログイン画面
- [x] 登録画面（本名・表示名入力）
- [x] 承認待ち画面 / 拒否画面
- [x] ダッシュボード（最近のライド・TSS・スコア・フォーム指標）
- [x] プロフィール設定（身長・体重・FTP・パワーゾーン表示）
- [x] ライドアップロード画面（ドラッグ&ドロップ）
- [x] ライド一覧画面
- [x] ライド詳細画面（パワーゾーン分布・指標）
- [x] カレンダービュー（月間ヒートマップ・各日にライド表示）
- [x] 統計画面（週/月/年フィルタ・TSSバー）
- [x] AIコーチ画面（推奨表示）
- [x] 管理者画面（承認管理）
- [x] 通知スケジュール設定画面

## 通知機能
- [x] notifyOwner経由のスケジュール通知
- [x] manus-heartbeatによる定期実行登録
- [x] スケジュール作成・トグル・削除エンドポイント

## テスト・チェックポイント
- [x] vitestテスト（解析ロジック、認証フロー、承認フロー）- 15 tests passing
- [x] チェックポイント保存
- [x] ユーザーへの引き渡し

## バグ修正
- [x] ログインができないバグの調査・修正（trust proxy、Secure強制、stateから元origin復元）
- [x] OAuthアカウント選択後にアプリ画面に遷移できないバグ調査・修正（Manusプレビュー内のサードパーティCookie制限が原因のため、ホスト直接ログインを回避策として提供）
- [x] Manusプレビュー内で動作するホスト直接ログインを実装（`auth.hostLogin` + `HOST_LOGIN_PASSPHRASE`）
- [x] ホストログイン用セッション発行ヘルパー＆AppLayoutのログイン画面切替UIを追加
- [x] ホストログイン回帰テスト追加（計22テスト PASS）

## FITファイル最適化
- [x] `fit-file-parser` を導入し本格的なFITバイナリ解析を実装
- [x] パワー/HR/ケイデンス/スピード/距離/標高/緯度経度/温度などのrecordフィールドを完全抽出
- [x] FITのsession/sport/device_infoメッセージからデバイス名・走行時間・公式距離・総上りを取得
- [x] アップロードされたFITバイトをそのままS3に保存し、再解析可能
- [x] フロントのアップロード画面を .FIT 優先のUI/メッセージに更新
- [x] FITヘッダ検出・合成FITの往復テスト・異常系テストを追加（計25テスト PASS）
- [x] チェックポイント保存・ユーザーへ引き渡し

## 多言語(i18n)対応
- [x] LanguageContext + 6言語辞書（日本語/英語/簡体中文/韓国語/フランス語/スペイン語）作成
- [x] localStorage永続化、デフォルトは日本語
- [x] 全主要ページを2個以上のt()関数で置換（サイドバー・ダッシュ/登録/承認待ち/拒否/プロフィール/アップロード/ライド一覧/ライド詳細/カレンダー/統計/AIコーチ/スケジュール/管理者）
- [x] サイドバー上部 + 未認証画面両方に言語スイッチャー(Selectドロップダウン)を設置
- [x] 認証画面・登録画面・承認待ち画面にも言語スイッチャー設置
- [x] 翻訳キー回帰テスト追加（6言語とも主要キーを検証、重複キーゼロを保証） - 計29テスト PASS
- [x] チェックポイント保存・引き渡し
