export default function Home() {
  return (
    <main className="p-8">
{/*【注意！！！！！】文字を表示させるとき最初にh1やらpなどが書かれているが
h1はサイトバーに表示させる見出しみたいなもので、一つのスクリプト上で一回しか使えない。
pは、まぁ、普通のテキストですね
他にもdivがあるがこれは初期スタイルを上書きし、指定された動作以外はしない*/}

      {/*見出し↓-------------------------------------------*/}
      <h1 className="text-2xl font-bold mb-4">
        レイシスト迫害隊
      </h1>
      {/*--------------------------------------------------*/}
      
      {/*その他のテキスト↓-----------------------------------*/}
      <p className="text-gray-600">
        レイシストはあかん
      </p>
      {/*----------------------------------------------------*/}

 <aside className="w-40 bg-red-600 text-yellow-200 p-4 flex flex-col gap-2 border-r border-yellow-200 min-h-[calc(100vh-4rem)]">
            <div className="text-xs font-bold text-red-300 uppercase tracking-wider mb-2">test</div>
            <Link href="/DevelopmentProgress" className="p-2 rounded hover:bg-red-500 transition text-sm">DevelopmentProgress</Link>
            <Link href="/test" className="p-2 rounded hover:bg-red-500 transition text-sm">test</Link>
            
            <div className="text-xs font-bold text-red-300 uppercase tracking-wider mb-2">tools</div>
            <Link href="/deptest" className="p-2 rounded hover:bg-red-500 transition text-sm">InMemory deployment tool</Link>
            <Link href="/dcbotmanager" className="p-2 rounded hover:bg-red-500 transition text-sm">discord bot manager</Link>
          </aside>

      
    </main>
  );
}
