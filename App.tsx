
import React, { useState, useCallback, useRef, useEffect } from 'react';
import * as LucideIcons from 'lucide-react';
import { 
  Sparkles, Download, RotateCcw, ChevronLeft, ChevronRight, 
  AlertCircle, FileText, Upload, Image as ImageIcon,
  CheckCircle2, ArrowRight, Layers, Loader2
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

  // Rasmlar hali yuklanayotganini tekshirish
  const isAnyImageGenerating = Object.values(imageGenerating).some(v => v) || (state === AppState.PREVIEW && !coverImageUrl);

  const processContent = async (text: string) => {
    setState(AppState.GENERATING);
    setError(null);
    try {
      const result = await generatePresentationContent(text);
      setPresentation(result);
      setState(AppState.PREVIEW);
      setCurrentSlideIndex(0);

      // 1. Muqova rasmini yaratish
      generateImage(result.coverImagePrompt).then(img => {
        setCoverImageUrl(img);
      });

      // 2. Har bir slayd uchun rasmlarni fon rejimida yaratish
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
      setError('Taqdimot tayyorlashda xatolik yuz berdi. Iltimos, qaytadan urinib ko\'ring.');
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
      setError('Faylni o\'qishda xatolik. Faqat .docx yoki .txt fayllarni qo\'llab-quvvatlaymiz.');
      setState(AppState.ERROR);
    }
  };

  const downloadPPTX = useCallback(() => {
    if (!presentation || isAnyImageGenerating) return;
    
    const pres = new pptxgen();
    pres.layout = 'LAYOUT_16x9';
    const themeColor = presentation.themeColor.replace('#', '');

    // Muqova
    const titleSlide = pres.addSlide();
    if (coverImageUrl) titleSlide.addImage({ data: coverImageUrl, x: 0, y: 0, w: '100%', h: '100%' });
    titleSlide.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: '100%', h: '100%', fill: { color: '000000', transparency: 60 } });
    titleSlide.addText(presentation.mainTitle, { x: 1, y: 2.5, w: '80%', fontSize: 50, bold: true, color: 'FFFFFF', align: 'center', fontFace: 'Arial' });
    titleSlide.addText(presentation.subtitle, { x: 1, y: 4, w: '80%', fontSize: 24, color: 'CBD5E1', align: 'center' });

    // Slaydlar
    presentation.slides.forEach((slide) => {
      const s = pres.addSlide();
      
      if (slide.imageUrl) {
        s.addImage({ data: slide.imageUrl, x: 5.5, y: 1.2, w: 4, h: 4 });
      }

      s.addText(slide.title, { x: 0.5, y: 0.4, w: '90%', fontSize: 30, bold: true, color: themeColor });
      s.addShape(pres.ShapeType.line, { x: 0.5, y: 1, w: 9, h: 0, line: { color: themeColor, width: 2 } });

      const bullets = slide.content.map(p => ({ text: p.text, options: { bullet: true, fontSize: 18, color: '334155' } }));
      s.addText(bullets, { x: 0.5, y: 1.5, w: 4.5, h: 4, valign: 'top' });
    });

    pres.writeFile({ fileName: `${presentation.mainTitle.replace(/\s+/g, '_')}.pptx` });
  }, [presentation, coverImageUrl, isAnyImageGenerating]);

  const reset = () => {
    setState(AppState.IDLE);
    setPresentation(null);
    setCoverImageUrl(null);
    setError(null);
    setImageGenerating({});
  };

  return (
    <div className="min-h-screen bg-[#F8FAFF] text-slate-900 flex flex-col font-['Plus_Jakarta_Sans']">
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-indigo-100/30 blur-[120px] rounded-full translate-x-1/4 -translate-y-1/4" />
        <div className="absolute bottom-0 left-0 w-1/3 h-1/3 bg-blue-100/20 blur-[100px] rounded-full -translate-x-1/4 translate-y-1/4" />
      </div>

      <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-slate-200/50 px-6 h-20 flex items-center">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={reset}>
            <div className="w-11 h-11 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
              <Sparkles className="text-white w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Presen<span className="text-indigo-600">AI</span></h1>
          </div>
          {state === AppState.PREVIEW && (
            <div className="flex items-center gap-4">
              <button onClick={reset} className="p-2.5 text-slate-500 hover:bg-slate-100 rounded-xl transition-all"><RotateCcw className="w-5 h-5" /></button>
              <button 
                onClick={downloadPPTX} 
                disabled={isAnyImageGenerating}
                className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-xl active:scale-95 ${isAnyImageGenerating ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-indigo-600 shadow-indigo-100'}`}
              >
                {isAnyImageGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {isAnyImageGenerating ? "Tayyorlanmoqda..." : "PPTX Yuklash"}
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6 flex flex-col items-center justify-center">
        {state === AppState.IDLE && (
          <div className="max-w-4xl text-center space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold uppercase tracking-widest">
                <Layers className="w-4 h-4" /> Professional AI Designer
              </div>
              <h2 className="text-6xl md:text-8xl font-black text-slate-900 leading-[0.9] tracking-tighter">
                Matnni <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">Vizual San'atga</span> aylantiring.
              </h2>
              <p className="text-xl text-slate-500 max-w-2xl mx-auto font-medium">
                Word hujjatini yuklang yoki mavzu bering. AI har bir slayd uchun maxsus diagrammalar, ikonalar va <span className="text-indigo-600 font-bold">realistik rasmlar</span> yaratadi.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              <div onClick={() => fileInputRef.current?.click()} className="group bg-white border-2 border-dashed border-slate-200 rounded-[32px] p-12 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/20 transition-all">
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".docx,.txt" className="hidden" />
                <div className="space-y-4">
                  <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto group-hover:scale-110 transition-transform"><Upload className="w-8 h-8 text-indigo-600" /></div>
                  <h3 className="text-xl font-bold text-slate-800">Word yuklash</h3>
                  <p className="text-sm text-slate-400">.docx yoki .txt fayllar</p>
                </div>
              </div>
              <div onClick={() => { const t = prompt("Mavzu:"); if(t) processContent(t); }} className="bg-white border-2 border-slate-100 rounded-[32px] p-12 flex flex-col justify-center items-center text-center space-y-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer group">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform"><FileText className="w-8 h-8 text-slate-400" /></div>
                <h3 className="text-xl font-bold text-slate-800">Mavzu bilan boshlash</h3>
                <p className="text-sm text-slate-400">G'oyani matnga aylantiring</p>
              </div>
            </div>
          </div>
        )}

        {(state === AppState.GENERATING || state === AppState.READING_FILE) && (
          <div className="text-center space-y-8 animate-in zoom-in-95 duration-500">
             <div className="relative w-32 h-32 mx-auto">
                <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center"><ImageIcon className="w-10 h-10 text-indigo-500 animate-pulse" /></div>
             </div>
             <div className="space-y-2">
                <h3 className="text-3xl font-black text-slate-800">{state === AppState.READING_FILE ? "Fayl o'qilmoqda..." : "Slaydlar chizilmoqda..."}</h3>
                <p className="text-slate-400 font-medium">AI har bir slayd uchun original tasvirlar yaratmoqda</p>
             </div>
          </div>
        )}

        {state === AppState.PREVIEW && presentation && (
          <div className="w-full flex flex-col lg:flex-row gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="lg:w-1/4 space-y-4 max-h-[75vh] overflow-y-auto pr-2 custom-scrollbar no-scrollbar lg:block hidden">
              <div onClick={() => setCurrentSlideIndex(0)} className={`relative aspect-video rounded-2xl cursor-pointer overflow-hidden border-4 transition-all ${currentSlideIndex === 0 ? 'border-indigo-600 shadow-2xl scale-[1.02]' : 'border-white'}`}>
                {coverImageUrl ? <img src={coverImageUrl} className="w-full h-full object-cover" /> : <div className="bg-slate-900 w-full h-full" />}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center p-4"><p className="text-white text-[10px] font-bold uppercase text-center">{presentation.mainTitle}</p></div>
              </div>
              {presentation.slides.map((slide, idx) => (
                <div key={idx} onClick={() => setCurrentSlideIndex(idx + 1)} className={`relative aspect-video bg-white rounded-2xl cursor-pointer overflow-hidden border-4 transition-all ${currentSlideIndex === idx + 1 ? 'border-indigo-600 shadow-2xl scale-[1.02]' : 'border-white hover:border-slate-200'}`}>
                   {slide.imageUrl ? <img src={slide.imageUrl} className="w-full h-full object-cover" /> : <div className="bg-slate-100 w-full h-full flex items-center justify-center">{imageGenerating[idx] ? <Loader2 className="animate-spin text-indigo-400" /> : <ImageIcon className="text-slate-300" />}</div>}
                   <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 p-2"><p className="text-white text-[10px] font-bold truncate">{slide.title}</p></div>
                </div>
              ))}
            </div>

            <div className="lg:w-3/4 space-y-6">
              <div className="relative aspect-video bg-white shadow-[0_40px_80px_-15px_rgba(0,0,0,0.1)] rounded-[48px] overflow-hidden border border-slate-100 group">
                {currentSlideIndex === 0 ? (
                  <div className="relative w-full h-full flex flex-col justify-center items-center text-center p-12 md:p-24 overflow-hidden">
                    {coverImageUrl && <img src={coverImageUrl} className="absolute inset-0 w-full h-full object-cover brightness-50 animate-in fade-in duration-1000" />}
                    <div className="relative z-10 space-y-8">
                       <h1 className="text-4xl md:text-7xl font-black text-white leading-tight tracking-tighter drop-shadow-2xl">{presentation.mainTitle}</h1>
                       <div className="h-1.5 w-24 bg-indigo-500 mx-auto rounded-full" />
                       <p className="text-xl md:text-3xl text-indigo-100 font-medium italic drop-shadow-lg">{presentation.subtitle}</p>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col lg:flex-row">
                    <div className="lg:w-3/5 p-12 md:p-16 flex flex-col justify-center space-y-8">
                       <div className="space-y-3">
                          <p className="text-indigo-600 font-black text-sm uppercase tracking-[0.2em]">SLAYD {currentSlideIndex}</p>
                          <h2 className="text-4xl font-black text-slate-900 tracking-tight">{presentation.slides[currentSlideIndex - 1].title}</h2>
                       </div>
                       <ul className="space-y-5">
                          {presentation.slides[currentSlideIndex - 1].content.map((item, i) => (
                            <li key={i} className="flex items-start gap-4 animate-in slide-in-from-left duration-500" style={{ transitionDelay: `${i * 100}ms` }}>
                               <div className="mt-1.5 w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0 shadow-sm"><IconRenderer name={item.icon} className="w-5 h-5" /></div>
                               <p className="text-lg md:text-xl font-semibold text-slate-700 leading-relaxed">{item.text}</p>
                            </li>
                          ))}
                       </ul>
                    </div>
                    <div className="lg:w-2/5 relative h-full bg-slate-50 border-l border-slate-100">
                       {presentation.slides[currentSlideIndex - 1].imageUrl ? (
                         <img src={presentation.slides[currentSlideIndex - 1].imageUrl} className="w-full h-full object-cover animate-in fade-in zoom-in-95 duration-1000" alt="slide visual" />
                       ) : (
                         <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 gap-4">
                            {imageGenerating[currentSlideIndex - 1] ? (
                              <>
                                <Loader2 className="w-12 h-12 animate-spin text-indigo-400" />
                                <p className="text-sm font-bold animate-pulse text-indigo-400">Rasm yaratilmoqda...</p>
                              </>
                            ) : (
                              <ImageIcon className="w-16 h-16 opacity-20" />
                            )}
                         </div>
                       )}
                    </div>
                  </div>
                )}

                <div className="absolute inset-x-0 bottom-10 flex items-center justify-between px-10">
                   <button onClick={() => setCurrentSlideIndex(p => Math.max(0, p - 1))} disabled={currentSlideIndex === 0} className="p-4 bg-white/90 backdrop-blur shadow-2xl rounded-2xl hover:bg-white disabled:opacity-0 transition-all active:scale-90 border border-slate-200">
                    <ChevronLeft className="w-6 h-6 text-slate-800" />
                   </button>
                   <div className="px-8 py-3 bg-slate-900/90 backdrop-blur shadow-2xl text-white rounded-full font-black text-sm tracking-widest">
                    {currentSlideIndex + 1} / {presentation.slides.length + 1}
                   </div>
                   <button onClick={() => setCurrentSlideIndex(p => Math.min(presentation.slides.length, p + 1))} disabled={currentSlideIndex === presentation.slides.length} className="p-4 bg-white/90 backdrop-blur shadow-2xl rounded-2xl hover:bg-white disabled:opacity-0 transition-all active:scale-90 border border-slate-200">
                    <ChevronRight className="w-6 h-6 text-slate-800" />
                   </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between p-8 bg-white border border-slate-200 rounded-[40px] shadow-sm gap-6">
                 <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center"><CheckCircle2 className="w-8 h-8" /></div>
                    <div>
                      <h4 className="font-black text-slate-900 text-lg">Taqdimot tayyor!</h4>
                      <p className="text-sm text-slate-400 font-medium">Barcha slaydlar optimallashtirildi.</p>
                    </div>
                 </div>
                 <div className="flex gap-4 w-full sm:w-auto">
                    <button onClick={reset} className="flex-1 sm:flex-none px-8 py-4 bg-slate-50 text-slate-600 rounded-2xl font-bold hover:bg-slate-100 transition-all">Yangi g'oya</button>
                    <button 
                      onClick={downloadPPTX} 
                      disabled={isAnyImageGenerating}
                      className={`flex-1 sm:flex-none px-10 py-4 rounded-2xl font-black text-lg transition-all active:scale-95 flex items-center justify-center gap-3 ${isAnyImageGenerating ? 'bg-slate-100 text-slate-400' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-2xl shadow-indigo-100'}`}
                    >
                      {isAnyImageGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                      {isAnyImageGenerating ? "Kutilmoqda..." : "PPTX Yuklash"}
                    </button>
                 </div>
              </div>
            </div>
          </div>
        )}

        {state === AppState.ERROR && (
          <div className="text-center space-y-8">
            <div className="w-24 h-24 bg-red-50 text-red-500 rounded-[32px] flex items-center justify-center mx-auto shadow-inner"><AlertCircle className="w-12 h-12" /></div>
            <div className="space-y-3">
              <h3 className="text-3xl font-black text-slate-800">Xatolik yuz berdi</h3>
              <p className="text-lg text-slate-400 font-medium max-w-md mx-auto">{error}</p>
            </div>
            <button onClick={reset} className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all">Qayta urinish</button>
          </div>
        )}
      </main>

      <footer className="py-12 border-t border-slate-100 bg-white">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
           <div className="flex items-center gap-2">
              <Sparkles className="text-indigo-600 w-5 h-5" />
              <span className="font-bold text-slate-800">PresenAI Platform &bull; {new Date().getFullYear()}</span>
           </div>
           <div className="flex gap-8 text-sm font-bold text-slate-400">
              <a href="#" className="hover:text-indigo-600 transition-colors">Telegram</a>
              <a href="#" className="hover:text-indigo-600 transition-colors">Dizayn qoidalari</a>
              <a href="#" className="hover:text-indigo-600 transition-colors">Yordam</a>
           </div>
        </div>
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
};

export default App;
