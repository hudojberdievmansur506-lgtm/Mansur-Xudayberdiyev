import React, { useState, useCallback, useRef } from 'react';
import * as LucideIcons from 'lucide-react';
import { 
  Sparkles, Download, RotateCcw, ChevronLeft, ChevronRight, 
  AlertCircle, FileText, Upload, Image as ImageIcon,
  CheckCircle2, Layers, Loader2, Info
} from 'lucide-react';
import pptxgen from 'pptxgenjs';
import mammoth from 'mammoth';
import { AppState, Presentation, Slide } from './types';
import { generatePresentationContent, generateImage } from './services/geminiService';

const IconRenderer = ({ name, className }: { name: string, className?: string }) => {
  const IconComponent = (LucideIcons as any)[name] || LucideIcons.HelpCircle;
  return <IconComponent className={className} />;
};

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(AppState.IDLE);
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [imageGenerating, setImageGenerating] = useState<Record<number, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAnyImageGenerating = Object.values(imageGenerating).some(v => v) || (state === AppState.PREVIEW && !coverImageUrl);

  const processContent = async (text: string) => {
    if (!text.trim()) return;
    setState(AppState.GENERATING);
    setError(null);
    try {
      const result = await generatePresentationContent(text);
      setPresentation(result);
      setState(AppState.PREVIEW);
      setCurrentSlideIndex(0);

      generateImage(result.coverImagePrompt).then(img => {
        setCoverImageUrl(img);
      }).catch(() => setCoverImageUrl(null));

      result.slides.forEach(async (slide, index) => {
        setImageGenerating(prev => ({ ...prev, [index]: true }));
        try {
          const slideImg = await generateImage(slide.description || slide.title);
          if (slideImg) {
            setPresentation(prev => {
              if (!prev) return null;
              const updatedSlides = [...prev.slides];
              updatedSlides[index] = { ...updatedSlides[index], imageUrl: slideImg };
              return { ...prev, slides: updatedSlides };
            });
          }
        } finally {
          setImageGenerating(prev => ({ ...prev, [index]: false }));
        }
      });

    } catch (err) {
      console.error(err);
      setError('Taqdimot tayyorlashda kutilmagan xatolik. API Key o\'rnatilganligini tekshiring.');
      setState(AppState.ERROR);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setState(AppState.READING_FILE);
    try {
      if (file.name.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        await processContent(result.value);
      } else {
        const text = await file.text();
        await processContent(text);
      }
    } catch (err) {
      setError('Faylni o\'qishda xatolik yuz berdi.');
      setState(AppState.ERROR);
    }
  };

  const downloadPPTX = useCallback(() => {
    if (!presentation || isAnyImageGenerating) return;
    
    const pres = new pptxgen();
    pres.layout = 'LAYOUT_16x9';
    const themeColor = presentation.themeColor.replace('#', '');

    const titleSlide = pres.addSlide();
    if (coverImageUrl) titleSlide.addImage({ data: coverImageUrl, x: 0, y: 0, w: '100%', h: '100%' });
    titleSlide.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: '100%', h: '100%', fill: { color: '000000', transparency: 60 } });
    titleSlide.addText(presentation.mainTitle, { x: 0.5, y: 2.2, w: 9, fontSize: 44, bold: true, color: 'FFFFFF', align: 'center', fontFace: 'Arial' });
    titleSlide.addText(presentation.subtitle, { x: 0.5, y: 3.8, w: 9, fontSize: 20, color: 'CBD5E1', align: 'center' });

    presentation.slides.forEach((slide) => {
      const s = pres.addSlide();
      const hasImage = !!slide.imageUrl;

      s.addText(slide.title, { x: 0.5, y: 0.4, w: '90%', fontSize: 28, bold: true, color: themeColor });
      s.addShape(pres.ShapeType.line, { x: 0.5, y: 0.9, w: 9, h: 0, line: { color: themeColor, width: 2 } });

      if (hasImage) {
        s.addImage({ data: slide.imageUrl!, x: 5.5, y: 1.2, w: 4, h: 4 });
        const bullets = slide.content.map(p => ({ text: p.text, options: { bullet: true, fontSize: 16, color: '334155' } }));
        s.addText(bullets, { x: 0.5, y: 1.2, w: 4.8, h: 4, valign: 'top' });
      } else {
        const bullets = slide.content.map(p => ({ text: p.text, options: { bullet: true, fontSize: 18, color: '334155' } }));
        s.addText(bullets, { x: 0.5, y: 1.2, w: 9, h: 4, valign: 'top' });
      }
    });

    pres.writeFile({ fileName: `${presentation.mainTitle.substring(0, 30).replace(/\s+/g, '_')}.pptx` });
  }, [presentation, coverImageUrl, isAnyImageGenerating]);

  const reset = () => {
    setState(AppState.IDLE);
    setPresentation(null);
    setCoverImageUrl(null);
    setError(null);
    setImageGenerating({});
    setCurrentSlideIndex(0);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFF] text-slate-900 flex flex-col font-['Plus_Jakarta_Sans'] antialiased">
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-200/20 blur-[100px] rounded-full translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-200/20 blur-[100px] rounded-full -translate-x-1/2 translate-y-1/2" />
      </div>

      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/50 px-6 h-20 flex items-center">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={reset}>
            <div className="w-10 h-10 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-300">
              <Sparkles className="text-white w-5 h-5" />
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Presen<span className="text-indigo-600">AI</span></h1>
          </div>
          {state === AppState.PREVIEW && (
            <div className="flex items-center gap-4">
              <button onClick={reset} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors" title="Qayta boshlash">
                <RotateCcw className="w-5 h-5" />
              </button>
              <button 
                onClick={downloadPPTX} 
                disabled={isAnyImageGenerating}
                className={`px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all active:scale-95 shadow-lg ${isAnyImageGenerating ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-indigo-600 shadow-indigo-100'}`}
              >
                {isAnyImageGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {isAnyImageGenerating ? "Rasmlar yuklanmoqda..." : "PPTX Yuklash"}
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6 flex flex-col items-center justify-center">
        {state === AppState.IDLE && (
          <div className="max-w-4xl text-center space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-100">
                <Layers className="w-3.5 h-3.5" /> Professional AI Studio
              </div>
              <h2 className="text-5xl md:text-7xl font-black text-slate-900 leading-[1.1] tracking-tighter">
                Matnni <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">Slaydlarga</span> aylantiring.
              </h2>
              <p className="text-lg text-slate-500 max-w-2xl mx-auto font-medium">
                Word hujjatini yuklang yoki mavzu bering. AI professional dizayn va <span className="text-indigo-600 font-bold">realistik tasvirlar</span> bilan taqdimot tayyorlab beradi.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
              <div onClick={() => fileInputRef.current?.click()} className="group bg-white border border-slate-200 rounded-3xl p-10 cursor-pointer hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-50 transition-all duration-300">
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".docx,.txt" className="hidden" />
                <div className="space-y-4">
                  <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-300"><Upload className="w-7 h-7 text-indigo-600" /></div>
                  <h3 className="text-lg font-bold text-slate-800">Word/Text Yuklash</h3>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Hujjat asosida slaydlar</p>
                </div>
              </div>
              <div onClick={() => { const t = prompt("Taqdimot mavzusini kiriting:"); if(t) processContent(t); }} className="bg-white border border-slate-200 rounded-3xl p-10 flex flex-col justify-center items-center text-center space-y-4 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-50 transition-all duration-300 cursor-pointer group">
                <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300"><FileText className="w-7 h-7 text-slate-400" /></div>
                <h3 className="text-lg font-bold text-slate-800">Mavzu bilan boshlash</h3>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Tezkor generatsiya</p>
              </div>
            </div>
          </div>
        )}

        {(state === AppState.GENERATING || state === AppState.READING_FILE) && (
          <div className="text-center space-y-8 animate-in zoom-in-95 duration-500">
             <div className="relative w-28 h-28 mx-auto">
                <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center"><Sparkles className="w-8 h-8 text-indigo-500 animate-pulse" /></div>
             </div>
             <div className="space-y-2">
                <h3 className="text-2xl font-black text-slate-800">{state === AppState.READING_FILE ? "Fayl tahlil qilinmoqda..." : "AI Dizayn ishlamoqda..."}</h3>
                <p className="text-sm text-slate-400 font-medium">Bu bir necha soniya vaqt olishi mumkin.</p>
             </div>
          </div>
        )}

        {state === AppState.PREVIEW && presentation && (
          <div className="w-full flex flex-col lg:flex-row gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="lg:w-1/5 space-y-3 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar lg:block hidden">
              <div 
                onClick={() => setCurrentSlideIndex(0)} 
                className={`relative aspect-video rounded-xl cursor-pointer overflow-hidden border-2 transition-all ${currentSlideIndex === 0 ? 'border-indigo-600 shadow-lg' : 'border-white hover:border-slate-200'}`}
              >
                {coverImageUrl ? <img src={coverImageUrl} className="w-full h-full object-cover" alt="cover" /> : <div className="bg-slate-900 w-full h-full" />}
                <div className="absolute inset-0 bg-black/40 flex flex-col justify-end p-2">
                  <p className="text-white text-[8px] font-black uppercase tracking-tighter opacity-70">Muqova</p>
                  <p className="text-white text-[10px] font-bold truncate">{presentation.mainTitle}</p>
                </div>
              </div>
              {presentation.slides.map((slide, idx) => (
                <div 
                  key={idx} 
                  onClick={() => setCurrentSlideIndex(idx + 1)} 
                  className={`relative aspect-video bg-white rounded-xl cursor-pointer overflow-hidden border-2 transition-all ${currentSlideIndex === idx + 1 ? 'border-indigo-600 shadow-lg' : 'border-white hover:border-slate-200'}`}
                >
                   {slide.imageUrl ? (
                     <img src={slide.imageUrl} className="w-full h-full object-cover" alt={`slide ${idx + 1}`} />
                   ) : (
                     <div className="w-full h-full flex items-center justify-center bg-slate-50">
                        {imageGenerating[idx] ? <Loader2 className="animate-spin text-indigo-400 w-4 h-4" /> : <ImageIcon className="text-slate-200 w-5 h-5" />}
                     </div>
                   )}
                   <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 p-2">
                     <p className="text-white text-[9px] font-bold truncate">{idx + 1}. {slide.title}</p>
                   </div>
                </div>
              ))}
            </div>

            <div className="lg:w-4/5 space-y-6">
              <div className="relative aspect-video bg-white shadow-2xl rounded-[32px] overflow-hidden border border-slate-100">
                {currentSlideIndex === 0 ? (
                  <div className="relative w-full h-full flex flex-col justify-center items-center text-center p-12 md:p-20 overflow-hidden">
                    {coverImageUrl && <img src={coverImageUrl} className="absolute inset-0 w-full h-full object-cover brightness-[0.4] animate-in fade-in duration-1000 scale-105" alt="cover bg" />}
                    <div className="relative z-10 space-y-6">
                       <h1 className="text-4xl md:text-6xl font-black text-white leading-tight tracking-tighter drop-shadow-2xl max-w-4xl">{presentation.mainTitle}</h1>
                       <div className="h-1 w-20 bg-indigo-500 mx-auto rounded-full" />
                       <p className="text-lg md:text-2xl text-indigo-100 font-medium italic drop-shadow-lg">{presentation.subtitle}</p>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col lg:flex-row">
                    <div className="lg:w-3/5 p-10 md:p-14 flex flex-col justify-center space-y-6">
                       <div className="space-y-2">
                          <p className="text-indigo-600 font-black text-[10px] uppercase tracking-[0.3em]">Slayd {currentSlideIndex}</p>
                          <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">
                            {presentation.slides[currentSlideIndex - 1].title}
                          </h2>
                       </div>
                       <ul className="space-y-4">
                          {presentation.slides[currentSlideIndex - 1].content.map((item, i) => (
                            <li key={i} className="flex items-start gap-4 animate-in slide-in-from-left duration-500" style={{ transitionDelay: `${i * 100}ms` }}>
                               <div className="mt-1 w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center shrink-0 shadow-sm border border-indigo-100/50">
                                 <IconRenderer name={item.icon} className="w-4 h-4" />
                               </div>
                               <p className="text-base md:text-lg font-semibold text-slate-700 leading-relaxed">{item.text}</p>
                            </li>
                          ))}
                       </ul>
                    </div>
                    <div className="lg:w-2/5 relative h-full bg-slate-50 border-l border-slate-100 overflow-hidden">
                       {presentation.slides[currentSlideIndex - 1].imageUrl ? (
                         <img 
                           src={presentation.slides[currentSlideIndex - 1].imageUrl} 
                           className="w-full h-full object-cover animate-in fade-in zoom-in-95 duration-1000" 
                           alt="visual" 
                         />
                       ) : (
                         <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 gap-4 bg-slate-50">
                            {imageGenerating[currentSlideIndex - 1] ? (
                              <>
                                <Loader2 className="w-10 h-10 animate-spin text-indigo-400" />
                                <p className="text-xs font-black animate-pulse text-indigo-400 uppercase tracking-widest">Rasm yaratilmoqda...</p>
                              </>
                            ) : (
                              <ImageIcon className="w-12 h-12 opacity-10" />
                            )}
                         </div>
                       )}
                    </div>
                  </div>
                )}

                <div className="absolute inset-x-0 bottom-8 flex items-center justify-between px-8">
                   <button 
                    onClick={() => setCurrentSlideIndex(p => Math.max(0, p - 1))} 
                    disabled={currentSlideIndex === 0} 
                    className="p-3 bg-white/90 backdrop-blur shadow-xl rounded-xl hover:bg-white disabled:opacity-0 transition-all active:scale-90 border border-slate-200"
                   >
                    <ChevronLeft className="w-5 h-5 text-slate-800" />
                   </button>
                   <div className="px-5 py-2 bg-slate-900/90 backdrop-blur shadow-xl text-white rounded-full font-black text-[10px] tracking-[0.2em] flex items-center gap-2">
                    {currentSlideIndex + 1} / {presentation.slides.length + 1}
                   </div>
                   <button 
                    onClick={() => setCurrentSlideIndex(p => Math.min(presentation.slides.length, p + 1))} 
                    disabled={currentSlideIndex === presentation.slides.length} 
                    className="p-3 bg-white/90 backdrop-blur shadow-xl rounded-xl hover:bg-white disabled:opacity-0 transition-all active:scale-90 border border-slate-200"
                   >
                    <ChevronRight className="w-5 h-5 text-slate-800" />
                   </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between p-6 bg-white border border-slate-200 rounded-[24px] shadow-sm gap-4">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0 border border-emerald-100">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">Taqdimot tayyor</h4>
                      <p className="text-xs text-slate-400 font-medium">{presentation.slides.length} slayd muvaffaqiyatli generatsiya qilindi.</p>
                    </div>
                 </div>
                 {isAnyImageGenerating && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-lg text-[10px] font-bold border border-amber-100 animate-pulse">
                      <Info className="w-3 h-3" />
                      Ba'zi rasmlar yuklanmoqda...
                    </div>
                 )}
                 <div className="flex gap-3 w-full sm:w-auto">
                    <button onClick={reset} className="flex-1 sm:flex-none px-6 py-2.5 bg-slate-50 text-slate-600 rounded-xl font-bold hover:bg-slate-100 transition-colors text-sm">Reset</button>
                    <button 
                      onClick={downloadPPTX} 
                      disabled={isAnyImageGenerating}
                      className={`flex-1 sm:flex-none px-8 py-2.5 rounded-xl font-black text-sm transition-all active:scale-95 flex items-center justify-center gap-2 ${isAnyImageGenerating ? 'bg-slate-100 text-slate-300' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100'}`}
                    >
                      {isAnyImageGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      Eksport (.PPTX)
                    </button>
                 </div>
              </div>
            </div>
          </div>
        )}

        {state === AppState.ERROR && (
          <div className="text-center space-y-6 animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto shadow-inner border border-red-100"><AlertCircle className="w-10 h-10" /></div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-slate-800">Xatolik yuz berdi</h3>
              <p className="text-sm text-slate-400 font-medium max-w-sm mx-auto">{error}</p>
            </div>
            <button onClick={reset} className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-transform active:scale-95">Qayta urinib ko'rish</button>
          </div>
        )}
      </main>

      <footer className="py-8 border-t border-slate-100 bg-white">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
           <div className="flex items-center gap-2">
              <Sparkles className="text-indigo-600 w-4 h-4" />
              <span className="font-bold text-slate-800 text-xs uppercase tracking-widest">PresenAI Studio &bull; {new Date().getFullYear()}</span>
           </div>
           <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center">Netlify deploy uchun optimallashtirilgan</p>
        </div>
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
};

export default App;