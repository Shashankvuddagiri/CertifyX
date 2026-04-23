import React, { useState, useEffect } from 'react';
import { Users, FileCheck, MailCheck, AlertOctagon, UploadCloud, FileImage, Send, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { getStats } from '../api';
import { useNavigate } from 'react-router-dom';

const StatCard = ({ title, value, icon: Icon, color, delay }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.4 }}
    className="glass-panel p-6 flex items-center justify-between hover:-translate-y-1 transition-transform duration-300"
  >
    <div>
      <p className="text-slate-500 font-medium text-sm">{title}</p>
      <h3 className="text-3xl font-bold text-slate-800 mt-2">{value}</h3>
    </div>
    <div className={`w-14 h-14 rounded-full flex items-center justify-center ${color}`}>
      <Icon className="w-7 h-7 text-white" />
    </div>
  </motion.div>
);

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    total: 0,
    generated: 0,
    sent: 0,
    failed: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    // Poll every 10 seconds for live updates
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const response = await getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statItems = [
    { title: 'Total Participants', value: stats.total.toLocaleString(), icon: Users, color: 'bg-blue-500 shadow-lg shadow-blue-500/40' },
    { title: 'Generated PDFs', value: stats.generated.toLocaleString(), icon: FileCheck, color: 'bg-emerald-500 shadow-lg shadow-emerald-500/40' },
    { title: 'Emails Sent', value: stats.sent.toLocaleString(), icon: MailCheck, color: 'bg-purple-500 shadow-lg shadow-purple-500/40' },
    { title: 'Failed/Pending Email', value: stats.failed.toLocaleString(), icon: AlertOctagon, color: 'bg-rose-500 shadow-lg shadow-rose-500/40' },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Platform Overview</h1>
          <p className="text-slate-500 mt-2">Monitor your certificate generation and email campaigns live.</p>
        </div>
        <button 
          onClick={fetchStats}
          className="p-2 text-slate-400 hover:text-brand-600 transition-colors"
          title="Refresh Stats"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-10">
        {statItems.map((stat, idx) => (
          <StatCard key={idx} {...stat} delay={idx * 0.1} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="lg:col-span-2 glass-panel p-6 min-h-[350px] flex flex-col"
        >
          <h3 className="text-xl font-bold text-slate-800 mb-4">Pipeline Health</h3>
          <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
             {stats.total === 0 ? (
               <div className="text-center p-8">
                 <Users className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                 <p className="text-slate-500 font-medium">No data in system</p>
                 <p className="text-slate-400 text-sm mt-1">Upload a CSV to begin the automation pipeline.</p>
               </div>
             ) : (
               <div className="w-full max-w-md px-8">
                 <div className="space-y-6">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-bold text-slate-600">PDF Generation</span>
                        <span className="text-emerald-600 font-bold">{Math.round((stats.generated / stats.total) * 100)}%</span>
                      </div>
                      <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${(stats.generated / stats.total) * 100}%` }}
                          className="h-full bg-emerald-500"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-bold text-slate-600">Email Distribution</span>
                        <span className="text-purple-600 font-bold">{Math.round((stats.sent / stats.total) * 100)}%</span>
                      </div>
                      <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${(stats.sent / stats.total) * 100}%` }}
                          className="h-full bg-purple-500"
                        />
                      </div>
                    </div>
                 </div>
               </div>
             )}
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="glass-panel p-6 bg-gradient-to-br from-brand-900 to-slate-900 text-white min-h-[350px] relative overflow-hidden flex flex-col shadow-2xl shadow-brand-900/40"
        >
           <div className="absolute -right-10 -top-10 w-40 h-40 bg-brand-500/30 rounded-full blur-3xl"></div>
           <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-neon-blue/20 rounded-full blur-3xl"></div>
           
           <h3 className="text-xl font-bold mb-6 relative z-10">Smart Actions</h3>
           
            <div className="space-y-4 relative z-10 flex-1">
               <button 
                 onClick={() => navigate('/operations')}
                 className="w-full py-4 px-4 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition duration-200 text-left font-medium flex items-center group"
               >
                 <div className="w-10 h-10 bg-brand-500/20 rounded-lg flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                   <UploadCloud className="w-5 h-5 text-brand-400" />
                 </div>
                 <span>Sync Participant Data</span>
               </button>
               
               <button 
                 onClick={() => navigate('/operations')}
                 className="w-full py-4 px-4 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition duration-200 text-left font-medium flex items-center group"
               >
                 <div className="w-10 h-10 bg-pink-500/20 rounded-lg flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                   <FileImage className="w-5 h-5 text-pink-400" />
                 </div>
                 <span>Configure Visual Editor</span>
               </button>

               <button 
                 onClick={() => navigate('/operations')}
                 className="w-full py-4 px-4 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition duration-200 text-left font-medium flex items-center group"
               >
                 <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                   <Send className="w-5 h-5 text-emerald-400" />
                 </div>
                 <span>Launch Dispatcher</span>
               </button>
            </div>
           
           <div className="relative z-10 p-4 bg-brand-500/10 rounded-xl border border-brand-500/20 mt-4">
              <p className="text-xs text-brand-200 leading-relaxed uppercase tracking-widest font-bold">System Status</p>
              <div className="flex items-center mt-1">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse mr-2"></div>
                <p className="text-sm font-bold text-white">All Engines Online</p>
              </div>
           </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;
