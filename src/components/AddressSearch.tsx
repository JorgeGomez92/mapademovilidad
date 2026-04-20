"use client";

import { useState, useEffect, useRef } from "react";
import { searchAddresses, SearchResult } from "@/lib/geocoding";

interface Props {
  placeholder?: string;
  onSelect: (result: SearchResult) => void;
}

export default function AddressSearch({ placeholder, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [touched, setTouched] = useState(false);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);

    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    timer.current = setTimeout(async () => {
      const r = await searchAddresses(q);
      setResults(r);
      setLoading(false);
      setOpen(true);
    }, 400);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query]);

  useEffect(() => {
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, []);

  const handleSelect = (r: SearchResult) => {
    onSelect(r);
    setQuery("");
    setResults([]);
    setOpen(false);
    setTouched(false);
  };

  const showDropdown =
    open && touched && query.trim().length >= 3;

  return (
    <div className="address-search" ref={containerRef}>
      <input
        type="text"
        className="address-search-input"
        placeholder={placeholder || "Buscar dirección..."}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setTouched(true);
          setOpen(true);
        }}
        onFocus={() => {
          if (query.trim().length >= 3) setOpen(true);
        }}
        autoComplete="off"
        inputMode="search"
      />
      {showDropdown && (
        <ul className="address-search-dropdown" role="listbox">
          {loading && (
            <li className="address-search-item address-search-item-info">
              Buscando...
            </li>
          )}
          {!loading && results.length === 0 && (
            <li className="address-search-item address-search-item-info">
              No se encontraron direcciones
            </li>
          )}
          {!loading &&
            results.map((r, i) => (
              <li
                key={`${r.lat}-${r.lng}-${i}`}
                className="address-search-item"
                role="option"
                aria-selected={false}
                onClick={() => handleSelect(r)}
              >
                {r.direccion.displayName}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
