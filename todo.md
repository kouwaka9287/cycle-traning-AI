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
