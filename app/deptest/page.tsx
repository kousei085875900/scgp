'use client'

import React, { useState } from 'react'

export default function DepTest() {
  const [repoUrl, setRepoUrl] = useState('')
  const [showDetails, setShowDetails] = useState(false)

  const handleDeploy = () => {
    // TODO: ここに実際のインメモリ・デプロイ処理（ダウンロード、パス置換、iframeマウント）を記述します。
    console.log('Deploying from:', repoUrl)
  }

  return (
    <div className="max-w-xl mx-auto py-12 px-6 font-sans">
      {/* ヘッダー */}
      <h2 className="text-2xl sm:text-[26px] font-bold text-gray-950 mb-1 leading-tight">
        インメモリ・デプロイメント・ランタイム v7.0
      </h2>
      <p className="text-gray-500 text-xs sm:text-sm mb-6 leading-relaxed">
        GitHub上のビルド済み成果物を同一ページにマウントし、ルート相対パスを自動置換してシームレスに実行します。
      </p>

      {/* 入力エリア */}
      <div className="mb-5">
        <label className="block text-sm font-bold text-gray-900 mb-2">
          GitHub リポジトリ URL
        </label>
        <input
          type="text"
          placeholder="https://github.com/userneme/repositoryneme"
          className="w-full p-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
        />
      </div>

      {/* 詳細設定アコーディオン */}
      <div className="mb-6">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-blue-600 hover:text-blue-800 text-sm font-bold focus:outline-none transition-colors"
        >
          {showDetails ? '▼' : '▶'} ターゲットアセット設定（ブランチ・パス・環境変数）を表示
        </button>

        {showDetails && (
          <div className="mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-4 text-sm animate-fadeIn">
            {/* 拡張用の設定フォーム（必要に応じてここにプロパティを追加） */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">ブランチ名</label>
              <input type="text" placeholder="main" className="w-full p-2 border border-gray-200 rounded bg-white text-xs" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">成果物パス</label>
              <input type="text" placeholder="dist" className="w-full p-2 border border-gray-200 rounded bg-white text-xs" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">環境変数 (.env 形式)</label>
              <textarea placeholder="KEY=VALUE" rows={3} className="w-full p-2 border border-gray-200 rounded bg-white text-xs font-mono" />
            </div>
          </div>
        )}
      </div>

      {/* デプロイ実行ボタン */}
      <button
        onClick={handleDeploy}
        className="w-full py-4 bg-gray-950 hover:bg-gray-900 text-white font-bold rounded-lg text-sm sm:text-base tracking-wide transition-all duration-150 active:scale-[0.98]"
      >
        同一ページ内でデプロイ・実行
      </button>

      {/* システム解説セクション */}
      <div className="mt-12 pt-8 border-t border-gray-200 space-y-6 text-gray-600 text-sm leading-relaxed">
        <h3 className="text-lg font-bold text-gray-950">
          💡 このシステム（アーキテクチャ）について
        </h3>
        <p>
          本ツールは、GitHub上にホストされているWebアプリケーションの<strong>「ビルド済み静的成果物（HTML/JS/CSS）」</strong>を動的に走査・取得し、独自のサンドボックス領域（インメモリ）へマウントしてプレビューを実行する軽量開発環境です。
        </p>
        <p>
          外部のホスティングサービスへの再デプロイやDNSの発行を行うことなく、現在のブラウザセッション内だけで完全に独立した実行ランタイムを展開できます。
        </p>

        {/* コアテクノロジーカード */}
        <div className="bg-gray-50 p-5 rounded-lg border border-gray-150 space-y-4">
          <h4 className="font-bold text-xs tracking-wider uppercase text-blue-600">
            主な機能とコアテクノロジー
          </h4>
          <ul className="list-disc pl-5 space-y-3 text-xs sm:text-sm text-gray-500">
            <li>
              <strong className="text-gray-800">ダイナミック・アセット・ルーティング：</strong>
              ViteやNext.js（SSGエクスポート）等のビルド時に生成されるルート相対パス（先頭スラッシュ付きの資産パス）を正規表現コンパイラでリアルタイムに解析し、jsdelivr CDNの絶対パスへ強制置換。画面のレンダリング崩れや404エラーを完全に防ぎます。
            </li>
            <li>
              <strong className="text-gray-800">インメモリ環境変数インジェクション：</strong>
              指定された環境変数（`.env` データ）を解析し、あらゆるサードパーティ製スクリプトよりも先に実行される即時関数（IIFE）として、仮想HTMLの最上部へ最優先でインジェクションします。これにより、クライアントサイドでの <code className="bg-gray-200 px-1 py-0.5 rounded text-xs font-mono">window.process.env</code> の参照エラーを完全に隔離・シールドします。
            </li>
            <li>
              <strong className="text-gray-800">セキュア・サンドボックス構造：</strong>
              キャプチャした成果物はBlob URLに変換された上で、完全に隔離された <code className="bg-gray-200 px-1 py-0.5 rounded text-xs font-mono">iframe</code> 領域へマウントされます。親ドメイン（当ポータル）のセッションやローカルストレージを汚染しない、安全なデバッグが可能です。
            </li>
          </ul>
        </div>

        {/* 注意事項 */}
        <div className="text-xs text-gray-400 space-y-1">
          <p>※本システムは静的ビルド成果物（GitHub PagesやVercelの成果物フォルダなど）をターゲットに設計されています。</p>
          <p>※ブラウザ内に完全なLinux環境（Node.jsカーネル）を展開して生ソース（.tsx / .ts）からリアルタイムにコンパイルを行う場合は、別途WebContainers API等の拡張が必要となります。</p>
        </div>
      </div>
    </div>
  )
}
