import { NextRequest, NextResponse } from 'next/server';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const action = searchParams.get('action');

  try {
    const body = await req.json();

    // 1. サーバー一覧の取得（共通サーバー抽出）
    if (action === 'getGuilds') {
      const { tokens, tokenType } = body;
      const tokenList: string[] = Array.isArray(tokens) ? tokens : (body.token ? [body.token] : []);

      if (tokenList.length === 0) {
        return NextResponse.json({ error: 'トークンが指定されていません' }, { status: 400 });
      }

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
      const validResults = results.filter((g): g is { id: string; name: string }[] => Array.isArray(g));

      if (validResults.length === 0) {
        return NextResponse.json({ error: 'すべてのトークンでサーバー一覧の取得に失敗しました' }, { status: 400 });
      }

      const commonGuilds = validResults[0].filter((guild) =>
        validResults.every((list) => list.some((g) => g.id === guild.id))
      );

      return NextResponse.json(commonGuilds);
    }

    // 2. チャンネル一覧の取得
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

    // 3. メッセージ送信処理（全チャンネル一斉送信 & 全トークン同時並列実行）
    if (action === 'sendMessage') {
      const { tokens, tokenType, guildId, channelId, content, count = 1 } = body;
      const tokenList: string[] = Array.isArray(tokens) ? tokens : [body.token];

      if (!tokenList.length) {
        return NextResponse.json({ error: 'トークンが不足しています' }, { status: 400 });
      }

      let targetChannelIds: string[] = [];

      // 全チャンネル送信モード (channelId === 'ALL') の場合
      if (channelId === 'ALL') {
        if (!guildId) {
          return NextResponse.json({ error: 'サーバーIDが不足しています' }, { status: 400 });
        }
        const targetToken = tokenList[0];
        const authHeader = tokenType === 'bot' ? `Bot ${targetToken}` : targetToken;

        const chRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
          headers: { Authorization: authHeader },
        });

        if (!chRes.ok) {
          return NextResponse.json({ error: '全チャンネル一覧の取得に失敗しました' }, { status: chRes.status });
        }

        const chData: { id: string; type: number }[] = await chRes.json();
        // テキストチャンネル (type 0) と アナウンスチャンネル (type 5) のみ抽出
        targetChannelIds = chData
          .filter((c) => c.type === 0 || c.type === 5)
          .map((c) => c.id);

        if (targetChannelIds.length === 0) {
          return NextResponse.json({ error: '送信可能なチャンネルが存在しません' }, { status: 400 });
        }
      } else {
        if (!channelId) {
          return NextResponse.json({ error: '送信先チャンネルが選択されていません' }, { status: 400 });
        }
        targetChannelIds = [channelId];
      }

      const sendCount = Math.max(1, parseInt(count, 10) || 1);

      // 各トークンの送信タスク（複数チャンネルに同時送信）
      const tokenTasks = tokenList.map(async (token) => {
        const tokenPrefix = token.slice(0, 8) + '...';
        const authHeader = tokenType === 'bot' ? `Bot ${token}` : token;
        let tokenSuccess = 0;
        let tokenFail = 0;
        let lastError = '';

        try {
          // ターゲットとなる全チャンネルに対して並列処理を発火
          const channelPromises = targetChannelIds.map(async (chId) => {
            let chSuccess = 0;
            let chFail = 0;

            for (let i = 0; i < sendCount; i++) {
              const res = await fetch(`https://discord.com/api/v10/channels/${chId}/messages`, {
                method: 'POST',
                headers: {
                  Authorization: authHeader,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ content }),
              });

              if (res.ok) {
                chSuccess++;
              } else {
                chFail++;
                const errData = await res.json().catch(() => ({}));
                lastError = `Status ${res.status}: ${errData.message || '送信失敗'}`;

                if (res.status === 401 || res.status === 403) {
                  chFail += (sendCount - (i + 1));
                  break;
                }
              }

              await sleep(800);
            }
            return { chSuccess, chFail };
          });

          const chResults = await Promise.all(channelPromises);
          chResults.forEach((r) => {
            tokenSuccess += r.chSuccess;
            tokenFail += r.chFail;
          });
        } catch (err: any) {
          tokenFail += (targetChannelIds.length * sendCount) - tokenSuccess;
          lastError = err.message || 'ネットワークエラー';
        }

        return {
          tokenPrefix,
          success: tokenSuccess,
          failed: tokenFail,
          lastError,
        };
      });

      const results = await Promise.all(tokenTasks);

      let totalSuccess = 0;
      let totalFail = 0;
      const details = results.map((r) => {
        totalSuccess += r.success;
        totalFail += r.failed;
        return {
          tokenPrefix: r.tokenPrefix,
          success: r.success,
          failed: r.failed,
          ...(r.lastError ? { lastError: r.lastError } : {}),
        };
      });

      if (totalSuccess === 0 && totalFail > 0) {
        return NextResponse.json({ error: 'すべてのチャンネル/トークンで送信に失敗しました', details }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        summary: `対象チャンネル数: ${targetChannelIds.length}件 / 総成功: ${totalSuccess}件 / 総失敗: ${totalFail}件`,
        details,
      });
    }

    return NextResponse.json({ error: '無効なアクション' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '内部エラー' }, { status: 500 });
  }
}
