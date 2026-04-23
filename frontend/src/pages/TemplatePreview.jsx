import React, { useState, useEffect, useRef } from 'react';
import { Layout, Monitor, Smartphone, Maximize2, Loader, Image as ImageIcon, Save, Move, Eye, EyeOff, Hash } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getTemplateHtml, getTemplateSettings, saveTemplateSettings, getTemplates, uploadDesign, getParticipants } from '../api';

const TemplatePreview = () => {
  const [activeTemplate, setActiveTemplate] = useState('');
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [settings, setSettings] = useState({
    showLogo: true,
    transforms: {
      NAME: { x: 0, y: 0 },
      TEAM: { x: 0, y: 0 },
      POSITION: { x: 0, y: 0 },
      DATE: { x: 0, y: 0 },
      LOGO: { x: 0, y: 0 },
      SIGNATURE: { x: 0, y: 0 }
    }
  });

  const [bgUrl, setBgUrl] = useState('');
  const [participants, setParticipants] = useState([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const canvasRef = useRef(null);

  useEffect(() => {
    fetchList();
  }, []);

  const fetchList = async () => {
    try {
      const [tplRes, partRes] = await Promise.all([
        getTemplates(),
        getParticipants()
      ]);
      setTemplates(tplRes.data);
      setParticipants(partRes.data);
      if (tplRes.data.length > 0) setActiveTemplate(tplRes.data[0].id);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (!activeTemplate) return;
    fetchTemplate();
  }, [activeTemplate]);

  const fetchTemplate = async () => {
    setLoading(true);
    try {
      const [htmlRes, settingsRes] = await Promise.all([
        getTemplateHtml(activeTemplate),
        getTemplateSettings(activeTemplate)
      ]);
      
      // Extract background image from HTML
      const imgMatch = htmlRes.data.match(/background-image: url\('([^']+)'\)/);
      if (imgMatch) setBgUrl(imgMatch[1]);

      const s = settingsRes.data;
      setSettings({
        showLogo: s.showLogo !== false,
        transforms: {
          NAME: { x: 0, y: 0, ...s.transforms?.NAME },
          TEAM: { x: 0, y: 0, ...s.transforms?.TEAM },
          POSITION: { x: 0, y: 0, ...s.transforms?.POSITION },
          DATE: { x: 0, y: 0, ...s.transforms?.DATE },
          LOGO: { x: 0, y: 0, ...s.transforms?.LOGO },
          SIGNATURE: { x: 0, y: 0, ...s.transforms?.SIGNATURE }
        }
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDragUpdate = (param, info) => {
    const { x, y } = info.point;
    // We need relative displacement, but framer motion drag gives us offsets.
    // However, it's easier to use the 'dragTransition' or just the delta.
  };

  const updateTransform = (param, x, y) => {
    setSettings(prev => ({
      ...prev,
      transforms: {
        ...prev.transforms,
        [param]: { x, y }
      }
    }));
  };

  const handleDragEnd = (param, e, info) => {
    // Framer motion 'offset' in info is exactly what we need for translate
    const newX = settings.transforms[param].x + info.offset.x;
    const newY = settings.transforms[param].y + info.offset.y;
    updateTransform(param, newX, newY);
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      await saveTemplateSettings(activeTemplate, settings);
      alert('Positions and Branding saved!');
    } catch (e) {
      alert('Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const Placeholder = ({ id, label, color = "text-slate-900" }) => (
    <motion.div
      drag
      dragMomentum={false}
      onDragEnd={(e, info) => handleDragEnd(id, e, info)}
      style={{ 
        x: settings.transforms[id].x, 
        y: settings.transforms[id].y,
        position: 'absolute',
        cursor: 'grab'
      }}
      className={`select-none p-2 border-2 border-dashed border-transparent hover:border-brand-500 hover:bg-brand-50/50 rounded transition-colors group z-20`}
    >
       <span className={`font-bold ${color} text-2xl uppercase tracking-tighter whitespace-nowrap`}>
         {label}
       </span>
       <div className="absolute -top-6 left-0 bg-brand-600 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
          Drag: {id} ({settings.transforms[id].x}, {settings.transforms[id].y})
       </div>
    </motion.div>
  );

  return (
    <div className="max-w-7xl mx-auto h-[calc(100vh-140px)] flex flex-col">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center">
            Design Editor <span className="ml-3 text-xs bg-brand-100 text-brand-600 px-2 py-1 rounded-full uppercase tracking-widest font-black">Pro</span>
          </h1>
          <p className="text-slate-500 mt-2">Position placeholders and preview real CSV data before generation.</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-sm">
            {templates.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTemplate(t.id)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTemplate === t.id ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>

          {/* BIG UPLOAD BUTTON - IMPOSSIBLE TO MISS */}
          <div className="relative">
             <input type="file" id="design-upload-direct" className="hidden" accept="image/*" onChange={async (e) => {
                const file = e.target.files[0];
                if (file) {
                   try {
                     await uploadDesign(file);
                     alert('Design Uploaded Successfully! Page will refresh to show your new template.');
                     window.location.reload();
                   } catch (err) {
                     alert("Upload failed. Only PNG/JPG supported.");
                   }
                }
             }} />
             <label 
               htmlFor="design-upload-direct"
               className="flex items-center px-10 py-3 bg-brand-600 text-white rounded-lg text-lg font-black hover:bg-brand-700 cursor-pointer shadow-2xl animate-pulse transition-all border-4 border-brand-200"
             >
                <ImageIcon className="w-6 h-6 mr-3 text-white" />
                NEW DESIGN: UPLOAD HERE
             </label>
          </div>

          <button 
            onClick={saveConfig}
            disabled={saving}
            className="flex items-center px-6 py-2.5 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 shadow-lg shadow-brand-500/30 transition-all">
            {saving ? <Loader className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
            Save Layout
          </button>
        </div>
      </div>

      <div className="flex-1 glass-panel p-2 flex flex-col md:flex-row shadow-xl overflow-hidden relative border border-slate-200">
          
        {/* Editor Settings Sidebar */}
        <div className="w-full md:w-80 bg-white/50 p-6 flex flex-col border-r border-slate-200 overflow-y-auto custom-scrollbar">
           
           <div className="mb-6">
              <h3 className="font-bold text-slate-800 flex items-center text-sm uppercase tracking-wider mb-4">
                <Monitor className="w-4 h-4 mr-2 text-brand-500"/> Preview Data
              </h3>
              
              <div className="space-y-3">
                 <select 
                   value={previewIndex}
                   onChange={(e) => setPreviewIndex(parseInt(e.target.value))}
                   className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500"
                 >
                    {participants.length === 0 ? (
                      <option disabled>No CSV data uploaded</option>
                    ) : (
                      participants.map((p, idx) => (
                        <option key={idx} value={idx}>
                          Row {idx + 1}: {p.Name || p.name || 'No Name'}
                        </option>
                      ))
                    )}
                 </select>
                 <p className="text-[10px] text-slate-400 font-medium px-1">
                   {participants.length} records found in session.
                 </p>
              </div>
           </div>

           <div className="mb-6">
              <h3 className="font-bold text-slate-800 flex items-center text-sm uppercase tracking-wider mb-4">
                <Layout className="w-4 h-4 mr-2 text-brand-500"/> Logo Overlay
              </h3>
              
              <div className="space-y-3">
                 <button 
                   onClick={() => setSettings(s => ({ ...s, showLogo: !s.showLogo }))}
                   className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all ${settings.showLogo ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-500'}`}
                 >
                    <div className="flex items-center font-bold">
                       {settings.showLogo ? <Eye className="w-4 h-4 mr-2"/> : <EyeOff className="w-4 h-4 mr-2"/>}
                       Display Logo
                    </div>
                    <div className={`w-10 h-6 rounded-full relative transition-colors ${settings.showLogo ? 'bg-brand-500' : 'bg-slate-200'}`}>
                       <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.showLogo ? 'left-5' : 'left-1'}`} />
                    </div>
                 </button>
              </div>
           </div>

           <div className="mt-2 mb-6">
             <h3 className="font-bold text-slate-800 flex items-center text-sm uppercase tracking-wider mb-4">
               <Hash className="w-4 h-4 mr-2 text-brand-500"/> Fine Tuning
             </h3>
             
             <div className="space-y-4">
                {Object.keys(settings.transforms).map(param => (
                  <div key={param} className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                     <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{param}</span>
                        <span className="text-[10px] font-mono text-slate-500">{settings.transforms[param].x}, {settings.transforms[param].y}</span>
                     </div>
                     <div className="flex items-center space-x-2">
                        <input type="range" min="-1000" max="1000" value={settings.transforms[param].x} 
                           onChange={(e) => updateTransform(param, parseInt(e.target.value), settings.transforms[param].y)}
                           className="flex-1 h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-brand-500" />
                        <input type="range" min="-1000" max="1000" value={settings.transforms[param].y} 
                           onChange={(e) => updateTransform(param, settings.transforms[param].x, parseInt(e.target.value))}
                           className="flex-1 h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-brand-400" />
                     </div>
                  </div>
                ))}
             </div>
           </div>
        </div>

        {/* Draggable Canvas Area */}
        <div className="flex-1 bg-slate-100/80 overflow-auto relative flex items-start justify-center p-8 custom-scrollbar">
            {loading ? (
               <div className="flex flex-col items-center mt-20 text-slate-400">
                 <Loader className="w-10 h-10 animate-spin mb-4 text-brand-500" />
                 <p className="font-medium">Building Interactive Layer...</p>
               </div>
            ) : (
              <div 
                ref={canvasRef}
                style={{ 
                  width: '1122.5px', // A4 Landscape at 96dpi
                  height: '793.7px',
                  backgroundImage: `url('${bgUrl}')`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  boxShadow: '0 20px 50px rgba(0,0,0,0.1)',
                  position: 'relative'
                }}
                className="bg-white rounded-sm shrink-0 overflow-hidden"
              >
                  {/* Field Placeholders */}
                  <div className="absolute inset-0 z-10 pointer-events-none border-4 border-slate-900/5" />
                  
                  <div className="w-full absolute" style={{ top: '45%', left: 0, display: 'flex', justifyContent: 'center' }}>
                     <Placeholder id="NAME" label={participants[previewIndex]?.Name || participants[previewIndex]?.name || "NAME PLACEHOLDER"} color="text-slate-900" />
                  </div>

                  <div className="w-full absolute" style={{ top: '55%', left: 0, display: 'flex', justifyContent: 'center' }}>
                     <Placeholder id="TEAM" label={participants[previewIndex]?.Team || participants[previewIndex]?.team || "TEAM PLACEHOLDER"} color="text-slate-500" />
                  </div>

                  <div className="w-full absolute" style={{ top: '65%', left: 0, display: 'flex', justifyContent: 'center' }}>
                     <Placeholder id="POSITION" label={participants[previewIndex]?.Position || participants[previewIndex]?.position || "POSITION"} color="text-brand-600" />
                  </div>

                  <div className="w-full absolute" style={{ bottom: '100px', right: '100px', display: 'flex', justifyContent: 'flex-end' }}>
                     <Placeholder id="SIGNATURE" label="(SIGNATURE)" color="text-slate-400" />
                  </div>

                  <div className="absolute top-10 right-10">
                     <Placeholder id="DATE" label={participants[previewIndex]?.Date || participants[previewIndex]?.date || new Date().toLocaleDateString()} color="text-slate-400" />
                  </div>

                  {settings.showLogo && (
                    <div className="absolute top-12 left-12">
                        <motion.div
                          drag
                          dragMomentum={false}
                          onDragEnd={(e, info) => handleDragEnd('LOGO', e, info)}
                          style={{ 
                             x: settings.transforms.LOGO.x, 
                             y: settings.transforms.LOGO.y,
                             position: 'absolute',
                             cursor: 'grab'
                          }}
                          className="group p-2 border-2 border-dashed border-transparent hover:border-brand-500 rounded"
                       >
                          <div className="bg-slate-200 border-2 border-slate-300 w-32 h-16 rounded flex items-center justify-center text-slate-400 font-bold text-[10px] uppercase">
                             Logo Placeholder
                          </div>
                          <div className="absolute -top-6 left-0 bg-brand-600 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                             Position Logo
                          </div>
                       </motion.div>
                    </div>
                  )}
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default TemplatePreview;
