/**
 * Data Compression Library
 * ストレージ用データ圧縮機能を提供
 */

/**
 * 圧縮設定
 */
export interface CompressionConfig {
  algorithm: 'lz-string' | 'pako' | 'fflate' | 'native';
  level: number; // 1-9 (1=fastest, 9=best compression)
  chunkSize: number;
  enableProgressCallback: boolean;
  fallbackToNative: boolean;
}

/**
 * 圧縮結果
 */
export interface CompressionResult {
  success: boolean;
  data?: string | Uint8Array;
  error?: string;
  originalSize: number;
  compressedSize?: number;
  compressionRatio?: number;
  algorithm: string;
  processingTime: number;
}

/**
 * 解凍結果
 */
export interface DecompressionResult {
  success: boolean;
  data?: any;
  error?: string;
  originalSize?: number;
  decompressedSize: number;
  algorithm: string;
  processingTime: number;
}

/**
 * 進捗コールバック
 */
export interface ProgressCallback {
  (progress: { processed: number; total: number; percentage: number }): void;
}

/**
 * デフォルト圧縮設定
 */
export const compressionConfig: CompressionConfig = {
  algorithm: 'native',
  level: 6,
  chunkSize: 1024 * 64, // 64KB
  enableProgressCallback: false,
  fallbackToNative: true
};

/**
 * ネイティブ圧縮（シンプルなLZ77ベース）
 */
class NativeCompressor {
  /**
   * データを圧縮する
   */
  static compress(data: string): string {
    if (!data) return data;

    const dict: { [key: string]: number } = {};
    const result: (string | number)[] = [];
    let dictIndex = 256;
    let currentSequence = '';

    for (let i = 0; i < data.length; i++) {
      const char = data[i];
      const newSequence = currentSequence + char;

      if (dict[newSequence] !== undefined) {
        currentSequence = newSequence;
      } else {
        if (currentSequence) {
          result.push(dict[currentSequence] !== undefined ? dict[currentSequence] : currentSequence);
        }
        dict[newSequence] = dictIndex++;
        currentSequence = char;
      }
    }

    if (currentSequence) {
      result.push(dict[currentSequence] !== undefined ? dict[currentSequence] : currentSequence);
    }

    return JSON.stringify(result);
  }

  /**
   * データを解凍する
   */
  static decompress(compressedData: string): string {
    try {
      const data = JSON.parse(compressedData) as (string | number)[];
      if (!Array.isArray(data)) return compressedData;

      const dict: { [key: number]: string } = {};
      let dictIndex = 256;
      let result = '';
      let previous = '';

      for (let i = 0; i < data.length; i++) {
        const entry = data[i];
        let current: string;

        if (typeof entry === 'string') {
          current = entry;
        } else if (dict[entry]) {
          current = dict[entry];
        } else if (entry === dictIndex) {
          current = previous + previous[0];
        } else {
          throw new Error('Invalid compressed data');
        }

        result += current;

        if (previous && dictIndex < 4096) { // 辞書サイズ制限
          dict[dictIndex] = previous + current[0];
          dictIndex++;
        }

        previous = current;
      }

      return result;
    } catch (error) {
      throw new Error('解凍に失敗しました: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }
}

/**
 * Base64エンコード/デコード（バイナリデータ用）
 */
class Base64Utils {
  private static readonly chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

  static encode(data: Uint8Array): string {
    let result = '';
    let i = 0;

    while (i < data.length) {
      const a = data[i++];
      const b = i < data.length ? data[i++] : 0;
      const c = i < data.length ? data[i++] : 0;

      const bitmap = (a << 16) | (b << 8) | c;

      result += this.chars[(bitmap >> 18) & 63];
      result += this.chars[(bitmap >> 12) & 63];
      result += i - 2 < data.length ? this.chars[(bitmap >> 6) & 63] : '=';
      result += i - 1 < data.length ? this.chars[bitmap & 63] : '=';
    }

    return result;
  }

  static decode(str: string): Uint8Array {
    const cleanStr = str.replace(/[^A-Za-z0-9+/]/g, '');
    const length = cleanStr.length;
    const result = new Uint8Array(Math.floor(length * 3 / 4));
    let i = 0, j = 0;

    while (i < length) {
      const encoded1 = this.chars.indexOf(cleanStr[i++]);
      const encoded2 = this.chars.indexOf(cleanStr[i++]);
      const encoded3 = this.chars.indexOf(cleanStr[i++]);
      const encoded4 = this.chars.indexOf(cleanStr[i++]);

      const bitmap = (encoded1 << 18) | (encoded2 << 12) | (encoded3 << 6) | encoded4;

      result[j++] = (bitmap >> 16) & 255;
      if (encoded3 !== 64) result[j++] = (bitmap >> 8) & 255;
      if (encoded4 !== 64) result[j++] = bitmap & 255;
    }

    return result.slice(0, j);
  }
}

/**
 * CompressionStream APIを使用した圧縮（対応ブラウザのみ）
 */
class StreamCompressor {
  /**
   * データを圧縮する
   */
  static async compress(data: string): Promise<string> {
    if (!('CompressionStream' in window)) {
      throw new Error('CompressionStream is not supported');
    }

    try {
      const stream = new CompressionStream('gzip');
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();

      const encoder = new TextEncoder();
      const inputData = encoder.encode(data);

      writer.write(inputData);
      writer.close();

      const chunks: Uint8Array[] = [];
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          chunks.push(value);
        }
      }

      // チャンクを結合
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }

      return Base64Utils.encode(result);
    } catch (error) {
      throw new Error('Stream compression failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * データを解凍する
   */
  static async decompress(compressedData: string): Promise<string> {
    if (!('DecompressionStream' in window)) {
      throw new Error('DecompressionStream is not supported');
    }

    try {
      const binaryData = Base64Utils.decode(compressedData);
      const stream = new DecompressionStream('gzip');
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();

      writer.write(binaryData);
      writer.close();

      const chunks: Uint8Array[] = [];
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          chunks.push(value);
        }
      }

      // チャンクを結合
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }

      const decoder = new TextDecoder();
      return decoder.decode(result);
    } catch (error) {
      throw new Error('Stream decompression failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }
}

/**
 * データを圧縮する
 */
export async function compressData(
  data: any,
  config: Partial<CompressionConfig> = {},
  progressCallback?: ProgressCallback
): Promise<CompressionResult> {
  const startTime = performance.now();
  const finalConfig = { ...compressionConfig, ...config };

  try {
    // データを文字列に変換
    const jsonString = typeof data === 'string' ? data : JSON.stringify(data);
    const originalSize = jsonString.length;

    if (progressCallback && finalConfig.enableProgressCallback) {
      progressCallback({ processed: 0, total: 100, percentage: 0 });
    }

    let compressedData: string;
    let algorithm = finalConfig.algorithm;

    try {
      // 各アルゴリズムを試行
      switch (finalConfig.algorithm) {
        case 'native':
          compressedData = NativeCompressor.compress(jsonString);
          break;

        case 'lz-string':
        case 'pako':
        case 'fflate':
          // 外部ライブラリが利用可能な場合の処理
          // 現在は未実装のためネイティブにフォールバック
          if (finalConfig.fallbackToNative) {
            compressedData = NativeCompressor.compress(jsonString);
            algorithm = 'native';
          } else {
            throw new Error(`Algorithm ${finalConfig.algorithm} is not available`);
          }
          break;

        default:
          // CompressionStream APIを試行
          if ('CompressionStream' in window) {
            compressedData = await StreamCompressor.compress(jsonString);
            algorithm = 'stream';
          } else if (finalConfig.fallbackToNative) {
            compressedData = NativeCompressor.compress(jsonString);
            algorithm = 'native';
          } else {
            throw new Error('No compression method available');
          }
          break;
      }
    } catch (error) {
      // フォールバック処理
      if (finalConfig.fallbackToNative && finalConfig.algorithm !== 'native') {
        compressedData = NativeCompressor.compress(jsonString);
        algorithm = 'native';
      } else {
        throw error;
      }
    }

    if (progressCallback && finalConfig.enableProgressCallback) {
      progressCallback({ processed: 100, total: 100, percentage: 100 });
    }

    const compressedSize = compressedData.length;
    const compressionRatio = originalSize > 0 ? (originalSize - compressedSize) / originalSize : 0;
    const processingTime = performance.now() - startTime;

    return {
      success: true,
      data: compressedData,
      originalSize,
      compressedSize,
      compressionRatio,
      algorithm,
      processingTime
    };

  } catch (error) {
    const processingTime = performance.now() - startTime;
    return {
      success: false,
      error: error instanceof Error ? error.message : '圧縮中にエラーが発生しました',
      originalSize: typeof data === 'string' ? data.length : JSON.stringify(data).length,
      algorithm: finalConfig.algorithm,
      processingTime
    };
  }
}

/**
 * データを解凍する
 */
export async function decompressData(
  compressedData: string,
  config: Partial<CompressionConfig> = {},
  progressCallback?: ProgressCallback
): Promise<DecompressionResult> {
  const startTime = performance.now();
  const finalConfig = { ...compressionConfig, ...config };

  try {
    if (!compressedData) {
      throw new Error('圧縮データが空です');
    }

    if (progressCallback && finalConfig.enableProgressCallback) {
      progressCallback({ processed: 0, total: 100, percentage: 0 });
    }

    let decompressedData: string;
    let algorithm = finalConfig.algorithm;

    // 圧縮時のアルゴリズムを推測（メタデータがない場合）
    const isStreamFormat = compressedData.length > 0 && compressedData.includes('=') &&
                          compressedData.match(/^[A-Za-z0-9+/]+=*$/);

    try {
      if (isStreamFormat && 'DecompressionStream' in window) {
        // Stream形式として解凍を試行
        decompressedData = await StreamCompressor.decompress(compressedData);
        algorithm = 'stream';
      } else {
        // Native形式として解凍を試行
        decompressedData = NativeCompressor.decompress(compressedData);
        algorithm = 'native';
      }
    } catch (error) {
      // 別の方法を試行
      if (isStreamFormat && 'DecompressionStream' in window) {
        decompressedData = NativeCompressor.decompress(compressedData);
        algorithm = 'native';
      } else if ('DecompressionStream' in window) {
        decompressedData = await StreamCompressor.decompress(compressedData);
        algorithm = 'stream';
      } else {
        throw error;
      }
    }

    if (progressCallback && finalConfig.enableProgressCallback) {
      progressCallback({ processed: 50, total: 100, percentage: 50 });
    }

    // JSONパースを試行
    let parsedData: any;
    try {
      parsedData = JSON.parse(decompressedData);
    } catch {
      // JSONでない場合はそのまま返す
      parsedData = decompressedData;
    }

    if (progressCallback && finalConfig.enableProgressCallback) {
      progressCallback({ processed: 100, total: 100, percentage: 100 });
    }

    const decompressedSize = decompressedData.length;
    const processingTime = performance.now() - startTime;

    return {
      success: true,
      data: parsedData,
      originalSize: compressedData.length,
      decompressedSize,
      algorithm,
      processingTime
    };

  } catch (error) {
    const processingTime = performance.now() - startTime;
    return {
      success: false,
      error: error instanceof Error ? error.message : '解凍中にエラーが発生しました',
      decompressedSize: 0,
      algorithm: finalConfig.algorithm,
      processingTime
    };
  }
}

/**
 * 圧縮比率を計算する
 */
export function calculateCompressionRatio(originalSize: number, compressedSize: number): number {
  if (originalSize === 0) return 0;
  return (originalSize - compressedSize) / originalSize;
}

/**
 * 圧縮が有効かどうかを判定する
 */
export function isCompressionBeneficial(originalSize: number, compressedSize: number): boolean {
  const ratio = calculateCompressionRatio(originalSize, compressedSize);
  return ratio > 0.1; // 10%以上の圧縮率があれば有効
}

/**
 * データサイズを人間が読みやすい形式に変換する
 */
export function formatDataSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
}

/**
 * 圧縮アルゴリズムの性能をテストする
 */
export async function benchmarkCompression(
  testData: any,
  algorithms: CompressionConfig['algorithm'][] = ['native']
): Promise<{
  algorithm: string;
  compressionRatio: number;
  compressionTime: number;
  decompressionTime: number;
  totalTime: number;
}[]> {
  const results: any[] = [];

  for (const algorithm of algorithms) {
    try {
      // 圧縮テスト
      const compressionResult = await compressData(testData, { algorithm });

      if (!compressionResult.success || !compressionResult.data) {
        continue;
      }

      // 解凍テスト
      const decompressionResult = await decompressData(compressionResult.data, { algorithm });

      if (decompressionResult.success) {
        results.push({
          algorithm: compressionResult.algorithm,
          compressionRatio: compressionResult.compressionRatio || 0,
          compressionTime: compressionResult.processingTime,
          decompressionTime: decompressionResult.processingTime,
          totalTime: compressionResult.processingTime + decompressionResult.processingTime
        });
      }
    } catch (error) {
      console.warn(`Algorithm ${algorithm} failed:`, error);
    }
  }

  return results.sort((a, b) => b.compressionRatio - a.compressionRatio);
}

/**
 * ブラウザの圧縮サポート状況を確認する
 */
export function getCompressionSupport(): {
  native: boolean;
  stream: boolean;
  workers: boolean;
} {
  return {
    native: true, // 常に利用可能
    stream: 'CompressionStream' in window && 'DecompressionStream' in window,
    workers: 'Worker' in window
  };
}

/**
 * 推奨される圧縮設定を取得する
 */
export function getRecommendedConfig(dataSize: number): CompressionConfig {
  const support = getCompressionSupport();

  // データサイズに基づいて設定を調整
  if (dataSize < 1024) {
    // 1KB未満：圧縮しない
    return {
      ...compressionConfig,
      algorithm: 'native',
      level: 1
    };
  } else if (dataSize < 1024 * 100 && support.stream) {
    // 100KB未満：Stream API使用
    return {
      ...compressionConfig,
      algorithm: 'native', // Stream APIは現在実験的
      level: 6
    };
  } else {
    // 大きなデータ：最適な圧縮
    return {
      ...compressionConfig,
      algorithm: support.stream ? 'native' : 'native',
      level: 9
    };
  }
}

/**
 * 圧縮統計情報を作成する
 */
export function createCompressionStats(results: CompressionResult[]): {
  totalOriginalSize: number;
  totalCompressedSize: number;
  averageRatio: number;
  bestRatio: number;
  worstRatio: number;
  totalProcessingTime: number;
} {
  if (results.length === 0) {
    return {
      totalOriginalSize: 0,
      totalCompressedSize: 0,
      averageRatio: 0,
      bestRatio: 0,
      worstRatio: 0,
      totalProcessingTime: 0
    };
  }

  const successfulResults = results.filter(r => r.success && r.compressionRatio !== undefined);

  const totalOriginalSize = successfulResults.reduce((sum, r) => sum + r.originalSize, 0);
  const totalCompressedSize = successfulResults.reduce((sum, r) => sum + (r.compressedSize || 0), 0);
  const ratios = successfulResults.map(r => r.compressionRatio || 0);
  const averageRatio = ratios.length > 0 ? ratios.reduce((sum, r) => sum + r, 0) / ratios.length : 0;
  const bestRatio = ratios.length > 0 ? Math.max(...ratios) : 0;
  const worstRatio = ratios.length > 0 ? Math.min(...ratios) : 0;
  const totalProcessingTime = results.reduce((sum, r) => sum + r.processingTime, 0);

  return {
    totalOriginalSize,
    totalCompressedSize,
    averageRatio,
    bestRatio,
    worstRatio,
    totalProcessingTime
  };
}