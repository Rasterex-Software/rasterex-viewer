import { useEffect, useRef } from "react";
import { RasterexViewer, takeoffDemo } from "../../dist/index.js";
import "./App.css";

function App() {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);

  useEffect(() => {
    const viewer = new RasterexViewer({
      container: containerRef.current,
      ...takeoffDemo,
      iframeTitle: takeoffDemo.label,
      iframeAttributes: {
        allow: "fullscreen"
      }
    });

    viewerRef.current = viewer;

    const mountViewer = async () => {
      try {
        await viewer.mount();
      } catch (error) {
        console.error(error);
      }
    };

    mountViewer();

    return () => {
      viewerRef.current?.destroy();
      viewerRef.current = null;
    };
  }, []);

  return (
    <main className="app">
      <section ref={containerRef} className="viewer" />
    </main>
  );
}

export default App;
