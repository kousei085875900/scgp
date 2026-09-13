import { NextRequest, NextResponse } from 'next/server';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const action = searchParams.get('action');

  try {
    const body = await req.json();

    // 1. サーバー一覧の取得
    if (action === 'getGuilds') {
      const { token, tokenType } = body;
      if (!token) return NextResponse.json({ error: 'トークンがありません' }, { status: 400 });

      const authHeader = tokenType === 'bot' ? `Bot ${token}` : token;
      const res = await fetch('https://discord.com/api/v10/users/@me/guilds', {
        headers: { Authorization: authHeader },
      });

      if (!res.ok) return NextResponse.json({ error: `API Error: ${res.status}` }, { status: res.status });
      return NextResponse.json(await res.json());
    }

    // 2. チャンネル一覧の取得
    if (action === 'getChannels') {
      const { token, tokenType, guildId } = body;
      if (!token || !guildId) return NextResponse.json({ error: 'パラメータ不足' }, { status: 400 });

      const authHeader = tokenType === 'bot' ? `Bot ${token}` : token;
      const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
        headers: { Authorization: authHeader },
      });

      if (!res.ok) return NextResponse.json({ error: `API Error: ${res.status}` }, { status: res.status });
      return NextResponse.json(await res.json());
    }

    // 3. メッセージ送信処理（個別のエラーを分離して残りの処理を継続）
    if (action === 'sendMessage') {
      const { tokens, tokenType, channelId, content, count = 1 } = body;

      const tokenList: string[] = Array.isArray(tokens) ? tokens : [body.token];
      if (!tokenList.length || !channelId) {
        return NextResponse.json({ error: 'トークンまたは送信先IDが不足しています' }, { status: 400 });
      }

      const sendCount = Math.max(1, parseInt(count, 10) || 1);
      let successCount = 0;
      let failCount = 0;
      const details: { tokenPrefix: string; success: number; failed: number; lastError?: string }[] = [];

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
              
              // 401 (Unauthorized) や 403 (Forbidden) などトークン自体の無効化・権限不備の場合は
              // そのトークンの残り回数ループを即座に抜けて次のトークンへ移行
              if (res.status === 401 || res.status === 403) {
                tokenFail += (sendCount - (i + 1));
                failCount += (sendCount - (i + 1));
                break;
              }
            }

            // 連投時のレート制限対策 (800ms待機)
            await sleep(800);
          }
        } catch (err: any) {
          // 通信エラーやその他の予外例外が発生しても次のトークン処理を継続
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

      // すべてのトークンで失敗した場合のみエラーレスポンスを返す
      if (successCount === 0 && failCount > 0) {
        return NextResponse.json({
          error: 'すべてのトークンで送信に失敗しました',
          details,
        }, { status: 400 });
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
