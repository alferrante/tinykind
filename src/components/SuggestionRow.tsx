"use client";

interface SuggestionRowProps {
  suggestions: readonly string[];
  onSelect: (suggestion: string) => void;
}

function getSuggestionIcon(suggestion: string): "pencil" | "heart" | "smile" | "mail" | "spark" | "sun" {
  const normalized = suggestion.toLowerCase();

  if (normalized.includes("laugh")) return "smile";
  if (normalized.includes("showed up") || normalized.includes("help") || normalized.includes("week")) return "heart";
  if (normalized.includes("text") || normalized.includes("thank") || normalized.includes("note")) return "mail";
  if (normalized.includes("weekend") || normalized.includes("saturday") || normalized.includes("sunday")) return "sun";
  if (normalized.includes("grateful") || normalized.includes("gratitude") || normalized.includes("appreciate"))
    return "spark";

  return "pencil";
}

function SuggestionIcon({ suggestion }: { suggestion: string }) {
  const icon = getSuggestionIcon(suggestion);
  const commonProps = {
    "aria-hidden": true,
    className: "h-[18px] w-[18px] flex-none text-[#7C7771]",
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
    viewBox: "0 0 24 24",
  };

  switch (icon) {
    case "heart":
      return (
        <svg {...commonProps}>
          <path d="M12 20.2 4.9 13.5a4.7 4.7 0 0 1 6.7-6.6L12 7.3l.4-.4a4.7 4.7 0 0 1 6.7 6.6L12 20.2Z" />
        </svg>
      );
    case "smile":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M8.8 14.4c.9 1.2 2 1.8 3.2 1.8s2.3-.6 3.2-1.8" />
          <path d="M9.2 10.2h.01M14.8 10.2h.01" />
        </svg>
      );
    case "mail":
      return (
        <svg {...commonProps}>
          <rect height="12.5" rx="2.4" width="17" x="3.5" y="5.75" />
          <path d="m5.2 8.1 6.1 4.8a1.2 1.2 0 0 0 1.4 0l6.1-4.8" />
        </svg>
      );
    case "spark":
      return (
        <svg {...commonProps}>
          <path d="m12 4.1 1.6 4.3 4.3 1.6-4.3 1.6L12 16l-1.6-4.4-4.3-1.6 4.3-1.6L12 4.1Z" />
          <path d="M18.3 4.8v2.7M19.65 6.15h-2.7M5.7 16.5v2.7M7.05 17.85h-2.7" />
        </svg>
      );
    case "sun":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5" />
        </svg>
      );
    default:
      return (
        <svg {...commonProps}>
          <path d="m4 20 4.3-1 9.5-9.5a2.1 2.1 0 0 0-3-3L5.3 16 4 20Z" />
          <path d="m13.4 6.6 4 4" />
        </svg>
      );
  }
}

export default function SuggestionRow({ suggestions, onSelect }: SuggestionRowProps) {
  return (
    <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-left text-[#5F5B55]">
      {suggestions.map((suggestion) => (
        <button
          className="inline-flex max-w-full items-center gap-3 rounded-[18px] border border-[#DDD7CF] bg-[#FFFFFF] px-4 py-3 text-[13px] font-medium leading-[1.1] transition duration-150 ease-out hover:border-[#CEC5BA] hover:bg-[#FBF8F4] hover:text-[#2E2E2E] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#E9DDD0] sm:px-5 sm:text-[15px]"
          key={suggestion}
          onClick={() => onSelect(suggestion)}
          type="button"
        >
          <SuggestionIcon suggestion={suggestion} />
          <span className="truncate">{suggestion}</span>
        </button>
      ))}
    </div>
  );
}
