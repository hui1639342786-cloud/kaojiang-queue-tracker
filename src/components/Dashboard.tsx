import React, { useMemo, useState, useRef } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar
} from 'recharts';
import { QueueEntry } from '../types';
import { format, parseISO, getWeek, startOfMonth } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { ChevronDown, Filter, LayoutGrid, LineChart as ChartIcon, FileSpreadsheet, Trash2, Calendar, Clock, Download, Upload, FileText, Camera, Zap } from 'lucide-react';
import { doc, deleteDoc, collection, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import * as XLSX from 'xlsx';
import { UploadZone } from './UploadZone';
import { motion } from 'motion/react';

export function Dashboard({ data }: { data: QueueEntry[] }) {
  const [selectedCity, setSelectedCity] = useState<string>('All');
  const [selectedTableType, setSelectedTableType] = useState<string>('All');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('All');
  const [selectedMonth, setSelectedMonth] = useState<string>('All');
  const [selectedWeek, setSelectedWeek] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'line' | 'bar'>('line');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [migrating, setMigrating] = useState(false);

  const formatCityName = (rawCity: string): string => {
    const city = rawCity.trim();
    if (city.includes('上海') || city.toLowerCase() === 'shanghai') return 'Shanghai';
    if (city.includes('北京') || city.toLowerCase() === 'beijing') return 'Beijing';
    if (city.includes('西安') || city.toLowerCase().includes('xian')) return "Xi'an";
    return city;
  };

  const runCityMigration = async () => {
    if (!window.confirm('此操作将把所有既有数据的城市名统一为纯英文格式（如：Shanghai）。确定继续吗？')) return;
    setMigrating(true);
    let count = 0;
    try {
      for (const item of data) {
        if (!item.id) continue;
        const newCity = formatCityName(item.city);
        
        if (newCity !== item.city) {
          await updateDoc(doc(db, 'queueLogs', item.id), { city: newCity });
          count++;
        }
      }
      alert(`清洗完成！共更新 ${count} 条记录。`);
    } catch (err) {
      console.error(err);
      alert('清洗过程发生错误');
    }
    setMigrating(false);
  };

  const filteredData = useMemo(() => {
    return data.filter(item => {
      // 降低拦截阈值：只要有城市和门店，就在管理列表中显示，不因日期解析失败而完全隐藏
      const cityMatch = selectedCity === 'All' || item.city === selectedCity;
      const tableMatch = selectedTableType === 'All' || item.tableType === selectedTableType;
      const periodMatch = selectedPeriod === 'All' || item.period === selectedPeriod;
      
      let dateMatch = true;
      if (item.collectionDate) {
        try {
          // 1. 清理数据：处理 2024/1/1 -> 2024-01-01 以及空格问题
          const cleanDateStr = String(item.collectionDate).trim().replace(/[\/\.]/g, '-');
          
          // 尝试 parseISO，如果失败则尝试普通日期构造函数
          let date = parseISO(cleanDateStr);
          if (isNaN(date.getTime())) {
            date = new Date(cleanDateStr);
          }
          
          if (!isNaN(date.getTime())) {
            // 月份比较
            const monthStr = format(date, 'yyyy-MM');
            const monthMatch = selectedMonth === 'All' || monthStr === selectedMonth;
            
            // 星期比较：手动映射确保与下拉菜单中的文字完全匹配
            const dayNum = date.getDay(); // 0(周日) - 6(周六)
            const dayMap = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
            const weekStr = dayMap[dayNum];
            
            const weekMatch = selectedWeek === 'All' || weekStr === selectedWeek;
            
            dateMatch = monthMatch && weekMatch;
          } else {
            // 如果日期无效，但用户选择了 "All" 筛选，则依然显示
            dateMatch = selectedMonth === 'All' && selectedWeek === 'All';
          }
        } catch (e) {
          dateMatch = selectedMonth === 'All' && selectedWeek === 'All';
        }
      } else {
        dateMatch = selectedMonth === 'All' && selectedWeek === 'All';
      }
      
      return cityMatch && tableMatch && periodMatch && dateMatch;
    });
  }, [data, selectedCity, selectedTableType, selectedPeriod, selectedMonth, selectedWeek]);

  const cities = useMemo(() => ['All', ...Array.from(new Set(data.map(d => d.city).filter(Boolean)))], [data]);
  const tableTypes = useMemo(() => ['All', ...Array.from(new Set(data.map(d => d.tableType).filter(Boolean)))], [data]);
  const months = useMemo(() => ['All', ...Array.from(new Set(data.map(d => {
    if (!d.collectionDate) return null;
    try {
      const date = parseISO(d.collectionDate);
      return isNaN(date.getTime()) ? null : format(date, 'yyyy-MM');
    } catch(e) { return null; }
  }).filter(Boolean)))].sort(), [data]);
  
  const weeks = useMemo(() => {
    return ['All', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  }, []);

  const handleDelete = async (id: string) => {
    console.log('Attempting to delete document:', id);
    try {
      await deleteDoc(doc(db, 'queueLogs', id));
      console.log('Document deleted successfully');
    } catch (error) {
      console.error("Error deleting document: ", error);
      alert('删除失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredData.map(item => ({
      '城市': item.city,
      '门店': item.storeName,
      '桌型': item.tableType,
      '排队数': item.queueCount,
      '时段': item.period,
      '页面时间': item.pageTime,
      '采集日期': item.collectionDate
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Queue Data");
    XLSX.writeFile(wb, `KaoJiang_Data_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
  };

  const exportToCSV = () => {
    const ws = XLSX.utils.json_to_sheet(filteredData.map(item => ({
      'City': item.city,
      'Store': item.storeName,
      'TableType': item.tableType,
      'Count': item.queueCount,
      'Period': item.period,
      'PageTime': item.pageTime,
      'Date': item.collectionDate
    })));
    const csvContent = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `KaoJiang_Data_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadTemplate = () => {
    const templateData = [{
      '城市': '北京',
      '门店': '三里屯店',
      '桌型': '大桌',
      '排队数': 5,
      '时段': '中午',
      '页面时间': '12:30',
      '采集日期': format(new Date(), 'yyyy-MM-dd')
    }];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "KaoJiang_Import_Template.xlsx");
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) {
        const dataBuffer = await file.arrayBuffer();
        // 1. 获取原始数据并清除首行 BOM (Byte Order Mark) 干扰
        const workbook = XLSX.read(dataBuffer); // Remove cellDates: true to avoid timezone shifts on CSV strings
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        
        if (json.length === 0) {
          alert("文件内容为空");
          return;
        }

        // 打印第一行数据的键名，方便在 Console 调试
        console.log("Detected keys in file:", Object.keys(json[0]));

        // Helper to convert Excel time number or Date to HH:mm
        const formatExcelTime = (val: any) => {
          if (typeof val === 'number') {
            const totalSeconds = Math.round(val * 24 * 3600);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
          }
          if (val instanceof Date) {
            // Using a safer way to get local time components
            const hours = String(val.getHours()).padStart(2, '0');
            const mins = String(val.getMinutes()).padStart(2, '0');
            return `${hours}:${mins}`;
          }
          // Handle long date strings that might be passed
          if (typeof val === 'string' && (val.includes('GMT') || val.length > 10)) {
            try {
              const d = new Date(val);
              if (!isNaN(d.getTime())) return format(d, 'HH:mm');
            } catch (e) {}
          }
          return String(val);
        };

        // Helper to convert Excel date number to yyyy-MM-dd
        const formatExcelDate = (val: any) => {
          if (typeof val === 'number') {
            const date = XLSX.SSF.parse_date_code(val);
            return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
          }
          if (val instanceof Date) {
            // If it's a Date object, use the year-month-day directly to avoid timezone shift
            const y = val.getFullYear();
            const m = String(val.getMonth() + 1).padStart(2, '0');
            const d = String(val.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
          }
          // If it's already a string like "2026-04-25", return it as is
          return String(val).trim();
        };

        const logsCollection = collection(db, 'queueLogs');
        let successCount = 0;
        let errorCount = 0;

        for (const row of json) {
          // 2. 超强兼容性的列名查找函数
          const findVal = (targets: string[]) => {
            const keys = Object.keys(row);
            const foundKey = keys.find(k => {
              const cleanKey = k.replace(/^\ufeff/, "").trim().toLowerCase();
              return targets.some(t => {
                const target = t.toLowerCase();
                return cleanKey === target || 
                       (cleanKey.includes(target) && cleanKey.length < target.length + 3);
              });
            });
            return foundKey ? row[foundKey] : null;
          };

          const city = formatCityName(String(findVal(['城市', 'City', '地区']) || 'Unknown'));

          const storeName = findVal(['门店', 'Store', '店名']) || 'Unknown';
          const tableType = findVal(['桌型', 'TableType', '类型']) || 'Unknown';
          const rawQueueCount = findVal(['排队数', 'Count', '排队']);
          const queueCount = parseInt(String(rawQueueCount).replace(/[^0-9]/g, '')) || 0;
          
          let pageTime = findVal(['页面时间', 'PageTime', '时间']);
          pageTime = pageTime ? formatExcelTime(pageTime) : format(new Date(), 'HH:mm');
          
          let collectionDate = findVal(['采集日期', 'Date', '日期']);
          collectionDate = collectionDate ? formatExcelDate(collectionDate) : format(new Date(), 'yyyy-MM-dd');
          
          let period = findVal(['时段', 'Period', '餐次']);
          if (!period) {
            const hourStr = String(pageTime).split(/[:：]/)[0];
            const hour = parseInt(hourStr);
            if (!isNaN(hour)) {
              if (hour >= 11 && hour <= 14) period = '中午';
              else if (hour >= 17 && hour <= 20) period = '晚上';
              else period = '其他';
            } else {
              period = '其他';
            }
          }

          try {
            await addDoc(logsCollection, {
              city: String(city),
              storeName: String(storeName),
              tableType: String(tableType),
              queueCount: Number(queueCount),
              pageTime: String(pageTime),
              period: String(period),
              collectionDate: String(collectionDate),
              uploadTime: serverTimestamp()
            });
            successCount++;
          } catch (err) {
            console.error("Row insertion error:", err);
            errorCount++;
          }
        }

        alert(`导入完成！\n成功: ${successCount} 条\n失败: ${errorCount} 条`);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } catch (err) {
      console.error("Import error:", err);
      alert("导入失败：文件解析异常。请确保文件是标准 CSV 或 Excel 格式。");
    }
  };

  const series = useMemo(() => {
    const s = new Set<string>();
    filteredData.forEach(item => {
      const key = selectedTableType === 'All' 
        ? item.storeName 
        : `${item.storeName} (${item.tableType})`;
      s.add(key);
    });
    return Array.from(s);
  }, [filteredData, selectedTableType]);

  // Grouping for chart with AGGREGATION logic
  const chartData = useMemo(() => {
    const groups: { [key: string]: any } = {};
    
    // Helper to extract HH:mm from potentially messy date strings
    const cleanTime = (t: string) => {
      if (!t) return "00:00";
      if (t.includes('GMT') || t.length > 10) {
        try {
          const d = new Date(t);
          return isNaN(d.getTime()) ? t : format(d, 'HH:mm');
        } catch(e) { return t; }
      }
      return t;
    };

    filteredData.forEach(item => {
      // Use full timestamp (Date + Time) as the unique X-axis key for spacing
      const timeLabel = cleanTime(item.pageTime);
      const dateLabel = item.collectionDate;
      const key = `${dateLabel}T${timeLabel.replace('：', ':')}`; // ISO-ish for sorting
      
      if (!groups[key]) {
        groups[key] = { 
          fullTime: key, 
          dateLabel: dateLabel, 
          timeLabel: timeLabel,
          period: item.period || '其他'
        };
      }
      
      const seriesKey = selectedTableType === 'All' 
        ? item.storeName 
        : `${item.storeName} (${item.tableType})`;

      groups[key][seriesKey] = (groups[key][seriesKey] || 0) + item.queueCount;
    });

    // Post-process to treat 0 as null for line chart continuity
    const processedData = Object.values(groups).map(group => {
      const newGroup = { ...group };
      series.forEach(s => {
        if (newGroup[s] === 0) newGroup[s] = null;
      });
      return newGroup;
    });

    return processedData.sort((a, b) => a.fullTime.localeCompare(b.fullTime));
  }, [filteredData, selectedTableType, series]);

  // Helper to only show date tick once per day
  let lastDateTick = "";
  const xAxisTickFormatter = (fullTime: string) => {
    const date = fullTime.split('T')[0];
    if (date !== lastDateTick) {
      lastDateTick = date;
      return date;
    }
    return ""; // Empty string for subsequent points on same day
  };

  const colors = [
    '#b08d57', '#d4af37', '#3b82f6', '#10b981', '#8b5cf6', 
    '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#64748b'
  ];

  // Custom dot renderer based on period
  const renderCustomDot = (props: any) => {
    const { cx, cy, stroke, payload } = props;
    if (!cx || !cy) return null;

    const period = payload.period;
    if (period === '中午') {
      return (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={4} fill={stroke} stroke="#fff" strokeWidth={1} />
      );
    } else if (period === '晚上') {
      return (
        <rect key={`${cx}-${cy}`} x={cx - 3.5} y={cy - 3.5} width={7} height={7} fill={stroke} stroke="#fff" strokeWidth={1} />
      );
    }
    return (
      <path key={`${cx}-${cy}`} d={`M${cx},${cy-4} L${cx+4},${cy+4} L${cx-4},${cy+4} Z`} fill={stroke} stroke="#fff" strokeWidth={1} />
    );
  };

  return (
    <div className="space-y-6">
      {/* Filters Header */}
      <div className="flex flex-wrap gap-4 items-center justify-between p-4 bg-white border border-zinc-200 shadow-sm">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 rounded text-xs font-bold text-zinc-500 uppercase">
            <Filter className="w-3 h-3" />
            <span>筛选</span>
          </div>
          
          <div className="relative">
            <select 
              value={selectedCity} 
              onChange={(e) => setSelectedCity(e.target.value)}
              className="appearance-none bg-white border border-zinc-200 rounded px-4 py-1.5 pr-10 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-brand-red/50 min-w-[80px]"
            >
              {cities.map(c => <option key={c} value={c}>{c === 'All' ? '所有城市' : c}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          </div>

          <div className="relative">
            <select 
              value={selectedTableType} 
              onChange={(e) => setSelectedTableType(e.target.value)}
              className="appearance-none bg-white border border-zinc-200 rounded px-4 py-1.5 pr-10 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-brand-red/50 min-w-[120px]"
            >
              {tableTypes.map(t => <option key={t} value={t}>{t === 'All' ? '所有桌型' : t}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          </div>

          <div className="relative">
            <select 
              value={selectedPeriod} 
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="appearance-none bg-white border border-zinc-200 rounded px-4 py-1.5 pr-10 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-brand-red/50"
            >
              <option value="All">全天时段</option>
              <option value="中午">中午 (11-14)</option>
              <option value="晚上">晚上 (17-20)</option>
              <option value="其他">其他时段</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          </div>

          <div className="relative">
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="appearance-none bg-white border border-zinc-200 rounded px-4 py-1.5 pr-10 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-brand-red/50"
            >
              <option value="All">月度筛选</option>
              {months.filter(m => m !== 'All').map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          </div>

          <div className="relative">
            <select 
              value={selectedWeek} 
              onChange={(e) => setSelectedWeek(e.target.value)}
              className="appearance-none bg-white border border-zinc-200 rounded px-4 py-1.5 pr-10 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-brand-red/50"
            >
              <option value="All">周度筛选</option>
              {weeks.filter(w => w !== 'All').map(w => <option key={w} value={w}>{w}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          </div>
        </div>

        <div className="flex bg-zinc-100 p-0.5 rounded">
          <button 
            onClick={() => setViewMode('line')}
            className={`p-1.5 rounded transition-all ${viewMode === 'line' ? 'bg-white shadow-sm text-brand-red' : 'text-zinc-400'}`}
          >
            <ChartIcon className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setViewMode('bar')}
            className={`p-1.5 rounded transition-all ${viewMode === 'bar' ? 'bg-white shadow-sm text-brand-red' : 'text-zinc-400'}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Chart Card */}
      <div className="bg-white border border-zinc-200 p-6 shadow-sm">
        <div className="flex justify-between items-center mb-8">
          <div className="space-y-1">
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-900">
              {selectedCity}门店取号量趋势
            </h3>
            <p className="text-[9px] text-zinc-400 font-bold uppercase">
              时段: {selectedPeriod === 'All' ? '全天' : selectedPeriod} | 桌型: {selectedTableType === 'All' ? '汇总' : selectedTableType}
            </p>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 max-w-md justify-end">
            <div className="flex items-center gap-4 mr-4 pr-4 border-r border-zinc-100">
              <div className="flex items-center gap-1 text-[9px] font-bold text-zinc-400 uppercase">
                <svg width="10" height="10" className="inline-block">
                  <circle cx="5" cy="5" r="3.5" fill="#a1a1aa" />
                </svg>
                <span>中午</span>
              </div>
              <div className="flex items-center gap-1 text-[9px] font-bold text-zinc-400 uppercase">
                <div className="w-2.5 h-2.5 bg-zinc-400" />
                <span>晚上</span>
              </div>
              <div className="flex items-center gap-1 text-[9px] font-bold text-zinc-400 uppercase">
                <svg width="10" height="10" className="inline-block">
                   <path d="M5,1 L9,9 L1,9 Z" fill="#a1a1aa" />
                </svg>
                <span>其他</span>
              </div>
            </div>
            {series.slice(0, 5).map((s, idx) => (
              <div key={s} className="flex items-center gap-1.5 text-[9px] font-bold uppercase text-zinc-500">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[idx % colors.length] }}></span>
                <span>{s}</span>
              </div>
            ))}
            {series.length > 5 && <span className="text-[9px] text-zinc-300">+{series.length - 5} 更多门店</span>}
          </div>
        </div>

        <div className="h-[400px]">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              {viewMode === 'line' ? (
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                  <XAxis 
                    dataKey="fullTime" 
                    tickFormatter={xAxisTickFormatter}
                    axisLine={{ stroke: '#e4e4e7' }}
                    tickLine={false} 
                    tick={{ fill: '#a1a1aa', fontSize: 10, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#a1a1aa', fontSize: 10, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }} 
                  />
                  <Tooltip 
                    labelFormatter={(label: string) => {
                      const parts = label.split('T');
                      return `${parts[0]} ${parts[1] || ''}`;
                    }}
                    contentStyle={{ 
                      borderRadius: '4px', 
                      border: '1px solid #e4e4e7', 
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      fontSize: '11px',
                      fontFamily: 'Inter, sans-serif'
                    }}
                    labelClassName="font-bold text-zinc-400 mb-1 block"
                  />
                  {series.map((s, idx) => (
                    <Line 
                      key={s}
                      type="monotone"
                      dataKey={s}
                      stroke={colors[idx % colors.length]}
                      strokeWidth={2}
                      dot={renderCustomDot}
                      activeDot={{ r: 5, strokeWidth: 0 }}
                      animationDuration={800}
                      connectNulls={true}
                    />
                  ))}
                </LineChart>
              ) : (
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                  <XAxis 
                    dataKey="fullTime" 
                    tickFormatter={xAxisTickFormatter}
                    axisLine={{ stroke: '#e4e4e7' }}
                    tickLine={false} 
                    tick={{ fill: '#a1a1aa', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#a1a1aa', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }} 
                  />
                  <Tooltip 
                    labelFormatter={(label: string) => {
                      const parts = label.split('T');
                      return `${parts[0]} ${parts[1] || ''}`;
                    }}
                    cursor={{ fill: '#fafafa' }}
                    contentStyle={{ 
                      borderRadius: '4px', 
                      border: '1px solid #e4e4e7', 
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      fontSize: '11px'
                    }}
                  />
                  {series.map((s, idx) => (
                    <Bar 
                      key={s}
                      dataKey={s}
                      fill={colors[idx % colors.length]}
                      radius={[2, 2, 0, 0]}
                    />
                  ))}
                </BarChart>
              )}
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-zinc-300 space-y-3">
              <div className="w-12 h-12 bg-zinc-50 border border-zinc-100 rounded flex items-center justify-center">
                <Filter className="w-5 h-5" />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-wider">暂无数据</p>
            </div>
          )}
        </div>
      </div>

      {/* Raw Data Table */}
      <div className="bg-white rounded-none border border-zinc-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-zinc-200 bg-zinc-50 flex flex-wrap gap-4 justify-between items-center">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">采集数据管理</h3>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 border-r border-zinc-200 pr-3 mr-1">
              <span className="text-[9px] font-black uppercase text-zinc-400">{filteredData.length} 条符合筛选</span>
            </div>

            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImport} 
              className="hidden" 
              accept=".csv, .xlsx, .xls"
            />

            <button 
              onClick={runCityMigration}
              disabled={migrating}
              className="text-[9px] font-black uppercase bg-amber-500 text-white px-3 py-1.5 rounded flex items-center gap-1.5 hover:bg-amber-600 transition-colors disabled:opacity-50"
            >
              <Zap className="w-3 h-3" />
              {migrating ? '清洗中...' : '清洗存量城市数据'}
            </button>

            <button 
              onClick={() => fileInputRef.current?.click()}
              className="text-[9px] font-black uppercase bg-zinc-950 text-white px-3 py-1.5 rounded flex items-center gap-1.5 hover:bg-zinc-800 transition-colors"
            >
              <Upload className="w-3 h-3" />
              导入表格 (Excel/CSV)
            </button>

            <button 
              onClick={exportToExcel}
              className="text-[9px] font-black uppercase text-brand-red bg-[rgba(176,141,87,0.1)] border border-[rgba(176,141,87,0.2)] px-3 py-1.5 rounded flex items-center gap-1.5 hover:bg-[rgba(176,141,87,0.2)] transition-colors"
            >
              <FileSpreadsheet className="w-3 h-3" />
              导出 EXCEL
            </button>

            <button 
              onClick={exportToCSV}
              className="text-[9px] font-black uppercase text-zinc-500 bg-zinc-100 px-3 py-1.5 rounded flex items-center gap-1.5 hover:bg-zinc-200 transition-colors"
            >
              <FileText className="w-3 h-3" />
              导出 CSV
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-100 bg-white">
                <th className="px-5 py-3 text-[9px] font-black uppercase text-zinc-400">门 店 名 称</th>
                <th className="px-5 py-3 text-[9px] font-black uppercase text-zinc-400">时 段</th>
                <th className="px-5 py-3 text-[9px] font-black uppercase text-zinc-400">桌 型</th>
                <th className="px-5 py-3 text-center text-[9px] font-black uppercase text-zinc-400">取 号 量</th>
                <th className="px-5 py-3 text-center text-[9px] font-black uppercase text-zinc-400">页 面 时 间</th>
                <th className="px-5 py-3 text-right text-[9px] font-black uppercase text-zinc-400">采 集 日 期</th>
                <th className="px-5 py-3 text-right text-[9px] font-black uppercase text-zinc-400">操 作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 text-[11px]">
              {filteredData.slice(0, 50).map((item, idx) => (
                 <tr key={item.id || idx} className="hover:bg-zinc-50 transition-colors group">
                   <td className="px-5 py-3 font-bold text-zinc-900">{item.storeName}</td>
                   <td className="px-5 py-3">
                     <span className={`px-2 py-0.5 rounded-sm font-bold text-[9px] uppercase ${
                       item.period === '中午' ? 'bg-orange-50 text-orange-600 border border-orange-100' :
                       item.period === '晚上' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' :
                       'bg-zinc-100 text-zinc-500'
                     }`}>
                       {item.period || '其他'}
                     </span>
                   </td>
                   <td className="px-5 py-3 text-zinc-500">{item.tableType}</td>
                   <td className="px-5 py-3 text-center">
                     <span className="font-mono font-bold text-brand-red bg-[rgba(176,141,87,0.1)] px-2 py-1 border border-[rgba(176,141,87,0.2)]">
                       {item.queueCount}
                     </span>
                   </td>
                   <td className="px-5 py-3 text-center font-mono text-zinc-400">
                     {item.pageTime && (item.pageTime.includes('GMT') || item.pageTime.length > 10) 
                       ? (function() {
                           try {
                             const d = new Date(item.pageTime);
                             return isNaN(d.getTime()) ? item.pageTime : format(d, 'HH:mm');
                           } catch(e) { return item.pageTime; }
                         })()
                       : item.pageTime
                     }
                   </td>
                   <td className="px-5 py-3 text-right font-mono text-zinc-400">{item.collectionDate}</td>
                   <td className="px-5 py-3 text-right">
                     <button 
                       onClick={() => item.id && handleDelete(item.id)}
                       className="p-2 text-zinc-400 hover:text-red-700 transition-colors opacity-40 group-hover:opacity-100"
                       title="删除记录"
                     >
                       <Trash2 className="w-4 h-4" />
                     </button>
                   </td>
                 </tr>
              ))}
            </tbody>
          </table>
          {filteredData.length === 0 && (
            <div className="p-10 text-center text-zinc-300 font-bold uppercase text-[10px]">
              没有找符合条件的数据
            </div>
          )}
          {filteredData.length > 50 && (
            <div className="p-4 text-center text-zinc-400 text-[10px] font-black uppercase bg-zinc-50/50">
              仅展示前 50 条记录 (共 {filteredData.length} 条)
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
