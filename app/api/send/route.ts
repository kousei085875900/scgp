import { NextRequest, NextResponse } from 'next/server';

// 最新の仕様に合わせたブラウザ模倣およびX-Super-Propertiesヘッダー構築関数
function buildHeaders(token: string, tokenType: 'bot' | 'user', spoofBrowser: boolean = true) {
  const headers: Record<string, string> = {
    'Authorization': tokenType === 'bot' ? `Bot ${token}` : token,
    'Content-Type': 'application/json',
  };

  if (spoofBrowser) {
    headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
    
    headers['X-Super-Properties'] = Buffer.from(
      JSON.stringify({
        os: 'Windows',
        browser: 'Chrome',
        device: '',
        system_locale: 'ja',
        browser_user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        browser_version: '124.0.0.0',
        os_version: '10',
        referrer: '',
        referring_domain: '',
        referrer_current: '',
        referring_domain_current: '',
        release_channel: 'stable',
        client_build_number: 305412,
        client_event_source: null,
      })
    ).toString('base64');

    headers['Sec-Ch-Ua'] = '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"';
    headers['Sec-Ch-Ua-Mobile'] = '?0';
    headers['Sec-Ch-Ua-Platform'] = '"Windows"';
    headers['Sec-Fetch-Site'] = 'same-origin';
    headers['Sec-Fetch-Mode'] = 'cors';
    headers['Sec-Fetch-Dest'] = 'empty';
    headers['Accept-Language'] = 'ja,en-US;q=0.9,en;q=0.8';
  }

  return headers;
}

export async function POST(req: NextRequest) {
  try {
    const action = req.nextUrl.searchParams.get('action');
    const body = await req.json();
    const { tokens, tokenType = 'bot', guildId, channelId, content, count = 1, spoofBrowser = true } = body;

    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      return NextResponse.json({ error: '有効なトークンが指定されていません。' }, { status: 400 });
    }

    // 1. サーバー一覧の取得（複数トークンの場合は共通のサーバーを抽出）
    if (action === 'getGuilds') {
      const guildSets: Set<string>[] = [];
      const guildMap = new Map<string, { id: string; name: string }>();

      for (const token of tokens) {
        const res = await fetch('https://discord.com/api/v10/users/@me/guilds', {
          method: 'GET',
          headers: buildHeaders(token, tokenType, spoofBrowser),
        });

        if (!res.ok) {
          const errText = await res.text();
          return NextResponse.json({ error: `トークンによるサーバー取得失敗 (Status ${res.status}): ${errText}` }, { status: res.status });
        }

        const guilds = await res.json();
        const currentGuildIds = new Set<string>();
        for (const g of guilds) {
          currentGuildIds.add(g.id);
          guildMap.set(g.id, { id: g.id, name: g.name });
        }
        guildSets.push(currentGuildIds);
      }

      let commonIds = guildSets[0];
      for (let i = 1; i < guildSets.length; i++) {
        commonIds = new Set([...commonIds].filter((id) => guildSets[i].has(id)));
      }

      const commonGuilds = Array.from(commonIds).map((id) => guildMap.get(id)!);
      return NextResponse.json(commonGuilds);
    }

    // 2. チャンネル一覧の取得
    if (action === 'getChannels') {
      if (!guildId) {
        return NextResponse.json({ error: 'サーバーIDが指定されていません。' }, { status: 400 });
      }

      const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
        method: 'GET',
        headers: buildHeaders(tokens[0], tokenType, spoofBrowser),
      });

      if (!res.ok) {
        const errText = await res.text();
        return NextResponse.json({ error: `チャンネル取得失敗 (Status ${res.status}): ${errText}` }, { status: res.status });
      }

      const channels = await res.json();
      return NextResponse.json(channels);
    }

    // 3. メッセージ送信
    if (action === 'sendMessage') {
      if (!channelId || !content) {
        return NextResponse.json({ error: 'チャンネルIDまたはメッセージ内容が不足しています。' }, { status: 400 });
      }

      const details = [];

      for (const token of tokens) {
        const prefix = token.substring(0, 10) + '...';
        let successCount = 0;
        let failCount = 0;
        let lastError = '';

        for (let i = 0; i < count; i++) {
          try {
            const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
              method: 'POST',
              headers: buildHeaders(token, tokenType, spoofBrowser),
              body: JSON.stringify({ content }),
            });

            if (res.ok) {
              successCount++;
            } else {
              failCount++;
              const errData = await res.json().catch(() => ({}));
              lastError = errData.message || `HTTP ${res.status}`;
            }
          } catch (err: any) {
            failCount++;
            lastError = err.message || 'ネットワークエラー';
          }
        }

        details.push({
          tokenPrefix: prefix,
          success: successCount,
          failed: failCount,
          lastError: lastError || undefined,
        });
      }

      return NextResponse.json({ details });
    }

    // 4. 招待リンクからのサーバー参加（エラー詳細出力強化版）
    if (action === 'joinGuild') {
      const { inviteCode } = body;
      if (!inviteCode) {
        return NextResponse.json({ error: '招待コードが指定されていません。' }, { status: 400 });
      }

      // 招待コードのパースを堅牢化（末尾のスラッシュや余計なクエリパラメータを除外）
      const trimmed = inviteCode.trim();
      const cleanCode = trimmed.includes('/') 
        ? trimmed.split('/').filter(Boolean).pop()?.split('?')[0] 
        : trimmed;

      const details = [];

      for (const token of tokens) {
        const prefix = token.substring(0, 10) + '...';

        try {
          const res = await fetch(`https://discord.com/api/v10/invites/${cleanCode}`, {
            method: 'POST',
            headers: buildHeaders(token, tokenType, spoofBrowser),
            body: JSON.stringify({}),
          });

          if (res.ok) {
            const data = await res.json();
            details.push({
              tokenPrefix: prefix,
              success: true,
              guildName: data.guild?.name || '不明なサーバー',
            });
          } else {
            // Discordから返された詳細なエラー内容をパースする
            const errData = await res.json().catch(() => ({}));
            const errMessage = errData.message || `HTTP ${res.status}`;
            const errCode = errData.code ? ` (Code: ${errData.code})` : '';

            details.push({
              tokenPrefix: prefix,
              success: false,
              error: `${errMessage}${errCode}`,
            });
          }
        } catch (err: any) {
          details.push({
            tokenPrefix: prefix,
            success: false,
            error: err.message || '接続エラー',
          });
        }
      }

      return NextResponse.json({ details });
    }

    return NextResponse.json({ error: '無効なアクションです。' }, { status: 400 });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'サーバー内部エラーが発生しました。' }, { status: 500 });
  }
}
