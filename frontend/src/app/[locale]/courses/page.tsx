import CourseSearchClient from "@/components/CourseSearchClient";
import { cookies } from "next/headers";

async function getCourses() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";
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

  return <CourseSearchClient initialCourses={courses} />;
}

