'use client';

import { useState } from 'react';
import Link from "next/link";
import Image from "next/image";
import { BookOpen, Star, Users, Search } from "lucide-react";
import CreateCourseButton from "@/components/CreateCourseButton";
import UploadVideoButton from "@/components/UploadVideoButton";
import BackButton from "@/components/BackButton";

interface Course {
  id: number;
  title: string;
  description: string;
  cover_image_url?: string;
  instructor_id: number;
  instructor?: { email: string };
}

interface CourseSearchClientProps {
  initialCourses: Course[];
}

export default function CourseSearchClient({ initialCourses }: CourseSearchClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchEngine, setSearchEngine] = useState<'app' | 'google'>('app');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchEngine === 'google' && searchQuery.trim()) {
      window.open(`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`, '_blank');
    }
  };

  const filteredCourses = initialCourses.filter(course => {
    if (searchEngine === 'google') return true; // Show all locally if they are about to search Google
    if (!searchQuery) return true;
    const lowerQuery = searchQuery.toLowerCase();
    return (
      course.title.toLowerCase().includes(lowerQuery) ||
      (course.description && course.description.toLowerCase().includes(lowerQuery))
    );
  });

  return (
    <div className="min-h-screen px-4 py-24 max-w-7xl mx-auto">
      <BackButton className="mb-6" />
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">
            Explore <span className="text-gradient">Courses</span>
          </h1>
          <p className="text-text-secondary max-w-xl">
            Discover our curated library of premium courses designed to accelerate your career and expand your knowledge base.
          </p>
        </div>
        
        {/* Search Bar & Actions */}
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
            <div className="relative w-full md:w-96 flex shadow-sm rounded-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={20} />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchEngine === 'app' ? "Search courses, skills..." : "Search Google..."} 
                className="w-full pl-10 pr-4 py-3 rounded-l-full rounded-r-none bg-surface border border-border focus:border-primary focus:ring-1 focus:ring-primary text-text-primary placeholder:text-text-secondary outline-none transition-all text-sm font-medium"
              />
              <select 
                value={searchEngine}
                onChange={(e) => setSearchEngine(e.target.value as 'app' | 'google')}
                className="bg-surface border-y border-r border-border rounded-r-full px-4 text-sm text-text-secondary hover:text-text-primary focus:outline-none cursor-pointer appearance-none font-medium"
              >
                <option value="app">App</option>
                <option value="google">Google</option>
              </select>
            </div>
          </form>
          <UploadVideoButton courses={initialCourses} />
          <CreateCourseButton />
        </div>
      </div>

      {/* Course Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredCourses.length === 0 ? (
          <div className="col-span-full py-12 text-center text-text-secondary">
            {searchQuery ? "No courses match your search." : "No courses found. Create some in the database!"}
          </div>
        ) : (
          filteredCourses.map((course) => (
            <Link href={`/courses/${course.id}`} key={course.id} className="glass-card flex flex-col overflow-hidden group cursor-pointer block">
              
              {/* Course Image */}
              <div className="h-48 w-full relative overflow-hidden bg-surface">
                {course.cover_image_url ? (
                  <Image 
                    src={course.cover_image_url} 
                    alt={course.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-text-secondary">
                    <BookOpen size={48} className="opacity-20" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/10 transition-colors duration-500" />
                <div className="absolute top-4 left-4 z-10">
                  <span className="px-3 py-1 text-xs font-semibold bg-black/40 backdrop-blur-md rounded-full text-white border border-white/20">
                    Course
                  </span>
                </div>
              </div>
              
              {/* Course Content */}
              <div className="p-6 flex flex-col flex-grow">
                <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors line-clamp-2">
                  {course.title}
                </h3>
                <p className="text-sm text-text-secondary mb-4 flex items-center gap-2">
                  <Users size={16} /> 
                  {course.instructor?.email ? course.instructor.email.split('@')[0] : `Formateur #${course.instructor_id}`}
                </p>
                
                <p className="text-sm text-text-secondary line-clamp-2 mb-6">
                  {course.description || "No description provided for this course."}
                </p>
                
                {/* Footer info */}
                <div className="flex items-center justify-between pt-4 border-t border-border mt-auto">
                  <div className="flex items-center gap-1 text-yellow-400 font-semibold text-sm">
                    <Star size={16} fill="currentColor" /> 5.0
                  </div>
                  <div className="text-sm text-text-secondary font-medium">
                    New
                  </div>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
