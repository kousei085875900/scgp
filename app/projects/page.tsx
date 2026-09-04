import Link from 'next/link';

export default function Home() {
  return (
    <main className="p-8">


     
      <h1 className="text-2xl font-bold mb-4">
        scratch projects
      </h1>
     
      <Link href="/allport" className="text-blue-500 hover:underline">
        AllPort project
      </Link>
      
      
         
      
      　<a href="https://キチガイ.com" target="_blank" rel="noopener noreferrer"className="text-blue-500 hover:underline">
  　　　　どっかに行くボタン
　　　　</a>
      
    </main>
  );
}
