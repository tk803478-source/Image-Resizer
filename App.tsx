import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Icons, DEFAULT_RESIZE_OPTIONS } from './constants';
import { getImageDimensions, resizeImage, fileToDataString, formatBytes } from './utils/imageUtils';
import { analyzeImage } from './services/geminiService';
import { AIAnalysisResult, ImageDimensions, ResizeOptions } from './types';

type Page = 'home' | 'editor' | 'mission' | 'results';

function App() {
  // Navigation State
  const [currentPage, setCurrentPage] = useState<Page>('home');

  // Data State
  const [file, setFile] = useState<File | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [resizedSrc, setResizedSrc] = useState<string | null>(null);
  
  const [originalDims, setOriginalDims] = useState<ImageDimensions>({ width: 0, height: 0 });
  
  const [options, setOptions] = useState<ResizeOptions>(DEFAULT_RESIZE_OPTIONS);
  const [isResizing, setIsResizing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<'resize' | 'ai'>('resize');
  const [compareMode, setCompareMode] = useState(false);

  const resizeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Handlers ---

  const navigateTo = (page: Page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFileChange = async (selectedFile: File) => {
    if (!selectedFile) return;
    
    setFile(selectedFile);
    setAnalysis(null);
    setResizedSrc(null);
    setActiveTab('resize');
    
    try {
      const dims = await getImageDimensions(selectedFile);
      setOriginalDims(dims);
      
      // Reset options for new file
      setOptions(prev => ({ 
        ...prev, 
        width: dims.width, 
        height: dims.height,
        percentage: 100 
      }));
      
      const src = await fileToDataString(selectedFile);
      setPreviewSrc(src);
      
      // Auto-navigate to editor
      navigateTo('editor');
    } catch (err) {
      console.error("Error loading image", err);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const updateDimensions = (key: 'width' | 'height', value: number) => {
    if (value < 0) return;
    
    let newW = options.width;
    let newH = options.height;

    if (key === 'width') {
      newW = value;
      if (options.maintainAspectRatio && originalDims.width > 0) {
        const ratio = originalDims.height / originalDims.width;
        newH = Math.round(value * ratio);
      }
    } else {
      newH = value;
      if (options.maintainAspectRatio && originalDims.height > 0) {
        const ratio = originalDims.width / originalDims.height;
        newW = Math.round(value * ratio);
      }
    }
    
    setOptions(prev => ({ ...prev, width: newW, height: newH, percentage: Math.round((newW / originalDims.width) * 100) || 0 }));
  };

  const updatePercentage = (val: number) => {
    if (val < 1) val = 1;
    if (val > 500) val = 500;
    
    const newW = Math.round(originalDims.width * (val / 100));
    const newH = Math.round(originalDims.height * (val / 100));
    
    setOptions(prev => ({ ...prev, percentage: val, width: newW, height: newH }));
  };

  // Live Resize Effect
  useEffect(() => {
    if (!previewSrc || !options.width || !options.height) return;

    if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);

    setIsResizing(true);
    resizeTimeoutRef.current = setTimeout(async () => {
      try {
        const result = await resizeImage(previewSrc, options);
        setResizedSrc(result);
      } catch (err) {
        console.error("Resize failed", err);
      } finally {
        setIsResizing(false);
      }
    }, 400);

    return () => {
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
    };
  }, [previewSrc, options.width, options.height, options.quality, options.format]);

  const handleEcoScan = async () => {
    if (!previewSrc) return;
    setIsAnalyzing(true);
    try {
      const srcToAnalyze = resizedSrc || previewSrc;
      const result = await analyzeImage(srcToAnalyze, file?.type || 'image/jpeg');
      setAnalysis(result);
    } catch (err) {
      console.error("Analysis failed", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const downloadImage = () => {
    if (!resizedSrc) return;
    const link = document.createElement('a');
    link.download = `ecolens_resized_${options.width}x${options.height}.${options.format.split('/')[1]}`;
    link.href = resizedSrc;
    link.click();
  };

  const originalSize = file?.size || 0;
  const newSizeEstimate = resizedSrc ? Math.round((resizedSrc.length - 22) * 0.75) : originalSize; 
  const savedBytes = Math.max(0, originalSize - newSizeEstimate);
  const savedCO2 = (savedBytes / (1024 * 1024)) * 0.35; // g CO2
  const sizePercent = Math.round((newSizeEstimate / originalSize) * 100);

  // --- Renders ---

  const Navbar = () => (
    <header className="h-16 bg-white/90 backdrop-blur-md border-b border-nature-200 flex items-center px-6 justify-between shadow-sm z-30 fixed w-full top-0">
      <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigateTo('home')}>
        <div className="w-8 h-8 bg-gradient-to-br from-nature-400 to-nature-600 rounded-lg flex items-center justify-center text-white shadow-md group-hover:rotate-12 transition-transform duration-300">
            <Icons.Leaf className="w-5 h-5" />
        </div>
        <span className="text-xl font-bold text-nature-900 tracking-tight">EcoLens</span>
      </div>
      <nav className="flex gap-2 md:gap-4">
        <button 
            onClick={() => navigateTo('home')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${currentPage === 'home' ? 'text-nature-600 bg-nature-50' : 'text-gray-600 hover:bg-gray-50'}`}
        >
            Home
        </button>
        <button 
            onClick={() => navigateTo('mission')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${currentPage === 'mission' ? 'text-nature-600 bg-nature-50' : 'text-gray-600 hover:bg-gray-50'}`}
        >
            Mission
        </button>
        {file && (
            <button 
            onClick={() => navigateTo('editor')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${currentPage === 'editor' ? 'text-nature-600 bg-nature-50' : 'text-gray-600 hover:bg-gray-50'}`}
            >
            Editor
            </button>
        )}
      </nav>
    </header>
  );

  const LandingView = () => (
    <main className="flex-1 pt-16 flex flex-col items-center justify-center relative overflow-hidden bg-gradient-to-b from-nature-50 via-white to-nature-50 min-h-screen">
        {/* Background Elements */}
        <div className="absolute top-20 right-0 w-[500px] h-[500px] bg-nature-200/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-lime-200/20 rounded-full blur-3xl"></div>

        <div className="max-w-4xl w-full z-10 text-center space-y-12 px-6 py-12">
            <div className="space-y-6 animate-fade-in-up">
            <span className="inline-block px-4 py-1 rounded-full bg-nature-100 text-nature-700 text-xs font-bold uppercase tracking-widest">
                Web 3.0 Sustainable Tools
            </span>
            <h1 className="text-5xl md:text-7xl font-extrabold text-nature-900 tracking-tight leading-[1.1]">
                Small Images.<br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-nature-600 to-lime-500">Big Impact.</span>
            </h1>
            <p className="text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
                Reduce your digital carbon footprint instantly. Resize, optimize, and analyze your images with the power of AI.
            </p>
            </div>

            {/* Upload Card */}
            <div 
            className="group relative w-full max-w-2xl mx-auto h-72 bg-white/60 backdrop-blur-xl border-2 border-dashed border-nature-300 rounded-[2rem] shadow-2xl hover:border-nature-500 hover:bg-white hover:scale-[1.02] transition-all duration-500 flex flex-col items-center justify-center cursor-pointer overflow-hidden"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            >
            <input 
                type="file" 
                className="absolute inset-0 opacity-0 cursor-pointer z-20"
                onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                accept="image/*"
            />
            <div className="transform group-hover:scale-110 transition-transform duration-500 mb-6">
                <div className="w-24 h-24 bg-gradient-to-tr from-nature-400 to-nature-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-nature-500/40">
                    <Icons.Upload className="w-10 h-10" />
                </div>
            </div>
            <span className="text-2xl font-bold text-nature-900">Drop your image here</span>
            <span className="text-base text-nature-500 mt-2">or click to browse</span>
            </div>

            {/* Feature Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 text-left">
            {[
                { icon: Icons.Leaf, title: "Carbon Calculator", text: "See exactly how much CO2 you save with every KB reduced.", color: "bg-nature-100 text-nature-600" },
                { icon: Icons.Sparkles, title: "Gemini AI Inside", text: "Get auto-generated alt text and eco-tips for your content.", color: "bg-purple-100 text-purple-600" },
                { icon: Icons.LockClosed, title: "Privacy First", text: "Images are processed locally in your browser. Secure & fast.", color: "bg-blue-100 text-blue-600" }
            ].map((feature, i) => (
                <div key={i} className="bg-white p-8 rounded-3xl shadow-soft border border-gray-100 hover:shadow-lg transition-all duration-300">
                <div className={`w-12 h-12 ${feature.color} rounded-2xl flex items-center justify-center mb-4`}>
                    <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{feature.title}</h3>
                <p className="text-slate-500 leading-relaxed">{feature.text}</p>
                </div>
            ))}
            </div>
        </div>
    </main>
  );

  const MissionView = () => (
    <main className="flex-1 pt-24 pb-12 px-6 bg-nature-50 min-h-screen flex flex-col items-center">
        <div className="max-w-3xl w-full space-y-8 bg-white p-10 rounded-3xl shadow-xl border border-nature-100">
            <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-nature-100 rounded-xl text-nature-600">
                    <Icons.Info className="w-8 h-8" />
                </div>
                <h2 className="text-3xl font-bold text-nature-900">Why Digital Waste Matters</h2>
            </div>
            
            <div className="prose prose-lg text-slate-600">
                <p>
                    Did you know that the internet produces approximately <strong>3.7% of global greenhouse emissions</strong>? That's comparable to the airline industry. Every time an image is loaded on a website, energy is consumed by servers, networks, and devices.
                </p>
                <p>
                    Large, unoptimized images are one of the biggest contributors to heavy websites. By resizing and compressing your images, you are directly reducing the energy required to transmit that data.
                </p>
                <div className="bg-nature-50 p-6 rounded-2xl border-l-4 border-nature-500 my-8">
                    <h4 className="font-bold text-nature-800 mb-2">The EcoLens Promise</h4>
                    <p className="text-sm italic">
                        "We believe that small changes in our digital habits can lead to significant environmental impact. Optimized media is the first step towards a greener web."
                    </p>
                </div>
            </div>

            <div className="flex justify-center pt-4">
                <button 
                    onClick={() => navigateTo('home')}
                    className="px-8 py-3 bg-nature-600 text-white rounded-xl font-bold shadow-lg hover:bg-nature-700 transition-all flex items-center gap-2"
                >
                    <Icons.ArrowLeft className="w-5 h-5" /> Back to Home
                </button>
            </div>
        </div>
    </main>
  );

  const EditorView = () => (
    <div className="flex-1 flex flex-col md:flex-row h-screen pt-16 overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 bg-slate-100 bg-checker relative flex flex-col z-0">
            <div className="flex-1 flex items-center justify-center p-8 overflow-auto custom-scrollbar">
            <div className="relative shadow-2xl bg-white/5 backdrop-blur-sm ring-1 ring-black/5 max-w-full max-h-full transition-all duration-300">
                {previewSrc && (
                    <img 
                    src={resizedSrc || previewSrc} 
                    alt="Preview" 
                    className="max-w-full max-h-[75vh] object-contain"
                    style={{ imageRendering: 'high-quality' }}
                    />
                )}
                {isResizing && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[2px] z-10 transition-all">
                        <div className="bg-white p-4 rounded-full shadow-xl animate-spin text-nature-500">
                        <Icons.Refresh className="w-6 h-6" />
                        </div>
                    </div>
                )}
            </div>
            </div>
            
            {/* Stats Bar */}
            <div className="h-14 bg-white border-t border-gray-200 flex items-center justify-between px-8 text-sm shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
                <div className="flex items-center gap-6 text-slate-500">
                    <span className="font-mono flex items-center gap-2"><Icons.Image className="w-4 h-4"/> {originalDims.width} × {originalDims.height}</span>
                    <span className="font-mono bg-slate-100 px-2 py-1 rounded">{formatBytes(file?.size || 0)}</span>
                </div>
                <div className="flex items-center gap-2 text-nature-700 font-medium bg-nature-50 px-3 py-1 rounded-full border border-nature-100">
                    <Icons.Leaf className="w-4 h-4" />
                    <span>Est. Savings: {savedCO2 > 0 ? savedCO2.toFixed(3) + ' g CO2' : '0 g'}</span>
                </div>
            </div>
        </div>

        {/* Sidebar */}
        <div className="w-full md:w-[400px] bg-white border-l border-gray-200 flex flex-col z-10 shadow-2xl">
            {/* Tabs */}
            <div className="flex border-b border-gray-100 p-2 gap-2 bg-gray-50/50">
                <button 
                onClick={() => setActiveTab('resize')}
                className={`flex-1 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'resize' ? 'bg-white text-nature-700 shadow-sm border border-gray-200' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                >
                <Icons.Settings className="w-4 h-4" />
                Resize
                </button>
                <button 
                onClick={() => setActiveTab('ai')}
                className={`flex-1 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'ai' ? 'bg-white text-nature-700 shadow-sm border border-gray-200' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                >
                <Icons.Sparkles className="w-4 h-4" />
                AI Eco-Scan
                </button>
            </div>

            {/* Controls Area */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-8">
                {activeTab === 'resize' ? (
                <div className="space-y-8 animate-fade-in">
                    {/* Mode Select */}
                    <div className="space-y-3">
                        <label className="text-xs uppercase font-bold text-slate-400 tracking-wider">Sizing Mode</label>
                        <div className="grid grid-cols-2 gap-2">
                            {['pixels', 'percentage'].map((m) => (
                                <button 
                                    key={m}
                                    onClick={() => setOptions(o => ({ ...o, mode: m as any }))}
                                    className={`py-2 px-4 rounded-lg text-sm font-medium border transition-all ${options.mode === m ? 'border-nature-500 text-nature-700 bg-nature-50' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                                >
                                    {m === 'pixels' ? 'Exact Pixels' : 'Percentage'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {options.mode === 'pixels' ? (
                        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500">Width</label>
                                <input 
                                    type="number" 
                                    value={options.width}
                                    onChange={(e) => updateDimensions('width', parseInt(e.target.value) || 0)}
                                    className="w-full p-3 bg-slate-50 border border-gray-200 rounded-xl font-mono text-center focus:ring-2 focus:ring-nature-200 focus:border-nature-400 outline-none transition-all"
                                />
                            </div>
                            <button 
                                onClick={() => setOptions(o => ({ ...o, maintainAspectRatio: !o.maintainAspectRatio }))}
                                className={`mb-3 p-2 rounded-full transition-colors ${options.maintainAspectRatio ? 'text-nature-500 bg-nature-100' : 'text-gray-300 hover:bg-gray-100'}`}
                            >
                                {options.maintainAspectRatio ? <Icons.LockClosed /> : <Icons.LockOpen />}
                            </button>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500">Height</label>
                                <input 
                                    type="number" 
                                    value={options.height}
                                    onChange={(e) => updateDimensions('height', parseInt(e.target.value) || 0)}
                                    className="w-full p-3 bg-slate-50 border border-gray-200 rounded-xl font-mono text-center focus:ring-2 focus:ring-nature-200 focus:border-nature-400 outline-none transition-all"
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-bold text-slate-500">Scale</label>
                                <span className="text-lg font-mono font-bold text-nature-600">{options.percentage}%</span>
                            </div>
                            <input 
                                type="range" min="1" max="100" value={options.percentage}
                                onChange={(e) => updatePercentage(parseInt(e.target.value))}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-nature-500"
                            />
                            <div className="flex justify-between gap-2">
                                {[25, 50, 75].map(p => (
                                    <button key={p} onClick={() => updatePercentage(p)} className="flex-1 py-1 text-xs bg-white border border-gray-200 rounded hover:border-nature-300 hover:text-nature-600">
                                        {p}%
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="space-y-4">
                        <label className="text-xs uppercase font-bold text-slate-400 tracking-wider">Output Format</label>
                        <div className="flex gap-2">
                            {['image/jpeg', 'image/png', 'image/webp'].map(fmt => (
                                <button
                                    key={fmt}
                                    onClick={() => setOptions(o => ({...o, format: fmt as any}))}
                                    className={`flex-1 py-3 rounded-xl text-xs font-bold border transition-all ${options.format === fmt ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-gray-200 hover:border-gray-300'}`}
                                >
                                    {fmt.split('/')[1].toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>

                    {options.format !== 'image/png' && (
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <label className="text-xs uppercase font-bold text-slate-400 tracking-wider">Quality</label>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded ${options.quality > 0.8 ? 'bg-green-100 text-green-700' : options.quality > 0.5 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                    {Math.round(options.quality * 100)}%
                                </span>
                            </div>
                            <input 
                                type="range" min="0.1" max="1" step="0.05" value={options.quality}
                                onChange={(e) => setOptions(o => ({...o, quality: parseFloat(e.target.value)}))}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-nature-500"
                            />
                        </div>
                    )}
                </div>
                ) : (
                <div className="space-y-6 animate-fade-in">
                    <div className="bg-gradient-to-br from-nature-500 to-nature-700 p-6 rounded-2xl text-white shadow-lg shadow-nature-500/30">
                        <Icons.Sparkles className="w-8 h-8 mb-3 opacity-80" />
                        <h3 className="text-lg font-bold mb-1">Gemini Eco-Scanner</h3>
                        <p className="text-nature-100 text-sm mb-4">Analyze your image for accessibility tags and receive personalized sustainability tips.</p>
                        <button 
                            onClick={handleEcoScan}
                            disabled={isAnalyzing}
                            className="w-full py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2 border border-white/30"
                        >
                            {isAnalyzing ? <><Icons.Refresh className="animate-spin w-4 h-4"/> Analyzing...</> : 'Start Scan'}
                        </button>
                    </div>

                    {analysis && (
                        <div className="space-y-4">
                            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                                <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Smart Description</h4>
                                <p className="text-sm text-slate-700">{analysis.description}</p>
                            </div>
                            <div className="bg-lime-50 p-4 rounded-xl border border-lime-100">
                                <div className="flex gap-2 items-center mb-2 text-lime-700">
                                    <Icons.Leaf className="w-4 h-4" />
                                    <h4 className="text-xs font-bold uppercase">Eco Tip</h4>
                                </div>
                                <p className="text-sm text-slate-700 italic">"{analysis.ecoTip}"</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {analysis.keywords.map(k => (
                                    <span key={k} className="px-2 py-1 bg-gray-100 text-xs rounded text-gray-500 border border-gray-200">#{k}</span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                )}
            </div>

            {/* Action Area */}
            <div className="p-6 bg-white border-t border-gray-200 z-20">
                <button 
                    onClick={() => navigateTo('results')}
                    className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-lg shadow-xl shadow-slate-900/20 flex items-center justify-center gap-3 transition-all transform active:scale-[0.98]"
                >
                    See Result & Download <Icons.ArrowRight className="w-5 h-5 text-nature-400" />
                </button>
            </div>
        </div>
    </div>
  );

  const ResultsView = () => (
    <main className="flex-1 pt-24 px-6 bg-slate-50 min-h-screen flex flex-col items-center pb-12">
        <div className="max-w-5xl w-full space-y-8 animate-fade-in">
            
            {/* Header */}
            <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-green-100 text-green-700 text-sm font-bold mb-4">
                    <Icons.Check className="w-4 h-4" /> Optimization Complete
                </div>
                <h2 className="text-4xl font-extrabold text-slate-900">Your Image is Ready!</h2>
                <p className="text-slate-500">You've successfully reduced your digital footprint.</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
                    <span className="text-sm text-gray-400 font-bold uppercase tracking-wider mb-1">New Size</span>
                    <span className="text-3xl font-mono font-bold text-slate-800">{formatBytes(newSizeEstimate)}</span>
                    <span className="text-xs text-green-600 font-bold mt-2 bg-green-50 px-2 py-1 rounded-full">-{100 - sizePercent}% Reduction</span>
                </div>
                <div className="bg-gradient-to-br from-nature-500 to-nature-600 p-6 rounded-2xl shadow-lg shadow-nature-500/30 flex flex-col items-center text-center text-white transform scale-105">
                    <span className="text-sm text-nature-100 font-bold uppercase tracking-wider mb-1 flex items-center gap-2"><Icons.Leaf className="w-4 h-4"/> Carbon Saved</span>
                    <span className="text-4xl font-bold">{savedCO2.toFixed(2)}g</span>
                    <span className="text-xs text-nature-100 mt-2 opacity-80">That's like charging a smartphone {Math.ceil(savedCO2 / 0.01)} times!</span>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
                    <span className="text-sm text-gray-400 font-bold uppercase tracking-wider mb-1">Dimensions</span>
                    <span className="text-3xl font-mono font-bold text-slate-800">{options.width} x {options.height}</span>
                    <span className="text-xs text-gray-400 mt-2 font-medium">{options.format.split('/')[1].toUpperCase()}</span>
                </div>
            </div>

            {/* Visual Comparison */}
            <div className="bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2"><Icons.Image className="w-5 h-5"/> Visual Comparison</h3>
                    <button 
                        onClick={() => setCompareMode(!compareMode)}
                        className="text-xs font-bold px-3 py-1.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors flex gap-2"
                    >
                        <Icons.Grid className="w-4 h-4" /> {compareMode ? 'Show Processed' : 'Show Original'}
                    </button>
                </div>
                <div className="h-[400px] w-full bg-checker relative flex items-center justify-center p-4">
                   <img 
                      src={compareMode ? previewSrc! : resizedSrc!} 
                      className="max-h-full max-w-full object-contain shadow-2xl rounded-lg"
                      alt="Result"
                   />
                   <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-black/75 backdrop-blur-md text-white px-4 py-2 rounded-full text-sm font-bold">
                      {compareMode ? 'Original Image' : 'Optimized Image'}
                   </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col md:flex-row gap-4 justify-center pt-4">
                <button 
                    onClick={downloadImage}
                    className="px-8 py-4 bg-nature-600 hover:bg-nature-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-nature-600/30 flex items-center justify-center gap-2 transition-all hover:-translate-y-1"
                >
                    <Icons.Download className="w-6 h-6" /> Download Image
                </button>
                <div className="flex gap-4">
                    <button 
                        onClick={() => navigateTo('editor')}
                        className="px-6 py-4 bg-white border-2 border-gray-200 hover:border-nature-400 text-slate-700 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
                    >
                        <Icons.Settings className="w-5 h-5" /> Adjust Settings
                    </button>
                    <button 
                        onClick={() => { setFile(null); navigateTo('home'); }}
                        className="px-6 py-4 bg-white border-2 border-gray-200 hover:border-nature-400 text-slate-700 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
                    >
                        <Icons.Upload className="w-5 h-5" /> New Image
                    </button>
                </div>
            </div>
        </div>
    </main>
  );

  return (
    <div className="flex flex-col min-h-screen bg-white text-slate-800 font-sans">
      <Navbar />
      {currentPage === 'home' && <LandingView />}
      {currentPage === 'mission' && <MissionView />}
      {currentPage === 'editor' && <EditorView />}
      {currentPage === 'results' && <ResultsView />}
    </div>
  );
}

export default App;