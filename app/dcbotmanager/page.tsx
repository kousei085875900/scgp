'use client';

import { useState } from 'react';

interface Guild {
  id: string;
  name: string;
}

interface Channel {
  id: string;
  name: string;
  type: number;
}

export default function Home() {
  const [token, setToken] = useState('');
  const [tokenType, setTokenType] = useState<'bot' | 'user'>('bot');
  const [sendMode, setSendMode] = useState<'channel' | 'dm'>('channel');

  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [selectedGuild, setSelectedGuild] = useState('');

  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState('');

  const [targetUserId, setTargetUserId] = useState('');
  const [count, setCount] = useState(1);
  const [content, setContent] = useState('');

  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  // 1. 所属サーバー一覧の取得
  const fetchGuilds = async () => {
    if (!token) return alert('トークンを入力してください');
    setLoading(true);
    setStatus('サーバー一覧を取得中...');

    try {
      const res = await fetch('/api/send?action=getGuilds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, tokenType }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || '取得失敗');

      setGuilds(data);
      setStatus('サーバー一覧の取得に成功しました');
    } catch (err: any) {
      setStatus(`エラー: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 2. 選択したサーバーのテキストチャンネル一覧を取得
  const fetchChannels = async (guildId: string) => {
    setSelectedGuild(guildId);
    if (!guildId) return;

    setLoading(true);
    setStatus('チャンネル一覧を取得中...');

    try {
      const res = await fetch('/api/send?action=getChannels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, tokenType, guildId }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || '取得失敗');

      // テキストチャンネル（type: 0）のみ抽出
      const textChannels = data.filter((c: Channel) => c.type === 0);
      setChannels(textChannels);
      setStatus('チャンネル一覧の取得に成功しました');
    } catch (err: any) {
      setStatus(`エラー: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 3. 送信処理
  const handleSend = async () => {
    if (!token) return alert('トークンを入力してください');
    if (sendMode === 'channel' && !selectedChannel) return alert('送信先のチャンネルを選択してください');
    if (sendMode === 'dm' && !targetUserId) return alert('送信先のユーザーIDを入力してください');
    if (!content) return alert('本文を入力してください');

    setLoading(true);
    setStatus('送信処理を実行中...');

    try {
      const res = await fetch('/api/send?action=sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          tokenType,
          sendMode,
          channelId: selectedChannel,
          userId: targetUserId,
          count,
          content,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '送信失敗');

      setStatus('すべてのメッセージの送信が完了しました！');
    } catch (err: any) {
      setStatus(`エラー: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ maxWidth: '600px', margin: '40px auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <h2>Discord 連続メッセージ送信ツール</h2>

      {/* 認証設定 */}
      <div style={{ background: '#f5f5f5', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
        <h3>1. 認証設定</h3>
        <div style={{ marginBottom: '10px' }}>
          <label style={{ marginRight: '15px' }}>
            <input
              type="radio"
              name="tokenType"
              value="bot"
              checked={tokenType === 'bot'}
              onChange={() => setTokenType('bot')}
            />
            bot
          </label>
          <label>
            <input
              type="radio"
              name="tokenType"
              value="user"
              checked={tokenType === 'user'}
              onChange={() => setTokenType('user')}
            />
            self・ユーザー
          </label>
        </div>
        <div>
          <input
            type="password"
            placeholder="アクセストークンを入力"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      {/* 送信モード切り替え */}
      <div style={{ background: '#f5f5f5', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
        <h3>2. 送信モード・ターゲット選択</h3>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ marginRight: '15px' }}>
            <input
              type="radio"
              name="sendMode"
              value="channel"
              checked={sendMode === 'channel'}
              onChange={() => setSendMode('channel')}
            />
            サーバーチャンネル送信
          </label>
          <label>
            <input
              type="radio"
              name="sendMode"
              value="dm"
              checked={sendMode === 'dm'}
              onChange={() => setSendMode('dm')}
            />
            個人DM送信
          </label>
        </div>

        {/* チャンネル送信モード用の入力UI */}
        {sendMode === 'channel' ? (
          <div>
            <button onClick={fetchGuilds} disabled={loading} style={{ marginBottom: '10px', padding: '8px 12px' }}>
              Load・一覧を読み込む
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <select
                value={selectedGuild}
                onChange={(e) => fetchChannels(e.target.value)}
                disabled={guilds.length === 0}
                style={{ padding: '8px' }}
              >
                <option value="">-- サーバーを選択 --</option>
                {guilds.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(e.target.value)}
                disabled={channels.length === 0}
                style={{ padding: '8px' }}
              >
                <option value="">-- チャンネルを選択 --</option>
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          /* DM送信モード用の入力UI */
          <div>
            <input
              type="text"
              placeholder="送信先 ユーザーID (例: 123456789012345678)"
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            />
          </div>
        )}
      </div>

      {/* メッセージ・連投設定 */}
      <div style={{ background: '#f5f5f5', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
        <h3>3. 送信設定</h3>
        <div style={{ marginBottom: '10px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>連投回数:</label>
          <input
            type="number"
            min="1"
            max="100"
            value={count}
            onChange={(e) => setCount(parseInt(e.target.value) || 1)}
            style={{ width: '80px', padding: '8px' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '5px' }}>送信本文:</label>
          <textarea
            rows={4}
            placeholder="本文を入力してください（語尾は自動付与されます）"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      {/* 実行ボタン */}
      <button
        onClick={handleSend}
        disabled={loading}
        style={{
          width: '100%',
          padding: '12px',
          backgroundColor: '#5865F2',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          fontWeight: 'bold',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? '処理中...' : '送信実行'}
      </button>

      {/* ステータスログ表示 */}
      {status && (
        <div
          style={{
            marginTop: '20px',
            padding: '10px',
            borderRadius: '4px',
            background: status.includes('エラー') ? '#ffebee' : '#e8f5e9',
            color: status.includes('エラー') ? '#c62828' : '#2e7d32',
          }}
        >
          {status}
        </div>
      )}
    </main>
  );
}
