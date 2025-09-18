import React, { useRef, useState } from 'react';
import { Button } from '../ui';
import { unzipSync } from 'fflate';

interface BatchPackageState {
  manifestNetwork?: string;
  selections: any[];
  files: Array<{ name: string; path?: string; file: File }>;
  manifest: any;
}

interface Props { onNext: () => void; onPackageLoaded: (pkg: BatchPackageState) => void }

const BatchUploadStep: React.FC<Props> = ({ onNext, onPackageLoaded }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string>('');
  const [showPicker, setShowPicker] = useState<boolean>(false);

  const handleFiles = async (files: FileList) => {
    try {
      const manifest = Array.from(files).find(f => f.name === 'upload-manifest.json');
      if (!manifest) { setMessage('upload-manifest.json not found'); return; }
      const manifestJson = JSON.parse(await manifest.text());
      const selections: any[] = []; // leave selection resolution to UTXO page if needed
      const fileArray = Array.from(files).map(f => ({ name: f.name, path: (f as any).webkitRelativePath || undefined, file: f }));
      onPackageLoaded({ manifestNetwork: manifestJson.network, selections, files: fileArray, manifest: manifestJson });
      onNext();
      setMessage(`Loaded package with ${fileArray.length} files`);
    } catch (e:any) {
      setMessage(e.message || 'Error reading files');
    }
  };

  const handleZip = async (file: File) => {
    try {
      if (!file.name.toLowerCase().endsWith('.zip')) {
        setMessage('Selected file is not a .zip');
        return;
      }
      const buf = new Uint8Array(await file.arrayBuffer());
      const entries = unzipSync(buf);
      const names = Object.keys(entries || {});
      if (!names.length) { setMessage('ZIP is empty'); return; }

      // Find manifest anywhere in the ZIP (prefer root)
      let manifestPath: string | undefined = names.find(n => n === 'upload-manifest.json');
      if (!manifestPath) manifestPath = names.find(n => n.endsWith('/upload-manifest.json'));
      if (!manifestPath) manifestPath = names.find(n => n.split('/').pop() === 'upload-manifest.json');
      if (!manifestPath) { setMessage('upload-manifest.json not found in ZIP'); return; }

      const manifestBytes = entries[manifestPath]!;
      const manifestText = new TextDecoder().decode(manifestBytes);
      const manifestJson = JSON.parse(manifestText);

      const selections: any[] = [];
      const fileArray = names
        .filter(n => !n.endsWith('/') && !n.startsWith('__MACOSX/'))
        .map(n => {
          const bytes = entries[n]!;
          const base = n.split('/').pop() || n;
          const f = new File([bytes], base);
          return { name: base, path: n, file: f } as { name: string; path?: string; file: File };
        });

      onPackageLoaded({ manifestNetwork: manifestJson.network, selections, files: fileArray, manifest: manifestJson });
      onNext();
      setMessage(`Loaded ZIP with ${fileArray.length} files`);
    } catch (e:any) {
      setMessage(e.message || 'Error reading ZIP');
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-4 border border-dashed rounded text-sm text-gray-600 dark:text-gray-300">
        <p className="mb-2">Upload your package folder (with <code>upload-manifest.json</code>) or a ZIP of it.</p>
        <input ref={inputRef} type="file" multiple className="hidden" onChange={(e)=> e.target.files && handleFiles(e.target.files)}
          // @ts-expect-error non-standard
          webkitdirectory="" directory="" />
        <input ref={zipRef} type="file" accept=".zip" className="hidden" onChange={(e)=> e.target.files && e.target.files[0] && handleZip(e.target.files[0])} />
        <div className="relative inline-block">
          <Button variant="outline" onClick={()=>setShowPicker(s=>!s)}>Upload Package</Button>
          {showPicker && (
            <div className="absolute z-10 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow text-sm">
              <button className="block px-3 py-2 w-full text-left hover:bg-gray-50 dark:hover:bg-gray-700" onClick={()=>{ setShowPicker(false); inputRef.current?.click(); }}>Select Folder</button>
              <button className="block px-3 py-2 w-full text-left hover:bg-gray-50 dark:hover:bg-gray-700" onClick={()=>{ setShowPicker(false); zipRef.current?.click(); }}>Select ZIP</button>
            </div>
          )}
        </div>
      </div>
      {message && <div className="text-xs text-gray-500 dark:text-gray-400">{message}</div>}
      <div className="flex justify-end">
        <Button onClick={onNext}>Next</Button>
      </div>
    </div>
  );
};

export default BatchUploadStep;


