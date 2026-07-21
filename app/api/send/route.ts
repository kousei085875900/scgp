import { NextResponse } from 'next/server';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  const body = await request.json();
  const { token, tokenType, sendMode, guildId, channelId, userId, count, content } = body;

  // トークンタイプの判定（Botの場合は頭に「Bot 」を付与）
  const authHeader = tokenType === 'bot' ? `Bot ${token}` : token;

  try {
    // 1. 所属サーバー一覧の取得
    if (action === 'getGuilds') {
      const res = await fetch('https://discord.com/api/v10/users/@me/guilds', {
        headers: { 'Authorization': authHeader },
      });
      if (!res.ok) return NextResponse.json({ error: 'Failed to fetch guilds' }, { status: res.status });
      const data = await res.json();
      return NextResponse.json(data);
    }

    // 2. サーバー内のチャンネル一覧の取得
    if (action === 'getChannels') {
      const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
        headers: { 'Authorization': authHeader },
      });
      if (!res.ok) return NextResponse.json({ error: 'Failed to fetch channels' }, { status: res.status });
      const data = await res.json();
      return NextResponse.json(data);
    }

    // 3. 連続メッセージ送信処理 (サーバー / DM 両対応)
    if (action === 'sendMessage') {
      const loopCount = parseInt(count) || 1; 
      let finalTargetId = channelId;

      // DMモードの場合はまずDMチャンネル（部屋）を作成・取得
      if (sendMode === 'dm') {
        if (!userId) {
          return NextResponse.json({ error: 'ユーザーIDが指定されていません' }, { status: 400 });
        }

        const dmCreateRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ recipient_id: userId }),
        });

        if (!dmCreateRes.ok) {
          const errorDetail = await dmCreateRes.json().catch(() => ({ message: 'DMの作成権限がないか、IDが不正です' }));
          return NextResponse.json({ 
            error: `DM部屋の作成に失敗: [ステータス ${dmCreateRes.status}] ${errorDetail.message}` 
          }, { status: dmCreateRes.status });
        }

        const dmData = await dmCreateRes.json();
        finalTargetId = dmData.id;
      }

      // 指定された固定の語尾文字列
      const suffix = "📡🤯💥☠️🔥🦠💉🚫 📶💀👿🤖👽 政府洗脳 監視 カメラ 追跡 コントロール 脳波 操作 病気 拡散 DNA🧬 変異 птиц 🐦 насекомых 🐝🌳🌲消滅 地球温暖化 ускоряется 🥵🌊🌋地震兵器 активация 地球滅亡 предсказание 🔮🔮🔮";

      // 実際の送信ループ
      for (let i = 0; i < loopCount; i++) {
        const res = await fetch(`https://discord.com/api/v10/channels/${finalTargetId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content: `${content}${suffix}` }),
        });

        if (!res.ok) {
          const errorDetail = await res.json().catch(() => ({ message: 'Unknown Discord Error' }));
          return NextResponse.json({ 
            error: `ステップ ${i + 1} で失敗: [ステータス ${res.status}] ${errorDetail.message || '理由不明'}` 
          }, { status: res.status });
        }

        if (i < loopCount - 1) await sleep(1000); // 1秒レートリミット対策ウェイト
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}
