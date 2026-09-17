import { NextRequest, NextResponse } from 'next/server';

interface RequestBody {
  tokens: string[];
  tokenType: 'bot' | 'user';
  guildId?: string;
  channelId?: string;
  content?: string;
  count?: number;
  spoofBrowser?: boolean;
}

interface TokenDetailResult {
  tokenPrefix: string;
  success: number;
  failed: number;
  lastError?: string;
}

// Discord Web版クライアントのプロパティを模倣するヘルパー関数
function generateSuperProperties() {
  const superProps = {
    os: 'Windows',
    browser: 'Chrome',
    device: '',
    system_locale: 'ja-JP',
    browser_user_agent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    browser_version: '122.0.0.0',
    os_version: '10',
    referrer: '',
    referring_domain: '',
    referrer_current: '',
    referring_domain_current: '',
    release_channel: 'stable',
    client_build_number: 275843,
    client_event_source: null,
  };

  return Buffer.from(JSON.stringify(superProps)).toString('base64');
}

// リクエストヘッダー構築関数
function buildHeaders(
  token: string,
  tokenType: 'bot' | 'user',
  guildId?: string,
  channelId?: string,
  spoofBrowser: boolean = false
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: tokenType === 'bot' ? `Bot ${token}` : token,
  };

  // Webブラウザ（Discord Web版）のリクエストを模倣
  if (spoofBrowser && tokenType === 'user') {
    headers['User-Agent'] =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
    headers['Origin'] = 'https://discord.com';
    headers['X-Super-Properties'] = generateSuperProperties();
    headers['X-Discord-Locale'] = 'ja';
    headers['X-Debug-Options'] = 'bugReporterEnabled';
    
    if (guildId && channelId) {
      headers['Referer'] = `https://discord.com/channels/${guildId}/${channelId}`;
    } else {
      headers['Referer'] = 'https://discord.com/channels/@me';
    }
  }

  return headers;
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  try {
    const body: RequestBody = await req.json();
    const { tokens, tokenType, guildId, channelId, content, spoofBrowser = true } = body;

    if (!tokens || tokens.length === 0) {
      return NextResponse.json({ error: 'トークンが提供されていません。' }, { status: 400 });
    }

    // 1. サーバー一覧の取得 (action=getGuilds)
    if (action === 'getGuilds') {
      const allGuildMaps: Map<string, { id: string; name: string }>[] = [];

      for (const token of tokens) {
        const res = await fetch('https://discord.com/api/v10/users/@me/guilds', {
          method: 'GET',
          headers: buildHeaders(token, tokenType, undefined, undefined, spoofBrowser),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          return NextResponse.json(
            { error: `トークン認証エラー (${token.substring(0, 10)}...): ${errData.message || res.statusText}` },
            { status: res.status }
          );
        }

        const data = await res.json();
        const guildMap = new Map<string, { id: string; name: string }>();
        data.forEach((g: any) => guildMap.set(g.id, { id: g.id, name: g.name }));
        allGuildMaps.push(guildMap);
      }

      // 複数トークンの場合は全トークンに共通するサーバーのみフィルタリング
      let commonGuilds = Array.from(allGuildMaps[0].values());
      for (let i = 1; i < allGuildMaps.length; i++) {
        commonGuilds = commonGuilds.filter((g) => allGuildMaps[i].has(g.id));
      }

      return NextResponse.json(commonGuilds);
    }

    // 2. チャンネル一覧の取得 (action=getChannels)
    if (action === 'getChannels') {
      if (!guildId) {
        return NextResponse.json({ error: 'guildId が必要です。' }, { status: 400 });
      }

      // 最初のトークンを使用してチャンネル一覧を取得
      const primaryToken = tokens[0];
      const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
        method: 'GET',
        headers: buildHeaders(primaryToken, tokenType, guildId, undefined, spoofBrowser),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        return NextResponse.json(
          { error: `チャンネル取得失敗: ${errData.message || res.statusText}` },
          { status: res.status }
        );
      }

      const channels = await res.json();
      return NextResponse.json(channels);
    }

    // 3. メッセージ送信 (action=sendMessage)
    if (action === 'sendMessage') {
      if (!channelId || !content) {
        return NextResponse.json({ error: 'channelId および content が必要です。' }, { status: 400 });
      }

      const executionDetails: TokenDetailResult[] = [];

      for (const token of tokens) {
        const prefix = token.substring(0, 10) + '...';
        let success = 0;
        let failed = 0;
        let lastError = '';

        const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
          method: 'POST',
          headers: buildHeaders(token, tokenType, guildId, channelId, spoofBrowser),
          body: JSON.stringify({
            content,
            // ブラウザ等からの送信に見せかける nonce (タイムスタンプベースのユニークID)
            nonce: Date.now().toString() + Math.floor(Math.random() * 1000).toString(),
            tts: false,
          }),
        });

        if (res.ok) {
          success++;
        } else {
          failed++;
          const errData = await res.json().catch(() => ({}));
          lastError = errData.message || `HTTP ${res.status}`;
        }

        executionDetails.push({
          tokenPrefix: prefix,
          success,
          failed,
          lastError: lastError || undefined,
        });
      }

      return NextResponse.json({ details: executionDetails });
    }

    return NextResponse.json({ error: '無効な action です。' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '内部サーバーエラー' }, { status: 500 });
  }
}
