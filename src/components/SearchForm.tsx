"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

interface AddressSuggestion {
  id: string;
  label: string;
  layer?: string;
  borough?: string;
  zip_code?: string;
}

interface AddressAutocompleteResponse {
  suggestions?: AddressSuggestion[];
}

export function SearchForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"address" | "bbl">("address");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const blurTimeoutRef = useRef<number | null>(null);
  const suppressAutocompleteRef = useRef(false);

  const listId = "address-suggestions-list";

  const activeSuggestionId = useMemo(() => {
    if (activeSuggestionIndex < 0 || activeSuggestionIndex >= suggestions.length) {
      return undefined;
    }
    return `${listId}-${activeSuggestionIndex}`;
  }, [activeSuggestionIndex, suggestions.length]);

  useEffect(() => {
    if (mode !== "address") {
      setSuggestions([]);
      setShowSuggestions(false);
      setActiveSuggestionIndex(-1);
      return;
    }

    const query = value.trim();
    if (query.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      setActiveSuggestionIndex(-1);
      setLoadingSuggestions(false);
      return;
    }

    if (suppressAutocompleteRef.current) {
      suppressAutocompleteRef.current = false;
      setLoadingSuggestions(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoadingSuggestions(true);
      try {
        const response = await fetch(`/api/geosearch/autocomplete?text=${encodeURIComponent(query)}&limit=6`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          setSuggestions([]);
          setShowSuggestions(false);
          setActiveSuggestionIndex(-1);
          return;
        }

        const json = (await response.json()) as AddressAutocompleteResponse;
        const nextSuggestions = (json.suggestions ?? []).filter((item) => Boolean(item.label));
        setSuggestions(nextSuggestions);
        setShowSuggestions(nextSuggestions.length > 0);
        setActiveSuggestionIndex(-1);
      } catch (fetchError) {
        if (!(fetchError instanceof DOMException && fetchError.name === "AbortError")) {
          setSuggestions([]);
          setShowSuggestions(false);
          setActiveSuggestionIndex(-1);
        }
      } finally {
        setLoadingSuggestions(false);
      }
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [mode, value]);

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        window.clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  function chooseSuggestion(suggestion: AddressSuggestion) {
    suppressAutocompleteRef.current = true;
    setValue(suggestion.label);
    setSuggestions([]);
    setShowSuggestions(false);
    setActiveSuggestionIndex(-1);
    setError(null);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      setError(`Enter a ${mode}.`);
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const query = mode === "address" ? `address=${encodeURIComponent(trimmed)}` : `bbl=${encodeURIComponent(trimmed)}`;
      const response = await fetch(`/api/brief?${query}`);
      const json = (await response.json()) as { error?: string; share_path?: string };

      if (!response.ok || !json.share_path) {
        throw new Error(json.error ?? "Could not generate a brief for this location.");
      }

      router.push(json.share_path);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to search this location.");
      setLoading(false);
    }
  }

  return (
    <form className="search-form" onSubmit={onSubmit}>
      <div className="mode-row" role="radiogroup" aria-label="Search mode">
        <button
          className={mode === "address" ? "mode-chip active" : "mode-chip"}
          type="button"
          onClick={() => {
            setMode("address");
            setError(null);
          }}
          aria-pressed={mode === "address"}
        >
          Address
        </button>
        <button
          className={mode === "bbl" ? "mode-chip active" : "mode-chip"}
          type="button"
          onClick={() => {
            setMode("bbl");
            setSuggestions([]);
            setShowSuggestions(false);
            setActiveSuggestionIndex(-1);
            setError(null);
          }}
          aria-pressed={mode === "bbl"}
        >
          BBL
        </button>
      </div>

      <label htmlFor="query-input" className="search-label">
        {mode === "address" ? "NYC address" : "Borough-Block-Lot (10 digits)"}
      </label>
      <div className="search-input-row">
        <div className="search-combobox">
          <input
            id="query-input"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setError(null);
            }}
            onFocus={() => {
              if (blurTimeoutRef.current) {
                window.clearTimeout(blurTimeoutRef.current);
                blurTimeoutRef.current = null;
              }
              if (mode === "address" && suggestions.length > 0) {
                setShowSuggestions(true);
              }
            }}
            onBlur={() => {
              blurTimeoutRef.current = window.setTimeout(() => {
                setShowSuggestions(false);
              }, 110);
            }}
            onKeyDown={(event) => {
              if (mode !== "address" || !showSuggestions || suggestions.length === 0) {
                return;
              }

              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveSuggestionIndex((prev) => (prev + 1) % suggestions.length);
                return;
              }

              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveSuggestionIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
                return;
              }

              if (event.key === "Enter" && activeSuggestionIndex >= 0) {
                event.preventDefault();
                chooseSuggestion(suggestions[activeSuggestionIndex]);
                return;
              }

              if (event.key === "Escape") {
                setShowSuggestions(false);
                setActiveSuggestionIndex(-1);
              }
            }}
            placeholder={mode === "address" ? "e.g., 350 5th Ave, Manhattan" : "e.g., 1008350041"}
            autoComplete="off"
            role={mode === "address" ? "combobox" : undefined}
            aria-autocomplete={mode === "address" ? "list" : undefined}
            aria-expanded={mode === "address" ? showSuggestions : undefined}
            aria-controls={mode === "address" ? listId : undefined}
            aria-activedescendant={mode === "address" ? activeSuggestionId : undefined}
          />

          {mode === "address" && showSuggestions && suggestions.length > 0 ? (
            <ul id={listId} className="search-suggestions" role="listbox" aria-label="Address suggestions">
              {suggestions.map((suggestion, index) => {
                const isActive = index === activeSuggestionIndex;
                return (
                  <li key={suggestion.id} id={`${listId}-${index}`} role="option" aria-selected={isActive}>
                    <button
                      type="button"
                      className={isActive ? "active" : undefined}
                      onMouseDown={(event) => {
                        event.preventDefault();
                      }}
                      onMouseEnter={() => {
                        setActiveSuggestionIndex(index);
                      }}
                      onClick={() => chooseSuggestion(suggestion)}
                    >
                      <span>{suggestion.label}</span>
                      {suggestion.borough || suggestion.layer ? (
                        <small>
                          {[suggestion.borough, suggestion.layer].filter(Boolean).join(" • ")}
                        </small>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {mode === "address" && loadingSuggestions && value.trim().length >= 3 ? (
            <p className="search-suggest-hint">Looking up NYC addresses...</p>
          ) : null}
        </div>
        <button type="submit" disabled={loading}>
          {loading ? "Loading..." : "Build Brief"}
        </button>
      </div>

      {error ? <p className="search-error">{error}</p> : null}
    </form>
  );
}
