'use client';
import { useState } from 'react';

export default function Home() {
  const [tokensText, setTokensText] = useState('');
  const [tokenType, setTokenType] = useState('bot'); // 'bot' または 'user'
  const [sendMode, setSendMode] = useState('server'); // 'server' または 'dm'
  const [guilds, setGuilds] = useState<{ id: string; name: string }[]>([]);
  const [channels, setChannels] = useState<{ id: string; name: string; type: number }[]>([]);
  const [selectedGuild, setSelectedGuild] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  // 入力された文字列から有効なトークンリストを抽出
  const getTokens = () => {
    return tokensText
      .split('\n')
      .map((t) => t.trim())
      .filter((t) => t.length >= 20);
  };

  // サーバー一覧の取得（1番目のトークンで代表取得）
  const handleLoadGuilds = async () => {
    const tokens = getTokens();
    if (tokens.length === 0) {
      setStatusMessage('Error: 有効なトークンが入力されていません');
      return;
    }

    setStatusMessage('Loading servers...・サーバー一覧を取得中...');
    setGuilds([]);
    setChannels([]);
    setSelectedGuild('');

    try {
      const res = await fetch('/api/send?action=getGuilds', {
        method: 'POST',
        body: JSON.stringify({ token: tokens[0], tokenType }),
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        throw new Error(`Status ${res.status}: トークンが無効か、通信に失敗しました`);
      }

      const data = await res.json();
      if (Array.isArray(data)) {
        setGuilds(data);
        setStatusMessage(`Success: ${data.length}個のサーバーを読み込みました`);
      } else {
        throw new Error('データが配列形式ではありません');
      }
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    }
  };

  // サーバー選択時のチャンネル取得
  const handleGuildChange = async (guildId: string) => {
    setSelectedGuild(guildId);
    setChannels([]);
    if (!guildId) return;

    const tokens = getTokens();
    setStatusMessage('Loading channels...・チャンネル一覧を取得中...');
    try {
      const res = await fetch('/api/send?action=getChannels', {
        method: 'POST',
        body: JSON.stringify({ token: tokens[0], tokenType, guildId }),
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setChannels(data.filter((c) => c.type === 0 || c.type === 11));
        setStatusMessage('Success: チャンネル一覧を更新しました');
      }
    } catch (err: any) {
      setStatusMessage(`Error: チャンネル取得失敗 (${err.message})`);
    }
  };

  // 送信処理
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const tokens = getTokens();
    if (tokens.length === 0) {
      setStatusMessage('Error: 有効なトークンを入力してください');
      return;
    }

    const formData = new FormData(e.currentTarget);
    const payload = {
      ...Object.fromEntries(formData),
      tokens,
      tokenType,
      sendMode,
    };

    setStatusMessage(`Sending...・${tokens.length}個のトークンで送信中...`);
    try {
      const res = await fetch('/api/send?action=sendMessage', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();
      if (res.ok) {
        setStatusMessage(`Sent successfully!・完了 (${data.summary || '送信完了'})`);
        alert('Sent successfully!・送信成功！');
      } else {
        setStatusMessage(`Error: ${data.error || '送信に失敗しました'}`);
        alert(`error: ${data.error || '送信エラー'}`);
      }
    } catch (err: any) {
      setStatusMessage(`Error: 通信エラー (${err.message})`);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '12px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '14px',
  };

  const gridRowStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '20px',
  };

  return (
    <main style={{ maxWidth: '1200px', margin: '20px auto', padding: '0 20px', fontFamily: 'sans-serif', boxSizing: 'border-box' }}>
      <form onSubmit={handleSubmit} style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        padding: '30px 80px',
        border: '1px solid #ccc',
        borderRadius: '8px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      }}>
        <h3 style={{ margin: '0 0 10px 0', textAlign: 'center', fontSize: '22px' }}>discord tt (Multi Token)</h3>

        {/* 1段目 */}
        <div style={gridRowStyle}>
          {/* アカウント種別 */}
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center', justifyContent: 'center', background: '#6E6E6E', padding: '12px', borderRadius: '4px', border: '1px solid #eee' }}>
            <label style={{ cursor: 'pointer', fontSize: '14px' }}>
              <input type="radio" name="tokenType" value="bot" checked={tokenType === 'bot'} onChange={() => setTokenType('bot')} style={{ marginRight: '6px' }} /> bot
            </label>
            <label style={{ cursor: 'pointer', fontSize: '14px' }}>
              <input type="radio" name="tokenType" value="user" checked={tokenType === 'user'} onChange={() => setTokenType('user')} style={{ marginRight: '6px' }} /> self・ユーザー
            </label>
          </div>

          {/* 送信モード */}
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center', justifyContent: 'center', background: '#6E6E6E', padding: '12px', borderRadius: '4px', border: '1px solid #eee' }}>
            <label style={{ cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>
              <input type="radio" name="sendMode" value="server" checked={sendMode === 'server'} onChange={() => { setSendMode('server'); setStatusMessage(''); }} style={{ marginRight: '6px' }} /> 🖲️ サーバー
            </label>
            <label style={{ cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>
              <input type="radio" name="sendMode" value="dm" checked={sendMode === 'dm'} onChange={() => { setSendMode('dm'); setStatusMessage(''); }} style={{ marginRight: '6px' }} /> 💬 DM
            </label>
          </div>

          {/* 送信回数 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 'bold' }}>count・トークンごとの送信回数</label>
            <input name="count" type="number" min="1" defaultValue="3" required style={inputStyle} />
          </div>
        </div>

        {/* トークン入力欄（複数行対応） */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '13px', fontWeight: 'bold' }}>tokens・トークンリスト（改行で複数指定）</label>
          <textarea
            value={tokensText}
            onChange={(e) => setTokensText(e.target.value)}
            placeholder={"MTk4N...\nOTg3N...\n..."}
            required
            style={{ ...inputStyle, minHeight: '100px', resize: 'vertical', fontFamily: 'monospace' }}
          />
        </div>

        {/* 2段目：ターゲット選択エリア */}
        {sendMode === 'server' ? (
          <div style={gridRowStyle}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '13px', fontWeight: 'bold' }}>server・サーバー選択</label>
                <button type="button" onClick={handleLoadGuilds} style={{ padding: '3px 10px', backgroundColor: '#4f46e5', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>
                  Load・読み込み
                </button>
              </div>
              <select value={selectedGuild} onChange={(e) => handleGuildChange(e.target.value)} required style={inputStyle}>
                <option value="">サーバーを選択してください</option>
                {guilds.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold' }}>channel・チャンネル選択</label>
              <select name="channelId" required style={inputStyle}>
                <option value="">チャンネルを選択してください</option>
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>#{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 'bold' }}>DM Channel ID / Target ID・DMのチャンネルID（または送信先ID）</label>
            <input name="channelId" type="text" placeholder="123456789012345678" required style={inputStyle} />
          </div>
        )}

        {/* 3段目：メッセージ内容 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '13px', fontWeight: 'bold' }}>message・メッセージ内容</label>
          <textarea name="content" placeholder="こんにちは！" required style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} />
        </div>

        {/* ステータス表示 */}
        {statusMessage && (
          <div style={{ fontSize: '13px', backgroundColor: '#f3f4f6', padding: '12px', borderRadius: '4px', wordBreak: 'break-all', borderLeft: statusMessage.startsWith('Error') ? '4px solid #ef4444' : '4px solid #10b981', color: statusMessage.startsWith('Error') ? '#b91c1c' : '#065f46' }}>
            {statusMessage}
          </div>
        )}

        {/* 実行ボタン */}
        <button type="submit" style={{ padding: '14px', backgroundColor: '#e91e63', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginTop: '5px' }}>
          go・全トークンで送信を開始する
        </button>
      </form>
    </main>
  );
}
