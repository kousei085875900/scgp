'use client';

import React, { useState } from 'react';

type TokenType = 'bot' | 'user';

interface Guild {
  id: string;
  name: string;
}

interface Channel {
  id: string;
  name: string;
  type: number;
}

interface ExecutionDetail {
  tokenPrefix: string;
  success: number;
  failed: number;
  lastError?: string;
}

export default function Home() {
  const [tokensInput, setTokensInput] = useState<string>('');
  const [tokenType, setTokenType] = useState<TokenType>('bot');
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [selectedGuild, setSelectedGuild] = useState<string>('');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [count, setCount] = useState<number>(1);

  const [isLoadingGuilds, setIsLoadingGuilds] = useState<boolean>(false);
  const [isLoadingChannels, setIsLoadingChannels] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);

  const [statusMessage, setStatusMessage] = useState<string>('');
  const [executionDetails, setExecutionDetails] = useState<ExecutionDetail[]>([]);

  // 入力文字列から改行・カンマ区切りでトークン配列を抽出
  const getTokens = (): string[] => {
    return tokensInput
      .split(/[\n,]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  };

  // 1. サーバー一覧の取得（複数トークン時は共通サーバーを抽出）
  const handleLoadGuilds = async () => {
    const tokens = getTokens();
    if (tokens.length === 0) {
      setStatusMessage('Error: トークンを入力してください。');
      return;
    }

    setIsLoadingGuilds(true);
    setStatusMessage(
      tokens.length > 1
        ? `${tokens.length}個のトークンで共通のサーバーを検索中...`
        : 'サーバー一覧を取得中...'
    );
    setGuilds([]);
    setChannels([]);
    setSelectedGuild('');
    setSelectedChannel('');
    setExecutionDetails([]);

    try {
      const res = await fetch('/api/send?action=getGuilds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens, tokenType }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'サーバー一覧の取得に失敗しました');
      }

      if (Array.isArray(data)) {
        setGuilds(data);
        setStatusMessage(
          tokens.length > 1
            ? `全トークン共通のサーバーを ${data.length} 件取得しました`
            : `サーバーを ${data.length} 件取得しました`
        );
      }
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoadingGuilds(false);
    }
  };

  // 2. サーバー選択時のチャンネル一覧取得
  const handleGuildChange = async (guildId: string) => {
    setSelectedGuild(guildId);
    setSelectedChannel('');
    setChannels([]);

    if (!guildId) return;

    const tokens = getTokens();
    setIsLoadingChannels(true);
    setStatusMessage('チャンネル一覧を取得中...');

    try {
      const res = await fetch('/api/send?action=getChannels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens, tokenType, guildId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'チャンネル一覧の取得に失敗しました');
      }

      // テキストチャンネル (type 0) とアナウンスチャンネル (type 5) のみに絞り込み
      const textChannels = Array.isArray(data)
        ? data.filter((c: Channel) => c.type === 0 || c.type === 5)
        : [];

      setChannels(textChannels);
      setStatusMessage(`テキストチャンネルを ${textChannels.length} 件取得しました`);
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoadingChannels(false);
    }
  };

  // 3. メッセージ送信処理
  const handleSendMessage = async () => {
    const tokens = getTokens();
    if (tokens.length === 0) {
      setStatusMessage('Error: トークンを入力してください。');
      return;
    }
    if (!selectedChannel) {
      setStatusMessage('Error: 送信先のチャンネルを選択してください。');
      return;
    }
    if (!message.trim()) {
      setStatusMessage('Error: メッセージ内容を入力してください。');
      return;
    }

    setIsSending(true);
    setStatusMessage('メッセージを送信中...');
    setExecutionDetails([]);

    try {
      const res = await fetch('/api/send?action=sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokens,
          tokenType,
          channelId: selectedChannel,
          content: message,
          count,
        }),
      });

      const data = await res.json();

      if (data.details) {
        setExecutionDetails(data.details);
      }

      if (!res.ok) {
        throw new Error(data.error || 'メッセージ送信に失敗しました');
      }

      setStatusMessage(`送信完了: ${data.summary}`);
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const tokensCount = getTokens().length;

  return (
    <div className="space-y-8 w-full max-w-3xl mx-auto p-4 sm:p-6 font-sans">
      {/* ヘッダーセクション */}
      <div className="space-y-2">
        <div className="text-xs font-bold tracking-widest text-red-600 uppercase">
          Studio Cyvas Group Project Portal
        </div>
        <h1 className="text-4xl sm:text-6xl font-black text-red-600 tracking-tight leading-tight">
          SCGP<br />
        </h1>
      </div>

      <hr className="border-red-600/30 my-6" />

      {/* ツール機能セクション */}
      <div className="space-y-6">
        <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
          Discord token manager
        </h2>

        {/* 注意事項 */}
        <div className="space-y-2 p-4 border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900/50 rounded">
          <p className="text-base font-bold text-red-600 dark:text-red-400">
            【注意】User Tokenモードでユーザートークンでメッセージを送信する場合アカウントが停止される可能性があります
          </p>

          <p className="text-sm font-semibold text-red-500">
            絶対にメインアカウントで試さないでください
          </p>

          <div>
            <a
              href="https://mail.scgp.jp/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline inline-block font-medium"
            >
              簡易メールアドレスはこちらから作成できます
            </a>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400 pt-1 border-t border-red-200/50 dark:border-red-900/30">
            ※当ツールを使用したことによりアカウントが停止された場合一切の責任を負いかねます
          </div>
        </div>

        <div className="space-y-6 max-w-xl">
          {/* トークン種別選択 */}
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wider">
              トークン種別
            </label>
            <div className="flex gap-6">
              <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium">
                <input
                  type="radio"
                  name="tokenType"
                  value="bot"
                  checked={tokenType === 'bot'}
                  onChange={() => setTokenType('bot')}
                  className="accent-red-600"
                />
                Bot Token
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium">
                <input
                  type="radio"
                  name="tokenType"
                  value="user"
                  checked={tokenType === 'user'}
                  onChange={() => setTokenType('user')}
                  className="accent-red-600"
                />
                User Token
              </label>
            </div>
          </div>

          {/* トークン入力エリア */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Discord トークン（複数入力可：改行またはカンマ区切り）
              </label>
              <span className="text-xs font-mono text-red-600 font-bold">
                検知されたトークン数: {tokensCount}件
              </span>
            </div>
            <textarea
              className="w-full h-28 p-3 border rounded border-gray-300 dark:border-gray-800 dark:bg-gray-950 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-red-600"
              placeholder="トークンを改行で区切って入力..."
              value={tokensInput}
              onChange={(e) => setTokensInput(e.target.value)}
            />
            <button
              onClick={handleLoadGuilds}
              disabled={isLoadingGuilds || tokensCount === 0}
              className="mt-2 w-full py-2.5 bg-red-600 text-white font-bold text-sm rounded hover:bg-red-700 active:bg-red-800 disabled:bg-gray-300 dark:disabled:bg-gray-800 transition-colors"
            >
              {isLoadingGuilds ? '取得中...' : '1. サーバー一覧を取得'}
            </button>
          </div>

          {/* サーバー選択 */}
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">
              サーバー選択 {tokensCount > 1 && '(全トークン共通のみ表示)'}
            </label>
            <select
              value={selectedGuild}
              onChange={(e) => handleGuildChange(e.target.value)}
              disabled={guilds.length === 0 || isLoadingChannels}
              className="w-full p-2.5 border rounded border-gray-300 dark:border-gray-800 dark:bg-gray-950 text-sm focus:outline-none focus:ring-1 focus:ring-red-600 disabled:opacity-50"
            >
              <option value="">-- サーバーを選択 --</option>
              {guilds.map((guild) => (
                <option key={guild.id} value={guild.id}>
                  {guild.name}
                </option>
              ))}
            </select>
          </div>

          {/* チャンネル選択 */}
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">
              チャンネル選択
            </label>
            <select
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
              disabled={channels.length === 0}
              className="w-full p-2.5 border rounded border-gray-300 dark:border-gray-800 dark:bg-gray-950 text-sm focus:outline-none focus:ring-1 focus:ring-red-600 disabled:opacity-50"
            >
              <option value="">-- チャンネルを選択 --</option>
              {channels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  #{channel.name}
                </option>
              ))}
            </select>
          </div>

          {/* メッセージ入力 & 送信回数 */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">
                送信メッセージ
              </label>
              <textarea
                rows={3}
                className="w-full p-3 border rounded border-gray-300 dark:border-gray-800 dark:bg-gray-950 text-sm focus:outline-none focus:ring-1 focus:ring-red-600"
                placeholder="送信したいメッセージ..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">
                各トークンあたりの送信回数
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={count}
                onChange={(e) => setCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-32 p-2 border rounded border-gray-300 dark:border-gray-800 dark:bg-gray-950 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-red-600"
              />
            </div>

            <button
              onClick={handleSendMessage}
              disabled={isSending || !selectedChannel || !message.trim()}
              className="w-full py-3 bg-red-600 text-white font-bold text-sm rounded hover:bg-red-700 active:bg-red-800 disabled:bg-gray-300 dark:disabled:bg-gray-800 transition-colors"
            >
              {isSending ? '送信中...' : '2. メッセージを送信'}
            </button>
          </div>

          {/* ステータス表示 */}
          {statusMessage && (
            <div className="p-4 rounded border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-xs font-mono whitespace-pre-wrap leading-relaxed">
              {statusMessage}
            </div>
          )}

          {/* トークンごとの実行詳細 */}
          {executionDetails.length > 0 && (
            <div className="border rounded p-4 border-gray-200 dark:border-gray-800 space-y-2">
              <div className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                トークンごとの実行詳細
              </div>
              <div className="space-y-1.5">
                {executionDetails.map((detail, idx) => (
                  <div key={idx} className="text-xs font-mono p-2 rounded bg-gray-100 dark:bg-gray-900 flex justify-between items-center">
                    <span>トークン: {detail.tokenPrefix}</span>
                    <span className="gap-2 flex">
                      <span className="text-green-600 dark:text-green-400 font-bold">成功: {detail.success}</span>
                      <span className="text-red-600 dark:text-red-400 font-bold">失敗: {detail.failed}</span>
                    </span>
                    {detail.lastError && (
                      <span className="text-red-500 max-w-xs truncate" title={detail.lastError}>
                        ({detail.lastError})
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
