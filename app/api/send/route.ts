import { NextRequest, NextResponse } from 'next/server';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const action = searchParams.get('action');

  try {
    const body = await req.json();

    // 1. サーバー一覧の取得（複数トークン時の共通サーバー抽出対応）
    if (action === 'getGuilds') {
      const { tokens, tokenType } = body;
      const tokenList: string[] = Array.isArray(tokens) ? tokens : (body.token ? [body.token] : []);

      if (tokenList.length === 0) {
        return NextResponse.json({ error: 'トークンが指定されていません' }, { status: 400 });
      }

      // 各トークンのサーバー一覧を取得
      const guildListsPromises = tokenList.map(async (token) => {
        const authHeader = tokenType === 'bot' ? `Bot ${token}` : token;
        try {
          const res = await fetch('https://discord.com/api/v10/users/@me/guilds', {
            headers: { Authorization: authHeader },
          });
          if (!res.ok) return null;
          const data: { id: string; name: string }[] = await res.json();
          return data;
        } catch {
          return null;
        }
      });

      const results = await Promise.all(guildListsPromises);
      // 通信・認証に成功したレスポンスのみフィルタリング
      const validResults = results.filter((g): g is { id: string; name: string }[] => Array.isArray(g));

      if (validResults.length === 0) {
        return NextResponse.json({ error: 'すべてのトークンでサーバー一覧の取得に失敗しました' }, { status: 400 });
      }

      // 共通サーバー（すべての正常なトークンに参加しているサーバー）を算出
      // 最初のトークンのサーバーリストを基準に、残りの全トークンにも存在する id だけを残す
      const commonGuilds = validResults[0].filter((guild) =>
        validResults.every((list) => list.some((g) => g.id === guild.id))
      );

      return NextResponse.json(commonGuilds);
    }

    // 2. チャンネル一覧の取得（先頭の有効なトークンで取得）
    if (action === 'getChannels') {
      const { tokens, tokenType, guildId } = body;
      const tokenList: string[] = Array.isArray(tokens) ? tokens : (body.token ? [body.token] : []);
      const targetToken = tokenList[0];

      if (!targetToken || !guildId) {
        return NextResponse.json({ error: 'パラメータが不足しています' }, { status: 400 });
      }

      const authHeader = tokenType === 'bot' ? `Bot ${targetToken}` : targetToken;
      const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
        headers: { Authorization: authHeader },
      });

      if (!res.ok) return NextResponse.json({ error: `API Error: ${res.status}` }, { status: res.status });
      return NextResponse.json(await res.json());
    }

    // 3. メッセージ送信処理（前回の個別エラーハンドリング維持）
    if (action === 'sendMessage') {
      const { tokens, tokenType, channelId, content, count = 1 } = body;
      const tokenList: string[] = Array.isArray(tokens) ? tokens : [body.token];

      if (!tokenList.length || !channelId) {
        return NextResponse.json({ error: 'トークンまたは送信先IDが不足しています' }, { status: 400 });
      }

      const sendCount = Math.max(1, parseInt(count, 10) || 1);
      let successCount = 0;
      let failCount = 0;
      const details = [];

      for (const token of tokenList) {
        const tokenPrefix = token.slice(0, 8) + '...';
        const authHeader = tokenType === 'bot' ? `Bot ${token}` : token;
        let tokenSuccess = 0;
        let tokenFail = 0;
        let lastError = '';

        try {
          for (let i = 0; i < sendCount; i++) {
            const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
              method: 'POST',
              headers: {
                Authorization: authHeader,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ content }),
            });

            if (res.ok) {
              successCount++;
              tokenSuccess++;
            } else {
              failCount++;
              tokenFail++;
              const errData = await res.json().catch(() => ({}));
              lastError = `Status ${res.status}: ${errData.message || '送信失敗'}`;

              if (res.status === 401 || res.status === 403) {
                tokenFail += (sendCount - (i + 1));
                failCount += (sendCount - (i + 1));
                break;
              }
            }

            await sleep(800);
          }
        } catch (err: any) {
          tokenFail += (sendCount - tokenSuccess);
          failCount += (sendCount - tokenSuccess);
          lastError = err.message || 'ネットワークエラー';
        }

        details.push({
          tokenPrefix,
          success: tokenSuccess,
          failed: tokenFail,
          ...(lastError ? { lastError } : {}),
        });
      }

      if (successCount === 0 && failCount > 0) {
        return NextResponse.json({ error: 'すべてのトークンで送信に失敗しました', details }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        summary: `成功: ${successCount}件 / 失敗: ${failCount}件`,
        details,
      });
    }

    return NextResponse.json({ error: '無効なアクション' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '内部エラー' }, { status: 500 });
  }
}
