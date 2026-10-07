'use client';

import React, { useState, useRef } from 'react';
import JSZip from 'jszip';

export default function BinaryImageConverter() {
  // 設定ステート
  const [width, setWidth] = useState(640);
  const [height, setHeight] = useState(360);
  
  // エンコード用ステート
  const [encodeFile, setEncodeFile] = useState<File | null>(null);
  const [isEncoding, setIsEncoding] = useState(false);
  const [encodeProgress, setEncodeProgress] = useState('');

  // デコード用ステート
  const [decodeFiles, setDecodeFiles] = useState<FileList | null>(null);
  const [isDecoding, setIsDecoding] = useState(false);
  const [decodeProgress, setDecodeProgress] = useState('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 4色の定義 (黒, 赤, 緑, 青)
  const COLOR_MAP = [
    [0, 0, 0],       // 00: 黒
    [255, 0, 0],     // 01: 赤
    [0, 255, 0],     // 10: 緑
    [0, 0, 255]      // 11: 青
  ];

  // 色から2ビットへの逆変換 (ユークリッド距離が一番近いものを探す)
  const getClosestColorIndex = (r: number, g: number, b: number): number => {
    let minDist = Infinity;
    let bestIndex = 0;
    for (let i = 0; i < COLOR_MAP.length; i++) {
      const [cr, cg, cb] = COLOR_MAP[i];
      const dist = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
      if (dist < minDist) {
        minDist = dist;
        bestIndex = i;
      }
    }
    return bestIndex;
  };

  // ---------------------------------------------------------------------------
  // エンコード処理 (ファイル -> ZIP化された連番画像)
  // ---------------------------------------------------------------------------
  const handleEncode = async () => {
    if (!encodeFile) return;
    setIsEncoding(true);
    setEncodeProgress('ファイルを読み込み中...');

    try {
      const arrayBuffer = await encodeFile.arrayBuffer();
      const rawBytes = new Uint8Array(arrayBuffer);

      // メタデータヘッダーの作成
      const encoder = new TextEncoder();
      const nameBytes = encoder.encode(encodeFile.name);
      
      const headerSize = 4 + nameBytes.length + 8;
      const totalDataSize = headerSize + rawBytes.length;
      
      const fullData = new Uint8Array(totalDataSize);
      const dataView = new DataView(fullData.buffer);
      
      // 名前長を書き込み
      dataView.setUint32(0, nameBytes.length, false);
      // ファイル名を書き込み
      fullData.set(nameBytes, 4);
      // 実データサイズを書き込み
      dataView.setFloat64(4 + nameBytes.length, rawBytes.length, false);
      // 実データを書き込み
      fullData.set(rawBytes, headerSize);

      // 1フレームあたりの容量計算 (2ビット = 0.25バイト / ピクセル)
      const pixelsPerFrame = width * height;
      const bytesPerFrame = Math.floor(pixelsPerFrame * 2 / 8);

      const totalFrames = Math.ceil(fullData.length / bytesPerFrame);
      setEncodeProgress(`全 ${totalFrames} フレームを生成中...`);

      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const imgData = ctx.createImageData(width, height);

      const zip = new JSZip();

      for (let f = 0; f < totalFrames; f++) {
        const startIdx = f * bytesPerFrame;
        const endIdx = Math.min(startIdx + bytesPerFrame, fullData.length);
        const frameChunk = fullData.slice(startIdx, endIdx);

        let pixelIndex = 0;
        for (let i = 0; i < frameChunk.length; i++) {
          const byte = frameChunk[i];
          const b3 = (byte >> 6) & 0x03;
          const b2 = (byte >> 4) & 0x03;
          const b1 = (byte >> 2) & 0x03;
          const b0 = byte & 0x03;

          const bits = [b3, b2, b1, b0];
          for (const bit of bits) {
            const [r, g, b] = COLOR_MAP[bit];
            imgData.data[pixelIndex * 4 + 0] = r;
            imgData.data[pixelIndex * 4 + 1] = g;
            imgData.data[pixelIndex * 4 + 2] = b;
            imgData.data[pixelIndex * 4 + 3] = 255;
            pixelIndex++;
          }
        }

        // 余ったピクセルは黒でパディング
        for (let p = pixelIndex; p < pixelsPerFrame; p++) {
          imgData.data[p * 4 + 0] = 0;
          imgData.data[p * 4 + 1] = 0;
          imgData.data[p * 4 + 2] = 0;
          imgData.data[p * 4 + 3] = 255;
        }

        ctx.putImageData(imgData, 0, 0);

        // Blobに変換してZIPに追加
        const frameNumStr = String(f + 1).padStart(4, '0');
        const filename = `frame_${frameNumStr}.png`;
        
        const blob: Blob | null = await new Promise((resolve) => {
          canvas.toBlob((b) => resolve(b), 'image/png');
        });

        if (blob) {
          zip.file(filename, blob);
        }
        setEncodeProgress(`フレーム描画中... (${f + 1} / ${totalFrames})`);
      }

      setEncodeProgress('ZIPファイルを圧縮・生成中...');
      const zipBlob = await zip.generateAsync({ type: 'blob' });

      // ZIPファイルをダウンロード
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${encodeFile.name}_frames.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setEncodeProgress('エンコード完了！ZIPファイルをダウンロードしました。');
    } catch (e) {
      console.error(e);
      setEncodeProgress('エラーが発生しました。コンソールを確認してください。');
    } finally {
      setIsEncoding(false);
    }
  };

  // ---------------------------------------------------------------------------
  // デコード処理 (連番PNG群 -> 元ファイル)
  // ---------------------------------------------------------------------------
  const handleDecode = async () => {
    if (!decodeFiles || decodeFiles.length === 0) return;
    setIsDecoding(true);
    setDecodeProgress('ファイルを並べ替えて読み込み中...');

    try {
      const sortedFiles = Array.from(decodeFiles).sort((a, b) => 
        a.name.localeCompare(b.name, undefined, { numeric: true })
      );

      const allBytesChunks: number[] = [];

      for (let i = 0; i < sortedFiles.length; i++) {
        setDecodeProgress(`フレーム読み込み中... (${i + 1} / ${sortedFiles.length})`);
        const file = sortedFiles[i];
        
        const bitmap = await createImageBitmap(file);
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        ctx.drawImage(bitmap, 0, 0);
        
        const imgData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
        const pixels = imgData.data;

        const frameBytes: number[] = [];
        for (let p = 0; p < pixels.length; p += 4) {
          const r = pixels[p];
          const g = pixels[p + 1];
          const b = pixels[p + 2];
          
          const bitIndex = getClosestColorIndex(r, g, b);
          frameBytes.push(bitIndex);

          if (frameBytes.length === 4) {
            const byte = (frameBytes[0] << 6) | (frameBytes[1] << 4) | (frameBytes[2] << 2) | frameBytes[3];
            allBytesChunks.push(byte);
            frameBytes.length = 0;
          }
        }
      }

      const fullData = new Uint8Array(allBytesChunks);
      const dataView = new DataView(fullData.buffer);

      const nameLength = dataView.getUint32(0, false);
      const decoder = new TextDecoder();
      const originalFileName = decoder.decode(fullData.slice(4, 4 + nameLength));
      const originalFileSize = dataView.getFloat64(4 + nameLength, false);

      const headerSize = 4 + nameLength + 8;
      const originalData = fullData.slice(headerSize, headerSize + originalFileSize);

      const blob = new Blob([originalData]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = originalFileName || 'restored_file';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setDecodeProgress(`復元成功: ${originalFileName} (${originalFileSize} バイト)`);
    } catch (e) {
      console.error(e);
      setDecodeProgress('デコード中にエラーが発生しました。ファイルや解像度設定を確認してください。');
    } finally {
      setIsDecoding(false);
    }
  };

  return (
    <main className="p-6 max-w-2xl mx-auto font-sans">
      <h1 className="text-2xl font-bold mb-4">バイナリ-連番画像（ZIP）変換ツール</h1>
      
      {/* 解像度設定エリア */}
      <div className="mb-6 p-4 border rounded bg-gray-50">
        <h2 className="font-semibold mb-2">画像のピクセルサイズ設定</h2>
        <div className="flex gap-4 items-center">
          <label>
            横幅 (Width):
            <input 
              type="number" 
              value={width} 
              onChange={(e) => setWidth(Number(e.target.value))} 
              className="ml-2 p-1 border rounded w-24"
              step="2"
            />
          </label>
          <label>
            縦幅 (Height):
            <input 
              type="number" 
              value={height} 
              onChange={(e) => setHeight(Number(e.target.value))} 
              className="ml-2 p-1 border rounded w-24"
              step="2"
            />
          </label>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          1フレームあたりの容量目安: 約 {Math.floor((width * height * 2) / 8)} バイト
        </p>
      </div>

      {/* エンコードセクション */}
      <div className="mb-8 p-4 border rounded shadow-sm">
        <h2 className="text-xl font-semibold mb-2">1. エンコード (ファイル $\rightarrow$ ZIP化された連番画像)</h2>
        <input 
          type="file" 
          onChange={(e) => setEncodeFile(e.target.files ? e.target.files[0] : null)} 
          className="mb-3 block"
        />
        <button 
          onClick={handleEncode} 
          disabled={!encodeFile || isEncoding}
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:bg-gray-400"
        >
          {isEncoding ? '処理中...' : 'ZIPで画像を生成してダウンロード'}
        </button>
        {encodeProgress && <p className="mt-2 text-sm text-blue-700">{encodeProgress}</p>}
      </div>

      {/* デコードセクション */}
      <div className="p-4 border rounded shadow-sm">
        <h2 className="text-xl font-semibold mb-2">2. デコード (連番画像群 $\rightarrow$ 元ファイル)</h2>
        <p className="text-xs text-gray-500 mb-2">※ZIPから解凍した連番画像群を選択してアップロードしてください</p>
        <input 
          type="file" 
          multiple 
          onChange={(e) => setDecodeFiles(e.target.files)} 
          className="mb-3 block"
        />
        <button 
          onClick={handleDecode} 
          disabled={!decodeFiles || decodeFiles.length === 0 || isDecoding}
          className="bg-green-600 text-white px-4 py-2 rounded disabled:bg-gray-400"
        >
          {isDecoding ? 'デコード中...' : '画像を結合してファイルを復元'}
        </button>
        {decodeProgress && <p className="mt-2 text-sm text-green-700">{decodeProgress}</p>}
      </div>

      {/* 隠しCanvas */}
      <canvas ref={canvasRef} className="hidden" />
    </main>
  );
}
