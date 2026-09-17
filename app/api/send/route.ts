import { NextRequest, NextResponse } from 'next/server';

interface RequestBody {
  tokens: string[];
  tokenType: 'bot' | 'user';
  guildId?: string;
  channelId?: string;
  content?: string;
  count?: number;
}

interface TokenDetailResult {
  tokenPrefix: string;
  success: number;
  failed: number;
  lastError?: string;
}

// 公式デスクトップアプリ（Electron）のクライアント情報を完全模倣するプロパティ構造
const DISCORD_CLIENT_CONFIG = {
  clientVersion: '1.0.9100',
  clientBuildNumber: 285000,
  nativeBuildNumber: 45000,
  electronVersion: '28.2.10',
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Discord/1.0.9100 Chrome/120.0.6099.291 Electron/28.2.10 Safari/537.36',
};

/**
 * X-Super-Properties (Base64) の生成
 * app.asar 内の Discord 識別プロパティ構造を1:1で再現
 */
function generateSuperProperties(): string {
  const superProps = {
    os: 'Windows',
    browser: 'Discord Client',
    release_channel: 'stable',
    client_version: DISCORD_CLIENT_CONFIG.clientVersion,
    os_version: '10.0.19045',
    os_arch: 'x64',
    app_arch: 'x64',
    system_locale: 'ja-JP',
    browser_user_agent: DISCORD_CLIENT_CONFIG.userAgent,
    browser_version: DISCORD_CLIENT_CONFIG.electronVersion,
    client_build_number: DISCORD_CLIENT_CONFIG.clientBuildNumber,
    native_build_number: DISCORD_CLIENT_CONFIG.nativeBuildNumber,
  };

  return Buffer.from(JSON.stringify(superProps)).toString('base64');
}

/**
 * リクエストヘッダーの完全偽装
 */
function buildHeaders(
  token: string,
  tokenType: 'bot' | 'user',
  guildId?: string,
  channelId?: string
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: tokenType === 'bot' ? `Bot ${token}` : token,
  };

  if (tokenType === 'user') {
    headers['User-Agent'] = DISCORD_CLIENT_CONFIG.userAgent;
    headers['Origin'] = 'https://discord.com';
    headers['X-Super-Properties'] = generateSuperProperties();
    headers['X-Discord-Locale'] = 'ja';
    headers['X-Discord-Timezone'] = 'Asia/Tokyo';
    headers['X-Debug-Options'] = 'bugReporterEnabled';
    headers['Accept-Language'] = 'ja,en-US;q=0.9,en;q=0.8';

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
    const { tokens, tokenType, guildId, channelId, content } = body;

    if (!tokens || tokens.length === 0) {
      return NextResponse.json({ error: 'トークンが指定されていません。' }, { status: 400 });
    }

    // 1. サーバー一覧の取得
    if (action === 'getGuilds') {
      const allGuildMaps: Map<string, { id: string; name: string }>[] = [];

      for (const token of tokens) {
        const res = await fetch('https://discord.com/api/v10/users/@me/guilds', {
          method: 'GET',
          headers: buildHeaders(token, tokenType),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          return NextResponse.json(
            { error: `認証エラー (${token.substring(0, 10)}...): ${errData.message || res.statusText}` },
            { status: res.status }
          );
        }

        const data = await res.json();
        const guildMap = new Map<string, { id: string; name: string }>();
        data.forEach((g: any) => guildMap.set(g.id, { id: g.id, name: g.name }));
        allGuildMaps.push(guildMap);
      }

      let commonGuilds = Array.from(allGuildMaps[0].values());
      for (let i = 1; i < allGuildMaps.length; i++) {
        commonGuilds = commonGuilds.filter((g) => allGuildMaps[i].has(g.id));
      }

      return NextResponse.json(commonGuilds);
    }

    // 2. チャンネル一覧の取得
    if (action === 'getChannels') {
      if (!guildId) {
        return NextResponse.json({ error: 'guildId が指定されていません。' }, { status: 400 });
      }

      const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
        method: 'GET',
        headers: buildHeaders(tokens[0], tokenType, guildId),
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

    // 3. メッセージ送信
    if (action === 'sendMessage') {
      if (!channelId || !content) {
        return NextResponse.json({ error: 'channelId および content が指定されていません。' }, { status: 400 });
      }

      const executionDetails: TokenDetailResult[] = [];

      for (const token of tokens) {
        const prefix = token.substring(0, 10) + '...';
        let success = 0;
        let failed = 0;
        let lastError = '';

        const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
          method: 'POST',
          headers: buildHeaders(token, tokenType, guildId, channelId),
          body: JSON.stringify({
            content,
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
