import Link from 'next/link';
export default function Home() {
  return ( <main className="p-8"> 
    <h1 className="text-2xl font-bold mb-4"> 
      The goal of this project is to port various games to Scratch as faithfully as possible. 
    </h1>
    
    <h1 className="text-glay-500 font-bold mb-4">
      Things currently being transplanted
    </h1> 

    <Link href="/projects/allport/fnfvsimposterse" className="text-blue-500 hover:underline">
         fnf vs imposter scratch edition bata 
      </Link>
    
  </main>
    );
  }
