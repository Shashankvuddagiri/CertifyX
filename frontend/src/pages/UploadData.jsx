import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, ArrowRight, Table as TableIcon, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import { uploadData } from '../api';
import Papa from 'papaparse';

const UploadData = () => {
  const [file, setFile] = useState(null);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // CSV Mapping State
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [rawRecords, setRawRecords] = useState([]);
  const [mappingMode, setMappingMode] = useState(false);
  const [mappings, setMappings] = useState({
    Name: '',
    Email: '',
    Team: '',
    Position: ''
  });

  const fileInputRef = useRef(null);

  const handleFileDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    validateAndParseFile(droppedFile);
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    validateAndParseFile(selectedFile);
  };

  const validateAndParseFile = (f) => {
    if (f && (f.type === 'text/csv' || f.name.endsWith('.csv'))) {
      setFile(f);
      setError('');
      setLoading(true);

      Papa.parse(f, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.meta.fields && results.meta.fields.length > 0) {
            setCsvHeaders(results.meta.fields);
            setRawRecords(results.data);
            setMappingMode(true);
            
            // Auto-guess columns based on common names if possible
            const guess = (keywords) => results.meta.fields.find(f => keywords.some(k => f.toLowerCase().includes(k))) || '';
            setMappings({
              Name: guess(['name', 'first']),
              Email: guess(['email', 'mail']),
              Team: guess(['team', 'group', 'company']),
              Position: guess(['position', 'role', 'status', 'rank'])
            });
            
          } else {
             setError('CSV appears empty or invalid.');
          }
          setLoading(false);
        },
        error: () => {
           setError('Failed to parse CSV locally.');
           setLoading(false);
        }
      });
    } else {
      setError('Please select a valid CSV file.');
      setFile(null);
    }
  };

  const handleApplyMapping = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Re-map the raw records using user's explicit column choices
      const mappedPayload = rawRecords.map(row => ({
        Name: row[mappings.Name] || '',
        Email: row[mappings.Email] || '',
        Team: row[mappings.Team] || '',
        Position: row[mappings.Position] || ''
      }));

      // Ship normalized data to backend API
      const response = await uploadData(mappedPayload);
      setData(response.data.data);
      setMappingMode(false);
      setFile(null); // success!
    } catch (err) {
      setError('Failed to compile mapping output to the backend.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-16">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Upload Data</h1>
        <p className="text-slate-500 mt-2">Import your participant list natively and map your specific CSV headers.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-1"
        >
          {mappingMode ? (
            <div className="glass-panel p-8 shadow-xl border border-brand-200">
               <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                 <TableIcon className="w-5 h-5 mr-2 text-brand-500" /> Map CSV Columns
               </h3>
               <p className="text-sm text-slate-500 mb-6">Match your loaded CSV columns to our precise engine parameters below.</p>
               
               <div className="space-y-4 mb-6">
                 {Object.keys(mappings).map(field => (
                   <div key={field}>
                     <label className="block text-xs font-bold text-slate-700 uppercase mb-1">{field}</label>
                     <select 
                       value={mappings[field]} 
                       onChange={(e) => setMappings({...mappings, [field]: e.target.value})}
                       className="w-full text-sm border-slate-300 rounded-md py-2 px-3 focus:ring-brand-500 font-medium"
                     >
                        <option value="">-- Ignore (Keep Blank) --</option>
                        {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                     </select>
                   </div>
                 ))}
               </div>

               <button 
                  onClick={handleApplyMapping}
                  disabled={loading}
                  className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium transition-all flex items-center justify-center shadow-lg shadow-brand-500/30"
               >
                 {loading ? 'Processing...' : 'Confirm Mapping & Sync'} <ArrowRight className="w-4 h-4 ml-2" />
               </button>
            </div>
          ) : (
            <div 
              className={`glass-panel p-8 text-center border-2 border-dashed transition-all duration-300 ${
                file ? 'border-brand-500 bg-brand-50' : 'border-slate-300 hover:border-brand-400'
              }`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                accept=".csv" 
                className="hidden" 
              />
              
              <div className="mx-auto w-20 h-20 bg-brand-100 rounded-full flex items-center justify-center mb-6">
                 {loading ? <div className="w-8 h-8 rounded-full border-4 border-brand-500 border-t-transparent animate-spin"/> : <Upload className="w-10 h-10 text-brand-500" />}
              </div>
              
              <h3 className="text-xl font-bold text-slate-800 mb-2">
                {file ? file.name : 'Upload CSV'}
              </h3>
              <p className="text-slate-500 text-sm mb-6">
                 Drag and drop your file here, or click to browse.
              </p>

              {error && (
                <div className="mt-4 p-3 bg-rose-50 text-rose-600 rounded-lg flex items-center text-sm font-medium text-left">
                  <AlertCircle className="w-5 h-5 mr-2 shrink-0" /> {error}
                </div>
              )}
            </div>
          )}
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-2 glass-panel p-0 overflow-hidden"
        >
          <div className="p-6 border-b border-slate-200 bg-white/50 flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-800">Ready Database State</h3>
            {data.length > 0 && <span className="text-brand-600 font-bold px-3 py-1 bg-brand-100 rounded-full text-sm">{data.length} Valid Records</span>}
          </div>
          
          <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
            {data.length > 0 ? (
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-6 py-4 font-semibold text-slate-600">ID</th>
                    <th className="px-6 py-4 font-semibold text-slate-600">Mapped Name</th>
                    <th className="px-6 py-4 font-semibold text-slate-600">Mapped Email</th>
                    <th className="px-6 py-4 font-semibold text-slate-600">Team / Data</th>
                    <th className="px-6 py-4 font-semibold text-slate-600">Status</th>
                    <th className="px-6 py-4 font-semibold text-slate-600 text-right">PDF File</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-slate-500 font-mono">{row.id}</td>
                      <td className="px-6 py-4 font-bold text-slate-800">{row.Name || '-'}</td>
                      <td className="px-6 py-4 text-slate-500">{row.Email || '-'}</td>
                      <td className="px-6 py-4 text-slate-500">{row.Team || row.Position || '-'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semi-bold ${row.status === 'Generated' || row.status === 'Sent' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                         {row.certificateUrl ? (
                           <a href={row.certificateUrl} target="_blank" rel="noreferrer" className="inline-flex items-center text-brand-600 hover:text-brand-800 font-semibold px-3 py-1.5 bg-brand-50 hover:bg-brand-100 rounded-md transition-colors">
                              View PDF <ExternalLink className="w-4 h-4 ml-2" />
                           </a>
                         ) : (
                           <span className="text-slate-300 italic text-xs">Waiting...</span>
                         )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 text-slate-400 h-64">
                <FileText className="w-12 h-12 mb-4 opacity-50" />
                <p>No mapped data synced yet. Upload a CSV to commence.</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default UploadData;
