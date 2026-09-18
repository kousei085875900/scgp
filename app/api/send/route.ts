// 4. 招待リンクからのサーバー参加
    if (action === 'joinGuild') {
      const { inviteCode } = body;
      if (!inviteCode) {
        return NextResponse.json({ error: '招待コードが指定されていません。' }, { status: 400 });
      }

      // より確実にコードだけを抽出（前後の空白除去、URLパース）
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
            // Discordからの詳細なエラーJSONを取得する
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
