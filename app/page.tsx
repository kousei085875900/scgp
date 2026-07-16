import React from 'react'

export default function Home() {
  return (
    <div className="space-y-12 w-full">
      <div className="space-y-6">
        {/* 小見出し */}
        <div className="text-xs font-bold tracking-widest text-blue-600 uppercase">
          Expancoov Project Portal
        </div>
        
        {/* メインタイトル */}
        <h1 className="text-4xl sm:text-6xl font-black text-gray-950 tracking-tight leading-tight">
          SCGP<br />
        </h1>

        {/* 組織概要セクション */}
        <div className="text-gray-500 text-sm sm:text-base max-w-xl leading-relaxed font-medium whitespace-pre-wrap">
          {`── 組織概要と開発方針について
本ポータルサイトは、高度なWeb自動化技術およびソフトウェア拡張モジュールの開発を行う有志の技術開発グループ「SCGP (Shadow Company Gunpack)」の公式ポートフォリオ兼ツール配信プラットフォームです。

当グループでは、Node.jsやPuppeteer環境をベースとしたWebスクレイピング、自動化スクリプト、API連携ツールの設計・開発をはじめ、特定の基盤ソフトウェアに対して高度な機能拡張を行うプラグインおよび追加アドオン（各種アドオンモジュール）の研究開発を行っています。

単なるツールの公開にとどまらず、コードの最適化、動作の軽量化、およびコミュニティ内でのスムーズな技術共有を目的として本ポータルを運用しています。`}
        </div>

        <hr className="border-gray-200 my-6" />

        {/* 重要なお知らせセクション */}
        <div className="text-gray-500 text-sm sm:text-base max-w-xl leading-relaxed font-medium whitespace-pre-wrap">
          {`【重要なお知らせ】開発アセットの定義と分類について
現在、当グループが開発・配備している拡張モジュール「ガンパック（Gun-Pack：銃機シミュレーション/動作スクリプト内包型アドオン）」の仕様について、一部のユーザー間で「単なる外見を変更するだけのスキンパック（テクスチャ変更アセット）」との混同が見受けられます。トラブル防止のため、以下の通り定義を明確化いたします。

・スキンパック（Skin-Pack）：
既存オブジェクトの表面的なビジュアル（テクスチャ）のみを変更する、デザイン主体のデータです。

・ガンパック（Gun-Pack / scaddon互換）：
コアシステムとなる「scaddon」の基盤に対して、独自の動作ロジック、射撃レート制御スクリプト、新規エンティティ（実体データ）を動的に追加・実装する独立した拡張プラグイン（機能拡張モジュール）です。

当グループが提供するアセットは、外見の変更に留まらず、システム内部の挙動やパラメーターをプログラム側から制御する「技術的な追加モジュール」を指します。導入の際は、前提となるコアシステム（scaddon）のバージョンと環境を正しく構築した上で、各種ツールをご活用ください。

開発コードや最新のツールセットに関するディスカッション、バグ報告等は、上部のオフィシャル・コミュニケーションチャンネル（Discord）にて受け付けております。`}
        </div>
      </div>
    </div>
  )
}
