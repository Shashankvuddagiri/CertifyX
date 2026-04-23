import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import UploadData from './pages/UploadData';
import TemplatePreview from './pages/TemplatePreview';
import Operations from './pages/Operations';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/operations" />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/operations" element={<Operations />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
