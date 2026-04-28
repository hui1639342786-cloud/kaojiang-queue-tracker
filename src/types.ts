export interface QueueEntry {
  city: string;
  storeName: string;
  tableType: string;
  queueCount: number;
  pageTime: string;
  period: '中午' | '晚上' | '其他';
  uploadTime: string;
  collectionDate: string;
  id?: string;
}

export const CITIES = ['北京', '西安', '上海'];
export const BRANDS = ['烤匠麻辣烤鱼'];

export interface ExtractionResult {
  city: string;
  storeName: string;
  queues: {
    tableType: string;
    queueCount: number;
  }[];
  pageTime: string;
}
