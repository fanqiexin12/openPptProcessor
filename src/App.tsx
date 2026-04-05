import React, { useState, useRef } from 'react';
import JSZip from 'jszip';
import { 
  FileUp, 
  Download, 
  RotateCw, 
  Maximize, 
  Settings2, 
  FileType, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Constants & Types ---

const ROTATION_UNIT = 60000; // PPT rotation is in 60,000ths of a degree

interface ProcessingState {
  status: 'idle' | 'processing' | 'completed' | 'error';
  message: string;
}

interface TransformOptions {
  rotation: number;
  scale: number;
}

// --- Utility Functions ---

/**
 * Parses XML string into a DOM Document
 */
const parseXml = (xmlString: string): Document => {
  const parser = new DOMParser();
  return parser.parseFromString(xmlString, 'application/xml');
};

/**
 * Serializes DOM Document back to string
 */
const serializeXml = (doc: Document): string => {
  const serializer = new XMLSerializer();
  return serializer.serializeToString(doc);
};

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [options, setOptions] = useState<TransformOptions>({ rotation: 0, scale: 1 });
  const [state, setState] = useState<ProcessingState>({ status: 'idle', message: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setState({ status: 'idle', message: '' });
    }
  };

  const processPptx = async () => {
    if (!file) return;

    setState({ status: 'processing', message: '正在解析 PPT 文件...' });

    try {
      const zip = new JSZip();
      const content = await zip.loadAsync(file);
      
      // 1. Find all slide files
      const slideFiles = Object.keys(content.files).filter(path => 
        path.startsWith('ppt/slides/slide') && path.endsWith('.xml')
      );

      if (slideFiles.length === 0) {
        throw new Error('未在文件中找到幻灯片内容。');
      }

      let totalImagesProcessed = 0;

      // 2. Process each slide
      for (const slidePath of slideFiles) {
        const slideXmlText = await content.file(slidePath)?.async('string');
        if (!slideXmlText) continue;

        const doc = parseXml(slideXmlText);
        
        // Find all picture elements <p:pic>
        // Note: Namespaces can be tricky in DOMParser, we use localName for compatibility
        const pics = Array.from(doc.getElementsByTagNameNS('*', 'pic'));
        
        pics.forEach(pic => {
          // Find transform element <a:xfrm>
          const xfrm = pic.getElementsByTagNameNS('*', 'xfrm')[0];
          if (!xfrm) return;

          // --- Handle Rotation ---
          if (options.rotation !== 0) {
            // PPT rotation is clockwise in 60,000ths of a degree
            // Existing rotation might be present
            const currentRot = parseInt(xfrm.getAttribute('rot') || '0');
            const newRot = (currentRot + (options.rotation * ROTATION_UNIT)) % (360 * ROTATION_UNIT);
            xfrm.setAttribute('rot', newRot.toString());
          }

          // --- Handle Scaling ---
          if (options.scale !== 1) {
            const ext = xfrm.getElementsByTagNameNS('*', 'ext')[0];
            if (ext) {
              const cx = parseInt(ext.getAttribute('cx') || '0');
              const cy = parseInt(ext.getAttribute('cy') || '0');
              
              if (cx > 0 && cy > 0) {
                ext.setAttribute('cx', Math.round(cx * options.scale).toString());
                ext.setAttribute('cy', Math.round(cy * options.scale).toString());
              }
            }
          }

          totalImagesProcessed++;
        });

        // Save modified XML back to zip
        content.file(slidePath, serializeXml(doc));
      }

      setState({ status: 'processing', message: '正在生成新文件...' });

      // 3. Generate new blob
      const blob = await content.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      
      // 4. Trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = `processed_${file.name}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setState({ 
        status: 'completed', 
        message: `处理完成！共处理了 ${totalImagesProcessed} 张图片。文件已自动下载。` 
      });

    } catch (err) {
      console.error(err);
      setState({ 
        status: 'error', 
        message: err instanceof Error ? err.message : '处理过程中发生未知错误。' 
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <header className="mb-12 text-center">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center justify-center w-16 h-16 bg-orange-500 rounded-2xl mb-4 shadow-lg shadow-orange-200"
          >
            <FileType className="text-white w-8 h-8" />
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-3xl font-bold tracking-tight text-slate-800"
          >
            PPT 图片自动化处理工具
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-2 text-slate-500"
          >
            离线可用 • 批量旋转 • 自动缩放
          </motion.p>
        </header>

        <div className="grid gap-6 md:grid-cols-1">
          {/* Main Card */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden"
          >
            <div className="p-8">
              {/* File Upload Area */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`
                  relative group cursor-pointer border-2 border-dashed rounded-2xl p-12 transition-all duration-300
                  flex flex-col items-center justify-center gap-4
                  ${file ? 'border-orange-500 bg-orange-50/30' : 'border-slate-200 hover:border-orange-400 hover:bg-slate-50'}
                `}
              >
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pptx"
                  className="hidden"
                />
                
                <div className={`
                  w-16 h-16 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-110
                  ${file ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-400'}
                `}>
                  {file ? <CheckCircle2 className="w-8 h-8" /> : <FileUp className="w-8 h-8" />}
                </div>

                <div className="text-center">
                  <p className="text-lg font-semibold text-slate-700">
                    {file ? file.name : '点击或拖拽上传 PPTX 文件'}
                  </p>
                  <p className="text-sm text-slate-400 mt-1">
                    仅支持 .pptx 格式
                  </p>
                </div>
              </div>

              {/* Options Section */}
              <div className="mt-10 space-y-8">
                <div className="flex items-center gap-2 text-slate-800 font-bold border-b border-slate-100 pb-2">
                  <Settings2 className="w-5 h-5 text-orange-500" />
                  <h2>处理选项</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Rotation Slider */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
                        <RotateCw className="w-4 h-4" /> 旋转角度
                      </label>
                      <span className="px-2 py-1 bg-slate-100 rounded text-xs font-mono font-bold text-slate-600">
                        {options.rotation}°
                      </span>
                    </div>
                    <input 
                      type="range" 
                      min="-180" 
                      max="180" 
                      step="1"
                      value={options.rotation}
                      onChange={(e) => setOptions(prev => ({ ...prev, rotation: parseInt(e.target.value) }))}
                      className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                      <span>-180°</span>
                      <span>0°</span>
                      <span>180°</span>
                    </div>
                  </div>

                  {/* Scale Slider */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
                        <Maximize className="w-4 h-4" /> 缩放比例
                      </label>
                      <span className="px-2 py-1 bg-slate-100 rounded text-xs font-mono font-bold text-slate-600">
                        {options.scale.toFixed(2)}x
                      </span>
                    </div>
                    <input 
                      type="range" 
                      min="0.1" 
                      max="3" 
                      step="0.05"
                      value={options.scale}
                      onChange={(e) => setOptions(prev => ({ ...prev, scale: parseFloat(e.target.value) }))}
                      className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                      <span>0.1x</span>
                      <span>1.0x</span>
                      <span>3.0x</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-12">
                <button
                  disabled={!file || state.status === 'processing'}
                  onClick={processPptx}
                  className={`
                    w-full py-4 rounded-2xl font-bold text-lg shadow-lg transition-all duration-300 flex items-center justify-center gap-3
                    ${!file || state.status === 'processing' 
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none' 
                      : 'bg-orange-500 text-white hover:bg-orange-600 active:scale-[0.98] shadow-orange-200'}
                  `}
                >
                  {state.status === 'processing' ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      正在处理...
                    </>
                  ) : (
                    <>
                      <Download className="w-6 h-6" />
                      开始处理并下载
                    </>
                  )}
                </button>
              </div>

              {/* Status Message */}
              <AnimatePresence mode="wait">
                {state.message && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={`
                      mt-6 p-4 rounded-xl flex items-start gap-3
                      ${state.status === 'error' ? 'bg-red-50 text-red-700 border border-red-100' : 
                        state.status === 'completed' ? 'bg-green-50 text-green-700 border border-green-100' : 
                        'bg-blue-50 text-blue-700 border border-blue-100'}
                    `}
                  >
                    {state.status === 'error' ? <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" /> : 
                     state.status === 'completed' ? <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" /> : 
                     <Loader2 className="w-5 h-5 shrink-0 mt-0.5 animate-spin" />}
                    <p className="text-sm font-medium leading-relaxed">{state.message}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Instructions Card */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="bg-slate-100/50 rounded-3xl p-8 border border-slate-200/50"
          >
            <h3 className="text-slate-800 font-bold flex items-center gap-2 mb-4">
              <ImageIcon className="w-5 h-5 text-slate-400" /> 使用说明
            </h3>
            <ul className="space-y-3 text-sm text-slate-600">
              <li className="flex gap-3">
                <span className="flex-none w-5 h-5 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[10px] font-bold">1</span>
                <span>上传您的 <b>.pptx</b> 文件。</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-none w-5 h-5 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[10px] font-bold">2</span>
                <span>设置需要旋转的角度（顺时针）或缩放比例。</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-none w-5 h-5 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[10px] font-bold">3</span>
                <span>点击“开始处理”，程序将自动修改所有幻灯片中的图片并下载新文件。</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-none w-5 h-5 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[10px] font-bold">4</span>
                <span><b>离线支持：</b> 本工具完全在浏览器本地运行，不上传任何数据，适合在无网络环境使用。</span>
              </li>
            </ul>
          </motion.div>
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center text-slate-400 text-xs">
          <p>© 2026 PPT 自动化工具 • 纯前端处理 • 隐私安全</p>
        </footer>
      </div>
    </div>
  );
}
