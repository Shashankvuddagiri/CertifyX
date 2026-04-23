require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '100mb' }));
// Global logger for diagnostics
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});
app.get('/api/health', (req, res) => res.json({ status: 'Platform Online', version: '2.0.1' }));

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Multer for template HTML files
const templateStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'src', 'templates'));
  },
  filename: (req, file, cb) => {
    // Keep original name but ensure it's .html
    const name = file.originalname.toLowerCase().endsWith('.html') 
      ? file.originalname 
      : `${file.originalname}.html`;
    cb(null, name);
  }
});
const templateUpload = multer({ 
  storage: templateStorage,
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() === '.html') {
      cb(null, true);
    } else {
      cb(new Error('Only HTML files are allowed'));
    }
  }
});

const certificatesDir = path.join(__dirname, 'certificates');
if (!fs.existsSync(certificatesDir)) fs.mkdirSync(certificatesDir);

const templateBasesDir = path.join(__dirname, 'src', 'templates', 'bases');
if (!fs.existsSync(templateBasesDir)) fs.mkdirSync(templateBasesDir, { recursive: true });

app.use('/certificates', express.static(certificatesDir));
app.use('/template-bases', express.static(templateBasesDir));

// Multer for image design bases
const designStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, templateBasesDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const designUpload = multer({ storage: designStorage });

// ----- SETTINGS & DATA PERSISTENCE -----
let templateSettings = {};
const settingsPath = path.join(__dirname, 'settings.json');
const participantsPath = path.join(__dirname, 'participants.json');
const campaignsPath = path.join(__dirname, 'campaigns.json');

if (fs.existsSync(settingsPath)) {
  try {
    templateSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch (err) {
    console.error('Error reading settings file', err);
  }
}

// Memory store backed by disk
let participantsData = [];
if (fs.existsSync(participantsPath)) {
  try {
    participantsData = JSON.parse(fs.readFileSync(participantsPath, 'utf8'));
  } catch (err) {
    console.error('Error reading participants file', err);
  }
}

let campaignsData = [];
if (fs.existsSync(campaignsPath)) {
  try {
    campaignsData = JSON.parse(fs.readFileSync(campaignsPath, 'utf8'));
  } catch (err) {
    console.error('Error reading campaigns file', err);
  }
}

const saveParticipants = () => {
  try {
    fs.writeFileSync(participantsPath, JSON.stringify(participantsData, null, 2));
  } catch (err) {
    console.error('Error saving participants', err);
  }
};

const saveCampaigns = () => {
  try {
    fs.writeFileSync(campaignsPath, JSON.stringify(campaignsData, null, 2));
  } catch (err) {
    console.error('Error saving campaigns', err);
  }
};

const applySettings = (html, templateName) => {
  const settings = templateSettings[templateName];
  if (!settings) return html;

  let finalHtml = html;
  
  // 1. Logo/Signature injection
  if (settings.logo1) finalHtml = finalHtml.replace(/<img id="logo1"[^>]*src="[^"]*"/g, (match) => match.replace(/src="[^"]*"/, `src="${settings.logo1}"`));
  if (settings.logo2) finalHtml = finalHtml.replace(/<img id="logo2"[^>]*src="[^"]*"/g, (match) => match.replace(/src="[^"]*"/, `src="${settings.logo2}"`));
  if (settings.signature) finalHtml = finalHtml.replace(/<img id="signature"[^>]*src="[^"]*"/g, (match) => match.replace(/src="[^"]*"/, `src="${settings.signature}"`));

  // 2. Dynamic Styles
  if (settings.transforms) {
    const idSelectorMap = {
      NAME: '.name-wrapper',
      TEAM: '.team-text',
      POSITION: '.badge-wrapper',
      DATE: '.date-wrapper, .date-block',
      SIGNATURE: '.signature-block',
      LOGO: '.branding-logo'
    };

    let styleTag = '<style>\n';
    Object.entries(settings.transforms).forEach(([id, transform]) => {
      const selector = idSelectorMap[id];
      if (selector) {
        const enabled = settings.enabledFields?.[id] !== false;
        styleTag += `      ${selector} { 
        position: absolute !important; 
        left: ${transform.x}px !important; 
        top: ${transform.y}px !important;
        display: ${enabled ? 'block' : 'none'} !important;
        ${transform.fontSize ? `font-size: ${transform.fontSize}px !important;` : ''}
        font-family: 'Outfit', sans-serif !important;
        font-weight: ${id === 'POSITION' ? '900' : '700'} !important;
        color: ${id === 'NAME' ? '#0f172a' : id === 'TEAM' ? '#64748b' : id === 'POSITION' ? '#2563eb' : '#94a3b8'} !important;
        transform: translate(-50%, -50%) !important;
        white-space: nowrap !important;
        width: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        text-align: center !important;
      }\n`;
      }
    });
    styleTag += '    </style>';
    finalHtml = finalHtml.replace('</head>', `${styleTag}\n</head>`);
  }

  return finalHtml;
};

app.post('/api/template/:name/settings', (req, res) => {
  const { name } = req.params;
  templateSettings[name] = req.body;
  fs.writeFileSync(settingsPath, JSON.stringify(templateSettings, null, 2));
  res.json({ message: 'Template settings saved successfully' });
});

app.get('/api/template/:name/settings', (req, res) => {
  res.json(templateSettings[req.params.name] || {});
});

// SMTP SETTINGS
app.get('/api/settings/smtp', (req, res) => {
  res.json(templateSettings.smtp || {});
});

app.post('/api/settings/smtp', (req, res) => {
  templateSettings.smtp = req.body;
  fs.writeFileSync(settingsPath, JSON.stringify(templateSettings, null, 2));
  res.json({ message: 'SMTP settings saved' });
});


// Participants are now loaded from disk at the top of the file

const getTemplateContent = (templateName) => {
  const templatesDir = path.join(__dirname, 'src', 'templates');
  const basesDir = path.join(templatesDir, 'bases');
  
  // 1. Try Image Base (Synthetic HTML)
  if (fs.existsSync(path.join(basesDir, templateName))) {
    const imageUrl = `http://127.0.0.1:5000/template-bases/${encodeURIComponent(templateName)}`;
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap" rel="stylesheet">
        <style>
          body { margin: 0; padding: 0; background: white; font-family: 'Outfit', sans-serif; overflow: hidden; }
          .certificate-base {
            width: 1122.5px; height: 793.7px; 
            background-image: url('${imageUrl}');
            background-size: contain; background-repeat: no-repeat;
            position: relative;
          }
          .placeholder { position: absolute; }
          .branding-logo { position: absolute; left: 0; top: 0; }
        </style>
      </head>
      <body>
        <div class="certificate-base">
          <div class="placeholder name-wrapper">{{NAME}}</div>
          <div class="placeholder team-text">{{TEAM}}</div>
          <div class="placeholder badge-wrapper">{{POSITION}}</div>
          <div class="placeholder date-wrapper">{{DATE}}</div>
          <div class="signature-block"></div>
          <div class="branding-logo"><img id="custom-branding-logo" src="" style="max-width: 150px; display: none;" /></div>
        </div>
      </body>
      </html>
    `;
  }

  // 2. Try HTML Template
  const templatePath = path.join(templatesDir, `${templateName}.html`);
  if (fs.existsSync(templatePath)) {
    return fs.readFileSync(templatePath, 'utf8');
  }
  
  return null;
};

// 1. Upload CSV (Now expects parsed/mapped JSON from frontend PapaParse)
app.post('/api/upload', (req, res) => {
  try {
    const { data } = req.body;
    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: 'No data provided natively.' });
    }

    participantsData = data.map((record, index) => ({
      id: index + 1,
      ...record,
      status: 'Pending'
    }));
    
    saveParticipants();
    res.json({ message: 'Data synced successfully', data: participantsData });
  } catch (error) {
    console.error('Error syncing mapped CSV:', error);
    res.status(500).json({ error: 'Failed to sync CSV mapping' });
  }
});

// Singleton browser instance
let browserInstance = null;
const getBrowser = async () => {
  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }
  return browserInstance;
};

// 1.5 Get Participants for Preview
app.get('/api/participants', (req, res) => {
  res.json(participantsData);
});

// 2. Generate Certificates
app.post('/api/generate', async (req, res) => {
  const { templateName, ids } = req.body;
  if (!templateName) return res.status(400).json({ error: 'Template name is required' });

  const rawHtml = getTemplateContent(templateName);
  if (!rawHtml) return res.status(404).json({ error: 'Template not found' });

  const templateHtml = applySettings(rawHtml, templateName);

  let targets = participantsData;
  if (ids && ids.length > 0) {
    targets = participantsData.filter(p => ids.includes(p.id));
  }

  try {
    const browser = await getBrowser();
    const page = await browser.newPage();
    
    for (const participant of targets) {
      try {
        console.log(`Generating certificate for ${participant.id}: ${participant.Name}`);
        let html = templateHtml;
        
        const name = participant.Name || participant.name || participant['Name '] || 'Participant';
        const team = participant.Team || participant.team || participant['team name'] || participant['Team Name'] || 'N/A';
        const position = participant.Position || participant.position || participant.Role || 'Participant';
        const date = participant.Date || participant.date || new Date().toLocaleDateString();
        
        html = html.replace(/{{NAME}}|\{NAME\}/g, name)
                   .replace(/{{TEAM}}|\{TEAM\}/g, team)
                   .replace(/{{POSITION}}|\{POSITION\}/g, position)
                   .replace(/{{DATE}}|\{DATE\}/g, date);

        await page.setContent(html, { waitUntil: 'load', timeout: 30000 });
        
        const fileName = `${participant.id}_${name.replace(/[^a-z0-9]/gi, '_')}.pdf`;
        const filePath = path.join(certificatesDir, fileName);
        
        await page.pdf({
          path: filePath,
          format: 'A4',
          landscape: true,
          printBackground: true
        });
        
        participant.status = 'Generated';
        participant.error = null;
        participant.certificatePath = filePath;
        participant.certificateUrl = `http://127.0.0.1:${port}/certificates/${fileName}`;
        
        // Brief delay to prevent Windows/OneDrive file locks
        await new Promise(r => setTimeout(r, 500));
      } catch (innerError) {
        console.error(`Error generating for ${participant.id}:`, innerError.message);
        participant.status = 'Error';
        participant.error = innerError.message;
      }
    }
    
    saveParticipants();
    await page.close();
    res.json({ message: 'Certificates generated successfully', data: participantsData });
  } catch (error) {
    console.error('Critical generation error:', error);
    res.status(500).json({ error: 'Generation cycle failed' });
  }
});

// 3. Send Emails
app.post('/api/send', async (req, res) => {
  const { ids, emailSubject, emailBody, cc } = req.body;
  
  // Use stored SMTP settings if available
  const smtp = templateSettings.smtp || {};
  const host = smtp.host || process.env.EMAIL_HOST || 'smtp.gmail.com';
  const port = parseInt(smtp.port || process.env.EMAIL_PORT || '587');
  const user = smtp.user || process.env.EMAIL_USER;
  const pass = smtp.pass || process.env.EMAIL_APP_PASSWORD;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined
  });

  let sent = 0;
  let failed = 0;
  const targets = ids && ids.length > 0 
    ? participantsData.filter(p => ids.includes(p.id) && p.status === 'Generated')
    : participantsData.filter(p => p.status === 'Generated');

  for (const participant of targets) {
    const participantEmail = participant.Email || participant.email || participant['mail ID'] || participant['mail id'] || participant['Mail ID'];
    if (!participantEmail || !participant.certificatePath) {
      participant.status = 'Failed_Email';
      failed++; continue;
    }

    try {
      if (user && pass) {
        await transporter.sendMail({
          from: user,
          to: participantEmail,
          cc: cc || undefined,
          subject: emailSubject || 'Your Certificate',
          html: emailBody || '<p>Congratulations! Please find your certificate attached.</p>',
          attachments: [{ filename: path.basename(participant.certificatePath), path: participant.certificatePath }]
        });
      } else {
        // Simulation mode
        await new Promise(r => setTimeout(r, 200));
      }
      participant.status = 'Sent';
      sent++;
    } catch (error) {
      console.error(`Error sending email to ${participantEmail}:`, error);
      participant.status = 'Failed_Email';
      failed++;
    }
  }

  saveParticipants();
  res.json({ message: `Emails processed. Sent: ${sent}, Failed: ${failed}`, data: participantsData });
});

// 4. Template Management
app.get('/api/templates', (req, res) => {
  const templatesDir = path.join(__dirname, 'src', 'templates');
  const basesDir = path.join(__dirname, 'src', 'templates', 'bases');
  
  const templates = [];

  // Add HTML templates
  if (fs.existsSync(templatesDir)) {
    fs.readdirSync(templatesDir).forEach(file => {
      const lowerFile = file.toLowerCase();
      if (file.endsWith('.html') && !lowerFile.includes('cloud') && !lowerFile.includes('hack')) {
        templates.push({
          id: file.replace('.html', ''),
          name: file.replace('.html', '').split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          type: 'html'
        });
      }
    });
  }

  // Add Image designs
  if (fs.existsSync(basesDir)) {
    fs.readdirSync(basesDir).forEach(file => {
      if (file.match(/\.(png|jpg|jpeg)$/i)) {
        templates.push({
          id: file,
          name: `Design: ${file.split('-').slice(1).join('-') || file}`,
          type: 'image',
          url: `/template-bases/${file}`
        });
      }
    });
  }
  
  res.json(templates);
});

app.post('/api/templates/design', designUpload.single('design'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ 
    message: 'Certificate design uploaded', 
    id: req.file.filename,
    type: 'image'
  });
});

app.delete('/api/template/:name', (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const templatesDir = path.join(__dirname, 'src', 'templates');
  const basesDir = path.join(__dirname, 'src', 'templates', 'bases');
  
  const htmlPath = path.join(templatesDir, `${name}.html`);
  const imagePath = path.join(basesDir, name);
  
  try {
    if (fs.existsSync(htmlPath)) fs.unlinkSync(htmlPath);
    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
    
    // Clear settings too
    if (templateSettings[name]) {
      delete templateSettings[name];
      fs.writeFileSync(settingsPath, JSON.stringify(templateSettings, null, 2));
    }
    
    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Failed to delete template completely' });
  }
});

app.get('/api/template/:name', (req, res) => {
  const { name } = req.params;
  const templatesDir = path.join(__dirname, 'src', 'templates');
  const basesDir = path.join(__dirname, 'src', 'templates', 'bases');

  // If it's an image base
  if (fs.existsSync(path.join(basesDir, name))) {
    const imageUrl = `http://127.0.0.1:5000/template-bases/${encodeURIComponent(name)}`;
    const baseHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { margin: 0; padding: 0; background: white; font-family: 'Outfit', sans-serif; overflow: hidden; }
          .certificate-base {
            width: 1122.5px; height: 793.7px; /* A4 Landscape at 96dpi */
            background-image: url('${imageUrl}');
            background-size: contain; background-repeat: no-repeat;
            position: relative;
          }
          .placeholder { position: absolute; font-weight: bold; text-align: center; }
          .name-wrapper { width: 100%; top: 50%; font-size: 40px; }
          .team-text { width: 100%; top: 60%; font-size: 24px; }
          .badge-wrapper { width: 100%; top: 70%; font-size: 20px; }
        </style>
      </head>
      <body>
        <div class="certificate-base">
          <div class="placeholder name-wrapper">{{NAME}}</div>
          <div class="placeholder team-text">{{TEAM}}</div>
          <div class="placeholder badge-wrapper">{{POSITION}}</div>
          <div class="placeholder date-wrapper">{{DATE}}</div>
          
          <!-- Branding Logo Placeholder (Positioned by settings) -->
          <div class="branding-logo" style="position: absolute;">
             <img id="custom-branding-logo" src="" style="max-width: 150px; display: none;" />
          </div>
        </div>
      </body>
      </html>
    `;
    return res.send(applySettings(baseHtml, name));
  }

  const rawHtml = getTemplate(name);
  if (rawHtml) {
    return res.send(applySettings(rawHtml, name));
  }
  res.status(404).send('Template not found');
});

// CAMPAIGN MANAGEMENT
app.get('/api/campaigns', (req, res) => {
  res.json(campaignsData);
});

app.post('/api/campaigns/archive', (req, res) => {
  const { name, template } = req.body;
  
  const campaign = {
    id: `camp_${Date.now()}`,
    name: name || `Campaign ${new Date().toLocaleDateString()}`,
    date: new Date().toISOString(),
    templateName: template,
    stats: {
      total: participantsData.length,
      sent: participantsData.filter(p => p.status === 'Sent').length,
      failed: participantsData.filter(p => p.status === 'Failed_Email' || p.status === 'Error').length
    },
    participants: [...participantsData]
  };

  campaignsData.unshift(campaign);
  saveCampaigns();

  // Clear current data after archive? 
  // users might want to start fresh 
  participantsData = [];
  if (fs.existsSync(participantsPath)) fs.unlinkSync(participantsPath);
  
  res.json({ message: 'Campaign archived successfully', campaign });
});

app.get('/api/stats', (req, res) => {
  const total = participantsData.length;
  const generated = participantsData.filter(p => p.status === 'Generated' || p.status === 'Sent').length;
  const sent = participantsData.filter(p => p.status === 'Sent').length;
  const failed = participantsData.filter(p => p.status === 'Failed_Email').length;

  res.json({
    total,
    generated,
    sent,
    failed
  });
});

app.listen(port, '0.0.0.0', () => {
    console.log(`
  🚀 CertifyX Platform Online
  ---------------------------
  Backend: http://127.0.0.1:${port}
  Health Check: http://127.0.0.1:${port}/api/health
  ---------------------------
    `);
});
