import CourseSearchClient from "@/components/CourseSearchClient";

async function getCourses() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";
  try {
    // Fetch courses from the real API
    const res = await fetch(`${apiUrl}/courses`, { cache: 'no-store' });
    if (!res.ok) {
      console.error("Failed to fetch courses, status:", res.status);
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
