"use client";
import { useState, useRef, useEffect } from "react";

interface HeaderDropdownProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  openOnHover?: boolean;
}

const HeaderDropdown = ({ options, value, onChange, className = "", openOnHover = false }: HeaderDropdownProps) => {
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

  const handleMouseEnter = () => {
    if (openOnHover) {
      setIsOpen(true);
    }
  };

  const handleMouseLeave = () => {
    if (openOnHover) {
      setIsOpen(false);
    }
  };

  const handleButtonClick = () => {
    setIsOpen((prev) => !prev);
  };

  return (
    <div
      className={`relative mr-1 ${className}`}
      ref={dropdownRef}
      suppressHydrationWarning
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        className="flex items-center gap-2 whitespace-nowrap pl-0 pr-0 py-1.5 mb-2 font-semibold lg:text-xl md:text-lg text-[#013300] cursor-pointer focus:outline-none"
        onClick={handleButtonClick}
      >
        {value}
        {/* Arrow is always visible; only rotation changes when open. */}
        <span
          className="inline-flex w-4 overflow-hidden"
          aria-hidden="true"
        >
          <svg
            className={`h-4 w-4 transition-transform duration-200 ease-out ${isOpen ? 'rotate-180' : 'rotate-0'}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
          </svg>
        </span>
      </button>
      
      {isOpen && (
        <div className="absolute z-50 mt-1 left-0 min-w-41 w-max bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden">
          {options.map((option) => (
            <div
              key={option}
              className={`px-4 py-2 whitespace-nowrap cursor-pointer transition-colors ${
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