"use client";

interface SuggestionRowProps {
  suggestions: readonly string[];
  onSelect: (suggestion: string) => void;
}

export default function SuggestionRow({ suggestions, onSelect }: SuggestionRowProps) {
  const firstRow = suggestions.slice(0, 2);
  const secondRow = suggestions.slice(2);

  return (
    <div className="mt-8 text-center">
      <div className="flex flex-wrap items-center justify-center gap-y-3 text-[#6B6B6B]">
        {firstRow.map((suggestion, index) => (
          <div className="flex items-center" key={suggestion}>
            <button
              className="rounded-full bg-transparent px-3 py-1.5 text-sm transition duration-150 ease-out hover:bg-[#F1F1EF] hover:text-[#2E2E2E]"
              onClick={() => onSelect(suggestion)}
              type="button"
            >
              {suggestion}
            </button>
            {index === 0 ? <span className="mx-1 hidden h-4 w-px bg-[#E8E6E3] sm:block" /> : null}
          </div>
        ))}
      </div>

      {secondRow.length > 0 ? (
        <div className="mt-1 flex justify-center text-[#6B6B6B]">
          {secondRow.map((suggestion) => (
            <button
              className="rounded-full bg-transparent px-3 py-1.5 text-sm transition duration-150 ease-out hover:bg-[#F1F1EF] hover:text-[#2E2E2E]"
              key={suggestion}
              onClick={() => onSelect(suggestion)}
              type="button"
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
