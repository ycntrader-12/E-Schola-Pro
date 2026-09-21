import CourseSearchClient from "@/components/CourseSearchClient";
import { cookies } from "next/headers";
import { Suspense } from "react";

async function getCourses() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
  const cleanApiUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('access_token')?.value;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${cleanApiUrl}/courses/`, { 
      cache: 'no-store',
      signal: controller.signal,
      headers
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      if (res.status !== 401) {
        console.error("Failed to fetch courses, status:", res.status);
      }
      return [];
    }
    return await res.json();
  } catch (error) {
    console.error("Failed to fetch courses:", error);
    return [];
  }
}

export default async function CoursesPage() {
  const courses = await getCourses();

  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-slate-50 text-slate-500">
        <div className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-bold text-slate-700">Chargement de la bibliothèque de cours...</p>
      </div>
    }>
      <CourseSearchClient initialCourses={courses} />
    </Suspense>
  );
}

