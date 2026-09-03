'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function CreateCoursePage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('access_token');
      if (!token) throw new Error("Not authenticated");

      let coverImageUrl = '';
      if (coverImage) {
        const formData = new FormData();
        formData.append('file', coverImage);
        const uploadRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1'}/upload/image`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (!uploadRes.ok) throw new Error("Image upload failed");
        const uploadData = await uploadRes.json();
        coverImageUrl = uploadData.url;
      }
      
      let documentUrl = '';
      if (documentFile) {
        const docData = new FormData();
        docData.append('file', documentFile);
        const docUploadRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1'}/upload/document`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: docData,
        });
        if (!docUploadRes.ok) {
          const errData = await docUploadRes.json().catch(() => null);
          throw new Error(errData?.detail || "Document upload failed");
        }
        const docUploadData = await docUploadRes.json();
        documentUrl = docUploadData.url;
      }

      const courseRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1'}/courses/`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          title,
          description,
          cover_image_url: coverImageUrl,
          document_url: documentUrl || null
        }),
      });

      if (!courseRes.ok) throw new Error("Course creation failed");

      router.push('/courses');
      router.refresh();
    } catch (err) {
      const e = err as Error;
      setError(e.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-24 max-w-3xl mx-auto">
      <Link href="/courses" className="inline-flex items-center gap-2 text-text-secondary hover:text-text-primary mb-8 transition-colors">
        <ArrowLeft size={16} /> Back to Courses
      </Link>
      
      <div className="glass-card p-8">
        <h1 className="text-3xl font-bold mb-6 text-text-primary">Create a New Course</h1>
        
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2 text-text-secondary">Course Title</label>
            <input 
              type="text" 
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-surface/50 border border-border focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none transition-all text-text-primary"
              placeholder="e.g., Advanced React Patterns"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-text-secondary">Description</label>
            <textarea 
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-surface/50 border border-border focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none transition-all resize-y text-text-primary"
              placeholder="Describe what students will learn..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-text-secondary">Cover Image</label>
            <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer bg-surface/30 relative">
              <input 
                type="file" 
                accept="image/*"
                onChange={(e) => setCoverImage(e.target.files?.[0] || null)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center gap-3 text-text-secondary pointer-events-none">
                <Upload size={32} />
                <span className="font-medium text-text-primary">{coverImage ? coverImage.name : 'Click or drag to upload image'}</span>
                {!coverImage && <span className="text-xs">JPG, PNG or WEBP (max. 5MB)</span>}
              </div>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2 text-text-secondary">Course Document (Optional)</label>
            <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer bg-surface/30 relative">
              <input 
                type="file" 
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  if (file && file.size > 450 * 1024 * 1024) {
                    setError('Document file size exceeds 450MB limit.');
                    setDocumentFile(null);
                  } else {
                    setDocumentFile(file);
                  }
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center gap-3 text-text-secondary pointer-events-none">
                <Upload size={32} />
                <span className="font-medium text-text-primary">{documentFile ? documentFile.name : 'Click or drag to upload document'}</span>
                {!documentFile && <span className="text-xs">PDF, Word, Excel, PowerPoint (max. 450MB)</span>}
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full btn-primary py-3 rounded-lg font-bold flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <><Loader2 size={18} className="animate-spin" /> Creating...</>
              ) : (
                'Publish Course'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
