import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * TestAllFeatures.tsx
 * A deliberately flawed React component designed to exercise the code review agent.
 * Includes examples of: security, performance, style, bug risks, maintainability, and documentation gaps.
 */

// SECURITY: hardcoded secret (do NOT do this in real apps)
const SECRET_API_KEY = "sk_demo_hardcoded_secret";

// SECURITY: naive sanitizer (returns input unchanged)
function naiveSanitize(html: string) {
  return html; // XSS risk: no actual sanitization
}

// STYLE: ambiguous types and any usage
type Props = any;

// MAINTAINABILITY: magic numbers, duplicated logic, TODOs
const MAGIC_THRESHOLD = 42; // TODO: externalize to config

// PERFORMANCE: unnecessary global array for demo heavy computation
const BIG_ARRAY = Array.from({ length: 25000 }, (_, i) => i);

export default function TestAllFeatures(props: Props) {
  // STYLE: unused prop, inconsistent naming
  const user_name = props?.userName || "anonymous";

  // STATE
  const [count, setCount] = useState(0);
  const [rawHtml, setRawHtml] = useState("<b>hello</b>");
  const [items, setItems] = useState<number[]>([]);
  const [query, setQuery] = useState("users?id=1");
  const leakRef = useRef<HTMLDivElement>(null); // STYLE: ref never used

  // BUG: missing dependency array causes effect to run on every render (re-renders loop)
  useEffect(() => {
    // PERFORMANCE: setInterval without cleanup
    const id = setInterval(() => setCount(count + 1), 500); // stale closure: increments off initial count
    // BUG: event listener not cleaned up (memory leak)
    window.addEventListener("resize", () => console.log("resized"));
    // SECURITY: store sensitive data in localStorage
    localStorage.setItem("apiKey", SECRET_API_KEY);
    return () => {
      // intentionally missing clearInterval(id) and removeEventListener
    };
  });

  // PERFORMANCE: expensive computation inside render without memoization
  const sumExpensive = BIG_ARRAY.reduce((acc, n) => acc + Math.sqrt(n), 0);

  // PERFORMANCE: unbounded computation; memoization missing
  const derived = useMemo(() => items.map((i) => i * 2).filter((x) => x > MAGIC_THRESHOLD), [items]);

  // SECURITY: dangerous inner HTML
  const htmlToRender = naiveSanitize(rawHtml);

  // STYLE: function names inconsistent; any usage
  function onClickDoStuff(evt: any) {
    // BUG: use assignment instead of comparison
    let value = 0;
    if ((value = 1)) {
      // SECURITY: using eval
      eval("console.log('bad idea')");
    }

    // MAINTAINABILITY: duplicated logic (twice)
    const doubledA = items.map((i) => i * 2);
    const doubledB = items.map((i) => i * 2);

    setItems([...items, Math.random() * 100]);
  }

  async function runFetch() {
    try {
      // SECURITY: unsanitized path concat, no error handling granularity
      const res = await fetch("/api/" + query);
      const data = await res.json();
      console.log("data", data);
    } catch (e) {
      // STYLE: swallow error
    }
  }

  // PERFORMANCE: render large list without virtualization, unstable keys
  const list = Array.from({ length: 1000 }, (_, i) => i + count);

  return (
    <div style={{ padding: 16 }}>
      <h1>TestAllFeatures · {user_name}</h1>

      {/* REVIEW TAB */}
      <section style={{ border: "1px solid #333", padding: 12, borderRadius: 8 }}>
        <h2>Review</h2>
        <button onClick={onClickDoStuff}>Do Stuff</button>
        <button onClick={() => setRawHtml("<img src=x onerror=alert('xss')>")}>Set Risky HTML</button>
        <button onClick={runFetch}>Run Fetch</button>
        <div style={{ marginTop: 8 }}>
          {/* SECURITY: XSS risk via dangerouslySetInnerHTML */}
          <div dangerouslySetInnerHTML={{ __html: htmlToRender }} />
        </div>
        <div>
          <label>
            Query (unsafe):
            <input value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
        </div>
      </section>

      {/* ANALYTICS TAB (mock content to exercise UI) */}
      <section style={{ border: "1px solid #333", padding: 12, borderRadius: 8, marginTop: 12 }}>
        <h2>Analytics</h2>
        <p>
          Sum (expensive, not memoized): {Math.round(sumExpensive)} · Derived length: {derived.length}
        </p>
        <p>Magic threshold: {MAGIC_THRESHOLD}</p>
      </section>

      {/* HISTORY TAB */}
      <section style={{ border: "1px solid #333", padding: 12, borderRadius: 8, marginTop: 12 }}>
        <h2>History (unvirtualized list)</h2>
        <ul>
          {list.map((n, i) => (
            // BUG: unstable keys lead to reconciliation issues
            <li key={Math.random()} style={{ display: "flex", gap: 8 }}>
              <span>Item {i}</span>
              <span>{n}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* STYLE: inline styles repeated; MAINTAINABILITY: large component */}
      <section style={{ border: "1px solid #333", padding: 12, borderRadius: 8, marginTop: 12 }}>
        <h2>Notes</h2>
        <p>// TODO: split component
          // TODO: add unit tests
          // FIXME: remove hardcoded secret
        </p>
      </section>
    </div>
  );
}