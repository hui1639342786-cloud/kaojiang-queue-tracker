import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { extractQueueData } from '../services/ocrService';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

export function UploadZone({ onUploadComplete }: { onUploadComplete: () => void }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<{ name: string; status: 'success' | 'error'; message: string }[]>([]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!auth.currentUser) {
      alert("Please login first");
      return;
    }

    setIsProcessing(true);
    const newResults: typeof results = [];

    for (const file of acceptedFiles) {
      try {
        if (file.type.includes('image')) {
          const data = await extractQueueData(file);
          const now = new Date();
          const collectionDate = format(now, 'yyyy-MM-dd');
          
          for (const queue of data.queues) {
            const hour = parseInt(data.pageTime.split(':')[0]);
            let period: '中午' | '晚上' | '其他' = '其他';
            if (hour >= 11 && hour <= 14) period = '中午';
            else if (hour >= 17 && hour <= 20) period = '晚上';

            const logData = {
              city: data.city || 'Unknown',
              storeName: data.storeName,
              tableType: queue.tableType,
              queueCount: queue.queueCount,
              pageTime: data.pageTime,
              period: period,
              uploadTime: serverTimestamp(),
              collectionDate: collectionDate
            };
            await addDoc(collection(db, 'queueLogs'), logData);
          }
          newResults.push({ name: file.name, status: 'success', message: `OCR: Extracted ${data.queues.length} entries` });
        } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) {
          // Handle Excel/CSV
          const data = await file.arrayBuffer();
          const workbook = XLSX.read(data);
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const json: any[] = XLSX.utils.sheet_to_json(sheet);
          
          let count = 0;
          for (const row of json) {
            const city = row['城市'] || row['City'] || 'Unknown';
            const storeName = row['门店'] || row['Store'] || 'Unknown';
            const tableType = row['桌型'] || row['TableType'] || 'Unknown';
            const queueCount = parseInt(row['排队数'] || row['Count'] || '0');
            const pageTime = row['页面时间'] || row['PageTime'] || format(new Date(), 'HH:mm');
            const collectionDate = row['采集日期'] || row['Date'] || format(new Date(), 'yyyy-MM-dd');
            
            const hour = parseInt(pageTime.split(':')[0]);
            let period = row['时段'] || row['Period'];
            if (!period) {
              if (hour >= 11 && hour <= 14) period = '中午';
              else if (hour >= 17 && hour <= 20) period = '晚上';
              else period = '其他';
            }

            await addDoc(collection(db, 'queueLogs'), {
              city, storeName, tableType, queueCount, pageTime, period, collectionDate,
              uploadTime: serverTimestamp()
            });
            count++;
          }
          newResults.push({ name: file.name, status: 'success', message: `File: Imported ${count} entries` });
        }
      } catch (error) {
        newResults.push({ name: file.name, status: 'error', message: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    setResults(prev => [...newResults, ...prev]);
    setIsProcessing(false);
    onUploadComplete();
  }, [onUploadComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 
      'image/*': ['.jpeg', '.jpg', '.png', '.webp'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv']
    },
    multiple: true,
  } as any);

  return (
    <div className="space-y-6">
      <div 
        {...getRootProps()} 
        className={`
          border border-dashed rounded p-12 transition-all duration-300 cursor-pointer
          flex flex-col items-center justify-center text-center
          ${isDragActive ? 'border-brand-red bg-red-50/10 scale-[1.01]' : 'border-zinc-200 hover:border-zinc-400'}
          ${isProcessing ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        <input {...getInputProps()} />
        <div className="w-16 h-16 bg-zinc-50 border border-zinc-100 rounded flex items-center justify-center mb-4">
          <Upload className="w-6 h-6 text-zinc-400" />
        </div>
        <h3 className="text-sm font-black uppercase tracking-widest mb-2">点击或拖拽上传数据</h3>
        <p className="text-[10px] text-zinc-500 font-bold max-w-xs mx-auto uppercase">
          支持图片 (OCR) 或 Excel/CSV 表格导入
        </p>
        {isProcessing && (
          <div className="mt-6 flex items-center gap-2 text-brand-red font-black text-[10px] uppercase">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>AI 正在处理数据并在同步数据库...</span>
          </div>
        )}
      </div>

      <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
        <AnimatePresence initial={false}>
          {results.map((result, idx) => (
            <motion.div
              key={idx + result.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`p-3 rounded-xl border flex items-center justify-between ${
                result.status === 'success' ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'
              }`}
            >
              <div className="flex items-center gap-3">
                {result.status === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-500" />
                )}
                <div>
                  <p className="text-sm font-medium text-slate-900 truncate max-w-[200px]">{result.name}</p>
                  <p className={`text-xs ${result.status === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {result.message}
                  </p>
                </div>
              </div>
              <FileText className="w-4 h-4 text-slate-400" />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
