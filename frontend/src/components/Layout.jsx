import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, UploadCloud, FileImage, Send, Award } from 'lucide-react';
import { motion } from 'framer-motion';

const Layout = ({ children }) => {
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Mail Merge Hub', path: '/operations', icon: Send },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <motion.aside 
        initial={{ x: -250 }} 
        animate={{ x: 0 }} 
        className="w-64 bg-slate-900 border-r border-slate-800 text-white flex flex-col"
      >
        <div className="h-20 flex items-center px-6 border-b border-slate-800">
          <Award className="text-brand-500 mr-3 h-8 w-8" />
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-brand-400 to-neon-blue">
            CertifyX
          </h1>
        </div>
        
        <nav className="flex-1 px-4 py-8 space-y-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            
            return (
              <NavLink
                key={item.name}
                to={item.path}
                className={`flex items-center px-4 py-3 rounded-xl transition-all duration-200 group ${
                  isActive 
                    ? 'bg-brand-600 shadow-[0_0_15px_rgba(37,99,235,0.4)] text-white' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className={`h-5 w-5 mr-3 transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                <span className="font-medium">{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 text-sm text-slate-500 text-center">
          <p>© 2026 CertifyX Engine</p>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Top Header Layer */}
        <header className="absolute top-0 z-10 w-full h-20 glass-panel border-x-0 border-t-0 rounded-none bg-white/60 px-8 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-800 capitalize">
            {location.pathname.substring(1) || 'Dashboard'}
          </h2>
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold border border-brand-200">
              A
            </div>
          </div>
        </header>

        {/* Scrollable Page Content */}
        <main className="flex-1 overflow-y-auto pt-24 pb-8 px-8 z-0">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="h-full"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
