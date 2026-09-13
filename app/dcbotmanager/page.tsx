'use client';

import { useState } from 'react';

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
    <main className="max-w-3xl mx-auto p-6 font-sans">
      
      <h1 className="text-2xl font-bold mb-6">
        Discord token manager
      </h1>

<p className="text-2xl">
        【注意】selfモードでユーザートークンでメッセージを送信する場合アカウントが停止される可能性があります
      </p>

      <p className="text-red-500">
        絶対にメインアカウントで試さないでください
      </p>

      <a href="https://mail.scgp.jp/" target="_blank" rel="noopener noreferrer"className="text-blue-500 hover:underline">
  　　　　簡易メールアドレスはこちらから作成できます
　　　　</a>


      <div className="text-xs text-gray-400 space-y-1">
          <p>当ツールを使用したことによるアカウント停止については自己責任でお願いします</p>
          
        </div>

      
      <div className="space-y-6">
        {/* トークン種別選択 */}
        <div>
          <label className="block text-sm font-medium mb-2">トークン種別</label>
          <div className="flex gap-4">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="tokenType"
                value="bot"
                checked={tokenType === 'bot'}
                onChange={() => setTokenType('bot')}
              />
              Bot Token
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="tokenType"
                value="user"
                checked={tokenType === 'user'}
                onChange={() => setTokenType('user')}
              />
              User Token
            </label>
          </div>
        </div>

        {/* トークン入力エリア */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="block text-sm font-medium">
              Discord トークン（複数入力可：改行またはカンマ区切り）
            </label>
            <span className="text-xs text-gray-500">
              検知されたトークン数: {tokensCount}件
            </span>
          </div>
          <textarea
            className="w-full h-28 p-3 border rounded font-mono text-sm border-gray-300 dark:border-gray-700 dark:bg-gray-900"
            placeholder="トークンを改行で区切って入力..."
            value={tokensInput}
            onChange={(e) => setTokensInput(e.target.value)}
          />
          <button
            onClick={handleLoadGuilds}
            disabled={isLoadingGuilds || tokensCount === 0}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 text-sm"
          >
            {isLoadingGuilds ? '取得中...' : '1. サーバー一覧を取得'}
          </button>
        </div>

        {/* サーバー選択 */}
        <div>
          <label className="block text-sm font-medium mb-1">
            サーバー選択 {tokensCount > 1 && '(全トークン共通のみ表示)'}
          </label>
          <select
            value={selectedGuild}
            onChange={(e) => handleGuildChange(e.target.value)}
            disabled={guilds.length === 0 || isLoadingChannels}
            className="w-full p-2 border rounded border-gray-300 dark:border-gray-700 dark:bg-gray-900"
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
          <label className="block text-sm font-medium mb-1">チャンネル選択</label>
          <select
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value)}
            disabled={channels.length === 0}
            className="w-full p-2 border rounded border-gray-300 dark:border-gray-700 dark:bg-gray-900"
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
            <label className="block text-sm font-medium mb-1">送信メッセージ</label>
            <textarea
              rows={3}
              className="w-full p-3 border rounded border-gray-300 dark:border-gray-700 dark:bg-gray-900"
              placeholder="送信したいメッセージ..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">各トークンあたりの送信回数</label>
            <input
              type="number"
              min={1}
              max={50}
              value={count}
              onChange={(e) => setCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-32 p-2 border rounded border-gray-300 dark:border-gray-700 dark:bg-gray-900"
            />
          </div>

          <button
            onClick={handleSendMessage}
            disabled={isSending || !selectedChannel || !message.trim()}
            className="w-full py-3 bg-green-600 text-white font-bold rounded hover:bg-green-700 disabled:bg-gray-400"
          >
            {isSending ? '送信中...' : '2. メッセージを送信'}
          </button>
        </div>

        {/* ステータス表示 */}
        {statusMessage && (
          <div className="p-4 rounded bg-gray-100 dark:bg-gray-800 text-sm font-mono whitespace-pre-wrap">
            {statusMessage}
          </div>
        )}

        {/* トークンごとの詳細結果 */}
        {executionDetails.length > 0 && (
          <div className="border rounded p-4 border-gray-200 dark:border-gray-800">
            <h3 className="text-sm font-bold mb-2">トークンごとの実行詳細</h3>
            <div className="space-y-2">
              {executionDetails.map((detail, idx) => (
                <div key={idx} className="text-xs font-mono p-2 rounded bg-gray-50 dark:bg-gray-900 flex justify-between items-center">
                  <span>トークン: {detail.tokenPrefix}</span>
                  <span className="gap-2 flex">
                    <span className="text-green-600 font-bold">成功: {detail.success}</span>
                    <span className="text-red-600 font-bold">失敗: {detail.failed}</span>
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
    </main>
  );
}
