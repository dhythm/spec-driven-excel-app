/**
 * Storage Manager Library
 * LocalStorageとlocalforageを使用したデータストレージ管理
 */

import localforage from 'localforage';
import { Spreadsheet } from '../spreadsheet';
import { compressionConfig, compressData, decompressData } from './compression';

/**
 * ストレージ設定
 */
export interface StorageConfig {
  driverOrder: string[];
  name: string;
  version: number;
  storeName: string;
  description: string;
  size: number;
  compression: boolean;
  encryption: boolean;
  autoSync: boolean;
  maxRetries: number;
  retryDelay: number;
}

/**
 * ストレージ操作の結果
 */
export interface StorageOperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    size: number;
    compressed: boolean;
    encrypted: boolean;
    timestamp: Date;
    version: number;
  };
}

/**
 * ストレージアイテムのメタデータ
 */
export interface StorageItemMetadata {
  id: string;
  name: string;
  type: 'spreadsheet' | 'backup' | 'temp' | 'export';
  size: number;
  compressed: boolean;
  encrypted: boolean;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  checksm?: string;
  tags?: string[];
}

/**
 * ストレージ統計情報
 */
export interface StorageStatistics {
  totalItems: number;
  totalSize: number;
  availableSpace: number;
  compressionRatio: number;
  itemsByType: {
    spreadsheet: number;
    backup: number;
    temp: number;
    export: number;
  };
  oldestItem?: StorageItemMetadata;
  newestItem?: StorageItemMetadata;
  largestItem?: StorageItemMetadata;
}

/**
 * バックアップ設定
 */
export interface BackupConfig {
  enabled: boolean;
  maxBackups: number;
  intervalMinutes: number;
  compression: boolean;
  retentionDays: number;
  includeMetadata: boolean;
}

/**
 * 同期設定
 */
export interface SyncConfig {
  enabled: boolean;
  endpoint?: string;
  interval: number;
  conflictResolution: 'client' | 'server' | 'manual';
  retryLimit: number;
  compression: boolean;
}

/**
 * Storage Manager クラス
 */
export class StorageManager {
  private config: StorageConfig;
  private storage: LocalForage;
  private metadataStorage: LocalForage;
  private backupConfig: BackupConfig;
  private syncConfig: SyncConfig;
  private backupTimer?: number;

  constructor(config: Partial<StorageConfig> = {}) {
    this.config = {
      driverOrder: [localforage.INDEXEDDB, localforage.WEBSQL, localforage.LOCALSTORAGE],
      name: 'SpreadsheetApp',
      version: 1.0,
      storeName: 'spreadsheets',
      description: 'Spreadsheet Application Data Storage',
      size: 4980736, // 5MB
      compression: true,
      encryption: false,
      autoSync: false,
      maxRetries: 3,
      retryDelay: 1000,
      ...config
    };

    this.backupConfig = {
      enabled: true,
      maxBackups: 10,
      intervalMinutes: 30,
      compression: true,
      retentionDays: 7,
      includeMetadata: true
    };

    this.syncConfig = {
      enabled: false,
      interval: 300000, // 5分
      conflictResolution: 'client',
      retryLimit: 3,
      compression: true
    };

    // メインストレージの設定
    this.storage = localforage.createInstance({
      driver: this.config.driverOrder,
      name: this.config.name,
      version: this.config.version,
      storeName: this.config.storeName,
      description: this.config.description,
      size: this.config.size
    });

    // メタデータストレージの設定
    this.metadataStorage = localforage.createInstance({
      driver: this.config.driverOrder,
      name: this.config.name,
      version: this.config.version,
      storeName: 'metadata',
      description: 'Storage Metadata',
      size: this.config.size
    });

    this.initializeStorage();
  }

  /**
   * ストレージを初期化する
   */
  private async initializeStorage(): Promise<void> {
    try {
      await this.storage.ready();
      await this.metadataStorage.ready();

      if (this.backupConfig.enabled) {
        this.startAutoBackup();
      }

      if (this.syncConfig.enabled) {
        this.startAutoSync();
      }
    } catch (error) {
      console.error('ストレージの初期化に失敗:', error);
    }
  }

  /**
   * スプレッドシートを保存する
   */
  async saveSpreadsheet(
    id: string,
    spreadsheet: Spreadsheet,
    metadata?: Partial<StorageItemMetadata>
  ): Promise<StorageOperationResult<boolean>> {
    try {
      const startTime = performance.now();

      // データを準備
      let dataToStore: any = {
        ...spreadsheet,
        cells: Array.from(spreadsheet.cells.entries()) // Mapを配列に変換
      };

      let compressed = false;
      let size = JSON.stringify(dataToStore).length;

      // 圧縮処理
      if (this.config.compression) {
        const compressionResult = await compressData(dataToStore);
        if (compressionResult.success && compressionResult.data) {
          dataToStore = compressionResult.data;
          compressed = true;
          size = compressionResult.compressedSize || size;
        }
      }

      // 暗号化処理（将来の実装用）
      let encrypted = false;
      if (this.config.encryption) {
        // 暗号化ロジックをここに実装
        encrypted = true;
      }

      // メタデータを作成
      const itemMetadata: StorageItemMetadata = {
        id,
        name: spreadsheet.name,
        type: 'spreadsheet',
        size,
        compressed,
        encrypted,
        createdAt: metadata?.createdAt || spreadsheet.createdAt,
        updatedAt: new Date(),
        version: this.config.version,
        tags: metadata?.tags || [],
        ...metadata
      };

      // データとメタデータを保存
      await this.storage.setItem(id, dataToStore);
      await this.metadataStorage.setItem(`${id}_meta`, itemMetadata);

      // バックアップを作成
      if (this.backupConfig.enabled) {
        await this.createBackup(id, dataToStore, itemMetadata);
      }

      const processingTime = performance.now() - startTime;

      return {
        success: true,
        data: true,
        metadata: {
          size,
          compressed,
          encrypted,
          timestamp: new Date(),
          version: this.config.version
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'スプレッドシートの保存に失敗しました'
      };
    }
  }

  /**
   * スプレッドシートを読み込む
   */
  async loadSpreadsheet(id: string): Promise<StorageOperationResult<Spreadsheet>> {
    try {
      // データとメタデータを読み込み
      const data = await this.storage.getItem(id);
      const metadata = await this.metadataStorage.getItem(`${id}_meta`) as StorageItemMetadata;

      if (!data) {
        return {
          success: false,
          error: 'スプレッドシートが見つかりません'
        };
      }

      let spreadsheetData: any = data;

      // 復号化処理
      if (metadata?.encrypted) {
        // 復号化ロジックをここに実装
      }

      // 解凍処理
      if (metadata?.compressed) {
        const decompressionResult = await decompressData(spreadsheetData);
        if (decompressionResult.success && decompressionResult.data) {
          spreadsheetData = decompressionResult.data;
        } else {
          return {
            success: false,
            error: 'データの解凍に失敗しました'
          };
        }
      }

      // Mapを復元
      if (spreadsheetData.cells && Array.isArray(spreadsheetData.cells)) {
        spreadsheetData.cells = new Map(spreadsheetData.cells);
      }

      // 日付オブジェクトを復元
      if (spreadsheetData.createdAt && typeof spreadsheetData.createdAt === 'string') {
        spreadsheetData.createdAt = new Date(spreadsheetData.createdAt);
      }
      if (spreadsheetData.updatedAt && typeof spreadsheetData.updatedAt === 'string') {
        spreadsheetData.updatedAt = new Date(spreadsheetData.updatedAt);
      }

      return {
        success: true,
        data: spreadsheetData as Spreadsheet,
        metadata: metadata ? {
          size: metadata.size,
          compressed: metadata.compressed,
          encrypted: metadata.encrypted,
          timestamp: metadata.updatedAt,
          version: metadata.version
        } : undefined
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'スプレッドシートの読み込みに失敗しました'
      };
    }
  }

  /**
   * スプレッドシートを削除する
   */
  async deleteSpreadsheet(id: string): Promise<StorageOperationResult<boolean>> {
    try {
      await this.storage.removeItem(id);
      await this.metadataStorage.removeItem(`${id}_meta`);

      // 関連するバックアップも削除
      await this.deleteBackups(id);

      return {
        success: true,
        data: true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'スプレッドシートの削除に失敗しました'
      };
    }
  }

  /**
   * 保存されているスプレッドシートのリストを取得する
   */
  async listSpreadsheets(): Promise<StorageOperationResult<StorageItemMetadata[]>> {
    try {
      const metadataKeys = await this.metadataStorage.keys();
      const spreadsheetMetadata: StorageItemMetadata[] = [];

      for (const key of metadataKeys) {
        if (key.endsWith('_meta') && !key.includes('_backup_')) {
          const metadata = await this.metadataStorage.getItem(key) as StorageItemMetadata;
          if (metadata && metadata.type === 'spreadsheet') {
            spreadsheetMetadata.push(metadata);
          }
        }
      }

      // 更新日時で降順ソート
      spreadsheetMetadata.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      return {
        success: true,
        data: spreadsheetMetadata
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'スプレッドシートリストの取得に失敗しました'
      };
    }
  }

  /**
   * ストレージ統計情報を取得する
   */
  async getStorageStatistics(): Promise<StorageOperationResult<StorageStatistics>> {
    try {
      const metadataKeys = await this.metadataStorage.keys();
      const statistics: StorageStatistics = {
        totalItems: 0,
        totalSize: 0,
        availableSpace: 0,
        compressionRatio: 0,
        itemsByType: {
          spreadsheet: 0,
          backup: 0,
          temp: 0,
          export: 0
        }
      };

      let totalUncompressedSize = 0;
      let totalCompressedSize = 0;
      let oldestDate: Date | undefined;
      let newestDate: Date | undefined;
      let largestSize = 0;
      let oldestItem: StorageItemMetadata | undefined;
      let newestItem: StorageItemMetadata | undefined;
      let largestItem: StorageItemMetadata | undefined;

      for (const key of metadataKeys) {
        if (key.endsWith('_meta')) {
          const metadata = await this.metadataStorage.getItem(key) as StorageItemMetadata;
          if (metadata) {
            statistics.totalItems++;
            statistics.totalSize += metadata.size;
            statistics.itemsByType[metadata.type]++;

            if (metadata.compressed) {
              totalCompressedSize += metadata.size;
              // 圧縮前のサイズは推定値（実装に依存）
              totalUncompressedSize += metadata.size * 2; // 仮の値
            } else {
              totalUncompressedSize += metadata.size;
            }

            // 最古・最新・最大アイテムの追跡
            if (!oldestDate || metadata.createdAt < oldestDate) {
              oldestDate = metadata.createdAt;
              oldestItem = metadata;
            }
            if (!newestDate || metadata.updatedAt > newestDate) {
              newestDate = metadata.updatedAt;
              newestItem = metadata;
            }
            if (metadata.size > largestSize) {
              largestSize = metadata.size;
              largestItem = metadata;
            }
          }
        }
      }

      statistics.compressionRatio = totalUncompressedSize > 0 ?
        (totalUncompressedSize - totalCompressedSize) / totalUncompressedSize : 0;

      statistics.oldestItem = oldestItem;
      statistics.newestItem = newestItem;
      statistics.largestItem = largestItem;

      // 利用可能スペースの推定（ブラウザAPI制限）
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        try {
          const estimate = await navigator.storage.estimate();
          statistics.availableSpace = (estimate.quota || 0) - (estimate.usage || 0);
        } catch {
          statistics.availableSpace = this.config.size - statistics.totalSize;
        }
      } else {
        statistics.availableSpace = this.config.size - statistics.totalSize;
      }

      return {
        success: true,
        data: statistics
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'ストレージ統計の取得に失敗しました'
      };
    }
  }

  /**
   * バックアップを作成する
   */
  private async createBackup(
    id: string,
    data: any,
    metadata: StorageItemMetadata
  ): Promise<void> {
    try {
      const backupId = `${id}_backup_${Date.now()}`;
      const backupMetadata: StorageItemMetadata = {
        ...metadata,
        id: backupId,
        type: 'backup',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.storage.setItem(backupId, data);
      await this.metadataStorage.setItem(`${backupId}_meta`, backupMetadata);

      // 古いバックアップを削除
      await this.cleanupBackups(id);
    } catch (error) {
      console.error('バックアップの作成に失敗:', error);
    }
  }

  /**
   * 古いバックアップを削除する
   */
  private async cleanupBackups(id: string): Promise<void> {
    try {
      const metadataKeys = await this.metadataStorage.keys();
      const backupItems: Array<{ key: string; metadata: StorageItemMetadata }> = [];

      // バックアップアイテムを収集
      for (const key of metadataKeys) {
        if (key.includes(`${id}_backup_`) && key.endsWith('_meta')) {
          const metadata = await this.metadataStorage.getItem(key) as StorageItemMetadata;
          if (metadata && metadata.type === 'backup') {
            backupItems.push({ key, metadata });
          }
        }
      }

      // 作成日時で降順ソート
      backupItems.sort((a, b) => b.metadata.createdAt.getTime() - a.metadata.createdAt.getTime());

      // 上限を超えたバックアップを削除
      if (backupItems.length > this.backupConfig.maxBackups) {
        const itemsToDelete = backupItems.slice(this.backupConfig.maxBackups);
        for (const item of itemsToDelete) {
          await this.storage.removeItem(item.metadata.id);
          await this.metadataStorage.removeItem(item.key);
        }
      }

      // 保持期間を過ぎたバックアップを削除
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.backupConfig.retentionDays);

      for (const item of backupItems) {
        if (item.metadata.createdAt < cutoffDate) {
          await this.storage.removeItem(item.metadata.id);
          await this.metadataStorage.removeItem(item.key);
        }
      }
    } catch (error) {
      console.error('バックアップのクリーンアップに失敗:', error);
    }
  }

  /**
   * バックアップを削除する
   */
  private async deleteBackups(id: string): Promise<void> {
    try {
      const metadataKeys = await this.metadataStorage.keys();

      for (const key of metadataKeys) {
        if (key.includes(`${id}_backup_`) && key.endsWith('_meta')) {
          const metadata = await this.metadataStorage.getItem(key) as StorageItemMetadata;
          if (metadata && metadata.type === 'backup') {
            await this.storage.removeItem(metadata.id);
            await this.metadataStorage.removeItem(key);
          }
        }
      }
    } catch (error) {
      console.error('バックアップの削除に失敗:', error);
    }
  }

  /**
   * 自動バックアップを開始する
   */
  private startAutoBackup(): void {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
    }

    this.backupTimer = window.setInterval(async () => {
      try {
        const spreadsheets = await this.listSpreadsheets();
        if (spreadsheets.success && spreadsheets.data) {
          for (const metadata of spreadsheets.data) {
            // 最後の更新から指定時間が経過している場合のみバックアップ
            const timeSinceUpdate = Date.now() - metadata.updatedAt.getTime();
            const backupInterval = this.backupConfig.intervalMinutes * 60 * 1000;

            if (timeSinceUpdate >= backupInterval) {
              const spreadsheet = await this.loadSpreadsheet(metadata.id);
              if (spreadsheet.success && spreadsheet.data) {
                await this.createBackup(metadata.id, spreadsheet.data, metadata);
              }
            }
          }
        }
      } catch (error) {
        console.error('自動バックアップに失敗:', error);
      }
    }, this.backupConfig.intervalMinutes * 60 * 1000);
  }

  /**
   * 自動同期を開始する（将来の実装）
   */
  private startAutoSync(): void {
    // 将来の実装用
    console.log('自動同期は未実装です');
  }

  /**
   * ストレージをクリアする
   */
  async clearStorage(): Promise<StorageOperationResult<boolean>> {
    try {
      await this.storage.clear();
      await this.metadataStorage.clear();

      if (this.backupTimer) {
        clearInterval(this.backupTimer);
      }

      return {
        success: true,
        data: true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'ストレージのクリアに失敗しました'
      };
    }
  }

  /**
   * バックアップ設定を更新する
   */
  updateBackupConfig(config: Partial<BackupConfig>): void {
    this.backupConfig = { ...this.backupConfig, ...config };

    if (this.backupConfig.enabled) {
      this.startAutoBackup();
    } else if (this.backupTimer) {
      clearInterval(this.backupTimer);
    }
  }

  /**
   * ストレージ設定を更新する
   */
  updateStorageConfig(config: Partial<StorageConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * リソースを解放する
   */
  dispose(): void {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
      this.backupTimer = undefined;
    }
  }
}

/**
 * デフォルトのストレージマネージャーを作成する
 */
export function createStorageManager(config?: Partial<StorageConfig>): StorageManager {
  return new StorageManager(config);
}

/**
 * ストレージの使用量を取得する
 */
export async function getStorageUsage(): Promise<{
  used: number;
  total: number;
  available: number;
  percentage: number;
}> {
  try {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const used = estimate.usage || 0;
      const total = estimate.quota || 0;
      const available = total - used;
      const percentage = total > 0 ? (used / total) * 100 : 0;

      return { used, total, available, percentage };
    }
  } catch (error) {
    console.error('ストレージ使用量の取得に失敗:', error);
  }

  // フォールバック値
  return { used: 0, total: 5 * 1024 * 1024, available: 5 * 1024 * 1024, percentage: 0 };
}

/**
 * ブラウザがIndexedDBをサポートしているかチェックする
 */
export function isIndexedDBSupported(): boolean {
  return 'indexedDB' in window;
}

/**
 * ブラウザがWebSQLをサポートしているかチェックする
 */
export function isWebSQLSupported(): boolean {
  return 'openDatabase' in window;
}

/**
 * 利用可能なストレージドライバーを取得する
 */
export function getAvailableDrivers(): string[] {
  const drivers: string[] = [];

  if (isIndexedDBSupported()) {
    drivers.push(localforage.INDEXEDDB);
  }

  if (isWebSQLSupported()) {
    drivers.push(localforage.WEBSQL);
  }

  drivers.push(localforage.LOCALSTORAGE);

  return drivers;
}