#!/usr/bin/env node

/**
 * Storage CLI Tool (T062)
 * ストレージ管理を提供するCLIツール
 *
 * Note: このCLIはNode.js環境でのファイルベースストレージをシミュレートします。
 * 実際のブラウザ環境でのlocalforage機能は、Web環境でのみ動作します。
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import { resolve, join, basename, extname } from 'path';

// コアライブラリのインポート（ストレージ関連）
import { Spreadsheet } from '../../src/lib/spreadsheet';

// ファイルベースストレージのシミュレーション
interface FileStorageConfig {
  baseDir: string;
  compression: boolean;
  backup: boolean;
  maxBackups: number;
}

interface StorageItemMetadata {
  id: string;
  name: string;
  type: 'spreadsheet' | 'backup' | 'temp' | 'export';
  size: number;
  compressed: boolean;
  encrypted: boolean;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  checksum?: string;
  tags?: string[];
}

interface StorageStatistics {
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

// CLIプログラムの設定
const program = new Command();

program
  .name('storage-cli')
  .description('Storage management CLI tool')
  .version('1.0.0');

/**
 * エラーハンドリング用のユーティリティ関数
 */
function handleError(error: unknown, context: string): void {
  console.error(chalk.red(`エラーが発生しました (${context}):`));
  if (error instanceof Error) {
    console.error(chalk.red(error.message));
  } else {
    console.error(chalk.red('予期しないエラー'));
  }
  process.exit(1);
}

/**
 * ファイルベースストレージマネージャー
 */
class FileStorageManager {
  private config: FileStorageConfig;

  constructor(config: Partial<FileStorageConfig> = {}) {
    this.config = {
      baseDir: './storage',
      compression: false, // Node.js環境では圧縮は簡単のため無効
      backup: true,
      maxBackups: 10,
      ...config
    };

    // ベースディレクトリを作成
    if (!existsSync(this.config.baseDir)) {
      mkdirSync(this.config.baseDir, { recursive: true });
    }
  }

  /**
   * スプレッドシートを保存する
   */
  async saveSpreadsheet(
    id: string,
    spreadsheet: Spreadsheet,
    metadata?: Partial<StorageItemMetadata>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const filePath = join(this.config.baseDir, `${id}.json`);
      const metaPath = join(this.config.baseDir, `${id}.meta.json`);

      // データを準備
      const dataToStore = {
        ...spreadsheet,
        cells: Array.from(spreadsheet.cells.entries())
      };

      const content = JSON.stringify(dataToStore, null, 2);
      const size = Buffer.byteLength(content, 'utf8');

      // メタデータを作成
      const itemMetadata: StorageItemMetadata = {
        id,
        name: spreadsheet.name,
        type: 'spreadsheet',
        size,
        compressed: false,
        encrypted: false,
        createdAt: metadata?.createdAt || spreadsheet.createdAt,
        updatedAt: new Date(),
        version: 1,
        tags: metadata?.tags || [],
        ...metadata
      };

      // バックアップを作成
      if (this.config.backup && existsSync(filePath)) {
        await this.createBackup(id, content, itemMetadata);
      }

      // データとメタデータを保存
      writeFileSync(filePath, content);
      writeFileSync(metaPath, JSON.stringify(itemMetadata, null, 2));

      return { success: true };
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
  async loadSpreadsheet(id: string): Promise<{
    success: boolean;
    data?: Spreadsheet;
    metadata?: StorageItemMetadata;
    error?: string;
  }> {
    try {
      const filePath = join(this.config.baseDir, `${id}.json`);
      const metaPath = join(this.config.baseDir, `${id}.meta.json`);

      if (!existsSync(filePath)) {
        return {
          success: false,
          error: 'スプレッドシートが見つかりません'
        };
      }

      const content = readFileSync(filePath, 'utf-8');
      const spreadsheetData = JSON.parse(content);

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

      // メタデータを読み込み
      let metadata: StorageItemMetadata | undefined;
      if (existsSync(metaPath)) {
        const metaContent = readFileSync(metaPath, 'utf-8');
        metadata = JSON.parse(metaContent);
        if (metadata?.createdAt) {
          metadata.createdAt = new Date(metadata.createdAt);
        }
        if (metadata?.updatedAt) {
          metadata.updatedAt = new Date(metadata.updatedAt);
        }
      }

      return {
        success: true,
        data: spreadsheetData as Spreadsheet,
        metadata
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
  async deleteSpreadsheet(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const filePath = join(this.config.baseDir, `${id}.json`);
      const metaPath = join(this.config.baseDir, `${id}.meta.json`);

      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
      if (existsSync(metaPath)) {
        unlinkSync(metaPath);
      }

      // 関連するバックアップも削除
      await this.deleteBackups(id);

      return { success: true };
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
  async listSpreadsheets(): Promise<{
    success: boolean;
    data?: StorageItemMetadata[];
    error?: string;
  }> {
    try {
      if (!existsSync(this.config.baseDir)) {
        return { success: true, data: [] };
      }

      const files = readdirSync(this.config.baseDir);
      const spreadsheetMetadata: StorageItemMetadata[] = [];

      for (const file of files) {
        if (file.endsWith('.meta.json') && !file.includes('.backup.')) {
          try {
            const metaPath = join(this.config.baseDir, file);
            const metaContent = readFileSync(metaPath, 'utf-8');
            const metadata = JSON.parse(metaContent) as StorageItemMetadata;

            if (metadata.type === 'spreadsheet') {
              // 日付を復元
              metadata.createdAt = new Date(metadata.createdAt);
              metadata.updatedAt = new Date(metadata.updatedAt);
              spreadsheetMetadata.push(metadata);
            }
          } catch (error) {
            // メタファイルの読み込みに失敗した場合はスキップ
            console.warn(chalk.yellow(`メタデータファイルの読み込みに失敗: ${file}`));
          }
        }
      }

      // 更新日時で降順ソート
      spreadsheetMetadata.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      return { success: true, data: spreadsheetMetadata };
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
  async getStorageStatistics(): Promise<{
    success: boolean;
    data?: StorageStatistics;
    error?: string;
  }> {
    try {
      if (!existsSync(this.config.baseDir)) {
        return {
          success: true,
          data: {
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
          }
        };
      }

      const files = readdirSync(this.config.baseDir);
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

      let oldestDate: Date | undefined;
      let newestDate: Date | undefined;
      let largestSize = 0;
      let oldestItem: StorageItemMetadata | undefined;
      let newestItem: StorageItemMetadata | undefined;
      let largestItem: StorageItemMetadata | undefined;

      for (const file of files) {
        if (file.endsWith('.meta.json')) {
          try {
            const metaPath = join(this.config.baseDir, file);
            const metaContent = readFileSync(metaPath, 'utf-8');
            const metadata = JSON.parse(metaContent) as StorageItemMetadata;

            // 日付を復元
            metadata.createdAt = new Date(metadata.createdAt);
            metadata.updatedAt = new Date(metadata.updatedAt);

            statistics.totalItems++;
            statistics.totalSize += metadata.size;
            statistics.itemsByType[metadata.type]++;

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
          } catch (error) {
            // メタファイルの読み込みに失敗した場合はスキップ
          }
        }
      }

      statistics.oldestItem = oldestItem;
      statistics.newestItem = newestItem;
      statistics.largestItem = largestItem;

      // 利用可能スペースの推定（簡単のため固定値）
      statistics.availableSpace = 1024 * 1024 * 1024; // 1GB

      return { success: true, data: statistics };
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
    content: string,
    metadata: StorageItemMetadata
  ): Promise<void> {
    try {
      const timestamp = Date.now();
      const backupId = `${id}.backup.${timestamp}`;
      const backupPath = join(this.config.baseDir, `${backupId}.json`);
      const backupMetaPath = join(this.config.baseDir, `${backupId}.meta.json`);

      const backupMetadata: StorageItemMetadata = {
        ...metadata,
        id: backupId,
        type: 'backup',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      writeFileSync(backupPath, content);
      writeFileSync(backupMetaPath, JSON.stringify(backupMetadata, null, 2));

      // 古いバックアップを削除
      await this.cleanupBackups(id);
    } catch (error) {
      console.warn(chalk.yellow('バックアップの作成に失敗:', error));
    }
  }

  /**
   * 古いバックアップを削除する
   */
  private async cleanupBackups(id: string): Promise<void> {
    try {
      const files = readdirSync(this.config.baseDir);
      const backupFiles: Array<{ file: string; timestamp: number }> = [];

      // バックアップファイルを収集
      for (const file of files) {
        if (file.startsWith(`${id}.backup.`) && file.endsWith('.json') && !file.endsWith('.meta.json')) {
          const match = file.match(/\.backup\.(\d+)\.json$/);
          if (match) {
            const timestamp = parseInt(match[1], 10);
            backupFiles.push({ file, timestamp });
          }
        }
      }

      // タイムスタンプで降順ソート
      backupFiles.sort((a, b) => b.timestamp - a.timestamp);

      // 上限を超えたバックアップを削除
      if (backupFiles.length > this.config.maxBackups) {
        const filesToDelete = backupFiles.slice(this.config.maxBackups);
        for (const { file } of filesToDelete) {
          const backupPath = join(this.config.baseDir, file);
          const backupMetaPath = join(this.config.baseDir, file.replace('.json', '.meta.json'));

          if (existsSync(backupPath)) {
            unlinkSync(backupPath);
          }
          if (existsSync(backupMetaPath)) {
            unlinkSync(backupMetaPath);
          }
        }
      }
    } catch (error) {
      console.warn(chalk.yellow('バックアップのクリーンアップに失敗:', error));
    }
  }

  /**
   * バックアップを削除する
   */
  private async deleteBackups(id: string): Promise<void> {
    try {
      const files = readdirSync(this.config.baseDir);

      for (const file of files) {
        if (file.startsWith(`${id}.backup.`)) {
          const filePath = join(this.config.baseDir, file);
          if (existsSync(filePath)) {
            unlinkSync(filePath);
          }
        }
      }
    } catch (error) {
      console.warn(chalk.yellow('バックアップの削除に失敗:', error));
    }
  }

  /**
   * ストレージをクリアする
   */
  async clearStorage(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!existsSync(this.config.baseDir)) {
        return { success: true };
      }

      const files = readdirSync(this.config.baseDir);
      for (const file of files) {
        const filePath = join(this.config.baseDir, file);
        if (statSync(filePath).isFile()) {
          unlinkSync(filePath);
        }
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'ストレージのクリアに失敗しました'
      };
    }
  }
}

// グローバルストレージインスタンス
let storageManager: FileStorageManager;

/**
 * ストレージマネージャーを初期化する
 */
function getStorageManager(baseDir?: string): FileStorageManager {
  if (!storageManager || (baseDir && storageManager['config'].baseDir !== baseDir)) {
    storageManager = new FileStorageManager(baseDir ? { baseDir } : {});
  }
  return storageManager;
}

/**
 * スプレッドシートファイルを読み込む
 */
function loadSpreadsheetFile(filePath: string): Spreadsheet {
  try {
    if (!existsSync(filePath)) {
      throw new Error(`ファイルが見つかりません: ${filePath}`);
    }

    const content = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    // セルマップを復元
    if (data.cells && Array.isArray(data.cells)) {
      data.cells = new Map(data.cells);
    }

    // 日付を復元
    if (data.createdAt) data.createdAt = new Date(data.createdAt);
    if (data.updatedAt) data.updatedAt = new Date(data.updatedAt);

    return data as Spreadsheet;
  } catch (error) {
    throw new Error(`スプレッドシートの読み込みに失敗: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ====================
// コマンド実装
// ====================

/**
 * ストレージ設定コマンド
 */
program
  .command('config')
  .description('ストレージの設定を管理する')
  .option('--base-dir <dir>', 'ベースディレクトリを設定', './storage')
  .option('--backup', 'バックアップを有効化', false)
  .option('--max-backups <num>', '最大バックアップ数', '10')
  .action(async (options) => {
    try {
      const storage = getStorageManager(options.baseDir);

      console.log(chalk.blue('=== ストレージ設定 ==='));
      console.log(`ベースディレクトリ: ${options.baseDir}`);
      console.log(`バックアップ: ${options.backup ? '有効' : '無効'}`);
      console.log(`最大バックアップ数: ${options.maxBackups}`);

      // ベースディレクトリの情報
      if (existsSync(options.baseDir)) {
        const stats = await storage.getStorageStatistics();
        if (stats.success && stats.data) {
          console.log(`\n現在の使用状況:`);
          console.log(`  総アイテム数: ${stats.data.totalItems}`);
          console.log(`  総サイズ: ${(stats.data.totalSize / 1024).toFixed(2)} KB`);
        }
      } else {
        console.log(chalk.yellow('\nベースディレクトリは存在しません。初回保存時に作成されます。'));
      }
    } catch (error) {
      handleError(error, 'config');
    }
  });

/**
 * スプレッドシートを保存する
 */
program
  .command('save')
  .description('スプレッドシートをストレージに保存する')
  .argument('<file>', 'スプレッドシートファイルパス')
  .argument('<id>', 'ストレージID')
  .option('--base-dir <dir>', 'ベースディレクトリ', './storage')
  .option('--tags <tags>', 'タグ (カンマ区切り)')
  .action(async (file, id, options) => {
    const spinner = ora('スプレッドシートを保存中...').start();

    try {
      const spreadsheet = loadSpreadsheetFile(file);
      const storage = getStorageManager(options.baseDir);

      const tags = options.tags ? options.tags.split(',').map((tag: string) => tag.trim()) : [];

      const result = await storage.saveSpreadsheet(id, spreadsheet, { tags });

      if (result.success) {
        spinner.succeed(`スプレッドシートを保存しました: ${id}`);
        console.log(chalk.blue('詳細:'));
        console.log(`  名前: ${spreadsheet.name}`);
        console.log(`  ID: ${id}`);
        console.log(`  セル数: ${spreadsheet.cells.size}`);
        console.log(`  タグ: ${tags.length > 0 ? tags.join(', ') : '(なし)'}`);
      } else {
        spinner.fail('保存に失敗しました');
        console.error(chalk.red(result.error));
      }
    } catch (error) {
      spinner.fail('エラーが発生しました');
      handleError(error, 'save');
    }
  });

/**
 * スプレッドシートを読み込む
 */
program
  .command('load')
  .description('ストレージからスプレッドシートを読み込む')
  .argument('<id>', 'ストレージID')
  .argument('<output-file>', '出力ファイルパス')
  .option('--base-dir <dir>', 'ベースディレクトリ', './storage')
  .action(async (id, outputFile, options) => {
    const spinner = ora('スプレッドシートを読み込み中...').start();

    try {
      const storage = getStorageManager(options.baseDir);
      const result = await storage.loadSpreadsheet(id);

      if (result.success && result.data) {
        const data = {
          ...result.data,
          cells: Array.from(result.data.cells.entries())
        };

        writeFileSync(outputFile, JSON.stringify(data, null, 2));

        spinner.succeed(`スプレッドシートを読み込みました: ${outputFile}`);
        console.log(chalk.blue('詳細:'));
        console.log(`  名前: ${result.data.name}`);
        console.log(`  ID: ${result.data.id}`);
        console.log(`  セル数: ${result.data.cells.size}`);
        console.log(`  作成日: ${result.data.createdAt.toLocaleString()}`);
        console.log(`  更新日: ${result.data.updatedAt.toLocaleString()}`);

        if (result.metadata) {
          console.log(`  サイズ: ${(result.metadata.size / 1024).toFixed(2)} KB`);
          if (result.metadata.tags && result.metadata.tags.length > 0) {
            console.log(`  タグ: ${result.metadata.tags.join(', ')}`);
          }
        }
      } else {
        spinner.fail('読み込みに失敗しました');
        console.error(chalk.red(result.error));
      }
    } catch (error) {
      spinner.fail('エラーが発生しました');
      handleError(error, 'load');
    }
  });

/**
 * スプレッドシートを削除する
 */
program
  .command('delete')
  .description('ストレージからスプレッドシートを削除する')
  .argument('<id>', 'ストレージID')
  .option('--base-dir <dir>', 'ベースディレクトリ', './storage')
  .option('--force', '確認をスキップ', false)
  .action(async (id, options) => {
    try {
      // 削除確認
      if (!options.force) {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `スプレッドシート "${id}" を削除しますか？`,
            default: false
          }
        ]);

        if (!confirm) {
          console.log(chalk.yellow('削除をキャンセルしました'));
          return;
        }
      }

      const spinner = ora('スプレッドシートを削除中...').start();

      const storage = getStorageManager(options.baseDir);
      const result = await storage.deleteSpreadsheet(id);

      if (result.success) {
        spinner.succeed(`スプレッドシートを削除しました: ${id}`);
      } else {
        spinner.fail('削除に失敗しました');
        console.error(chalk.red(result.error));
      }
    } catch (error) {
      handleError(error, 'delete');
    }
  });

/**
 * ストレージ内のスプレッドシート一覧を表示
 */
program
  .command('list')
  .description('ストレージ内のスプレッドシート一覧を表示する')
  .option('--base-dir <dir>', 'ベースディレクトリ', './storage')
  .option('--format <format>', '出力形式 (table, json)', 'table')
  .option('--filter <filter>', 'フィルター条件')
  .action(async (options) => {
    try {
      const storage = getStorageManager(options.baseDir);
      const result = await storage.listSpreadsheets();

      if (result.success && result.data) {
        let spreadsheets = result.data;

        // フィルターを適用
        if (options.filter) {
          const filterRegex = new RegExp(options.filter, 'i');
          spreadsheets = spreadsheets.filter(item =>
            filterRegex.test(item.name) ||
            filterRegex.test(item.id) ||
            (item.tags && item.tags.some(tag => filterRegex.test(tag)))
          );
        }

        switch (options.format) {
          case 'json':
            console.log(JSON.stringify(spreadsheets, null, 2));
            break;
          default:
            if (spreadsheets.length === 0) {
              console.log(chalk.yellow('保存されているスプレッドシートはありません'));
            } else {
              console.log(chalk.blue(`=== ストレージ内のスプレッドシート (${spreadsheets.length}件) ===`));
              spreadsheets.forEach(item => {
                console.log(`\n${chalk.green('●')} ${item.name}`);
                console.log(`  ID: ${item.id}`);
                console.log(`  サイズ: ${(item.size / 1024).toFixed(2)} KB`);
                console.log(`  作成日: ${item.createdAt.toLocaleString()}`);
                console.log(`  更新日: ${item.updatedAt.toLocaleString()}`);
                if (item.tags && item.tags.length > 0) {
                  console.log(`  タグ: ${item.tags.join(', ')}`);
                }
              });
            }
        }
      } else {
        console.error(chalk.red('リストの取得に失敗しました:'), result.error);
      }
    } catch (error) {
      handleError(error, 'list');
    }
  });

/**
 * ストレージ統計情報を表示
 */
program
  .command('stats')
  .description('ストレージの統計情報を表示する')
  .option('--base-dir <dir>', 'ベースディレクトリ', './storage')
  .option('--format <format>', '出力形式 (table, json)', 'table')
  .action(async (options) => {
    try {
      const storage = getStorageManager(options.baseDir);
      const result = await storage.getStorageStatistics();

      if (result.success && result.data) {
        switch (options.format) {
          case 'json':
            console.log(JSON.stringify(result.data, null, 2));
            break;
          default:
            const stats = result.data;
            console.log(chalk.blue('=== ストレージ統計情報 ==='));
            console.log(`総アイテム数: ${stats.totalItems}`);
            console.log(`総サイズ: ${(stats.totalSize / 1024).toFixed(2)} KB`);
            console.log(`利用可能スペース: ${(stats.availableSpace / 1024 / 1024).toFixed(2)} MB`);

            console.log(chalk.blue('\nアイテム種別:'));
            console.log(`  スプレッドシート: ${stats.itemsByType.spreadsheet}`);
            console.log(`  バックアップ: ${stats.itemsByType.backup}`);
            console.log(`  一時ファイル: ${stats.itemsByType.temp}`);
            console.log(`  エクスポート: ${stats.itemsByType.export}`);

            if (stats.oldestItem) {
              console.log(chalk.blue('\n最古のアイテム:'));
              console.log(`  名前: ${stats.oldestItem.name}`);
              console.log(`  作成日: ${stats.oldestItem.createdAt.toLocaleString()}`);
            }

            if (stats.newestItem) {
              console.log(chalk.blue('\n最新のアイテム:'));
              console.log(`  名前: ${stats.newestItem.name}`);
              console.log(`  更新日: ${stats.newestItem.updatedAt.toLocaleString()}`);
            }

            if (stats.largestItem) {
              console.log(chalk.blue('\n最大のアイテム:'));
              console.log(`  名前: ${stats.largestItem.name}`);
              console.log(`  サイズ: ${(stats.largestItem.size / 1024).toFixed(2)} KB`);
            }
        }
      } else {
        console.error(chalk.red('統計情報の取得に失敗しました:'), result.error);
      }
    } catch (error) {
      handleError(error, 'stats');
    }
  });

/**
 * ストレージをクリアする
 */
program
  .command('clear')
  .description('ストレージをクリアする')
  .option('--base-dir <dir>', 'ベースディレクトリ', './storage')
  .option('--force', '確認をスキップ', false)
  .action(async (options) => {
    try {
      // クリア確認
      if (!options.force) {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: 'すべてのストレージデータを削除しますか？',
            default: false
          }
        ]);

        if (!confirm) {
          console.log(chalk.yellow('クリアをキャンセルしました'));
          return;
        }
      }

      const spinner = ora('ストレージをクリア中...').start();

      const storage = getStorageManager(options.baseDir);
      const result = await storage.clearStorage();

      if (result.success) {
        spinner.succeed('ストレージをクリアしました');
      } else {
        spinner.fail('クリアに失敗しました');
        console.error(chalk.red(result.error));
      }
    } catch (error) {
      spinner.fail('エラーが発生しました');
      handleError(error, 'clear');
    }
  });

/**
 * バックアップを管理する
 */
program
  .command('backup')
  .description('バックアップを管理する')
  .argument('<action>', 'アクション (list, restore, delete)')
  .argument('[id]', 'スプレッドシートID')
  .option('--base-dir <dir>', 'ベースディレクトリ', './storage')
  .option('--backup-id <backupId>', 'バックアップID')
  .action(async (action, id, options) => {
    try {
      const storage = getStorageManager(options.baseDir);

      switch (action) {
        case 'list':
          // バックアップ一覧を表示
          if (!existsSync(options.baseDir)) {
            console.log(chalk.yellow('バックアップが見つかりません'));
            return;
          }

          const files = readdirSync(options.baseDir);
          const backups: Array<{ file: string; id: string; timestamp: string; metadata?: any }> = [];

          for (const file of files) {
            if (file.includes('.backup.') && file.endsWith('.meta.json')) {
              try {
                const metaPath = join(options.baseDir, file);
                const metadata = JSON.parse(readFileSync(metaPath, 'utf-8'));
                backups.push({
                  file,
                  id: metadata.id,
                  timestamp: new Date(metadata.createdAt).toLocaleString(),
                  metadata
                });
              } catch (error) {
                // メタファイルの読み込みに失敗した場合はスキップ
              }
            }
          }

          if (backups.length === 0) {
            console.log(chalk.yellow('バックアップが見つかりません'));
          } else {
            console.log(chalk.blue(`=== バックアップ一覧 (${backups.length}件) ===`));
            backups.forEach(backup => {
              console.log(`${chalk.green('●')} ${backup.metadata?.name || '(名前なし)'}`);
              console.log(`  バックアップID: ${backup.id}`);
              console.log(`  作成日時: ${backup.timestamp}`);
            });
          }
          break;

        default:
          console.error(chalk.red('無効なアクション:', action));
          console.log('利用可能なアクション: list, restore, delete');
      }
    } catch (error) {
      handleError(error, 'backup');
    }
  });

// プログラムの実行
program.parse(process.argv);

// コマンドが指定されていない場合はヘルプを表示
if (process.argv.length <= 2) {
  program.outputHelp();
}