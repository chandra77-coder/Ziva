import { useMemo, useRef, useState } from "react";
import { Camera, Combine, FileText, FolderOpen, Home, Image, Minimize2, RefreshCw, Settings, Share2, Shield, Star, Wrench } from "lucide-react";
import { jsPDF } from "jspdf";
import { PDFDocument } from "pdf-lib";
import imageCompression from "browser-image-compression";

type Tab = "home" | "tools" | "files" | "settings";
type SavedFile = { id: string; name: string; type: string; size: number; date: string; favourite: boolean };
type Tool = { id: string; title: string; subtitle: string; color: string; icon: typeof Image; accept: string; multi?: boolean };

const tools: Tool[] = [
  { id: "scan", title: "Smart Scan", subtitle: "Camera style document flow", color: "#3B82F6", icon: Camera, accept: "image/*", multi: true },
  { id: "id", title: "Scan ID Card", subtitle: "Front and back in one PDF", color: "#00C2D4", icon: Shield, accept: "image/*", multi: true },
  { id: "image-pdf", title: "Image → PDF", subtitle: "Convert photos to PDF", color: "#EF4444", icon: FileText, accept: "image/*", multi: true },
  { id: "merge-pdf", title: "Merge PDF", subtitle: "Combine PDF files", color: "#A855F7", icon: Combine, accept: "application/pdf", multi: true },
  { id: "compress-image", title: "Compress Image", subtitle: "Reduce image size", color: "#EC4899", icon: Minimize2, accept: "image/*" },
  { id: "import-pdf", title: "Import PDF", subtitle: "Save PDF into Ziva", color: "#F59E0B", icon: FileText, accept: "application/pdf" }
];

const storageKey = "ziva_files";

function loadFiles(): SavedFile[] {
  try { return JSON.parse(localStorage.getItem(storageKey) || "[]") as SavedFile[]; } catch { return []; }
}

function saveFiles(files: SavedFile[]) { localStorage.setItem(storageKey, JSON.stringify(files)); }
function size(bytes: number) { return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
function clean(name: string) { return name.replace(/[^a-zA-Z0-9._-]/g, "_"); }

async function imageToPdf(files: File[]) {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  for (let i = 0; i < files.length; i++) {
    if (i > 0) pdf.addPage();
    const data = await readAsDataUrl(files[i]);
    const img = await loadImage(data);
    const ratio = Math.min((pageW - 48) / img.width, (pageH - 48) / img.height);
    const w = img.width * ratio;
    const h = img.height * ratio;
    pdf.addImage(data, "JPEG", (pageW - w) / 2, (pageH - h) / 2, w, h);
  }
  return pdf.output("blob");
}

async function mergePdf(files: File[]) {
  const out = await PDFDocument.create();
  for (const file of files) {
    const doc = await PDFDocument.load(await file.arrayBuffer());
    const pages = await out.copyPages(doc, doc.getPageIndices());
    pages.forEach((page) => out.addPage(page));
  }
  const bytes = await out.save({ useObjectStreams: true });
  return new Blob([bytes], { type: "application/pdf" });
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = src;
  });
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = clean(name);
  a.click();
  URL.revokeObjectURL(url);
}

function Logo({ big = false }: { big?: boolean }) {
  return <div className={big ? "logo big" : "logo"}><svg viewBox="0 0 40 40"><defs><linearGradient id="z" x1="6" y1="8" x2="34" y2="32"><stop stopColor="#00E5FF"/><stop offset=".5" stopColor="#00B4D8"/><stop offset="1" stopColor="#0077B6"/></linearGradient></defs><rect width="40" height="40" rx="13" fill="#0D1B2A" stroke="#1E3A52"/><path d="M7 9H33M33 9L7 31M7 31H33" stroke="url(#z)" strokeWidth="3.5" strokeLinecap="round"/></svg></div>;
}

export default function App() {
  const [tab, setTab] = useState<Tab>("home");
  const [activeTool, setActiveTool] = useState<Tool | null>(null);
  const [files, setFiles] = useState<SavedFile[]>(loadFiles);
  const [toast, setToast] = useState("Ready");
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const recent = useMemo(() => files.slice(0, 3), [files]);

  function show(message: string) { setToast(message); window.setTimeout(() => setToast(""), 2400); }
  function addFile(name: string, type: string, bytes: number) {
    const next = [{ id: crypto.randomUUID(), name, type, size: bytes, date: new Date().toLocaleString(), favourite: false }, ...files];
    setFiles(next); saveFiles(next);
  }

  async function process(selected: File[]) {
    if (!activeTool || selected.length === 0) return;
    try {
      setBusy(true);
      let blob: Blob = selected[0];
      let name = selected[0].name;
      if (["scan", "id", "image-pdf"].includes(activeTool.id)) { blob = await imageToPdf(selected); name = `${activeTool.id}_${Date.now()}.pdf`; }
      if (activeTool.id === "merge-pdf") { if (selected.length < 2) throw new Error("Select at least two PDFs"); blob = await mergePdf(selected); name = `merged_${Date.now()}.pdf`; }
      if (activeTool.id === "compress-image") { blob = await imageCompression(selected[0], { initialQuality: .72, maxWidthOrHeight: 2200, useWebWorker: true }); name = `compressed_${selected[0].name}`; }
      downloadBlob(blob, name);
      addFile(name, blob.type || activeTool.title, blob.size);
      show("Saved successfully ✓");
      setActiveTool(null);
    } catch (error) {
      show(error instanceof Error ? error.message : "Something went wrong");
    } finally { setBusy(false); }
  }

  return <div className="app">
    <input ref={fileInput} type="file" hidden accept={activeTool?.accept || "*/*"} multiple={Boolean(activeTool?.multi)} onChange={(e) => void process(Array.from(e.target.files || []))} />
    <main className="content">
      {tab === "home" && <section className="page"><Header/><div className="hero"><div><span className="pill">100% offline</span><h2>Scan, edit and save offline.</h2><p>No ads. No login. Your files stay on your phone.</p></div><Logo big/></div><button className="primary" onClick={() => setActiveTool(tools[0])}>Start Smart Scan</button><Title text="Quick Tools" action={() => setTab("tools")}/><div className="grid">{tools.slice(0,6).map(t => <ToolCard key={t.id} tool={t} open={setActiveTool}/>)}</div><Title text="Recent Files" action={() => setTab("files")}/><FileList files={recent} update={setFiles}/></section>}
      {tab === "tools" && <section className="page"><h1>Tools</h1><p className="muted">Offline PDF and image tools.</p><div className="grid all">{tools.map(t => <ToolCard key={t.id} tool={t} open={setActiveTool}/>)}</div></section>}
      {tab === "files" && <section className="page"><h1>My Files</h1><p className="muted">{files.length} saved files</p><FileList files={files} update={(next) => { setFiles(next); saveFiles(next); }}/></section>}
      {tab === "settings" && <section className="page"><h1>Settings</h1><div className="card row"><RefreshCw/><div><b>Check for Updates</b><p>GitHub release check coming next build</p></div></div><div className="card row"><Share2/><div><b>Share Ziva</b><p>Free offline PDF and image toolkit</p></div></div><div className="card row"><Shield/><div><b>Privacy Policy</b><p>No login, no ads, no analytics, no cloud upload</p></div></div><div className="about"><Logo big/><h2><span>Z</span>iva</h2><p>Version 1.0.0 · chandra77-coder/Ziva</p></div></section>}
    </main>
    <nav>{nav("home", Home)}{nav("tools", Wrench)}{nav("files", FolderOpen)}{nav("settings", Settings)}</nav>
    {activeTool && <div className="sheetBg"><section className="sheet"><button className="close" onClick={() => setActiveTool(null)}>×</button><activeTool.icon style={{ color: activeTool.color }}/><h2>{activeTool.title}</h2><p>{activeTool.subtitle}</p><button className="primary" onClick={() => fileInput.current?.click()}>Select File</button></section></div>}
    {busy && <div className="busy"><div></div><b>Processing offline...</b></div>}
    {toast && <div className="toast">{toast}</div>}
  </div>;

  function nav(id: Tab, Icon: typeof Home) { return <button className={tab === id ? "active" : ""} onClick={() => setTab(id)}><Icon/><span>{id}</span></button>; }
}

function Header() { return <header><div className="brand"><Logo/><div><p>Good evening</p><h1><span>Z</span>iva</h1></div></div><button className="circle"><Shield/></button></header>; }
function Title({ text, action }: { text: string; action: () => void }) { return <div className="title"><h3>{text}</h3><button onClick={action}>See all</button></div>; }
function ToolCard({ tool, open }: { tool: Tool; open: (tool: Tool) => void }) { const Icon = tool.icon; return <button className="tool" onClick={() => open(tool)}><div style={{ background: `${tool.color}22`, color: tool.color }}><Icon/></div><b>{tool.title}</b><p>{tool.subtitle}</p></button>; }
function FileList({ files, update }: { files: SavedFile[]; update: (files: SavedFile[]) => void }) { if (!files.length) return <div className="empty"><FileText/><b>No files yet</b><p>Created files will appear here.</p></div>; return <div className="list">{files.map(f => <article className="file" key={f.id}><FileText/><div><b>{f.name}</b><p>{size(f.size)} · {f.date}</p></div><button onClick={() => update(files.map(x => x.id === f.id ? { ...x, favourite: !x.favourite } : x))}><Star fill={f.favourite ? "currentColor" : "none"}/></button></article>)}</div>; }
