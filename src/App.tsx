import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { auth, db, loginWithGoogle, handleFirestoreError, OperationType } from './lib/firebase';
import { QueueEntry } from './types';
import { Dashboard } from './components/Dashboard';
import { UploadZone } from './components/UploadZone';
import { 
  BarChart3, 
  MapPin, 
  Upload as UploadIcon, 
  LogOut, 
  LogIn,
  TrendingUp,
  Flame,
  LayoutGrid,
  Zap,
  Activity,
  History,
  Camera
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [logs, setLogs] = useState<QueueEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'visualize' | 'ocr'>('visualize');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) {
      setLogs([]);
      return;
    }

    const q = query(collection(db, 'queueLogs'), orderBy('uploadTime', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          ...d,
          id: doc.id,
          uploadTime: (d.uploadTime as Timestamp)?.toDate?.()?.toISOString() || new Date().toISOString()
        } as QueueEntry;
      });
      setLogs(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'queueLogs');
    });

    return unsubscribe;
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <motion.div 
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        >
          <div className="w-12 h-12 bg-brand-red rounded-sm flex items-center justify-center font-bold text-white text-xs shadow-xl shadow-red-900/40">KJ</div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-zinc-100 text-zinc-950 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-zinc-950 text-white flex flex-col border-r border-zinc-800">
        <div className="px-6 h-20 flex items-center gap-3 border-b border-zinc-800 shrink-0">
          <div className="w-8 h-8 bg-brand-red rounded-sm flex items-center justify-center font-black text-xs">KJ</div>
          <div>
            <h1 className="text-xs font-black tracking-widest uppercase truncate">烤匠数据监测</h1>
            <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-tighter">Monitoring System</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-6 overflow-y-auto custom-scrollbar">
          {user && (
            <>
              <div>
                <p className="text-[10px] uppercase text-zinc-500 font-black mb-3 px-2 tracking-widest">功能导航</p>
                <ul className="space-y-1">
                  <li>
                    <button 
                      onClick={() => setActiveTab('visualize')}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded text-xs font-bold transition-colors ${
                        activeTab === 'visualize' ? 'bg-brand-red text-white' : 'text-zinc-400 hover:bg-zinc-900 overflow-hidden'
                      }`}
                    >
                      <Activity className="w-3.5 h-3.5" />
                      数据工作台
                    </button>
                  </li>
                  <li>
                    <button 
                      onClick={() => setActiveTab('ocr')}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded text-xs font-bold transition-colors ${
                        activeTab === 'ocr' ? 'bg-brand-red text-white' : 'text-zinc-400 hover:bg-zinc-900 overflow-hidden'
                      }`}
                    >
                      <Camera className="w-3.5 h-3.5" />
                      截图 OCR 识别
                    </button>
                  </li>
                </ul>
              </div>

              <div>
                <p className="text-[10px] uppercase text-zinc-500 font-black mb-3 px-2 tracking-widest">监测节点</p>
                <div className="grid grid-cols-1 gap-2 p-1 bg-zinc-900 rounded">
                  {['北京', '西安', '上海'].map(city => (
                    <div key={city} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-zinc-800 cursor-pointer text-[10px] font-bold text-zinc-400">
                      <span>{city}门店</span>
                      <span className="text-[8px] bg-zinc-800 border border-zinc-700 px-1 rounded">Active</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </nav>

        {user ? (
          <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
            <div className="flex items-center gap-3 mb-4">
              <img src={user.photoURL || ''} alt="" className="w-8 h-8 rounded-sm grayscale border border-zinc-700" />
              <div className="overflow-hidden">
                <p className="text-[10px] font-bold truncate">{user.displayName}</p>
                <p className="text-[9px] text-zinc-500 truncate">{user.email}</p>
              </div>
            </div>
            <button 
              onClick={() => auth.signOut()}
              className="w-full flex items-center justify-center gap-2 py-2 border border-zinc-800 text-zinc-500 text-[10px] font-bold uppercase hover:bg-zinc-800 hover:text-white transition-all rounded"
            >
              <LogOut className="w-3 h-3" />
              退出系统
            </button>
          </div>
        ) : (
          <div className="p-4 border-t border-zinc-800 shrink-0">
             <p className="text-[9px] text-zinc-500 font-bold text-center mb-3">需要权限进行访问</p>
             <button 
                onClick={loginWithGoogle}
                className="w-full flex items-center justify-center gap-2 bg-brand-red py-2.5 rounded text-[10px] font-black uppercase text-white shadow-lg shadow-red-900/20"
              >
                <LogIn className="w-3 h-3" />
                Google 登录
              </button>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-zinc-100">
        <header className="h-20 bg-white border-b border-zinc-200 px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-zinc-900">
              {activeTab === 'visualize' ? '门店排队数据综合看板' : 'OCR 智能识别与数据采集'}
            </h2>
            <div className="flex gap-2 items-center">
              <span className="text-[9px] font-black uppercase bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded text-zinc-500">
                更新: {new Date().toLocaleTimeString()}
              </span>
              <span className="text-[9px] font-black uppercase bg-green-50 border border-green-100 px-2 py-0.5 rounded text-green-600 flex items-center gap-1">
                <Zap className="w-3 h-3" />
                System Live
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="text-right">
                <p className="text-[10px] font-black uppercase text-zinc-400">系统节点</p>
                <p className="text-xs font-mono font-bold uppercase">cloud-engine-01</p>
             </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
          <div className="max-w-7xl mx-auto space-y-8">
            {!user ? (
               <div className="h-[60vh] flex flex-col items-center justify-center">
                  <div className="p-8 bg-white border border-zinc-200 rounded max-w-md text-center space-y-6">
                    <div className="w-16 h-16 bg-zinc-50 rounded-lg border border-zinc-100 flex items-center justify-center mx-auto text-zinc-300">
                      <LayoutGrid className="w-8 h-8" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black uppercase mb-2">系统锁定</h2>
                      <p className="text-xs text-zinc-500 font-bold uppercase leading-relaxed">
                        该门户包含内部门店运营指标数据。请通过企业账号验证以解锁数据可视化和采集模块。
                      </p>
                    </div>
                    <button 
                      onClick={loginWithGoogle}
                      className="w-full bg-zinc-950 text-white py-3 rounded text-xs font-black uppercase hover:bg-zinc-900 transition-all flex items-center justify-center gap-2"
                    >
                      <LogIn className="w-4 h-4" />
                      发起身份验证
                    </button>
                  </div>
               </div>
            ) : (
              <AnimatePresence mode="wait">
                {activeTab === 'visualize' ? (
                  <motion.div
                    key="viz"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-8"
                  >
                    {/* Summary Stats Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <StatCard 
                        label="数据采集总量" 
                        value={logs.length} 
                        change="+15.4%" 
                        isPositive={true}
                        unit="POINTS"
                      />
                      <StatCard 
                        label="监测城市覆盖" 
                        value={new Set(logs.map(l => l.city)).size} 
                        change="COMPLETE" 
                        unit="CITIES"
                      />
                      <StatCard 
                        label="单店峰值负载" 
                        value={Math.max(...logs.map(l => l.queueCount), 0)} 
                        change="-2.1%" 
                        isPositive={false}
                        unit="TABLES"
                      />
                      <StatCard 
                        label="OCR 识别胜任率" 
                        value="99.2" 
                        change="AI POWERED" 
                        unit="PERCENT"
                      />
                    </div>

                    <Dashboard data={logs} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="ocr"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="max-w-4xl mx-auto"
                  >
                    <div className="bg-white border border-zinc-200 shadow-xl overflow-hidden">
                      <div className="p-8 border-b border-zinc-100 flex items-center justify-between">
                         <div>
                            <h2 className="text-xl font-black uppercase mb-1">AI 截图采集终端</h2>
                            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest leading-loose">
                              支持批量截图上传 · 自动提取时间/门店/队列 · 系统实时云校对
                            </p>
                         </div>
                         <div className="p-2 bg-zinc-50 border border-zinc-100 rounded flex gap-2">
                            <Activity className="w-4 h-4 text-green-500" />
                            <span className="text-[10px] font-bold text-zinc-500 uppercase">Engine V3.4</span>
                         </div>
                      </div>
                      <div className="p-8">
                        <UploadZone onUploadComplete={() => {}} />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>
        </div>

        <footer className="h-12 bg-white border-t border-zinc-200 px-8 flex items-center justify-between shrink-0">
          <div className="flex gap-4 items-center opacity-60">
             <span className="text-[9px] font-black uppercase tracking-widest">KJ-DATA-SYSTEM © 2026</span>
             <span className="w-1 h-1 bg-zinc-300 rounded-full"></span>
             <span className="text-[9px] font-bold uppercase text-zinc-400">Powered by Gemini Flash 2.0</span>
          </div>
          <div className="flex gap-3 text-[9px] font-black uppercase text-zinc-400">
             <a href="#" className="hover:text-brand-red transition-colors">隐私政策</a>
             <a href="#" className="hover:text-brand-red transition-colors">数据处理协议</a>
          </div>
        </footer>
      </main>
    </div>
  );
}

function StatCard({ label, value, change, isPositive, unit }: { label: string, value: string | number, change: string, isPositive?: boolean, unit: string }) {
  return (
    <div className="bg-white p-5 border border-zinc-200 shadow-sm flex flex-col justify-between group hover:border-zinc-400 transition-all">
      <div>
        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1 group-hover:text-zinc-600">{label}</p>
        <div className="flex items-baseline justify-between">
          <h4 className="text-2xl font-mono font-black tracking-tighter">{value}</h4>
          <span className="text-[10px] font-mono font-bold text-zinc-300">{unit}</span>
        </div>
      </div>
      <div className="mt-2 pt-4 border-t border-zinc-50 flex items-center justify-between">
        <span className={`text-[10px] font-black uppercase ${isPositive === undefined ? 'text-zinc-400' : isPositive ? 'text-green-600' : 'text-brand-red'}`}>
          {isPositive === true ? '+' : isPositive === false ? '-' : ''}{change}
        </span>
        <Activity className="w-3 h-3 text-zinc-100 group-hover:text-zinc-300 transition-colors" />
      </div>
    </div>
  );
}
