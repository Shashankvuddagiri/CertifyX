import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, FileText, Table as TableIcon, ArrowRight, ArrowLeft, 
  Image as ImageIcon, Move, Save, Eye, Play, Send, CheckCircle, 
  AlertCircle, Loader, Server, Mail, X, Monitor, ChevronRight, Hash,
  MousePointer2, Layers, Type, Calendar, User, Briefcase, Plus, Award
} from 'lucide-react';
import Papa from 'papaparse';
import { 
  uploadData, getTemplates, uploadDesign, getTemplateHtml, 
  getTemplateSettings, saveTemplateSettings, generateCertificates, 
  sendEmails, getSmtpSettings, saveSmtpSettings, getParticipants 
} from '../api';

const MailMergeHub = () => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // --- Step 1: DATA SOURCE ---
  const [csvFile, setCsvFile] = useState(null);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [rawRecords, setRawRecords] = useState([]);
  const [mappings, setMappings] = useState({ Name: '', Email: '', Team: '', Position: '', Date: '' });
  const [participants, setParticipants] = useState([]);
  const fileInputRef = useRef(null);

  // --- Step 2: DESIGN ---
  const [bgUrl, setBgUrl] = useState('');
  const [activeTemplate, setActiveTemplate] = useState('');
  const [templates, setTemplates] = useState([]);
  const [scale, setScale] = useState(0.5);
  const canvasContainerRef = useRef(null);
  const [canvasSettings, setCanvasSettings] = useState({
    showLogo: false,
    enabledFields: {
      NAME: true, TEAM: true, POSITION: true, DATE: true, SIGNATURE: false, LOGO: false
    },
    transforms: {
      NAME: { x: 561, y: 400 }, // Default center
      TEAM: { x: 561, y: 500 },
      POSITION: { x: 561, y: 600 },
      DATE: { x: 1000, y: 100 },
      LOGO: { x: 100, y: 100 },
      SIGNATURE: { x: 1000, y: 700 }
    }
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const [apiOnline, setApiOnline] = useState('checking'); // 'checking', 'online', 'offline'
  
  // Periodically check server health
  useEffect(() => {
    const checkHealth = async () => {
      try {
        await api.get('/health');
        setApiOnline('online');
      } catch (e) {
        setApiOnline('offline');
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);
  
  // --- Step 3: PREVIEW & GENERATE ---
  const [previewIndex, setPreviewIndex] = useState(0);
  const [genStatus, setGenStatus] = useState(null);
  const [genLoading, setGenLoading] = useState(false);

  // --- Step 4: EMAIL ---
  const [smtp, setSmtp] = useState({ host: '', port: '465', user: '', pass: '' });
  const [subject, setSubject] = useState('Your Certificate');
  const [emailBody, setEmailBody] = useState('<p>Congratulations! Please find your certificate attached.</p>');
  const [emailStatus, setEmailStatus] = useState(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [showSmtpConfig, setShowSmtpConfig] = useState(false);
  const [cc, setCc] = useState('');

  // --- Campaign History ---
  const [campaignHistory, setCampaignHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);

  const [selectedFieldId, setSelectedFieldId] = useState(null);

  // Init
  useEffect(() => {
    fetchInitialData();
  }, []);

  // Update scale on resize
  useEffect(() => {
    const updateScale = () => {
      if (canvasContainerRef.current) {
        const containerWidth = canvasContainerRef.current.offsetWidth - 100;
        const targetScale = containerWidth / 1122.5; // A4 Landscape width
        setScale(Math.min(targetScale, 1));
      }
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [step, activeTemplate]);

  const fetchInitialData = async () => {
    try {
      const [tplRes, partRes, smtpRes, campRes] = await Promise.all([
        getTemplates(),
        getParticipants(),
        getSmtpSettings(),
        getCampaigns()
      ]);
      setTemplates(tplRes.data);
      setParticipants(partRes.data);
      if (smtpRes.data) setSmtp(smtpRes.data);
      if (campRes.data) setCampaignHistory(campRes.data);
      if (tplRes.data.length > 0) setActiveTemplate(tplRes.data[0].id);
    } catch (err) { console.error("Initialization error", err); }
  };

  const handleSyncData = async () => {
    setLoading(true);
    try {
      const mapped = rawRecords.map(row => ({
        Name: row[mappings.Name] || '',
        Email: row[mappings.Email] || '',
        Team: row[mappings.Team] || '',
        Position: row[mappings.Position] || '',
        Date: row[mappings.Date] || ''
      }));
      const res = await uploadData(mapped);
      setParticipants(res.data.data);
      setStep(2);
    } catch (e) { setError('Sync failed'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (activeTemplate && (step === 2 || step === 3)) fetchTemplateConfig();
  }, [activeTemplate, step]);

  const fetchTemplateConfig = async () => {
    try {
      setBgUrl(null); // Clear first to force re-render
      const [htmlRes, settingsRes] = await Promise.all([
        getTemplateHtml(activeTemplate),
        getTemplateSettings(activeTemplate)
      ]);
      // More flexible regex for both single and double quotes
      const imgMatch = htmlRes.data.match(/background-image:\s*url\(['"]?([^'")]*)['"]?\)/i);
      if (imgMatch) {
        let url = imgMatch[1];
        // Ensure no local/file protocol issues and add cache-buster
        setBgUrl(url.includes('?') ? `${url}&t=${Date.now()}` : `${url}?t=${Date.now()}`);
        setRefreshKey(k => k + 1); // Force canvas remount
      }
      
      const s = settingsRes.data;
      setCanvasSettings({
        showLogo: s.showLogo === true,
        enabledFields: s.enabledFields || { NAME: true, TEAM: true, POSITION: true, DATE: true, SIGNATURE: true, LOGO: s.showLogo === true },
        transforms: {
          NAME: { x: 561, y: 350, fontSize: 50, ...s.transforms?.NAME },
          TEAM: { x: 561, y: 450, fontSize: 30, ...s.transforms?.TEAM },
          POSITION: { x: 561, y: 550, fontSize: 25, ...s.transforms?.POSITION },
          DATE: { x: 900, y: 100, fontSize: 18, ...s.transforms?.DATE },
          LOGO: { x: 100, y: 100, ...s.transforms?.LOGO },
          SIGNATURE: { x: 900, y: 650, fontSize: 16, ...s.transforms?.SIGNATURE }
        }
      });
    } catch (e) {}
  };

  const handleDeleteTemplate = async () => {
    if (!activeTemplate || !confirm('Are you sure you want to delete this design?')) return;
    setLoading(true);
    try {
      await deleteTemplate(activeTemplate);
      const res = await getTemplates();
      setTemplates(res.data);
      if (res.data.length > 0) setActiveTemplate(res.data[0].id);
      else {
         setActiveTemplate('');
         setBgUrl('');
      }
    } catch (e) { 
      const msg = e.response?.data?.error || "Delete failed";
      alert(msg); 
    }
    finally { setLoading(false); }
  };

  const updateTransform = (id, x, y) => {
    setCanvasSettings(prev => ({
      ...prev,
      transforms: { ...prev.transforms, [id]: { ...prev.transforms[id], x, y } }
    }));
  };

  const updateFontSize = (id, delta) => {
    setCanvasSettings(prev => {
      const currentSize = prev.transforms[id].fontSize || 20;
      return {
        ...prev,
        transforms: { 
          ...prev.transforms, 
          [id]: { ...prev.transforms[id], fontSize: Math.max(8, currentSize + delta) } 
        }
      };
    });
  };

  const handleDragEnd = (id, info) => {
    const deltaX = info.offset.x / scale;
    const deltaY = info.offset.y / scale;
    updateTransform(id, canvasSettings.transforms[id].x + deltaX, canvasSettings.transforms[id].y + deltaY);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      Papa.parse(file, {
        header: true, skipEmptyLines: true,
        complete: (results) => {
          setCsvHeaders(results.meta.fields);
          setRawRecords(results.data);
          const guess = (k) => results.meta.fields.find(f => k.some(x => f.toLowerCase().includes(x))) || '';
          setMappings({
            Name: guess(['name', 'full']),
            Email: guess(['email', 'mail']),
            Team: guess(['team', 'organization', 'company']),
            Position: guess(['position', 'role', 'status']),
            Date: guess(['date', 'time'])
          });
          setCsvFile(file);
        }
      });
    }
  };

  const handleDesignUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    try {
      const res = await uploadDesign(file);
      const tplRes = await getTemplates();
      setTemplates(tplRes.data);
      const newId = res.data.id;
      setActiveTemplate(''); // Flip state to force re-trigger
      setTimeout(() => setActiveTemplate(newId), 50);
    } catch (e) { 
      console.error(e);
      alert("Upload failed"); 
    }
    finally { setLoading(false); }
  };

  const saveCanvas = async () => {
    setLoading(true);
    try {
      await saveTemplateSettings(activeTemplate, canvasSettings);
      setStep(3);
    } catch (e) { alert("Save failed"); }
    finally { setLoading(false); }
  };

  const handleBulkGenerate = async () => {
    setGenLoading(true);
    setGenStatus(null);
    try {
      const res = await generateCertificates(activeTemplate);
      setGenStatus({ type: 'success', msg: res.data.message });
      const partRes = await getParticipants();
      setParticipants(partRes.data);
    } catch (e) { setGenStatus({ type: 'error', msg: 'Generation failed' }); }
    finally { setGenLoading(false); }
  };

  const handleSendEmails = async () => {
    setEmailLoading(true);
    setEmailStatus(null);
    try {
      const generatedIds = participants.filter(p => p.status === 'Generated').map(p => p.id);
      if (generatedIds.length === 0) {
        alert("No generated certificates found to send.");
        return;
      }
      const res = await sendEmails(generatedIds, subject, emailBody, cc);
      setEmailStatus({ type: 'success', msg: res.data.message });
      setParticipants(res.data.data);
    } catch (e) { setEmailStatus({ type: 'error', msg: 'Emailing failed' }); }
    finally { setEmailLoading(false); }
  };

  const handleArchiveCampaign = async () => {
    if (!confirm("Archive this campaign and clear participant data? You can view stats in History.")) return;
    setArchiveLoading(true);
    try {
      const res = await saveCampaign(`Campaign ${new Date().toLocaleDateString()}`, activeTemplate);
      setCampaignHistory(prev => [res.data.campaign, ...prev]);
      setParticipants([]);
      setStep(1); // Back to start for new work
      alert("Campaign archived and workspace cleared.");
    } catch (e) { alert("Archive failed"); }
    finally { setArchiveLoading(false); }
  };

  // --- RENDER HELPERS ---
  const StepIcon = ({ id, active, done }) => (
    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all shadow-md ${active ? 'bg-brand-600 text-white scale-110 ring-4 ring-brand-100' : done ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
       {done ? <CheckCircle className="w-5 h-5" /> : id}
    </div>
  );

  const CanvasPlaceholder = ({ id, label, color = "text-slate-900" }) => {
    if (!canvasSettings.enabledFields[id]) return null;
    const transform = canvasSettings.transforms[id];
    const isSelected = selectedFieldId === id;
    
    return (
      <motion.div
        drag={step === 2}
        dragMomentum={false}
        onClick={(e) => { e.stopPropagation(); setSelectedFieldId(id); }}
        onDragStart={() => setSelectedFieldId(id)}
        onDragEnd={(e, info) => handleDragEnd(id, info)}
        style={{ 
          x: transform.x, 
          y: transform.y,
          position: 'absolute',
          top: 0,
          left: 0,
          cursor: step === 2 ? (isSelected ? 'grabbing' : 'grab') : 'default',
          zIndex: isSelected ? 50 : 20
        }}
        className={`p-2 border-2 transition-all ${isSelected ? 'border-brand-500 bg-brand-50/20 ring-4 ring-brand-500/10' : 'border-dashed border-transparent hover:border-slate-300'}`}
      >
        <div style={{ transform: 'translate(-50%, -50%)', fontSize: `${transform.fontSize || 20}px` }} className={`font-bold ${color} whitespace-nowrap`}>
          {label}
        </div>
      </motion.div>
    );
  };

  const PaletteItem = ({ id, icon: Icon, label }) => {
    const isEnabled = canvasSettings.enabledFields[id];
    
    return (
      <div 
        onClick={() => {
          setCanvasSettings(s => ({
            ...s,
            enabledFields: { ...s.enabledFields, [id]: !s.enabledFields[id] }
          }));
        }}
        className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all cursor-pointer group hover:scale-105 active:scale-95 ${isEnabled ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-100 bg-white text-slate-400'}`}
      >
         <div className={`w-12 h-12 rounded-full mb-3 flex items-center justify-center transition-colors ${isEnabled ? 'bg-brand-600 text-white shadow-lg' : 'bg-slate-50 group-hover:bg-slate-100'}`}>
            <Icon className="w-6 h-6" />
         </div>
         <span className="text-[10px] font-black uppercase tracking-tighter">{label}</span>
         <div className={`mt-2 px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${isEnabled ? 'bg-brand-200 text-brand-700' : 'bg-slate-100 text-slate-400'}`}>
            {isEnabled ? 'Visible' : 'Hidden'}
         </div>
      </div>
    );
  };

  const FieldProperties = () => {
    if (!selectedFieldId) return null;
    const transform = canvasSettings.transforms[selectedFieldId];
    
    return (
      <div className="glass-panel p-6 bg-slate-900 text-white shadow-2xl">
         <div className="flex justify-between items-center mb-6">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Field Properties: {selectedFieldId}</h4>
            <button onClick={() => setSelectedFieldId(null)} className="text-slate-500 hover:text-white"><X className="w-3 h-3" /></button>
         </div>
         
         <div className="space-y-6">
            <div>
               <div className="flex justify-between text-[10px] font-bold mb-3">
                  <span>FONT SIZE</span>
                  <span className="text-brand-400">{transform.fontSize || 20}px</span>
               </div>
               <div className="flex items-center space-x-2">
                  <button onClick={() => updateFontSize(selectedFieldId, -2)} className="flex-1 py-2 bg-slate-800 rounded-xl hover:bg-slate-700 font-bold transition-colors">-</button>
                  <button onClick={() => updateFontSize(selectedFieldId, 2)} className="flex-1 py-2 bg-slate-800 rounded-xl hover:bg-slate-700 font-bold transition-colors">+</button>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
               <div className="p-3 bg-slate-800 rounded-xl">
                  <p className="text-[8px] text-slate-500 uppercase font-black tracking-tighter mb-1 font-mono">X-Pos</p>
                  <p className="text-xs font-bold">{Math.round(transform.x)}px</p>
               </div>
               <div className="p-3 bg-slate-800 rounded-xl">
                  <p className="text-[8px] text-slate-500 uppercase font-black tracking-tighter mb-1 font-mono">Y-Pos</p>
                  <p className="text-xs font-bold">{Math.round(transform.y)}px</p>
               </div>
            </div>
         </div>
      </div>
    );
  };

  return (
    <div className="max-w-[1600px] mx-auto px-6 pb-20">
      {/* HEADER & STEPPER */}
      <div className="mb-8 flex flex-col items-center">
        <div className="flex items-center space-x-3 mb-2">
           <Layers className="text-brand-600 w-8 h-8" />
           <h1 className="text-3xl font-black text-slate-900 tracking-tight">Mail Merge Engine</h1>
        </div>
        <button 
           onClick={() => setShowHistory(!showHistory)}
           className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border transition-all ${showHistory ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 border-slate-100 hover:bg-slate-50'}`}
        >
           {showHistory ? 'Close History' : 'View History'}
        </button>
        <div className="flex items-center space-x-6">
           {[
             { id: 1, label: 'Data', desc: 'CSV Source' },
             { id: 2, label: 'Design', desc: 'Editor' },
             { id: 3, label: 'Verify', desc: 'Preview' },
             { id: 4, label: 'Dispatch', desc: 'Mailing' }
           ].map((s, idx) => (
             <React.Fragment key={s.id}>
               <div className="flex items-center space-x-3">
                  <StepIcon id={s.id} active={step === s.id} done={step > s.id} />
                  <span className={`text-xs font-black uppercase tracking-widest ${step === s.id ? 'text-brand-600' : 'text-slate-400'}`}>{s.label}</span>
               </div>
               {idx < 3 && <div className={`w-12 h-0.5 rounded-full ${step > s.id ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
             </React.Fragment>
           ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* STEP 1: DATA SOURCE */}
        {step === 1 && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="max-w-4xl mx-auto">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
                <div className="glass-panel p-10 flex flex-col items-center justify-center text-center border-2 border-dashed border-slate-200 hover:border-brand-500 transition-all cursor-pointer group" onClick={() => fileInputRef.current.click()}>
                   <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileSelect} />
                   <div className="w-24 h-24 bg-brand-50 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-brand-100 transition-all">
                      <FileText className="w-12 h-12 text-brand-600" />
                   </div>
                   <h2 className="text-2xl font-bold text-slate-800 mb-2">{csvFile ? csvFile.name : 'Choose Participants'}</h2>
                   <p className="text-slate-500 text-sm max-w-xs">{csvFile ? `Found ${rawRecords.length} records in ${csvFile.name}` : 'Upload your attendee spreadsheet (CSV format) to begin the bulk merge.'}</p>
                </div>

                <div className="flex flex-col space-y-6">
                   <div className="glass-panel p-8 bg-slate-900 text-white flex-1 overflow-hidden relative">
                      <div className="absolute -top-10 -right-10 w-40 h-40 bg-brand-500/20 rounded-full blur-3xl" />
                      <h3 className="text-lg font-bold mb-6 flex items-center"><TableIcon className="w-5 h-5 mr-3 text-brand-400" /> Mapping Configuration</h3>
                      <div className="space-y-4">
                         {Object.keys(mappings).map(m => (
                           <div key={m}>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">{m} Column</label>
                              <select 
                                value={mappings[m]} 
                                onChange={(e) => setMappings({...mappings, [m]: e.target.value})} 
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:ring-2 focus:ring-brand-500 transition-all outline-none"
                              >
                                 <option value="" className="text-slate-900">-- Select Header --</option>
                                 {csvHeaders.map(h => <option key={h} value={h} className="text-slate-900">{h}</option>)}
                              </select>
                           </div>
                         ))}
                      </div>
                   </div>
                   <button 
                     onClick={handleSyncData} 
                     disabled={!csvFile || loading} 
                     className="w-full py-5 bg-brand-600 text-white rounded-2xl font-black text-xl hover:bg-brand-700 shadow-2xl shadow-brand-500/30 transition-all flex items-center justify-center disabled:opacity-50"
                   >
                      {loading ? <Loader className="w-6 h-6 animate-spin mr-3" /> : <ArrowRight className="w-6 h-6 mr-3" />}
                      Sync Data & Goto Canvas
                   </button>
                </div>
             </div>
          </motion.div>
        )}

        {/* STEP 2: DESIGN CANVAS */}
        {step === 2 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col lg:flex-row gap-8 items-start">
             {/* LEFT SIDEBAR: FIELD PALETTE */}
             <div className="w-full lg:w-72 space-y-6 shrink-0">
                <div className="glass-panel p-6">
                   <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center">
                     <Layers className="w-4 h-4 mr-2 text-brand-500" /> Field Palette
                   </h3>
                   <div className="grid grid-cols-2 gap-4">
                      <PaletteItem id="NAME" icon={User} label="Name" />
                      <PaletteItem id="TEAM" icon={Briefcase} label="Organization" />
                      <PaletteItem id="POSITION" icon={Award} label="Status" />
                      <PaletteItem id="DATE" icon={Calendar} label="Date" />
                      <PaletteItem id="SIGNATURE" icon={Type} label="Signature" />
                      
                      <div 
                        onClick={() => setCanvasSettings(s => ({ ...s, showLogo: !s.showLogo }))}
                        className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all cursor-pointer group hover:scale-105 ${canvasSettings.showLogo ? 'border-brand-500 bg-brand-50 text-brand-700 font-bold' : 'border-slate-100 bg-white text-slate-400'}`}
                      >
                         <div className={`w-12 h-12 rounded-full mb-3 flex items-center justify-center ${canvasSettings.showLogo ? 'bg-brand-600 text-white' : 'bg-slate-50'}`}>
                            <ImageIcon className="w-6 h-6" />
                         </div>
                         <span className="text-[10px] font-black uppercase tracking-tighter">Logo Overlay</span>
                      </div>
                   </div>
                   <p className="mt-6 text-[10px] text-slate-400 text-center font-medium italic">
                      Drag fields from the canvas to position them. Enabled fields are highlighted.
                   </p>
                </div>

                <FieldProperties />

                <div className="glass-panel p-6">
                   <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex justify-between items-center">
                      <span>Base Design</span>
                      {activeTemplate && templates.find(t => t.id === activeTemplate)?.type === 'image' && (
                        <button onClick={handleDeleteTemplate} className="p-1.5 bg-rose-50 text-rose-500 rounded-lg hover:bg-rose-100 transition-colors shadow-sm">
                           <X className="w-3 h-3" />
                        </button>
                      )}
                   </h3>
                   <div className="space-y-4">
                      <select 
                        value={activeTemplate} 
                        onChange={(e) => setActiveTemplate(e.target.value)} 
                        className="w-full border p-3 rounded-xl text-sm bg-white font-bold text-slate-700 focus:ring-2 focus:ring-brand-500"
                      >
                         {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                      <input type="file" id="new-base" className="hidden" accept="image/*" onChange={handleDesignUpload} />
                      <label htmlFor="new-base" className="w-full py-3 bg-slate-900 text-white rounded-xl flex items-center justify-center text-xs font-bold cursor-pointer hover:bg-black transition-all">
                         <Plus className="w-4 h-4 mr-2" /> Upload New Design
                      </label>
                      <button 
                        onClick={() => { setRefreshKey(k => k + 1); fetchTemplateConfig(); }}
                        className="w-full py-2 bg-slate-50 text-slate-500 rounded-xl flex items-center justify-center text-[10px] font-bold border border-slate-100 hover:bg-slate-100 transition-all"
                      >
                         <Monitor className="w-3 h-3 mr-2" /> Refresh Canvas View
                      </button>
                   </div>
                </div>

                <div className="flex flex-col space-y-3">
                   <button onClick={saveCanvas} disabled={loading} className="w-full py-4 bg-brand-600 text-white rounded-2xl font-black shadow-xl hover:bg-brand-700 transition-all flex items-center justify-center">
                      <Save className="w-5 h-5 mr-3" /> Lock & Preview
                   </button>
                   <button onClick={() => setStep(1)} className="w-full py-3 bg-white border border-slate-200 text-slate-400 rounded-xl hover:bg-slate-50 transition-all text-xs font-bold">Back to Data</button>
                </div>
             </div>

             {/* MAIN CANVAS: DRAGGABLE EDITOR */}
             <div className="flex-1 w-full bg-slate-100 border border-slate-200 rounded-[40px] shadow-inner overflow-hidden flex flex-col min-h-[800px]">
                <div className="h-16 bg-white/50 backdrop-blur-md border-b flex justify-between items-center px-10">
                   <div className="flex items-center space-x-6">
                      <div className="flex items-center text-xs text-slate-500">
                         <Monitor className="w-4 h-4 mr-2" /> 
                         Scale: {Math.round(scale * 100)}%
                      </div>
                      <div className="px-3 bg-brand-100 text-brand-600 rounded-full text-[10px] font-black uppercase tracking-widest">Editor Mode</div>
                   </div>
                   <div className="flex items-center space-x-2">
                       <div className="w-3 h-3 rounded-full bg-rose-400" />
                       <div className="w-3 h-3 rounded-full bg-amber-400" />
                       <div className="w-3 h-3 rounded-full bg-emerald-400" />
                   </div>
                </div>
                <div ref={canvasContainerRef} className="flex-1 flex items-center justify-center p-12 overflow-auto custom-scrollbar">
                   <div 
                     style={{ 
                       width: '1122.5px', 
                       height: '793.7px', 
                       transform: `scale(${scale})`,
                       backgroundImage: `url(${bgUrl})`,
                       backgroundSize: 'cover',
                       position: 'relative',
                       boxShadow: '0 40px 100px rgba(0,0,0,0.15)',
                       flexShrink: 0
                     }}
                     className="bg-white rounded-lg relative ring-1 ring-slate-900/5"
                   >
                      <CanvasPlaceholder id="NAME" label={participants[0]?.Name || "Name Representative"} size="text-4xl" />
                      <CanvasPlaceholder id="TEAM" label={participants[0]?.Team || "Organization Name"} color="text-slate-500" size="text-2xl" />
                      <CanvasPlaceholder id="POSITION" label={participants[0]?.Position || "Achievement/Rank"} color="text-brand-600" size="text-xl" />
                      <div className="absolute top-10 right-10 pointer-events-none">
                         <CanvasPlaceholder id="DATE" label={participants[0]?.Date || new Date().toLocaleDateString()} color="text-slate-400" size="text-lg" />
                      </div>
                      <CanvasPlaceholder id="SIGNATURE" label="(Authorizing Signature)" color="text-slate-300" size="text-sm" />

                      {canvasSettings.showLogo && (
                         <motion.div 
                           drag dragMomentum={false} 
                           onDragEnd={(e, info) => handleDragEnd('LOGO', info)} 
                           style={{ x: canvasSettings.transforms.LOGO.x, y: canvasSettings.transforms.LOGO.y, position: 'absolute', top: 0, left: 0, cursor: 'grab', transform: 'translate(-50%, -50%)' }} 
                           className="p-6 bg-slate-100/80 border-2 border-dashed border-slate-300 rounded-2xl text-[10px] font-black text-slate-400 uppercase flex items-center justify-center group"
                         >
                            Logo Overlay
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-brand-600 text-white text-[10px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">Logo Reference</div>
                         </motion.div>
                      )}
                   </div>
                </div>
             </div>
          </motion.div>
        )}

        {/* STEP 3: PREVIEW & VERIFY */}
        {step === 3 && (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col lg:flex-row gap-8">
             <div className="w-full lg:w-96 space-y-6">
                <div className="glass-panel p-8">
                   <h2 className="text-2xl font-black text-slate-800 mb-2 tracking-tighter">Merge Inspector</h2>
                   <p className="text-slate-500 text-sm mb-10">Select any record from your CSV to verify the placement on your design.</p>
                   
                   <div className="space-y-6 mb-10">
                      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Live Participant Select</label>
                         <select 
                           value={previewIndex} onChange={(e) => setPreviewIndex(Number(e.target.value))} 
                           className="w-full bg-white border p-3 rounded-xl font-bold text-slate-800 shadow-sm focus:ring-2 focus:ring-brand-500"
                         >
                            {participants.map((p, idx) => <option key={idx} value={idx}>{p.Name || `Record ${idx+1}`}</option>)}
                         </select>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                         <div className="p-4 bg-brand-50 rounded-2xl text-center">
                            <div className="text-[10px] font-bold text-brand-600 uppercase mb-1">Queue</div>
                            <div className="text-3xl font-black text-brand-900">{participants.length}</div>
                         </div>
                         <div className="p-4 bg-emerald-50 rounded-2xl text-center">
                            <div className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Status</div>
                            <div className="text-xs font-black text-emerald-900 mt-2">Verified</div>
                         </div>
                      </div>
                   </div>

                   <button 
                     onClick={handleBulkGenerate} disabled={genLoading} 
                     className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black text-lg hover:bg-black transition-all flex items-center justify-center shadow-2xl mb-4"
                   >
                      {genLoading ? <Loader className="w-6 h-6 animate-spin mr-3" /> : <Play className="w-6 h-6 mr-3" />}
                      Generate Bulk PDFs
                   </button>
                   
                   <div className="flex space-x-3">
                      <button onClick={() => setStep(2)} className="w-16 h-14 bg-white border border-slate-200 text-slate-400 rounded-2xl flex items-center justify-center hover:bg-slate-50 transition-all"><ArrowLeft /></button>
                      <button onClick={() => setStep(4)} className="flex-1 bg-brand-600 text-white rounded-2xl font-black hover:bg-brand-700 transition-all flex items-center justify-center">Next: Dispatch <ChevronRight className="ml-2 w-5 h-5"/></button>
                   </div>
                </div>
                {genStatus && (
                   <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`p-4 rounded-3xl flex items-center ${genStatus.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                      {genStatus.type === 'success' ? <CheckCircle className="mr-3 w-6 h-6" /> : <AlertCircle className="mr-3 w-6 h-6" />}
                      <span className="font-bold text-sm tracking-tight">{genStatus.msg}</span>
                   </motion.div>
                )}
             </div>

             <div className="flex-1 bg-slate-900 p-8 rounded-[50px] flex items-center justify-center overflow-hidden min-h-[700px] border-[12px] border-slate-800 shadow-2xl relative">
                <div 
                  style={{ 
                    width: '1122.5px', height: '793.7px', 
                    transform: `scale(${scale * 0.9})`, transformOrigin: 'center', 
                    backgroundImage: `url(${bgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', 
                    position: 'relative' 
                  }} 
                  className="bg-white shadow-2xl shrink-0 pointer-events-none"
                >
                   {Object.keys(canvasSettings.enabledFields).map(id => {
                     if (!canvasSettings.enabledFields[id]) return null;
                     const transform = canvasSettings.transforms[id];
                     return (
                        <div key={id} style={{ 
                          position: 'absolute',
                          left: transform.x,
                          top: transform.y,
                        }}>
                           <div style={{ transform: 'translate(-50%, -50%)', whiteSpace: 'nowrap', textAlign: 'center', fontSize: `${transform.fontSize || 20}px` }}>
                             <span className={`font-bold ${id === 'NAME' ? 'text-slate-900' : id === 'TEAM' ? 'text-slate-500' : id === 'POSITION' ? 'text-brand-600 font-black' : 'text-slate-400'}`}>
                                {id === 'NAME' ? (participants[previewIndex]?.Name || "Name Representative") :
                                 id === 'TEAM' ? (participants[previewIndex]?.Team || "Organization Name") :
                                 id === 'POSITION' ? (participants[previewIndex]?.Position || "Achievement/Rank") :
                                 id === 'DATE' ? (participants[previewIndex]?.Date || new Date().toLocaleDateString()) : "(SIGNATURE)"}
                             </span>
                           </div>
                        </div>
                     );
                   })}
                </div>
             </div>
          </motion.div>
        )}

        {/* STEP 4: DISPATCH (EMAILS) */}
        {step === 4 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-5xl mx-auto space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                   <div className="glass-panel p-10">
                      <h3 className="text-2xl font-bold mb-8 flex items-center"><Mail className="w-6 h-6 mr-3 text-brand-500" /> Campaign Copy</h3>
                      <div className="space-y-6">
                         <div className="space-y-4">
                            <div>
                               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Subject Line</label>
                               <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full bg-white border border-slate-100 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-brand-500" placeholder="Certificate Subject" />
                            </div>
                            <div>
                               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">CC Recipients (Comma separated)</label>
                               <input value={cc} onChange={(e) => setCc(e.target.value)} className="w-full bg-white border border-slate-100 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-brand-500" placeholder="admin@example.com, manager@example.com" />
                            </div>
                         </div>
                         <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Message Body (Use placeholders like {'{NAME}'}, {'{TEAM}'})</label>
                            <textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)} rows="8" className="w-full border p-4 rounded-2xl font-mono text-sm focus:ring-4 focus:ring-brand-500/10 transition-all outline-none" />
                         </div>
                      </div>
                   </div>

                   <div className="glass-panel p-8 bg-slate-50 border-2 border-slate-200">
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center">
                         <Eye className="w-4 h-4 mr-2" /> Live Email Preview (First Recipient)
                      </h3>
                      <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
                         <div className="mb-4 pb-4 border-b border-slate-100">
                            <span className="text-xs text-slate-400 uppercase font-bold mr-2">To:</span>
                            <span className="text-sm font-bold text-slate-800">{participants[0]?.Email || "recipient@example.com"}</span>
                         </div>
                         <div className="mb-6">
                            <span className="text-xs text-slate-400 uppercase font-bold mr-2">Subject:</span>
                            <span className="text-sm font-bold text-slate-800">{subject}</span>
                         </div>
                         <div 
                           className="prose prose-slate max-w-none text-slate-600 leading-relaxed"
                           dangerouslySetInnerHTML={{ 
                             __html: emailBody
                               .replace(/{NAME}/g, participants[0]?.Name || "[PARTICIPANT NAME]")
                               .replace(/{TEAM}/g, participants[0]?.Team || "[ORGANIZATION]")
                               .replace(/{POSITION}/g, participants[0]?.Position || "[ROLE]")
                           }} 
                         />
                         <div className="mt-8 pt-6 border-t border-slate-100 flex items-center text-xs text-slate-400 italic">
                            <ImageIcon className="w-4 h-4 mr-2" /> Certificate Attachment: {participants[0]?.Name || "Name"}_Certificate.pdf
                         </div>
                      </div>
                   </div>
                </div>

                <div className="space-y-8">
                   <div className="glass-panel p-8 bg-brand-600 text-white relative overflow-hidden shadow-2xl shadow-brand-600/20">
                      <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                      <h3 className="text-xs font-black text-white/60 uppercase tracking-widest mb-6">Mailing Configuration</h3>
                      <div className="space-y-4 mb-10 relative z-10">
                         <div className="flex justify-between items-center bg-white/10 p-4 rounded-2xl border border-white/10">
                            <span className="text-xs text-white/60">Host Server</span>
                            <span className="text-xs font-bold">{smtp.host || 'DISCONNECTED'}</span>
                         </div>
                         <div className="flex justify-between items-center bg-white/10 p-4 rounded-2xl border border-white/10">
                            <span className="text-xs text-white/60">Auth User</span>
                            <span className="text-xs font-bold">{smtp.user ? smtp.user.substring(0, 15)+'...' : 'NOT SET'}</span>
                         </div>
                      </div>
                      <button 
                        onClick={() => setShowSmtpConfig(true)} 
                        className="w-full py-4 bg-white text-brand-600 rounded-2xl font-black text-xs shadow-xl active:scale-95 transition-all flex items-center justify-center relative z-10"
                      >
                         <Server className="w-4 h-4 mr-2" /> Modify Server Settings
                      </button>
                   </div>

                   <button onClick={handleSendEmails} disabled={emailLoading} className="w-full py-8 bg-brand-600 text-white rounded-[40px] font-black text-2xl hover:bg-brand-700 shadow-3xl shadow-brand-500/40 transition-all flex flex-col items-center justify-center">
                      <div className="flex items-center mb-1">
                         {emailLoading ? <Loader className="w-8 h-8 animate-spin mr-3" /> : <Send className="w-8 h-8 mr-3" />}
                         {emailLoading ? 'BLASTING...' : 'DISPATCH ALL'}
                      </div>
                      <span className="text-xs opacity-60 tracking-[0.2em] uppercase font-bold">Targeting {participants.length} Recipients</span>
                   </button>
                </div>
             </div>
             {emailStatus && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`p-4 rounded-xl flex items-center space-x-3 ${emailStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
                   {emailStatus.type === 'success' ? <CheckCircle className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
                   <p className="text-sm font-bold">{emailStatus.msg}</p>
                </motion.div>
             )}

             <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                <div className="flex justify-between items-center mb-4">
                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center">
                      <Monitor className="w-3 h-3 mr-2" /> Live Dispatch Tracker
                   </h4>
                   <button 
                     onClick={handleArchiveCampaign}
                     disabled={archiveLoading || participants.length === 0}
                     className="px-3 py-1.5 bg-brand-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-brand-700 disabled:opacity-50 transition-all flex items-center"
                   >
                      {archiveLoading ? <Loader className="w-3 h-3 animate-spin mr-2" /> : <Save className="w-3 h-3 mr-2" />}
                      Archive & Finish
                   </button>
                </div>
                <div className="space-y-2 max-h-[300px] overflow-auto custom-scrollbar">
                   {participants.map(p => (
                      <div key={p.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                         <div className="flex items-center space-x-3">
                            <div className={`w-2 h-2 rounded-full ${p.status === 'Sent' ? 'bg-emerald-500' : p.status === 'Failed_Email' ? 'bg-rose-500' : p.status === 'Generated' ? 'bg-brand-500' : 'bg-slate-300'}`} />
                            <div className="flex flex-col">
                               <span className="text-xs font-bold text-slate-800">{p.Name}</span>
                               <span className="text-[9px] text-slate-400">
                                  {p.status === 'Error' ? <span className="text-rose-500 font-bold">{p.error || 'Generation Failed'}</span> : p.Email}
                               </span>
                            </div>
                         </div>
                         <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${p.status === 'Sent' ? 'bg-emerald-100 text-emerald-700' : p.status === 'Failed_Email' ? 'bg-rose-100 text-rose-700' : 'bg-brand-100 text-brand-700'}`}>
                            {p.status}
                         </span>
                      </div>
                   ))}
                   {participants.filter(p => p.status === 'Generated' || p.status === 'Sent' || p.status === 'Failed_Email').length === 0 && (
                      <div className="text-center py-6 text-slate-400 text-xs italic">
                         No generated certificates ready for dispatch.
                      </div>
                   )}
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SMTP MODAL */}
      <AnimatePresence>
        {showSmtpConfig && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
             <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white max-w-md w-full rounded-[40px] shadow-3xl overflow-hidden p-8">
                <div className="flex justify-between items-center mb-8">
                   <h3 className="text-2xl font-black text-slate-900 flex items-center"><Server className="w-6 h-6 mr-3 text-brand-600" /> SMTPS Configuration</h3>
                   <button onClick={() => setShowSmtpConfig(false)} className="p-3 hover:bg-slate-100 rounded-full transition-colors"><X/></button>
                </div>
                <div className="space-y-6">
                   <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-1"><label className="text-[10px] font-black text-slate-400 mb-2 block uppercase tracking-widest">Host</label><input value={smtp.host} onChange={e => setSmtp({...smtp, host: e.target.value})} placeholder="smtp.gmail.com" className="w-full border p-4 rounded-2xl text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-brand-500 transition-all"/></div>
                      <div className="col-span-1"><label className="text-[10px] font-black text-slate-400 mb-2 block uppercase tracking-widest">Port</label><input value={smtp.port} onChange={e => setSmtp({...smtp, port: e.target.value})} placeholder="465" className="w-full border p-4 rounded-2xl text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-brand-500 transition-all"/></div>
                   </div>
                   <div><label className="text-[10px] font-black text-slate-400 mb-2 block uppercase tracking-widest">Email Address</label><input value={smtp.user} onChange={e => setSmtp({...smtp, user: e.target.value})} placeholder="sender@example.com" className="w-full border p-4 rounded-2xl text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-brand-500 transition-all"/></div>
                   <div><label className="text-[10px] font-black text-slate-400 mb-2 block uppercase tracking-widest">App Password</label><input type="password" value={smtp.pass} onChange={e => setSmtp({...smtp, pass: e.target.value})} placeholder="••••••••••••" className="w-full border p-4 rounded-2xl text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-brand-500 transition-all"/></div>
                   <button onClick={async () => { await saveSmtpSettings(smtp); setShowSmtpConfig(false); }} className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black text-lg hover:shadow-xl transition-all">Enable Mail Delivery</button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* HISTORY OVERLAY */}
      <AnimatePresence>
         {showHistory && (
            <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md"
            >
               <motion.div 
                 initial={{ scale: 0.9, y: 20 }} 
                 animate={{ scale: 1, y: 0 }}
                 className="bg-white w-full max-w-4xl max-h-[85vh] rounded-[40px] shadow-2xl flex flex-col overflow-hidden"
               >
                  <div className="p-8 border-b border-slate-100 flex justify-between items-center shrink-0">
                     <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center">
                           <Calendar className="text-slate-500 w-6 h-6" />
                        </div>
                        <div>
                           <h2 className="text-2xl font-black text-slate-900">Campaign History</h2>
                           <p className="text-xs font-bold text-slate-400">Archives of past certificate merges</p>
                        </div>
                     </div>
                     <button onClick={() => setShowHistory(false)} className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-slate-100 transition-all">
                        <X className="w-6 h-6" />
                     </button>
                  </div>

                  <div className="flex-1 overflow-auto p-8 custom-scrollbar">
                     {campaignHistory.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center py-20">
                           <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                              <Loader className="w-10 h-10 text-slate-200" />
                           </div>
                           <h3 className="text-lg font-bold text-slate-800 mb-2">No Archives Found</h3>
                           <p className="text-sm text-slate-400 max-w-xs">Archived campaigns will appear here once you click "Archive & Finish" in a merge session.</p>
                        </div>
                     ) : (
                        <div className="grid grid-cols-1 gap-6">
                           {campaignHistory.map(camp => (
                              <div key={camp.id} className="group glass-panel p-6 hover:border-brand-500 transition-all">
                                 <div className="flex justify-between items-start mb-6">
                                    <div className="flex items-center space-x-4">
                                       <div className="w-10 h-10 bg-brand-50 text-brand-600 rounded-xl flex items-center justify-center font-bold">
                                          {camp.stats.total}
                                       </div>
                                       <div>
                                          <h4 className="font-black text-slate-900 leading-none mb-1">{camp.name}</h4>
                                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(camp.date).toLocaleString()}</p>
                                       </div>
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 bg-slate-900 text-white rounded-lg">
                                       {camp.templateName}
                                    </span>
                                 </div>
                                 <div className="grid grid-cols-3 gap-4">
                                    <div className="p-3 bg-emerald-50 rounded-xl">
                                       <p className="text-[9px] font-black text-emerald-600 uppercase mb-1">Sent</p>
                                       <p className="text-lg font-black text-emerald-700">{camp.stats.sent}</p>
                                    </div>
                                    <div className="p-3 bg-rose-50 rounded-xl">
                                       <p className="text-[9px] font-black text-rose-600 uppercase mb-1">Failed</p>
                                       <p className="text-lg font-black text-rose-700">{camp.stats.failed}</p>
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded-xl">
                                       <p className="text-[9px] font-black text-slate-600 uppercase mb-1">Total</p>
                                       <p className="text-lg font-black text-slate-700">{camp.stats.total}</p>
                                    </div>
                                 </div>
                              </div>
                           ))}
                        </div>
                     )}
                  </div>
               </motion.div>
            </motion.div>
         )}
      </AnimatePresence>
    </div>
  );
};

export default MailMergeHub;
