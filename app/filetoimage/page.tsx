'use client';

import React, { useState, useRef } from 'react';
import JSZip from 'jszip';

export default function BinaryImageConverter() {
  // 設定ステート
  const [width, setWidth] = useState(640);
  const [height, setHeight] = useState(360);
  const [colorMode, setColorMode] = useState<'16' | '256' | '1677'>('1677');
  
  // エンコード用ステート
  const [encodeFile, setEncodeFile] = useState<File | null>(null);
  const [isEncoding, setIsEncoding] = useState(false);
  const [encodeProgress, setEncodeProgress] = useState('');

  // デコード用ステート
  const [decodeFiles, setDecodeFiles] = useState<File[] | null>(null);
  const [isDecoding, setIsDecoding] = useState(false);
  const [decodeProgress, setDecodeProgress] = useState('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const encodeInputRef = useRef<HTMLInputElement | null>(null);
  const decodeInputRef = useRef<HTMLInputElement | null>(null);

  // 16色の定義 (4bit/pixel 用)
  const COLOR_PALETTE_16 = [
    [0, 0, 0],       [0, 0, 170],     [0, 170, 0],     [0, 170, 170],
    [170, 0, 0],     [170, 0, 170],   [170, 85, 0],    [170, 170, 170],
    [85, 85, 85],    [85, 85, 255],   [85, 255, 85],   [85, 255, 255],
    [255, 85, 85],   [255, 85, 255],  [255, 255, 85],  [255, 255, 255]
  ];

  const getClosestColorIndex16 = (r: number, g: number, b: number): number => {
    let minDist = Infinity;
    let bestIndex = 0;
    for (let i = 0; i < COLOR_PALETTE_16.length; i++) {
      const [cr, cg, cb] = COLOR_PALETTE_16[i];
      const dist = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
      if (dist < minDist) {
        minDist = dist;
        bestIndex = i;
      }
    }
    return bestIndex;
  };

  // ---------------------------------------------------------------------------
  // エンコード処理
  // ---------------------------------------------------------------------------
  const handleEncode = async () => {
    if (!encodeFile) return;
    setIsEncoding(true);
    setEncodeProgress('ファイルを読み込み中...');

    try {
      const arrayBuffer = await encodeFile.arrayBuffer();
      const rawBytes = new Uint8Array(arrayBuffer);

      // メタデータヘッダーの構築
      // 構造: [マジック: 'BI' (2Bytes)] + [モード: 16|25,jis-num? -> 1Byte(16, 25, 24)] + [ファイル名長(4Bytes)] + [ファイル名] + [実データサイズ(8Bytes)] + [実データ]
      const encoder = new TextEncoder();
      const nameBytes = encoder.encode(encodeFile.name);
      
      // モード番号の決定 (16: 16色, 25: 256色(安全のため25とする), 24: 1677万色)
      const modeCode = colorMode === '16' ? 16 : colorMode === '256' ? 25 : 24;

      const headerSize = 2 + 1 + 4 + nameBytes.length + 8;
      const totalDataSize = headerSize + rawBytes.length;
      
      const fullData = new Uint8Array(totalDataSize);
      const dataView = new DataView(fullData.buffer);

      // マジックナンバー 'B', 'I' (0x42, 0x49)
      fullData[0] = 0x42;
      fullData[1] = 0x49;
      // モードコード
      fullData[2] = modeCode;
      // 名前長
      dataView.setUint32(3, nameBytes.length, false);
      // ファイル名
      fullData.set(nameBytes, 7);
      // 実データサイズ
      dataView.setFloat64(7 + nameBytes.length, rawBytes.length, false);
      // 実データ
      fullData.set(rawBytes, headerSize);

      // 容量計算
      const pixelsPerFrame = width * height;
      let bytesPerFrame = 0;
      if (colorMode === '16') {
        bytesPerFrame = Math.floor(pixelsPerFrame * 4 / 8); // 1pixel = 4bit (2pixelで1byte)
      } else if (colorMode === '256') {
        bytesPerFrame = pixelsPerFrame * 1; // 1pixel = 8bit (1byte)
      } else {
        bytesPerFrame = pixelsPerFrame * 3; // 1pixel = 24bit (3bytes)
      }

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

        if (colorMode === '16') {
          for (let i = 0; i < frameChunk.length; i++) {
            const byte = frameChunk[i];
            const high = (byte >> 4) & 0x0F;
            const low = byte & 0x0F;
            const nibbles = [high, low];
            for (const n of nibbles) {
              const [r, g, b] = COLOR_PALETTE_16[n];
              imgData.data[pixelIndex * 4 + 0] = r;
              imgData.data[pixelIndex * 4 + 1] = g;
              imgData.data[pixelIndex * 4 + 2] = b;
              imgData.data[pixelIndex * 4 + 3] = 255;
              pixelIndex++;
            }
          }
        } else if (colorMode === '256') {
          for (let i = 0; i < frameChunk.length; i++) {
            const val = frameChunk[i];
            // グレイスケールやインデックスカラー表現 (簡易的にR=G=B=valとするか、WebSafe風にするが、8bitそのままRGBに割り当てる)
            imgData.data[pixelIndex * 4 + 0] = val;
            imgData.data[pixelIndex * 4 + 1] = val;
            imgData.data[pixelIndex * 4 + 2] = val;
            imgData.data[pixelIndex * 4 + 3] = 255;
            pixelIndex++;
          }
        } else {
          for (let i = 0; i < frameChunk.length; i += 3) {
            const r = frameChunk[i];
            const g = i + 1 < frameChunk.length ? frameChunk[i + 1] : 0;
            const b = i + 2 < frameChunk.length ? frameChunk[i + 2] : 0;

            imgData.data[pixelIndex * 4 + 0] = r;
            imgData.data[pixelIndex * 4 + 1] = g;
            imgData.data[pixelIndex * 4 + 2] = b;
            imgData.data[pixelIndex * 4 + 3] = 255;
            pixelIndex++;
          }
        }

        // パディング
        for (let p = pixelIndex; p < pixelsPerFrame; p++) {
          imgData.data[p * 4 + 0] = 0;
          imgData.data[p * 4 + 1] = 0;
          imgData.data[p * 4 + 2] = 0;
          imgData.data[p * 4 + 3] = 255;
        }

        ctx.putImageData(imgData, 0, 0);

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

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${encodeFile.name}_${colorMode}col_frames.zip`;
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
  // デコード処理（モード自動判別）
  // ---------------------------------------------------------------------------
  const handleDecode = async () => {
    if (!decodeFiles || decodeFiles.length === 0) return;
    setIsDecoding(true);
    setDecodeProgress('ファイルを並べ替えて読み込み中...');

    try {
      const sortedFiles = Array.from(decodeFiles).sort((a, b) => 
        a.name.localeCompare(b.name, undefined, { numeric: true })
      );

      // まず最初のフレームだけ先に読み込んで「モードフラグ」を自動判別する
      const firstBitmap = await createImageBitmap(sortedFiles[0]);
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = firstBitmap.width;
      tempCanvas.height = firstBitmap.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) throw new Error('Canvas context failed');
      tempCtx.drawImage(firstBitmap, 0, 0);
      const firstPixels = tempCtx.getImageData(0, 0, firstBitmap.width, firstBitmap.height).data;

      // ヘッダー先頭部分を暫定復元してモードを特定する
      // 最初の数ピクセルからマジックナンバーとモードコードを読み出す
      const probeBytes: number[] = [];
      // 16bit(2) + 1bit(1) + 4bit(4) = 最低7バイト分の生データを取るため、全モード共通のフルカラーまたは256色ベースで最初の数ピクセルを仮抽出
      for (let p = 0; p < 10; p++) {
        probeBytes.push(firstPixels[p * 4 + 0]);
        probeBytes.push(firstPixels[p * 4 + 1]);
        probeBytes.push(firstPixels[p * 4 + 2]);
      }

      if (probeBytes[0] !== 0x42 || probeBytes[1] !== 0x49) {
        throw new Error('無効なファイル形式です（マジックナンバーが一致しません）。このツールで生成された画像ではありません。');
      }

      const detectedModeCode = probeBytes[2];
      let activeMode: '16' | '256' | '1677' = '1677';
      if (detectedModeCode === 16) activeMode = '16';
      else if (detectedModeCode === 25) activeMode = '256';
      else activeMode = '1677';

      setDecodeProgress(`自動判別成功: ${activeMode === '16' ? '16色' : activeMode === '256' ? '256色' : '1677万色'} モード。全体をデコード中...`);

      const allBytesChunks: number[] = [];

      for (let i = 0; i < sortedFiles.length; i++) {
        setDecodeProgress(`フレーム読み込み中 (${activeMode}mode)... (${i + 1} / ${sortedFiles.length})`);
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

        if (activeMode === '16') {
          const frameNibbles: number[] = [];
          for (let p = 0; p < pixels.length; p += 4) {
            const r = pixels[p];
            const g = pixels[p + 1];
            const b = pixels[p + 2];
            const nIndex = getClosestColorIndex16(r, g, b);
            frameNibbles.push(nIndex);

            if (frameNibbles.length === 2) {
              const byte = (frameNibbles[0] << 4) | frameNibbles[1];
              allBytesChunks.push(byte);
              frameNibbles.length = 0;
            }
          }
        } else if (activeMode === '256') {
          for (let p = 0; p < pixels.length; p += 4) {
            // 256色モードはR成分をそのまま1バイトとして扱う
            allBytesChunks.push(pixels[p]);
          }
        } else {
          for (let p = 0; p < pixels.length; p += 4) {
            allBytesChunks.push(pixels[p]);     // R
            allBytesChunks.push(pixels[p + 1]); // G
            allBytesChunks.push(pixels[p + 2]); // B
          }
        }
      }

      const fullData = new Uint8Array(allBytesChunks);
      const dataView = new DataView(fullData.buffer);

      // ヘッダーパース (マジック2 + モード1 = 3バイトスキップ)
      const nameLength = dataView.getUint32(3, false);
      const decoder = new TextDecoder();
      const originalFileName = decoder.decode(fullData.slice(7, 7 + nameLength));
      const originalFileSize = dataView.getFloat64(7 + nameLength, false);

      const headerSize = 2 + 1 + 4 + nameLength + 8;
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

      setDecodeProgress(`復元成功: ${originalFileName} (${originalFileSize} バイト) [${activeMode}色モード]`);
    } catch (e) {
      console.error(e);
      setDecodeProgress('デコードエラー: ファイル形式が違うか、画像が破損しています。');
    } finally {
      setIsDecoding(false);
    }
  };

  return (
    <main className="p-6 max-w-2xl mx-auto font-sans">
      <h1 className="text-2xl font-bold mb-4">マルチカラー・バイナリ画像変換ツール</h1>
      
      {/* 設定エリア */}
      <div className="mb-6 p-4 border rounded bg-gray-50">
        <h2 className="font-semibold mb-2">エンコード設定</h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">カラーモード:</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-1 cursor-pointer">
              <input 
                type="radio" 
                name="colorMode" 
                value="16" 
                checked={colorMode === '16'} 
                onChange={() => setColorMode('16')} 
              />
              16色 (4bit/pixel)
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input 
                type="radio" 
                name="colorMode" 
                value="256" 
                checked={colorMode === '256'} 
                onChange={() => setColorMode('256')} 
              />
              256色 (8bit/pixel)
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input 
                type="radio" 
                name="colorMode" 
                value="1677" 
                checked={colorMode === '1677'} 
                onChange={() => setColorMode('1677')} 
              />
              1677万色 (24bit/pixel)
            </label>
          </div>
        </div>

        <div className="flex gap-4 items-center">
          <label>
            横幅 (Width):
            <input 
              type="number" 
              value={width} 
              onChange={(e) => setWidth(Number(e.target.value))} 
              className="ml-2 p-1 border rounded w-24"
              step="1"
            />
          </label>
          <label>
            縦幅 (Height):
            <input 
              type="number" 
              value={height} 
              onChange={(e) => setHeight(Number(e.target.value))} 
              className="ml-2 p-1 border rounded w-24"
              step="1"
            />
          </label>
        </div>
      </div>

      {/* エンコードセクション */}
      <div className="mb-8 p-4 border rounded shadow-sm">
        <h2 className="text-xl font-semibold mb-2">1. エンコード</h2>
        <div 
          onClick={() => encodeInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              setEncodeFile(e.dataTransfer.files[0]);
            }
          }}
          className="border-2 border-dashed border-gray-300 hover:border-blue-500 rounded-lg p-6 text-center cursor-pointer bg-white mb-3 transition"
        >
          <input 
            type="file" 
            ref={encodeInputRef}
            onChange={(e) => setEncodeFile(e.target.files ? e.target.files[0] : null)} 
            className="hidden"
          />
          {encodeFile ? (
            <p className="text-blue-600 font-semibold">選択中: {encodeFile.name}</p>
          ) : (
            <p className="text-gray-500">ファイルをドロップ、またはクリックして選択</p>
          )}
        </div>
        <button 
          onClick={handleEncode} 
          disabled={!encodeFile || isEncoding}
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:bg-gray-400"
        >
          {isEncoding ? '処理中...' : 'ZIP画像を生成してダウンロード'}
        </button>
        {encodeProgress && <p className="mt-2 text-sm text-blue-700">{encodeProgress}</p>}
      </div>

      {/* デコードセクション（自動判別） */}
      <div className="p-4 border rounded shadow-sm">
        <h2 className="text-xl font-semibold mb-2">2. デコード（モード自動判別）</h2>
        <p className="text-xs text-gray-500 mb-2">※モードを手動で選ぶ必要はありません。画像群をそのまま選択してください。</p>
        <div 
          onClick={() => decodeInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              setDecodeFiles(Array.from(e.dataTransfer.files));
            }
          }}
          className="border-2 border-dashed border-gray-300 hover:border-green-500 rounded-lg p-6 text-center cursor-pointer bg-white mb-3 transition"
        >
          <input 
            type="file" 
            multiple 
            ref={decodeInputRef}
            onChange={(e) => setDecodeFiles(e.target.files ? Array.from(e.target.files) : null)} 
            className="hidden"
          />
          {decodeFiles && decodeFiles.length > 0 ? (
            <p className="text-green-600 font-semibold">{decodeFiles.length}個のファイルを選択中</p>
          ) : (
            <p className="text-gray-500">変換された画像群をドロップ、またはクリックして選択</p>
          )}
        </div>
        <button 
          onClick={handleDecode} 
          disabled={!decodeFiles || decodeFiles.length === 0 || isDecoding}
          className="bg-green-600 text-white px-4 py-2 rounded disabled:bg-gray-400"
        >
          {isDecoding ? 'デコード中...' : '自動判別してファイルを復元'}
        </button>
        {decodeProgress && <p className="mt-2 text-sm text-green-700">{decodeProgress}</p>}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </main>
  );
}
