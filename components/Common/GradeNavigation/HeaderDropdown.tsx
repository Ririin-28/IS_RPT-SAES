"use client";
import { useState, useRef, useEffect } from "react";

interface HeaderDropdownProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
}

const HeaderDropdown = ({ options, value, onChange }: HeaderDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleOptionClick = (option: string) => {
    onChange(option);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        className="flex items-center gap-2 pl-2 pr-1 py-1.5 mb-2 text-xl font-semibold text-[#013300] cursor-pointer focus:outline-none group"
        onClick={() => setIsOpen(!isOpen)}
      >
        {value}
        {/* Arrow wrapper: 0 width by default; expands on hover or when open */}
        <span
          className={`inline-flex overflow-hidden transition-[width] duration-200 ease-out ${isOpen ? 'w-4' : 'w-0'} group-hover:w-4`}
          aria-hidden="true"
        >
          <svg
            className={`h-4 w-4 transition-transform duration-200 ease-out ${isOpen ? 'rotate-180 translate-x-0' : 'translate-x-2 group-hover:translate-x-0'}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
          </svg>
        </span>
      </button>
      
      {isOpen && (
        <div className="absolute z-50 mt-1 left-0 bg-white border border-gray-200 rounded-md shadow-lg w-40 overflow-hidden">
          {options.map((option) => (
            <div
              key={option}
              className={`px-4 py-2 cursor-pointer transition-colors ${
                option === value
                  ? "bg-[#013300] text-white"
                  : "text-[#013300] hover:bg-gray-100"
              }`}
              onClick={() => handleOptionClick(option)}
            >
              {option}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HeaderDropdown;