import React, { useState, useEffect } from "react";
import HSSTab from "./components/tabs/HSSTab";
import StandardShapesTab from "./components/tabs/StandardShapesTab";
import PlateRigidityTab from "./components/tabs/PlateRigidityTab";
import LegendModal from "./components/modals/LegendModal";
import ReferencesModal from "./components/modals/ReferencesModal";

const TABS = [
  { id: "hss",      label: "HSS Connections" },
  { id: "standard", label: "Standard Shapes" },
  { id: "rigidity", label: "Base Plate Rigidity" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState("hss");
  const [legendOpen, setLegendOpen] = useState(false);
  const [refsOpen, setRefsOpen] = useState(false);

  // Session-persisted report metadata (project / engineer / job # / date).
  // Lifted here so the modal pre-fills across tab switches.
  const [reportMeta, setReportMeta] = useState({
    project: "", engineer: "", jobNumber: "",
    date: new Date().toISOString().slice(0, 10),
  });

  // Global Dark Mode state
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("weld_calc_dark_mode");
    if (saved !== null) {
      return saved === "true";
    }
    // Fallback to system preference
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    localStorage.setItem("weld_calc_dark_mode", String(darkMode));
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode(prev => !prev);

  return (
    <div className="app-container">
      {/* Main Tab Panels with grid layouts (mounted persistently to keep tab states) */}
      <div style={{ display: activeTab === "hss" ? "contents" : "none" }}>
        <HSSTab
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          tabs={TABS}
          setLegendOpen={setLegendOpen}
          setRefsOpen={setRefsOpen}
          darkMode={darkMode}
          toggleDarkMode={toggleDarkMode}
          reportMeta={reportMeta}
          setReportMeta={setReportMeta}
        />
      </div>

      <div style={{ display: activeTab === "standard" ? "contents" : "none" }}>
        <StandardShapesTab
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          tabs={TABS}
          setLegendOpen={setLegendOpen}
          setRefsOpen={setRefsOpen}
          darkMode={darkMode}
          toggleDarkMode={toggleDarkMode}
          reportMeta={reportMeta}
          setReportMeta={setReportMeta}
        />
      </div>

      <div style={{ display: activeTab === "rigidity" ? "contents" : "none" }}>
        <PlateRigidityTab
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          tabs={TABS}
          setLegendOpen={setLegendOpen}
          setRefsOpen={setRefsOpen}
          darkMode={darkMode}
          toggleDarkMode={toggleDarkMode}
          reportMeta={reportMeta}
          setReportMeta={setReportMeta}
        />
      </div>

      {/* Overlay Modal for lookup dictionary */}
      {legendOpen && <LegendModal onClose={() => setLegendOpen(false)} />}

      {/* Overlay Modal for reference standards */}
      {refsOpen && <ReferencesModal onClose={() => setRefsOpen(false)} />}
    </div>
  );
}



