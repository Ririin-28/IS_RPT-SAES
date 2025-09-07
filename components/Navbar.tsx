'use client';

import { useState } from 'react';
import { FiMenu, FiX, FiUser, FiSettings, FiLogOut } from 'react-icons/fi';

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <h1 className="text-xl font-bold text-gray-900">RPT-SAES</h1>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              <a href="#" className="text-gray-900 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors">
                Dashboard
              </a>
              <a href="#" className="text-gray-600 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors">
                Students
              </a>
              <a href="#" className="text-gray-600 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors">
                Reports
              </a>
              <a href="#" className="text-gray-600 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors">
                Calendar
              </a>
            </div>
          </div>

          {/* Profile Dropdown */}
          <div className="hidden md:block">
            <div className="ml-4 flex items-center md:ml-6">
              <div className="relative">
                <button
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center">
                    <FiUser className="h-4 w-4 text-white" />
                  </div>
                </button>

                {isProfileOpen && (
                  <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
                    <div className="py-1">
                      <a href="#" className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                        <FiUser className="mr-3 h-4 w-4" />
                        Profile
                      </a>
                      <a href="#" className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                        <FiSettings className="mr-3 h-4 w-4" />
                        Settings
                      </a>
                      <a href="#" className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                        <FiLogOut className="mr-3 h-4 w-4" />
                        Sign out
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {isMenuOpen ? <FiX className="h-6 w-6" /> : <FiMenu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-gray-50">
            <a href="#" className="text-gray-900 block px-3 py-2 text-base font-medium">
              Dashboard
            </a>
            <a href="#" className="text-gray-600 hover:text-gray-900 block px-3 py-2 text-base font-medium">
              Students
            </a>
            <a href="#" className="text-gray-600 hover:text-gray-900 block px-3 py-2 text-base font-medium">
              Reports
            </a>
            <a href="#" className="text-gray-600 hover:text-gray-900 block px-3 py-2 text-base font-medium">
              Calendar
            </a>
          </div>
          <div className="pt-4 pb-3 border-t border-gray-200">
            <div className="px-2 space-y-1">
              <a href="#" className="flex items-center px-3 py-2 text-base font-medium text-gray-600 hover:text-gray-900">
                <FiUser className="mr-3 h-5 w-5" />
                Profile
              </a>
              <a href="#" className="flex items-center px-3 py-2 text-base font-medium text-gray-600 hover:text-gray-900">
                <FiSettings className="mr-3 h-5 w-5" />
                Settings
              </a>
              <a href="#" className="flex items-center px-3 py-2 text-base font-medium text-gray-600 hover:text-gray-900">
                <FiLogOut className="mr-3 h-5 w-5" />
                Sign out
              </a>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}