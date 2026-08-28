'use client';

import { CheckSquare } from 'lucide-react';

export default function TasksPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <div className="glass-card p-12 max-w-md w-full space-y-6">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-secondary/10 flex items-center justify-center">
          <CheckSquare size={40} className="text-secondary" />
        </div>
        <h1 className="text-3xl font-bold">Tasks</h1>
        <p className="text-text-secondary">
          Track your assignments, quizzes, and deadlines here. This feature is coming soon!
        </p>
        <div className="inline-block px-4 py-2 bg-secondary/10 text-secondary rounded-full text-sm font-semibold">
          Coming Soon
        </div>
      </div>
    </div>
  );
}
