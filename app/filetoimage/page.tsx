'use client';

import React, { useState, useRef } from 'react';
import JSZip from 'jszip';

export default function BinaryImageConverter() {
  const [width, setWidth] = useState(640);
  const [height, setHeight] = useState(360);
  const [colorMode, setColorMode] = useState<'16' | '256' | '1677'>('1677');
  
  const [encodeFile, setEncodeFile] = useState<File | null>(null);
  const [isEncoding, setIsEncoding] = useState(false);
  const [encodeProgress, setEncodeProgress] = useState('');

  const [decodeFiles, setDecodeFiles] = useState<File[] | null>(null);
  const [isDecoding, setIsDecoding] = useState(false);
  const [decodeProgress, setDecodeProgress] = useState('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const encodeInputRef = useRef<HTMLInputElement | null>(null);
  const decodeInputRef = useRef<HTMLInputElement | null>(null);

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

  const handleEncode = async () => {
    if (!encodeFile) return;
    setIsEncoding(true);
    setEncodeProgress('ファイルを読み込み中...');

    try {
      const arrayBuffer = await encodeFile.arrayBuffer();
      const rawBytes = new Uint8Array(arrayBuffer);

      const encoder = new TextEncoder();
      const nameBytes = encoder.encode(encodeFile.name);
      
      let modeCode = 24;
      if (colorMode === '16') modeCode = 16;
      else if (colorMode === '256') modeCode = 25;
      else if (colorMode === '1677') modeCode = 24;

      const headerSize = 2 + 1 + 4 + nameBytes.length + 8;
      const totalDataSize = headerSize + rawBytes.length;
      
      const fullData = new Uint8Array(totalDataSize);
      const dataView = new DataView(fullData.buffer);

      fullData[0] = 0x42; // 'B'
      fullData[1] = 0x49; // 'I'
      fullData[2] = modeCode;
      dataView.setUint32(3, nameBytes.length, false);
      fullData.set(nameBytes, 7);
      dataView.setFloat64(7 + nameBytes.length, rawBytes.length, false);
      fullData.set(rawBytes, headerSize);

      const pixelsPerFrame = width * height;
      let bytesPerFrame = 0;
      if (colorMode === '16') {
        bytesPerFrame = Math.floor(pixelsPerFrame * 4 / 8);
      } else if (colorMode === '256') {
        bytesPerFrame = pixelsPerFrame * 1;
      } else if (colorMode === '1677') {
        bytesPerFrame = pixelsPerFrame * 3;
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
        } else
