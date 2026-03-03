"use client";

interface SuggestionRowProps {
  suggestions: readonly string[];
  onSelect: (suggestion: string) => void;
}

export default function SuggestionRow({ suggestions, onSelect }: SuggestionRowProps) {
  return (
    <div className="mt-8 text-center text-[#6B6B6B]">
      <div className="flex flex-col items-center gap-3 leading-[1.2] sm:hidden">
        {suggestions.map((suggestion) => (
          <button
            className="rounded-full bg-transparent px-2 py-1 text-[12px] transition duration-150 ease-out hover:bg-[#F1F1EF] hover:text-[#2E2E2E]"
            key={suggestion}
            onClick={() => onSelect(suggestion)}
            type="button"
          >
            {suggestion}
          </button>
        ))}
      </div>

      <div className="hidden items-center justify-center gap-1 sm:flex">
        {suggestions.map((suggestion, index) => (
          <div className="flex items-center" key={suggestion}>
            <button
              className="rounded-full bg-transparent px-2 py-1 text-[12px] leading-[1.2] whitespace-nowrap transition duration-150 ease-out hover:bg-[#F1F1EF] hover:text-[#2E2E2E]"
              onClick={() => onSelect(suggestion)}
              type="button"
            >
              {suggestion}
            </button>
            {index < suggestions.length - 1 ? <span className="mx-1 h-4 w-px bg-[#E8E6E3]" /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
