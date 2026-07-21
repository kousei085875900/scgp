
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Link from 'next/link'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Expancoov Project Portal',
  description: 'SCGP Portal Site',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className={`${inter.className} min-h-screen bg-white flex flex-col`}>
        
        {/* ヘッダー・ナビゲーション */}
        <nav className="border-b border-gray-100 bg-red-600 backdrop-blur sticky top-0 z-50 w-full h-16">
          <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
            <Link href="/" className="text-yellow-300 font-black tracking-widest uppercase">
              Expancoov <span className="text-yellow-300">group SCGP ☭</span>
            </Link>
            <div className="h-full py-2 flex items-center gap-4">
              <a href="https://discord.gg/2W9gNv8ep9" target="_blank" rel="noopener noreferrer" className="h-full aspect-[2.5/1] flex items-center justify-center transition-transform duration-300 hover:scale-110 focus:outline-none">
                <img src="/dlogo.png" alt="Discord" className="h-full w-full object-contain p-1 transition-opacity duration-300 hover:opacity-80" />
              </a>
              <a href="https://github.com/kousei0413/scgp" target="_blank" rel="noopener noreferrer" className="h-full aspect-[2.5/1] flex items-center justify-center transition-transform duration-300 hover:scale-110 focus:outline-none ml-3">
                <img src="/glogo.png" alt="github" className="h-full w-full object-contain p-1 transition-opacity duration-300 hover:opacity-80" />
              </a>
            </div>
          </div>
        </nav>

        {/* メインレイアウト（サイドバー ＋ コンテンツ） */}
        <div className="flex flex-1 w-full">
          
          {/* サイドバー */}
          <aside className="w-40 bg-red-600 text-yellow-200 p-4 flex flex-col gap-2 border-r border-yellow-200 min-h-[calc(100vh-4rem)]">
            <div className="text-xs font-bold text-red-300 uppercase tracking-wider mb-2">test</div>
            <Link href="/DevelopmentProgress" className="p-2 rounded hover:bg-red-500 transition text-sm">DevelopmentProgress</Link>
            <Link href="/test" className="p-2 rounded hover:bg-red-500 transition text-sm">test</Link>
            
            <div className="text-xs font-bold text-red-300 uppercase tracking-wider mb-2">tools</div>
            <Link href="/deptest" className="p-2 rounded hover:bg-red-500 transition text-sm">InMemory deployment tool</Link>
            <Link href="/dcbotmanager" className="p-2 rounded hover:bg-red-500 transition text-sm">discord bot manager</Link>
          </aside>

          {/* 各ページのコンテンツが展開される場所 */}
          <main className="flex-1 flex flex-col justify-center px-6 max-w-4xl w-full mx-auto py-12">
            {children}
          </main>
        </div>
        
      </body>
    </html>
  )
}
