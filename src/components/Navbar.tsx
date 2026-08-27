'use client';

import Link from 'next/link';
import { UserButton, useUser } from '@clerk/nextjs';

export default function Navbar() {
  const { user } = useUser();

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="max-w-6xl mx-auto flex justify-between items-center">
        {/* Logo / Title */}
        <Link href="/" className="text-xl font-bold text-gray-900">
          Recruitment Portal
        </Link>

        {/* Navigation Links */}
        <div className="flex items-center space-x-6 text-sm font-medium text-gray-700">
          <Link href="/dashboard" className="hover:text-blue-600 transition">
            Dashboard
          </Link>
          <Link href="/projects" className="hover:text-blue-600 transition">
            Projects & Jobs
          </Link>
          <Link href="/candidates" className="hover:text-blue-600 transition">
            Candidates
          </Link>
          <Link href="/candidates/new" className="hover:text-blue-600 transition">
            + Add Candidate
          </Link>
        </div>

        {/* User Account Button */}
        <div className="flex items-center space-x-3">
          {user && <span className="text-xs text-gray-500">{user.fullName || user.primaryEmailAddress?.emailAddress}</span>}
          <UserButton afterSignOutUrl="/login" />
        </div>
      </div>
    </nav>
  );
}